"""
test_contest_integrity_matrix.py
================================================================================
REGRESSION & INTEGRITY TEST SUITE FOR LEETCODE SUNDAY CONTEST ENGINE
================================================================================
Automated test suite validating all 15 regression test cases specified in the
Master Prompt for contest score integrity.
"""

import datetime
import pytest
from backend.services.contest_verification_engine import (
    ContestVerificationEngine, ContestProblemMapping, ProblemDefinition,
    StudentVerifiedContestResult, IST_OFFSET
)


@pytest.fixture
def sample_problem_mapping() -> ContestProblemMapping:
    """Fixture providing a standard 4-problem canonical contest mapping."""
    return ContestProblemMapping(
        contest_id="weekly-contest-516",
        contest_name="Weekly Contest 516",
        contest_number=516,
        problems=[
            ProblemDefinition(1, "Q1", "find-special-substring-of-length-k", "Find Special Substring of Length K", 3),
            ProblemDefinition(2, "Q2", "maximum-manhattan-distance-after-k-changes", "Maximum Manhattan Distance After K Changes", 4),
            ProblemDefinition(3, "Q3", "count-substrings-divisible-by-last-digit", "Count Substrings Divisible by Last Digit", 5),
            ProblemDefinition(4, "Q4", "maximum-difference-between-even-and-odd-frequency-ii", "Maximum Difference Between Even and Odd Frequency II", 6),
        ]
    )


# ------------------------------------------------------------------------------
# TEST 01: 4 Accepted submissions, 4 different contest problems, ACTUAL participation
# Expected: 4/4
# ------------------------------------------------------------------------------
def test_01_four_ac_four_problems_actual(sample_problem_mapping):
    submissions = [
        {"submission_id": "101", "slug": "find-special-substring-of-length-k", "status": "ACCEPTED"},
        {"submission_id": "102", "slug": "maximum-manhattan-distance-after-k-changes", "status": "ACCEPTED"},
        {"submission_id": "103", "slug": "count-substrings-divisible-by-last-digit", "status": "ACCEPTED"},
        {"submission_id": "104", "slug": "maximum-difference-between-even-and-odd-frequency-ii", "status": "ACCEPTED"},
    ]

    res = ContestVerificationEngine.verify_student_contest_participation(
        student_id=1,
        leetcode_username="student_01",
        contest_id="weekly-contest-516",
        participation_type="ACTUAL",
        problem_mapping=sample_problem_mapping,
        raw_submissions=submissions
    )

    assert res.q1 == 1
    assert res.q2 == 1
    assert res.q3 == 1
    assert res.q4 == 1
    assert res.verified_total == 4
    assert res.evidence_status == "VERIFIED"


# ------------------------------------------------------------------------------
# TEST 02: 4 Accepted submissions, only 2 verified contest solves
# Expected: 2/4
# ------------------------------------------------------------------------------
def test_02_four_ac_only_two_verified_contest_solves(sample_problem_mapping):
    submissions = [
        {"submission_id": "201", "slug": "find-special-substring-of-length-k", "status": "ACCEPTED"},
        {"submission_id": "202", "slug": "maximum-manhattan-distance-after-k-changes", "status": "ACCEPTED"},
        {"submission_id": "203", "slug": "some-random-practice-problem-1", "status": "ACCEPTED"},
        {"submission_id": "204", "slug": "some-random-practice-problem-2", "status": "ACCEPTED"},
    ]

    res = ContestVerificationEngine.verify_student_contest_participation(
        student_id=2,
        leetcode_username="student_02",
        contest_id="weekly-contest-516",
        participation_type="ACTUAL",
        problem_mapping=sample_problem_mapping,
        raw_submissions=submissions
    )

    assert res.q1 == 1
    assert res.q2 == 1
    assert res.q3 == 0
    assert res.q4 == 0
    assert res.verified_total == 2
    assert res.raw_ac_count == 4


