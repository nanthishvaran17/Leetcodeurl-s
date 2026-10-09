"""
Unit tests for Phase X — Fix 2: Delayed Official LeetCode Reconciliation.
Verifies Provisional report generation, T+3 reconciliation, T+12 final reconciliation,
version preservation, audit logging, idempotency, and failure safety rules.
"""
import pytest
import datetime
from sqlalchemy.orm import Session

from backend.database import SessionLocal, engine, Base
from backend.models import (
    Student,
    WeeklySession,
    StudentContestParticipation,
    ContestParticipation,
    ContestReconciliationEvent,
    ContestReportVersion
)
from backend.services.delayed_reconciliation_service import (
    DelayedReconciliationEngine
)
from backend.services.contest_classifier import (
    get_contest_utc_window,
    ContestStatus
)

CONTEST_ID = "weekly-contest-520"
CONTEST_NAME = "Weekly Contest 520"
START_UTC, END_UTC = get_contest_utc_window(CONTEST_ID)
START_UNIX = int(START_UTC.timestamp())
END_UNIX = int(END_UTC.timestamp())

OFFICIAL_PROBLEMS = [
    {"question_order": 1, "title": "Problem A", "titleSlug": "problem-a", "problem_id": 101},
    {"question_order": 2, "title": "Problem B", "titleSlug": "problem-b", "problem_id": 102},
    {"question_order": 3, "title": "Problem C", "titleSlug": "problem-c", "problem_id": 103},
    {"question_order": 4, "title": "Problem D", "titleSlug": "problem-d", "problem_id": 104},
]


@pytest.fixture(scope="module")
def db_context():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    student = session.query(Student).filter(Student.is_active == True, Student.username != None).first()
    if not student:
        student = session.query(Student).first()
    yield session, student
    session.query(ContestReportVersion).filter_by(contest_id=CONTEST_ID).delete()
    session.query(ContestReconciliationEvent).filter_by(contest_id=CONTEST_ID).delete()
    session.commit()
    session.close()


def test_01_provisional_report_generation(db_context):
    """Test 1: Provisional Report generated at T+0 marked PROVISIONAL — pending official LeetCode reconciliation."""
    db, student = db_context
    engine_inst = DelayedReconciliationEngine()

    ev_data = [{
        "student_id": student.id,
        "username": student.username or "testuser",
        "attended": True,
        "recent_ac": [
            {"id": "s1", "title": "Problem A", "titleSlug": "problem-a", "timestamp": START_UNIX + 600, "status": "Accepted"}
        ]
    }]

    version_row = engine_inst.generate_provisional_report(
        contest_id=CONTEST_ID,
        db=db,
        students_evidence=ev_data,
        official_problems=OFFICIAL_PROBLEMS
    )

    assert version_row.reconciliation_stage == "PROVISIONAL"
    assert version_row.status == "PROVISIONAL"
    assert version_row.evidence_metadata["banner"] == "PROVISIONAL — pending official LeetCode reconciliation."
    
    # Check dataset contains banner
    assert version_row.dataset[0]["report_header"] == "PROVISIONAL — pending official LeetCode reconciliation."


def test_02_t_plus_3_reconciliation_with_changes(db_context):
    """Test 2 & 5: T+3 Reconciliation detects changes (post-contest solves), logs audit trail, preserves provisional version."""
    db, student = db_context
    engine_inst = DelayedReconciliationEngine()

    # Evidence at T+3: Student also solved Q2 post-contest
    ev_data_t3 = [{
        "student_id": student.id,
        "username": student.username or "testuser",
        "attended": True,
        "recent_ac": [
            {"id": "s1", "title": "Problem A", "titleSlug": "problem-a", "timestamp": START_UNIX + 600, "status": "Accepted"},
            {"id": "s2", "title": "Problem B", "titleSlug": "problem-b", "timestamp": END_UNIX + 1800, "status": "Accepted"} # post contest solve
        ]
    }]

    t3_version, corrections = engine_inst.reconcile_stage(
        contest_id=CONTEST_ID,
        stage="T_PLUS_3_RECONCILIATION",
        db=db,
        reconciled_evidence=ev_data_t3,
        official_problems=OFFICIAL_PROBLEMS
    )

    assert t3_version.reconciliation_stage == "T_PLUS_3_RECONCILIATION"
    assert t3_version.status == "RECONCILED"
    assert corrections >= 1

    # Verify original PROVISIONAL version is preserved untouched!
    prov_ver = db.query(ContestReportVersion).filter_by(
        contest_id=CONTEST_ID, reconciliation_stage="PROVISIONAL"
    ).first()
    assert prov_ver is not None
    assert prov_ver.status == "PROVISIONAL"

    # Verify audit event was logged
    audit_evt = db.query(ContestReconciliationEvent).filter_by(
        contest_id=CONTEST_ID,
        student_id=student.id,
        reconciliation_stage="T_PLUS_3_RECONCILIATION"
    ).first()
    assert audit_evt is not None
    assert audit_evt.event_type == "RECONCILIATION_CORRECTION"


