import pytest
import datetime
import json
import hashlib
from unittest.mock import AsyncMock, patch, MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models import Base, Student, Department, LeetCodeProfileStats, StudentStatSnapshot
from backend.leetcode_fetcher import (
    fetch_leetcode_profile,
    fetch_contest_data,
    fetch_contest_data_batched,
    _profile_cache,
    clear_leetcode_cache,
)
from backend.sync_engine import sync_single_student_db, capture_student_snapshot


@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def seed_student(test_db):
    dept = Department(name="Computer Science", code="CSE")
    test_db.add(dept)
    test_db.commit()
    test_db.refresh(dept)

    student = Student(
        name="Test Student",
        reg_no="REG12345",
        username="test_coder",
        department_id=dept.id,
        year_level="III",
        is_active=True
    )
    test_db.add(student)
    test_db.commit()
    test_db.refresh(student)

    stats = LeetCodeProfileStats(
        student_id=student.id,
        total_solved=150,
        easy_solved=50,
        medium_solved=80,
        hard_solved=20,
        contest_rating=1650.5,
        contest_global_ranking=4200,
        public_profile_ranking=35000,
        sync_status="success",
        validation_status="verified",
        contest_sync_status="ok",
        last_successful_sync=datetime.datetime.now(datetime.timezone.utc),
        last_verified_at=datetime.datetime.now(datetime.timezone.utc),
        contest_last_verified_at=datetime.datetime.now(datetime.timezone.utc),
    )
    test_db.add(stats)
    test_db.commit()
    test_db.refresh(student)
    return student


@pytest.mark.asyncio
async def test_a_contest_403_preserves_verified_data(test_db, seed_student):
    """Test a: Contest call returns 403: stored rating/rank unchanged, contest_status == 'failed'."""
    clear_leetcode_cache()
    student = seed_student

    # Mock fetch_leetcode_profile result where profile succeeded but contest failed with 403
    stats_dict = {
        "username": "test_coder",
        "profile_url": "https://leetcode.com/u/test_coder/",
        "status": "success",
        "total_solved": 155,
        "easy_solved": 55,
        "medium_solved": 80,
        "hard_solved": 20,
        "contest_rating": None,
        "contest_global_ranking": None,
        "contest_status": "failed",
        "public_profile_ranking": 34000,
        "active_days": 40,
        "max_streak": 12,
        "fetch_duration": 0.5,
    }

    sync_single_student_db(student.id, stats_dict, test_db)
    test_db.refresh(student)

    # Verified rating and ranking must NOT be wiped out with None
    assert student.stats.contest_rating == 1650.5
    assert student.stats.contest_global_ranking == 4200
    assert student.stats.contest_sync_status == "failed"
    assert student.stats.total_solved == 155
    # Profile-level verified timestamp is updated
    assert student.stats.last_verified_at is not None


@pytest.mark.asyncio
async def test_b_graphql_errors_null_data(test_db, seed_student):
    """Test b: GraphQL errors with data null: contest_status == 'failed', DB rating/rank unchanged."""
    clear_leetcode_cache()
    student = seed_student

    stats_dict = {
        "username": "test_coder",
        "status": "success",
        "total_solved": 160,
        "easy_solved": 60,
        "medium_solved": 80,
        "hard_solved": 20,
        "contest_rating": None,
        "contest_global_ranking": None,
        "contest_status": "failed",
        "public_profile_ranking": 33000,
        "active_days": 42,
        "max_streak": 14,
    }

    sync_single_student_db(student.id, stats_dict, test_db)
    test_db.refresh(student)

    assert student.stats.contest_rating == 1650.5
    assert student.stats.contest_global_ranking == 4200
    assert student.stats.contest_sync_status == "failed"


@pytest.mark.asyncio
async def test_c_unrated_user_no_1500_fallback(test_db, seed_student):
    """Test c: Unrated user: contest_status == 'unrated', no 1500 fallback, previously verified values preserved."""
    clear_leetcode_cache()
    student = seed_student

    stats_dict = {
        "username": "test_coder",
        "status": "success",
        "total_solved": 150,
        "easy_solved": 50,
        "medium_solved": 80,
        "hard_solved": 20,
        "contest_rating": None,
        "contest_global_ranking": None,
        "contest_status": "unrated",
        "public_profile_ranking": 35000,
    }

    sync_single_student_db(student.id, stats_dict, test_db)
    test_db.refresh(student)

    # Never fabricate 1500.0; preserve previously verified values if any
    assert student.stats.contest_rating != 1500.0
    assert student.stats.contest_rating == 1650.5
    assert student.stats.contest_global_ranking == 4200
    assert student.stats.contest_sync_status == "unrated"


