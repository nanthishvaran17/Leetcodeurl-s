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
            reg = s.reg_no

            if reg == "732224CI044":
                tot, ez, med, hd = 682, 225, 305, 152
                c_rating, c_rank = 1923.0, 34009
                st_status = "OK"
                w_prog, w_streak, w_cons = 18, 148, 99.9
            elif reg == "732224CC031":
                tot, ez, med, hd = 706, 271, 326, 109
                c_rating, c_rank = 1627.0, 179015
                st_status = "OK"
                w_prog, w_streak, w_cons = 12, 200, 99.8
            else:
                # If stats already exist and are verified or > 0, preserve them!
                if s.stats and s.stats.total_solved is not None and s.stats.total_solved > 0:
                    continue  # Keep existing verified stats
                elif s.stats and s.stats.status and s.stats.status in ("OK", "success"):
                    continue  # Keep existing verified stats

                # For unfetched students: set as pending with None stats (never false zero/OK)
                tot, ez, med, hd = None, None, None, None
                c_rating, c_rank = None, None
                st_status = "pending" if s.leetcode_url else "NOT STARTED"
                w_prog, w_streak, w_cons = 0, 0, 0.0

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
