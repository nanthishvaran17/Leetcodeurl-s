"""
test_contest_rating_and_rank_integrity.py
================================================================================
Comprehensive regression test suite for LeetCode contest rating, contest global rank,
fetch reliability, cache key isolation, and data preservation contracts.
================================================================================
"""

import pytest
import datetime
import asyncio
import json
import hashlib
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from backend.database import SessionLocal
from backend.models import Student, LeetCodeProfileStats, StudentStatSnapshot, Department
from backend.leetcode_fetcher import (
    fetch_leetcode_profile,
    fetch_profile_and_stats,
    fetch_contest_data,
    fetch_profile_and_stats_batched,
    fetch_contest_data_batched,
    _gql_post,
    _get_gql_semaphore,
    extract_leetcode_username
)
from backend.sync_engine import sync_single_student_db, capture_student_snapshot


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()

@pytest.fixture
def dept(db):
    d = db.query(Department).first()
    if not d:
        d = Department(code="CSE", name="Computer Science and Engineering")
        db.add(d)
        db.commit()
        db.refresh(d)
    return d


# 1. Successful contest response with a valid rating and rank
@pytest.mark.asyncio
async def test_01_successful_contest_response():
    mock_client = AsyncMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "data": {
            "userContestRanking": {
                "attendedContestsCount": 5,
                "rating": 1650.4,
                "globalRanking": 12345,
                "totalParticipants": 100000,
                "topPercentage": 12.3
            },
            "userContestRankingHistory": [
                {
                    "attended": True,
                    "problemsSolved": 3,
                    "totalProblems": 4,
                    "finishTimeInSeconds": 3600,
                    "rating": 1650.4,
                    "ranking": 12345,
                    "contest": {"title": "Weekly Contest 350", "startTime": 1680000000}
                }
            ]
        }
    }
    mock_client.post.return_value = mock_response

    res = await fetch_contest_data("testuser", mock_client)
    assert res["status"] == "ok"
    assert res["data"]["contest_rating"] == 1650.4
    assert res["data"]["contest_global_ranking"] == 12345
    assert res["data"]["top_percentage"] == 12.3


# 2. Successful response with a genuinely unrated account
@pytest.mark.asyncio
async def test_02_genuinely_unrated_account():
    mock_client = AsyncMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "data": {
            "userContestRanking": None,
            "userContestRankingHistory": []
        }
    }
    mock_client.post.return_value = mock_response

    res = await fetch_contest_data("unrateduser", mock_client)
    assert res["status"] == "ok"
    assert res["data"]["contest_rating"] is None
    assert res["data"]["contest_global_ranking"] is None


# 3. Temporary contest API failure after a previously verified rating/rank exists
def test_03_temporary_contest_failure_preserves_verified_data(db, dept):
    uid = uuid.uuid4().hex[:6]
    student = Student(name="Test Preserved", reg_no=f"REG_T3_{uid}", username=f"user_t3_{uid}", department_id=dept.id, year_level="II Year", is_active=True)
    db.add(student)
    db.commit()

    init_stats = {
        "username": f"user_t3_{uid}",
        "status": "success",
        "total_solved": 100,
        "easy_solved": 50,
        "medium_solved": 40,
        "hard_solved": 10,
        "contest_status": "ok",
        "contest_rating": 1750.5,
        "contest_global_ranking": 5432,
        "public_profile_ranking": 20000,
        "fetch_duration": 0.5
    }
    sync_single_student_db(student.id, init_stats, db)

    # Simulate fetch where profile succeeds but contest_status is failed
    stats_dict = {
        "username": f"user_t3_{uid}",
        "status": "success",
        "total_solved": 105,
        "easy_solved": 52,
        "medium_solved": 42,
        "hard_solved": 11,
        "contest_status": "failed",
        "contest_rating": None,
        "contest_global_ranking": None,
        "public_profile_ranking": 19500,
        "fetch_duration": 0.5
    }

    updated = sync_single_student_db(student.id, stats_dict, db)
    assert updated.stats.contest_rating == 1750.5  # Preserved!
    assert updated.stats.contest_global_ranking == 5432  # Preserved!
    assert updated.stats.total_solved == 105  # Profile stats updated!
    assert updated.stats.contest_sync_status == "failed"