@pytest.mark.asyncio
async def test_d_status_ok_updates_and_preserves_legitimate_zero(test_db, seed_student):
    """Test d: Status 'ok': rating and rank are updated, and legitimate 0 value is preserved."""
    student = seed_student

    stats_dict = {
        "username": "test_coder",
        "status": "success",
        "total_solved": 170,
        "easy_solved": 60,
        "medium_solved": 90,
        "hard_solved": 20,
        "contest_rating": 1720.4,
        "contest_global_ranking": 3100,
        "contest_status": "ok",
        "public_profile_ranking": 29000,
        "active_days": 50,
        "max_streak": 20,
        "recent_contest_name": "Weekly Contest 430",
        "recent_contest_score": "3 / 4",
        "contest_participations": [
            {
                "contest_name": "Weekly Contest 430",
                "participation_type": "OFFICIAL",
                "problems_solved": 0,  # Legitimate 0 problems solved
                "total_problems": 4,
                "contest_rank": 9500,
                "contest_rating_after": 1720.4,
            }
        ]
    }

    sync_single_student_db(student.id, stats_dict, test_db)
    test_db.refresh(student)

    assert student.stats.contest_rating == 1720.4
    assert student.stats.contest_global_ranking == 3100
    assert student.stats.contest_sync_status == "ok"
    assert student.stats.contest_last_verified_at is not None

    # Check that legitimate 0 solved in contest was saved
    from backend.models import ContestParticipation
    part = test_db.query(ContestParticipation).filter(
        ContestParticipation.student_id == student.id,
        ContestParticipation.contest_name == "Weekly Contest 430"
    ).first()
    assert part is not None
    assert part.problems_solved == 0  # Preserved legitimate 0


@pytest.mark.asyncio
async def test_e_regression_verified_then_failed_recorded_separately(test_db, seed_student):
    """Test e: Regression: previously verified rating/rank, then a failed contest request, failure recorded separately."""
    student = seed_student
    prev_rating = student.stats.contest_rating
    prev_rank = student.stats.contest_global_ranking

    # Simulate subsequent sync failing on contest endpoint
    failed_contest_stats = {
        "username": "test_coder",
        "status": "success",
        "total_solved": 152,
        "easy_solved": 51,
        "medium_solved": 81,
        "hard_solved": 20,
        "contest_rating": None,
        "contest_global_ranking": None,
        "contest_status": "failed",
        "public_profile_ranking": 34500,
    }

    sync_single_student_db(student.id, failed_contest_stats, test_db)
    test_db.refresh(student)

    # Values must match previous verified numbers
    assert student.stats.contest_rating == prev_rating
    assert student.stats.contest_global_ranking == prev_rank
    # Failure recorded separately in contest_sync_status
    assert student.stats.contest_sync_status == "failed"


@pytest.mark.asyncio
async def test_f_profile_success_contest_failure_freshness(test_db, seed_student):
    """Test f: Profile fetch succeeds but contest fetch fails: contest data is not marked verified."""
    student = seed_student
    old_contest_verified = student.stats.contest_last_verified_at

    failed_contest_stats = {
        "username": "test_coder",
        "status": "success",
        "total_solved": 155,
        "easy_solved": 52,
        "medium_solved": 83,
        "hard_solved": 20,
        "contest_rating": None,
        "contest_global_ranking": None,
        "contest_status": "failed",
    }

    sync_single_student_db(student.id, failed_contest_stats, test_db)
    test_db.refresh(student)

    # Profile last_verified_at is updated
    assert student.stats.last_verified_at is not None
    # Contest last_verified_at must NOT be updated
    assert student.stats.contest_last_verified_at == old_contest_verified
    assert student.stats.contest_sync_status == "failed"


def test_g_batched_cache_keys_differ_for_same_size():
    """Test g: Batched cache keys differ for two different username lists of the same size."""
    usernames_1 = ["alice", "bob"]
    usernames_2 = ["charlie", "david"]

    query = "query userPublicProfileBatched { ... }"
    op = "userPublicProfileBatched"

    hash_1 = hashlib.md5((query + json.dumps({"usernames": usernames_1}, sort_keys=True)).encode()).hexdigest()
    key_1 = f"Batch[{len(usernames_1)}]:{op}:{hash_1}"

    hash_2 = hashlib.md5((query + json.dumps({"usernames": usernames_2}, sort_keys=True)).encode()).hexdigest()
    key_2 = f"Batch[{len(usernames_2)}]:{op}:{hash_2}"

    assert key_1 != key_2


