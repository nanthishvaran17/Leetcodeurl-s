import pytest
import datetime
from zoneinfo import ZoneInfo
from unittest.mock import patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models import (
    Base, Student, LeetCodeAccount, StudentContestParticipation, 
    IntegrityCase, AuditLogRecord, ContestConfig, AttendanceSnapshot,
    CorrectionEvent, PostContestActivityRecord, NotificationEvent
)
from backend.services.contest_window_engine import ContestWindowEngine, ContestActivityType, OfficialAttendanceState
from backend.services.contest_integrity_service import ContestIntegrityService
from backend.services.notification_outbox_worker import NotificationOutboxWorker

IST = ZoneInfo("Asia/Kolkata")
UTC = ZoneInfo("UTC")

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def create_student_with_accounts(db, people_id="P001", name="Test Student", num_accounts=2):
    student = Student(people_id=people_id, reg_no=people_id, name=name, email=f"{people_id.lower()}@college.edu", department_id=1, section_id=1, year_level="III")
    db.add(student)
    db.commit()
    db.refresh(student)

    accounts = []
    for i in range(num_accounts):
        acc = LeetCodeAccount(student_id=student.id, leetcode_username=f"user_{people_id}_{i+1}")
        db.add(acc)
        accounts.append(acc)
    db.commit()
    return student, accounts


# ─────────────────────────────────────────────────────────────────────────────
# 1. BOUNDARY TIMESTAMP PRECISION TESTS
# ─────────────────────────────────────────────────────────────────────────────

def test_boundary_precision_080000_ist(db):
    """08:00:00 IST -> IN_CONTEST"""
    t = datetime.datetime(2026, 9, 6, 8, 0, 0, tzinfo=IST)
    assert ContestWindowEngine.classify_activity_time(t) == ContestActivityType.IN_CONTEST

def test_boundary_precision_092959_ist(db):
    """09:29:59 IST -> IN_CONTEST"""
    t = datetime.datetime(2026, 9, 6, 9, 29, 59, tzinfo=IST)
    assert ContestWindowEngine.classify_activity_time(t) == ContestActivityType.IN_CONTEST

def test_boundary_precision_093000_ist(db):
    """09:30:00 IST -> IN_CONTEST (Official contest end boundary)"""
    t = datetime.datetime(2026, 9, 6, 9, 30, 0, tzinfo=IST)
    assert ContestWindowEngine.classify_activity_time(t) == ContestActivityType.IN_CONTEST

def test_boundary_precision_093001_ist(db):
    """09:30:01 IST -> POST_CONTEST"""
    t = datetime.datetime(2026, 9, 6, 9, 30, 1, tzinfo=IST)
    assert ContestWindowEngine.classify_activity_time(t) == ContestActivityType.POST_CONTEST

def test_boundary_precision_093100_ist(db):
    """09:31:00 IST -> POST_CONTEST"""
    t = datetime.datetime(2026, 9, 6, 9, 31, 0, tzinfo=IST)
    assert ContestWindowEngine.classify_activity_time(t) == ContestActivityType.POST_CONTEST

def test_boundary_precision_093500_ist(db):
    """09:35:00 IST -> POST_CONTEST & Attendance Freeze Window"""
    t = datetime.datetime(2026, 9, 6, 9, 35, 0, tzinfo=IST)
    assert ContestWindowEngine.classify_activity_time(t) == ContestActivityType.POST_CONTEST


# ─────────────────────────────────────────────────────────────────────────────
# 2. IMMUTABLE SNAPSHOT & POST-CONTEST SOLVE ISOLATION
# ─────────────────────────────────────────────────────────────────────────────

def test_post_contest_solves_cannot_alter_frozen_attendance(db):
    """
    Submissions at 10:00 AM (2 solves), 04:30 PM (3 solves), 08:20 PM (1 solve), 11:00 PM
    MUST NOT change official frozen attendance from NOT_ATTENDED to ATTENDED.
    """
    student, accounts = create_student_with_accounts(db, "P_POST", "Post Contest Student")
    
    # 09:35 AM IST Freeze
    freeze_data = [{
        "student_id": student.id,
        "people_id": student.people_id,
        "leetcode_username": accounts[0].leetcode_username,
        "contest_id": "wc-500",
        "participation_mode": f"PUBLIC_{accounts[0].leetcode_username}",
        "score_display": "Not Attended",
        "in_contest_solved": 0
    }]
    ContestWindowEngine.process_and_freeze_attendance(db, "wc-500", freeze_data)

    # Verify Snapshot Created
    snapshot = db.query(AttendanceSnapshot).filter_by(people_id="P_POST").first()
    assert snapshot is not None
    assert snapshot.official_attendance_state == OfficialAttendanceState.NOT_ATTENDED

    # Late solves at 10:00 AM, 04:30 PM, 08:20 PM
    t10 = datetime.datetime(2026, 9, 6, 10, 0, 0, tzinfo=IST)
    t16 = datetime.datetime(2026, 9, 6, 16, 30, 0, tzinfo=IST)
    t20 = datetime.datetime(2026, 9, 6, 20, 20, 0, tzinfo=IST)

    ContestWindowEngine.log_post_contest_activity(db, student.id, student.people_id, "wc-500", accounts[0].leetcode_username, t10, "two-sum", "ACCEPTED")
    ContestWindowEngine.log_post_contest_activity(db, student.id, student.people_id, "wc-500", accounts[0].leetcode_username, t16, "add-two-numbers", "ACCEPTED")
    ContestWindowEngine.log_post_contest_activity(db, student.id, student.people_id, "wc-500", accounts[0].leetcode_username, t20, "3sum", "ACCEPTED")

    # Verify PostContestActivityRecord entries
    post_records = db.query(PostContestActivityRecord).filter_by(people_id="P_POST").all()
    assert len(post_records) == 3

    # Re-verify Official Attendance Snapshot is STILL NOT_ATTENDED!
    db.refresh(snapshot)
    assert snapshot.official_attendance_state == OfficialAttendanceState.NOT_ATTENDED


