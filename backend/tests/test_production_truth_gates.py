import pytest
from backend.contest_truth_engine import ContestTruthEngine

def test_truth_engine_snapshot_id_generation():
    engine = ContestTruthEngine(db_connection=None)
    snap_id = engine.generate_snapshot_id("weekly-contest-516", "2026-08-23 22:00:00")
    assert snap_id.startswith("SNAP-WEEKLY-CONTEST-516-")
    assert len(snap_id) == len("SNAP-WEEKLY-CONTEST-516-") + 8

def test_truth_engine_official_green_classification():
    engine = ContestTruthEngine(db_connection=None)
    
    mock_raw_official = {
        "userContestRankingHistory": [
            {
                "contest": {"title": "Weekly Contest 516"},
                "attended": True,
                "problemsSolved": 2,
                "rating": 1542.0,
                "finishTimeInSeconds": 3600
            }
        ],
        "recentAcSubmissionList": [
            {"title": "Two Sum", "titleSlug": "two-sum", "timestamp": 1787452200}
        ]
    }
    
    result = engine.verify_contest_evidence(
        username="732224CC031",
        contest_id="weekly-contest-516",
        contest_problems=["two-sum", "add-two-numbers", "3sum", "trapping-rain-water"],
        raw_data=mock_raw_official
    )
    
    assert result["status_badge"] == "🟢 GREEN"
    assert result["solved_count"] == 2
    assert result["evidence_verified"] is True
    assert result["q_matrix"]["Q1"] is True
    assert result["q_matrix"]["Q2"] is True
    assert "SNAP-" in result["snapshot_id"]

def test_truth_engine_virtual_yellow_classification():
    engine = ContestTruthEngine(db_connection=None)
    
    mock_raw_virtual = {
        "userContestRankingHistory": [
            {
                "contest": {"title": "Weekly Contest 516"},
                "attended": False,
                "problemsSolved": 0,
                "rating": None,
                "finishTimeInSeconds": 0
            }
        ],
        "recentAcSubmissionList": [
            {"title": "Two Sum", "titleSlug": "two-sum", "timestamp": 1787480000}
        ]
    }
    
    result = engine.verify_contest_evidence(
        username="732224CC032",
        contest_id="weekly-contest-516",
        contest_problems=["two-sum", "add-two-numbers", "3sum", "trapping-rain-water"],
        raw_data=mock_raw_virtual
    )
    
    assert result["status_badge"] == "🟡 YELLOW"
    assert result["solved_count"] == 1
    assert result["evidence_verified"] is True

def test_truth_engine_absent_red_classification():
    engine = ContestTruthEngine(db_connection=None)
    
    mock_raw_absent = {
        "userContestRankingHistory": [],
        "recentAcSubmissionList": []
    }
    
    result = engine.verify_contest_evidence(
        username="732224CC033",
        contest_id="weekly-contest-516",
        contest_problems=["two-sum", "add-two-numbers", "3sum", "trapping-rain-water"],
        raw_data=mock_raw_absent
    )
    
    assert result["status_badge"] == "🔴 RED"
    assert result["solved_count"] == 0
    assert result["evidence_verified"] is True

def test_truth_engine_snapshot_lock():
    engine = ContestTruthEngine(db_connection=None)
    snap_id = engine.lock_sunday_snapshot(
        contest_id="weekly-contest-516",
        snapshot_type="FINAL_SNAPSHOT",
        records=[{"reg_no": "732224CC031", "status": "GREEN"}]
    )
    assert snap_id.startswith("SNAP-WEEKLY-CONTEST-516-")
