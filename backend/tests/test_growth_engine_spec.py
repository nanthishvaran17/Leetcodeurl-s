import pytest
import datetime
from zoneinfo import ZoneInfo
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models import Base, Student, StudentStatSnapshot, Department, User
from backend.routes.history import _derived_growth, _growth_cutoff

IST = ZoneInfo("Asia/Kolkata")
UTC = datetime.timezone.utc

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

def create_student(db, student_id=1, name="Test Student", reg_no=None, dept_id=None, year_level="III"):
    if not reg_no:
        reg_no = f"REG{student_id:03d}"
    if not dept_id:
        dept = db.query(Department).filter(Department.code == "CSE").first()
        if not dept:
            dept = Department(id=100, name="Computer Science", code="CSE")
            db.add(dept)
            db.commit()
        dept_id = dept.id
        
    student = Student(
        id=student_id,
        name=name,
        reg_no=reg_no,
        username=f"user_{student_id}",
        department_id=dept_id,
        year_level=year_level,
        is_active=True
    )
    db.add(student)
    db.commit()
    return student

def create_snap(db, student_id, total, easy, medium, hard, rating=1500.0, captured_at=None, source="sync", is_verified=True):
    snap = StudentStatSnapshot(
        student_id=student_id,
        total_solved=total,
        easy_solved=easy,
        medium_solved=medium,
        hard_solved=hard,
        contest_rating=rating,
        captured_at=captured_at,
        source=source,
        is_verified=is_verified
    )
    db.add(snap)
    db.commit()
    return snap

# Injected clock date: Oct 8, 2026 10:00 IST
NOW_IST = datetime.datetime(2026, 10, 8, 10, 0, 0, tzinfo=IST)
NOW_UTC = NOW_IST.astimezone(UTC)

def test_1_today_valid_baseline(db_session):
    s = create_student(db_session, 1)
    oct7_2300 = datetime.datetime(2026, 10, 7, 23, 0, 0, tzinfo=IST).astimezone(UTC)
    oct8_0900 = datetime.datetime(2026, 10, 8, 9, 0, 0, tzinfo=IST).astimezone(UTC)
    
    create_snap(db_session, 1, 10, 5, 4, 1, captured_at=oct7_2300)
    create_snap(db_session, 1, 15, 7, 6, 2, captured_at=oct8_0900)
    
    cutoff = datetime.datetime(2026, 10, 8, 0, 0, 0, tzinfo=IST).astimezone(UTC)
    res = _derived_growth(db_session, [s], cutoff, period="today")
    assert res[1]["growth_status"] == "VERIFIED"
    assert res[1]["delta_total"] == 5
    assert res[1]["delta_easy"] == 2
    assert res[1]["delta_medium"] == 2
    assert res[1]["delta_hard"] == 1

def test_1_today_stale_baseline_returns_unknown(db_session):
    s = create_student(db_session, 1)
    # Baseline from Sept 30 (more than 36h before Oct 8 00:00 IST cutoff)
    sep30_1830 = datetime.datetime(2026, 9, 30, 18, 30, 0, tzinfo=UTC)
    oct8_0900 = datetime.datetime(2026, 10, 8, 9, 0, 0, tzinfo=IST).astimezone(UTC)
    
    create_snap(db_session, 1, 10, 5, 4, 1, captured_at=sep30_1830)
    create_snap(db_session, 1, 15, 7, 6, 2, captured_at=oct8_0900)
    
    cutoff = datetime.datetime(2026, 10, 8, 0, 0, 0, tzinfo=IST).astimezone(UTC)
    res = _derived_growth(db_session, [s], cutoff, period="today")
    # Must be UNKNOWN because baseline is >36h older than today's cutoff!
    assert res[1]["growth_status"] == "UNKNOWN"
    assert res[1]["delta_total"] is None

def test_2_today_only_current(db_session):
    s = create_student(db_session, 1)
    oct8_0800 = datetime.datetime(2026, 10, 8, 8, 0, 0, tzinfo=IST).astimezone(UTC)
    create_snap(db_session, 1, 15, 7, 6, 2, captured_at=oct8_0800)
    
    cutoff = datetime.datetime(2026, 10, 8, 0, 0, 0, tzinfo=IST).astimezone(UTC)
    res = _derived_growth(db_session, [s], cutoff, period="today")
    assert res[1]["growth_status"] == "UNKNOWN"
    assert res[1]["delta_total"] is None

