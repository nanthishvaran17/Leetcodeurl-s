import os
import time
import random
import asyncio
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
    pass

class SourceMalformedResponseError(LeetCodeSourceError):
    """Raised when upstream LeetCode returns invalid, truncated, or unparseable JSON/GraphQL payloads."""
    pass

class SourceRateLimitExhaustedError(LeetCodeSourceError):
    """Raised when HTTP 429 / throttle limits persist across all exponential backoff retry attempts."""
    pass


# ==============================================================================
# 2. TOKEN-BUCKET RATE LIMITER WITH CONCURRENCY & EXPONENTIAL BACKOFF + JITTER
# ==============================================================================

class TokenBucketRateLimiter:
    """
    Enforces true rate limiting via a Token Bucket algorithm combined with
    an Asyncio Semaphore concurrency limiter.
    
    Guarantees:
    - max_requests_per_second (Tokens replenish smoothly over time)
    - max_concurrent (Bounded concurrent network sockets)
    - Exponential backoff with jitter on HTTP 429 or throttle signals
    - Respects Retry-After HTTP headers
    """
    def __init__(
        self,
        rate_per_sec: Optional[float] = None,
        capacity: Optional[float] = None,
        max_concurrent: Optional[int] = None
    ):
        # Read from environment variables if not explicitly provided
        self.rate_per_sec = rate_per_sec or float(os.getenv("LEETCODE_RATE_LIMIT_RPS", "3.0"))
        self.capacity = capacity or float(os.getenv("LEETCODE_RATE_LIMIT_CAPACITY", "5.0"))
        self.max_concurrent = max_concurrent or int(os.getenv("LEETCODE_RATE_LIMIT_CONCURRENT", "5"))

        self.tokens = self.capacity
        self.last_update = time.monotonic()
        self._lock = asyncio.Lock()
        self._semaphore = asyncio.Semaphore(self.max_concurrent)

    async def acquire_token(self):
        """Acquires a token from the bucket, waiting asynchronously if necessary."""
        while True:
            async with self._lock:
                now = time.monotonic()
                elapsed = now - self.last_update
                self.tokens = min(self.capacity, self.tokens + elapsed * self.rate_per_sec)
                self.last_update = now

                if self.tokens >= 1.0:
                    self.tokens -= 1.0
                    return
                else:
                    needed = 1.0 - self.tokens
                    wait_time = max(0.05, needed / self.rate_per_sec)

            await asyncio.sleep(wait_time)

    async def execute(
        self,
        request_func: Callable[[], Any],
        student_handle: str = "unknown",
        max_retries: int = 5,
        base_backoff_sec: float = 2.0,
        max_backoff_sec: float = 60.0
    ) -> Any:
        """
        Executes a network request with token bucket acquisition, concurrency gating,
        and bounded exponential backoff with jitter.
        """
        attempt = 0
        while attempt < max_retries:
            attempt += 1
            await self.acquire_token()

            async with self._semaphore:
                try:
                    if asyncio.iscoroutinefunction(request_func):
                        result = await request_func()
                    else:
                        result = request_func()
                    return result

                except Exception as e:
                    error_str = str(e).lower()
                    status_code = getattr(e, "status_code", None) or getattr(getattr(e, "response", None), "status_code", None)
                    is_429 = (status_code == 429) or ("429" in error_str) or ("too many requests" in error_str) or ("rate limit" in error_str)
                    is_5xx = (status_code and status_code >= 500) or ("502" in error_str) or ("503" in error_str) or ("504" in error_str) or ("timeout" in error_str)

                    # Extract Retry-After header if available
                    retry_after = None
                    response_obj = getattr(e, "response", None)
                    if response_obj and hasattr(response_obj, "headers"):
                        header_val = response_obj.headers.get("Retry-After")
                        if header_val and str(header_val).isdigit():
                            retry_after = float(header_val)

                    if is_429 or is_5xx:
                        if attempt >= max_retries:
                            logger.error(
                                f"[RATE_LIMIT_EXHAUSTED] Student '{student_handle}' failed after {max_retries} attempts. Error: {e}"
                            )
                            if is_429:
                                raise SourceRateLimitExhaustedError(
                                    f"Rate limit exhausted after {max_retries} retries for student '{student_handle}': {e}",
                                    status_code=429,
                                    raw_response=str(e)
                                )
                            else:
                                raise SourceUnavailableError(
                                    f"Upstream source unavailable after {max_retries} retries for student '{student_handle}': {e}",
                                    status_code=status_code,
                                    raw_response=str(e)
                                )

                        # Calculate backoff with full jitter
                        if retry_after:
                            backoff = retry_after + random.uniform(0.1, 1.0)
                        else:
                            exp_delay = base_backoff_sec * (2 ** (attempt - 1))
                            backoff = min(max_backoff_sec, exp_delay) + random.uniform(0.1, 1.5)

                        logger.warning(
                            f"[RATE_LIMIT_BACKOFF] Student '{student_handle}' attempt {attempt}/{max_retries} triggered backoff. Sleeping {backoff:.2f}s. (Reason: {e})"
                        )
                        await asyncio.sleep(backoff)
                    else:
                        # Non-retryable error (e.g. JSON decode error or 404 username not found)
                        if "json" in error_str or "graphql" in error_str or "parse" in error_str:
                            raise SourceMalformedResponseError(
                                f"Malformed response for student '{student_handle}': {e}",
                                status_code=status_code,
                                raw_response=str(e)
                            )
                        raise e


# Global Singleton Rate Limiter
global_token_bucket_limiter = TokenBucketRateLimiter()
