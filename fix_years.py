import re
from backend.database import SessionLocal
from backend.models import Student, Department, WeeklyPublicResult, WeeklySession
from backend.cache import cache

def fix_cyber_years():
    db = SessionLocal()
    try:
        d = db.query(Department).filter_by(code='CSE(CS)').first()
        if not d:
            print("Department CSE(CS) not found")
            return

        ss = db.query(Student).filter(Student.department_id == d.id).all()

        for s in ss:
            # 28 IV Year and 63 III Year are already locked.
            # Remaining CSE(CS) students belong to II Year.
            if s.year_level not in ('III Year', 'IV Year'):
                s.year_level = 'II Year'

        ws = db.query(WeeklySession).filter(WeeklySession.contest_name.ilike('%523%')).first()
        if ws:
            for s in ss:
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

        c2 = db.query(Student).filter(Student.department_id == d.id, Student.year_level == 'II Year').count()
        c3 = db.query(Student).filter(Student.department_id == d.id, Student.year_level == 'III Year').count()
        c4 = db.query(Student).filter(Student.department_id == d.id, Student.year_level == 'IV Year').count()
        tot = c2 + c3 + c4

        print(f"Final CSE(CS) Counts: II Year = {c2}, III Year = {c3}, IV Year = {c4} | Total = {tot}")
    finally:
        db.close()

if __name__ == '__main__':
    fix_cyber_years()