def test_3_7d_exact_baseline(db_session):
    s = create_student(db_session, 1)
    oct2_0000 = datetime.datetime(2026, 10, 2, 0, 0, 0, tzinfo=IST).astimezone(UTC)
    oct8_0900 = datetime.datetime(2026, 10, 8, 9, 0, 0, tzinfo=IST).astimezone(UTC)
    
    create_snap(db_session, 1, 10, 5, 4, 1, captured_at=oct2_0000)
    create_snap(db_session, 1, 20, 10, 8, 2, captured_at=oct8_0900)
    
    cutoff = oct2_0000
    res = _derived_growth(db_session, [s], cutoff, period="7d")
    assert res[1]["growth_status"] == "VERIFIED"
    assert res[1]["delta_total"] == 10

def test_4_7d_earlier_baseline(db_session):
    s = create_student(db_session, 1)
    oct1_1200 = datetime.datetime(2026, 10, 1, 12, 0, 0, tzinfo=IST).astimezone(UTC)
    
    create_snap(db_session, 1, 10, 5, 4, 1, captured_at=oct1_1200)
    create_snap(db_session, 1, 20, 10, 8, 2, captured_at=NOW_UTC)
    
    cutoff = datetime.datetime(2026, 10, 2, 0, 0, 0, tzinfo=IST).astimezone(UTC)
    res = _derived_growth(db_session, [s], cutoff, period="7d", now_utc=NOW_UTC)
    assert res[1]["growth_status"] == "VERIFIED"
    assert res[1]["delta_total"] == 10

def test_7d_47h_valid_baseline(db_session):
    s = create_student(db_session, 1)
    cutoff = datetime.datetime(2026, 10, 2, 0, 0, 0, tzinfo=IST).astimezone(UTC)
    b_47h = cutoff - datetime.timedelta(hours=47)
    
    create_snap(db_session, 1, 10, 5, 4, 1, captured_at=b_47h)
    create_snap(db_session, 1, 20, 10, 8, 2, captured_at=NOW_UTC)
    
    res = _derived_growth(db_session, [s], cutoff, period="7d", now_utc=NOW_UTC)
    assert res[1]["growth_status"] == "VERIFIED"

def test_7d_49h_stale_baseline(db_session):
    s = create_student(db_session, 1)
    cutoff = datetime.datetime(2026, 10, 2, 0, 0, 0, tzinfo=IST).astimezone(UTC)
    b_49h = cutoff - datetime.timedelta(hours=49)
    
    create_snap(db_session, 1, 10, 5, 4, 1, captured_at=b_49h)
    create_snap(db_session, 1, 20, 10, 8, 2, captured_at=NOW_UTC)
    
    res = _derived_growth(db_session, [s], cutoff, period="7d", now_utc=NOW_UTC)
    assert res[1]["growth_status"] == "UNKNOWN"

def test_stale_current_snapshot_returns_unknown(db_session):
    s = create_student(db_session, 1)
    cutoff = datetime.datetime(2026, 10, 2, 0, 0, 0, tzinfo=IST).astimezone(UTC)
    b_24h = cutoff - datetime.timedelta(hours=24)
    stale_current = NOW_UTC - datetime.timedelta(hours=50) # > 48h old relative to NOW_UTC
    
    create_snap(db_session, 1, 10, 5, 4, 1, captured_at=b_24h)
    create_snap(db_session, 1, 20, 10, 8, 2, captured_at=stale_current)
    
    res = _derived_growth(db_session, [s], cutoff, period="7d", now_utc=NOW_UTC)
    assert res[1]["growth_status"] == "UNKNOWN"

def test_5_7d_no_baseline_before(db_session):
    s = create_student(db_session, 1)
    oct8_0900 = datetime.datetime(2026, 10, 8, 9, 0, 0, tzinfo=IST).astimezone(UTC)
    create_snap(db_session, 1, 20, 10, 8, 2, captured_at=oct8_0900)
    
    cutoff = datetime.datetime(2026, 10, 2, 0, 0, 0, tzinfo=IST).astimezone(UTC)
    res = _derived_growth(db_session, [s], cutoff, period="7d")
    assert res[1]["growth_status"] == "UNKNOWN"

def test_6_7d_baseline_after_cutoff_invalid(db_session):
    s = create_student(db_session, 1)
    oct4_1200 = datetime.datetime(2026, 10, 4, 12, 0, 0, tzinfo=IST).astimezone(UTC)
    oct8_0900 = datetime.datetime(2026, 10, 8, 9, 0, 0, tzinfo=IST).astimezone(UTC)
    
    create_snap(db_session, 1, 10, 5, 4, 1, captured_at=oct4_1200)
    create_snap(db_session, 1, 20, 10, 8, 2, captured_at=oct8_0900)
    
    cutoff = datetime.datetime(2026, 10, 2, 0, 0, 0, tzinfo=IST).astimezone(UTC)
    res = _derived_growth(db_session, [s], cutoff, period="7d")
    assert res[1]["growth_status"] == "UNKNOWN"

