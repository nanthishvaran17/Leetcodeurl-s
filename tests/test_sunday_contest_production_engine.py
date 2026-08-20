import pytest
import asyncio
import datetime
import hashlib
import json
from unittest.mock import AsyncMock, patch, MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models import (
    Base, Student, Department, WeeklySession, WeeklyPublicResult, 
    WeeklyVirtualResult, OfficialWeeklySnapshot, CertificateRecord
)
from backend.services.weekly_session_manager import (
    get_or_create_current_weekly_session,
    trigger_start_snapshot_0800,
    trigger_final_snapshot_0930,
    compute_student_record_hash,
    compute_session_data_hash,
)
from backend.services.contest_classifier import (
    ContestClassifier, ContestStatus, ReasonCode, FetchStatus
)

TEST_DB_URL = "sqlite:///:memory:"

@pytest.fixture
def db():
    engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    dept = Department(name="Computer Science and Engineering", code="CSE")
    session.add(dept)
    session.commit()

    # Seed 10 test students
    for i in range(1, 11):
        st = Student(
            reg_no=f"732224CS{i:03d}",
            name=f"Student {i}",
            department_id=dept.id,
            year_level="III",
            username=f"leetcode_user_{i}",
            leetcode_url=f"https://leetcode.com/u/leetcode_user_{i}/",
            is_active=True
        )
        session.add(st)
    session.commit()

    yield session
    session.close()


# ── TEST 1: IDEMPOTENT SUNDAY SESSION ───────────────────────────────────────
def test_idempotent_session_creation(db):
    """Running session discovery multiple times creates exactly 1 session, never duplicates."""
    with patch("backend.services.weekly_session_manager.discover_contest_metadata") as mock_disc:
        mock_disc.return_value = {
            "session_code": "WK515-20260823",
            "contest_id": "weekly-contest-515",
            "contest_name": "Weekly Contest 515",
            "session_date": "2026-08-23",
            "status": "SCHEDULED"
        }
        sess1 = get_or_create_current_weekly_session(db)
        sess2 = get_or_create_current_weekly_session(db)
        sess3 = get_or_create_current_weekly_session(db)

        assert sess1.id == sess2.id == sess3.id
        all_sessions = db.query(WeeklySession).all()
        assert len(all_sessions) == 1


# ── TEST 2: IDEMPOTENT START SNAPSHOT ────────────────────────────────────────
def test_idempotent_start_snapshot(db):
    """Triggering 08:00 AM start snapshot multiple times populates exactly 1 record per student."""
    session = WeeklySession(
        session_code="WK515-20260823",
        contest_id="weekly-contest-515",
        contest_name="Weekly Contest 515",
        session_date="2026-08-23",
        status="SCHEDULED",
        total_students=10
    )
    db.add(session)
    db.commit()

    # First run
    asyncio.run(trigger_start_snapshot_0800(db, session.id))
    count1 = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == session.id).count()
    assert count1 == 10

    # Second run (simulating scheduler retry or duplicate dispatch)
    asyncio.run(trigger_start_snapshot_0800(db, session.id))
    count2 = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == session.id).count()
    assert count2 == 10

    # Verify initial state is strictly PENDING
    records = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == session.id).all()
    for r in records:
        assert r.state == "PENDING"
        assert r.participation_status == "PENDING"


