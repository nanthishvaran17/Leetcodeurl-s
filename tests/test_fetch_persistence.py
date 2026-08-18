import pytest
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.models import Base, Student, LeetCodeProfileStats, SyncJob
from backend.routes.sync import get_current_sync_status
from backend.services.live_sync_service import sync_tracker, start_full_sync_job

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Seed initial student roster
    for i in range(1, 11):
        s = Student(id=i, name=f"Student {i}", reg_no=f"REG00{i}", year_level="III", department_id=1, is_active=True)
        session.add(s)
        session.flush()
        st = LeetCodeProfileStats(student_id=s.id, total_solved=100 + i, sync_status="success", last_verified_at=datetime.datetime.utcnow())
        session.add(st)
    session.commit()

    yield session
    session.close()


def test_scenario_a_persistence_after_completion_and_page_reload(db_session):
    """
    Test Scenario A:
    1. Complete fetch to 100%
    2. Simulated page reload / login / reopen
    3. Status remains COMPLETED, 100%, last sync timestamp preserved, NO new job created.
    """
    # 1. Record completed job in database
    now_utc = datetime.datetime.utcnow()
    job = SyncJob(
        job_id="SYNC-JOB-COMPLETED-001",
        job_type="FULL_SYNC",
        started_at=now_utc - datetime.timedelta(minutes=5),
        completed_at=now_utc,
        last_synced_at=now_utc,
        status="COMPLETED",
        total_records=10,
        processed_count=10,
        success_count=10,
        progress=100.0,
        triggered_by="admin"
    )
    db_session.add(job)
    db_session.commit()

    # Ensure in-memory tracker is idle (as would happen after browser reload/backend restart)
    sync_tracker.finish("COMPLETED")

    # 2. Simulate GET /sync/status or GET /fetch-status (page load / login)
    status_response = get_current_sync_status(db_session)

    # 3. Assertions
    assert status_response["is_running"] is False
    assert status_response["status"] == "COMPLETED"
    assert status_response["progress_percentage"] == 100.0
    assert status_response["total_students"] == 10
    assert status_response["students_processed"] == 10
    assert status_response["successful"] == 10
    assert status_response["last_sync_timestamp"] is not None

    # Verify no new job was created by the status query
    job_count = db_session.query(SyncJob).count()
    assert job_count == 1


def test_scenario_b_reconnect_to_running_job_without_duplicate(db_session):
    """
    Test Scenario B:
    1. Fetch is currently RUNNING
    2. User refreshes browser / reloads page
    3. Backend returns RUNNING and existing job_id without creating a second job.
    """
    job_id = "SYNC-JOB-RUNNING-002"
    now_utc = datetime.datetime.utcnow()
    job = SyncJob(
        job_id=job_id,
        job_type="FULL_SYNC",
        started_at=now_utc,
        status="RUNNING",
        total_records=10,
        processed_count=5,
        success_count=5,
        progress=50.0,
        triggered_by="admin"
    )
    db_session.add(job)
    db_session.commit()

    sync_tracker.start(job_id, 10)
    sync_tracker.students_processed = 5
    sync_tracker.successful = 5
    sync_tracker.progress_percentage = 50.0

    # User reloads page (calls GET /sync/status)
    status_response = get_current_sync_status(db_session)

    assert status_response["is_running"] is True
    assert status_response["status"] == "RUNNING"
    assert status_response["job_id"] == job_id
    assert status_response["processed"] == 5
    assert status_response["total"] == 10

    # User accidentally triggers sync while one is running
    trigger_result = start_full_sync_job(db_session, triggered_by="user_click")
    assert trigger_result["already_running"] is True
    assert trigger_result["job_id"] == job_id

    # Total jobs in DB must still be 1 (no duplicate job)
    total_jobs = db_session.query(SyncJob).count()
    assert total_jobs == 1

    # Cleanup in-memory tracker
    sync_tracker.finish("COMPLETED")


def test_scenario_c_explicit_manual_refresh_creates_new_job(db_session):
    """
    Test Scenario C:
    1. Previous job was COMPLETED
    2. User clicks 'Refresh All LeetCode Stats' explicitly
    3. New job is started without creating duplicate student records
    """
    # Pre-seed completed job
    prev_job = SyncJob(
        job_id="SYNC-JOB-OLD-003",
        job_type="FULL_SYNC",
        started_at=datetime.datetime.utcnow() - datetime.timedelta(hours=2),
        completed_at=datetime.datetime.utcnow() - datetime.timedelta(hours=2),
        status="COMPLETED",
        total_records=10,
        processed_count=10,
        success_count=10,
        progress=100.0,
        triggered_by="admin"
    )
    db_session.add(prev_job)
    db_session.commit()
    sync_tracker.finish("COMPLETED")

    # Explicit manual trigger
    new_job_res = start_full_sync_job(db_session, triggered_by="manual_refresh_button")
    assert new_job_res["success"] is True
    assert new_job_res["status"] == "RUNNING"
    assert new_job_res["job_id"] != "SYNC-JOB-OLD-003"

    # Total jobs is now 2 (old completed + new running)
    total_jobs = db_session.query(SyncJob).count()
    assert total_jobs == 2

    # Student count must remain exactly 10 (no duplicate student entries created)
    student_count = db_session.query(Student).count()
    assert student_count == 10

    # Cleanup in-memory tracker
    sync_tracker.finish("COMPLETED")
