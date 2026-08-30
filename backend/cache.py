import time
import threading
from typing import Any, Optional, Dict, List

class FastCache:
    """
    High-performance thread-safe in-memory cache with TTL and namespace tagging.
    Zero external dependencies, microsecond read latency.
    """
    def __init__(self):
        self._store: Dict[str, Any] = {}
        self._expiry: Dict[str, float] = {}
        self._tags: Dict[str, List[str]] = {}
        self._lock = threading.Lock()
        self._key_locks: Dict[str, threading.Lock] = {}

    def _get_key_lock(self, key: str) -> threading.Lock:
        with self._lock:
            if key not in self._key_locks:
                self._key_locks[key] = threading.Lock()
            return self._key_locks[key]

    def get(self, key: str, return_stale: bool = False) -> Optional[Any]:
        with self._lock:
            if key not in self._store:
                return None
            if time.time() > self._expiry.get(key, 0):
                if return_stale:
                    return self._store[key]
                self._delete_key(key)
                return None
            return self._store[key]

    def get_with_status(self, key: str) -> tuple[Optional[Any], bool]:
        """Returns (value, is_stale). Does not delete stale keys."""
        with self._lock:
            if key not in self._store:
                return None, False
            is_stale = time.time() > self._expiry.get(key, 0)
            return self._store[key], is_stale

    def set(self, key: str, value: Any, ttl_seconds: int = 60, tags: Optional[List[str]] = None) -> None:
        with self._lock:
            self._store[key] = value
            self._expiry[key] = time.time() + ttl_seconds
            if tags:
                for tag in tags:
                    if tag not in self._tags:
                        self._tags[tag] = []
                    if key not in self._tags[tag]:
                        self._tags[tag].append(key)

    def get_or_compute(self, key: str, compute_func, ttl_seconds: int = 60, tags: Optional[List[str]] = None) -> Any:
        """
        Cache stampede protection (single-flight locking).
        If the cache is stale, only one thread computes it, others wait.
        """
        cached = self.get(key)
        if cached is not None:
            return cached

        key_lock = self._get_key_lock(key)
        with key_lock:
            # Check again after acquiring lock
            cached = self.get(key)
            if cached is not None:
                return cached
            
            # Compute new value
            value = compute_func()
            self.set(key, value, ttl_seconds, tags)
            return value

    def delete(self, key: str) -> None:
        with self._lock:
            self._delete_key(key)

    def invalidate_tag(self, tag: str) -> None:
        with self._lock:
            keys = self._tags.pop(tag, [])
            for key in keys:
                self._delete_key(key)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()
            self._expiry.clear()
            self._tags.clear()

    def _delete_key(self, key: str) -> None:
        self._store.pop(key, None)
        self._expiry.pop(key, None)

    async def async_get_or_compute(
        self,
        key: str,
        compute_func,
        ttl_seconds: int = 60,
        stale_ttl_seconds: int = 300,
        tags: Optional[List[str]] = None
    ) -> Any:
        """
        Async Cache Stampede protection (single-flight locking).
        Does NOT block the event loop. Uses asyncio.Event per key.
        Implements Stale-While-Revalidate if stale_ttl_seconds > ttl_seconds.
        """
        import asyncio
        import time
        from backend.logger import logger

        if not hasattr(self, '_async_events'):
            self._async_events = {}

        with self._lock:
            if key in self._store:
                expiry = self._expiry.get(key, 0)
                now = time.time()
                if now <= expiry:
                    return self._store[key]
                elif now <= expiry + (stale_ttl_seconds - ttl_seconds):
                    # Stale but within SWR window. Return stale data, trigger background refresh if not already computing
                    if key not in self._async_events:
                        logger.info(f"SWR background refresh triggered for {key}")
                        event = asyncio.Event()
                        self._async_events[key] = event
                        asyncio.create_task(self._compute_and_set(key, compute_func, ttl_seconds, tags, event))
                    return self._store[key]

            # Cache miss or outside SWR window. Must wait.
            if key in self._async_events:
                event = self._async_events[key]
                is_computing = False
            else:
                event = asyncio.Event()
                self._async_events[key] = event
                is_computing = True

        if not is_computing:
            # Wait for the other task to finish computing
            await event.wait()
            # Now read from cache
            with self._lock:
                return self._store.get(key)
        else:
            # We are the designated compute request
            return await self._compute_and_set(key, compute_func, ttl_seconds, tags, event)

    async def _compute_and_set(self, key: str, compute_func, ttl_seconds: int, tags: Optional[List[str]], event) -> Any:
        import asyncio
        from backend.logger import logger
        try:
            value = await asyncio.to_thread(compute_func)
            self.set(key, value, ttl_seconds, tags)
            return value
        except Exception as e:
            logger.error(f"Error computing cache for {key}: {e}")
            raise
        finally:
            with self._lock:
                event.set()
                if hasattr(self, '_async_events') and key in self._async_events:
                    del self._async_events[key]

cache = FastCache()
