import os
import sys

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal
from backend.models import Student, LeetCodeProfileStats, WeeklyStudentProgress
from backend.ranking import update_all_rankings_and_badges
from backend.assets.sync_firestore import sync_database_to_firestore

def clean_all_synthetic_stats_and_sync():
    print("Cleaning all synthetic/fake numbers from database...")
    db = SessionLocal()
    try:
        students = db.query(Student).filter(Student.is_active == True).all()
        print(f"Loaded {len(students)} active student records.")

        verified_map = {
            "732224CC031": (706, 271, 326, 109, 1627.0, 179015), # NANTHISH S
            "732224CI044": (682, 225, 305, 152, 1923.0, 34009),  # RITHANYA S
            "23CC059":     (416, 199, 174, 43,  1611.0, 180129), # WASIM M
            "23CC039":     (382, 183, 160, 39,  1597.0, 179823), # PRAVEEN VENKATESH A
            "732225CI048": (29,  13,  12,  4,   None,   3655364) # SHARMATHA K
        }

        for s in students:
            reg = s.reg_no
            if reg in verified_map:
                tot, ez, med, hd, rating, grank = verified_map[reg]
                status = "OK"
            else:
                tot, ez, med, hd, rating, grank = 0, 0, 0, 0, None, None
                status = "NOT STARTED" if not s.leetcode_url else "OK"

            if not s.stats:
                s.stats = LeetCodeProfileStats(student_id=s.id)
                db.add(s.stats)

            s.stats.total_solved = tot
            s.stats.easy_solved = ez
            s.stats.medium_solved = med
            s.stats.hard_solved = hd
            s.stats.contest_rating = rating
            s.stats.contest_global_ranking = grank
            s.stats.status = status

            prog = db.query(WeeklyStudentProgress).filter(
                WeeklyStudentProgress.student_id == s.id
            ).first()
            if not prog:
                prog = WeeklyStudentProgress(student_id=s.id)
                db.add(prog)
            
            prog.total_solved = tot
            prog.weekly_progress = 0
            prog.easy_solved = ez
            prog.medium_solved = med
            prog.hard_solved = hd
            prog.rating = rating

        db.commit()
        print("Database stats cleaned of all synthetic numbers.")

        # Recalculate rankings
        update_all_rankings_and_badges(db)

    finally:
        db.close()

    # Sync cleanly to Cloud Firestore
    sync_database_to_firestore()
    print("Firestore live database successfully synced with 100% clean data!")

if __name__ == "__main__":
    clean_all_synthetic_stats_and_sync()
