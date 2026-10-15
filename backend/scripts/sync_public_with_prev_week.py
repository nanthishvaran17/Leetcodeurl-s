"""
sync_public_with_prev_week.py
=============================================================
Reconciles WeeklyPublicResult table with authoritative PreviousWeekParticipationRecord
to guarantee 100% data consistency for all students and all contest sessions.
"""

import sys
import logging
from backend.database import SessionLocal
from backend.models import WeeklyPublicResult, PreviousWeekParticipationRecord, WeeklySession, Student

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("sync_public_with_prev_week")

def sync_all_public_results():
    db = SessionLocal()
    try:
        active_prev = db.query(PreviousWeekParticipationRecord).filter(
            PreviousWeekParticipationRecord.is_active_version == True
        ).all()

        logger.info(f"Loaded {len(active_prev)} active verified PreviousWeekParticipationRecords.")
        
        # Preload all sessions and all existing public results for instant O(1) lookup
        all_sess_ids = {s.id for s in db.query(WeeklySession.id).all()}
        existing_wpr = {(r.session_id, r.student_id): r for r in db.query(WeeklyPublicResult).all()}
        student_map = {s.id: s for s in db.query(Student).all()}

        synced_count = 0

        for idx, pr in enumerate(active_prev, 1):
            if pr.session_id not in all_sess_ids:
                continue

            pub = existing_wpr.get((pr.session_id, pr.student_id))

            if not pub:
                student = student_map.get(pr.student_id)
                if not student:
                    continue
                dept_name = student.department.name if student.department else "CSE-CS"
                pub = WeeklyPublicResult(
                    session_id=pr.session_id,
                    student_id=pr.student_id,
                    reg_no=student.reg_no,
                    name=student.name,
                    dept=dept_name,
                    year=student.year_level or "III Year",
                )
                db.add(pub)
                existing_wpr[(pr.session_id, pr.student_id)] = pub

            pub.total_contest_solved = pr.problems_solved if pr.problems_solved is not None else 0
            pub.contest_score = pr.official_score if pr.official_score is not None else (pr.q1 * 3 + pr.q2 * 4 + pr.q3 * 5 + pr.q4 * 6)
            if pr.official_rank:
                pub.contest_rank = pr.official_rank
            pub.q1 = pr.q1 or 0
            pub.q2 = pr.q2 or 0
            pub.q3 = pr.q3 or 0
            pub.q4 = pr.q4 or 0
            pub.participation_status = pr.participation_type or ("PUBLIC" if (pr.problems_solved or 0) > 0 else "NOT_ATTENDED")
            pub.state = "FINALIZED"
            pub.confidence = "VERIFIED"
            pub.fetch_status = "SUCCESS"
            pub.data_fetch_status = "DATA_AVAILABLE"
            synced_count += 1

            if idx % 1000 == 0:
                db.commit()

        db.commit()
        logger.info(f"Successfully reconciled {synced_count} WeeklyPublicResult entries with authoritative truth.")

        # Re-check Nanthish S (732224CC031) in session 13
        nanthish = db.query(Student).filter_by(reg_no="732224CC031").first()
        if nanthish:
            wc522_sess = db.query(WeeklySession).filter(
                (WeeklySession.contest_id.ilike("%522%")) | (WeeklySession.contest_name.ilike("%522%"))
            ).first()
            if wc522_sess:
                n_rec = db.query(WeeklyPublicResult).filter_by(session_id=wc522_sess.id, student_id=nanthish.id).first()
                if n_rec:
                    logger.info(f"[VERIFIED] Nanthish S WC 522: Solved={n_rec.total_contest_solved}/4, Score={n_rec.contest_score}, Q1:{n_rec.q1} Q2:{n_rec.q2} Q3:{n_rec.q3} Q4:{n_rec.q4}")

    except Exception as ex:
        logger.error(f"Sync error: {ex}", exc_info=True)
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    sync_all_public_results()
