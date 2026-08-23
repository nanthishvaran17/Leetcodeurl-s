"""
test_weekly_contest_strict_problem_accuracy.py
================================================================================
COMPREHENSIVE TEST SUITE FOR WEEKLY CONTEST STRICT PROBLEM-LEVEL ACCURACY
================================================================================
Validates all required scenarios:
A. Four accepted official problems -> 4/4
B. Three accepted official problems -> 3/4
C. Two accepted official problems -> 2/4
D. One accepted official problem -> 1/4
E. Zero accepted problems -> 0/4
F. Wrong-answer submission -> 0 for that problem
G. Unrelated daily problem -> ignored
H. Similar title but different slug -> ignored
I. Wrong contest problem -> ignored
J. Problem mapping mismatch -> publication blocked (PROBLEM_SET_MISMATCH)
K. Score mismatch -> flag, don't fabricate (CONTEST_DATA_INCONSISTENCY)
L. Department totals reconcile across all 11 departments
M. Year totals reconcile across all 3 academic years
N. Institutional totals reconcile with 100% mathematical invariance
"""

import pytest
from backend.services.contest_problem_accuracy_engine import (
    ContestProblemAccuracyEngine,
    ContestProblemSet,
    ContestProblemDefinition,
    INSTITUTIONAL_DEPARTMENTS,
    INSTITUTIONAL_ACADEMIC_YEARS
)


@pytest.fixture
def contest_516_problems():
    """Authoritative official problem set for Weekly Contest 516."""
    return ContestProblemAccuracyEngine.resolve_official_problem_set(contest_number=516)


# ─── SCENARIOS A, B, C, D, E: EXACT PROBLEM COUNTS (4/4, 3/4, 2/4, 1/4, 0/4) ───

def test_scenario_a_four_accepted_problems_is_4_of_4(contest_516_problems):
    """Scenario A: 4 verified accepted official problems -> 4/4 perfect tier."""
    submissions = [
        {"title_slug": "find-special-substring-of-length-k", "status": "ACCEPTED"},
        {"title_slug": "maximum-manhattan-distance-after-k-changes", "status": "ACCEPTED"},
        {"title_slug": "count-substrings-divisible-by-last-digit", "status": "ACCEPTED"},
        {"title_slug": "maximum-difference-between-even-and-odd-frequency-ii", "status": "ACCEPTED"},
    ]
    res = ContestProblemAccuracyEngine.evaluate_student_submissions(contest_516_problems, submissions)
    assert res["q1"] == 1
    assert res["q2"] == 1
    assert res["q3"] == 1
    assert res["q4"] == 1
    assert res["solved"] == 4
    assert res["tier"] == "4/4"
    assert res["score"] == 18  # 3 + 4 + 5 + 6


def test_scenario_b_three_accepted_problems_is_3_of_4(contest_516_problems):
    """Scenario B: 3 verified accepted official problems -> 3/4 tier."""
    submissions = [
        {"title_slug": "find-special-substring-of-length-k", "status": "ACCEPTED"},
        {"title_slug": "maximum-manhattan-distance-after-k-changes", "status": "ACCEPTED"},
        {"title_slug": "count-substrings-divisible-by-last-digit", "status": "ACCEPTED"},
    ]
    res = ContestProblemAccuracyEngine.evaluate_student_submissions(contest_516_problems, submissions)
    assert res["q1"] == 1
    assert res["q2"] == 1
    assert res["q3"] == 1
    assert res["q4"] == 0
    assert res["solved"] == 3
    assert res["tier"] == "3/4"
    assert res["score"] == 12  # 3 + 4 + 5


def test_scenario_c_two_accepted_problems_is_2_of_4(contest_516_problems):
    """Scenario C: 2 verified accepted official problems -> 2/4 tier."""
    submissions = [
        {"title_slug": "find-special-substring-of-length-k", "status": "ACCEPTED"},
        {"title_slug": "maximum-manhattan-distance-after-k-changes", "status": "ACCEPTED"},
    ]
    res = ContestProblemAccuracyEngine.evaluate_student_submissions(contest_516_problems, submissions)
    assert res["q1"] == 1
    assert res["q2"] == 1
    assert res["q3"] == 0
    assert res["q4"] == 0
    assert res["solved"] == 2
    assert res["tier"] == "2/4"
    assert res["score"] == 7  # 3 + 4


def test_scenario_d_one_accepted_problem_is_1_of_4(contest_516_problems):
    """Scenario D: 1 verified accepted official problem -> 1/4 tier."""
    submissions = [
        {"title_slug": "find-special-substring-of-length-k", "status": "ACCEPTED"},
    ]
    res = ContestProblemAccuracyEngine.evaluate_student_submissions(contest_516_problems, submissions)
    assert res["q1"] == 1
    assert res["q2"] == 0
    assert res["q3"] == 0
    assert res["q4"] == 0
    assert res["solved"] == 1
    assert res["tier"] == "1/4"
    assert res["score"] == 3


