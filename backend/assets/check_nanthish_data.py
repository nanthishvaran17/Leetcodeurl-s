import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal
from backend.models import Student, WeeklyStudentProgress

def check_nanthish():
    db = SessionLocal()
    try:
        s = db.query(Student).filter(Student.reg_no == '732224CC031').first()
        if not s:
            print("Student 732224CC031 not found in SQLite database!")
            return
        
        print(f"--- Student Record ---")
        print(f"ID: {s.id}")
        print(f"Name: {s.name}")
        print(f"Reg No: {s.reg_no}")
        print(f"Email: {s.email}")
        print(f"Dept: {s.department.code if s.department else 'N/A'}")
        print(f"Year: {s.year_level}")
        print(f"Section: {s.section.name if s.section else 'N/A'}")

        if s.stats:
            print(f"--- LeetCode Stats ---")
            print(f"Total Solved: {s.stats.total_solved}")
            print(f"Easy Solved: {s.stats.easy_solved}")
            print(f"Medium Solved: {s.stats.medium_solved}")
            print(f"Hard Solved: {s.stats.hard_solved}")
            print(f"Sum (Easy+Med+Hard): {s.stats.easy_solved + s.stats.medium_solved + s.stats.hard_solved}")
            print(f"Contest Rating: {s.stats.contest_rating}")
            print(f"Global Ranking: {s.stats.contest_global_ranking}")
        else:
            print("No stats record found!")

        prog = db.query(WeeklyStudentProgress).filter(
            WeeklyStudentProgress.student_id == s.id
        ).order_by(WeeklyStudentProgress.id.desc()).first()

        if prog:
            print(f"--- Weekly Progress ---")
            print(f"Weekly Progress: {prog.weekly_progress}")
            print(f"Streak Count: {prog.streak_count}")
            print(f"Consistency Score: {prog.consistency_score}")
            print(f"College Rank: {prog.college_rank}")
        else:
            print("No progress record found!")

    finally:
        db.close()

if __name__ == "__main__":
    check_nanthish()
