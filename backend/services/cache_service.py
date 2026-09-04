import json
import logging
from typing import Any, Optional, Callable, Dict, List
import redis
from backend.config import settings
from backend.cache import cache as in_memory_cache

logger = logging.getLogger("leetcode_tracker")

class CacheService:
    """
    Robust Redis Cache Service with automatic fallback to in-memory FastCache.
    Implements a circuit breaker pattern: if Redis is down, it falls back gracefully
    without bringing down the application.
    """
    def __init__(self):
        self._redis_client: Optional[redis.Redis] = None
        self._is_redis_available: bool = False
        self._initialize_redis()

    def _initialize_redis(self):
        redis_url = getattr(settings, "REDIS_URL", None)
        if not redis_url:
            logger.info("[CACHE] REDIS_URL not configured. Using in-memory fallback cache.")
            return

        try:
            # We use decode_responses=True so that we get strings back from Redis, not bytes
            self._redis_client = redis.from_url(redis_url, decode_responses=True, socket_timeout=2.0)
            # Ping to check if available
            self._redis_client.ping()
            self._is_redis_available = True
            logger.info("[CACHE] Successfully connected to Redis.")
        except redis.ConnectionError as e:
            logger.warning(f"[CACHE] Failed to connect to Redis: {e}. Falling back to in-memory cache.")
            self._redis_client = None
            self._is_redis_available = False
        except Exception as e:
            logger.error(f"[CACHE] Unexpected error initializing Redis: {e}. Falling back to in-memory cache.")
            self._redis_client = None
            self._is_redis_available = False

    def _safe_serialize(self, data: Any) -> str:
        try:
            return json.dumps(data)
        except (TypeError, ValueError) as e:
            logger.error(f"[CACHE] Serialization error: {e}")
            raise

    def _safe_deserialize(self, data: str) -> Any:
        try:
            return json.loads(data)
        except (TypeError, ValueError) as e:
            logger.error(f"[CACHE] Deserialization error: {e}")
            raise

    async def get_or_compute(
        self,
        key: str,
        compute_func: Callable,
        ttl_seconds: int = 60,
        stale_ttl_seconds: int = 300,
        tags: Optional[List[str]] = None
    ) -> Any:
        """
        Gets a value from the cache, or computes it and caches the result.
        Automatically handles Redis serialization and fallback to in-memory cache.
        """
        import asyncio
        
        # If Redis is available, try it first
        if self._is_redis_available and self._redis_client:
            try:
                cached_data = self._redis_client.get(key)
                if cached_data is not None:
                    return self._safe_deserialize(cached_data)
            except redis.RedisError as e:
                logger.warning(f"[CACHE] Redis get error for key {key}: {e}. Falling back to in-memory cache.")
                # Circuit breaker: assume Redis is temporarily down
                self._is_redis_available = False

        # Determine if compute_func is a coroutine
        is_async = asyncio.iscoroutinefunction(compute_func)
        
        if is_async:
            # For async functions, compute directly and store if missed in Redis
            # We bypass the in-memory stampede protection for async here to keep it simple,
            # but we still store it in memory.
            result = await compute_func()
            if self._is_redis_available and self._redis_client:
                try:
                    self._redis_client.setex(key, ttl_seconds, self._safe_serialize(result))
                except redis.RedisError:
                    pass
            in_memory_cache.set(key, result, ttl_seconds, tags)
            return result
        else:
            # Synchronous compute_func
            def _sync_compute():
                result = compute_func()
                # Try to write to Redis as well
                if self._is_redis_available and self._redis_client:
                    try:
                        self._redis_client.setex(key, ttl_seconds, self._safe_serialize(result))
                    except redis.RedisError as e:
                        logger.warning(f"[CACHE] Redis set error for key {key}: {e}")
                return result

            return await in_memory_cache.async_get_or_compute(
                key=key,
                compute_func=_sync_compute,
                ttl_seconds=ttl_seconds,
                stale_ttl_seconds=stale_ttl_seconds,
                tags=tags
            )

    def get_or_compute_sync(
        self,
        key: str,
        compute_func: Callable,
        ttl_seconds: int = 60,
        tags: Optional[List[str]] = None
    ) -> Any:
        """
        Synchronous version for use in standard FastAPI `def` endpoints 
        to avoid SQLAlchemy threading issues across asyncio threads.
        """
        if self._is_redis_available and self._redis_client:
            try:
                cached_data = self._redis_client.get(key)
                if cached_data is not None:
                    return self._safe_deserialize(cached_data)
            except redis.RedisError as e:
                logger.warning(f"[CACHE] Redis get error for key {key}: {e}")
                self._is_redis_available = False

        def _sync_compute():
            result = compute_func()
            if self._is_redis_available and self._redis_client:
                try:
                    self._redis_client.setex(key, ttl_seconds, self._safe_serialize(result))
                except redis.RedisError as e:
                    logger.warning(f"[CACHE] Redis set error for key {key}: {e}")
            return result

        return in_memory_cache.get_or_compute(
            key=key,
            compute_func=_sync_compute,
            ttl_seconds=ttl_seconds,
            tags=tags
        )

    def invalidate(self, key: str):
        if self._is_redis_available and self._redis_client:
            try:
                self._redis_client.delete(key)
            except redis.RedisError as e:
                logger.warning(f"[CACHE] Redis invalidate error for key {key}: {e}")
        
        in_memory_cache.delete(key)
        
    def invalidate_tag(self, tag: str):
        # Redis doesn't natively support tag invalidation without sets.
        # For simplicity, if we use tags, we primarily rely on in-memory invalidation 
        # or we could implement a Redis set for tags.
        # For now, just invalidate in memory.
        in_memory_cache.invalidate_tag(tag)

cache_service = CacheService()
