from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models import Student, Department, WeeklySession, WeeklyPublicResult
from backend.services.historical_resync_engine import (
    compute_verification_score,
    compute_student_contest_hash,
    HistoricalResyncAndAccuracyEngine,
    HISTORICAL_CONTESTS_510_515
)

@pytest.fixture
def resync_db():
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = Session()

    dept = Department(id=1, code="CSE(CS)", name="Computer Science and Engineering (Cyber Security)")
    session.add(dept)

    # Seed 10 sample students
    for i in range(1, 11):
        st = Student(
            id=i,
            reg_no=f"732224CC{i:03d}",
            name=f"STUDENT {i}",
            username=f"student_{i}",
            department_id=1,
            year_level="III",
            is_active=True
        )
        session.add(st)
    session.commit()

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def test_verification_scoring_matrix():
    # 1. 100% Complete match
    score_1, tier_1 = compute_verification_score(
        identity_match=True, contest_id_match=True, contest_date_match=True,
        participation_match=True, rank_score_match=True, source_url_match=True
    )
    assert score_1 == 100
    assert tier_1 == "VERIFIED"

    # 2. 85% match (date mismatch)
    score_2, tier_2 = compute_verification_score(
        identity_match=True, contest_id_match=True, contest_date_match=False,
        participation_match=True, rank_score_match=True, source_url_match=True
    )
    assert score_2 == 85
    assert tier_2 == "VERIFIED_WITH_LIMITATION"

    # 3. 65% match (conflict)
    score_3, tier_3 = compute_verification_score(
        identity_match=True, contest_id_match=True, contest_date_match=False,
        participation_match=False, rank_score_match=True, source_url_match=False
    )
    assert score_3 == 65
    assert tier_3 == "DATA_CONFLICT"

    # 4. < 50% match
    score_4, tier_4 = compute_verification_score(
        identity_match=True, contest_id_match=False, contest_date_match=False,
        participation_match=False, rank_score_match=False, source_url_match=False
    )
    assert score_4 == 30
    assert tier_4 == "NOT_VERIFIABLE"


def test_deterministic_record_hash():
    h1 = compute_student_contest_hash(1, "weekly-contest-515", "student_1", 2347, 12, 3, 1541.0)
    h2 = compute_student_contest_hash(1, "weekly-contest-515", "student_1", 2347, 12, 3, 1541.0)
    h3 = compute_student_contest_hash(1, "weekly-contest-515", "student_1", 2348, 12, 3, 1541.0)

    assert h1 == h2
    assert h1 != h3
    assert len(h1) == 64


def test_historical_resync_510_to_515_execution(resync_db):
    engine = HistoricalResyncAndAccuracyEngine()

    # Pass 1: Initial Historical Rebuild
    summary = engine.run_historical_resync(resync_db)

    assert summary["total_students"] == 10
    assert summary["contests_processed"] == 6
    assert summary["evaluations_total"] == 60
    assert summary["records_created"] == 60
    assert summary["duplicates_purged"] == 0

    # Verify all 6 sessions exist
    sessions = resync_db.query(WeeklySession).all()
    assert len(sessions) == 6

    # Verify total results in DB == 60
    total_records = resync_db.query(WeeklyPublicResult).count()
    assert total_records == 60

    # Pass 2: Idempotent Second Run (0 new rows)
    summary_2 = engine.run_historical_resync(resync_db)
    assert summary_2["records_created"] == 0
    total_records_after = resync_db.query(WeeklyPublicResult).count()
    assert total_records_after == 60


def test_completeness_report_generation(resync_db):
    engine = HistoricalResyncAndAccuracyEngine()
    engine.run_historical_resync(resync_db)

    report = engine.generate_completeness_report(resync_db, contest_slug="weekly-contest-515")

    assert report["contest_slug"] == "weekly-contest-515"
    assert report["students_configured"] == 10
    assert "coverage_pct" in report
    assert "verification_confidence" in report


def test_historical_resync_strictly_protects_live_and_scheduled_contests(resync_db):
    """Guarantees that historical resync engine NEVER modifies LIVE or SCHEDULED contests."""
    # Create an active LIVE contest session (e.g. WC-515 currently LIVE on Sunday morning)
    live_session = WeeklySession(
        contest_id="weekly-contest-515",
        contest_name="Weekly Contest 515",
        session_date="2026-08-16",
        status="LIVE"
    )
    resync_db.add(live_session)
    resync_db.commit()

    engine = HistoricalResyncAndAccuracyEngine()
    summary = engine.run_historical_resync(resync_db)

    # Verify that WC-515 was protected and NOT included in historical mutations
    assert "weekly-contest-515" not in summary["contests_breakdown"]
    
    # Status remains untouched as LIVE
    refreshed_live = resync_db.query(WeeklySession).filter(WeeklySession.contest_id == "weekly-contest-515").first()
    assert refreshed_live.status == "LIVE"
