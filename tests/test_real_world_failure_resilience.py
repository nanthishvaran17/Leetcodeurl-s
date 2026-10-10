import pytest
import asyncio
import time
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from backend.middleware.idempotency import IdempotencyMiddleware
from backend.leetcode_fetcher import CircuitBreaker, AdaptiveBatchController
from backend.database import execute_with_db_retry

# Isolated test app without full backend lifespan triggers
test_app = FastAPI()
test_app.add_middleware(IdempotencyMiddleware)

@test_app.post("/test-mutation")
async def dummy_mutation(request: Request):
    return {"status": "success", "timestamp": time.time()}

client = TestClient(test_app)

def test_idempotency_middleware_deduplication():
    """Verify that requests carrying the same X-Idempotency-Key return cached response on retry."""
    key = f"test-key-{time.time()}"
    headers = {"X-Idempotency-Key": key}
    
    # First request
    resp1 = client.post("/test-mutation", json={"action": "update"}, headers=headers)
    assert resp1.status_code == 200
    data1 = resp1.json()
    
    # Second request with same idempotency key
    resp2 = client.post("/test-mutation", json={"action": "update"}, headers=headers)
    assert resp2.status_code == 200
    data2 = resp2.json()
    
    # Verify cached replay
    assert resp2.headers.get("X-Cache-Lookup") == "HIT-IDEMPOTENT"
    assert data1["timestamp"] == data2["timestamp"]

def test_circuit_breaker_transitions():
    """Verify CircuitBreaker switches from CLOSED to OPEN after failure threshold."""
    cb = CircuitBreaker(failure_threshold=3, recovery_timeout=0.5)
    
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    # Initial closed state
    assert loop.run_until_complete(cb.check()) is True
    assert cb.state == "CLOSED"
    
    # Record failures up to threshold
    loop.run_until_complete(cb.record_failure())
    loop.run_until_complete(cb.record_failure())
    assert cb.state == "CLOSED"
    
    loop.run_until_complete(cb.record_failure())
    assert cb.state == "OPEN"
    assert loop.run_until_complete(cb.check()) is False
    
    # Recovery timeout
    time.sleep(0.6)
    assert loop.run_until_complete(cb.check()) is True
    assert cb.state == "HALF_OPEN"
    
    # Success recovers to CLOSED
    loop.run_until_complete(cb.record_success())
    assert cb.state == "CLOSED"

def test_adaptive_batch_controller_scaling():
    """Verify AdaptiveBatchController scales batch size down on error and up on healthy responses."""
    controller = AdaptiveBatchController(initial_batch=15, min_batch=3, max_batch=15)
    assert controller.get_batch_size() == 15
    
    # Report failure -> scale down
    controller.report_failure(status_code=429)
    assert controller.get_batch_size() == 7
    
    controller.report_failure(status_code=503)
    assert controller.get_batch_size() == 3
    
    # Floor limit test
    controller.report_failure(status_code=500)
    assert controller.get_batch_size() == 3
    
    # 5 consecutive successes -> scale back up
    for _ in range(5):
        controller.report_success()
    assert controller.get_batch_size() == 5

def test_execute_with_db_retry_transient_handling():
    """Verify execute_with_db_retry retries transient errors and locks up to max_retries."""
    attempts = 0
    
    def flakey_db_op(db):
        nonlocal attempts
        attempts += 1
        if attempts < 2:
            raise Exception("sqlite3.OperationalError: database is locked")
        return "SUCCESS"
    
    res = execute_with_db_retry(flakey_db_op, max_retries=3, retry_delay=0.05)
    assert res == "SUCCESS"
    assert attempts == 2
