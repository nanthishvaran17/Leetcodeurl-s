from __future__ import annotations

import pytest
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models import Student, Department, WeeklySession
from backend.services.url_database_sync_engine import (
    DynamicUrlDatabaseSyncEngine,
    SyncStatusCode,
    normalize_leetcode_url_and_username
)

@pytest.fixture
def sync_db():
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = Session()

    # Seed Department
    dept = Department(id=1, code="CSE(CS)", name="Computer Science & Engineering (Cyber Security)")
    session.add(dept)
    session.commit()

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def test_url_normalization_patterns():
    # Full URL with trailing slash
    u1, link1 = normalize_leetcode_url_and_username("https://leetcode.com/u/nanthish/")
    assert u1 == "nanthish"
    assert link1 == "https://leetcode.com/u/nanthish/"

    # Full URL without /u/
    u2, link2 = normalize_leetcode_url_and_username("https://leetcode.com/priya_dharshini")
    assert u2 == "priya_dharshini"
    assert link2 == "https://leetcode.com/u/priya_dharshini/"

    # Raw username string
    u3, link3 = normalize_leetcode_url_and_username("ajay_a")
    assert u3 == "ajay_a"
    assert link3 == "https://leetcode.com/u/ajay_a/"

    # Empty / whitespace
    u4, link4 = normalize_leetcode_url_and_username("   ")
    assert u4 is None
    assert link4 is None


def test_new_url_added_creates_record(sync_db):
    engine = DynamicUrlDatabaseSyncEngine()
    res = engine.sync_student_record(
        db=sync_db,
        reg_no="732224CC001",
        name="AJAY A",
        raw_url_or_username="https://leetcode.com/u/ajay_a/",
        dept_code="CSE(CS)",
        year_level="III"
    )
    assert res.status == SyncStatusCode.NEW
    assert res.reg_no == "732224CC001"
    assert res.username == "ajay_a"

    # Verify DB
    student = sync_db.query(Student).filter(Student.reg_no == "732224CC001").first()
    assert student is not None
    assert student.username == "ajay_a"
    assert student.leetcode_url == "https://leetcode.com/u/ajay_a/"


def test_url_change_updates_same_logical_record_no_duplicate(sync_db):
    engine = DynamicUrlDatabaseSyncEngine()

    # Step 1: Create Initial
    engine.sync_student_record(
        db=sync_db,
        reg_no="732224CC002",
        name="AMRUTHA M",
        raw_url_or_username="https://leetcode.com/u/old_amrutha/",
        dept_code="CSE(CS)",
        year_level="III"
    )

    count_before = sync_db.query(Student).filter(Student.reg_no == "732224CC002").count()
    assert count_before == 1

    # Step 2: URL Changed
    res = engine.sync_student_record(
        db=sync_db,
        reg_no="732224CC002",
        name="AMRUTHA M",
        raw_url_or_username="https://leetcode.com/u/new_amrutha_pro/",
        dept_code="CSE(CS)",
        year_level="III"
    )
    assert res.status == SyncStatusCode.UPDATED
    assert res.username == "new_amrutha_pro"

    # Verify count remains exactly 1 (no duplicate)
    count_after = sync_db.query(Student).filter(Student.reg_no == "732224CC002").count()
    assert count_after == 1

    updated_student = sync_db.query(Student).filter(Student.reg_no == "732224CC002").first()
    assert updated_student.username == "new_amrutha_pro"
    assert updated_student.leetcode_url == "https://leetcode.com/u/new_amrutha_pro/"


def test_name_change_updates_database(sync_db):
    engine = DynamicUrlDatabaseSyncEngine()

    # Initial
    engine.sync_student_record(
        db=sync_db,
        reg_no="732224CC003",
        name="ANUSH R",
        raw_url_or_username="https://leetcode.com/u/anush_r/",
        dept_code="CSE(CS)",
        year_level="III"
    )

    # Edit Name
    res = engine.sync_student_record(
        db=sync_db,
        reg_no="732224CC003",
        name="ANUSHKUMAR R",
        raw_url_or_username="https://leetcode.com/u/anush_r/"
    )
    assert res.status == SyncStatusCode.UPDATED

    student = sync_db.query(Student).filter(Student.reg_no == "732224CC003").first()
    assert student.name == "ANUSHKUMAR R"


def test_url_delete_and_readd_lifecycle(sync_db):
    engine = DynamicUrlDatabaseSyncEngine()

    # Create
    engine.sync_student_record(
        db=sync_db,
        reg_no="732224CC004",
        name="DHARANESH S",
        raw_url_or_username="https://leetcode.com/u/dharanesh_s/"
    )

    # Remove (Deactivate/Archive)
    del_res = engine.remove_or_archive_student(db=sync_db, reg_no_or_id="732224CC004", is_permanent=False)
    assert del_res.status == SyncStatusCode.CONFIRMED_DELETED

    student = sync_db.query(Student).filter(Student.reg_no == "732224CC004").first()
    assert student.is_active is False

    # Re-add/Sync restores active state
    re_res = engine.sync_student_record(
        db=sync_db,
        reg_no="732224CC004",
        name="DHARANESH S",
        raw_url_or_username="https://leetcode.com/u/dharanesh_s/"
    )
    assert re_res.status == SyncStatusCode.UPDATED

    student = sync_db.query(Student).filter(Student.reg_no == "732224CC004").first()
    assert student.is_active is True


def test_contest_url_slug_change_updates_same_logical_session(sync_db):
    engine = DynamicUrlDatabaseSyncEngine()

    # Create Initial Session
    session = WeeklySession(
        id=101,
        contest_id="weekly-contest-515",
        contest_name="Weekly Contest 515",
        session_date="2026-08-16",
        status="FINALIZED"
    )
    sync_db.add(session)
    sync_db.commit()

    # Update contest URL / slug
    res = engine.sync_contest_url_change(
        db=sync_db,
        session_id=101,
        new_contest_slug="weekly-contest-515-renamed",
        new_contest_name="Weekly Contest 515 Official"
    )
    assert res.status == SyncStatusCode.UPDATED

    # Verify no duplicate session row
    total_sessions = sync_db.query(WeeklySession).count()
    assert total_sessions == 1

    updated_session = sync_db.query(WeeklySession).filter(WeeklySession.id == 101).first()
    assert updated_session.contest_id == "weekly-contest-515-renamed"
    assert updated_session.contest_name == "Weekly Contest 515 Official"
