import pytest
import datetime
from zoneinfo import ZoneInfo
from unittest.mock import patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models import Base, Student, LeetCodeAccount, StudentContestParticipation, IntegrityCase
from backend.services.contest_window_engine import ContestWindowEngine, ContestActivityType, OfficialAttendanceState
from backend.services.contest_integrity_service import ContestIntegrityService

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
# 1. EXPLICIT TIMED SUBMISSION TESTS (9:29 AM, 9:30 AM, 9:31 AM, 10:00 AM, 4:30 PM, 8:20 PM, 11:00 PM)
# ─────────────────────────────────────────────────────────────────────────────

def test_explicit_submission_929_am(db):
    """9:29 AM Submission: IN_CONTEST -> ATTENDED -> Frozen -> No Alert"""
    student, accounts = create_student_with_accounts(db, "P_0929", "Student 9:29 AM")
    submission_time = datetime.datetime(2026, 9, 6, 9, 29, 0, tzinfo=IST)
    
    classification = ContestWindowEngine.classify_activity_time(submission_time)
    assert classification == ContestActivityType.IN_CONTEST

    p_data = [{
        "student_id": student.id,
        "contest_id": "wc-470",
        "participation_mode": f"PUBLIC_{accounts[0].leetcode_username}",
        "score_display": "1 / 4",
        "in_contest_solved": 1,
        "solved_in_window": True
    }]
    ContestWindowEngine.process_and_freeze_attendance(db, "wc-470", p_data)

    rec = db.query(StudentContestParticipation).filter_by(student_id=student.id).first()
    assert rec.official_attendance_state == OfficialAttendanceState.ATTENDED
    assert rec.is_frozen is True

    cases = ContestIntegrityService(db).evaluate_contest_integrity("wc-470")
    assert len(cases) == 0 # No alert triggered


def test_explicit_submission_930_am(db):
    """9:30 AM Submission: IN_CONTEST -> ATTENDED -> Frozen -> No Alert"""
    student, accounts = create_student_with_accounts(db, "P_0930", "Student 9:30 AM")
    submission_time = datetime.datetime(2026, 9, 6, 9, 30, 0, tzinfo=IST)
    
    classification = ContestWindowEngine.classify_activity_time(submission_time)
    assert classification == ContestActivityType.IN_CONTEST

    p_data = [{
        "student_id": student.id,
        "contest_id": "wc-470",
        "participation_mode": f"PUBLIC_{accounts[0].leetcode_username}",
        "score_display": "2 / 4",
        "in_contest_solved": 2,
        "solved_in_window": True
    }]
    ContestWindowEngine.process_and_freeze_attendance(db, "wc-470", p_data)

    rec = db.query(StudentContestParticipation).filter_by(student_id=student.id).first()
    assert rec.official_attendance_state == OfficialAttendanceState.ATTENDED
    assert rec.is_frozen is True

    cases = ContestIntegrityService(db).evaluate_contest_integrity("wc-470")
    assert len(cases) == 0


def test_explicit_submission_931_am(db):
    """9:31 AM Submission: POST_CONTEST -> MUST NOT change frozen NOT_ATTENDED to ATTENDED"""
    student, accounts = create_student_with_accounts(db, "P_0931", "Student 9:31 AM")
    submission_time = datetime.datetime(2026, 9, 6, 9, 31, 0, tzinfo=IST)
    
    classification = ContestWindowEngine.classify_activity_time(submission_time)
    assert classification == ContestActivityType.POST_CONTEST

    freeze_data = [{
        "student_id": student.id,
        "contest_id": "wc-470",
        "participation_mode": f"PUBLIC_{accounts[0].leetcode_username}",
        "score_display": "Not Attended",
        "in_contest_solved": 0,
        "is_unknown": False
    }]
    ContestWindowEngine.process_and_freeze_attendance(db, "wc-470", freeze_data)

    rec = db.query(StudentContestParticipation).filter_by(student_id=student.id).first()
    assert rec.official_attendance_state == OfficialAttendanceState.NOT_ATTENDED
    assert rec.is_frozen is True

    late_data = [{
        "student_id": student.id,
        "contest_id": "wc-470",
        "participation_mode": f"PUBLIC_{accounts[0].leetcode_username}",
        "score_display": "2 / 4",
        "in_contest_solved": 0,
        "new_solves": 2,
        "is_post_contest": True
    }]
    ContestWindowEngine.process_and_freeze_attendance(db, "wc-470", late_data)

    db.refresh(rec)
    assert rec.official_attendance_state == OfficialAttendanceState.NOT_ATTENDED
    assert rec.post_contest_solves_count == 2


