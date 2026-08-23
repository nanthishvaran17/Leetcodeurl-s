"""
test_production_performance_and_resilience.py
=============================================
Automated test suite verifying performance profiler, SingleFlight coalescing,
Circuit Breaker state transitions, and sub-100ms latency SLAs.
"""

import unittest
import asyncio
import time
from fastapi.testclient import TestClient
from backend.main import app
from backend.services.resilience_engine import SingleFlightCoalescer, CircuitBreaker
from backend.middleware.performance_profiler import get_performance_metrics, record_cache_hit, record_cache_miss


class TestProductionPerformanceAndResilience(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)

    def test_01_performance_health_endpoint(self):
        """Verify /health/performance returns p50, p95, p99 latencies and RAM stats"""
        res = self.client.get("/health/performance")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("latency_ms", data)
        self.assertIn("p50", data["latency_ms"])
        self.assertIn("p95", data["latency_ms"])
        self.assertIn("p99", data["latency_ms"])
        self.assertIn("system_resources", data)
        self.assertIn("ram_rss_mb", data["system_resources"])

    def test_02_readiness_probe_latency(self):
        """Verify /ready probe responds well within SLA (< 50ms)"""
        t0 = time.perf_counter()
        res = self.client.get("/ready")
        dur_ms = (time.perf_counter() - t0) * 1000.0
        self.assertEqual(res.status_code, 200)
        self.assertLess(dur_ms, 50.0)

    def test_03_single_flight_coalescing(self):
        """Verify SingleFlight executes underlying function exactly once for concurrent requests"""
        coalescer = SingleFlightCoalescer()
        call_count = 0

        async def expensive_task():
            nonlocal call_count
            call_count += 1
            await asyncio.sleep(0.05)
            return "DATA_PAYLOAD"

        async def run_concurrent():
            tasks = [coalescer.execute_async("key1", expensive_task) for _ in range(10)]
            results = await asyncio.gather(*tasks)
            return results

        results = asyncio.run(run_concurrent())
        self.assertEqual(len(results), 10)
        self.assertEqual(call_count, 1)  # Only 1 execution despite 10 concurrent requests!
        for r in results:
            self.assertEqual(r, "DATA_PAYLOAD")

    def test_04_circuit_breaker_transitions(self):
        """Verify Circuit Breaker transitions: CLOSED -> OPEN -> HALF_OPEN -> CLOSED"""
        cb = CircuitBreaker(failure_threshold=3, recovery_timeout_sec=0.1)
        self.assertEqual(cb.state, "CLOSED")
        self.assertTrue(cb.allow_request())

        # Simulate 3 failures
        cb.record_failure()
        cb.record_failure()
        cb.record_failure()
        self.assertEqual(cb.state, "OPEN")
        self.assertFalse(cb.allow_request())

        # Wait for recovery timeout
        time.sleep(0.15)
        self.assertTrue(cb.allow_request())
        self.assertEqual(cb.state, "HALF_OPEN")

        # Success in HALF_OPEN resets to CLOSED
        cb.record_success()
        self.assertEqual(cb.state, "CLOSED")
        self.assertEqual(cb.failure_count, 0)

    def test_05_cache_metrics_tracking(self):
        """Verify cache hit/miss tracking metrics"""
        record_cache_hit()
        record_cache_hit()
        record_cache_miss()
        metrics = get_performance_metrics()
        self.assertGreaterEqual(metrics["cache_metrics"]["hits"], 2)
        self.assertGreaterEqual(metrics["cache_metrics"]["misses"], 1)
        self.assertGreaterEqual(metrics["cache_metrics"]["hit_ratio_pct"], 0.0)


if __name__ == "__main__":
    unittest.main()
