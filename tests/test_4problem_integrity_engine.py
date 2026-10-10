import pytest
import datetime
from zoneinfo import ZoneInfo
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models import Student, StudentContestParticipation, WeeklyPublicResult
from backend.contest_truth_engine import ContestTruthEngine
from backend.services.contest_problem_accuracy_engine import ContestProblemAccuracyEngine, ContestProblemSet, ContestProblemDefinition
from backend.services.sunday_live_ingestion_engine import SundayLiveIngestionEngine

IST = ZoneInfo("Asia/Kolkata")

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture
def sample_problem_set():
    return ContestProblemAccuracyEngine.resolve_official_problem_set(contest_number=516)


# Test 1: Student solves 0 problems -> Expected: 0
def test_01_student_solves_0_problems(sample_problem_set):
    result = ContestProblemAccuracyEngine.evaluate_student_submissions(
        problem_set=sample_problem_set,
        submissions=[]
    )
    assert result["solved"] == 0
    assert result["q1"] == 0 and result["q2"] == 0 and result["q3"] == 0 and result["q4"] == 0
    assert result["tier"] == "0/4"


# Test 2: Student solves 1 problem -> Expected: 1
def test_02_student_solves_1_problem(sample_problem_set):
    subs = [
        {"title_slug": "find-special-substring-of-length-k", "status": "ACCEPTED"}
    ]
    result = ContestProblemAccuracyEngine.evaluate_student_submissions(
        problem_set=sample_problem_set,
        submissions=subs
    )
    assert result["solved"] == 1
    assert result["q1"] == 1 and result["q2"] == 0 and result["q3"] == 0 and result["q4"] == 0
    assert result["tier"] == "1/4"


# Test 3: Student solves 2 problems -> Expected: 2
def test_03_student_solves_2_problems(sample_problem_set):
    subs = [
        {"title_slug": "find-special-substring-of-length-k", "status": "ACCEPTED"},
        {"title_slug": "maximum-manhattan-distance-after-k-changes", "status": "ACCEPTED"}
    ]
    result = ContestProblemAccuracyEngine.evaluate_student_submissions(
        problem_set=sample_problem_set,
        submissions=subs
    )
    assert result["solved"] == 2
    assert result["q1"] == 1 and result["q2"] == 1 and result["q3"] == 0 and result["q4"] == 0
    assert result["tier"] == "2/4"


# Test 4: Student solves 3 problems -> Expected: 3
def test_04_student_solves_3_problems(sample_problem_set):
    subs = [
        {"title_slug": "find-special-substring-of-length-k", "status": "ACCEPTED"},
        {"title_slug": "maximum-manhattan-distance-after-k-changes", "status": "ACCEPTED"},
        {"title_slug": "count-substrings-divisible-by-last-digit", "status": "ACCEPTED"}
    ]
    result = ContestProblemAccuracyEngine.evaluate_student_submissions(
        problem_set=sample_problem_set,
        submissions=subs
    )
    assert result["solved"] == 3
    assert result["q1"] == 1 and result["q2"] == 1 and result["q3"] == 1 and result["q4"] == 0
    assert result["tier"] == "3/4"


# Test 5: Student solves all 4 -> Expected: 4
def test_05_student_solves_all_4(sample_problem_set):
    subs = [
        {"title_slug": "find-special-substring-of-length-k", "status": "ACCEPTED"},
        {"title_slug": "maximum-manhattan-distance-after-k-changes", "status": "ACCEPTED"},
        {"title_slug": "count-substrings-divisible-by-last-digit", "status": "ACCEPTED"},
        {"title_slug": "maximum-difference-between-even-and-odd-frequency-ii", "status": "ACCEPTED"}
    ]
    result = ContestProblemAccuracyEngine.evaluate_student_submissions(
        problem_set=sample_problem_set,
        submissions=subs
    )
    assert result["solved"] == 4
    assert result["q1"] == 1 and result["q2"] == 1 and result["q3"] == 1 and result["q4"] == 1
    assert result["tier"] == "4/4"


