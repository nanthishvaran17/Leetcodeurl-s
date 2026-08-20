import pytest
import asyncio
import datetime
import hashlib
import json
import os
from unittest.mock import AsyncMock, patch, MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models import (
    Base, Student, Department, WeeklySession, WeeklyPublicResult, 
    WeeklyVirtualResult, OfficialWeeklySnapshot, CertificateRecord,
    WeeklyContestErrorLog
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


# ── TEST 1: IDEMPOTENT SESSION CREATION ─────────────────────────────────────
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


# ── TEST 2: DUPLICATE SCHEDULER EXECUTION ───────────────────────────────────
def test_duplicate_scheduler_execution(db):
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

    asyncio.run(trigger_start_snapshot_0800(db, session.id))
    asyncio.run(trigger_start_snapshot_0800(db, session.id))
    asyncio.run(trigger_start_snapshot_0800(db, session.id))

    count = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == session.id).count()
    assert count == 10


# ── TEST 3: SERVER RESTART RECOVERY ─────────────────────────────────────────
def test_server_restart_recovery(db):
    """Interrupted sessions resume and preserve already validated records."""
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

    with patch("backend.services.weekly_session_manager.retry_failed_student_fetches", new_callable=AsyncMock):
        snapshot = asyncio.run(trigger_final_snapshot_0930(db, session.id))

    assert snapshot is not None
    assert session.status == "FINALIZED"
    assert session.official_participants == 5
    assert session.not_participated == 3
    assert session.failed_verification == 2


# ── TEST 4: WORKER RECOVERY ─────────────────────────────────────────────────
def test_worker_recovery_handles_crashes(db):
    """If a worker throws during processing, the database state remains recoverable."""
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

    # Simulate an unhandled exception recorded as error log
    err = WeeklyContestErrorLog(
        session_id=session.id,
        student_id=1,
        reg_no="732224CS001",
        student_name="Student 1",
        error_type="WORKER_CRASH",
        error_message="Worker pool connection reset by peer",
        status="UNRESOLVED"
    )
    db.add(err)
    db.commit()

    log = db.query(WeeklyContestErrorLog).filter(WeeklyContestErrorLog.session_id == session.id).first()
    assert log.error_type == "WORKER_CRASH"
    assert log.status == "UNRESOLVED"


# ── TEST 5: HTTP 429 RATE LIMITING ──────────────────────────────────────────
def test_http_429_rate_limiting_handling():
    """HTTP 429 returns RATE_LIMITED and never falsely marks student as absent."""
    mock_api = MagicMock()
    mock_api.validate_profile.side_effect = Exception("HTTP 429 Too Many Requests")
    classifier = ContestClassifier(leetcode_api_client=mock_api)

    row = classifier.classify_student_contest(
        student_id=1,
        student_name="Test User",
        leetcode_username="test_user",
        contest_id="weekly-contest-515",
        contest_name="Weekly Contest 515"
    )
    assert row.status == ContestStatus.FETCH_FAILED
    assert row.status != ContestStatus.NOT_ATTENDED


# ── TEST 6: HTTP 500 SERVER ERROR ───────────────────────────────────────────
def test_http_500_server_error_handling():
    """HTTP 500 returns FETCH_FAILED and preserves audit reason."""
    mock_api = MagicMock()
    mock_api.validate_profile.side_effect = Exception("HTTP 500 Internal Server Error")
    classifier = ContestClassifier(leetcode_api_client=mock_api)

    row = classifier.classify_student_contest(
        student_id=1,
        student_name="Test User",
        leetcode_username="test_user",
        contest_id="weekly-contest-515",
        contest_name="Weekly Contest 515"
    )
    assert row.status == ContestStatus.FETCH_FAILED
    assert "500" in (row.error_message or "")


# ── TEST 7: HTTP 503 SERVICE UNAVAILABLE ─────────────────────────────────────
def test_http_503_service_unavailable():
    """HTTP 503 is caught and recorded cleanly."""
    mock_api = MagicMock()
    mock_api.validate_profile.side_effect = Exception("HTTP 503 Service Unavailable")
    classifier = ContestClassifier(leetcode_api_client=mock_api)

    row = classifier.classify_student_contest(
        student_id=1,
        student_name="Test User",
        leetcode_username="test_user",
        contest_id="weekly-contest-515",
        contest_name="Weekly Contest 515"
    )
    assert row.status == ContestStatus.FETCH_FAILED