def test_explicit_submission_1000_am(db):
    """10:00 AM Submission: POST_CONTEST -> Stored separately; Official attendance remains NOT_ATTENDED"""
    student, accounts = create_student_with_accounts(db, "P_1000", "Student 10:00 AM")
    submission_time = datetime.datetime(2026, 9, 6, 10, 0, 0, tzinfo=IST)
    assert ContestWindowEngine.classify_activity_time(submission_time) == ContestActivityType.POST_CONTEST

    freeze_data = [{
        "student_id": student.id,
        "contest_id": "wc-470",
        "participation_mode": f"PUBLIC_{accounts[0].leetcode_username}",
        "score_display": "Not Attended",
        "in_contest_solved": 0
    }]
    ContestWindowEngine.process_and_freeze_attendance(db, "wc-470", freeze_data)

    late_data = [{
        "student_id": student.id,
        "contest_id": "wc-470",
        "participation_mode": f"PUBLIC_{accounts[0].leetcode_username}",
        "score_display": "3 / 4",
        "in_contest_solved": 0,
        "new_solves": 3,
        "is_post_contest": True
    }]
    ContestWindowEngine.process_and_freeze_attendance(db, "wc-470", late_data)

    rec = db.query(StudentContestParticipation).filter_by(student_id=student.id).first()
    assert rec.official_attendance_state == OfficialAttendanceState.NOT_ATTENDED
    assert rec.post_contest_solves_count == 3


def test_explicit_submission_430_pm(db):
    """04:30 PM Submission: POST_CONTEST -> Stored separately; Official attendance remains NOT_ATTENDED"""
    student, accounts = create_student_with_accounts(db, "P_1630", "Student 04:30 PM")
    submission_time = datetime.datetime(2026, 9, 6, 16, 30, 0, tzinfo=IST)
    assert ContestWindowEngine.classify_activity_time(submission_time) == ContestActivityType.POST_CONTEST

    freeze_data = [{
        "student_id": student.id,
        "contest_id": "wc-470",
        "participation_mode": f"PUBLIC_{accounts[0].leetcode_username}",
        "score_display": "Not Attended",
        "in_contest_solved": 0
    }]
    ContestWindowEngine.process_and_freeze_attendance(db, "wc-470", freeze_data)

    late_data = [{
        "student_id": student.id,
        "contest_id": "wc-470",
        "participation_mode": f"PUBLIC_{accounts[0].leetcode_username}",
        "score_display": "4 / 4",
        "in_contest_solved": 0,
        "new_solves": 4,
        "is_post_contest": True
    }]
    ContestWindowEngine.process_and_freeze_attendance(db, "wc-470", late_data)

    rec = db.query(StudentContestParticipation).filter_by(student_id=student.id).first()
    assert rec.official_attendance_state == OfficialAttendanceState.NOT_ATTENDED
    assert rec.post_contest_solves_count == 4


def test_explicit_submission_820_pm(db):
    """08:20 PM Submission: POST_CONTEST -> Stored separately; Official attendance remains NOT_ATTENDED"""
    student, accounts = create_student_with_accounts(db, "P_2020", "Student 08:20 PM")
    submission_time = datetime.datetime(2026, 9, 6, 20, 20, 0, tzinfo=IST)
    assert ContestWindowEngine.classify_activity_time(submission_time) == ContestActivityType.POST_CONTEST

    freeze_data = [{
        "student_id": student.id,
        "contest_id": "wc-470",
        "participation_mode": f"PUBLIC_{accounts[0].leetcode_username}",
        "score_display": "Not Attended",
        "in_contest_solved": 0
    }]
    ContestWindowEngine.process_and_freeze_attendance(db, "wc-470", freeze_data)

    late_data = [{
        "student_id": student.id,
        "contest_id": "wc-470",
        "participation_mode": f"PUBLIC_{accounts[0].leetcode_username}",
        "score_display": "1 / 4",
        "in_contest_solved": 0,
        "new_solves": 1,
        "is_post_contest": True
    }]
    ContestWindowEngine.process_and_freeze_attendance(db, "wc-470", late_data)

    rec = db.query(StudentContestParticipation).filter_by(student_id=student.id).first()
    assert rec.official_attendance_state == OfficialAttendanceState.NOT_ATTENDED
    assert rec.post_contest_solves_count == 1


# ─────────────────────────────────────────────────────────────────────────────
# 2. DUPLICATE ACCOUNT TRUTH TABLE VERIFICATION
# ─────────────────────────────────────────────────────────────────────────────

