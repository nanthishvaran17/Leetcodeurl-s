"""
Unit tests for Phase X — Accuracy Hardening (Fix 1).
Verifies deterministic rules for contest classification and solved counts.
"""
import pytest
import datetime
from backend.services.contest_classifier import (
    evaluate_contest_evidence,
    get_contest_utc_window,
    ContestStatus,
    ReasonCode
)

# Test Contest Parameters
CONTEST_ID = "weekly-contest-520"
CONTEST_NAME = "Weekly Contest 520"
# Contest Window for W520: 2026-09-20 02:30:00 UTC (08:00 AM IST) to 2026-09-20 04:00:00 UTC (09:30 AM IST)
START_UTC, END_UTC = get_contest_utc_window(CONTEST_ID)
START_UNIX = int(START_UTC.timestamp()) # 2026-09-20 02:30:00 UTC (08:00 AM IST)
END_UNIX = int(END_UTC.timestamp())     # 2026-09-20 04:00:00 UTC (09:30:00 AM IST)

OFFICIAL_PROBLEMS = [
    {"question_order": 1, "title": "Problem A", "titleSlug": "problem-a", "problem_id": 101},
    {"question_order": 2, "title": "Problem B", "titleSlug": "problem-b", "problem_id": 102},
    {"question_order": 3, "title": "Problem C", "titleSlug": "problem-c", "problem_id": 103},
    {"question_order": 4, "title": "Problem D", "titleSlug": "problem-d", "problem_id": 104},
]


def test_1_live_submission_0810():
    """Test 1: 08:10 Accepted -> Expected: LIVE"""
    # 08:10 AM IST = 02:40 AM UTC = START_UNIX + 600s
    sub_ts = START_UNIX + 600
    subs = [
        {"id": "s1", "title": "Problem A", "titleSlug": "problem-a", "timestamp": sub_ts, "status": "Accepted"}
    ]
    res = evaluate_contest_evidence(
        student_id=1,
        student_name="Test Student",
        leetcode_username="testuser",
        contest_id=CONTEST_ID,
        contest_name=CONTEST_NAME,
        contest_start_utc=START_UTC,
        contest_end_utc=END_UTC,
        official_problems=OFFICIAL_PROBLEMS,
        ranking_history_attended=True,
        raw_submissions=subs
    )
    assert res.status == ContestStatus.LIVE
    assert res.classification_signal == "in_window_submission"
    assert res.problems_solved == 1
    assert res.live_solves == 1
    assert res.post_contest_solves == 0


def test_2_boundary_inclusive_093000():
    """Test 2: 09:30:00 Accepted -> Expected: LIVE"""
    # 09:30:00 AM IST = END_UNIX exactly
    sub_ts = END_UNIX
    subs = [
        {"id": "s2", "title": "Problem A", "titleSlug": "problem-a", "timestamp": sub_ts, "status": "Accepted"}
    ]
    res = evaluate_contest_evidence(
        student_id=1,
        student_name="Test Student",
        leetcode_username="testuser",
        contest_id=CONTEST_ID,
        contest_name=CONTEST_NAME,
        contest_start_utc=START_UTC,
        contest_end_utc=END_UTC,
        official_problems=OFFICIAL_PROBLEMS,
        ranking_history_attended=True,
        raw_submissions=subs
    )
    assert res.status == ContestStatus.LIVE
    assert res.classification_signal == "in_window_submission"
    assert res.problems_solved == 1
    assert res.live_solves == 1


def test_3_boundary_exclusive_093001():
    """Test 3: 09:30:01 Accepted -> Expected: VIRTUAL"""
    # 09:30:01 AM IST = END_UNIX + 1s
    sub_ts = END_UNIX + 1
    subs = [
        {"id": "s3", "title": "Problem A", "titleSlug": "problem-a", "timestamp": sub_ts, "status": "Accepted"}
    ]
    res = evaluate_contest_evidence(
        student_id=1,
        student_name="Test Student",
        leetcode_username="testuser",
        contest_id=CONTEST_ID,
        contest_name=CONTEST_NAME,
        contest_start_utc=START_UTC,
        contest_end_utc=END_UTC,
        official_problems=OFFICIAL_PROBLEMS,
        ranking_history_attended=False,
        raw_submissions=subs
    )
    assert res.status == ContestStatus.VIRTUAL
    assert res.classification_signal == "post_window_only"
    assert res.problems_solved == 1
    assert res.live_solves == 0
    assert res.post_contest_solves == 1


def test_4_post_contest_only_1000_1010():
    """Test 4: 10:00 Accepted, 10:10 Accepted -> Expected: VIRTUAL"""
    # 10:00 AM IST = END_UNIX + 1800s, 10:10 AM IST = END_UNIX + 2400s
    subs = [
        {"id": "s4_1", "title": "Problem A", "titleSlug": "problem-a", "timestamp": END_UNIX + 1800, "status": "Accepted"},
        {"id": "s4_2", "title": "Problem B", "titleSlug": "problem-b", "timestamp": END_UNIX + 2400, "status": "Accepted"},
    ]
    res = evaluate_contest_evidence(
        student_id=1,
        student_name="Test Student",
        leetcode_username="testuser",
        contest_id=CONTEST_ID,
        contest_name=CONTEST_NAME,
        contest_start_utc=START_UTC,
        contest_end_utc=END_UTC,
        official_problems=OFFICIAL_PROBLEMS,
        ranking_history_attended=False,
        raw_submissions=subs
    )
    assert res.status == ContestStatus.VIRTUAL
    assert res.classification_signal == "post_window_only"
    assert res.problems_solved == 2
    assert res.live_solves == 0
    assert res.post_contest_solves == 2


