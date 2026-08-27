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

cache = FastCache()
