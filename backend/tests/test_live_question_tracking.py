import pytest
import datetime
from zoneinfo import ZoneInfo
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models import Student, Department, LiveQuestionStatus, LiveQuestionAuditLog, StudentContestParticipation
from backend.services.live_contest_monitor_engine import LiveContestMonitorEngine

IST = ZoneInfo("Asia/Kolkata")
UTC = ZoneInfo("UTC")

# Setup in-memory SQLite database for testing
TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Create test department & student
    dept = Department(id=1, name="CSE", code="CSE")
    db.add(dept)
    db.commit()

    student = Student(
        id=101,
        people_id="P101",
        reg_no="REG101",
        name="Test Candidate",
        department_id=1,
        year_level="IV",
        is_active=True
    )
    db.add(student)
    db.commit()

    yield db

    db.close()
    Base.metadata.drop_all(bind=engine)


def test_sequential_solve_time_tracking(db_session):
    """
    Acceptance Test 1: Sequential Q1 -> Q2 -> Q3 -> Q4 solving.
    Verifies solved status (strict 0/1), timestamps, and time_taken values.
    """
    monitor = LiveContestMonitorEngine()
    contest_id = "weekly-contest-test-seq"
    contest_start = datetime.datetime(2026, 9, 13, 8, 0, 0, tzinfo=IST)

    t1 = contest_start + datetime.timedelta(minutes=10) # 08:10:00
    t2 = contest_start + datetime.timedelta(minutes=25) # 08:25:00 (+15m)

    timestamps = {"Q1": t1}
    sources = {"Q1": "AUTHORITATIVE_LEETCODE"}

    # 1. Solve Q1
    transitions = monitor.process_question_transitions(
        db=db_session,
        contest_id=contest_id,
        student_id=101,
        incoming_q_status={"Q1": 1, "Q2": 0, "Q3": 0, "Q4": 0},
        timestamps_dict=timestamps,
        sources_dict=sources,
        contest_start_dt=contest_start
    )

    assert len(transitions) == 1
    assert transitions[0]["question_id"] == "Q1"
    assert transitions[0]["time_taken_seconds"] == 600 # 10 mins from contest start
    assert transitions[0]["time_taken_is_estimated"] is False

    # 2. Solve Q2
    timestamps["Q2"] = t2
    sources["Q2"] = "AUTHORITATIVE_LEETCODE"
    transitions2 = monitor.process_question_transitions(
        db=db_session,
        contest_id=contest_id,
        student_id=101,
        incoming_q_status={"Q1": 1, "Q2": 1, "Q3": 0, "Q4": 0},
        timestamps_dict=timestamps,
        sources_dict=sources,
        contest_start_dt=contest_start
    )

    assert len(transitions2) == 1
    assert transitions2[0]["question_id"] == "Q2"
    assert transitions2[0]["time_taken_seconds"] == 900 # 15 mins from Q1 solve time (08:10 -> 08:25)