def test_scenario_e_zero_accepted_problems_is_0_of_4(contest_516_problems):
    """Scenario E: Zero accepted official problems -> 0/4 tier."""
    submissions = []
    res = ContestProblemAccuracyEngine.evaluate_student_submissions(contest_516_problems, submissions)
    assert res["q1"] == 0
    assert res["q2"] == 0
    assert res["q3"] == 0
    assert res["q4"] == 0
    assert res["solved"] == 0
    assert res["tier"] == "0/4"
    assert res["score"] == 0


# ─── SCENARIOS F, G, H, I: NON-ACCEPTED / UNRELATED / FUZZY PROBLEM REJECTION ──

def test_scenario_f_wrong_answer_is_not_counted(contest_516_problems):
    """Scenario F: Wrong-answer, TLE, and Runtime Error submissions do not count as solved."""
    submissions = [
        {"title_slug": "find-special-substring-of-length-k", "status": "ACCEPTED"},
        {"title_slug": "maximum-manhattan-distance-after-k-changes", "status": "WRONG_ANSWER"},
        {"title_slug": "count-substrings-divisible-by-last-digit", "status": "TIME_LIMIT_EXCEEDED"},
        {"title_slug": "maximum-difference-between-even-and-odd-frequency-ii", "status": "RUNTIME_ERROR"},
    ]
    res = ContestProblemAccuracyEngine.evaluate_student_submissions(contest_516_problems, submissions)
    assert res["q1"] == 1
    assert res["q2"] == 0
    assert res["q3"] == 0
    assert res["q4"] == 0
    assert res["solved"] == 1
    assert res["tier"] == "1/4"


def test_scenario_g_unrelated_daily_problem_ignored(contest_516_problems):
    """Scenario G: Unrelated daily problems solved during contest window are ignored."""
    submissions = [
        {"title_slug": "find-special-substring-of-length-k", "status": "ACCEPTED"},
        {"title_slug": "two-sum", "status": "ACCEPTED"},  # Unrelated daily problem
        {"title_slug": "climbing-stairs", "status": "ACCEPTED"},  # Unrelated problem
    ]
    res = ContestProblemAccuracyEngine.evaluate_student_submissions(contest_516_problems, submissions)
    assert res["q1"] == 1
    assert res["q2"] == 0
    assert res["q3"] == 0
    assert res["q4"] == 0
    assert res["solved"] == 1
    assert "two-sum" not in res["accepted_slugs"]


def test_scenario_h_similar_title_different_slug_ignored(contest_516_problems):
    """Scenario H: Problem with similar title text but different slug is ignored."""
    submissions = [
        # Similar title words but belongs to Contest 515 (Version I), not Contest 516 (Version II)
        {"title_slug": "maximum-difference-between-even-and-odd-frequency-i", "status": "ACCEPTED"},
    ]
    res = ContestProblemAccuracyEngine.evaluate_student_submissions(contest_516_problems, submissions)
    # Q4 is maximum-difference-between-even-and-odd-frequency-ii, so Version I must NOT match
    assert res["q4"] == 0
    assert res["solved"] == 0


def test_scenario_i_wrong_contest_problem_ignored(contest_516_problems):
    """Scenario I: Solves from previous contests (e.g. Contest 514) are ignored."""
    submissions = [
        {"title_slug": "check-if-digits-are-equal-in-string-after-operations-i", "status": "ACCEPTED"},
        {"title_slug": "check-if-digits-are-equal-in-string-after-operations-ii", "status": "ACCEPTED"},
    ]
    res = ContestProblemAccuracyEngine.evaluate_student_submissions(contest_516_problems, submissions)
    assert res["solved"] == 0
    assert res["tier"] == "0/4"


# ─── SCENARIOS J, K: MISMATCH PROTECTION & SCORE INCONSISTENCY FLAGGING ────────

def test_scenario_j_problem_mapping_mismatch_blocks_publication():
    """Scenario J: Incomplete or mismatched problem set is flagged and publication blocked."""
    invalid_set = ContestProblemSet(
        contest_number=999,
        contest_id="weekly-contest-999",
        contest_name="Weekly Contest 999",
        problems=[],  # Missing problems
        is_valid=False,
        validation_error="Missing official problems",
        problem_set_status="PROBLEM_SET_MISMATCH"
    )
    res = ContestProblemAccuracyEngine.evaluate_student_submissions(invalid_set, [{"title_slug": "dummy", "status": "ACCEPTED"}])
    assert res["status"] == "PROBLEM_SET_MISMATCH"
    assert res["inconsistency_flag"] == "PROBLEM_SET_MISMATCH"
    assert res["solved"] == 0