def test_truth_table_attended_attended(db):
    """ATTENDED + ATTENDED -> NO ALERT"""
    student, accounts = create_student_with_accounts(db, "P301", "Student 301")
    db.add(StudentContestParticipation(
        student_id=student.id, contest_id="contest-500", contest_name="WC500", participation_mode=f"PUBLIC_{accounts[0].leetcode_username}",
        score_display="3 / 4", questions_solved=3, official_attendance_state="ATTENDED", source=f"leetcode_official_{accounts[0].leetcode_username}"
    ))
    db.add(StudentContestParticipation(
        student_id=student.id, contest_id="contest-500", contest_name="WC500", participation_mode=f"PUBLIC_{accounts[1].leetcode_username}",
        score_display="4 / 4", questions_solved=4, official_attendance_state="ATTENDED", source=f"leetcode_official_{accounts[1].leetcode_username}"
    ))
    db.commit()

    cases = ContestIntegrityService(db).evaluate_contest_integrity("contest-500")
    assert len(cases) == 0


def test_truth_table_attended_not_attended(db):
    """ATTENDED + NOT_ATTENDED -> NO ALERT"""
    student, accounts = create_student_with_accounts(db, "P302", "Student 302")
    db.add(StudentContestParticipation(
        student_id=student.id, contest_id="contest-500", contest_name="WC500", participation_mode=f"PUBLIC_{accounts[0].leetcode_username}",
        score_display="2 / 4", questions_solved=2, official_attendance_state="ATTENDED", source=f"leetcode_official_{accounts[0].leetcode_username}"
    ))
    db.add(StudentContestParticipation(
        student_id=student.id, contest_id="contest-500", contest_name="WC500", participation_mode=f"PUBLIC_{accounts[1].leetcode_username}",
        score_display="Not Attended", questions_solved=0, official_attendance_state="NOT_ATTENDED", source=f"leetcode_official_{accounts[1].leetcode_username}"
    ))
    db.commit()

    cases = ContestIntegrityService(db).evaluate_contest_integrity("contest-500")
    assert len(cases) == 0


def test_truth_table_not_attended_attended(db):
    """NOT_ATTENDED + ATTENDED -> NO ALERT"""
    student, accounts = create_student_with_accounts(db, "P303", "Student 303")
    db.add(StudentContestParticipation(
        student_id=student.id, contest_id="contest-500", contest_name="WC500", participation_mode=f"PUBLIC_{accounts[0].leetcode_username}",
        score_display="Not Attended", questions_solved=0, official_attendance_state="NOT_ATTENDED", source=f"leetcode_official_{accounts[0].leetcode_username}"
    ))
    db.add(StudentContestParticipation(
        student_id=student.id, contest_id="contest-500", contest_name="WC500", participation_mode=f"PUBLIC_{accounts[1].leetcode_username}",
        score_display="1 / 4", questions_solved=1, official_attendance_state="ATTENDED", source=f"leetcode_official_{accounts[1].leetcode_username}"
    ))
    db.commit()

    cases = ContestIntegrityService(db).evaluate_contest_integrity("contest-500")
    assert len(cases) == 0


@patch("backend.services.contest_integrity_service.send_email", return_value=(True, "MOCK_MSG_ID"))
@patch("backend.services.notification_service.NotificationService.send_targeted_notification", return_value={"success": True})
def test_truth_table_not_attended_not_attended_triggers_alert(mock_notif, mock_email, db):
    """NOT_ATTENDED + NOT_ATTENDED -> ALERT CREATED & NOTIFICATIONS SENT"""
    student, accounts = create_student_with_accounts(db, "P304", "Student 304")
    db.add(StudentContestParticipation(
        student_id=student.id, contest_id="contest-500", contest_name="WC500", participation_mode=f"PUBLIC_{accounts[0].leetcode_username}",
        score_display="Not Attended", questions_solved=0, official_attendance_state="NOT_ATTENDED", source=f"leetcode_official_{accounts[0].leetcode_username}"
    ))
    db.add(StudentContestParticipation(
        student_id=student.id, contest_id="contest-500", contest_name="WC500", participation_mode=f"PUBLIC_{accounts[1].leetcode_username}",
        score_display="Not Attended", questions_solved=0, official_attendance_state="NOT_ATTENDED", source=f"leetcode_official_{accounts[1].leetcode_username}"
    ))
    db.commit()

    service = ContestIntegrityService(db)
    cases = service.evaluate_contest_integrity("contest-500")
    assert len(cases) == 1
    assert cases[0]["people_id"] == "P304"
    assert cases[0]["status"] == "PENDING"

    c_rec = db.query(IntegrityCase).filter_by(case_id=cases[0]["case_id"]).first()
    assert c_rec.student_email_sent is True
    assert c_rec.staff_email_sent is True
    assert c_rec.staff_push_sent is True


