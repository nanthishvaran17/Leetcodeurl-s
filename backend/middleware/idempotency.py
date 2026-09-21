import time
import asyncio
from typing import Dict, Any, Optional
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse
from backend.logger import logger

# Store completed idempotent responses: key -> {"status_code": int, "body": bytes, "headers": dict, "timestamp": float}
_IDEMPOTENCY_STORE: Dict[str, Dict[str, Any]] = {}
# Store in-flight requests: key -> asyncio.Event
_IDEMPOTENCY_IN_FLIGHT: Dict[str, asyncio.Event] = {}
_IDEMPOTENCY_LOCK = asyncio.Lock()

TTL_SECONDS = 300  # 5 minutes cache lifetime

async def cleanup_expired_keys():
    """Periodically prunes expired idempotency keys."""
    now = time.time()
    async with _IDEMPOTENCY_LOCK:
        expired = [k for k, v in _IDEMPOTENCY_STORE.items() if now - v["timestamp"] > TTL_SECONDS]
        for k in expired:
            _IDEMPOTENCY_STORE.pop(k, None)

class IdempotencyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Only handle mutating HTTP methods (POST, PUT, DELETE, PATCH)
        if request.method not in ("POST", "PUT", "DELETE", "PATCH"):
            return await call_next(request)

        idempotency_key = request.headers.get("X-Idempotency-Key") or request.headers.get("Idempotency-Key")
        if not idempotency_key or not idempotency_key.strip():
            return await call_next(request)

        key = f"{request.method}:{request.url.path}:{idempotency_key.strip()}"
        now = time.time()

        # Check if response already cached
        async with _IDEMPOTENCY_LOCK:
            cached = _IDEMPOTENCY_STORE.get(key)
            if cached and (now - cached["timestamp"] < TTL_SECONDS):
                logger.info(f"[IDEMPOTENCY] Replaying cached response for key: {idempotency_key}")
                response_headers = dict(cached["headers"])
                response_headers["X-Cache-Lookup"] = "HIT-IDEMPOTENT"
                return StarletteResponse(
                    content=cached["body"],
                    status_code=cached["status_code"],
                    headers=response_headers,
                    media_type=cached.get("media_type")
                )

            # Check if request is currently in-flight
            if key in _IDEMPOTENCY_IN_FLIGHT:
                event = _IDEMPOTENCY_IN_FLIGHT[key]
                # Wait for in-flight request to finish (up to 30s timeout)
                try:
                    await asyncio.wait_for(event.wait(), timeout=30.0)
                    cached = _IDEMPOTENCY_STORE.get(key)
                    if cached:
                        response_headers = dict(cached["headers"])
                        response_headers["X-Cache-Lookup"] = "HIT-IDEMPOTENT-WAIT"
                        return StarletteResponse(
                            content=cached["body"],
                            status_code=cached["status_code"],
                            headers=response_headers,
                            media_type=cached.get("media_type")
                        )
                except asyncio.TimeoutError:
                    pass

            # Mark key as in-flight
            event = asyncio.Event()
            _IDEMPOTENCY_IN_FLIGHT[key] = event

        try:
            response = await call_next(request)

            # Read response body stream so it can be cached and replayed
            response_body = [chunk async for chunk in response.body_iterator]
            body_bytes = b"".join(response_body)

            # Filter headers to remove content-length so Starlette recalculates correctly
            headers = {k: v for k, v in response.headers.items() if k.lower() != "content-length"}

            # Cache successful or client-side responses (status < 500)
            if response.status_code < 500:
                async with _IDEMPOTENCY_LOCK:
                    _IDEMPOTENCY_STORE[key] = {
                        "status_code": response.status_code,
                        "body": body_bytes,
                        "headers": headers,
                        "media_type": response.media_type,
                        "timestamp": time.time()
                    }

            # Return fresh StarletteResponse with copied body
            return StarletteResponse(
                content=body_bytes,
                status_code=response.status_code,
                headers=headers,
                media_type=response.media_type
            )
        finally:
            async with _IDEMPOTENCY_LOCK:
                if key in _IDEMPOTENCY_IN_FLIGHT:
                    evt = _IDEMPOTENCY_IN_FLIGHT.pop(key)
                    evt.set()
