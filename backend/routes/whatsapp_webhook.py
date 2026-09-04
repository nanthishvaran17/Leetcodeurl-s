"""
whatsapp_webhook.py — Production Meta WhatsApp Webhook Router

Endpoints:
1. GET  /api/whatsapp/webhook: Meta Webhook Handshake (hub.mode, hub.challenge, hub.verify_token)
2. POST /api/whatsapp/webhook: Inbound message receiver with HMAC-SHA256 signature verification, deduplication, and routing
3. POST /api/whatsapp/link-number: Secure authenticated API to link WhatsApp numbers
4. GET  /api/whatsapp/status: Production readiness & configuration telemetry
5. GET  /api/whatsapp/metrics: Outbound delivery and latency metrics
"""

import os
from typing import Optional
from fastapi import APIRouter, Depends, Request, Query, HTTPException, Header, status, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, Student
from backend.security import require_role
from backend.services.whatsapp_auth_service import whatsapp_auth_service
from backend.services.whatsapp_agent_service import whatsapp_agent_service
from backend.services.meta_whatsapp_client import meta_whatsapp_client
from backend.logger import logger

router = APIRouter(prefix="/api/whatsapp", tags=["WhatsApp Integration"])


class LinkNumberPayload(BaseModel):
    target_type: str        # 'USER' or 'STUDENT'
    target_id: int          # User ID or Student ID
    phone_number: str       # E.164 phone number


@router.get("/webhook")
@router.get("/webhook/")
def verify_webhook(
    request: Request,
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token")
):
    """
    Standard Meta WhatsApp Cloud API Webhook Handshake Verification.
    1. Validates hub.mode == 'subscribe'
    2. Securely compares hub.verify_token against configured environment variable
    3. Returns hub.challenge as raw plain text with HTTP 200 (NO JSON, NO wrapping, NO quotes)
    4. Returns HTTP 403 Forbidden on invalid or mismatched token
    """
    # Extract query params directly from request if alias not populated
    mode = hub_mode or request.query_params.get("hub.mode") or request.query_params.get("hub_mode") or ""
    challenge = hub_challenge or request.query_params.get("hub.challenge") or request.query_params.get("hub_challenge") or ""
    token = hub_verify_token or request.query_params.get("hub.verify_token") or request.query_params.get("hub_verify_token") or ""

    expected_token = (
        os.environ.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN")
        or os.environ.get("WHATSAPP_VERIFY_TOKEN")
        or meta_whatsapp_client.verify_token
        or ""
    )

    if mode == "subscribe" and token and expected_token:
        # Constant-time comparison to prevent timing attacks
        import hmac
        if hmac.compare_digest(token.strip(), expected_token.strip()):
            logger.info("[WHATSAPP_WEBHOOK] Handshake verified successfully with Meta. Echoing challenge as plain text.")
            return Response(content=str(challenge), media_type="text/plain; charset=utf-8", status_code=200)

    logger.warning(f"[WHATSAPP_WEBHOOK_HANDSHAKE_FAILED] Verification failed. Mode: '{mode}', Token Provided: {'YES' if token else 'NO'}")
    return Response(content="Forbidden: Invalid verify token or hub.mode", media_type="text/plain; charset=utf-8", status_code=403)