def test_03_t_plus_3_idempotency(db_context):
    """Test 6 & 7: Retrying T+3 reconciliation multiple times does NOT duplicate audit events or corrupt version snapshot."""
    db, student = db_context
    engine_inst = DelayedReconciliationEngine()

    ev_data_t3 = [{
        "student_id": student.id,
        "username": student.username or "testuser",
        "attended": True,
        "recent_ac": [
            {"id": "s1", "title": "Problem A", "titleSlug": "problem-a", "timestamp": START_UNIX + 600, "status": "Accepted"},
            {"id": "s2", "title": "Problem B", "titleSlug": "problem-b", "timestamp": END_UNIX + 1800, "status": "Accepted"}
        ]
    }]

    count_before_audit = db.query(ContestReconciliationEvent).filter_by(
        contest_id=CONTEST_ID, student_id=student.id, reconciliation_stage="T_PLUS_3_RECONCILIATION"
    ).count()

    # Re-run T+3
    t3_ver_retry, retry_corrections = engine_inst.reconcile_stage(
        contest_id=CONTEST_ID,
        stage="T_PLUS_3_RECONCILIATION",
        db=db,
        reconciled_evidence=ev_data_t3,
        official_problems=OFFICIAL_PROBLEMS
    )

    count_after_audit = db.query(ContestReconciliationEvent).filter_by(
        contest_id=CONTEST_ID, student_id=student.id, reconciliation_stage="T_PLUS_3_RECONCILIATION"
    ).count()

    # Audit event count must NOT increase on retry with same data
    assert count_after_audit == count_before_audit
    assert retry_corrections == 0


def test_04_failed_api_reconciliation_safety(db_context):
    """Test 4 & 6: Network/API failure during reconciliation does NOT mark report as OFFICIAL_RECONCILED. Sets status to RECONCILIATION_FAILED."""
    db, student = db_context
    engine_inst = DelayedReconciliationEngine()

    failed_ver, corr = engine_inst.reconcile_stage(
        contest_id=CONTEST_ID,
        stage="T_PLUS_12_FINAL",
        db=db,
        simulate_network_failure=True
    )

    assert failed_ver.status == "RECONCILIATION_FAILED"
    assert failed_ver.status != "OFFICIAL_RECONCILED"

    # Verify failure audit event was logged
    fail_evt = db.query(ContestReconciliationEvent).filter_by(
        contest_id=CONTEST_ID, reconciliation_stage="T_PLUS_12_FINAL", event_type="RECONCILIATION_FAILED"
    ).first()
    assert fail_evt is not None


def test_05_t_plus_12_final_official_reconciled(db_context):
    """Test 3, 8 & 10: T+12 Final Reconciliation sets final status to OFFICIAL_RECONCILED and retains all 3 distinguishable versions."""
    db, student = db_context
    engine_inst = DelayedReconciliationEngine()

    ev_data_t12 = [{
        "student_id": student.id,
        "username": student.username or "testuser",
        "attended": True,
        "recent_ac": [
            {"id": "s1", "title": "Problem A", "titleSlug": "problem-a", "timestamp": START_UNIX + 600, "status": "Accepted"},
            {"id": "s2", "title": "Problem B", "titleSlug": "problem-b", "timestamp": END_UNIX + 1800, "status": "Accepted"}
        ]
    }]

    t12_version, corrections = engine_inst.reconcile_stage(
        contest_id=CONTEST_ID,
        stage="T_PLUS_12_FINAL",
        db=db,
        reconciled_evidence=ev_data_t12,
        official_problems=OFFICIAL_PROBLEMS,
        simulate_network_failure=False
    )

    assert t12_version.reconciliation_stage == "T_PLUS_12_FINAL"
    assert t12_version.status == "OFFICIAL_RECONCILED"

    # Verify version preservation: PROVISIONAL, T_PLUS_3_RECONCILIATION, and T_PLUS_12_FINAL all exist simultaneously!
    all_versions = db.query(ContestReportVersion).filter_by(contest_id=CONTEST_ID).all()
    stages = [v.reconciliation_stage for v in all_versions]
    assert "PROVISIONAL" in stages
    assert "T_PLUS_3_RECONCILIATION" in stages
    assert "T_PLUS_12_FINAL" in stages
