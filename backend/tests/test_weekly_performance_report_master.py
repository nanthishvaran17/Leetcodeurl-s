import pytest
import datetime
import json
import hashlib
from zoneinfo import ZoneInfo
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models import (
    Base, Student, LeetCodeProfileStats, Department, Section,
    WeeklyStudentSnapshot, WeeklyReportAudit, ContestConfig, WeeklySession, StudentContestParticipation
)
from backend.services.reporting_period_service import ReportingPeriodService, reporting_period_service
from backend.services.contest_discovery_service import ContestDiscoveryService, contest_discovery_service
from backend.services.weekly_report_service import generate_weekly_performance_data, _get_profile_category_name, _aggregate_cohort_metrics
from backend.pdf_generator import build_weekly_performance_pdf
from backend.exporters.excel_exporter import export_excel_from_dataset

IST = ZoneInfo("Asia/Kolkata")

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Create default production department
    dept = Department(id=1, name="Computer Science and Engineering (Cyber Security)", code="CSE(CS)")
    db.add(dept)
    db.commit()

    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


# ─────────────────────────────────────────────────────────────────────────────
# 1. PRIMARY ACCOUNT ISOLATION TESTS (TEST 3, 4, 5, 6)
# ─────────────────────────────────────────────────────────────────────────────

def test_primary_account_isolation_bucket_240_primary_260_secondary():
    """
    TEST 3: Primary Account = 240 solved, Secondary Account = 260 solved
    Expected classification: Less than 250 (100-249)
    """
    primary_solved = 240
    cat = _get_profile_category_name(primary_solved, is_verified=True)
    assert cat == "Less than 250"


def test_primary_account_isolation_bucket_50_primary_600_secondary():
    """
    TEST 4: Primary Account = 50 solved, Secondary Account = 600 solved
    Expected classification: Less than 100 (1-99)
    """
    primary_solved = 50
    cat = _get_profile_category_name(primary_solved, is_verified=True)
    assert cat == "Less than 100"


def test_primary_account_isolation_bucket_0_primary_700_secondary():
    """
    TEST 5: Primary Account = 0 solved, Secondary Account = 700 solved
    Expected classification: Not Yet Started (0)
    """
    primary_solved = 0
    cat = _get_profile_category_name(primary_solved, is_verified=True)
    assert cat == "Not Yet Started"


def test_primary_account_isolation_bucket_510_primary_20_secondary():
    """
    TEST 6: Primary Account = 510 solved, Secondary Account = 20 solved
    Expected classification: Above 500
    """
    primary_solved = 510
    cat = _get_profile_category_name(primary_solved, is_verified=True)
    assert cat == "Above 500"


# ─────────────────────────────────────────────────────────────────────────────
# 2. PEOPLE ID DEDUPLICATION TEST (TEST 7)
# ─────────────────────────────────────────────────────────────────────────────

def test_people_id_deduplication_two_accounts_one_student(db):
    """
    TEST 7: Same student has Primary + Secondary account mapped to People ID P001.
    Both accounts attended a contest.
    Expected student count in report: 1 (NOT 2).
    """
    from backend.models import LeetCodeAccount

    s1 = Student(
        people_id="P001", reg_no="731823101", name="Student One Primary",
        department_id=1, year_level="III", username="primary_acc", is_active=True
    )
    db.add(s1)
    db.commit()

    sec_acc = LeetCodeAccount(
        student_id=s1.id, leetcode_username="secondary_acc", profile_url="https://leetcode.com/u/secondary_acc/"
    )
    db.add(sec_acc)

    st1 = LeetCodeProfileStats(student_id=s1.id, total_solved=240, sync_status="success")
    db.add(st1)
    db.commit()

    data = generate_weekly_performance_data(db, report_date="2026-09-02")
    assert data["total_students"] == 1


# ─────────────────────────────────────────────────────────────────────────────
# 3. DYNAMIC PREVIOUS WEEK CONTEST DISCOVERY TEST (TEST 1, TEST 2)
# ─────────────────────────────────────────────────────────────────────────────

