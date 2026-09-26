import os
import time
import random
import asyncio
import inspect
from typing import Optional, Callable, Any, Dict
from backend.logger import logger

# ==============================================================================
# 1. EXPLICIT LEETCODE SOURCE EXCEPTION HIERARCHY
# ==============================================================================

class LeetCodeSourceError(Exception):
    """Base exception for external LeetCode adapter / upstream source failures."""
    def __init__(self, message: str, status_code: Optional[int] = None, raw_response: Optional[str] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.raw_response = raw_response

class SourceUnavailableError(LeetCodeSourceError):
    """Raised when upstream LeetCode API/network is unreachable, timing out, or returns 5xx."""

class SourceMalformedResponseError(LeetCodeSourceError):
    """Raised when upstream LeetCode returns invalid, truncated, or unparseable JSON/GraphQL payloads."""

class SourceRateLimitExhaustedError(LeetCodeSourceError):
    """Raised when HTTP 429 / throttle limits persist across all exponential backoff retry attempts."""


# ==============================================================================
# 2. TOKEN-BUCKET RATE LIMITER WITH METRICS, CONCURRENCY & EXPONENTIAL BACKOFF
# ==============================================================================

class TokenBucketRateLimiter:
    """
    Enforces true rate limiting via a Token Bucket algorithm combined with
    an Asyncio Semaphore concurrency limiter.
    
    Guarantees:
    - LEETCODE_REQUESTS_PER_SECOND = 5.0 (Tokens replenish smoothly over time)
    - max_concurrent = 20 (Bounded concurrent network sockets)
    - Exponential backoff with jitter on HTTP 429 or throttle signals
    - Respects Retry-After HTTP headers
    - Strictly bounded to 3 retries max
    - Rich metrics & observability
    """
    def __init__(
        self,
        rate_per_sec: Optional[float] = None,
        capacity: Optional[float] = None,
        max_concurrent: Optional[int] = None
    ):
        # Read LEETCODE_REQUESTS_PER_SECOND or LEETCODE_RATE_LIMIT_RPS (default 5.0)
        env_rps = os.getenv("LEETCODE_REQUESTS_PER_SECOND") or os.getenv("LEETCODE_RATE_LIMIT_RPS") or "5.0"
        self.rate_per_sec = rate_per_sec or float(env_rps)
        self.capacity = capacity or float(os.getenv("LEETCODE_RATE_LIMIT_CAPACITY", str(self.rate_per_sec)))
        self.max_concurrent = max_concurrent or int(os.getenv("LEETCODE_RATE_LIMIT_CONCURRENT", "20"))

        self.tokens = self.capacity
        self.last_update = time.monotonic()
        self._lock = asyncio.Lock()
        self._semaphore = asyncio.Semaphore(self.max_concurrent)

        # Metrics tracking
        self.total_requests = 0
        self.successful_requests = 0
        self.http_429_count = 0
        self.retry_count = 0
        self.rate_limited_failures = 0
        self.total_wait_time_sec = 0.0

    def reset_metrics(self):
        """Resets observability metrics."""
        self.total_requests = 0
        self.successful_requests = 0
        self.http_429_count = 0
        self.retry_count = 0
        self.rate_limited_failures = 0
        self.total_wait_time_sec = 0.0

    def get_metrics_summary(self) -> Dict[str, Any]:
        """Returns structured metrics summary."""
        avg_wait = (self.total_wait_time_sec / self.total_requests) if self.total_requests > 0 else 0.0
        return {
            "rate_per_sec": self.rate_per_sec,
            "total_requests": self.total_requests,
            "successful_requests": self.successful_requests,
            "http_429_count": self.http_429_count,
            "retry_count": self.retry_count,
            "rate_limited_failures": self.rate_limited_failures,
            "total_wait_time_sec": round(self.total_wait_time_sec, 3),
            "avg_wait_time_sec": round(avg_wait, 4)
        }

    async def acquire_token(self):
        """Acquires a token from the bucket, waiting asynchronously if necessary."""
        start_wait = time.monotonic()
        while True:
            async with self._lock:
                now = time.monotonic()
                elapsed = now - self.last_update
                self.tokens = min(self.capacity, self.tokens + elapsed * self.rate_per_sec)
                self.last_update = now

                if self.tokens >= 1.0:
                    self.tokens -= 1.0
                    wait_dur = time.monotonic() - start_wait
                    self.total_wait_time_sec += wait_dur
                    return
                else:
                    needed = 1.0 - self.tokens
                    wait_time = max(0.01, needed / self.rate_per_sec)

            await asyncio.sleep(wait_time)

    async def __aenter__(self):
        await self.acquire_token()
        await self._semaphore.acquire()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        self._semaphore.release()

    async def execute(
        self,
        request_func: Callable[[], Any],
        student_handle: str = "unknown",
        category: str = "graphql",
        max_retries: int = 3,
        base_backoff_sec: float = 0.5,
        max_backoff_sec: float = 10.0
    ) -> Any:
        """
        Executes a network request with token bucket acquisition, concurrency gating,
        metrics recording, and bounded exponential backoff with jitter.
        """
        self.total_requests += 1
        attempt = 0
        while attempt <= max_retries:
            attempt += 1
            if attempt > 1:
                self.retry_count += 1

            await self.acquire_token()

            async with self._semaphore:
                try:
                    if inspect.iscoroutinefunction(request_func):
                        result = await request_func()
                    else:
                        result = request_func()

                    # Check if result is an HTTP response object or dict with status
                    status_code = getattr(result, "status_code", None)
                    if status_code == 429 or (isinstance(result, dict) and result.get("status") == "rate_limited"):
                        self.http_429_count += 1
                        if attempt > max_retries:
                            self.rate_limited_failures += 1
                            logger.error(f"[RATE_LIMIT_EXHAUSTED] Category '{category}' for '{student_handle}' failed after {max_retries} retries.")
                            return result

                        # Extract Retry-After if available
                        retry_after = None
                        if hasattr(result, "headers"):
                            header_val = result.headers.get("Retry-After")
                            if header_val and str(header_val).isdigit():
                                retry_after = float(header_val)

                        backoff = retry_after if retry_after else min(max_backoff_sec, base_backoff_sec * (2 ** (attempt - 1)) + random.uniform(0.05, 0.2))
                        logger.warning(f"[RATE_LIMIT_BACKOFF] '{student_handle}' ({category}) attempt {attempt}/{max_retries} triggered 429 backoff. Sleeping {backoff:.2f}s.")
                        await asyncio.sleep(backoff)
                        continue

                    self.successful_requests += 1
                    return result

                except Exception as e:
                    error_str = str(e).lower()
                    status_code = getattr(e, "status_code", None) or getattr(getattr(e, "response", None), "status_code", None)
                    is_429 = (status_code == 429) or ("429" in error_str) or ("too many requests" in error_str) or ("rate limit" in error_str)
                    is_5xx = (status_code and status_code >= 500) or ("502" in error_str) or ("503" in error_str) or ("504" in error_str) or ("timeout" in error_str)

                    if is_429:
                        self.http_429_count += 1

                    if is_429 or is_5xx:
                        if attempt > max_retries:
                            if is_429:
                                self.rate_limited_failures += 1
                                logger.error(f"[RATE_LIMIT_EXHAUSTED] Student '{student_handle}' ({category}) failed after {max_retries} retries.")
                                raise SourceRateLimitExhaustedError(
                                    f"Rate limit exhausted after {max_retries} retries for student '{student_handle}': {e}",
                                    status_code=429,
                                    raw_response=str(e)
                                )
                            else:
                                logger.error(f"[SOURCE_UNAVAILABLE] Student '{student_handle}' ({category}) failed after {max_retries} retries: {e}")
                                raise SourceUnavailableError(
                                    f"Upstream source unavailable after {max_retries} retries for student '{student_handle}': {e}",
                                    status_code=status_code,
                                    raw_response=str(e)
                                )

                        retry_after = None
                        response_obj = getattr(e, "response", None)
                        if response_obj and hasattr(response_obj, "headers"):
                            header_val = response_obj.headers.get("Retry-After")
                            if header_val and str(header_val).isdigit():
                                retry_after = float(header_val)

                        backoff = retry_after if retry_after else min(max_backoff_sec, base_backoff_sec * (2 ** (attempt - 1)) + random.uniform(0.05, 0.2))
                        logger.warning(f"[RATE_LIMIT_BACKOFF] Student '{student_handle}' ({category}) attempt {attempt}/{max_retries} backoff {backoff:.2f}s. (Reason: {e})")
                        await asyncio.sleep(backoff)
                    else:
                        if "json" in error_str or "graphql" in error_str or "parse" in error_str:
                            raise SourceMalformedResponseError(
                                f"Malformed response for student '{student_handle}': {e}",
                                status_code=status_code,
                                raw_response=str(e)
                            )
                        raise e


# Global Singleton Rate Limiter
global_token_bucket_limiter = TokenBucketRateLimiter()

def get_global_limiter() -> TokenBucketRateLimiter:
    return global_token_bucket_limiter