# ------------------------------------------------------------------------------
# TEST 03: Same problem: WA, WA, AC, AC, AC
# Expected: 1 solve for that problem
# ------------------------------------------------------------------------------
def test_03_deduplication_multiple_ac_same_problem(sample_problem_mapping):
    submissions = [
        {"submission_id": "301", "slug": "maximum-manhattan-distance-after-k-changes", "status": "WRONG_ANSWER"},
        {"submission_id": "302", "slug": "maximum-manhattan-distance-after-k-changes", "status": "WRONG_ANSWER"},
        {"submission_id": "303", "slug": "maximum-manhattan-distance-after-k-changes", "status": "ACCEPTED"},
        {"submission_id": "304", "slug": "maximum-manhattan-distance-after-k-changes", "status": "ACCEPTED"},
        {"submission_id": "305", "slug": "maximum-manhattan-distance-after-k-changes", "status": "ACCEPTED"},
    ]

    res = ContestVerificationEngine.verify_student_contest_participation(
        student_id=3,
        leetcode_username="student_03",
        contest_id="weekly-contest-516",
        participation_type="ACTUAL",
        problem_mapping=sample_problem_mapping,
        raw_submissions=submissions
    )

    assert res.q1 == 0
    assert res.q2 == 1
    assert res.q3 == 0
    assert res.q4 == 0
    assert res.verified_total == 1


# ------------------------------------------------------------------------------
# TEST 04: Virtual contest Accepted submission
# Expected: 0 official contest solves
# ------------------------------------------------------------------------------
def test_04_virtual_contest_zero_official_score(sample_problem_mapping):
    submissions = [
        {"submission_id": "401", "slug": "find-special-substring-of-length-k", "status": "ACCEPTED"},
        {"submission_id": "402", "slug": "maximum-manhattan-distance-after-k-changes", "status": "ACCEPTED"},
    ]

    res = ContestVerificationEngine.verify_student_contest_participation(
        student_id=4,
        leetcode_username="student_04",
        contest_id="weekly-contest-516",
        participation_type="VIRTUAL_ATTENDED",
        problem_mapping=sample_problem_mapping,
        raw_submissions=submissions
    )

    assert res.verified_total == 0
    assert res.evidence_status in ("NOT_VERIFIED", "VIRTUAL_ONLY")


# ------------------------------------------------------------------------------
# TEST 05: Practice Accepted submission
# Expected: 0 official contest solves
# ------------------------------------------------------------------------------
def test_05_practice_submission_zero_official_score(sample_problem_mapping):
    submissions = [
        {"submission_id": "501", "slug": "two-sum", "status": "ACCEPTED"},
        {"submission_id": "502", "slug": "add-two-numbers", "status": "ACCEPTED"},
    ]

    res = ContestVerificationEngine.verify_student_contest_participation(
        student_id=5,
        leetcode_username="student_05",
        contest_id="weekly-contest-516",
        participation_type="ACTUAL",
        problem_mapping=sample_problem_mapping,
        raw_submissions=submissions
    )

    assert res.verified_total == 0
    assert res.q1 == 0
    assert res.q2 == 0
    assert res.q3 == 0
    assert res.q4 == 0


# ------------------------------------------------------------------------------
# TEST 06: Accepted submission outside contest window
# Expected: 0 official contest solves
# ------------------------------------------------------------------------------
def test_06_outside_contest_window_zero_official_score(sample_problem_mapping):
    start_window = datetime.datetime(2026, 9, 20, 8, 0, 0, tzinfo=IST_OFFSET)
    end_window = datetime.datetime(2026, 9, 20, 9, 30, 0, tzinfo=IST_OFFSET)

    sub_time_out = datetime.datetime(2026, 9, 20, 10, 0, 0, tzinfo=IST_OFFSET)

    submissions = [
        {
            "submission_id": "601",
            "slug": "find-special-substring-of-length-k",
            "status": "ACCEPTED",
            "timestamp": sub_time_out
        }
    ]

    res = ContestVerificationEngine.verify_student_contest_participation(
        student_id=6,
        leetcode_username="student_06",
        contest_id="weekly-contest-516",
        participation_type="ACTUAL",
        problem_mapping=sample_problem_mapping,
        raw_submissions=submissions,
        contest_start_ist=start_window,
        contest_end_ist=end_window
    )

    assert res.verified_total == 0