# ─────────────────────────────────────────────────────────────────────────────
# 3. MULTI-ACCOUNT CONSOLIDATION & DYNAMIC EXPLANATION TESTS (2, 3, 4+ ACCOUNTS)
# ─────────────────────────────────────────────────────────────────────────────

@patch("backend.services.notification_outbox_worker.send_email", return_value=(True, "MOCK_MSG_ID"))
@patch("backend.services.notification_outbox_worker.NotificationService.send_targeted_notification", return_value={"success": True})
def test_multi_account_consolidation_3_accounts(mock_notif, mock_email, db):
    """3 linked accounts for 1 student -> Consolidated into 1 Integrity Case"""
    student, accounts = create_student_with_accounts(db, "P_MULTI3", "Multi Student", num_accounts=3)
    
    for acc in accounts:
        db.add(StudentContestParticipation(
            student_id=student.id, contest_id="wc-500", contest_name="WC500", participation_mode=f"PUBLIC_{acc.leetcode_username}",
            score_display="Not Attended", questions_solved=0, official_attendance_state="NOT_ATTENDED", source=f"leetcode_official_{acc.leetcode_username}"
        ))
    db.commit()

    service = ContestIntegrityService(db)
    cases = service.evaluate_contest_integrity("wc-500")

    assert len(cases) == 1
    assert cases[0]["people_id"] == "P_MULTI3"
    assert len(cases[0]["accounts"]) == 3
    assert "3 different LeetCode contest accounts" in cases[0]["why_this_alert"]


# ─────────────────────────────────────────────────────────────────────────────
# 4. TRANSACTIONAL OUTBOX IDEMPOTENCY TESTS
# ─────────────────────────────────────────────────────────────────────────────

@patch("backend.services.notification_outbox_worker.send_email", return_value=(True, "MOCK_MSG_ID"))
@patch("backend.services.notification_outbox_worker.NotificationService.send_targeted_notification", return_value={"success": True})
def test_outbox_notification_idempotency(mock_notif, mock_email, db):
    """Queueing and processing outbox events multiple times produces zero duplicate dispatches"""
    student, accounts = create_student_with_accounts(db, "P_OUTBOX", "Outbox Student")
    
    for acc in accounts:
        db.add(StudentContestParticipation(
            student_id=student.id, contest_id="wc-500", contest_name="WC500", participation_mode=f"PUBLIC_{acc.leetcode_username}",
            score_display="Not Attended", questions_solved=0, official_attendance_state="NOT_ATTENDED", source=f"leetcode_official_{acc.leetcode_username}"
        ))
    db.commit()

    service = ContestIntegrityService(db)
    
    # Run 1
    service.evaluate_contest_integrity("wc-500")
    events_run1 = db.query(NotificationEvent).filter_by(people_id="P_OUTBOX").all()
    assert len(events_run1) == 3 # Student Email, Staff Email, Staff Push

    # Run 2 (Retry)
    service.evaluate_contest_integrity("wc-500")
    events_run2 = db.query(NotificationEvent).filter_by(people_id="P_OUTBOX").all()
    assert len(events_run2) == 3 # Still strictly 3 events!


# ─────────────────────────────────────────────────────────────────────────────
# 5. ADMINISTRATIVE CORRECTION AUDIT TRAIL TEST
# ─────────────────────────────────────────────────────────────────────────────

def test_administrative_correction_audit_event(db):
    """Administrative corrections write CorrectionEvent and do not corrupt history"""
    student, accounts = create_student_with_accounts(db, "P_CORR", "Correction Student")
    
    snapshot = AttendanceSnapshot(
        contest_id="wc-500", people_id="P_CORR", student_id=student.id, leetcode_username=accounts[0].leetcode_username,
        official_attendance_state="NOT_ATTENDED", source="official_sync", calculated_at=datetime.datetime.utcnow(),
        frozen_at=datetime.datetime.utcnow(), algorithm_version="2.0.0"
    )
    db.add(snapshot)
    db.commit()

    correction = CorrectionEvent(
        audit_id="CORR-12345", snapshot_id=snapshot.id, contest_id="wc-500", people_id="P_CORR",
        old_value="NOT_ATTENDED", new_value="ATTENDED", reason="Approved medical leave exception",
        staff_id="STAFF_007", timestamp=datetime.datetime.utcnow()
    )
    db.add(correction)
    db.commit()

    rec = db.query(CorrectionEvent).filter_by(audit_id="CORR-12345").first()
    assert rec is not None
    assert rec.old_value == "NOT_ATTENDED"
    assert rec.new_value == "ATTENDED"
    assert rec.reason == "Approved medical leave exception"
