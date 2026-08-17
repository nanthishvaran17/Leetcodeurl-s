"""
verify_all_forensic_steps.py — Automated verification script for Steps 1 through 13.
Queries the SQLite database directly and checks every mandatory forensic requirement.
"""

import sys
import json
import hashlib
from sqlalchemy import func

sys.path.insert(0, r"e:\Leetcode Web")

from backend.database import SessionLocal
from backend.models import (
    Student,
    ForensicAuditJob,
    ForensicStudentIngestStatus,
    ForensicAuditRecord,
    LeetCodeContestRatingHistory,
)
from backend.services.forensic_audit_service import get_canonical_100_contests


def verify_all_steps():
    db = SessionLocal()
    try:
        # Step 3: Verify 300 Students
        students = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None))).all()
        student_count = len(students)
        print(f"STEP 3 — Students configured: 300 | Processed: {student_count}")

        # Step 4: Verify 100 Canonical Contests
        canonical_contests = get_canonical_100_contests()
        c_count = len(canonical_contests)
        first_c = canonical_contests[0]["contest_name"]
        last_c = canonical_contests[-1]["contest_name"]
        print(f"STEP 4 — Canonical contests: {c_count} | First: {first_c} | Last: {last_c}")

        # Step 5: Verify 30,000 Matrix Cells from DB
        latest_job = db.query(ForensicAuditJob).order_by(ForensicAuditJob.id.desc()).first()
        if not latest_job:
            print("ERROR: No ForensicAuditJob found")
            return

        job_id = latest_job.job_id
        db_cell_count = db.query(ForensicAuditRecord).filter(ForensicAuditRecord.job_id == job_id).count()
        print(f"STEP 5 — Matrix expected: 30,000 | Database actual count: {db_cell_count}")

        # Step 6: Status Reconciliation
        v_attended = db.query(ForensicAuditRecord).filter(ForensicAuditRecord.job_id == job_id, ForensicAuditRecord.verification_status == "VERIFIED_ATTENDED").count()
        v_absent   = db.query(ForensicAuditRecord).filter(ForensicAuditRecord.job_id == job_id, ForensicAuditRecord.verification_status == "VERIFIED_ABSENT").count()
        not_found  = db.query(ForensicAuditRecord).filter(ForensicAuditRecord.job_id == job_id, ForensicAuditRecord.verification_status == "NOT_FOUND").count()
        src_unavail= db.query(ForensicAuditRecord).filter(ForensicAuditRecord.job_id == job_id, ForensicAuditRecord.verification_status == "SOURCE_UNAVAILABLE").count()
        pend_user  = db.query(ForensicAuditRecord).filter(ForensicAuditRecord.job_id == job_id, ForensicAuditRecord.verification_status == "PENDING_USERNAME").count()
        data_pend  = db.query(ForensicAuditRecord).filter(ForensicAuditRecord.job_id == job_id, ForensicAuditRecord.verification_status == "DATA_PENDING").count()

        status_sum = v_attended + v_absent + not_found + src_unavail + pend_user + data_pend
        print(f"STEP 6 — Status Sum: {status_sum} (Attended: {v_attended}, Absent: {v_absent}, NotFound: {not_found}, Unavail: {src_unavail}, PendingUser: {pend_user}, DataPending: {data_pend})")

        # Step 7: Q1-Q4 NULL Invariant
        inferred_q_count = db.query(ForensicAuditRecord).filter(
            ForensicAuditRecord.job_id == job_id,
            (ForensicAuditRecord.q1_solved.isnot(None)) |
            (ForensicAuditRecord.q2_solved.isnot(None)) |
            (ForensicAuditRecord.q3_solved.isnot(None)) |
            (ForensicAuditRecord.q4_solved.isnot(None))
        ).count()
        print(f"STEP 7 — Q1-Q4 inferred records: {inferred_q_count}")

        # Step 8: Rank / Rating Source Check
        rank_mismatches = 0
        rating_mismatches = 0
        attended_records = db.query(ForensicAuditRecord).filter(
            ForensicAuditRecord.job_id == job_id,
            ForensicAuditRecord.verification_status == "VERIFIED_ATTENDED"
        ).all()

        for rec in attended_records:
            hist = db.query(LeetCodeContestRatingHistory).filter(
                LeetCodeContestRatingHistory.student_id == rec.student_id,
                LeetCodeContestRatingHistory.contest_name == rec.contest_name
            ).first()
            if not hist:
                rank_mismatches += 1
            else:
                if rec.contest_rank != hist.contest_rank:
                    rank_mismatches += 1
                if rec.contest_rating != hist.rating_after:
                    rating_mismatches += 1

        print(f"STEP 8 — Rank mismatches: {rank_mismatches} | Rating mismatches: {rating_mismatches}")

        # Step 9: Absence Forensic Check
        absent_records = db.query(ForensicAuditRecord).filter(
            ForensicAuditRecord.job_id == job_id,
            ForensicAuditRecord.verification_status == "VERIFIED_ABSENT"
        ).all()

        false_absences = 0
        for rec in absent_records:
            ingest_st = db.query(ForensicStudentIngestStatus).filter(
                ForensicStudentIngestStatus.job_id == job_id,
                ForensicStudentIngestStatus.student_id == rec.student_id
            ).first()
            if not ingest_st or ingest_st.ingest_status != "SUCCESS":
                false_absences += 1

        print(f"STEP 9 — False absence records (VERIFIED_ABSENT without SUCCESS ingest): {false_absences}")

        # Step 10: Duplicate Check
        dups = db.query(
            ForensicAuditRecord.student_id, ForensicAuditRecord.contest_id, func.count(ForensicAuditRecord.id)
        ).filter(
            ForensicAuditRecord.job_id == job_id
        ).group_by(
            ForensicAuditRecord.student_id, ForensicAuditRecord.contest_id
        ).having(func.count(ForensicAuditRecord.id) > 1).all()
        print(f"STEP 10 — Duplicate records in matrix: {len(dups)}")

        # Step 11: Source Evidence Check
        verified_recs = db.query(ForensicAuditRecord).filter(
            ForensicAuditRecord.job_id == job_id,
            ForensicAuditRecord.verification_status.in_(["VERIFIED_ATTENDED", "VERIFIED_ABSENT"])
        ).all()

        missing_ev = 0
        for rec in verified_recs:
            if not rec.source_evidence or not rec.evidence_hash:
                missing_ev += 1

        print(f"STEP 11 — Verified records without evidence hash: {missing_ev}")

        # Step 12: DHARUNRAJ Regression Check
        dharunraj = db.query(Student).filter(
            (Student.name.ilike("%DHARUNRAJ%")) | (Student.username.ilike("%DHARUNRAJ%"))
        ).first()

        if dharunraj:
            d_rec = db.query(ForensicAuditRecord).filter(
                ForensicAuditRecord.job_id == job_id,
                ForensicAuditRecord.student_id == dharunraj.id,
                ForensicAuditRecord.contest_id == "weekly-contest-515"
            ).first()
            print(f"STEP 12 — DHARUNRAJ Record: Student {dharunraj.name} ({dharunraj.username}), Status: {d_rec.verification_status if d_rec else 'None'}, Solved: {d_rec.problems_solved if d_rec else 'None'}")
        else:
            print("STEP 12 — DHARUNRAJ student check: Student not in DB roster (skipped)")

        # Step 13: Summary Report Verification
        print()
        print("============================================================")
        print("COMPLETE INSTITUTIONAL FORENSIC AUDIT SUMMARY")
        print("============================================================")
        print(f"Job ID: {job_id}")
        print(f"Matrix Cells: {db_cell_count} / 30,000")
        print(f"Status Reconciliation Sum: {status_sum}")
        print(f"Q1-Q4 Inferred: {inferred_q_count}")
        print(f"Rank/Rating Mismatches: {rank_mismatches + rating_mismatches}")
        print(f"False Absences: {false_absences}")
        print(f"Duplicates: {len(dups)}")
        print(f"Missing Evidence: {missing_ev}")
        print(f"Final Status: {'PASS' if (db_cell_count == 30000 and status_sum == 30000 and inferred_q_count == 0 and rank_mismatches == 0 and false_absences == 0 and len(dups) == 0 and missing_ev == 0) else 'FAIL'}")
        print("============================================================")

    finally:
        db.close()

if __name__ == "__main__":
    verify_all_steps()
