import os
import sys

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal
from backend.models import Student, LeetCodeProfileStats, WeeklyStudentProgress

def update_nanthish():
    db = SessionLocal()
    try:
        stud = db.query(Student).filter(Student.reg_no == "732224CC031").first()
        if not stud:
            print("Student NANTHISH S not found.")
            return

        print(f"Updating stats for {stud.name} ({stud.reg_no})...")
        if not stud.stats:
            stats = LeetCodeProfileStats(
                student_id=stud.id,
                total_solved=645,
                easy_solved=213,
                medium_solved=323,
                hard_solved=109,
                contest_rating=1845.5,
                contest_global_ranking=14200,
                status="OK"
            )
            db.add(stats)
        else:
            stud.stats.total_solved = 645
            stud.stats.easy_solved = 213
            stud.stats.medium_solved = 323
            stud.stats.hard_solved = 109
            stud.stats.contest_rating = 1845.5
            stud.stats.contest_global_ranking = 14200
            stud.stats.status = "OK"

        prog = db.query(WeeklyStudentProgress).filter(WeeklyStudentProgress.student_id == stud.id).first()
        if not prog:
            prog = WeeklyStudentProgress(
                student_id=stud.id,
                weekly_progress=12,
                streak_count=200,
                consistency_score=99.8,
                college_rank=1,
                dept_rank=1,
                year_rank=1,
                section_rank=1
            )
            db.add(prog)
        else:
            prog.streak_count = 200
            prog.weekly_progress = 12
            prog.college_rank = 1
            prog.dept_rank = 1

        db.commit()
        print("SUCCESSFULLY UPDATED NANTHISH S STATS & 200-DAY STREAK IN DATABASE!")
    finally:
        db.close()

if __name__ == "__main__":
    update_nanthish()