@router.post("/webhook")
@router.post("/webhook/")
async def receive_inbound_whatsapp(
    request: Request,
    db: Session = Depends(get_db),
    x_hub_signature_256: Optional[str] = Header(None, alias="X-Hub-Signature-256")
):
    """
    Processes inbound messages from Meta WhatsApp Cloud API or Twilio.
    Includes HMAC-SHA256 signature verification, deduplication, and intent routing.
    """
    raw_body_bytes = await request.body()

    # 1. Signature Verification
    if not meta_whatsapp_client.verify_webhook_signature(raw_body_bytes, x_hub_signature_256):
        logger.warning("[WHATSAPP_SECURITY_ALERT] Invalid webhook signature detected.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature."
        )

    from_phone = ""
    message_body = ""
    message_id = ""

    content_type = request.headers.get("content-type", "")

    # 2. Parse Payload (Meta Cloud API JSON format)
    if "application/json" in content_type:
        try:
            import json
            body = json.loads(raw_body_bytes.decode("utf-8"))

            # Meta Cloud API standard JSON hierarchy
            if "entry" in body:
                for entry in body.get("entry", []):
                    for change in entry.get("changes", []):
                        val = change.get("value", {})
                        # Check for delivery receipts (sent -> delivered -> read)
                        statuses = val.get("statuses", [])
                        if statuses:
                            stat_obj = statuses[0]
                            wamid = stat_obj.get("id", "")
                            stat = stat_obj.get("status", "")
                            ts = stat_obj.get("timestamp", "")
                            meta_whatsapp_client.record_delivery_status(wamid, stat, ts)
                            return {
                                "status": "DELIVERY_STATUS_UPDATED",
                                "wamid": wamid,
                                "delivery_status": stat
                            }

                        messages = val.get("messages", [])
                        if messages:
                            msg_obj = messages[0]
                            from_phone = msg_obj.get("from", "")
                            message_id = msg_obj.get("id", "")
                            if msg_obj.get("type") == "text":
                                message_body = msg_obj.get("text", {}).get("body", "")
            else:
                # Custom JSON payload
                if "statuses" in body:
                    statuses = body.get("statuses", [])
                    if statuses:
                        stat_obj = statuses[0]
                        wamid = stat_obj.get("id", "")
                        stat = stat_obj.get("status", "")
                        meta_whatsapp_client.record_delivery_status(wamid, stat)
                        return {"status": "DELIVERY_STATUS_UPDATED", "wamid": wamid, "delivery_status": stat}

                from_phone = body.get("From") or body.get("from_number") or body.get("phone") or ""
                message_body = body.get("Body") or body.get("message") or body.get("text") or ""
                message_id = body.get("id") or body.get("message_id") or ""
        except Exception as e:
            logger.error(f"[WHATSAPP_PARSE_ERROR] JSON decoding failed: {e}")

    else:
        # Form Data (Twilio format)
        try:
            form = await request.form()
            from_phone = form.get("From") or form.get("from") or ""
            message_body = form.get("Body") or form.get("body") or ""
            message_id = form.get("MessageSid") or form.get("SmsSid") or ""
        except Exception as e:
            logger.error(f"[WHATSAPP_PARSE_ERROR] Form decoding failed: {e}")

    if not from_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing sender phone number."
        )

    # 3. Route through Production WhatsApp Agent Service
    result = whatsapp_agent_service.process_incoming_message(
        db=db,
        from_phone=from_phone,
        message_body=message_body,
        message_id=message_id
    )

    return result


@router.post("/link-number")
def link_whatsapp_number(
    payload: LinkNumberPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Super Admin", "Admin", "HOD", "hod", "Faculty", "faculty", "Staff"))
):
    """Links verified phone number to User or Student record with role boundary guard."""
    if current_user.role in ["HOD", "hod"] and current_user.department_id:
        if payload.target_type.upper() == "STUDENT":
            st = db.query(Student).filter(Student.id == payload.target_id).first()
            if st and st.department_id != current_user.department_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="HOD can only link phone numbers for students in their own department."
                )

    result = whatsapp_auth_service.link_phone_number(
        db=db,
        target_type=payload.target_type,
        target_id=payload.target_id,
        phone_number=payload.phone_number
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Failed to link phone number.")
        )

    return result


@router.get("/status")
def get_whatsapp_production_status():
    """Returns Meta WhatsApp Cloud API production status & configuration."""
    return {
        "status": "OPERATIONAL",
        "service": "Nandha LeetCode WhatsApp Agent",
        "api_version": meta_whatsapp_client.api_version,
        "production_callback_url": meta_whatsapp_client.production_webhook_url,
        "is_live_configured": meta_whatsapp_client.is_live_configured(),
        "phone_number_id_configured": bool(meta_whatsapp_client.phone_number_id),
        "waba_id_configured": bool(meta_whatsapp_client.business_account_id),
        "verify_token_configured": bool(meta_whatsapp_client.verify_token),
        "app_secret_configured": bool(meta_whatsapp_client.app_secret),
        "subscribed_webhook_fields": ["messages", "statuses", "message_template_status_update"],
        "rate_limiting_active": True,
        "deduplication_active": True,
        "security_isolation_enforced": "4-Tier (Principal -> HOD -> Faculty -> Student)"
    }


@router.get("/metrics")
def get_whatsapp_metrics():
    """Returns outbound message dispatch telemetry & latency metrics."""
    return meta_whatsapp_client.get_outbound_metrics()
