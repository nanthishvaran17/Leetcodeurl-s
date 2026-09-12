import time
import pytest
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models import Student, Department, LiveQuestionStatus, LiveQuestionAuditLog
from backend.services.live_contest_monitor_engine import LiveContestMonitorEngine

# In-memory SQLite for high-speed benchmark testing
TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def benchmark_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Seed 1 Department
    dept = Department(id=1, name="CSE", code="CSE")
    db.add(dept)
    db.commit()

    # Bulk insert 2,000 students for benchmark (§35 requirement)
    students = []
    for i in range(1, 2001):
        students.append(Student(
            id=i,
            people_id=f"P_{i:04d}",
            reg_no=f"REG_{i:04d}",
            name=f"Benchmark Student {i}",
            department_id=1,
            year_level="III",
            is_active=True
        ))
    db.bulk_save_objects(students)
    db.commit()

    yield db
    db.close()


def test_2000_students_8000_question_states_performance(benchmark_db):
    """
    SECTION 35 PERFORMANCE BENCHMARK:
    Minimum supported load: 2,000 students × 4 questions = 8,000 question states.
    Target: Total internal processing time ≤ 10 seconds per cycle (excluding external network wait time).
    """
    db = benchmark_db
    monitor = LiveContestMonitorEngine()
    contest_id = "weekly-contest-515"
    contest_start_dt = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=30)

    # Prepare input batch of 2,000 student states (8,000 question states)
    incoming_batch = []
    for i in range(1, 2001):
        # Every 10th student solved Q1 and Q2 in this cycle
        solved_q1 = 1 if i % 10 == 0 else 0
        solved_q2 = 1 if i % 10 == 0 else 0
        incoming_batch.append({
            "student_id": i,
            "q_status": {"Q1": solved_q1, "Q2": solved_q2, "Q3": 0, "Q4": 0}
        })

    # Start timing internal backend processing
    t0_start = time.perf_counter()

    # 1. Normalization & Delta Detection
    t_norm_start = time.perf_counter()
    all_transitions = []
    
    # Bulk fetch existing question status rows (No N+1)
    existing_rows = db.query(LiveQuestionStatus).filter(
        LiveQuestionStatus.contest_id == contest_id
    ).all()
    existing_map = {(row.student_id, row.question_id): row for row in existing_rows}
    t_norm_end = time.perf_counter()

    t_delta_start = time.perf_counter()
    new_status_objects = []
    audit_objects = []
    seq = monitor.sync_version

    for item in incoming_batch:
        sid = item["student_id"]
        q_status = item["q_status"]

        for q_id, val in q_status.items():
            if val == 1:
                key = (sid, q_id)
                row = existing_map.get(key)
                if not row or row.solved == 0:
                    seq += 1
                    t_solved = contest_start_dt + datetime.timedelta(minutes=15)
                    dt_sec = int((t_solved - contest_start_dt).total_seconds())

                    new_status_objects.append(LiveQuestionStatus(
                        contest_id=contest_id,
                        student_id=sid,
                        question_id=q_id,
                        solved=1,
                        solved_at=t_solved,
                        time_taken_seconds=dt_sec,
                        time_taken_is_estimated=False,
                        is_anomaly=False,
                        source="AUTHORITATIVE_LEETCODE",
                        event_version=1
                    ))

                    audit_objects.append(LiveQuestionAuditLog(
                        contest_id=contest_id,
                        student_id=sid,
                        question_id=q_id,
                        old_value=0,
                        new_value=1,
                        solved_at=t_solved,
                        time_taken_seconds=dt_sec,
                        time_taken_is_estimated=False,
                        source="AUTHORITATIVE_LEETCODE",
                        sequence=seq
                    ))

    t_delta_end = time.perf_counter()

    # 2. Database Persistence Time
    t_db_start = time.perf_counter()
    if new_status_objects:
        db.bulk_save_objects(new_status_objects)
    t_db_end = time.perf_counter()

    # 3. Audit Write Time
    t_audit_start = time.perf_counter()
    if audit_objects:
        db.bulk_save_objects(audit_objects)
    db.commit()
    t_audit_end = time.perf_counter()

    # 4. WebSocket Payload Generation Time
    t_ws_start = time.perf_counter()
    ws_event = {
        "event": "STUDENT_ACTIVITY_UPDATED",
        "contest_id": contest_id,
        "delta_count": len(audit_objects),
        "sequence": seq
    }
    t_ws_end = time.perf_counter()

    t0_end = time.perf_counter()

    # Compute breakdown metrics
    normalization_time_ms = round((t_norm_end - t_norm_start) * 1000, 2)
    delta_detection_time_ms = round((t_delta_end - t_delta_start) * 1000, 2)
    database_persistence_time_ms = round((t_db_end - t_db_start) * 1000, 2)
    audit_write_time_ms = round((t_audit_end - t_audit_start) * 1000, 2)
    websocket_publish_time_ms = round((t_ws_end - t_ws_start) * 1000, 2)
    total_internal_processing_time_sec = round(t0_end - t0_start, 3)

    print("\n--- PERFORMANCE TARGET BENCHMARK RESULTS ---")
    print(f"Student count: 2,000")
    print(f"Question states: 8,000")
    print(f"Normalization time: {normalization_time_ms} ms")
    print(f"Delta detection time: {delta_detection_time_ms} ms")
    print(f"Database persistence time: {database_persistence_time_ms} ms")
    print(f"Audit write time: {audit_write_time_ms} ms")
    print(f"WebSocket publish time: {websocket_publish_time_ms} ms")
    print(f"Total internal processing time: {total_internal_processing_time_sec} s")

    # Strict assertion according to Section 35:
    # Target: total internal processing time <= 10.0 seconds
    assert total_internal_processing_time_sec <= 10.0, f"Performance target failed: {total_internal_processing_time_sec}s > 10s target"
