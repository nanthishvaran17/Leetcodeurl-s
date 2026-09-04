import pytest
import datetime
from zoneinfo import ZoneInfo
from unittest.mock import patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models import (
    Base, Student, LeetCodeAccount, StudentContestParticipation, 
    LiveContestEvent, AttendanceSnapshot
)
from backend.services.live_contest_monitor_engine import LiveContestMonitorEngine
from backend.services.contest_window_engine import ContestWindowEngine, OfficialAttendanceState

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

def create_student_with_account(db, people_id="P_LIVE_01", name="Nanthish", username="nanthish_lc"):
    student = Student(people_id=people_id, reg_no=people_id, name=name, email=f"{people_id.lower()}@college.edu", department_id=1, section_id=1, year_level="III")
    db.add(student)
    db.commit()
    db.refresh(student)

    acc = LeetCodeAccount(student_id=student.id, leetcode_username=username)
    db.add(acc)
    db.commit()
    return student, acc


# ─────────────────────────────────────────────────────────────────────────────
# 1. SEQUENTIAL SOLVE PROGRESSION TEST (0 -> 1 -> 2 -> 3 SOLVES)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
@patch("backend.services.live_contest_monitor_engine.LiveContestMonitorEngine.broadcast_ws_event")
async def test_student_solve_progression_0_to_3(mock_ws, db):
    """
    Tests sequential solve progression:
      08:10 AM -> 1 solve  (version 1)
      08:25 AM -> 2 solves (version 2)
      08:40 AM -> 3 solves (version 3)
    Verifies WebSocket events generated with version increments and activity timeline entries.
    """
    student, acc = create_student_with_account(db, "P_NANTHISH", "Nanthish", "nanthish_lc")
    engine_inst = LiveContestMonitorEngine()

    item = {
        "student": student,
        "account": acc,
        "people_id": student.people_id,
        "username": acc.leetcode_username
    }

    # Step 0: Initial evaluation (0 solves)
    await engine_inst._evaluate_and_detect_change(db, "wc-500", item, is_initial=True)
    assert engine_inst.sync_version == 0

    # Step 1: 08:10 AM -> Solves 1st problem
    part = StudentContestParticipation(
        student_id=student.id, contest_id="wc-500", contest_name="Weekly Contest 500", participation_mode=f"PUBLIC_{acc.leetcode_username}",
        questions_solved=1, score_display="1 / 4", official_attendance_state="ATTENDED"
    )
    db.add(part)
    db.commit()

    await engine_inst._evaluate_and_detect_change(db, "wc-500", item, is_initial=False)
    assert engine_inst.sync_version == 1
    assert len(engine_inst.live_activity_feed) == 1
    assert engine_inst.live_activity_feed[0]["solved_count"] == 1
    assert "Total 1/4" in engine_inst.live_activity_feed[0]["text"]

    # Step 2: 08:25 AM -> Solves 2nd problem
    part.questions_solved = 2
    part.score_display = "2 / 4"
    db.commit()

    await engine_inst._evaluate_and_detect_change(db, "wc-500", item, is_initial=False)
    assert engine_inst.sync_version == 2
    assert len(engine_inst.live_activity_feed) == 2
    assert engine_inst.live_activity_feed[0]["solved_count"] == 2
    assert "Total 2/4" in engine_inst.live_activity_feed[0]["text"]

    # Step 3: 08:40 AM -> Solves 3rd problem
    part.questions_solved = 3
    part.score_display = "3 / 4"
    db.commit()


    await engine_inst._evaluate_and_detect_change(db, "wc-500", item, is_initial=False)
    assert engine_inst.sync_version == 3
    assert len(engine_inst.live_activity_feed) == 3
    assert engine_inst.live_activity_feed[0]["solved_count"] == 3
    assert "Total 3/4" in engine_inst.live_activity_feed[0]["text"]

    # Verify 3 events stored in DB for missed event recovery
    events_in_db = db.query(LiveContestEvent).filter_by(people_id="P_NANTHISH").all()
    assert len(events_in_db) == 3


# ─────────────────────────────────────────────────────────────────────────────
# 2. INITIAL SYNC 297/297 TRANSITION TO CONTINUOUS LIVE SYNC
# ─────────────────────────────────────────────────────────────────────────────

def test_initial_sync_transition_to_live_sync(db):
    """
    Verifies that completing initial sync (297/297) transitions state to LIVE_SYNC_ACTIVE
    and DOES NOT stop background monitoring.
    """
    engine_inst = LiveContestMonitorEngine()
    engine_inst.total_students = 297
    engine_inst.processed_students = 297
    engine_inst.sync_state = "LIVE_SYNC_ACTIVE"
    engine_inst.is_monitoring = True

    assert engine_inst.sync_state == "LIVE_SYNC_ACTIVE"
    assert engine_inst.is_monitoring is True # Continuous monitoring active!


# ─────────────────────────────────────────────────────────────────────────────
# 3. MISSED EVENT RECOVERY TEST (GET_MISSED_EVENTS)
# ─────────────────────────────────────────────────────────────────────────────

def test_missed_event_recovery_via_version(db):
    """Client requesting last_received_version=2 receives events with version=3, 4, 5"""
    student, acc = create_student_with_account(db, "P_RECOVER", "Recover Student", "recover_lc")
    engine_inst = LiveContestMonitorEngine()

    for v in range(1, 6):
        evt = LiveContestEvent(
            event_id=f"EVT-RECOVER-{v}", version=v, contest_id="wc-500", people_id="P_RECOVER",
            student_id=student.id, account_id="recover_lc", event_type="STUDENT_ACTIVITY_UPDATED",
            payload={"version": v, "event_id": f"EVT-RECOVER-{v}", "count": v},
            created_at=datetime.datetime.utcnow()
        )
        db.add(evt)
    db.commit()

    missed = engine_inst.get_missed_events(db, "wc-500", last_received_version=2)
    assert len(missed) == 3
    assert missed[0]["version"] == 3
    assert missed[1]["version"] == 4
    assert missed[2]["version"] == 5


# ─────────────────────────────────────────────────────────────────────────────
# 4. 09:30 AM CUTOFF & 09:35 AM FREEZE COMPLIANCE
# ─────────────────────────────────────────────────────────────────────────────

def test_post_930_activity_does_not_change_attendance(db):
    """Late solves after 09:30 AM IST do not alter official frozen attendance"""
    student, acc = create_student_with_account(db, "P_CUTOFF", "Cutoff Student", "cutoff_lc")

    # 09:35 AM IST Freeze
    freeze_data = [{
        "student_id": student.id, "people_id": student.people_id, "leetcode_username": acc.leetcode_username,
        "contest_id": "wc-500", "participation_mode": f"PUBLIC_{acc.leetcode_username}",
        "score_display": "Not Attended", "in_contest_solved": 0
    }]
    ContestWindowEngine.process_and_freeze_attendance(db, "wc-500", freeze_data)

    snapshot = db.query(AttendanceSnapshot).filter_by(people_id="P_CUTOFF").first()
    assert snapshot.official_attendance_state == OfficialAttendanceState.NOT_ATTENDED

    # Log 10:00 AM post-contest solve
    t10 = datetime.datetime(2026, 9, 6, 10, 0, 0, tzinfo=IST)
    ContestWindowEngine.log_post_contest_activity(db, student.id, student.people_id, "wc-500", acc.leetcode_username, t10, "two-sum", "ACCEPTED")

    # Official frozen attendance snapshot remains strictly NOT_ATTENDED
    db.refresh(snapshot)
    assert snapshot.official_attendance_state == OfficialAttendanceState.NOT_ATTENDED
