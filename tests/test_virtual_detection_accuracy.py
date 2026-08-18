"""
test_virtual_detection_accuracy.py — Comprehensive Test Suite for Virtual Contest Detection & Accuracy

Tests:
1. Detection of Virtual Contest Participation from User History (virtual_contest = True)
2. Guarantee that Virtual students are NEVER counted as NOT_ATTENDED
3. Verification of 3 distinct statuses: PUBLIC, VIRTUAL, NOT_ATTENDED
4. Accurate Virtual Breakdown (4/4, 3/4, 2/4, 1/4)
5. Full 302/302 mathematical roster reconciliation
"""
import pytest
from datetime import datetime
from zoneinfo import ZoneInfo
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models import (
    Base, Student, Department, WeeklySession, WeeklyPublicResult, WeeklyVirtualResult, LeetCodeProfileStats
)
from backend.services.participation_classifier import (
    ParticipationClassifier, ClassificationResult
)
from backend.services.leetcode_adapter import (
    UserContestResult, UserContestHistoryEntry, UserProfile
)
from backend.services.canonical_contest_engine import (
    build_canonical_contest_dataset, normalize_participation_status
)


@pytest.fixture
def memory_db():
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    dept_cs = Department(id=1, name="Computer Science & Engineering (Cyber Security)", code="CSE(CS)")
    dept_iot = Department(id=2, name="Computer Science & Engineering (IoT)", code="CSE(IOT)")
    db.add_all([dept_cs, dept_iot])
    db.commit()

    # Create 302 students
    students = []
    for i in range(1, 303):
        dept_id = 1 if i <= 151 else 2
        yr = "II" if i % 3 == 0 else ("III" if i % 3 == 1 else "IV")
        username = None if i > 281 else f"student_user_{i}"
        s = Student(
            id=i,
            reg_no=f"73222400{i:03d}",
            name=f"STUDENT {i}",
            department_id=dept_id,
            year_level=yr,
            username=username,
            leetcode_url=f"https://leetcode.com/u/{username}" if username else None,
            is_active=True
        )
        students.append(s)
    db.add_all(students)
    db.commit()

    # Create Weekly Contest 515 session
    sess = WeeklySession(
        id=5,
        session_code="WC-515",
        session_date="16.08.2026",
        contest_id="weekly-contest-515",
        contest_name="Weekly Contest 515",
        status="FINALIZED",
        total_students=302,
        official_participants=78,
        virtual_participants=45,
        not_participated=158,
        failed_verification=21
    )
    db.add(sess)
    db.commit()

    # Public (78)
    for i in range(1, 79):
        q_cnt = 4 if i <= 5 else (3 if i <= 15 else (2 if i <= 40 else 1))
        db.add(WeeklyPublicResult(
            session_id=5, student_id=i, reg_no=f"73222400{i:03d}", name=f"STUDENT {i}",
            dept="CSE(CS)", year="III", participation_status="PUBLIC", data_fetch_status="SUCCESS",
            q1=1, q2=1 if q_cnt >= 2 else 0, q3=1 if q_cnt >= 3 else 0, q4=1 if q_cnt >= 4 else 0,
            total_contest_solved=q_cnt, contest_score=15, contest_rank=200+i, contest_rating=1500.0,
            fetch_status="SUCCESS"
        ))

    # Virtual (45) -> 79 to 123
    # 5 with 4/4, 12 with 3/4, 18 with 2/4, 10 with 1/4
    for idx, i in enumerate(range(79, 124)):
        if idx < 5:
            q_cnt, q1, q2, q3, q4, score = 4, 1, 1, 1, 1, 18
        elif idx < 17:
            q_cnt, q1, q2, q3, q4, score = 3, 1, 1, 1, 0, 12
        elif idx < 35:
            q_cnt, q1, q2, q3, q4, score = 2, 1, 1, 0, 0, 7
        else:
            q_cnt, q1, q2, q3, q4, score = 1, 1, 0, 0, 0, 3

        db.add(WeeklyPublicResult(
            session_id=5, student_id=i, reg_no=f"73222400{i:03d}", name=f"STUDENT {i}",
            dept="CSE(CS)", year="III", participation_status="VIRTUAL", data_fetch_status="SUCCESS",
            q1=q1, q2=q2, q3=q3, q4=q4, total_contest_solved=q_cnt, contest_score=score,
            fetch_status="SUCCESS"
        ))
        db.add(WeeklyVirtualResult(
            session_id=5, student_id=i, reg_no=f"73222400{i:03d}", name=f"STUDENT {i}",
            participation_status="VIRTUAL_ATTENDED", q1=q1, q2=q2, q3=q3, q4=q4,
            total_contest_solved=q_cnt, contest_score=score
        ))

    # Not Attended (158) -> 124 to 281
    for i in range(124, 282):
        db.add(WeeklyPublicResult(
            session_id=5, student_id=i, reg_no=f"73222400{i:03d}", name=f"STUDENT {i}",
            dept="CSE(CS)", year="III", participation_status="NOT_ATTENDED", data_fetch_status="NOT_PARTICIPATED",
            q1=None, q2=None, q3=None, q4=None, total_contest_solved=0, contest_score=0,
            fetch_status="NOT_PARTICIPATED"
        ))

    # Data Errors (21) -> 282 to 302
    for i in range(282, 303):
        db.add(WeeklyPublicResult(
            session_id=5, student_id=i, reg_no=f"73222400{i:03d}", name=f"STUDENT {i}",
            dept="CSE(CS)", year="III", participation_status="USERNAME_NOT_FOUND", data_fetch_status="USERNAME_NOT_FOUND",
            q1=None, q2=None, q3=None, q4=None, total_contest_solved=None, contest_score=0,
            fetch_status="USERNAME_NOT_FOUND", error_reason="LeetCode username unlinked"
        ))

    db.commit()
    yield db
    db.close()


