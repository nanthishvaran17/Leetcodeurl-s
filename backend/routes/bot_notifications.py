"""
bot_notifications.py — API Endpoints for WhatsApp & Telegram Automated Notifications
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from backend.database import get_db
from backend.models import User
from backend.security import require_role
from backend.services.bot_notification_service import bot_notification_service

router = APIRouter(prefix="/bot-notifications", tags=["Bot Notifications"])


class SendDirectMessageRequest(BaseModel):
    channel: str = "WHATSAPP"  # WHATSAPP or TELEGRAM
    recipient: str
    message: str


@router.post("/send-direct")
def send_direct_message(
    payload: SendDirectMessageRequest,
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin", "HOD", "hod", "Faculty", "faculty"))
):
    """Sends immediate direct WhatsApp or Telegram notification."""
    if payload.channel.upper() == "TELEGRAM":
        return bot_notification_service.send_telegram_message(payload.recipient, payload.message)
    else:
        return bot_notification_service.send_whatsapp_message(payload.recipient, payload.message)


@router.post("/broadcast-sunday-results")
def trigger_sunday_broadcast(
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin", "HOD", "hod"))
):
    """Dispatches Sunday weekly contest summary broadcasts to students."""
    return bot_notification_service.trigger_sunday_contest_student_broadcast(db, limit)


@router.post("/broadcast-streak-reminders")
def trigger_streak_reminders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin", "HOD", "hod"))
):
    """Dispatches daily problem streak saver reminders to students with active streaks."""
    return bot_notification_service.trigger_streak_saver_reminders(db)


@router.post("/send-faculty-digest")
def trigger_faculty_digests(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin", "HOD", "hod"))
):
    """Dispatches daily 1:20 mentoring summaries to all active faculty members."""
    return bot_notification_service.trigger_faculty_daily_digests(db)


@router.get("/logs")
def get_bot_logs(
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin", "HOD", "hod", "Faculty", "faculty"))
):
    """Returns recent bot dispatch logs."""
    return bot_notification_service.get_recent_bot_logs(limit)
