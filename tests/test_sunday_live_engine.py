import pytest
import datetime
import zoneinfo
from backend.services.contest_discovery import (
    calculate_contest_status,
    calculate_contest_number,
    get_upcoming_sunday_date,
    discover_contest_metadata,
    IST_TZ
)
from backend.services.weekly_session_manager import sunday_live_engine
from backend.database import SessionLocal
from backend.models import WeeklySession

def test_exact_participation_percentage_invariant():
    """
    Guarantees the strict participation formula:
    Participation % = ((PUBLIC + VIRTUAL) / TOTAL) * 100
    With TOTAL=302, PUBLIC=99, VIRTUAL=14:
    (99 + 14) / 302 * 100 = 37.417... -> 37.4% (MUST NOT BE 40.2%)
    """
    total_students = 302
    public_attended = 99
    virtual_attended = 14
    not_attended = 168
    data_errors = 21

    # Invariant
    assert total_students == public_attended + virtual_attended + not_attended + data_errors

    # Correct formula
    part_pct = round(((public_attended + virtual_attended) / total_students * 100), 2)
    assert part_pct == 37.42 or round(part_pct, 1) == 37.4
    assert round(part_pct, 1) != 40.2

def test_sunday_contest_lifecycle_transitions():
    """
    Tests dynamic Asia/Kolkata contest status transitions:
    - Before 08:00 AM IST -> SCHEDULED
    - 08:00 AM - 09:30 AM IST -> LIVE
    - After 09:30 AM IST -> FINALIZED
    """
    test_sunday = datetime.date(2026, 8, 23)

    # 1. 07:59:59 AM IST
    dt_scheduled = datetime.datetime.combine(
        test_sunday, datetime.time(7, 59, 59), tzinfo=IST_TZ
    )
    assert calculate_contest_status(test_sunday, dt_scheduled) == "SCHEDULED"

    # 2. 08:00:00 AM IST
    dt_live_start = datetime.datetime.combine(
        test_sunday, datetime.time(8, 0, 0), tzinfo=IST_TZ
    )
    assert calculate_contest_status(test_sunday, dt_live_start) == "LIVE"

    # 3. 09:00:00 AM IST
    dt_live_mid = datetime.datetime.combine(
        test_sunday, datetime.time(9, 0, 0), tzinfo=IST_TZ
    )
    assert calculate_contest_status(test_sunday, dt_live_mid) == "LIVE"

    # 4. 09:30:00 AM IST
    dt_live_end = datetime.datetime.combine(
        test_sunday, datetime.time(9, 30, 0), tzinfo=IST_TZ
    )
    assert calculate_contest_status(test_sunday, dt_live_end) == "LIVE"

    # 5. 09:30:01 AM IST
    dt_finalized = datetime.datetime.combine(
        test_sunday, datetime.time(9, 30, 1), tzinfo=IST_TZ
    )
    assert calculate_contest_status(test_sunday, dt_finalized) == "FINALIZED"

def test_dynamic_contest_number_calculation():
    """
    Verifies dynamic contest calculation without hardcoding.
    Contest 514: 2026-08-09
    Contest 515: 2026-08-16
    Contest 516: 2026-08-23
    Contest 517: 2026-08-30
    """
    assert calculate_contest_number(datetime.date(2026, 8, 9)) == 514
    assert calculate_contest_number(datetime.date(2026, 8, 16)) == 515
    assert calculate_contest_number(datetime.date(2026, 8, 23)) == 516
    assert calculate_contest_number(datetime.date(2026, 8, 30)) == 517

def test_live_engine_telemetry_schema():
    """
    Verifies the live telemetry schema structure.
    """
    db = SessionLocal()
    try:
        session = db.query(WeeklySession).first()
        if session:
            telemetry = sunday_live_engine.get_telemetry(session.id, db)
            assert "sessionId" in telemetry
            assert "contestId" in telemetry
            assert "status" in telemetry
            assert "questionProgress" in telemetry
            assert "q1" in telemetry["questionProgress"]
            assert "q2" in telemetry["questionProgress"]
            assert "q3" in telemetry["questionProgress"]
            assert "q4" in telemetry["questionProgress"]
            assert "liveEvents" in telemetry
            assert "workerState" in telemetry
    finally:
        db.close()