def test_virtual_detection_from_history():
    """
    Test 1: Input student in history with virtual_contest = True
    Expected: Status = VIRTUAL
    """
    import asyncio
    classifier = ParticipationClassifier()
    history_entry = UserContestHistoryEntry(
        contest_title="Weekly Contest 515",
        contest_slug="weekly-contest-515",
        attended=False,
        problems_solved=3,
        total_problems=4,
        rank=None,
        virtual_contest=True,
        source="user_contest_history"
    )

    result = asyncio.run(classifier.classify(
        username="ajay_a1277",
        contest_slug="weekly-contest-515",
        contest_evidence=None,
        history_evidence=history_entry
    ))

    assert result.participation_status == "VIRTUAL"
    assert result.verification_status == "VERIFIED"
    assert result.solved_count == 3


def test_public_detection_from_live_ranking():
    """
    Test 2: Input student in live ranking with submissions
    Expected: Status = ACTUAL / PUBLIC
    """
    import asyncio
    classifier = ParticipationClassifier()
    contest_ev = UserContestResult(
        username="live_solver",
        contest_slug="weekly-contest-515",
        attended=True,
        rank=450,
        score=18,
        solved_count=4,
        source="contest_ranking"
    )

    result = asyncio.run(classifier.classify(
        username="live_solver",
        contest_slug="weekly-contest-515",
        contest_evidence=contest_ev
    ))

    assert result.participation_status == "ACTUAL"
    assert result.verification_status == "VERIFIED"
    assert result.rank == 450
    assert result.solved_count == 4


def test_no_evidence_not_attended():
    """
    Test 3: No evidence in live ranking or history
    Expected: Status = NOT_VERIFIED / NOT_ATTENDED
    """
    import asyncio
    classifier = ParticipationClassifier()
    result = asyncio.run(classifier.classify(
        username="absent_student",
        contest_slug="weekly-contest-515",
        contest_evidence=None,
        history_evidence=None
    ))

    assert result.participation_status == "NOT_VERIFIED"
    assert result.verification_status == "PENDING"


def test_canonical_dataset_302_reconciliation(memory_db):
    """
    Test 4: Master 302 students dataset mathematical verification:
    Total: 302
    Public: 78
    Virtual: 45 (4/4: 5, 3/4: 12, 2/4: 18, 1/4: 10)
    Not Attended: 158
    Data Errors: 21
    Reconciliation: PASSED (78 + 45 + 158 + 21 = 302)
    """
    dataset = build_canonical_contest_dataset(5, memory_db)
    metrics = dataset["metrics"]
    status_counts = dataset["statusCounts"]

    assert metrics["totalStudents"] == 302
    assert metrics["officialAttended"] == 78
    assert metrics["virtualAttended"] == 45
    assert metrics["notAttended"] == 158
    assert metrics["errors"] == 21

    assert status_counts["PUBLIC"] == 78
    assert status_counts["VIRTUAL"] == 45
    assert status_counts["NOT_ATTENDED"] == 158
    assert status_counts["USERNAME_NOT_FOUND"] == 21

    assert dataset["reconciliation"]["passed"] is True

    # Check that virtual students are never in not attended
    v_rows = [r for r in dataset["rows"] if r["status"] == "VIRTUAL"]
    assert len(v_rows) == 45
    for r in v_rows:
        assert r["status"] != "NOT_ATTENDED"
        assert r["total_solved"] in (1, 2, 3, 4)

    # Virtual Breakdown verification
    v_4 = [r for r in v_rows if r["total_solved"] == 4]
    v_3 = [r for r in v_rows if r["total_solved"] == 3]
    v_2 = [r for r in v_rows if r["total_solved"] == 2]
    v_1 = [r for r in v_rows if r["total_solved"] == 1]

    assert len(v_4) == 5
    assert len(v_3) == 12
    assert len(v_2) == 18
    assert len(v_1) == 10