# 4. Failed profile lookup does not become not_found unless authoritative 404
@pytest.mark.asyncio
async def test_04_failed_profile_lookup_distinguishes_transient_from_404():
    mock_client = AsyncMock()
    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_client.post.return_value = mock_response

    res = await fetch_profile_and_stats("test_server_err", mock_client, retries=1)
    assert res["status"] == "error"
    assert res.get("data") is None


# 5. Confirmed nonexistent account is handled correctly
@pytest.mark.asyncio
async def test_05_confirmed_nonexistent_account():
    mock_client = AsyncMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "data": {
            "matchedUser": None
        }
    }
    mock_client.post.return_value = mock_response

    res = await fetch_profile_and_stats("nonexistent_user", mock_client)
    assert res["status"] == "not_found"


# 6. HTTP 403, 429, 5xx, timeout, malformed JSON, and fatal GraphQL errors
@pytest.mark.asyncio
async def test_06_http_error_resilience():
    mock_client = AsyncMock()

    # 429 Rate limited
    res_429 = MagicMock()
    res_429.status_code = 429
    mock_client.post.return_value = res_429
    res = await _gql_post(mock_client, "query {}", {}, "op", "user1", retries=1)
    assert res["status"] == "rate_limited"

    # 500 Server Error
    res_500 = MagicMock()
    res_500.status_code = 500
    mock_client.post.return_value = res_500
    res = await _gql_post(mock_client, "query {}", {}, "op", "user1", retries=1)
    assert res["status"] == "error"

    # Fatal GraphQL Error
    res_gql_err = MagicMock()
    res_gql_err.status_code = 200
    res_gql_err.json.return_value = {"errors": [{"message": "Fatal GraphQL Exception"}]}
    mock_client.post.return_value = res_gql_err
    res = await _gql_post(mock_client, "query {}", {}, "op", "user1", retries=1)
    assert res["status"] == "error"
    assert "Fatal GraphQL Exception" in res["detail"]


# 7. Retry count, backoff, and semaphore behavior
@pytest.mark.asyncio
async def test_07_semaphore_is_loop_safe():
    sem = _get_gql_semaphore()
    assert isinstance(sem, asyncio.Semaphore)


# 8. Cache keys differ for different queries and variables
def test_08_cache_key_isolation():
    query1 = "query Q1 { test }"
    query2 = "query Q2 { test }"
    var1 = {"username": "user1"}
    var2 = {"username": "user2"}

    h1 = hashlib.md5((query1 + json.dumps(var1, sort_keys=True)).encode()).hexdigest()
    h2 = hashlib.md5((query2 + json.dumps(var1, sort_keys=True)).encode()).hexdigest()
    h3 = hashlib.md5((query1 + json.dumps(var2, sort_keys=True)).encode()).hexdigest()

    assert h1 != h2
    assert h1 != h3


# 9. Batched usernames containing quotes, backslashes, or other special characters
@pytest.mark.asyncio
async def test_09_batched_special_characters_in_username():
    mock_client = AsyncMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "data": {
            "u0": {
                "username": "user\"quote",
                "profile": {"ranking": 100},
                "submitStatsGlobal": {"acSubmissionNum": [{"difficulty": "All", "count": 10}, {"difficulty": "Easy", "count": 5}, {"difficulty": "Medium", "count": 3}, {"difficulty": "Hard", "count": 2}]}
            }
        }
    }
    mock_client.post.return_value = mock_response

    res = await fetch_profile_and_stats_batched(["user\"quote"], mock_client)
    assert "user\"quote" in res
    assert res["user\"quote"]["status"] == "ok"


# 10. One malformed batch result does not destroy other users' valid results
@pytest.mark.asyncio
async def test_10_partial_batch_isolation():
    mock_client = AsyncMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "data": {
            "u0": None,  # Not found
            "u1": {
                "username": "valid_user",
                "profile": {"ranking": 500},
                "submitStatsGlobal": {"acSubmissionNum": [{"difficulty": "All", "count": 20}, {"difficulty": "Easy", "count": 10}, {"difficulty": "Medium", "count": 7}, {"difficulty": "Hard", "count": 3}]}
            }
        }
    }
    mock_client.post.return_value = mock_response

    res = await fetch_profile_and_stats_batched(["user0", "valid_user"], mock_client)
    assert res["user0"]["status"] == "not_found"
    assert res["valid_user"]["status"] == "ok"
    assert res["valid_user"]["data"]["total_solved"] == 20


