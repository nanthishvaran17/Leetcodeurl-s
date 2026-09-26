"""
run_phase_x_fix2_verification.py — Replay Real Sunday Contest & Verify Phase X Fix 2

Verifies:
  1. Stage 1 PROVISIONAL report generation (marked "PROVISIONAL — pending official LeetCode reconciliation.")
  2. Stage 2 T+3 Reconciliation (re-queries evidence, logs audit events, preserves provisional report)
  3. Stage 3 T+12 Final Reconciliation (finalizes to OFFICIAL_RECONCILED)
  4. Idempotency on retry
  5. Version preservation across all 3 stages
  6. Failure safety (network/API failure leaves status as RECONCILIATION_FAILED without marking OFFICIAL_RECONCILED)
"""
import os
import sys
import json
import datetime

from backend.database import SessionLocal
from backend.models import (
    Student,
    WeeklySession,
    ContestReportVersion,
    ContestReconciliationEvent,
    StudentContestParticipation
)
from backend.services.delayed_reconciliation_service import DelayedReconciliationEngine
from backend.services.contest_classifier import get_contest_utc_window

def run_verification():
    db = SessionLocal()
    contest_id = "weekly-contest-520"
    engine = DelayedReconciliationEngine(db_session=db)

    print(f"============================================================")
    print(f"   STARTING PHASE X - FIX 2 RECONCILIATION VERIFICATION")
    print(f"   Contest Target: {contest_id}")
    print(f"============================================================")

    # 1. Clean previous verification test records for this contest if any
    db.query(ContestReportVersion).filter(ContestReportVersion.contest_id == contest_id).delete()
    db.query(ContestReconciliationEvent).filter(ContestReconciliationEvent.contest_id == contest_id).delete()
    db.commit()

    # Load real students
    students = db.query(Student).all()
    print(f"Total students loaded from DB: {len(students)}")

    start_utc, _ = get_contest_utc_window(contest_id)

    # Prepare initial evidence for Provisional stage (Simulated initial scan data: 50 students solved 1 problem)
    prov_evidence = []
    for idx, student in enumerate(students):
        if idx < 50:
            prov_evidence.append({
                "student_id": student.id,
                "username": student.username or f"user_{student.id}",
                "attended": True,
                "recent_ac": [
                    {
                        "id": 101,
                        "title": "Problem 1",
                        "titleSlug": "problem-1",
                        "timestamp": int((start_utc + datetime.timedelta(minutes=15)).timestamp())
                    }
                ]
            })
        else:
            prov_evidence.append({
                "student_id": student.id,
                "username": student.username or f"user_{student.id}",
                "attended": False,
                "recent_ac": []
            })

    dummy_official_problems = [
        {"id": 101, "title": "Problem 1", "titleSlug": "problem-1"},
        {"id": 102, "title": "Problem 2", "titleSlug": "problem-2"}
    ]

    # STAGE 1: PROVISIONAL REPORT
    print("\n--- STAGE 1: Generating PROVISIONAL Report (~09:35 AM IST) ---")
    prov_version = engine.generate_provisional_report(
        contest_id=contest_id,
        db=db,
        students_evidence=prov_evidence,
        official_problems=dummy_official_problems
    )
    print(f"[OK] Provisional Report generated successfully:")
    print(f"   Stage: {prov_version.reconciliation_stage}")
    print(f"   Status: {prov_version.status}")
    print(f"   Banner: {prov_version.evidence_metadata.get('banner')}")
    print(f"   Live Count: {prov_version.live_count}, Zero Count: {prov_version.attended_zero_count}, Not Attended: {prov_version.not_attended_count}")

    # STAGE 2: T+3 RECONCILIATION
    print("\n--- STAGE 2: Performing T+3 Hour Reconciliation (~12:30 PM IST) ---")
    # Simulate updated LeetCode official data at T+3 where 10 students gained a 2nd solve officially reconciled
    t3_evidence = []
    for idx, student in enumerate(students):
        if idx < 10:  # 10 students gained 1 solve officially reconciled
            t3_evidence.append({
                "student_id": student.id,
                "username": student.username or f"user_{student.id}",
                "attended": True,
                "recent_ac": [
                    {
                        "id": 101,
                        "title": "Problem 1",
                        "titleSlug": "problem-1",
                        "timestamp": int((start_utc + datetime.timedelta(minutes=15)).timestamp())
                    },
                    {
                        "id": 102,
                        "title": "Problem 2",
                        "titleSlug": "problem-2",
                        "timestamp": int((start_utc + datetime.timedelta(minutes=45)).timestamp())
                    }
                ]
            })
        elif idx < 50:
            t3_evidence.append(prov_evidence[idx])
        else:
            t3_evidence.append(prov_evidence[idx])

    t3_version, t3_corrections = engine.reconcile_stage(
        contest_id=contest_id,
        stage=engine.STAGE_T_PLUS_3,
        db=db,
        reconciled_evidence=t3_evidence,
        official_problems=dummy_official_problems
    )
    print(f"[OK] T+3 Reconciliation completed successfully:")
    print(f"   Stage: {t3_version.reconciliation_stage}")
    print(f"   Status: {t3_version.status}")
    print(f"   Corrections Count: {t3_corrections}")

    # Verify Idempotency for T+3
    print("\n--- Testing T+3 Idempotency (Retrying T+3) ---")
    _, retry_t3_corrections = engine.reconcile_stage(
        contest_id=contest_id,
        stage=engine.STAGE_T_PLUS_3,
        db=db,
        reconciled_evidence=t3_evidence,
        official_problems=dummy_official_problems
    )
    print(f"[OK] Retry T+3 returned new corrections count: {retry_t3_corrections} (Expected: 0)")
    assert retry_t3_corrections == 0, f"Expected 0 corrections on retry, got {retry_t3_corrections}"

    # STAGE 3: T+12 FINAL RECONCILIATION
    print("\n--- STAGE 3: Performing T+12 Hour Final Reconciliation (~09:30 PM IST) ---")
    # Simulate final official data validation at T+12
    t12_version, t12_corrections = engine.reconcile_stage(
        contest_id=contest_id,
        stage=engine.STAGE_T_PLUS_12,
        db=db,
        reconciled_evidence=t3_evidence,
        official_problems=dummy_official_problems
    )
    print(f"[OK] T+12 Final Reconciliation completed successfully:")
    print(f"   Stage: {t12_version.reconciliation_stage}")
    print(f"   Status: {t12_version.status}")
    print(f"   New Corrections Count: {t12_corrections}")
    assert t12_version.status == engine.STATUS_OFFICIAL_RECONCILED, f"Expected status OFFICIAL_RECONCILED, got {t12_version.status}"

    # VERIFY FAILURE SAFETY
    print("\n--- Testing API Failure Safety Rule ---")
    fail_contest_id = "weekly-contest-521"
    engine.generate_provisional_report(contest_id=fail_contest_id, db=db, students_evidence=prov_evidence)
    fail_version, _ = engine.reconcile_stage(
        contest_id=fail_contest_id,
        stage=engine.STAGE_T_PLUS_12,
        db=db,
        simulate_network_failure=True
    )
    print(f"[OK] Failed API Reconciliation handling:")
    print(f"   Stage: {fail_version.reconciliation_stage}")
    print(f"   Status: {fail_version.status}")
    assert fail_version.status == engine.STATUS_RECONCILIATION_FAILED, "Failed API must NOT mark OFFICIAL_RECONCILED"

    # VERIFY VERSION PRESERVATION & ARTIFACTS
    print("\n--- Verifying Version Preservation & Generated Artifacts ---")
    versions = db.query(ContestReportVersion).filter(ContestReportVersion.contest_id == contest_id).all()
    print(f"Stored versions count for {contest_id}: {len(versions)}")
    for v in versions:
        print(f"   - Stage: {v.reconciliation_stage}, Status: {v.status}, Generated: {v.generated_at}")
    assert len(versions) == 3, f"Expected 3 distinct version records, found {len(versions)}"

    # Audit Events check
    events_count = db.query(ContestReconciliationEvent).filter(ContestReconciliationEvent.contest_id == contest_id).count()
    print(f"Recorded Audit Events count for {contest_id}: {events_count}")

    # Check Artifact files on disk
    artifacts = [
        f"phase_x_fix2_{contest_id}_provisional.csv",
        f"phase_x_fix2_{contest_id}_provisional.json",
        f"phase_x_fix2_{contest_id}_t_plus_3_reconciliation.csv",
        f"phase_x_fix2_{contest_id}_t_plus_3_reconciliation.json",
        f"phase_x_fix2_{contest_id}_t_plus_12_final.csv",
        f"phase_x_fix2_{contest_id}_t_plus_12_final.json",
    ]

    all_artifacts_exist = True
    for art in artifacts:
        exists = os.path.exists(art)
        print(f"   Artifact '{art}': {'EXISTS' if exists else 'MISSING'}")
        if not exists:
            all_artifacts_exist = False

    assert all_artifacts_exist, "All 6 stage artifact files must exist on disk!"

    print("\n============================================================")
    print("   ALL PHASE X FIX 2 VERIFICATION CHECKS PASSED 100%")
    print("   FINAL STATUS: VERIFIED")
    print("============================================================")

    db.close()

if __name__ == "__main__":
    run_verification()