def test_scenario_k_score_inconsistency_is_flagged_without_fabrication(contest_516_problems):
    """Scenario K: Divergent recorded score is flagged with CONTEST_DATA_INCONSISTENCY."""
    # Student solved Q1 (3 pts) only, but recorded score was reported as 18
    submissions = [
        {"title_slug": "find-special-substring-of-length-k", "status": "ACCEPTED"}
    ]
    res = ContestProblemAccuracyEngine.evaluate_student_submissions(
        contest_516_problems, submissions, recorded_score=18
    )
    assert res["solved"] == 1
    assert res["tier"] == "1/4"  # Solved count remains strictly 1 (NOT fabricated to 4)
    assert res["is_consistent"] is False
    assert res["inconsistency_flag"] == "CONTEST_DATA_INCONSISTENCY"


# ─── SCENARIOS L, M, N: RECONCILIATIONS ACROSS DEPARTMENTS, YEARS & INSTITUTION ──

def test_scenarios_l_m_n_full_mathematical_reconciliation():
    """
    Scenarios L, M, N:
    Validates that:
    1. Total Solvers = N4 + N3 + N2 + N1 + N0 across 767 live attendees.
    2. Total Solves = Q1_total + Q2_total + Q3_total + Q4_total.
    3. Every one of the 11 departments reconciles 100%.
    4. Every one of the 3 academic years reconciles 100%.
    """
    students_mock = []
    
    # 42 students with 4/4
    for i in range(42):
        dept = INSTITUTIONAL_DEPARTMENTS[i % len(INSTITUTIONAL_DEPARTMENTS)]
        yr = INSTITUTIONAL_ACADEMIC_YEARS[i % len(INSTITUTIONAL_ACADEMIC_YEARS)]
        students_mock.append({"reg_no": f"ST_4_{i}", "name": f"Student 4_{i}", "dept": dept, "year": yr, "q1": 1, "q2": 1, "q3": 1, "q4": 1})

    # 148 students with 3/4
    for i in range(148):
        dept = INSTITUTIONAL_DEPARTMENTS[i % len(INSTITUTIONAL_DEPARTMENTS)]
        yr = INSTITUTIONAL_ACADEMIC_YEARS[i % len(INSTITUTIONAL_ACADEMIC_YEARS)]
        students_mock.append({"reg_no": f"ST_3_{i}", "name": f"Student 3_{i}", "dept": dept, "year": yr, "q1": 1, "q2": 1, "q3": 1, "q4": 0})

    # 306 students with 2/4
    for i in range(306):
        dept = INSTITUTIONAL_DEPARTMENTS[i % len(INSTITUTIONAL_DEPARTMENTS)]
        yr = INSTITUTIONAL_ACADEMIC_YEARS[i % len(INSTITUTIONAL_ACADEMIC_YEARS)]
        students_mock.append({"reg_no": f"ST_2_{i}", "name": f"Student 2_{i}", "dept": dept, "year": yr, "q1": 1, "q2": 1, "q3": 0, "q4": 0})

    # 271 students with 1/4
    for i in range(271):
        dept = INSTITUTIONAL_DEPARTMENTS[i % len(INSTITUTIONAL_DEPARTMENTS)]
        yr = INSTITUTIONAL_ACADEMIC_YEARS[i % len(INSTITUTIONAL_ACADEMIC_YEARS)]
        students_mock.append({"reg_no": f"ST_1_{i}", "name": f"Student 1_{i}", "dept": dept, "year": yr, "q1": 1, "q2": 0, "q3": 0, "q4": 0})

    total_evaluated = len(students_mock)
    assert total_evaluated == 767  # 42 + 148 + 306 + 271

    audit = ContestProblemAccuracyEngine.calculate_distribution_and_reconcile(students_mock, total_expected_population=767)

    # Invariant 1: Total population reconciliation
    assert audit["is_population_reconciled"] is True
    assert audit["tier_counts"]["n4"] == 42
    assert audit["tier_counts"]["n3"] == 148
    assert audit["tier_counts"]["n2"] == 306
    assert audit["tier_counts"]["n1"] == 271
    assert audit["tier_counts"]["n0"] == 0

    # Invariant 2: Question total sum reconciliation
    q_tot = audit["question_totals"]
    assert q_tot["q1"] == 767  # All 767 solved Q1
    assert q_tot["q2"] == 42 + 148 + 306  # 496
    assert q_tot["q3"] == 42 + 148  # 190
    assert q_tot["q4"] == 42  # 42
    assert q_tot["total_solves"] == 767 + 496 + 190 + 42

    # Invariant 3: Department Reconciliation across all 11 departments
    assert audit["department_reconciliation_valid"] is True
    dept_sum = sum(d["total"] for d in audit["department_reconciliation"].values())
    assert dept_sum == 767

    # Invariant 4: Year Reconciliation across all 3 academic years
    assert audit["year_reconciliation_valid"] is True
    year_sum = sum(y["total"] for y in audit["year_reconciliation"].values())
    assert year_sum == 767
