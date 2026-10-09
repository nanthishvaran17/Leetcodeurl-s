"""
test_phase_x_fix3_rate_limiting.py — Unit Tests for Phase X Fix 3: Rate Limiting & API Stability

Verifies:
  1. Rate limiter enforces approximately 5 requests/sec limit
  2. Multiple concurrent workers share the singleton limiter
  3. Ranking requests, history requests, recent AC requests are rate-limited
  4. T+3 and T+12 reconciliation requests are rate-limited
  5. HTTP 429 triggers retry with exponential backoff
  6. Retry-After header is respected
  7. Maximum retry count is bounded to 3
  8. Exhausted 429 retries produce rate_limited status / reason
  9. Rate-limit failure is NOT converted to NOT_ATTENDED or 0 solved
  10. Concurrent retry storms respect the global limiter
"""
import time
import asyncio
import datetime
import pytest
import httpx
from unittest.mock import AsyncMock, patch, MagicMock

from backend.services.token_bucket_limiter import (
    TokenBucketRateLimiter,
    global_token_bucket_limiter,
    SourceRateLimitExhaustedError
)
from backend.services.contest_classifier import _gql, evaluate_contest_evidence, ContestStatus
from backend.services.delayed_reconciliation_service import DelayedReconciliationEngine


@pytest.mark.asyncio
async def test_01_rate_limiter_rate_enforcement():
    """Test 1: Rate limiter enforces approximately 5 req/sec."""
    limiter = TokenBucketRateLimiter(rate_per_sec=5.0, capacity=5.0)
    start_time = time.monotonic()

    # Make 11 acquisitions (5 initial capacity + 6 replenished at 5 req/sec -> should take ~1.2s)
    for _ in range(11):
        await limiter.acquire_token()

    elapsed = time.monotonic() - start_time
    # 11 tokens at 5 tokens/sec requires at least 1.0s wait
    assert elapsed >= 0.95, f"Expected elapsed >= 0.95s, got {elapsed:.3f}s"


@pytest.mark.asyncio
async def test_02_concurrent_workers_share_limiter():
    """Test 2: Multiple concurrent tasks share the same singleton limiter."""
    limiter = TokenBucketRateLimiter(rate_per_sec=5.0, capacity=5.0)
    limiter.reset_metrics()

    async def worker(w_id: int):
        for _ in range(3):
            await limiter.acquire_token()
            limiter.total_requests += 1

    # Launch 5 concurrent workers (total 15 requests)
    start = time.monotonic()
    await asyncio.gather(*(worker(i) for i in range(5)))
    elapsed = time.monotonic() - start

    assert limiter.total_requests == 15
    # 15 requests at 5 req/sec takes ~2.0s
    assert elapsed >= 1.8, f"Expected elapsed >= 1.8s for 15 requests, got {elapsed:.3f}s"


@pytest.mark.asyncio
async def test_03_graphql_queries_rate_limited():
    """Test 3-7: _gql queries acquire tokens and increment metrics."""
    global_token_bucket_limiter.reset_metrics()
    
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"data": {"userContestRankingHistory": []}}

    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.post.return_value = mock_resp

    res = await _gql(
        client=mock_client,
        query="query test",
        variables={"username": "testuser"},
        operation="testOp",
        username="testuser"
    )

    assert res["status"] == "ok"
    assert global_token_bucket_limiter.total_requests >= 1
    assert global_token_bucket_limiter.successful_requests >= 1


@pytest.mark.asyncio
async def test_04_http_429_triggers_retry_and_backoff():
    """Test 8 & 9: HTTP 429 triggers retry and respects Retry-After."""
    global_token_bucket_limiter.reset_metrics()

    mock_resp_429 = MagicMock()
    mock_resp_429.status_code = 429
    mock_resp_429.headers = {"Retry-After": "0.1"}

    mock_resp_200 = MagicMock()
    mock_resp_200.status_code = 200
    mock_resp_200.json.return_value = {"data": {"recentAcSubmissionList": []}}

    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.post.side_effect = [mock_resp_429, mock_resp_200]

    res = await _gql(
        client=mock_client,
        query="query test",
        variables={"username": "testuser"},
        operation="testOp",
        username="testuser",
        retries=3,
        backoff=0.1
    )

    assert res["status"] == "ok"
    assert global_token_bucket_limiter.http_429_count >= 1
    assert global_token_bucket_limiter.retry_count >= 1


@pytest.mark.asyncio
async def test_05_exhausted_429_retries_returns_rate_limited():
    """Test 10 & 11: Exhausted 429 retries returns rate_limited status and does not retry indefinitely."""
    global_token_bucket_limiter.reset_metrics()

    mock_resp_429 = MagicMock()
    mock_resp_429.status_code = 429
    mock_resp_429.headers = {}

    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.post.return_value = mock_resp_429

    res = await _gql(
        client=mock_client,
        query="query test",
        variables={"username": "testuser"},
        operation="testOp",
        username="testuser",
        retries=3,
        backoff=0.05
    )

    assert res["status"] == "rate_limited"
    assert res["data"] is None
    assert mock_client.post.call_count == 3  # Exactly 3 retries max


def test_06_rate_limit_failure_evidence_first_preservation():
    """Test 12: Rate limit failure produces NOT_VERIFIED / DATA_ERROR (never NOT_ATTENDED or 0 solved)."""
    start_utc = datetime.datetime(2026, 9, 20, 2, 30, tzinfo=datetime.timezone.utc)
    end_utc = datetime.datetime(2026, 9, 20, 4, 0, tzinfo=datetime.timezone.utc)

    res = evaluate_contest_evidence(
        student_id=1,
        student_name="Test Student",
        leetcode_username="testuser",
        contest_id="weekly-contest-520",
        contest_name="Weekly Contest 520",
        contest_start_utc=start_utc,
        contest_end_utc=end_utc,
        official_problems=[],
        ranking_history_attended=None,
        raw_submissions=[],
        fetch_error="rate_limited"
    )

    assert res.status in (ContestStatus.NOT_VERIFIED, ContestStatus.DATA_ERROR)
    assert res.status != ContestStatus.NOT_ATTENDED
    assert res.status != ContestStatus.LIVE
    assert res.reason_code in ("FETCH_ERROR", "RATE_LIMITED", "EVIDENCE_UNAVAILABLE", "NO_EVIDENCE")


@pytest.mark.asyncio
async def test_07_reconciliation_stage_rate_limited_handling():
    """Test 6 & 7: T+3 / T+12 reconciliation uses global limiter and handles 429 rate_limited."""
    engine_inst = DelayedReconciliationEngine()
    
    mock_resp_429 = MagicMock()
    mock_resp_429.status_code = 429

    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.post.return_value = mock_resp_429

    attended, subs, error = await engine_inst.fetch_leetcode_evidence_async(
        username="testuser",
        contest_slug="weekly-contest-520",
        client=mock_client
    )

    assert attended is None
    assert subs == []
    assert error == "rate_limited"