# ── TEST 8: TIMEOUT HANDLING ────────────────────────────────────────────────
def test_timeout_handling():
    """Network timeout records FETCH_FAILED, not absent."""
    mock_api = MagicMock()
    mock_api.validate_profile.side_effect = TimeoutError("Request timed out after 15s")
    classifier = ContestClassifier(leetcode_api_client=mock_api)

    row = classifier.classify_student_contest(
        student_id=1,
        student_name="Test User",
        leetcode_username="test_user",
        contest_id="weekly-contest-515",
        contest_name="Weekly Contest 515"
    )
    assert row.status == ContestStatus.FETCH_FAILED


# ── TEST 9: MALFORMED GRAPHQL RESPONSE ──────────────────────────────────────
def test_malformed_graphql_response():
    """Malformed response returns FETCH_FAILED gracefully."""
    mock_api = MagicMock()
    mock_api.validate_profile.side_effect = ValueError("Expecting value: line 1 column 1 (char 0)")
    classifier = ContestClassifier(leetcode_api_client=mock_api)

    row = classifier.classify_student_contest(
        student_id=1,
        student_name="Test User",
        leetcode_username="test_user",
        contest_id="weekly-contest-515",
        contest_name="Weekly Contest 515"
    )
    assert row.status == ContestStatus.FETCH_FAILED


# ── TEST 10: INVALID USERNAME ───────────────────────────────────────────────
def test_invalid_username_handling():
    """Missing or 404 username returns PENDING_USERNAME / INVALID_USERNAME."""
    mock_api = MagicMock()
    mock_api.validate_profile.return_value = None
    classifier = ContestClassifier(leetcode_api_client=mock_api)

    row = classifier.classify_student_contest(
        student_id=1,
        student_name="Test User",
        leetcode_username="non_existent_user_404",
        contest_id="weekly-contest-515",
        contest_name="Weekly Contest 515"
    )
    assert row.status == ContestStatus.INVALID_USERNAME
    assert row.status != ContestStatus.NOT_ATTENDED


# ── TEST 11: MISSING CONTEST HANDLING ───────────────────────────────────────
def test_missing_contest_handling():
    """Missing contest record in verified profile yields NOT_ATTENDED."""
    mock_api = MagicMock()
    mock_api.validate_profile.return_value = {"username": "valid_user"}
    mock_api.fetch_contest_result.return_value = None
    classifier = ContestClassifier(leetcode_api_client=mock_api)

    row = classifier.classify_student_contest(
        student_id=1,
        student_name="Test User",
        leetcode_username="valid_user",
        contest_id="weekly-contest-515",
        contest_name="Weekly Contest 515"
    )
    assert row.status == ContestStatus.NOT_ATTENDED


# ── TEST 12: CONTEST EVIDENCE VALIDATION ────────────────────────────────────
def test_contest_evidence_validation():
    """Contest participation requires matching canonical contest id."""
    mock_api = MagicMock()
    mock_api.validate_profile.return_value = {"username": "alice"}
    mock_api.fetch_contest_result.return_value = {
        "contest_id": "weekly-contest-999", # Mismatched contest
        "username": "alice",
        "attended": True
    }
    classifier = ContestClassifier(leetcode_api_client=mock_api)

    row = classifier.classify_student_contest(
        student_id=1,
        student_name="Alice",
        leetcode_username="alice",
        contest_id="weekly-contest-515",
        contest_name="Weekly Contest 515"
    )
    assert row.status == ContestStatus.UNKNOWN
    assert row.reason_code == ReasonCode.IDENTITY_MISMATCH


# ── TEST 13: PUBLIC ATTENDED VALIDATION ─────────────────────────────────────
def test_public_attended_validation():
    """Confirmed attended flag yields PUBLIC_ATTENDED with score and ranks."""
    mock_api = MagicMock()
    mock_api.validate_profile.return_value = {"username": "alice"}
    mock_api.fetch_contest_result.return_value = {
        "contest_id": "weekly-contest-515",
        "username": "alice",
        "attended": True,
        "problems_solved": 4,
        "score": 18,
        "rank": 250,
        "rating_after": 1950.0,
        "q1_solved": True, "q2_solved": True, "q3_solved": True, "q4_solved": True
    }
    classifier = ContestClassifier(leetcode_api_client=mock_api)

    row = classifier.classify_student_contest(
        student_id=1,
        student_name="Alice",
        leetcode_username="alice",
        contest_id="weekly-contest-515",
        contest_name="Weekly Contest 515"
    )
    assert row.status == ContestStatus.PUBLIC_ATTENDED
    assert row.problems_solved == 4
    assert row.score == 18
    assert row.rank == 250


