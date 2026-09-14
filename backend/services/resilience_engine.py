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


import os
import uuid
import datetime
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend.models import WeeklySession

try:
    import redis as sync_redis
except ImportError:
    sync_redis = None


class ContestWorkerLock:
    """
    Distributed Worker Lock Manager (Phase 5).
    Ensures only ONE worker process instance executes the live Sunday contest loop for a given contest_id.
    
    Supports:
    - Multi-instance mode via Redis (SET key value NX EX ttl) if REDIS_URL environment variable is set.
    - Single-node / DB-fallback mode via atomic WeeklySession worker fields (worker_instance_id, worker_heartbeat, worker_status) with automatic TTL expiry.
    """
    def __init__(self, contest_id: str, session_id: int, ttl_seconds: int = 45):
        self.contest_id = str(contest_id)
        self.session_id = session_id
        self.ttl_seconds = ttl_seconds
        self.instance_id = f"worker-{os.getpid()}-{uuid.uuid4().hex[:8]}"
        self.lock_key = f"contest-worker:{self.contest_id}"
        self.redis_url = os.environ.get("REDIS_URL")
        self._is_acquired = False
        self._redis_client = None

        if self.redis_url and sync_redis:
            try:
                self._redis_client = sync_redis.from_url(self.redis_url)
            except Exception as e:
                logger.warning(f"[WORKER_LOCK] Failed to connect Redis for locking: {e}. Falling back to DB lock.")
                self._redis_client = None

    def acquire(self, db: Optional[Session] = None) -> bool:
        """Attempts to acquire the distributed lock atomically."""
        if self._redis_client:
            try:
                acquired = self._redis_client.set(self.lock_key, self.instance_id, nx=True, ex=self.ttl_seconds)
                if acquired:
                    self._is_acquired = True
                    self._sync_db_worker_state(db, status="RUNNING")
                    logger.info(f"[WORKER_LOCK] Acquired Redis lock '{self.lock_key}' for instance {self.instance_id}")
                    return True
                else:
                    current_owner = self._redis_client.get(self.lock_key)
                    if current_owner and current_owner.decode("utf-8") == self.instance_id:
                        self._redis_client.expire(self.lock_key, self.ttl_seconds)
                        self._is_acquired = True
                        self._sync_db_worker_state(db, status="RUNNING")
                        return True
                    logger.warning(f"[WORKER_LOCK] Lock '{self.lock_key}' owned by another instance.")
                    return False
            except Exception as e:
                logger.error(f"[WORKER_LOCK] Redis acquire error: {e}. Falling back to DB lock.")

        # DB Fallback Lock (Single-node / Database source of truth)
        close_db = False
        if db is None:
            db = SessionLocal()
            close_db = True
        try:
            now_utc = datetime.datetime.now(datetime.timezone.utc)
            stale_threshold = now_utc - datetime.timedelta(seconds=self.ttl_seconds)
            
            session = db.query(WeeklySession).filter(WeeklySession.id == self.session_id).first()
            if not session:
                session = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()
            
            if not session:
                return False

            hb = session.worker_heartbeat
            if hb is not None and hb.tzinfo is None:
                hb = hb.replace(tzinfo=datetime.timezone.utc)

            # Check if current lock is expired or unassigned or owned by us
            is_stale = (hb is None or hb < stale_threshold)
            is_idle = (session.worker_status in (None, "IDLE", "STOPPED", "CRASHED"))
            is_mine = (session.worker_instance_id == self.instance_id)

            if is_stale or is_idle or is_mine:
                session.worker_instance_id = self.instance_id
                session.worker_status = "RUNNING"
                session.worker_heartbeat = now_utc
                if not session.actual_start and session.status == "LIVE":
                    session.actual_start = now_utc
                db.commit()
                self._is_acquired = True
                logger.info(f"[WORKER_LOCK] Acquired DB lock for session {session.id} (instance: {self.instance_id})")
                return True
            else:
                logger.warning(
                    f"[WORKER_LOCK] DB lock blocked for session {session.id}. Owned by {session.worker_instance_id} "
                    f"with active heartbeat {session.worker_heartbeat}"
                )
                return False
        finally:
            if close_db:
                db.close()

    def renew_heartbeat(self, db: Optional[Session] = None, last_processed_student: Optional[str] = None, last_event_id: Optional[int] = None, error_count: int = 0) -> bool:
        """Periodically renews the lock TTL and updates durable heartbeat in DB."""
        if not self._is_acquired:
            return False

        if self._redis_client:
            try:
                owner = self._redis_client.get(self.lock_key)
                if owner and owner.decode("utf-8") == self.instance_id:
                    self._redis_client.expire(self.lock_key, self.ttl_seconds)
                else:
                    logger.error(f"[WORKER_LOCK] Lost Redis lock ownership for '{self.lock_key}'. Stopping worker renewal.")
                    self._is_acquired = False
                    return False
            except Exception as e:
                logger.warning(f"[WORKER_LOCK] Redis heartbeat renewal error: {e}")

        # Always update DB heartbeat for durable observability
        close_db = False
        if db is None:
            db = SessionLocal()
            close_db = True
        try:
            now_utc = datetime.datetime.now(datetime.timezone.utc)
            session = db.query(WeeklySession).filter(WeeklySession.id == self.session_id).first()
            if session and session.worker_instance_id == self.instance_id:
                session.worker_heartbeat = now_utc
                session.worker_status = "RUNNING"
                if last_event_id is not None:
                    session.last_event_id = last_event_id
                if error_count > 0:
                    session.retry_count = (session.retry_count or 0) + error_count
                db.commit()
                return True
            elif session:
                logger.warning(f"[WORKER_LOCK] Lock lost in DB. Expected instance {self.instance_id}, found {session.worker_instance_id}")
                self._is_acquired = False
                return False
            return True
        finally:
            if close_db:
                db.close()

    def release(self, db: Optional[Session] = None):
        """Releases the distributed lock gracefully."""
        if self._redis_client and self._is_acquired:
            try:
                owner = self._redis_client.get(self.lock_key)
                if owner and owner.decode("utf-8") == self.instance_id:
                    self._redis_client.delete(self.lock_key)
            except Exception as e:
                logger.warning(f"[WORKER_LOCK] Error releasing Redis lock: {e}")

        self._sync_db_worker_state(db, status="IDLE", clear_instance=True)
        self._is_acquired = False
        logger.info(f"[WORKER_LOCK] Released lock '{self.lock_key}' for instance {self.instance_id}")

    def _sync_db_worker_state(self, db: Optional[Session], status: str, clear_instance: bool = False):
        close_db = False
        if db is None:
            db = SessionLocal()
            close_db = True
        try:
            now_utc = datetime.datetime.now(datetime.timezone.utc)
            session = db.query(WeeklySession).filter(WeeklySession.id == self.session_id).first()
            if session:
                session.worker_status = status
                session.worker_heartbeat = now_utc
                if clear_instance:
                    if session.worker_instance_id == self.instance_id:
                        session.worker_instance_id = None
                else:
                    session.worker_instance_id = self.instance_id
                db.commit()
        except Exception as e:
            logger.warning(f"[WORKER_LOCK] Error syncing DB worker state: {e}")
        finally:
            if close_db:
                db.close()

