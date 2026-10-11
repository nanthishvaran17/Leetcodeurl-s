import os
import sys
from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend.database import SessionLocal
from backend.models import (
    Student, WeeklyPublicResult, PreviousWeekParticipationRecord,
    WeeklyStudentProgress, LeetCodeProfileStats
)
from backend.cache import cache
from backend.services.canonical_contest_engine import invalidate_canonical_cache, build_canonical_contest_dataset

def reconcile_cs_iv_year_duplicates():
    print("=" * 80)
    print("RECONCILING CSE(CS) IV YEAR DUPLICATES (IDs 990-1017 -> IDs 744-771)")
    print("=" * 80)

    db = SessionLocal()

    try:
        # Tables to clean child records
        all_table_rows = db.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()
        candidate_tables = []
        for row in all_table_rows:
            tbl = row[0]
            if tbl.startswith("sqlite_") or tbl in ("students", "weekly_public_results", "previous_week_participation_records"):
                continue
            cols = [c[1] for c in db.execute(text(f"PRAGMA table_info({tbl})")).fetchall()]
            if "student_id" in cols:
                candidate_tables.append(tbl)

        print(f"Tables with student_id to clean: {candidate_tables}")

        for i in range(28):
            gen_id = 744 + i
            dup_id = 990 + i

            gen_s = db.query(Student).filter(Student.id == gen_id).first()
            dup_s = db.query(Student).filter(Student.id == dup_id).first()

            if not gen_s or not dup_s:
                continue

            dup_wpr = db.query(WeeklyPublicResult).filter_by(student_id=dup_id).all()
            gen_wpr = db.query(WeeklyPublicResult).filter_by(student_id=gen_id).all()

            # Active username preference
            has_dup_solves = any((r.total_contest_solved or 0) > 0 for r in dup_wpr)
            if dup_s.username and (has_dup_solves or not gen_s.username):
                print(f"Updating {gen_s.reg_no} ({gen_s.name}): username '{gen_s.username}' -> '{dup_s.username}'")
                gen_s.username = dup_s.username
                gen_s.leetcode_url = f"https://leetcode.com/u/{dup_s.username}/"

            # Merge WeeklyPublicResult
            gen_wpr_map = {r.session_id: r for r in gen_wpr}
            for dr in dup_wpr:
                gr = gen_wpr_map.get(dr.session_id)
                if not gr:
                    dr.student_id = gen_id
                    dr.reg_no = gen_s.reg_no
                    dr.name = gen_s.name
                else:
                    dr_solved = dr.total_contest_solved or 0
                    gr_solved = gr.total_contest_solved or 0
                    if dr_solved > gr_solved or (dr.participation_status == 'PUBLIC' and gr.participation_status != 'PUBLIC'):
                        gr.participation_status = dr.participation_status
                        gr.state = dr.state
                        gr.total_contest_solved = dr.total_contest_solved
                        gr.contest_score = dr.contest_score
                        gr.contest_rank = dr.contest_rank
                        gr.q1 = dr.q1
                        gr.q2 = dr.q2
                        gr.q3 = dr.q3
                        gr.q4 = dr.q4
                        gr.q1_observed_seconds = dr.q1_observed_seconds
                        gr.q2_observed_seconds = dr.q2_observed_seconds
                        gr.q3_observed_seconds = dr.q3_observed_seconds
                        gr.q4_observed_seconds = dr.q4_observed_seconds
                        gr.participant_entry_time = dr.participant_entry_time
                    db.delete(dr)

            # Merge PreviousWeekParticipationRecord
            dup_pwpr = db.query(PreviousWeekParticipationRecord).filter_by(student_id=dup_id).all()
            gen_pwpr_map = {r.session_id: r for r in db.query(PreviousWeekParticipationRecord).filter_by(student_id=gen_id).all()}
            for dp in dup_pwpr:
                gp = gen_pwpr_map.get(dp.session_id)
                if not gp:
                    dp.student_id = gen_id
                else:
                    if (dp.problems_solved or 0) > (gp.problems_solved or 0):
                        gp.participation_type = dp.participation_type
                        gp.problems_solved = dp.problems_solved
                        gp.official_score = dp.official_score
                        gp.official_rank = dp.official_rank
                        gp.q1 = dp.q1
                        gp.q2 = dp.q2
                        gp.q3 = dp.q3
                        gp.q4 = dp.q4
                    db.delete(dp)

            # Delete child records in candidate tables
            for tbl in candidate_tables:
                db.execute(text(f"DELETE FROM {tbl} WHERE student_id = :sid"), {"sid": dup_id})

            # Delete duplicate student record
            db.delete(dup_s)

        db.commit()
        print("Successfully merged and deleted duplicate CSE(CS) IV Year students.")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Deduplication failed: {e}")
        raise
    finally:
        db.close()

    # Clear caches
    print("Clearing caches...")
    try:
        cache.clear()
        invalidate_canonical_cache()
    except Exception as ce:
        print(f"Cache clear warning: {ce}")

    # Verify canonical dataset output
    db_verify = SessionLocal()
    res = build_canonical_contest_dataset(session_id=14, db=db_verify, dept='CSE(CS)', year='IV Year', attendance='ALL')
    print("VERIFICATION RESULTS FOR CSE(CS) IV Year:")
    print("Metrics:", res['metrics'])
    print("Total rows:", len(res['rows']))
    db_verify.close()

if __name__ == "__main__":
    reconcile_cs_iv_year_duplicates()
