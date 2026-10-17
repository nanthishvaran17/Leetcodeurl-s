from backend.database import SessionLocal
from backend.models import Student, Department, WeeklyPublicResult, WeeklySession
from backend.cache import cache

def fix_all_departments():
    db = SessionLocal()
    try:
        # 1. Fetch departments
        dept_cs = db.query(Department).filter_by(code='CSE(CS)').first()
        dept_cse = db.query(Department).filter_by(code='CSE').first()
        dept_iot = db.query(Department).filter_by(code='CSE(IOT)').first()

        # 2. Move the 68 students from 'CSE' to 'CSE(CS)' as II Year
        if dept_cse and dept_cs:
            cse_students = db.query(Student).filter(Student.department_id == dept_cse.id).all()
            print(f"Moving {len(cse_students)} students from 'CSE' to 'CSE(CS)' (II Year)...")
            for s in cse_students:
                s.department_id = dept_cs.id
                s.year_level = 'II Year'
            db.commit()

            # Clean up empty CSE department if no students left
            rem = db.query(Student).filter(Student.department_id == dept_cse.id).count()
            if rem == 0:
                print("Removing unused 'CSE' department entry...")
                db.delete(dept_cse)
                db.commit()

        # 3. Fix the 1 student in CSE(IOT) having year_level='3' -> 'III Year'
        if dept_iot:
            iot_odd = db.query(Student).filter(Student.department_id == dept_iot.id, Student.year_level == '3').all()
            for s in iot_odd:
                s.year_level = 'III Year'
            db.commit()

        # 4. Sync WeeklyPublicResult for any active session (e.g. 523)
        ws = db.query(WeeklySession).filter(WeeklySession.contest_name.ilike('%523%')).first()
        if ws:
            all_students = db.query(Student).all()
            for s in all_students:
                wpr = db.query(WeeklyPublicResult).filter(
                    WeeklyPublicResult.session_id == ws.id,
                    WeeklyPublicResult.student_id == s.id
                ).first()
                if wpr:
                    wpr.year = s.year_level
            db.commit()

        try:
            cache.clear()
        except Exception:
            pass

        print("\n" + "="*50)
        print("UPDATED DEPARTMENT & YEAR COUNTS:")
        print("="*50)
        from sqlalchemy import func
        results = db.query(Department.code, Student.year_level, func.count(Student.id))\
            .join(Department, Student.department_id == Department.id)\
            .group_by(Department.code, Student.year_level)\
            .order_by(Department.code, Student.year_level)\
            .all()

        dept_totals = {}
        for dept, yr, cnt in results:
            yr_str = yr or 'Not Assigned'
            print(f"{dept:<12} | {yr_str:<12} | {cnt:<10}")
            dept_totals[dept] = dept_totals.get(dept, 0) + cnt

        print("-"*50)
        for dept, tot in sorted(dept_totals.items()):
            print(f"{dept:<12} : {tot} Students")
        print("="*50 + "\n")

    finally:
        db.close()

if __name__ == '__main__':
    fix_all_departments()
