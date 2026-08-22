"""
normalize_department_records.py — Unifies and normalizes institutional department records in DB
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal
from backend.models import Student, Department
from sqlalchemy import func


def normalize_departments():
    db = SessionLocal()
    print("Normalizing department records and mappings...")

    # 1. Ensure target canonical departments exist
    canonical_depts = [
        {"code": "CSE", "name": "Computer Science and Engineering"},
        {"code": "CSE(CS)", "name": "Computer Science and Engineering (Cyber Security)"},
        {"code": "CSE(IOT)", "name": "Computer Science and Engineering (IoT)"},
        {"code": "IT", "name": "Information Technology"},
        {"code": "AIDS", "name": "Artificial Intelligence and Data Science"},
        {"code": "AIML", "name": "Artificial Intelligence and Machine Learning"},
        {"code": "ECE", "name": "Electronics and Communication Engineering"},
        {"code": "EEE", "name": "Electrical and Electronics Engineering"},
        {"code": "AGRI", "name": "Agricultural Engineering"},
        {"code": "MECH", "name": "Mechanical Engineering"},
        {"code": "CIVIL", "name": "Civil Engineering"},
        {"code": "BME", "name": "Biomedical Engineering"},
    ]

    dept_map = {}
    for item in canonical_depts:
        dept = db.query(Department).filter(
            (Department.code == item["code"]) | (Department.name == item["name"])
        ).first()
        if not dept:
            dept = Department(code=item["code"], name=item["name"])
            db.add(dept)
            db.commit()
            db.refresh(dept)
        else:
            # Ensure standard code and name
            dept.code = item["code"]
            dept.name = item["name"]
            db.commit()
        dept_map[item["code"]] = dept.id

    # 2. Merge alias departments:
    # 'CS' (dept_id 9) -> 'CSE(CS)'
    cs_alias = db.query(Department).filter(Department.code == "CS").first()
    if cs_alias and cs_alias.id != dept_map["CSE(CS)"]:
        target_id = dept_map["CSE(CS)"]
        moved = db.query(Student).filter(Student.department_id == cs_alias.id).update({"department_id": target_id})
        print(f"  Moved {moved} students from alias 'CS' -> 'CSE(CS)' (ID: {target_id})")
        db.delete(cs_alias)
        db.commit()

    # 'CSE_AI_TEST' / 'CSE_TEST' -> 'CSE'
    for test_code in ["CSE_AI_TEST", "CSE_TEST"]:
        test_dept = db.query(Department).filter(Department.code == test_code).first()
        if test_dept:
            target_id = dept_map["CSE"]
            moved = db.query(Student).filter(Student.department_id == test_dept.id).update({"department_id": target_id})
            print(f"  Moved {moved} students from '{test_code}' -> 'CSE' (ID: {target_id})")
            db.delete(test_dept)
            db.commit()

    # 3. Print final clean department summary
    final_depts = db.query(Department.id, Department.code, Department.name, func.count(Student.id))\
        .outerjoin(Student, Student.department_id == Department.id)\
        .group_by(Department.id)\
        .order_by(Department.id)\
        .all()

    print("\n=== FINAL NORMALIZED DEPARTMENTS ===")
    for d in final_depts:
        print(f"ID: {d[0]:<3} | Code: {d[1]:<10} | Name: {d[2]:<45} | Students: {d[3]}")

    db.close()


if __name__ == "__main__":
    normalize_departments()
