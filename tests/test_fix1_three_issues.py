"""
tests/test_fix1_three_issues.py
================================
Unit tests targeting the 3 specific Fix 1 issues:
1. Official Contest Problem Filtering (unrelated problems are ignored).
2. Deduplication of Accepted Submissions for the same problem.
3. ATTENDED_ZERO classification when attended=True and 0 accepted contest-problem solves exist.
"""

import datetime
import pytest
from backend.services.contest_classifier import evaluate_contest_evidence, ContestStatus, ReasonCode

START_UTC = datetime.datetime(2026, 9, 20, 2, 30, 0, tzinfo=datetime.timezone.utc) # 08:00 AM IST
END_UTC = datetime.datetime(2026, 9, 20, 4, 0, 0, tzinfo=datetime.timezone.utc)    # 09:30 AM IST

OFFICIAL_PROBLEMS = [
    {"question_order": 1, "title": "Intersecting Pairs I", "titleSlug": "number-of-intersecting-interval-pairs-i"},
    {"question_order": 2, "title": "Intersecting Pairs II", "titleSlug": "number-of-intersecting-interval-pairs-ii"},
    {"question_order": 3, "title": "Max Pulse Value", "titleSlug": "maximum-pulse-value-after-one-subarray-rotation"},
    {"question_order": 4, "title": "Lexicographical Power Array", "titleSlug": "lexicographically-largest-power-array"},
]

def test_issue1_unrelated_problem_filtered():
    """Verify that general LeetCode problems outside official problem list are ignored."""
    raw_submissions = [
        {
            "id": "101",
            "title": "Add Binary",
            "titleSlug": "add-binary", # UNRELATED PROBLEM!
            "timestamp": int(START_UTC.timestamp()) + 1800, # During window!
            "status": "Accepted"
        },
        {
            "id": "102",
            "title": "Text Justification",
            "titleSlug": "text-justification", # UNRELATED PROBLEM!
            "timestamp": int(END_UTC.timestamp()) + 3600, # Post window!
            "status": "Accepted"
        }
    ]

    res = evaluate_contest_evidence(
        student_id=1,
        student_name="Test Student",
        leetcode_username="test_user",
        contest_id="weekly-contest-520",
        contest_name="Weekly Contest 520",
        contest_start_utc=START_UTC,
        contest_end_utc=END_UTC,
        official_problems=OFFICIAL_PROBLEMS,
        ranking_history_attended=True,
        raw_submissions=raw_submissions
    )

    # Since all submissions were for unrelated problems, solve count must be 0!
    assert res.problems_solved == 0
    assert res.live_solves == 0
    assert res.post_contest_solves == 0
    # Attended=True with 0 contest solves must give ATTENDED_ZERO!
    assert res.status == ContestStatus.ATTENDED_ZERO
    assert res.classification_signal == "no_submissions"
    assert len(res.solve_timeline) == 0

def test_issue2_deduplication_same_problem():
    """Verify multiple AC submissions for the same problem count as 1 solved problem."""
    raw_submissions = [
        {
            "id": "201",
            "title": "Intersecting Pairs I",
            "titleSlug": "number-of-intersecting-interval-pairs-i",
            "timestamp": int(START_UTC.timestamp()) + 900,
            "status": "Accepted"
        },
        {
            "id": "202",
            "title": "Intersecting Pairs I",
            "titleSlug": "number-of-intersecting-interval-pairs-i", # REPEATED AC SUBMISSION!
            "timestamp": int(START_UTC.timestamp()) + 1200,
            "status": "Accepted"
        },
        {
            "id": "203",
            "title": "Intersecting Pairs I",
            "titleSlug": "number-of-intersecting-interval-pairs-i", # REPEATED AC SUBMISSION!
            "timestamp": int(START_UTC.timestamp()) + 1500,
            "status": "Accepted"
        }
    ]

    res = evaluate_contest_evidence(
        student_id=2,
        student_name="Test Student 2",
        leetcode_username="test_user_2",
        contest_id="weekly-contest-520",
        contest_name="Weekly Contest 520",
        contest_start_utc=START_UTC,
        contest_end_utc=END_UTC,
        official_problems=OFFICIAL_PROBLEMS,
        ranking_history_attended=True,
        raw_submissions=raw_submissions
    )

    # 3 AC submissions for Q1 must count as EXACTLY 1 unique problem solved!
    assert res.problems_solved == 1
    assert res.live_solves == 1
    assert res.status in (ContestStatus.LIVE, ContestStatus.PUBLIC_ATTENDED)
    assert res.q1_solved is True
    assert res.q2_solved is False

def test_issue3_attended_zero_classification():
    """Verify attended=True with 0 accepted contest-problem solves produces ATTENDED_ZERO."""
    res = evaluate_contest_evidence(
        student_id=3,
        student_name="Test Student 3",
        leetcode_username="test_user_3",
        contest_id="weekly-contest-520",
        contest_name="Weekly Contest 520",
        contest_start_utc=START_UTC,
        contest_end_utc=END_UTC,
        official_problems=OFFICIAL_PROBLEMS,
        ranking_history_attended=True,
        raw_submissions=[] # Zero AC submissions
    )

    assert res.problems_solved == 0
    assert res.status == ContestStatus.ATTENDED_ZERO
    assert res.classification_signal == "no_submissions"