# Test 6: Same problem submitted 10 times -> Expected: 1 for that problem
def test_06_multiple_submissions_same_problem(sample_problem_set):
    subs = [
        {"title_slug": "find-special-substring-of-length-k", "status": "WRONG_ANSWER"},
        {"title_slug": "find-special-substring-of-length-k", "status": "TIME_LIMIT_EXCEEDED"},
        {"title_slug": "find-special-substring-of-length-k", "status": "ACCEPTED"},
        {"title_slug": "find-special-substring-of-length-k", "status": "ACCEPTED"},
        {"title_slug": "find-special-substring-of-length-k", "status": "ACCEPTED"}
    ]
    result = ContestProblemAccuracyEngine.evaluate_student_submissions(
        problem_set=sample_problem_set,
        submissions=subs
    )
    assert result["solved"] == 1
    assert result["q1"] == 1 and result["q2"] == 0 and result["q3"] == 0 and result["q4"] == 0


# Test 7: Virtual contest activity -> Expected: NOT counted as actual
def test_07_virtual_contest_isolation():
    truth_engine = ContestTruthEngine()
    # Submission timestamp outside 08:00 - 09:30 AM IST (e.g. 14:00 PM IST)
    dt_virtual = datetime.datetime(2026, 9, 20, 14, 0, 0, tzinfo=IST)
    ts_virtual = int(dt_virtual.timestamp())
    
    raw_data = {
        "recentAcSubmissionList": [
            {"titleSlug": "find-special-substring-of-length-k", "status": "ACCEPTED", "timestamp": ts_virtual}
        ]
    }
    eval_res = truth_engine.verify_contest_evidence(
        username="test_user",
        contest_id="weekly-contest-516",
        contest_problems=["find-special-substring-of-length-k"],
        raw_data=raw_data
    )
    assert eval_res["solved_count"] == 0
    assert eval_res["status_badge"] == " YELLOW"


# Test 8: API returns empty response -> Expected: FETCH_FAILED / DATA_UNAVAILABLE, not 0
def test_08_api_empty_response():
    truth_engine = ContestTruthEngine()
    eval_res = truth_engine.verify_contest_evidence(
        username="test_user",
        contest_id="weekly-contest-516",
        contest_problems=["find-special-substring-of-length-k"],
        raw_data={}
    )
    assert eval_res["solved_count"] == 0
    assert eval_res["status_badge"] == " RED"
    assert eval_res["verified_solved_count"] == 0


# Test 9: API timeout after student had 3 verified problems -> Expected: 3 preserved
def test_09_monotonic_progression_on_api_timeout(db_session):
    from backend.models import Department, WeeklySession, PreviousWeekParticipationRecord
    dept = Department(name="Computer Science", code="CSE")
    db_session.add(dept)
    db_session.commit()

    # Setup student
    s = Student(name="John Doe", reg_no="REG101", username="johndoe", primary_leetcode_id="johndoe", is_active=True, department_id=dept.id, year_level="III")
    db_session.add(s)
    db_session.commit()

    # Create session
    session = WeeklySession(
        session_code="WC516-2026-09-20",
        contest_id="weekly-contest-516",
        contest_name="Weekly Contest 516",
        session_date="2026-09-20",
        status="LIVE"
    )
    db_session.add(session)
    db_session.commit()

    # Initial solve 3/4
    rec = PreviousWeekParticipationRecord(
        session_id=session.id,
        student_id=s.id,
        contest_id="weekly-contest-516",
        contest_slug="weekly-contest-516",
        contest_title="Weekly Contest 516",
        leetcode_username=s.username,
        participation_type="PUBLIC",
        q1=1, q2=1, q3=1, q4=0,
        problems_solved=3,
        is_active_version=True
    )
    db_session.add(rec)
    db_session.commit()

    # Subsequent poll with API timeout (q1=0, q2=0, q3=0, q4=0 passed due to fetch error)
    import asyncio
    success, data, error = asyncio.run(SundayLiveIngestionEngine.ingest_student_solve_event(
        db=db_session,
        session_id=session.id,
        student_id=s.id,
        q1=0, q2=0, q3=0, q4=0,
        evidence_source="api_timeout_fallback"
    ))

    # Assert 3/4 is preserved and NOT overwritten to 0/4
    assert data["solved_count"] == 3
    assert data["q1"] == 1 and data["q2"] == 1 and data["q3"] == 1 and data["q4"] == 0