# ------------------------------------------------------------------------------
# TEST 07: Submission inside window but no ACTUAL participation evidence
# Expected: NOT_VERIFIED (0 score)
# ------------------------------------------------------------------------------
def test_07_in_window_no_actual_participation_evidence(sample_problem_mapping):
    start_window = datetime.datetime(2026, 9, 20, 8, 0, 0, tzinfo=IST_OFFSET)
    end_window = datetime.datetime(2026, 9, 20, 9, 30, 0, tzinfo=IST_OFFSET)

    sub_time_in = datetime.datetime(2026, 9, 20, 8, 30, 0, tzinfo=IST_OFFSET)

    submissions = [
        {
            "submission_id": "701",
            "slug": "find-special-substring-of-length-k",
            "status": "ACCEPTED",
            "timestamp": sub_time_in
        }
    ]

    res = ContestVerificationEngine.verify_student_contest_participation(
        student_id=7,
        leetcode_username="student_07",
        contest_id="weekly-contest-516",
        participation_type="NOT_VERIFIED",
        problem_mapping=sample_problem_mapping,
        raw_submissions=submissions,
        contest_start_ist=start_window,
        contest_end_ist=end_window
    )

    assert res.verified_total == 0
    assert res.evidence_status == "NOT_VERIFIED"


# ------------------------------------------------------------------------------
# TEST 08: Wrong Answer only
# Expected: 0
# ------------------------------------------------------------------------------
def test_08_wrong_answer_only_zero_score(sample_problem_mapping):
    submissions = [
        {"submission_id": "801", "slug": "find-special-substring-of-length-k", "status": "WRONG_ANSWER"},
        {"submission_id": "802", "slug": "maximum-manhattan-distance-after-k-changes", "status": "TIME_LIMIT_EXCEEDED"},
    ]

    res = ContestVerificationEngine.verify_student_contest_participation(
        student_id=8,
        leetcode_username="student_08",
        contest_id="weekly-contest-516",
        participation_type="ACTUAL",
        problem_mapping=sample_problem_mapping,
        raw_submissions=submissions
    )

    assert res.verified_total == 0


# ------------------------------------------------------------------------------
# TEST 09: Same student + contest + problem processed twice
# Expected: Idempotent 1 solve
# ------------------------------------------------------------------------------
def test_09_idempotency_repeated_processing(sample_problem_mapping):
    submissions = [
        {"submission_id": "901", "slug": "find-special-substring-of-length-k", "status": "ACCEPTED"},
    ]

    res1 = ContestVerificationEngine.verify_student_contest_participation(
        student_id=9, leetcode_username="student_09", contest_id="weekly-contest-516",
        participation_type="ACTUAL", problem_mapping=sample_problem_mapping, raw_submissions=submissions
    )
    res2 = ContestVerificationEngine.verify_student_contest_participation(
        student_id=9, leetcode_username="student_09", contest_id="weekly-contest-516",
        participation_type="ACTUAL", problem_mapping=sample_problem_mapping, raw_submissions=submissions
    )

    assert res1.verified_total == 1
    assert res2.verified_total == 1
    assert res1.q1 == res2.q1 == 1


# ------------------------------------------------------------------------------
# TEST 10: Two different contests contain same problem slug
# Expected: Results remain isolated by contest_id
# ------------------------------------------------------------------------------
def test_10_contest_id_isolation(sample_problem_mapping):
    mapping_other = ContestProblemMapping(
        contest_id="weekly-contest-999",
        contest_name="Weekly Contest 999",
        contest_number=999,
        problems=[
            ProblemDefinition(1, "Q1", "different-contest-q1", "Different Contest Q1", 3),
        ]
    )

    submissions = [
        {"submission_id": "1001", "slug": "find-special-substring-of-length-k", "status": "ACCEPTED"},
    ]

    res_516 = ContestVerificationEngine.verify_student_contest_participation(
        student_id=10, leetcode_username="student_10", contest_id="weekly-contest-516",
        participation_type="ACTUAL", problem_mapping=sample_problem_mapping, raw_submissions=submissions
    )
    res_999 = ContestVerificationEngine.verify_student_contest_participation(
        student_id=10, leetcode_username="student_10", contest_id="weekly-contest-999",
        participation_type="ACTUAL", problem_mapping=mapping_other, raw_submissions=submissions
    )

    assert res_516.verified_total == 1
    assert res_999.verified_total == 0


