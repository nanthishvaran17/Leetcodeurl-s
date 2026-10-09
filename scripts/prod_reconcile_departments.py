import os
import sys
import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal
from backend.models import Student, Department, ReportCache

# Standard Department Definitions
DEPARTMENTS_CONFIG = [
    ("CSE(CS)", "Computer Science and Engineering (Cyber Security)"),
    ("CSE(IOT)", "Computer Science and Engineering (IoT)"),
    ("IT", "Information Technology"),
    ("CSE", "Computer Science and Engineering"),
    ("AIDS", "Artificial Intelligence and Data Science"),
    ("ECE", "Electronics and Communication Engineering"),
    ("EEE", "Electrical and Electronics Engineering"),
    ("AGRI", "Agricultural Engineering"),
    ("MECH", "Mechanical Engineering"),
    ("CIVIL", "Civil Engineering"),
]

def resolve_department_code_from_reg_no(reg_no: str) -> str:
    reg = (reg_no or "").strip().upper()
    if not reg:
        return "CSE"

    if "CC" in reg or "CYBER" in reg:
        return "CSE(CS)"
    elif "CI" in reg or "IOT" in reg:
        return "CSE(IOT)"
    elif "IT" in reg:
        return "IT"
    elif "AIDS" in reg or "AI" in reg or "AD" in reg:
        return "AIDS"
    elif "ECE" in reg or "EC" in reg:
        return "ECE"
    elif "EEE" in reg or "EE" in reg:
        return "EEE"
    elif "AGRI" in reg or "AG" in reg:
        return "AGRI"
    elif "MECH" in reg or "ME" in reg:
        return "MECH"
    elif "CIVIL" in reg or "CE" in reg:
        return "CIVIL"
    elif "CSE" in reg or "CS" in reg:
        return "CSE"

    return "CSE"

def run():
    db = SessionLocal()
    now = datetime.datetime.now(datetime.timezone.utc)
    print("=" * 75)
    print("AUTHORITATIVE PRODUCTION DEPARTMENT RECONCILIATION ENGINE")
    print("=" * 75)

    # 1. Ensure all standard departments exist in DB with valid created_at
    dept_map = {}
    for code, name in DEPARTMENTS_CONFIG:
        dept = db.query(Department).filter(
            (Department.code == code) | (Department.name.ilike(name))
        ).first()
        
        if not dept:
            dept = Department(code=code, name=name, created_at=now)
            db.add(dept)
            db.flush()
            print(f"[DEPT CREATED] Created missing department: {code} - '{name}' (ID {dept.id})")
        else:
            if dept.code != code:
                dept.code = code
            if dept.created_at is None:
                dept.created_at = now
            db.flush()

        dept_map[code] = dept

    db.commit()

    # 2. Iterate all students and update department_id matching register number
    students = db.query(Student).all()
    print(f"\nAuditing {len(students)} student records against register number rules...")

    updated_count = 0
    dept_stats = {}

    for s in students:
        reg = s.reg_no or ""
        expected_code = resolve_department_code_from_reg_no(reg)
        target_dept = dept_map.get(expected_code)

        if target_dept and s.department_id != target_dept.id:
            old_code = s.department.code if s.department else "NONE"
            s.department_id = target_dept.id
            updated_count += 1
            print(f"  [REASSIGNED] {s.name} ({s.reg_no}): {old_code} -> {target_dept.code}")

        curr_code = target_dept.code if target_dept else "CSE"
        dept_stats[curr_code] = dept_stats.get(curr_code, 0) + 1

    db.commit()

    print("\n" + "=" * 75)
    print(f"[SUCCESS] Reassigned {updated_count} student records to their correct departments!")
    print("Updated Department Distribution in DB:")
    for code, count in sorted(dept_stats.items()):
        print(f"  - {code:<12}: {count} students")

    # 3. Invalidate caches
    try:
        del_cache = db.query(ReportCache).delete()
        db.commit()
        print(f"\n[CACHE] Cleared {del_cache} cached report entries from DB.")
    except Exception as e:
        print(f"[CACHE] DB report cache note: {e}")

    try:
        from backend.cache import cache
        cache.clear()
        print("[CACHE] Cleared backend in-memory cache.")
    except Exception:
        pass

    print("=" * 75)
    db.close()

if __name__ == "__main__":
    run()
