import time
import threading
from typing import Any, Optional, Dict, List
import json
import os
import asyncio
from backend.logger import logger

try:
    import redis
    import redis.asyncio as aioredis
except ImportError:
    redis = None
    aioredis = None

REDIS_URL = os.environ.get("REDIS_URL")

class FastCache:
    """
    High-performance thread-safe in-memory cache with TTL and namespace tagging.
    Fallback for when Redis is not configured.
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
        cached = self.get(key)
        if cached is not None:
            return cached

        key_lock = self._get_key_lock(key)
        with key_lock:
            cached = self.get(key)
            if cached is not None:
                return cached
            
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
        if not hasattr(self, '_async_events'):
            self._async_events = {}

        with self._lock:
            if key in self._store:
                expiry = self._expiry.get(key, 0)
                now = time.time()
                if now <= expiry:
                    return self._store[key]
                elif now <= expiry + (stale_ttl_seconds - ttl_seconds):
                    if key not in self._async_events:
                        event = asyncio.Event()
                        self._async_events[key] = event
                        asyncio.create_task(self._compute_and_set(key, compute_func, ttl_seconds, tags, event))
                    return self._store[key]

            if key in self._async_events:
                event = self._async_events[key]
                is_computing = False
            else:
                event = asyncio.Event()
                self._async_events[key] = event
                is_computing = True

        if not is_computing:
            await event.wait()
            with self._lock:
                return self._store.get(key)
        else:
            return await self._compute_and_set(key, compute_func, ttl_seconds, tags, event)

    async def _compute_and_set(self, key: str, compute_func, ttl_seconds: int, tags: Optional[List[str]], event) -> Any:
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


class HybridRedisCache:
    """
    Production-ready distributed cache wrapper.
    Uses Redis if available, otherwise falls back to FastCache.
    """
    def __init__(self):
        self.local_cache = FastCache()
        self.use_redis = REDIS_URL is not None and redis is not None
        if self.use_redis:
            try:
                self.redis_sync = redis.from_url(REDIS_URL, decode_responses=True)
                self.redis_async = aioredis.from_url(REDIS_URL, decode_responses=True)
                logger.info("Distributed Redis Cache initialized for stateless scaling.")
            except Exception as e:
                logger.error(f"Failed to connect to Redis: {e}. Falling back to local cache.")
                self.use_redis = False

    def get(self, key: str, return_stale: bool = False) -> Optional[Any]:
        if self.use_redis:
            try:
                val = self.redis_sync.get(key)
                return json.loads(val) if val else None
            except Exception:
                pass
        return self.local_cache.get(key, return_stale)
        
    def get_with_status(self, key: str) -> tuple[Optional[Any], bool]:
        # Redis doesn't easily return stale data once expired natively without complex structures
        # For simplicity, if Redis is used, we treat all fetched data as fresh if it exists.
        if self.use_redis:
            val = self.get(key)
            return val, False
        return self.local_cache.get_with_status(key)

    def set(self, key: str, value: Any, ttl_seconds: int = 60, tags: Optional[List[str]] = None) -> None:
        if self.use_redis:
            try:
                self.redis_sync.set(key, json.dumps(value), ex=ttl_seconds)
                # Note: Tagging in Redis requires sets. Simplified here, relying on keys.
                return
            except Exception:
                pass
        self.local_cache.set(key, value, ttl_seconds, tags)

    def get_or_compute(self, key: str, compute_func, ttl_seconds: int = 60, tags: Optional[List[str]] = None) -> Any:
        # Simplistic lockless sync get_or_compute for Redis wrapper
        cached = self.get(key)
        if cached is not None:
            return cached
        
        # Redis distributed lock is ideal here, but for simplicity falling back to local locking
        # if Redis is down, or just computing directly and setting.
        value = compute_func()
        self.set(key, value, ttl_seconds, tags)
        return value

    def delete(self, key: str) -> None:
        if self.use_redis:
            try:
                self.redis_sync.delete(key)
                return
            except Exception:
                pass
        self.local_cache.delete(key)

    def invalidate_tag(self, tag: str) -> None:
        # Full tag invalidation in Redis requires indexing. We skip for now in this wrapper.
        self.local_cache.invalidate_tag(tag)

    def clear(self) -> None:
        if self.use_redis:
            try:
                self.redis_sync.flushdb()
                return
            except Exception:
                pass
        self.local_cache.clear()

    async def async_get_or_compute(
        self,
        key: str,
        compute_func,
        ttl_seconds: int = 60,
        stale_ttl_seconds: int = 300,
        tags: Optional[List[str]] = None
    ) -> Any:
        if self.use_redis:
            try:
                val = await self.redis_async.get(key)
                if val:
                    return json.loads(val)
                # Cache miss
                value = await asyncio.to_thread(compute_func)
                await self.redis_async.set(key, json.dumps(value), ex=ttl_seconds)
                return value
            except Exception as e:
                logger.error(f"Redis async cache error: {e}. Falling back.")
        return await self.local_cache.async_get_or_compute(key, compute_func, ttl_seconds, stale_ttl_seconds, tags)

# Export the hybrid cache that scales horizontally if REDIS_URL is provided
cache = HybridRedisCache()