# ── TEST 3: SERVER RESTART RECOVERY ─────────────────────────────────────────
def test_server_restart_recovery(db):
    """Interrupted sessions can be resumed and finalize only remaining records without data loss."""
    session = WeeklySession(
        session_code="WK515-20260823",
        contest_id="weekly-contest-515",
        contest_name="Weekly Contest 515",
        session_date="2026-08-23",
        status="LIVE",
        total_students=10
    )
    db.add(session)
    db.commit()

    asyncio.run(trigger_start_snapshot_0800(db, session.id))

    # Simulate 5 students already processed before server crash
    students = db.query(Student).all()
    for i, s in enumerate(students[:5]):
        res = db.query(WeeklyPublicResult).filter(
            WeeklyPublicResult.session_id == session.id,
            WeeklyPublicResult.student_id == s.id
        ).first()
        res.fetch_status = "SUCCESS"
        res.participation_status = "PUBLIC"
        res.state = "VALIDATED"
        res.q1, res.q2, res.q3 = 1, 1, 1
        res.total_contest_solved = 3
        res.contest_score = 12
        res.contest_rank = 1500 + i

    db.commit()

    # Simulate 5 remaining students: 3 absent, 1 invalid username, 1 fetch error
    for s in students[5:8]:
        res = db.query(WeeklyPublicResult).filter(
            WeeklyPublicResult.session_id == session.id,
            WeeklyPublicResult.student_id == s.id
        ).first()
        res.fetch_status = "SUCCESS"
        res.participation_status = "NOT_ATTENDED"
        res.total_contest_solved = 0

    res_inv = db.query(WeeklyPublicResult).filter(
        WeeklyPublicResult.session_id == session.id,
        WeeklyPublicResult.student_id == students[8].id
    ).first()
    res_inv.data_fetch_status = "USERNAME_NOT_FOUND"

    res_err = db.query(WeeklyPublicResult).filter(
        WeeklyPublicResult.session_id == session.id,
        WeeklyPublicResult.student_id == students[9].id
    ).first()
    res_err.data_fetch_status = "FETCH_FAILED"
    res_err.error_reason = "HTTP_429_RATE_LIMITED"

    db.commit()

    # Finalize snapshot
    with patch("backend.services.weekly_session_manager.retry_failed_student_fetches", new_callable=AsyncMock):
        snapshot = asyncio.run(trigger_final_snapshot_0930(db, session.id))

    assert snapshot is not None
    assert session.status == "FINALIZED"
    assert session.official_participants == 5
    assert session.not_participated == 3
    assert session.failed_verification == 2 # 1 invalid + 1 fetch error

    # Verify reconciliation passed
    reconcil = snapshot.reconciliation_summary
    assert reconcil["reconciliation_passed"] is True
    assert reconcil["total_processed"] == 10
    assert reconcil["public_attended"] == 5
    assert reconcil["not_attended"] == 3
    assert reconcil["data_errors"] == 2


# ── TEST 4: CONTEST EVIDENCE VALIDATION & STATE MACHINE ──────────────────────
def test_contest_evidence_classification():
    """Validates strict classification and ensures errors never become NOT_ATTENDED."""
    mock_api = MagicMock()
    classifier = ContestClassifier(leetcode_api_client=mock_api)

    # 1. Valid Public Attended
    mock_api.validate_profile.return_value = {"username": "alice_coder"}
    mock_api.fetch_contest_result.return_value = {
        "contest_id": "weekly-contest-515",
        "username": "alice_coder",
        "attended": True,
        "problems_solved": 3,
        "score": 12,
        "rank": 500,
        "rating_after": 1750.5,
        "q1_solved": True, "q2_solved": True, "q3_solved": True, "q4_solved": False
    }

    row_pub = classifier.classify_student_contest(
        student_id=1,
        student_name="Alice",
        leetcode_username="alice_coder",
        contest_id="weekly-contest-515",
        contest_name="Weekly Contest 515"
    )
    assert row_pub.status == ContestStatus.PUBLIC_ATTENDED
    assert row_pub.problems_solved == 3

    # 2. Validated Absence (Attended is False and problems_solved is 0)
    mock_api.fetch_contest_result.return_value = None # Profile returned no contest record -> NOT_ATTENDED
    row_abs = classifier.classify_student_contest(
        student_id=2,
        student_name="Bob",
        leetcode_username="bob_coder",
        contest_id="weekly-contest-515",
        contest_name="Weekly Contest 515"
    )
    assert row_abs.status == ContestStatus.NOT_ATTENDED

    # 3. Missing / Invalid Username -> Must be INVALID_PROFILE or NO_USERNAME, NEVER NOT_ATTENDED
    row_inv = classifier.classify_student_contest(
        student_id=3,
        student_name="Charlie",
        leetcode_username="",
        contest_id="weekly-contest-515",
        contest_name="Weekly Contest 515"
    )
    assert row_inv.status in (ContestStatus.PENDING_USERNAME, ContestStatus.INVALID_USERNAME)
    assert row_inv.status != ContestStatus.NOT_ATTENDED