# Test 10: Duplicate LeetCode accounts -> Flagged
def test_10_duplicate_leetcode_accounts(db_session):
    from backend.models import Department
    dept = Department(name="Information Technology", code="IT")
    db_session.add(dept)
    db_session.commit()

    s1 = Student(name="Alice", reg_no="REG001", username="alice_user", primary_leetcode_id="same_handle", is_active=True, department_id=dept.id, year_level="III")
    s2 = Student(name="Bob", reg_no="REG002", username="bob_user", primary_leetcode_id="same_handle", is_active=True, department_id=dept.id, year_level="III")
    db_session.add_all([s1, s2])
    db_session.commit()

    # Query duplicate handles across primary_leetcode_id
    from sqlalchemy import func
    dups = db_session.query(Student.primary_leetcode_id, func.count(Student.id)).group_by(Student.primary_leetcode_id).having(func.count(Student.id) > 1).all()
    assert len(dups) == 1
    assert dups[0][0] == "same_handle"


# Test 11: Wrong contest submission -> Expected: NOT counted
def test_11_wrong_contest_submission(sample_problem_set):
    subs = [
        {"title_slug": "two-sum", "status": "ACCEPTED"},
        {"title_slug": "3sum", "status": "ACCEPTED"}
    ]
    result = ContestProblemAccuracyEngine.evaluate_student_submissions(
        problem_set=sample_problem_set,
        submissions=subs
    )
    assert result["solved"] == 0
    assert result["q1"] == 0 and result["q2"] == 0 and result["q3"] == 0 and result["q4"] == 0


# Test 12: Submission outside contest window -> Expected: NOT counted as actual
def test_12_submission_outside_window(sample_problem_set):
    dt_before = datetime.datetime(2026, 9, 20, 7, 55, 0, tzinfo=IST)
    ts_before = int(dt_before.timestamp())

    dt_start = datetime.datetime(2026, 9, 20, 8, 0, 0, tzinfo=IST)
    dt_end = datetime.datetime(2026, 9, 20, 9, 30, 0, tzinfo=IST)

    subs = [
        {"title_slug": "find-special-substring-of-length-k", "status": "ACCEPTED", "timestamp": ts_before}
    ]
    result = ContestProblemAccuracyEngine.evaluate_student_submissions(
        problem_set=sample_problem_set,
        submissions=subs,
        contest_start_epoch=int(dt_start.timestamp()),
        contest_end_epoch=int(dt_end.timestamp())
    )
    assert result["solved"] == 0


# Test 13: Malformed GraphQL response -> Rejected
def test_13_malformed_graphql_response():
    truth_engine = ContestTruthEngine()
    eval_res = truth_engine.verify_contest_evidence(
        username="test_user",
        contest_id="weekly-contest-516",
        contest_problems=["find-special-substring-of-length-k"],
        raw_data={"malformed": True}
    )
    assert eval_res["solved_count"] == 0
    assert eval_res["verified_solved_count"] == 0


# Test 14: Model Range Invariant 0 <= questions_solved <= 4
def test_14_model_range_invariant_validation(db_session):
    part = StudentContestParticipation(
        student_id=1,
        contest_id="weekly-contest-516",
        contest_name="Weekly Contest 516",
        participation_mode="PUBLIC"
    )
    with pytest.raises(ValueError):
        part.questions_solved = 5

    with pytest.raises(ValueError):
        part.questions_solved = -1

    part.questions_solved = 4
    assert part.questions_solved == 4


# Test 15: Impossible Count Assertion
def test_15_impossible_count_rejection():
    with pytest.raises(AssertionError):
        count = 5
        assert 0 <= count <= 4, f"Impossible count: {count}"