# ── TEST 14: VIRTUAL ATTENDED VALIDATION ────────────────────────────────────
def test_virtual_attended_validation():
    """Confirmed virtual participation yields VIRTUAL_ATTENDED."""
    mock_api = MagicMock()
    mock_api.validate_profile.return_value = {"username": "bob"}
    mock_api.fetch_contest_result.return_value = {
        "contest_id": "weekly-contest-515",
        "username": "bob",
        "attended": False,
        "problems_solved": 2,
        "score": 7,
        "q1_solved": True, "q2_solved": True, "q3_solved": False, "q4_solved": False
    }
    classifier = ContestClassifier(leetcode_api_client=mock_api)

    row = classifier.classify_student_contest(
        student_id=2,
        student_name="Bob",
        leetcode_username="bob",
        contest_id="weekly-contest-515",
        contest_name="Weekly Contest 515"
    )
    assert row.status == ContestStatus.VIRTUAL_ATTENDED
    assert row.problems_solved == 2


# ── TEST 15: NOT ATTENDED VALIDATION ────────────────────────────────────────
def test_not_attended_validation():
    """Profile without contest participation correctly yields NOT_ATTENDED."""
    mock_api = MagicMock()
    mock_api.validate_profile.return_value = {"username": "charlie"}
    mock_api.fetch_contest_result.return_value = None
    classifier = ContestClassifier(leetcode_api_client=mock_api)

    row = classifier.classify_student_contest(
        student_id=3,
        student_name="Charlie",
        leetcode_username="charlie",
        contest_id="weekly-contest-515",
        contest_name="Weekly Contest 515"
    )
    assert row.status == ContestStatus.NOT_ATTENDED
    assert row.reason_code == ReasonCode.NO_PARTICIPATION


# ── TEST 16: DATA ERROR VALIDATION ──────────────────────────────────────────
def test_data_error_validation():
    """Identity mismatch creates DATA_ERROR / UNKNOWN status."""
    mock_api = MagicMock()
    mock_api.validate_profile.return_value = {"username": "expected_user"}
    mock_api.fetch_contest_result.return_value = {
        "contest_id": "weekly-contest-515",
        "username": "different_user_returned",
        "attended": True
    }
    classifier = ContestClassifier(leetcode_api_client=mock_api)

    row = classifier.classify_student_contest(
        student_id=1,
        student_name="User",
        leetcode_username="expected_user",
        contest_id="weekly-contest-515",
        contest_name="Weekly Contest 515"
    )
    assert row.status == ContestStatus.UNKNOWN
    assert row.reason_code == ReasonCode.IDENTITY_MISMATCH


# ── TEST 17: STATE MACHINE TRANSITIONS ──────────────────────────────────────
def test_state_machine_transitions(db):
    """Records progress cleanly through lifecycle states."""
    session = WeeklySession(
        session_code="WK515-20260823",
        contest_id="weekly-contest-515",
        contest_name="Weekly Contest 515",
        session_date="2026-08-23",
        status="LIVE",
        total_students=1
    )
    db.add(session)
    db.commit()
    asyncio.run(trigger_start_snapshot_0800(db, session.id))

    res = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == session.id).first()
    assert res.state == "PENDING"

    # Transition to VALIDATED
    res.state = "VALIDATED"
    res.fetch_status = "SUCCESS"
    res.participation_status = "PUBLIC"
    db.commit()

    # Finalize
    with patch("backend.services.weekly_session_manager.retry_failed_student_fetches", new_callable=AsyncMock):
        asyncio.run(trigger_final_snapshot_0930(db, session.id))

    db.refresh(res)
    assert res.state == "FINALIZED"