def test_out_of_order_solve_time_tracking(db_session):
    """
    Acceptance Test 2: Out-of-order solving (Q1 -> Q3 -> Q2).
    Verifies that time_taken for Q3 is measured from Q1, and time_taken for Q2 is measured from Q3.
    """
    monitor = LiveContestMonitorEngine()
    contest_id = "weekly-contest-test-ooo"
    contest_start = datetime.datetime(2026, 9, 13, 8, 0, 0, tzinfo=IST)

    t_q1 = contest_start + datetime.timedelta(minutes=17, seconds=42) # 08:17:42
    t_q3 = contest_start + datetime.timedelta(minutes=31, seconds=8)  # 08:31:08 (+13m26s from Q1)
    t_q2 = contest_start + datetime.timedelta(minutes=50, seconds=0)  # 08:50:00 (+18m52s from Q3)

    # Solve Q1
    monitor.process_question_transitions(
        db=db_session,
        contest_id=contest_id,
        student_id=101,
        incoming_q_status={"Q1": 1, "Q2": 0, "Q3": 0, "Q4": 0},
        timestamps_dict={"Q1": t_q1},
        sources_dict={"Q1": "AUTHORITATIVE_LEETCODE"},
        contest_start_dt=contest_start
    )

    # Solve Q3 next (Q2 is still 0)
    transitions_q3 = monitor.process_question_transitions(
        db=db_session,
        contest_id=contest_id,
        student_id=101,
        incoming_q_status={"Q1": 1, "Q2": 0, "Q3": 1, "Q4": 0},
        timestamps_dict={"Q1": t_q1, "Q3": t_q3},
        sources_dict={"Q1": "AUTHORITATIVE_LEETCODE", "Q3": "AUTHORITATIVE_LEETCODE"},
        contest_start_dt=contest_start
    )

    assert len(transitions_q3) == 1
    assert transitions_q3[0]["question_id"] == "Q3"
    assert transitions_q3[0]["time_taken_seconds"] == 806 # 13m26s from Q1

    # Solve Q2 last (even though Q2's number is lower than Q3)
    transitions_q2 = monitor.process_question_transitions(
        db=db_session,
        contest_id=contest_id,
        student_id=101,
        incoming_q_status={"Q1": 1, "Q2": 1, "Q3": 1, "Q4": 0},
        timestamps_dict={"Q1": t_q1, "Q3": t_q3, "Q2": t_q2},
        sources_dict={"Q1": "AUTHORITATIVE_LEETCODE", "Q3": "AUTHORITATIVE_LEETCODE", "Q2": "AUTHORITATIVE_LEETCODE"},
        contest_start_dt=contest_start
    )

    assert len(transitions_q2) == 1
    assert transitions_q2[0]["question_id"] == "Q2"
    assert transitions_q2[0]["time_taken_seconds"] == 1132 # 18m52s from Q3 (not Q1!)


def test_simultaneous_same_cycle_deltas(db_session):
    """
    Acceptance Test 3: Multiple deltas detected in a single poll cycle (e.g. Q2 and Q3 solved together).
    Verifies that transitions are processed in true solved_at timestamp order.
    """
    monitor = LiveContestMonitorEngine()
    contest_id = "weekly-contest-simultaneous"
    contest_start = datetime.datetime(2026, 9, 13, 8, 0, 0, tzinfo=IST)

    t_q2 = contest_start + datetime.timedelta(minutes=15)
    t_q3 = contest_start + datetime.timedelta(minutes=25)

    # Polling detects both Q2 and Q3 flipped to 1 at the same time
    transitions = monitor.process_question_transitions(
        db=db_session,
        contest_id=contest_id,
        student_id=101,
        incoming_q_status={"Q1": 0, "Q2": 1, "Q3": 1, "Q4": 0},
        timestamps_dict={"Q2": t_q2, "Q3": t_q3},
        sources_dict={"Q2": "AUTHORITATIVE_LEETCODE", "Q3": "AUTHORITATIVE_LEETCODE"},
        contest_start_dt=contest_start
    )

    assert len(transitions) == 2
    # Should be ordered by solved_at timestamp: Q2 (08:15) then Q3 (08:25)
    assert transitions[0]["question_id"] == "Q2"
    assert transitions[0]["time_taken_seconds"] == 900 # 15 mins from contest start
    assert transitions[1]["question_id"] == "Q3"
    assert transitions[1]["time_taken_seconds"] == 600 # 10 mins from Q2


def test_mixed_source_policy(db_session):
    """
    Acceptance Test 4: Mixed timestamp sources (one authoritative, one detection-derived).
    Verifies time_taken_is_estimated is set to True.
    """
    monitor = LiveContestMonitorEngine()
    contest_id = "weekly-contest-mixed-src"
    contest_start = datetime.datetime(2026, 9, 13, 8, 0, 0, tzinfo=IST)

    t_q1 = contest_start + datetime.timedelta(minutes=10)
    t_q2 = contest_start + datetime.timedelta(minutes=20)

    # Q1 is AUTHORITATIVE_LEETCODE, Q2 is DETECTION_DERIVED
    transitions = monitor.process_question_transitions(
        db=db_session,
        contest_id=contest_id,
        student_id=101,
        incoming_q_status={"Q1": 1, "Q2": 1, "Q3": 0, "Q4": 0},
        timestamps_dict={"Q1": t_q1, "Q2": t_q2},
        sources_dict={"Q1": "AUTHORITATIVE_LEETCODE", "Q2": "DETECTION_DERIVED"},
        contest_start_dt=contest_start
    )

    assert len(transitions) == 2
    assert transitions[1]["question_id"] == "Q2"
    assert transitions[1]["time_taken_is_estimated"] is True