def test_truth_table_unknown_not_attended(db):
    """UNKNOWN + NOT_ATTENDED -> NO ALERT"""
    student, accounts = create_student_with_accounts(db, "P305", "Student 305")
    db.add(StudentContestParticipation(
        student_id=student.id, contest_id="contest-500", contest_name="WC500", participation_mode=f"PUBLIC_{accounts[0].leetcode_username}",
        score_display="UNKNOWN", questions_solved=None, official_attendance_state="UNKNOWN", source=f"leetcode_official_{accounts[0].leetcode_username}"
    ))
    db.add(StudentContestParticipation(
        student_id=student.id, contest_id="contest-500", contest_name="WC500", participation_mode=f"PUBLIC_{accounts[1].leetcode_username}",
        score_display="Not Attended", questions_solved=0, official_attendance_state="NOT_ATTENDED", source=f"leetcode_official_{accounts[1].leetcode_username}"
    ))
    db.commit()

    cases = ContestIntegrityService(db).evaluate_contest_integrity("contest-500")
    assert len(cases) == 0


def test_truth_table_unknown_unknown(db):
    """UNKNOWN + UNKNOWN -> NO ALERT"""
    student, accounts = create_student_with_accounts(db, "P306", "Student 306")
    db.add(StudentContestParticipation(
        student_id=student.id, contest_id="contest-500", contest_name="WC500", participation_mode=f"PUBLIC_{accounts[0].leetcode_username}",
        score_display="UNKNOWN", questions_solved=None, official_attendance_state="UNKNOWN", source=f"leetcode_official_{accounts[0].leetcode_username}"
    ))
    db.add(StudentContestParticipation(
        student_id=student.id, contest_id="contest-500", contest_name="WC500", participation_mode=f"PUBLIC_{accounts[1].leetcode_username}",
        score_display="UNKNOWN", questions_solved=None, official_attendance_state="UNKNOWN", source=f"leetcode_official_{accounts[1].leetcode_username}"
    ))
    db.commit()

    cases = ContestIntegrityService(db).evaluate_contest_integrity("contest-500")
    assert len(cases) == 0


# ─────────────────────────────────────────────────────────────────────────────
# 3. IDEMPOTENCY / RETRY VERIFICATION (NO DUPLICATE NOTIFICATIONS ON RETRY)
# ─────────────────────────────────────────────────────────────────────────────

@patch("backend.services.contest_integrity_service.send_email", return_value=(True, "MOCK_MSG_ID"))
@patch("backend.services.notification_service.NotificationService.send_targeted_notification", return_value={"success": True})
def test_notification_idempotency_on_multiple_reruns(mock_notif, mock_email, db):
    """Re-running the evaluation job 3 times MUST NOT duplicate cases or notification dispatches"""
    student, accounts = create_student_with_accounts(db, "P_IDEM", "Idempotent Student")
    db.add(StudentContestParticipation(
        student_id=student.id, contest_id="contest-500", contest_name="WC500", participation_mode=f"PUBLIC_{accounts[0].leetcode_username}",
        score_display="Not Attended", questions_solved=0, official_attendance_state="NOT_ATTENDED", source=f"leetcode_official_{accounts[0].leetcode_username}"
    ))
    db.add(StudentContestParticipation(
        student_id=student.id, contest_id="contest-500", contest_name="WC500", participation_mode=f"PUBLIC_{accounts[1].leetcode_username}",
        score_display="Not Attended", questions_solved=0, official_attendance_state="NOT_ATTENDED", source=f"leetcode_official_{accounts[1].leetcode_username}"
    ))
    db.commit()

    service = ContestIntegrityService(db)
    
    # Run 1
    run1_cases = service.evaluate_contest_integrity("contest-500")
    assert len(run1_cases) == 1
    case_db_id = run1_cases[0]["case_id"]
    email_call_count_run1 = mock_email.call_count

    # Run 2 (Retry)
    run2_cases = service.evaluate_contest_integrity("contest-500")
    assert len(run2_cases) == 1
    assert run2_cases[0]["case_id"] == case_db_id
    assert mock_email.call_count == email_call_count_run1 # Zero extra email dispatches!

    # Run 3 (Retry)
    run3_cases = service.evaluate_contest_integrity("contest-500")
    assert len(run3_cases) == 1
    assert run3_cases[0]["case_id"] == case_db_id
    assert mock_email.call_count == email_call_count_run1 # Zero extra email dispatches!

    # Verify total integrity cases in DB remains exactly 1
    total_cases = db.query(IntegrityCase).filter_by(people_id="P_IDEM").count()
    assert total_cases == 1