def test_8_negative_delta_conflict(db_session):
    s = create_student(db_session, 1)
    oct1_1200 = datetime.datetime(2026, 10, 1, 12, 0, 0, tzinfo=IST).astimezone(UTC)
    oct8_0900 = datetime.datetime(2026, 10, 8, 9, 0, 0, tzinfo=IST).astimezone(UTC)
    
    create_snap(db_session, 1, 10, 5, 4, 1, captured_at=oct1_1200)
    create_snap(db_session, 1, 9, 5, 4, 0, captured_at=oct8_0900)
    
    cutoff = datetime.datetime(2026, 10, 2, 0, 0, 0, tzinfo=IST).astimezone(UTC)
    res = _derived_growth(db_session, [s], cutoff, period="7d")
    assert res[1]["growth_status"] == "CONFLICT"
    assert res[1]["conflict_reason"] == "negative_delta:hard"

def test_9_reconciliation_conflict(db_session):
    s = create_student(db_session, 1)
    oct1_1200 = datetime.datetime(2026, 10, 1, 12, 0, 0, tzinfo=IST).astimezone(UTC)
    oct8_0900 = datetime.datetime(2026, 10, 8, 9, 0, 0, tzinfo=IST).astimezone(UTC)
    
    create_snap(db_session, 1, 10, 5, 4, 1, captured_at=oct1_1200)
    create_snap(db_session, 1, 20, 10, 8, 1, captured_at=oct8_0900)
    
    cutoff = datetime.datetime(2026, 10, 2, 0, 0, 0, tzinfo=IST).astimezone(UTC)
    res = _derived_growth(db_session, [s], cutoff, period="7d")
    assert res[1]["growth_status"] == "CONFLICT"
    assert res[1]["conflict_reason"] == "reconciliation:current"

def test_14_boundary_precision(db_session):
    s = create_student(db_session, 1)
    oct1_2359 = datetime.datetime(2026, 10, 1, 23, 59, 59, tzinfo=IST).astimezone(UTC)
    oct8_0900 = datetime.datetime(2026, 10, 8, 9, 0, 0, tzinfo=IST).astimezone(UTC)
    
    create_snap(db_session, 1, 10, 5, 4, 1, captured_at=oct1_2359)
    create_snap(db_session, 1, 20, 10, 8, 2, captured_at=oct8_0900)
    
    cutoff = datetime.datetime(2026, 10, 2, 0, 0, 0, tzinfo=IST).astimezone(UTC)
    res = _derived_growth(db_session, [s], cutoff, period="7d")
    assert res[1]["growth_status"] == "VERIFIED"

def test_15_16_period_all(db_session):
    s1 = create_student(db_session, 1)
    s2 = create_student(db_session, 2)
    oct8_0900 = datetime.datetime(2026, 10, 8, 9, 0, 0, tzinfo=IST).astimezone(UTC)
    create_snap(db_session, 1, 20, 10, 8, 2, captured_at=oct8_0900)
    
    res = _derived_growth(db_session, [s1, s2], None, period="all")
    assert res[1]["current_status"] == "VERIFIED"
    assert res[1]["total_solved"] == 20
    assert res[2]["current_status"] == "UNKNOWN"
    assert res[2]["total_solved"] is None

def test_18_19_source_eligibility(db_session):
    s = create_student(db_session, 1)
    oct1_1200 = datetime.datetime(2026, 10, 1, 12, 0, 0, tzinfo=IST).astimezone(UTC)
    oct8_0900 = datetime.datetime(2026, 10, 8, 9, 0, 0, tzinfo=IST).astimezone(UTC)
    
    create_snap(db_session, 1, 10, 5, 4, 1, captured_at=oct1_1200, source="on_demand", is_verified=False)
    create_snap(db_session, 1, 20, 10, 8, 2, captured_at=oct8_0900, source="sync", is_verified=True)
    
    cutoff = datetime.datetime(2026, 10, 2, 0, 0, 0, tzinfo=IST).astimezone(UTC)
    res = _derived_growth(db_session, [s], cutoff, period="7d")
    assert res[1]["growth_status"] == "UNKNOWN"