# ── TEST 5: CRYPTOGRAPHIC INTEGRITY & DETERMINISTIC SESSION HASH ─────────────
def test_session_and_student_cryptographic_hash():
    """Computes and asserts cryptographic seals for individual students and entire session."""
    # Individual hash
    h1 = compute_student_record_hash("732224CS001", 1, 3, 12, 1500, 1650.0)
    h2 = compute_student_record_hash("732224CS001", 1, 3, 12, 1500, 1650.0)
    h3 = compute_student_record_hash("732224CS001", 1, 4, 18, 500, 1850.0)

    assert h1 == h2
    assert h1 != h3

    # Whole session hash
    rows_a = [
        {"reg_no": "732224CS002", "score": 8, "total_solved": 2},
        {"reg_no": "732224CS001", "score": 12, "total_solved": 3},
    ]
    rows_b = [
        {"reg_no": "732224CS001", "score": 12, "total_solved": 3},
        {"reg_no": "732224CS002", "score": 8, "total_solved": 2},
    ]
    # Sorting makes it order-independent and deterministic
    session_hash_a = compute_session_data_hash(rows_a)
    session_hash_b = compute_session_data_hash(rows_b)
    assert session_hash_a == session_hash_b
    assert len(session_hash_a) == 64


# ── TEST 6: CERTIFICATE & FORENSIC ISOLATION ────────────────────────────────
def test_certificate_forensic_document_isolation(db):
    """Verifies that Excellence and Forensic certificates have completely isolated identifiers and types."""
    st = db.query(Student).first()

    cert_exc = CertificateRecord(
        verification_id=f"CERT-{st.reg_no}-EXCELLENCE",
        certificate_code=f"CERT-{st.reg_no}-EXCELLENCE",
        student_id=st.id,
        student_name=st.name,
        register_no=st.reg_no,
        department=st.department.code,
        department_name=st.department.name,
        document_type="CERTIFICATE_OF_EXCELLENCE",
        contest_id="weekly-contest-515",
        issue_date="Aug 20, 2026",
        verification_url=f"https://leetcode-student-data.web.app/verify/CERT-{st.reg_no}-EXCELLENCE",
        status="VALID"
    )
    cert_for = CertificateRecord(
        verification_id=f"CERT-{st.reg_no}-FORENSIC",
        certificate_code=f"CERT-{st.reg_no}-FORENSIC",
        student_id=st.id,
        student_name=st.name,
        register_no=st.reg_no,
        department=st.department.code,
        department_name=st.department.name,
        document_type="FORENSIC_VERIFICATION_REPORT",
        contest_id="weekly-contest-515",
        issue_date="Aug 20, 2026",
        verification_url=f"https://leetcode-student-data.web.app/verify/CERT-{st.reg_no}-FORENSIC",
        status="VALID"
    )
    db.add_all([cert_exc, cert_for])
    db.commit()

    # Query strictly by document ID
    res_exc = db.query(CertificateRecord).filter(CertificateRecord.verification_id == f"CERT-{st.reg_no}-EXCELLENCE").first()
    res_for = db.query(CertificateRecord).filter(CertificateRecord.verification_id == f"CERT-{st.reg_no}-FORENSIC").first()

    assert res_exc is not None
    assert res_for is not None
    assert res_exc.document_type == "CERTIFICATE_OF_EXCELLENCE"
    assert res_for.document_type == "FORENSIC_VERIFICATION_REPORT"
    assert res_exc.verification_id != res_for.verification_id