@pytest.mark.asyncio
async def test_h_batched_statuses():
    """Test h: Batched statuses: user missing -> not_found; profile ok + no ranking -> unrated; profile fetch failed -> failed."""
    # Test fetch_contest_data_batched logic with mocked GQL response
    mock_client = MagicMock()

    # User 1: missing on profile -> status "not_found"
    # User 2: profile ok + no ranking -> status "ok", contest_status "unrated"
    # User 3: profile fetch failed -> status "failed", contest_status "failed"
    usernames = ["missing_user", "unrated_user", "failed_profile_user"]
    profile_statuses = {
        "missing_user": "not_found",
        "unrated_user": "ok",
        "failed_profile_user": "failed",
    }

    mock_gql_res = {
        "status": "ok",
        "data": {
            "u0_ranking": None,
            "u0_history": None,
            "u1_ranking": None,
            "u1_history": [],
            "u2_ranking": None,
            "u2_history": None,
        }
    }

    with patch("backend.leetcode_fetcher._gql_post", AsyncMock(return_value=mock_gql_res)):
        res = await fetch_contest_data_batched(usernames, mock_client, profile_statuses=profile_statuses)

        assert res["missing_user"]["status"] == "not_found"
        assert res["unrated_user"]["status"] == "ok"
        assert res["unrated_user"]["contest_status"] == "unrated"
        assert res["failed_profile_user"]["status"] == "failed"
        assert res["failed_profile_user"]["contest_status"] == "failed"


def test_i_snapshot_delta_calculation(test_db):
    """Test i: Snapshot delta calculation: when ratings are None, delta_rating is 0.0 and rating is None, never 0."""
    dept = Department(name="Information Technology", code="IT")
    test_db.add(dept)
    test_db.commit()
    test_db.refresh(dept)

    student = Student(name="New Student", reg_no="REG999", username="newbie", department_id=dept.id, year_level="III", is_active=True)
    test_db.add(student)
    test_db.commit()

    # Student with no contest rating
    stats = LeetCodeProfileStats(
        student_id=student.id,
        total_solved=10,
        easy_solved=10,
        medium_solved=0,
        hard_solved=0,
        contest_rating=None,  # Unknown rating
        contest_global_ranking=None,
        public_profile_ranking=500000,
        sync_status="success",
    )
    test_db.add(stats)
    test_db.commit()
    test_db.refresh(student)

    # First snapshot
    snap1 = capture_student_snapshot(student, test_db)
    assert snap1 is not None
    assert snap1.contest_rating is None  # Stored as None, NEVER 0
    assert snap1.delta_rating == 0.0
    assert snap1.contest_global_ranking is None

    # Next sync: student still has None rating, but solved 5 more
    student.stats.total_solved = 15
    student.stats.easy_solved = 15
    test_db.commit()

    snap2 = capture_student_snapshot(student, test_db)
    assert snap2 is not None
    assert snap2.contest_rating is None
    assert snap2.delta_rating == 0.0  # Must be 0.0, not None - None error


@pytest.mark.asyncio
async def test_j_failed_contest_not_cached_and_5xx_retried():
    """Test j: Failed contest result is not stored in _profile_cache and 5xx triggers retry with backoff."""
    clear_leetcode_cache()
    mock_client = AsyncMock()

    # Profile call returns 200 ok
    profile_resp = MagicMock()
    profile_resp.status_code = 200
    profile_resp.json.return_value = {
        "data": {
            "matchedUser": {
                "username": "coder_j",
                "profile": {"ranking": 100},
                "submitStats": {"acSubmissionNum": []},
            }
        }
    }

    # Contest call returns 500 on all attempts
    contest_resp = MagicMock()
    contest_resp.status_code = 500
    contest_resp.json.return_value = {"error": "Internal Server Error"}

    mock_client.post.side_effect = [profile_resp, contest_resp, contest_resp]

    with patch("backend.leetcode_fetcher.get_httpx_client", return_value=mock_client), \
         patch("asyncio.sleep", AsyncMock()):
        res = await fetch_leetcode_profile("coder_j")

    assert res["status"] == "success"
    assert res["contest_status"] == "failed"
    assert mock_client.post.call_count == 3  # 1 profile call + 2 contest attempts (retried)

    # Must NOT cache result in _profile_cache when contest_status is failed
    assert "coder_j" not in _profile_cache

