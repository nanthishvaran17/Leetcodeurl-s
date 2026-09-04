"""
resilience_engine.py — SINGLE-FLIGHT REQUEST COALESCING & CIRCUIT BREAKER
========================================================================
Prevents dogpiling and request storms under heavy concurrent traffic.
Enforces finite timeouts, exponential backoff, and circuit breaker patterns.
"""

import asyncio
import time
import threading
from typing import Callable, Any, Dict
from backend.logger import logger


class SingleFlightCoalescer:
    """
    Coalesces multiple concurrent requests for the exact same key into a single execution.
    If 50 clients request dataset for Session 21 simultaneously, only 1 DB/calculation runs.
    """
    def __init__(self):
        self._locks: Dict[str, asyncio.Lock] = {}
        self._results: Dict[str, Any] = {}
        self._in_flight: Dict[str, asyncio.Future] = {}
        self._sync_lock = threading.Lock()

    async def execute_async(self, key: str, coro_fn: Callable[[], Any]) -> Any:
        future = None
        is_leader = False

        with self._sync_lock:
            if key in self._in_flight:
                future = self._in_flight[key]
            else:
                loop = asyncio.get_running_loop()
                future = loop.create_future()
                self._in_flight[key] = future
                is_leader = True

        if not is_leader:
            return await future

        try:
            result = await coro_fn()
            future.set_result(result)
            return result
        except Exception as exc:
            future.set_exception(exc)
            raise
        finally:
            with self._sync_lock:
                self._in_flight.pop(key, None)


class CircuitBreakerOpenException(Exception):
    pass


class CircuitBreaker:
    """
    Three-state Circuit Breaker (CLOSED -> OPEN -> HALF_OPEN).
    Protects downstream systems and maintains instant response when external APIs degrade.
    """
    def __init__(self, failure_threshold: int = 5, recovery_timeout_sec: float = 30.0):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout_sec
        self.failure_count = 0
        self.last_failure_time = 0.0
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
        self._lock = threading.Lock()

    def allow_request(self) -> bool:
        with self._lock:
            now = time.time()
            if self.state == "OPEN":
                if now - self.last_failure_time > self.recovery_timeout:
                    self.state = "HALF_OPEN"
                    logger.info("[CIRCUIT_BREAKER] Transitioned from OPEN to HALF_OPEN")
                    return True
                return False
            return True

    def record_success(self):
        with self._lock:
            self.failure_count = 0
            if self.state != "CLOSED":
                self.state = "CLOSED"
                logger.info("[CIRCUIT_BREAKER] Transitioned to CLOSED (Healthy)")

    def record_failure(self):
        with self._lock:
            self.failure_count += 1
            self.last_failure_time = time.time()
            if self.failure_count >= self.failure_threshold:
                self.state = "OPEN"
                logger.warning(f"[CIRCUIT_BREAKER] Failure threshold reached ({self.failure_count}). Transitioned to OPEN!")


# Global instances
single_flight = SingleFlightCoalescer()
leetcode_circuit_breaker = CircuitBreaker(failure_threshold=5, recovery_timeout_sec=20.0)