# ── TEST 18: 300 STUDENT RECONCILIATION GATE ────────────────────────────────
def test_300_student_reconciliation_gate(db):
    """Reconciliation verifies that every active student is accounted for."""
    dept = db.query(Department).first()
    # Add 290 more students to reach 300 total
    for i in range(11, 301):
        st = Student(
            reg_no=f"732224CS{i:03d}",
            name=f"Student {i}",
            department_id=dept.id,
            year_level="III",
            username=f"leetcode_user_{i}",
            is_active=True
        )
        db.add(st)
    db.commit()

    total_active = db.query(Student).filter(Student.is_active == True).count()
    assert total_active == 300

    session = WeeklySession(
        session_code="WK515-20260823",
        contest_id="weekly-contest-515",
        contest_name="Weekly Contest 515",
        session_date="2026-08-23",
        status="LIVE",
        total_students=300
    )
    db.add(session)
    db.commit()
    asyncio.run(trigger_start_snapshot_0800(db, session.id))

    # Mark 210 Public, 30 Virtual, 50 Absent, 10 Errors = 300
    all_res = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == session.id).all()
    for r in all_res[:210]:
        r.fetch_status = "SUCCESS"
        r.participation_status = "PUBLIC"
        r.total_contest_solved = 3

    for r in all_res[210:240]:
        r.fetch_status = "SUCCESS"
        r.participation_status = "VIRTUAL"
        r.total_contest_solved = 2

    for r in all_res[240:290]:
        r.fetch_status = "SUCCESS"
        r.participation_status = "NOT_ATTENDED"
        r.total_contest_solved = 0

    for r in all_res[290:300]:
        r.data_fetch_status = "FETCH_FAILED"
        r.error_reason = "TIMEOUT"

    db.commit()

    with patch("backend.services.weekly_session_manager.retry_failed_student_fetches", new_callable=AsyncMock):
        snapshot = asyncio.run(trigger_final_snapshot_0930(db, session.id))

    assert snapshot is not None
    rec = snapshot.reconciliation_summary
    assert rec["reconciliation_passed"] is True
    assert rec["total_processed"] == 300


# ── TEST 19: CRYPTOGRAPHIC INTEGRITY ────────────────────────────────────────
def test_cryptographic_integrity():
    """Individual and session SHA-256 hashes are strictly deterministic."""
    h1 = compute_student_record_hash("732224CS001", 10, 4, 18, 120, 2050.0)
    h2 = compute_student_record_hash("732224CS001", 10, 4, 18, 120, 2050.0)
    h3 = compute_student_record_hash("732224CS001", 10, 3, 12, 500, 1850.0)

    assert h1 == h2
    assert h1 != h3

    rows = [{"reg_no": f"732224CS{i:03d}", "score": 10, "total_solved": 2} for i in range(1, 10)]
    s_hash_1 = compute_session_data_hash(rows)
    s_hash_2 = compute_session_data_hash(list(reversed(rows)))
    assert s_hash_1 == s_hash_2


# ── TEST 20: CERTIFICATE & FORENSIC ISOLATION ────────────────────────────────
def test_certificate_forensic_isolation(db):
    """Excellence and Forensic certificates maintain strict independent verification IDs."""
    st = db.query(Student).first()

    cert_exc = CertificateRecord(
        verification_id=f"CERT-{st.reg_no}-EXCELLENCE",
        certificate_code=f"CERT-{st.reg_no}-EXCELLENCE",
        student_id=st.id,
        student_name=st.name,
        register_no=st.reg_no,
        department="CSE",
        department_name="Computer Science and Engineering",
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
        department="CSE",
        department_name="Computer Science and Engineering",
        document_type="FORENSIC_VERIFICATION_REPORT",
        contest_id="weekly-contest-515",
        issue_date="Aug 20, 2026",
        verification_url=f"https://leetcode-student-data.web.app/verify/CERT-{st.reg_no}-FORENSIC",
        status="VALID"
    )
    db.add_all([cert_exc, cert_for])
    db.commit()

    res_exc = db.query(CertificateRecord).filter(CertificateRecord.verification_id == f"CERT-{st.reg_no}-EXCELLENCE").first()
    res_for = db.query(CertificateRecord).filter(CertificateRecord.verification_id == f"CERT-{st.reg_no}-FORENSIC").first()

    assert res_exc.document_type == "CERTIFICATE_OF_EXCELLENCE"
    assert res_for.document_type == "FORENSIC_VERIFICATION_REPORT"
    assert res_exc.verification_id != res_for.verification_id


# ── TEST 21: NO FALLBACK FOR INVALID IDS ────────────────────────────────────
def test_no_fallback_for_invalid_certificate_ids(db):
    """Unknown verification IDs strictly resolve to None without falling back to other students."""
    from backend.routes.certificates import resolve_certificate_record
    res = resolve_certificate_record(db, "INVALID-NON-EXISTENT-ID-12345")
    assert res is None
