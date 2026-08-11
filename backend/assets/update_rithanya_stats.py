import os
import sys

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal
from backend.models import Student, LeetCodeProfileStats, WeeklyStudentProgress
from backend.ranking import update_all_rankings_and_badges

def update_rithanya():
    db = SessionLocal()
    try:
        stud = db.query(Student).filter(Student.reg_no == "732224CI044").first()
        if not stud:
            print("Student RITHANYA S (732224CI044) not found.")
            return

        print(f"Updating stats for {stud.name} ({stud.reg_no})...")
        if not stud.stats:
            stats = LeetCodeProfileStats(
                student_id=stud.id,
                total_solved=785,
                easy_solved=255,
                medium_solved=410,
                hard_solved=120,
                contest_rating=1920.5,
                contest_global_ranking=8900,
                status="OK"
            )
            db.add(stats)
        else:
            stud.stats.total_solved = 785
            stud.stats.easy_solved = 255
            stud.stats.medium_solved = 410
            stud.stats.hard_solved = 120
            stud.stats.contest_rating = 1920.5
            stud.stats.contest_global_ranking = 8900
            stud.stats.status = "OK"

        prog = db.query(WeeklyStudentProgress).filter(WeeklyStudentProgress.student_id == stud.id).first()
        if not prog:
            prog = WeeklyStudentProgress(
                student_id=stud.id,
                weekly_progress=18,
                streak_count=240,
                consistency_score=99.9,
                college_rank=1,
                dept_rank=1,
                year_rank=1,
                section_rank=1
            )
            db.add(prog)
        else:
            prog.weekly_progress = 18
            prog.streak_count = 240
            prog.consistency_score = 99.9

        db.commit()

        # Recalculate all college, dept, year, section rankings & badges
        update_all_rankings_and_badges(db)

        print("SUCCESSFULLY UPDATED RITHANYA S STATS AS TOP COLLEGE RANKER (#1) IN DATABASE!")
    finally:
        db.close()

if __name__ == "__main__":
    update_rithanya()
