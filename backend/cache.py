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

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            if key not in self._store:
                return None
            if time.time() > self._expiry.get(key, 0):
                self._delete_key(key)
                return None
            return self._store[key]

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
