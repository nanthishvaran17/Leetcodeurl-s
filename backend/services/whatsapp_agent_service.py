"""
whatsapp_agent_service.py — Production WhatsApp Agent Engine

Features:
1. Meta WhatsApp Cloud API Production flow with Conversation Correlation IDs.
2. In-Memory Thread-Safe Deduplication Cache (Prevents double replies on Meta retry webhooks).
3. Sender-level Rate Limiting (Protects from spam bursts).
4. Natural Language + Slash Command Intent Routing via WhatsAppIntentRouter.
5. Strict Read-Only Database Queries with 4-Tier Role Isolation.
6. Dispatch via MetaWhatsAppClient with structured execution logs.
"""

import time
import uuid
import threading
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.services.whatsapp_auth_service import whatsapp_auth_service, WhatsAppIdentity
from backend.services.whatsapp_intent_router import whatsapp_intent_router
from backend.services.meta_whatsapp_client import meta_whatsapp_client
from backend.logger import logger


class WhatsAppAgentService:
    _lock = threading.Lock()
    _dedup_cache: Dict[str, float] = {}             # {message_key: expiry_timestamp}
    _rate_limit_cache: Dict[str, list] = {}         # {phone_number: [timestamp1, timestamp2, ...]}
    _DEDUP_TTL_SECONDS = 120.0                      # 2-minute deduplication window
    _RATE_LIMIT_MAX_PER_MINUTE = 20                 # Max 20 messages per minute

    @classmethod
    def is_duplicate(cls, message_key: str) -> bool:
        """Checks if a message ID / payload signature was already processed recently."""
        if not message_key:
            return False

        now = time.time()
        with cls._lock:
            # Clean expired keys
            expired = [k for k, exp in cls._dedup_cache.items() if exp < now]
            for k in expired:
                del cls._dedup_cache[k]

            if message_key in cls._dedup_cache:
                return True

            cls._dedup_cache[message_key] = now + cls._DEDUP_TTL_SECONDS
            return False

    @classmethod
    def check_rate_limit(cls, phone_number: str) -> bool:
        """
        Sliding-window rate limiter. Returns True if request is allowed,
        False if rate limit is exceeded.
        """
        if not phone_number:
            return True

        now = time.time()
        one_min_ago = now - 60.0

        with cls._lock:
            timestamps = cls._rate_limit_cache.get(phone_number, [])
            # Filter out timestamps older than 60s
            timestamps = [t for t in timestamps if t > one_min_ago]

            if len(timestamps) >= cls._RATE_LIMIT_MAX_PER_MINUTE:
                cls._rate_limit_cache[phone_number] = timestamps
                return False

            timestamps.append(now)
            cls._rate_limit_cache[phone_number] = timestamps
            return True

    @classmethod
    def process_incoming_message(
        cls,
        db: Session,
        from_phone: str,
        message_body: str,
        message_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Production pipeline for incoming WhatsApp queries:
        1. Rate Limiting Check.
        2. Deduplication Idempotency Check.
        3. Phone Identity Resolution & 4-Tier Role Scoping.
        4. Natural Language Intent Analysis & Execution.
        5. Outbound Meta WhatsApp Cloud API dispatch.
        """
        start_perf = time.perf_counter()
        corr_id = f"WA-{uuid.uuid4().hex[:8].upper()}"

        # 1. Rate Limiting Check
        if not cls.check_rate_limit(from_phone):
            logger.warning(f"[{corr_id}] [WHATSAPP_RATE_LIMIT_EXCEEDED] From: {from_phone}")
            rate_limit_msg = "⏳ *Rate Limit Notice:*\nYou are sending messages too quickly. Please wait a moment before sending your next query."
            meta_whatsapp_client.send_text_message(from_phone, rate_limit_msg, correlation_id=corr_id)
            return {
                "success": False,
                "status": "RATE_LIMITED",
                "correlation_id": corr_id,
                "response_text": rate_limit_msg
            }

        # 2. Deduplication Check (Meta Webhook Retries)
        dedup_key = message_id or f"{from_phone}:{message_body.strip()}:{int(time.time() // 3)}"
        if cls.is_duplicate(dedup_key):
            logger.info(f"[{corr_id}] [WHATSAPP_DUPLICATE_IGNORED] Key: {dedup_key}")
            return {
                "success": True,
                "status": "DUPLICATE_IGNORED",
                "correlation_id": corr_id,
                "message": "Duplicate event acknowledged without re-processing."
            }

        # 3. Identity Resolution & 4-Tier Role Check
        identity: WhatsAppIdentity = whatsapp_auth_service.resolve_identity(db, from_phone)

        logger.info(
            f"[{corr_id}] [WHATSAPP_INBOUND] From: {from_phone} "
            f"({identity.name} - Role: {identity.role}) | Msg: '{message_body}'"
        )

        # 4. Natural Language & Command Processing via Intent Router
        router_result = whatsapp_intent_router.parse_and_route(
            db=db,
            identity=identity,
            user_message=message_body
        )

        reply_text = router_result.get("message", "No response generated.")
        intent_detected = router_result.get("intent", "UNKNOWN")

        # 5. Outbound Meta WhatsApp Message Dispatch
        dispatch_result = meta_whatsapp_client.send_text_message(
            to_phone=identity.phone_number or from_phone,
            text=reply_text,
            correlation_id=corr_id
        )

        elapsed_ms = (time.perf_counter() - start_perf) * 1000
        logger.info(
            f"[{corr_id}] [WHATSAPP_RESPONSE_COMPLETE] Role: {identity.role} | "
            f"Intent: {intent_detected} | Total Latency: {elapsed_ms:.1f}ms"
        )

        return {
            "success": router_result.get("success", True),
            "status": "PROCESSED",
            "correlation_id": corr_id,
            "role": identity.role,
            "user_name": identity.name,
            "phone_number": identity.phone_number,
            "intent": intent_detected,
            "response_text": reply_text,
            "dispatch": dispatch_result,
            "total_latency_ms": elapsed_ms
        }


whatsapp_agent_service = WhatsAppAgentService()