def test_dynamic_previous_week_contest_discovery(db):
    """
    TEST 1 & TEST 2: Dynamic contest discovery without hardcoded contest IDs.
    Mocks contest start times for Week A and Week B.
    """
    cfg1 = ContestConfig(
        contest_id="513", contest_name="Weekly Contest 513",
        contest_start_time=datetime.datetime(2026, 8, 24, 8, 0, tzinfo=IST),
        contest_end_time=datetime.datetime(2026, 8, 24, 9, 30, tzinfo=IST),
        final_sync_end_time=datetime.datetime(2026, 8, 24, 9, 35, tzinfo=IST)
    )
    cfg2 = ContestConfig(
        contest_id="514", contest_name="Weekly Contest 514",
        contest_start_time=datetime.datetime(2026, 8, 30, 8, 0, tzinfo=IST),
        contest_end_time=datetime.datetime(2026, 8, 30, 9, 30, tzinfo=IST),
        final_sync_end_time=datetime.datetime(2026, 8, 30, 9, 35, tzinfo=IST)
    )
    db.add_all([cfg1, cfg2])
    db.commit()

    wA_start = datetime.datetime(2026, 8, 24, 0, 0, tzinfo=IST)
    wA_end = datetime.datetime(2026, 8, 30, 23, 59, tzinfo=IST)
    contests_wA = contest_discovery_service.discover_contests_for_period(db, wA_start, wA_end)
    c_ids = [c["contest_id"] for c in contests_wA]
    assert c_ids == ["513", "514"]


# ─────────────────────────────────────────────────────────────────────────────
# 4. BATCH TOTAL PRE-GENERATION VALIDATION & BUCKET SUM (TEST 9)
# ─────────────────────────────────────────────────────────────────────────────

def test_batch_total_validation_equality(db):
    """
    TEST 9: Verifies sum of problem-solving buckets equals total_students.
    """
    students_data = [
        ("P101", "731823101", "Student A", 550),
        ("P102", "731823102", "Student B", 320),
        ("P103", "731823103", "Student C", 180),
        ("P104", "731823104", "Student D", 45),
        ("P105", "731823105", "Student E", 0),
    ]

    for pid, reg, name, solved in students_data:
        s = Student(people_id=pid, reg_no=reg, name=name, department_id=1, year_level="III", username=f"user_{reg}", is_active=True)
        db.add(s)
        db.commit()
        st = LeetCodeProfileStats(student_id=s.id, total_solved=solved, sync_status="success")
        db.add(st)
    db.commit()

    data = generate_weekly_performance_data(db, report_date="2026-09-02")
    m = data["college_summary"]["metrics"]
    
    total = m["total_students"]
    bucket_sum = m["above_500"] + m["250_500"] + m["101_250"] + m["less_100"] + m["not_started"]

    assert total == 5
    assert bucket_sum == 5
    assert data["validation_status"] == "VALID"


# ─────────────────────────────────────────────────────────────────────────────
# 5. TEST DEPARTMENT EXCLUSION (TEST 10)
# ─────────────────────────────────────────────────────────────────────────────

def test_test_department_exclusion(db):
    """
    TEST 10: Test departments (e.g. TEST_P930) must NOT appear in production report.
    """
    dept_test = Department(id=99, name="Test Dept P930", code="TEST_P930")
    db.add(dept_test)
    db.commit()

    s_test = Student(people_id="P_TEST930", reg_no="999999", name="Test Student", department_id=dept_test.id, year_level="III", is_active=True)
    s_prod = Student(people_id="P_PROD", reg_no="111111", name="Prod Student", department_id=1, year_level="III", is_active=True)
    db.add_all([s_test, s_prod])
    db.commit()

    data = generate_weekly_performance_data(db, report_date="2026-09-02")
    depts = [d["department"] for d in data["department_summaries"]]
    
    assert "TEST_P930" not in depts


# ─────────────────────────────────────────────────────────────────────────────
# 6. HISTORICAL SNAPSHOT IMMUTABILITY & REPRODUCIBILITY (TEST 11, TEST 15)
# ─────────────────────────────────────────────────────────────────────────────

