import pytest
import datetime
from zoneinfo import ZoneInfo
from backend.services.contest_problem_accuracy_engine import ContestProblemSet, ContestProblemDefinition
from backend.contest_truth_engine import ContestTruthEngine

IST = ZoneInfo("Asia/Kolkata")

class MockStudent:
    def __init__(self, id, reg_no, name, username):
        self.id = id
        self.reg_no = reg_no
        self.name = name
        self.username = username
        self.year_level = "III"
        self.department = type("Dept", (), {"code": "IT", "name": "Information Technology"})()

def test_student_a_all_four_accepted_during_contest():
    """
    Test Case Student A:
    Q1 accepted during contest
    Q2 accepted during contest
    Q3 accepted during contest
    Q4 accepted during contest
    Expected: Q1=1, Q2=1, Q3=1, Q4=1, TOTAL=4
    """
    engine = ContestTruthEngine()
    
    # Contest window: Sunday 2026-09-20 08:00 to 09:30 IST
    c_start = datetime.datetime(2026, 9, 20, 8, 0, 0, tzinfo=IST)
    
    submissions = [
        {"titleSlug": "q1-slug", "status": "ACCEPTED", "timestamp": int((c_start + datetime.timedelta(minutes=10)).timestamp())},
        {"titleSlug": "q2-slug", "status": "ACCEPTED", "timestamp": int((c_start + datetime.timedelta(minutes=25)).timestamp())},
        {"titleSlug": "q3-slug", "status": "ACCEPTED", "timestamp": int((c_start + datetime.timedelta(minutes=45)).timestamp())},
        {"titleSlug": "q4-slug", "status": "ACCEPTED", "timestamp": int((c_start + datetime.timedelta(minutes=75)).timestamp())},
    ]
    
    raw_data = {
        "userContestRankingHistory": [{"contest": {"title": "Weekly Contest 520"}, "attended": True, "problemsSolved": 4}],
        "recentAcSubmissionList": submissions
    }
    
    result = engine.verify_contest_evidence(
        username="student_a",
        contest_id="weekly-contest-520",
        contest_problems=["q1-slug", "q2-slug", "q3-slug", "q4-slug"],
        raw_data=raw_data
    )
    
    q_mat = result["q_matrix"]
    assert q_mat["Q1"] is True
    assert q_mat["Q2"] is True
    assert q_mat["Q3"] is True
    assert q_mat["Q4"] is True
    assert result["verified_solved_count"] == 4
    assert result["solved_count"] == 4

def test_student_b_q4_accepted_after_contest_window():
    """
    Test Case Student B:
    Q1 accepted during contest (08:10 IST)
    Q2 accepted during contest (08:25 IST)
    Q3 accepted during contest (08:45 IST)
    Q4 accepted AFTER contest window (10:20 IST)
    Expected: Q1=1, Q2=1, Q3=1, Q4=0, TOTAL=3
    """
    engine = ContestTruthEngine()
    c_start = datetime.datetime(2026, 9, 20, 8, 0, 0, tzinfo=IST)
    
    submissions = [
        {"titleSlug": "q1-slug", "status": "ACCEPTED", "timestamp": int((c_start + datetime.timedelta(minutes=10)).timestamp())},
        {"titleSlug": "q2-slug", "status": "ACCEPTED", "timestamp": int((c_start + datetime.timedelta(minutes=25)).timestamp())},
        {"titleSlug": "q3-slug", "status": "ACCEPTED", "timestamp": int((c_start + datetime.timedelta(minutes=45)).timestamp())},
        {"titleSlug": "q4-slug", "status": "ACCEPTED", "timestamp": int((c_start + datetime.timedelta(hours=2, minutes=20)).timestamp())}, # 10:20 IST
    ]
    
    raw_data = {
        "userContestRankingHistory": [{"contest": {"title": "Weekly Contest 520"}, "attended": True, "problemsSolved": 3}],
        "recentAcSubmissionList": submissions
    }
    
    result = engine.verify_contest_evidence(
        username="student_b",
        contest_id="weekly-contest-520",
        contest_problems=["q1-slug", "q2-slug", "q3-slug", "q4-slug"],
        raw_data=raw_data
    )
    
    q_mat = result["q_matrix"]
    assert q_mat["Q1"] is True
    assert q_mat["Q2"] is True
    assert q_mat["Q3"] is True
    assert q_mat["Q4"] is False, "Q4 submission after contest window must NOT produce Q4=1"
    assert result["verified_solved_count"] == 3
    assert result["solved_count"] == 3

def test_student_c_four_accepted_in_window_plus_10_extra_outside():
    """
    Test Case Student C:
    Q1, Q2, Q3, Q4 accepted during contest window
    Additional 10 accepted submissions outside contest window
    Expected: Q1=1, Q2=1, Q3=1, Q4=1, TOTAL=4
    The extra submissions outside contest window must NOT alter the contest result.
    """
    engine = ContestTruthEngine()
    c_start = datetime.datetime(2026, 9, 20, 8, 0, 0, tzinfo=IST)
    
    submissions = [
        {"titleSlug": "q1-slug", "status": "ACCEPTED", "timestamp": int((c_start + datetime.timedelta(minutes=10)).timestamp())},
        {"titleSlug": "q2-slug", "status": "ACCEPTED", "timestamp": int((c_start + datetime.timedelta(minutes=25)).timestamp())},
        {"titleSlug": "q3-slug", "status": "ACCEPTED", "timestamp": int((c_start + datetime.timedelta(minutes=45)).timestamp())},
        {"titleSlug": "q4-slug", "status": "ACCEPTED", "timestamp": int((c_start + datetime.timedelta(minutes=75)).timestamp())},
    ]
    
    # Add 10 extra submissions on Monday/Tuesday
    for i in range(10):
        extra_ts = int((c_start + datetime.timedelta(days=1, hours=i)).timestamp())
        submissions.append({"titleSlug": f"extra-problem-{i}", "status": "ACCEPTED", "timestamp": extra_ts})
        
    raw_data = {
        "userContestRankingHistory": [{"contest": {"title": "Weekly Contest 520"}, "attended": True, "problemsSolved": 4}],
        "recentAcSubmissionList": submissions
    }
    
    result = engine.verify_contest_evidence(
        username="student_c",
        contest_id="weekly-contest-520",
        contest_problems=["q1-slug", "q2-slug", "q3-slug", "q4-slug"],
        raw_data=raw_data
    )
    
    q_mat = result["q_matrix"]
    assert q_mat["Q1"] is True
    assert q_mat["Q2"] is True
    assert q_mat["Q3"] is True
    assert q_mat["Q4"] is True
    assert result["verified_solved_count"] == 4
    assert result["solved_count"] == 4
