"""
fix_nanthish_wc522.py
=============================================================
Explicitly reconciles Nanthish S (732224CC031) WC 522 record
to 2/4 Solved, 9 Points (Q1: Accepted, Q2: Not Solved, Q3: Not Solved, Q4: Accepted).
"""

from backend.database import SessionLocal
from backend.models import Student, WeeklyPublicResult, PreviousWeekParticipationRecord, WeeklySession

def fix_nanthish_522():
    db = SessionLocal()
    try:
        s = db.query(Student).filter_by(reg_no='732224CC031').first()
        if not s:
            print("Student Nanthish S (732224CC031) not found!")
            return

        wc522_sessions = db.query(WeeklySession).filter(
            (WeeklySession.contest_id.ilike("%522%")) | (WeeklySession.contest_name.ilike("%522%"))
        ).all()

        session_ids = [sess.id for sess in wc522_sessions]
        print(f"Found WC 522 session IDs: {session_ids}")

        # 1. Update PreviousWeekParticipationRecord
        prev_recs = db.query(PreviousWeekParticipationRecord).filter(
            PreviousWeekParticipationRecord.student_id == s.id,
            PreviousWeekParticipationRecord.session_id.in_(session_ids)
        ).all()

        for pr in prev_recs:
            pr.problems_solved = 2
            pr.official_score = 9
            pr.q1 = 1
            pr.q2 = 0
            pr.q3 = 0
            pr.q4 = 1
            pr.participation_type = "PUBLIC"
            print(f"Updated PreviousWeekParticipationRecord #{pr.id} for WC 522 to 2/4 (9 pts).")

        # 2. Update WeeklyPublicResult
        pub_recs = db.query(WeeklyPublicResult).filter(
            WeeklyPublicResult.student_id == s.id,
            WeeklyPublicResult.session_id.in_(session_ids)
        ).all()

        for pub in pub_recs:
            pub.total_contest_solved = 2
            pub.contest_score = 9
            pub.q1 = 1
            pub.q2 = 0
            pub.q3 = 0
            pub.q4 = 1
            pub.participation_status = "PUBLIC_ATTENDED"
            pub.state = "FINALIZED"
            pub.confidence = "VERIFIED"
            print(f"Updated WeeklyPublicResult #{pub.id} for WC 522 to 2/4 (9 pts).")

        db.commit()
        print("[SUCCESS] Nanthish S WC 522 record permanently fixed in DB to 2/4 Solved (9 Points, Q1 & Q4)!")
    except Exception as ex:
        print(f"Error fixing Nanthish record: {ex}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_nanthish_522()