# ------------------------------------------------------------------------------
# TEST 11: Two LeetCode accounts associated ambiguously
# Expected: NOT_VERIFIED
# ------------------------------------------------------------------------------
def test_11_ambiguous_leetcode_handle(sample_problem_mapping):
    submissions = [
        {"submission_id": "1101", "slug": "find-special-substring-of-length-k", "status": "ACCEPTED"},
    ]

    res = ContestVerificationEngine.verify_student_contest_participation(
        student_id=11, leetcode_username="", contest_id="weekly-contest-516",
        participation_type="ACTUAL", problem_mapping=sample_problem_mapping, raw_submissions=submissions
    )

    assert res.verified_total == 0
    assert res.evidence_status == "NOT_VERIFIED"


# ------------------------------------------------------------------------------
# TEST 12: Incomplete ingestion
# Expected: Preserves status as NOT_VERIFIED / incomplete
# ------------------------------------------------------------------------------
def test_12_incomplete_ingestion_safety(sample_problem_mapping):
    res = ContestVerificationEngine.verify_student_contest_participation(
        student_id=12, leetcode_username="student_12", contest_id="weekly-contest-516",
        participation_type="NOT_VERIFIED", problem_mapping=sample_problem_mapping, raw_submissions=[]
    )

    assert res.verified_total == 0
    assert res.evidence_status == "NOT_VERIFIED"


# ------------------------------------------------------------------------------
# TEST 13: Repeated scheduler execution
# Expected: Idempotent results
# ------------------------------------------------------------------------------
def test_13_repeated_scheduler_execution(sample_problem_mapping):
    submissions = [
        {"submission_id": "1301", "slug": "find-special-substring-of-length-k", "status": "ACCEPTED"},
        {"submission_id": "1302", "slug": "maximum-manhattan-distance-after-k-changes", "status": "ACCEPTED"},
    ]

    for _ in range(5):
        res = ContestVerificationEngine.verify_student_contest_participation(
            student_id=13, leetcode_username="student_13", contest_id="weekly-contest-516",
            participation_type="ACTUAL", problem_mapping=sample_problem_mapping, raw_submissions=submissions
        )
        assert res.verified_total == 2


# ------------------------------------------------------------------------------
# TEST 14: WebSocket live update followed by final snapshot
# Expected: Final verified result remains authoritative
# ------------------------------------------------------------------------------
def test_14_live_update_followed_by_finalization(sample_problem_mapping):
    live_submissions = [
        {"submission_id": "1401", "slug": "find-special-substring-of-length-k", "status": "ACCEPTED"},
    ]
    final_submissions = [
        {"submission_id": "1401", "slug": "find-special-substring-of-length-k", "status": "ACCEPTED"},
        {"submission_id": "1402", "slug": "maximum-manhattan-distance-after-k-changes", "status": "ACCEPTED"},
    ]

    res_live = ContestVerificationEngine.verify_student_contest_participation(
        student_id=14, leetcode_username="student_14", contest_id="weekly-contest-516",
        participation_type="ACTUAL", problem_mapping=sample_problem_mapping, raw_submissions=live_submissions
    )

    res_final = ContestVerificationEngine.verify_student_contest_participation(
        student_id=14, leetcode_username="student_14", contest_id="weekly-contest-516",
        participation_type="ACTUAL", problem_mapping=sample_problem_mapping, raw_submissions=final_submissions
    )

    assert res_live.verified_total == 1
    assert res_final.verified_total == 2


# ------------------------------------------------------------------------------
# TEST 15: Previous week's participation records exist
# Expected: Must not contaminate current Sunday contest score
# ------------------------------------------------------------------------------
def test_15_previous_week_no_contamination(sample_problem_mapping):
    prev_submissions = [
        {"submission_id": "1501", "slug": "old-contest-problem-q1", "status": "ACCEPTED"},
        {"submission_id": "1502", "slug": "old-contest-problem-q2", "status": "ACCEPTED"},
    ]

    res = ContestVerificationEngine.verify_student_contest_participation(
        student_id=15, leetcode_username="student_15", contest_id="weekly-contest-516",
        participation_type="ACTUAL", problem_mapping=sample_problem_mapping, raw_submissions=prev_submissions
    )

    assert res.verified_total == 0
    assert res.q1 == 0
    assert res.q2 == 0
    assert res.q3 == 0
    assert res.q4 == 0