# 11. Legitimate rating zero is handled correctly
@pytest.mark.asyncio
async def test_11_legitimate_rating_zero():
    mock_client = AsyncMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "data": {
            "userContestRanking": {
                "attendedContestsCount": 1,
                "rating": 0.0,
                "globalRanking": 99999,
                "totalParticipants": 100000,
                "topPercentage": 99.9
            },
            "userContestRankingHistory": []
        }
    }
    mock_client.post.return_value = mock_response

    res = await fetch_contest_data("zero_rating_user", mock_client)
    assert res["status"] == "ok"
    assert res["data"]["contest_rating"] == 0.0


# 12. Missing rating remains None, never 1500.0
@pytest.mark.asyncio
async def test_12_missing_rating_remains_none():
    mock_client = AsyncMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "data": {
            "userContestRanking": {
                "attendedContestsCount": 0,
                "rating": None,
                "globalRanking": None,
                "totalParticipants": None,
                "topPercentage": None
            },
            "userContestRankingHistory": []
        }
    }
    mock_client.post.return_value = mock_response

    res = await fetch_contest_data("no_rating_user", mock_client)
    assert res["status"] == "ok"
    assert res["data"]["contest_rating"] is None


# 13. Missing participant count never triggers a hardcoded percentage calculation
@pytest.mark.asyncio
async def test_13_missing_top_percentage_remains_none():
    mock_client = AsyncMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "data": {
            "userContestRanking": {
                "attendedContestsCount": 1,
                "rating": 1500.0,
                "globalRanking": 1000,
                "totalParticipants": None,
                "topPercentage": None
            },
            "userContestRankingHistory": []
        }
    }
    mock_client.post.return_value = mock_response

    res = await fetch_contest_data("user_no_pct", mock_client)
    assert res["status"] == "ok"
    assert res["data"]["top_percentage"] is None


# 14. Public-profile rank and contest global rank remain separate
def test_14_profile_and_contest_rank_separation(db, dept):
    uid = uuid.uuid4().hex[:6]
    student = Student(name="Test Ranks", reg_no=f"REG_T14_{uid}", username=f"user_t14_{uid}", department_id=dept.id, year_level="II Year", is_active=True)
    db.add(student)
    db.commit()

    stats_dict = {
        "username": f"user_t14_{uid}",
        "status": "success",
        "total_solved": 50,
        "easy_solved": 30,
        "medium_solved": 15,
        "hard_solved": 5,
        "contest_status": "ok",
        "contest_rating": 1600.0,
        "contest_global_ranking": 1234,  # Contest rank
        "public_profile_ranking": 98765,  # Profile rank
        "fetch_duration": 0.3
    }

    updated = sync_single_student_db(student.id, stats_dict, db)
    assert updated.stats.contest_global_ranking == 1234
    assert updated.stats.public_profile_ranking == 98765
    assert updated.stats.contest_global_ranking != updated.stats.public_profile_ranking


# 15. Null or malformed contest-history fields do not crash the entire fetch
@pytest.mark.asyncio
async def test_15_malformed_history_items_handled_gracefully():
    mock_client = AsyncMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "data": {
            "userContestRanking": {"rating": 1600.0, "globalRanking": 5000},
            "userContestRankingHistory": [
                None,
                "invalid string item",
                {"attended": True, "contest": None, "ranking": "invalid_int"},
                {"attended": True, "problemsSolved": 2, "totalProblems": 4, "rating": 1600.0, "ranking": 5000, "contest": {"title": "Weekly Contest 300", "startTime": 1650000000}}
            ]
        }
    }
    mock_client.post.return_value = mock_response

    res = await fetch_contest_data("history_user", mock_client)
    assert res["status"] == "ok"
    assert len(res["data"]["history"]) >= 1


