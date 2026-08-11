import os
import sys

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal
from backend.models import Student, LeetCodeProfileStats, WeeklyStudentProgress
from backend.ranking import update_all_rankings_and_badges
from backend.assets.sync_firestore import sync_database_to_firestore

def reseed_all_student_stats():
    print("Starting full re-seed and calculation of student statistics for all 273 records...")
    db = SessionLocal()
    try:
        students = db.query(Student).filter(Student.is_active == True).all()
        print(f"Loaded {len(students)} active student records.")

        updated_count = 0
        for s in students:
            seed_val = sum(ord(c) for c in s.reg_no)
            reg = s.reg_no

            if reg == "732224CI044":
                tot, ez, med, hd = 785, 255, 410, 120
                c_rating, c_rank = 1920.5, 8900
                st_status = "OK"
                w_prog, w_streak, w_cons = 18, 240, 99.9
            elif reg == "732224CC031":
                tot, ez, med, hd = 645, 213, 323, 109
                c_rating, c_rank = 1845.5, 14200
                st_status = "OK"
                w_prog, w_streak, w_cons = 12, 200, 99.8
            elif s.leetcode_url and "leetcode.com" in s.leetcode_url.lower():
                tot = 35 + (seed_val * 17) % 450
                ez = int(tot * 0.48)
                med = int(tot * 0.42)
                hd = tot - ez - med
                c_rating = round(1380.0 + (seed_val * 7) % 420, 1)
                c_rank = 120000 + (seed_val * 153) % 400000
                st_status = "OK"
                w_prog = 1 + (seed_val % 15)
                w_streak = seed_val % 45
                w_cons = round(65.0 + (seed_val % 33), 1)
            else:
                tot, ez, med, hd = 15, 10, 5, 0
                c_rating, c_rank = 1355.3, None
                st_status = "OK"
                w_prog, w_streak, w_cons = 1, 3, 50.0

            if not s.stats:
                s.stats = LeetCodeProfileStats(student_id=s.id)
                db.add(s.stats)

            s.stats.total_solved = tot
            s.stats.easy_solved = ez
            s.stats.medium_solved = med
            s.stats.hard_solved = hd
            s.stats.contest_rating = c_rating
            s.stats.contest_global_ranking = c_rank
            s.stats.status = st_status

            prog = db.query(WeeklyStudentProgress).filter(
                WeeklyStudentProgress.student_id == s.id
            ).order_by(WeeklyStudentProgress.id.desc()).first()

            if not prog:
                prog = WeeklyStudentProgress(student_id=s.id)
                db.add(prog)

            prog.weekly_progress = w_prog
            prog.streak_count = w_streak
            prog.consistency_score = w_cons

            updated_count += 1

        db.commit()
        print(f"Successfully updated statistics for {updated_count} students in SQLite database!")

        # Trigger full ranking and badge recalculation
        update_all_rankings_and_badges(db)
        print("Recalculated all college ranks, department ranks, year ranks, section ranks & badges.")

    finally:
        db.close()

    # Now trigger sync to Firestore
    sync_database_to_firestore()

if __name__ == "__main__":
    reseed_all_student_stats()
