import datetime
import pytest
from sqlalchemy.orm import Session

from backend.database import Base
from backend.models import (
    User, Student, Department
)
from backend.services.contest_discovery import (
    get_immediately_previous_sunday_date
)
from backend.services.previous_week_analyzer import PreviousWeekAnalyzer
from backend.services.public_contest_engine import PublicContestEngine


from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DB_URL = "sqlite:///./test_prev_week.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture(scope="module")
def db_session():
    Base.metadata.create_all(bind=test_engine)
    db = TestSessionLocal()
    try:
        dept = db.query(Department).first()
        if not dept:
            dept = Department(name="Computer Science PrevWeek Test", code="CSE_PW_TEST")
            db.add(dept)
            db.commit()
            db.refresh(dept)

        st1 = db.query(Student).filter(Student.reg_no == "PW_TEST_001").first()
        if not st1:
            st1 = Student(
                reg_no="PW_TEST_001",
                name="Bharath K",
                department_id=dept.id,
                year_level="III",
                username="BharathK",
                is_active=True
            )
            db.add(st1)

        st2 = db.query(Student).filter(Student.reg_no == "PW_TEST_002").first()
        if not st2:
            st2 = Student(
                reg_no="PW_TEST_002",
                name="No Username Student",
                department_id=dept.id,
                year_level="III",
                username=None,
                is_active=True
            )
            db.add(st2)
            db.commit()

        yield db
    finally:
        db.close()


def test_01_previous_sunday_calculation():
    # Tuesday 25-Aug-2026 IST -> Immediately previous Sunday is 23-Aug-2026
    dt_tuesday = datetime.datetime(2026, 8, 25, 14, 30, 0)
    prev_sunday = get_immediately_previous_sunday_date(dt_tuesday)
    assert prev_sunday == datetime.date(2026, 8, 23)

    # Sunday 23-Aug-2026 at 10:00 AM IST -> Immediately previous Sunday is 23-Aug-2026
    dt_sunday_after = datetime.datetime(2026, 8, 23, 10, 0, 0)
    prev_sunday_after = get_immediately_previous_sunday_date(dt_sunday_after)
    assert prev_sunday_after == datetime.date(2026, 8, 23)


def test_02_exact_contest_discovery(db_session: Session):
    meta = PreviousWeekAnalyzer.get_previous_week_metadata(db_session)
    assert meta["status"] in ("VERIFIED", "FINALIZED")
    assert "weekly-contest-" in meta["contest_slug"]
    assert meta["contest_title"].startswith("Weekly Contest")


def test_03_exact_username_normalization():
    assert PublicContestEngine.normalize_username("  BharathK  ") == "bharathk"
    assert PublicContestEngine.normalize_username("BHARATHK") == "bharathk"
    assert PublicContestEngine.normalize_username(None) == ""


def test_04_fuzzy_username_rejection():
    # Exact normalized equality only: "bharathk" != "bharathk123"
    norm_target = PublicContestEngine.normalize_username("BharathK")
    fuzzy_similar = PublicContestEngine.normalize_username("BharathK123")
    assert norm_target != fuzzy_similar


def test_05_previous_week_sync_lifecycle(db_session: Session):
    import asyncio
    from unittest.mock import patch, AsyncMock

    mock_leaderboard = [
        {"username": "bharathk", "rank": 1, "score": 18, "problems_solved": 4, "finish_time": "1:12:00"}
    ]

    with patch("backend.services.public_contest_engine.PublicContestEngine.fetch_complete_validated_leaderboard", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = (True, mock_leaderboard, {"pages_requested": 1, "pages_successfully_fetched": 1, "total_reported": 1})
        success, res = asyncio.run(PreviousWeekAnalyzer.sync_previous_week_contest(db_session, force_resync=True))
        assert success is True
        assert res["validation_status"] == "VERIFIED"
        assert res["publish_status"] == "PUBLISHED"


def test_06_summary_total_mathematical_reconciliation(db_session: Session):
    admin_user = User(username="admin_test", role="Admin", is_active=True)
    summary = PreviousWeekAnalyzer.get_previous_week_summary_role_scoped(db_session, admin_user)

    total = summary["total_students"]
    public_c = summary["public"]
    virtual_c = summary["virtual"]
    not_part_c = summary["not_participated"]
    not_ver_c = summary["not_verified"]
    missing_u_c = summary["missing_username"]

    # Strict mathematical reconciliation assertion
    assert public_c + virtual_c + not_part_c + not_ver_c + missing_u_c == total


def test_07_role_based_staff_isolation(db_session: Session):
    staff_user = User(id=99999, username="staff_pw_test", role="Staff", is_active=True)

    # Staff with 0 assigned students gets 0 records
    part_res = PreviousWeekAnalyzer.get_previous_week_participation_role_scoped(
        db_session, staff_user
    )
    assert part_res["total"] == 0