def test_5_attended_true_zero_accepted_submissions():
    """Test 5: attended=true, no accepted submissions -> Expected: ATTENDED_ZERO"""
    res = evaluate_contest_evidence(
        student_id=1,
        student_name="Test Student",
        leetcode_username="testuser",
        contest_id=CONTEST_ID,
        contest_name=CONTEST_NAME,
        contest_start_utc=START_UTC,
        contest_end_utc=END_UTC,
        official_problems=OFFICIAL_PROBLEMS,
        ranking_history_attended=True,
        raw_submissions=[]
    )
    assert res.status == ContestStatus.ATTENDED_ZERO
    assert res.classification_signal == "no_submissions"
    assert res.problems_solved == 0
    assert res.live_solves == 0
    assert res.post_contest_solves == 0


def test_6_live_and_post_contest_solves_0820_1020():
    """Test 6: 08:20 Q1 Accepted, 10:20 Q2 Accepted -> Expected: LIVE, 2 / 4 solved"""
    subs = [
        {"id": "s6_1", "title": "Problem A", "titleSlug": "problem-a", "timestamp": START_UNIX + 1200, "status": "Accepted"}, # 08:20 AM IST
        {"id": "s6_2", "title": "Problem B", "titleSlug": "problem-b", "timestamp": END_UNIX + 3000, "status": "Accepted"},  # 10:20 AM IST
    ]
    res = evaluate_contest_evidence(
        student_id=1,
        student_name="Test Student",
        leetcode_username="testuser",
        contest_id=CONTEST_ID,
        contest_name=CONTEST_NAME,
        contest_start_utc=START_UTC,
        contest_end_utc=END_UTC,
        official_problems=OFFICIAL_PROBLEMS,
        ranking_history_attended=True,
        raw_submissions=subs
    )
    assert res.status == ContestStatus.LIVE
    assert res.classification_signal == "in_window_submission"
    assert res.problems_solved == 2
    assert res.live_solves == 1
    assert res.post_contest_solves == 1


def test_7_duplicate_submissions_same_problem():
    """Test 7: Q1 Accepted three times -> Expected: 1 solved"""
    subs = [
        {"id": "s7_1", "title": "Problem A", "titleSlug": "problem-a", "timestamp": START_UNIX + 600, "status": "Accepted"},
        {"id": "s7_2", "title": "Problem A", "titleSlug": "problem-a", "timestamp": START_UNIX + 900, "status": "Accepted"},
        {"id": "s7_3", "title": "Problem A", "titleSlug": "problem-a", "timestamp": START_UNIX + 1200, "status": "Accepted"},
    ]
    res = evaluate_contest_evidence(
        student_id=1,
        student_name="Test Student",
        leetcode_username="testuser",
        contest_id=CONTEST_ID,
        contest_name=CONTEST_NAME,
        contest_start_utc=START_UTC,
        contest_end_utc=END_UTC,
        official_problems=OFFICIAL_PROBLEMS,
        ranking_history_attended=True,
        raw_submissions=subs
    )
    assert res.status == ContestStatus.LIVE
    assert res.problems_solved == 1
    assert res.live_solves == 1


def test_8_unrelated_problem_accepted():
    """Test 8: Unrelated problem accepted (problem-x) -> Expected: does not increase contest solved count"""
    subs = [
        {"id": "s8_1", "title": "Unrelated Problem X", "titleSlug": "problem-x", "timestamp": START_UNIX + 600, "status": "Accepted"}
    ]
    res = evaluate_contest_evidence(
        student_id=1,
        student_name="Test Student",
        leetcode_username="testuser",
        contest_id=CONTEST_ID,
        contest_name=CONTEST_NAME,
        contest_start_utc=START_UTC,
        contest_end_utc=END_UTC,
        official_problems=OFFICIAL_PROBLEMS,
        ranking_history_attended=False,
        raw_submissions=subs
    )
    assert res.status == ContestStatus.NOT_ATTENDED
    assert res.problems_solved == 0
    assert res.live_solves == 0
    assert res.post_contest_solves == 0


def test_9_api_submission_endpoint_unavailable():
    """Test 9: API submission endpoint unavailable -> Expected: NOT_VERIFIED / DATA_ERROR (NOT 0 solved)"""
    res = evaluate_contest_evidence(
        student_id=1,
        student_name="Test Student",
        leetcode_username="testuser",
        contest_id=CONTEST_ID,
        contest_name=CONTEST_NAME,
        contest_start_utc=START_UTC,
        contest_end_utc=END_UTC,
        official_problems=OFFICIAL_PROBLEMS,
        ranking_history_attended=True,
        raw_submissions=None, # Submission data missing/failed
        fetch_error="HTTP 503 Service Unavailable"
    )
    assert res.status in (ContestStatus.NOT_VERIFIED, ContestStatus.FETCH_FAILED)
    assert res.classification_signal == "submission_evidence_unavailable"
    assert res.problems_solved is None
