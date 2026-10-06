import os
import sys
import glob

# Ensure backend can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal
from backend.models import Student, Department, ReportCache
from collections import Counter

def main():
    db = SessionLocal()
    print("=" * 60)
    print("NANDHA LEETCODE TRACKER - ROSTER & DEPARTMENT RECONCILIATION")
    print("=" * 60)

    # 1. Fetch departments
    iot_dept = db.query(Department).filter((Department.code == 'CSE(IOT)') | (Department.name.ilike('%IoT%'))).first()
    csec_dept = db.query(Department).filter((Department.code == 'CSE(CS)') | (Department.name.ilike('%Cyber%'))).first()

    if not iot_dept or not csec_dept:
        print("[ERROR] Could not find CSE(IOT) or CSE(CS) departments.")
        return

    print(f"CSE(CS)  Dept ID: {csec_dept.id} ({csec_dept.name})")
    print(f"CSE(IOT) Dept ID: {iot_dept.id} ({iot_dept.name})")

    # 2. Iterate all students and assign correct department + year_level
    students = db.query(Student).all()
    moved_to_iot = 0
    moved_to_csec = 0

    for s in students:
        reg = (s.reg_no or '').upper().strip()

        # IoT students (CI / CIR / CIL)
        if 'CI' in reg:
            if s.department_id != iot_dept.id:
                s.department_id = iot_dept.id
                moved_to_iot += 1
            if '24CI' in reg or '732224CI' in reg:
                s.year_level = 'III Year'
            elif '25CI' in reg or '732225CI' in reg:
                s.year_level = 'II Year'
            elif '23CI' in reg or '732223CI' in reg:
                s.year_level = 'IV Year'

        # Cyber Security students (CC / CCL)
        elif 'CC' in reg:
            if s.department_id != csec_dept.id:
                s.department_id = csec_dept.id
                moved_to_csec += 1
            if '24CC' in reg or '732224CC' in reg:
                s.year_level = 'III Year'
            elif '25CC' in reg or '732225CC' in reg:
                s.year_level = 'II Year'
            elif '23CC' in reg or '732223CC' in reg:
                s.year_level = 'IV Year'

    db.commit()
    print(f"\n[OK] Moved {moved_to_iot} students to CSE(IOT).")
    if moved_to_csec > 0:
        print(f"[OK] Moved {moved_to_csec} students to CSE(CS).")

    # 3. Verify Final Counts
    csec_students = db.query(Student).filter(Student.department_id == csec_dept.id, Student.is_active == True).all()
    iot_students = db.query(Student).filter(Student.department_id == iot_dept.id, Student.is_active == True).all()

    print("\n" + "=" * 60)
    print("FINAL RECONCILED DATABASE COUNTS:")
    print("=" * 60)
    print("Cyber Security (CSE-CS) Breakdown:", dict(Counter(s.year_level for s in csec_students)))
    print("  -> III Year Cyber Security Total :", len([s for s in csec_students if s.year_level == 'III Year']))
    
    print("\nInternet of Things (CSE-IOT) Breakdown:", dict(Counter(s.year_level for s in iot_students)))
    print("  -> III Year IoT Total            :", len([s for s in iot_students if s.year_level == 'III Year']))

    # 4. Wipe cached reports
    del_cache = db.query(ReportCache).delete()
    db.commit()
    print(f"\n[OK] Cleared {del_cache} cached reports from DB.")

    storage_reports = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "backend", "storage", "reports", "*")
    for f in glob.glob(storage_reports):
        try:
            os.remove(f)
        except Exception:
            pass
    print("[OK] Cleared disk report cache.")
    print("=" * 60)
    print("RECONCILIATION COMPLETED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    main()