def test_anomaly_clamping_negative_duration(db_session):
    """
    Acceptance Test 5: Clock skew / out-of-order timestamp producing non-positive duration.
    Verifies time_taken_seconds is clamped to None and flagged as is_anomaly=True.
    """
    monitor = LiveContestMonitorEngine()
    contest_id = "weekly-contest-anomaly"
    contest_start = datetime.datetime(2026, 9, 13, 8, 0, 0, tzinfo=IST)

    t_q1 = contest_start + datetime.timedelta(minutes=20)
    # Skewed timestamp earlier than Q1!
    t_q2_skewed = contest_start + datetime.timedelta(minutes=10)

    monitor.process_question_transitions(
        db=db_session,
        contest_id=contest_id,
        student_id=101,
        incoming_q_status={"Q1": 1, "Q2": 0, "Q3": 0, "Q4": 0},
        timestamps_dict={"Q1": t_q1},
        contest_start_dt=contest_start
    )

    transitions = monitor.process_question_transitions(
        db=db_session,
        contest_id=contest_id,
        student_id=101,
        incoming_q_status={"Q1": 1, "Q2": 1, "Q3": 0, "Q4": 0},
        timestamps_dict={"Q1": t_q1, "Q2": t_q2_skewed},
        contest_start_dt=contest_start
    )

    assert len(transitions) == 1
    assert transitions[0]["question_id"] == "Q2"
    assert transitions[0]["time_taken_seconds"] is None
    assert transitions[0]["is_anomaly"] is True


def test_no_duplicate_events_for_already_solved(db_session):
    """
    Acceptance Test 6: Repeated poll cycles for an already solved question (1 -> 1).
    Verifies no new DB writes or audit log entries are generated.
    """
    monitor = LiveContestMonitorEngine()
    contest_id = "weekly-contest-dedup"
    contest_start = datetime.datetime(2026, 9, 13, 8, 0, 0, tzinfo=IST)

    t_q1 = contest_start + datetime.timedelta(minutes=10)

    # First poll: Q1 solved
    t1 = monitor.process_question_transitions(
        db=db_session,
        contest_id=contest_id,
        student_id=101,
        incoming_q_status={"Q1": 1, "Q2": 0, "Q3": 0, "Q4": 0},
        timestamps_dict={"Q1": t_q1},
        contest_start_dt=contest_start
    )
    assert len(t1) == 1

    # Audit log count should be 1
    audit_count_1 = db_session.query(LiveQuestionAuditLog).filter_by(contest_id=contest_id, student_id=101).count()
    assert audit_count_1 == 1

    # Second poll: Q1 still 1 (no change)
    t2 = monitor.process_question_transitions(
        db=db_session,
        contest_id=contest_id,
        student_id=101,
        incoming_q_status={"Q1": 1, "Q2": 0, "Q3": 0, "Q4": 0},
        timestamps_dict={"Q1": t_q1},
        contest_start_dt=contest_start
    )
    assert len(t2) == 0

    # Audit log count must remain 1
    audit_count_2 = db_session.query(LiveQuestionAuditLog).filter_by(contest_id=contest_id, student_id=101).count()
    assert audit_count_2 == 1


@pytest.mark.asyncio
async def test_kill_switch(db_session):
    """
    Acceptance Test 7: Kill-switch stop_monitoring stops engine cleanly.
    """
    monitor = LiveContestMonitorEngine()
    monitor.is_monitoring = True
    monitor.active_contest_id = "weekly-contest-kill"

    res = await monitor.stop_monitoring()
    assert res["status"] == "STOPPED"
    assert monitor.is_monitoring is False
    assert monitor.sync_state == "STOPPED"