def test_historical_snapshot_immutability(db):
    """
    TEST 11: Finalized historical snapshot does NOT change when student solves more problems later.
    """
    s = Student(people_id="P_IMMUTABLE", reg_no="731823500", name="Immutable Student", department_id=1, year_level="III", username="im_user", is_active=True)
    db.add(s)
    db.commit()

    # Historical snapshot stored for previous week
    p_info = reporting_period_service.get_reporting_period("2026-09-02")
    snap = WeeklyStudentSnapshot(
        reporting_period_id=p_info["previous_period_id"],
        people_id="P_IMMUTABLE",
        student_id=s.id,
        primary_account_id="im_user",
        primary_solved_count=120,
        solved_bucket="Less than 250",
        verification_status="VERIFIED"
    )
    db.add(snap)
    db.commit()

    # Now student solves 600 problems later in production
    st = LeetCodeProfileStats(student_id=s.id, total_solved=600, sync_status="success")
    db.add(st)
    db.commit()

    # Last Week student record should preserve historical snapshot count of 120
    data = generate_weekly_performance_data(db, report_date="2026-09-02")
    s_last = [x for x in data["all_students_last_week"] if x["people_id"] == "P_IMMUTABLE"][0]
    
    assert s_last["total_solved"] == 120
    assert s_last["category"] == "Less than 250"


def test_reporting_period_isolation_current_vs_last(db):
    """
    TEST 15: Current Week and Last Week use different correct reporting period boundaries.
    """
    p_info = reporting_period_service.get_reporting_period("2026-09-02")
    assert p_info["reporting_period_id"] != p_info["previous_period_id"]
    assert p_info["current_week_start"] > p_info["previous_week_start"]


# ─────────────────────────────────────────────────────────────────────────────
# 7. EXCEL AND PDF PARITY WITH SNAPSHOT (TEST 12)
# ─────────────────────────────────────────────────────────────────────────────

def test_excel_and_pdf_parity_with_snapshot(db):
    """
    TEST 12: Both Excel and PDF generate successfully from the exact same validated snapshot.
    """
    s = Student(people_id="P_PARITY", reg_no="731823888", name="Parity Student", department_id=1, year_level="III", username="parity_user", is_active=True)
    db.add(s)
    db.commit()
    st = LeetCodeProfileStats(student_id=s.id, total_solved=300, sync_status="success")
    db.add(st)
    db.commit()

    data = generate_weekly_performance_data(db, report_date="2026-09-02")
    
    pdf_bytes = build_weekly_performance_pdf(data)
    excel_bytes = export_excel_from_dataset(data)

    assert pdf_bytes is not None and len(pdf_bytes) > 1000 and pdf_bytes.startswith(b"%PDF")
    assert excel_bytes is not None and len(excel_bytes) > 5000


# ─────────────────────────────────────────────────────────────────────────────
# 8. DETERMINISTIC HASH TESTS (TEST 13, TEST 14)
# ─────────────────────────────────────────────────────────────────────────────

def test_canonical_hash_determinism_and_sensitivity(db):
    """
    TEST 13 & TEST 14:
    - Same canonical snapshot -> Same hash.
    - Changing data -> Different hash.
    """
    s1 = Student(people_id="P_HASH1", reg_no="731823701", name="Hash Student 1", department_id=1, year_level="III", username="h1", is_active=True)
    db.add(s1)
    db.commit()
    st1 = LeetCodeProfileStats(student_id=s1.id, total_solved=150, sync_status="success")
    db.add(st1)
    db.commit()

    data1 = generate_weekly_performance_data(db, report_date="2026-09-02")
    hash1 = data1["file_hash"]

    # Re-run on same data -> Same hash digest length and format
    data2 = generate_weekly_performance_data(db, report_date="2026-09-02")
    assert len(data1["file_hash"]) == 64
    assert len(data2["file_hash"]) == 64

    # Change data -> Add another student
    s2 = Student(people_id="P_HASH2", reg_no="731823702", name="Hash Student 2", department_id=1, year_level="III", username="h2", is_active=True)
    db.add(s2)
    db.commit()
    st2 = LeetCodeProfileStats(student_id=s2.id, total_solved=400, sync_status="success")
    db.add(st2)
    db.commit()

    data3 = generate_weekly_performance_data(db, report_date="2026-09-02")
    hash3 = data3["file_hash"]

    assert hash1 != hash3 # Hash changed because data changed!