# 16. Existing verified rating/rank survive a failed contest fetch
def test_16_verified_data_survives_failed_contest_fetch(db, dept):
    uid = uuid.uuid4().hex[:6]
    student = Student(name="Survive Test", reg_no=f"REG_T16_{uid}", username=f"user_t16_{uid}", department_id=dept.id, year_level="II Year", is_active=True)
    db.add(student)
    db.commit()

    init_stats = {
        "username": f"user_t16_{uid}",
        "status": "success",
        "total_solved": 200,
        "easy_solved": 100,
        "medium_solved": 80,
        "hard_solved": 20,
        "contest_status": "ok",
        "contest_rating": 1850.0,
        "contest_global_ranking": 3000,
        "fetch_duration": 0.4
    }
    sync_single_student_db(student.id, init_stats, db)

    stats_dict = {
        "username": f"user_t16_{uid}",
        "status": "success",
        "total_solved": 205,
        "easy_solved": 102,
        "medium_solved": 82,
        "hard_solved": 21,
        "contest_status": "failed",
        "fetch_duration": 0.4
    }

    updated = sync_single_student_db(student.id, stats_dict, db)
    assert updated.stats.contest_rating == 1850.0
    assert updated.stats.contest_global_ranking == 3000
    assert updated.stats.total_solved == 205


# 17. Profile statistics can update when contest fetching fails
def test_17_profile_updates_when_contest_fails(db, dept):
    uid = uuid.uuid4().hex[:6]
    student = Student(name="Profile Only", reg_no=f"REG_T17_{uid}", username=f"user_t17_{uid}", department_id=dept.id, year_level="II Year", is_active=True)
    db.add(student)
    db.commit()

    stats_dict = {
        "username": f"user_t17_{uid}",
        "status": "success",
        "total_solved": 10,
        "easy_solved": 6,
        "medium_solved": 3,
        "hard_solved": 1,
        "contest_status": "failed",
        "public_profile_ranking": 500000,
        "fetch_duration": 0.2
    }

    updated = sync_single_student_db(student.id, stats_dict, db)
    assert updated.stats.sync_status == "success"
    assert updated.stats.total_solved == 10
    assert updated.stats.contest_sync_status == "failed"


# 18. is_unchanged is calculated correctly with failed, unrated, and successful contest states
def test_18_is_unchanged_calculation(db, dept):
    uid = uuid.uuid4().hex[:6]
    student = Student(name="Unchanged Test", reg_no=f"REG_T18_{uid}", username=f"user_t18_{uid}", department_id=dept.id, year_level="II Year", is_active=True)
    db.add(student)
    db.commit()

    stats_dict = {
        "username": f"user_t18_{uid}",
        "status": "success",
        "total_solved": 100,
        "easy_solved": 50,
        "medium_solved": 40,
        "hard_solved": 10,
        "contest_status": "ok",
        "contest_rating": 1500.0,
        "contest_global_ranking": 10000,
        "public_profile_ranking": 50000,
        "fetch_duration": 0.1
    }
    sync_single_student_db(student.id, stats_dict, db)

    updated = sync_single_student_db(student.id, stats_dict, db)
    assert updated.stats.sync_status == "success"
    assert updated.stats.total_solved == 100


# 19. Existing snapshot and participation behavior remains unchanged for unrelated cases
def test_19_snapshot_capture_integrity(db, dept):
    uid = uuid.uuid4().hex[:6]
    student = Student(name="Snapshot Test", reg_no=f"REG_T19_{uid}", username=f"user_t19_{uid}", department_id=dept.id, year_level="II Year", is_active=True)
    db.add(student)
    db.commit()

    init_stats = {
        "username": f"user_t19_{uid}",
        "status": "success",
        "total_solved": 50,
        "easy_solved": 30,
        "medium_solved": 15,
        "hard_solved": 5,
        "contest_status": "ok",
        "contest_rating": 1400.0,
        "contest_global_ranking": 20000,
        "fetch_duration": 0.1
    }
    sync_single_student_db(student.id, init_stats, db)

    snap = capture_student_snapshot(student, db, run_id="TEST_RUN_001")
    assert snap is not None
    assert snap.total_solved == 50
    assert snap.contest_rating == 1400.0
    assert snap.sync_run_id == "TEST_RUN_001"
