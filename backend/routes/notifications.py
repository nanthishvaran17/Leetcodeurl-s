import os
import json
import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import Optional, Dict, Any
from pydantic import BaseModel

from backend.database import get_db
from backend.models import (
    User, NotificationRecord, NotificationPreference, NotificationFile
)
from backend.routes.auth import get_current_user as get_current_active_user
from backend.services.notification_service import NotificationService

router = APIRouter(prefix="/api/notifications", tags=["Notifications Engine"])

def require_security_access(resource_name: str = "", required_roles: list = None):
    def check_access(current_user: User = Depends(get_current_active_user)):
        if required_roles:
            role_str = (current_user.role or "").lower()
            if not any(r.lower() in role_str for r in required_roles):
                raise HTTPException(status_code=403, detail=f"Access denied for {resource_name}")
        return current_user
    return check_access


# ── SCHEMAS ─────────────────────────────────────────────────────────────

class DeviceRegisterRequest(BaseModel):
    user_id: Optional[str] = None
    device_token: str
    platform: str = "android"
    app_version: Optional[str] = None
    device_model: Optional[str] = None

class DeviceUnregisterRequest(BaseModel):
    user_id: Optional[str] = None
    device_token: str

class PreferenceUpdateRequest(BaseModel):
    push_enabled: bool = True
    email_enabled: bool = True
    categories: Dict[str, bool] = {}

class AnnouncementCreateRequest(BaseModel):
    title: str
    message: str
    recipient_scope: str = "ALL" # ALL, ROLE, DEPARTMENT, SEMESTER, SECTION, INDIVIDUAL
    recipient_target: Optional[str] = None
    priority: str = "normal" # low, normal, high, critical
    action_route: Optional[str] = "/dashboard"
    send_email: bool = True

class AppUpdateBroadcastRequest(BaseModel):
    title: str = "New App Version Available"
    message: str = "A new version of the Nandha LeetCode Tracker App is now available. Please update for the latest features."
    version: str = "2.1.0"
    is_mandatory: bool = False
    action_route: str = "/dashboard"


# ── 1. FCM DEVICE TOKEN REGISTRATION ───────────────────────────────────

@router.post("/register-device")
def register_device_token_endpoint(
    req: DeviceRegisterRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Registers client FCM device token for multi-device push notification delivery."""
    user_id = current_user.email if hasattr(current_user, "email") and current_user.email else (
        current_user.reg_no if hasattr(current_user, "reg_no") else str(current_user.id)
    )
    result = NotificationService.register_device_token(
        db=db,
        user_id=user_id,
        device_token=req.device_token,
        platform=req.platform,
        app_version=req.app_version,
        device_model=req.device_model
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@router.delete("/unregister-device")
def unregister_device_token_endpoint(
    req: DeviceUnregisterRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Deactivates device token on user logout."""
    user_id = current_user.email if hasattr(current_user, "email") and current_user.email else (
        current_user.reg_no if hasattr(current_user, "reg_no") else str(current_user.id)
    )
    return NotificationService.unregister_device_token(db, user_id=user_id, device_token=req.device_token)


# ── 2. IN-APP NOTIFICATION CENTER ─────────────────────────────────────

@router.get("")
def get_user_notifications_endpoint(
    category: Optional[str] = Query(None),
    is_read: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Returns paginated in-app notifications for the authenticated user."""
    user_id_variants = set()
    if hasattr(current_user, "email") and current_user.email:
        user_id_variants.add(current_user.email.lower().strip())
        user_id_variants.add(current_user.email.strip())
    if hasattr(current_user, "reg_no") and current_user.reg_no:
        user_id_variants.add(current_user.reg_no.strip())
    if hasattr(current_user, "username") and current_user.username:
        user_id_variants.add(current_user.username.strip())
    if hasattr(current_user, "id"):
        user_id_variants.add(str(current_user.id))
        user_id_variants.add(f"STAFF_{current_user.id}")

    user_id_variants.add("ALL")
    
    role_str = str(getattr(current_user, "role", "")).upper()
    if "ADMIN" in role_str:
        user_id_variants.add("ADMIN")
        user_id_variants.add("STAFF")
    elif role_str in ("HOD", "FACULTY", "STAFF"):
        user_id_variants.add("STAFF")
    else:
        user_id_variants.add("STUDENT")

    query = db.query(NotificationRecord).filter(
        NotificationRecord.recipient_user_id.in_(list(user_id_variants))
    )

    if category and category.lower() != "all":
        query = query.filter(NotificationRecord.category == category.lower())
    if is_read is not None:
        query = query.filter(NotificationRecord.is_read == is_read)

    total_count = query.count()
    records = query.order_by(NotificationRecord.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    items = []
    for r in records:
        items.append({
            "id": r.notification_id,
            "eventId": r.event_id,
            "type": r.event_type,
            "category": r.category,
            "title": r.title,
            "message": r.body,
            "body": r.body,
            "priority": r.priority,
            "isRead": r.is_read,
            "readAt": r.read_at.isoformat() if r.read_at else None,
            "actionRoute": r.route,
            "entityType": r.entity_type,
            "entityId": r.entity_id,
            "fileId": r.file_id,
            "createdBy": r.actor_user_id,
            "createdAt": r.created_at.isoformat() if r.created_at else None,
            "expiresAt": r.expires_at.isoformat() if r.expires_at else None
        })

    unread_count = db.query(NotificationRecord).filter(
        and_(NotificationRecord.recipient_user_id.in_(list(user_id_variants)), NotificationRecord.is_read == False)
    ).count()

    return {
        "items": items,
        "total": total_count,
        "unreadCount": unread_count,
        "page": page,
        "limit": limit
    }


@router.get("/unread-count")
def get_unread_notification_count_endpoint(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Returns exact unread notification count for bell badge."""
    user_id_variants = set()
    if hasattr(current_user, "email") and current_user.email:
        user_id_variants.add(current_user.email.lower().strip())
    if hasattr(current_user, "reg_no") and current_user.reg_no:
        user_id_variants.add(current_user.reg_no.strip())
    if hasattr(current_user, "id"):
        user_id_variants.add(str(current_user.id))
        user_id_variants.add(f"STAFF_{current_user.id}")
    user_id_variants.add("ALL")

    count = db.query(NotificationRecord).filter(
        and_(NotificationRecord.recipient_user_id.in_(list(user_id_variants)), NotificationRecord.is_read == False)
    ).count()

    return {"unreadCount": count}


@router.put("/{notification_id}/read")
def mark_notification_read_endpoint(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Marks single notification as read."""
    record = db.query(NotificationRecord).filter_by(notification_id=notification_id).first()
    if record:
        record.is_read = True
        record.read_at = datetime.datetime.utcnow()
        db.commit()

    return {"success": True, "notification_id": notification_id, "is_read": True}


@router.put("/{notification_id}/unread")
def mark_notification_unread_endpoint(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Marks single notification as unread."""
    record = db.query(NotificationRecord).filter_by(notification_id=notification_id).first()
    if record:
        record.is_read = False
        record.read_at = None
        db.commit()

    return {"success": True, "notification_id": notification_id, "is_read": False}


@router.post("/mark-all-read")
def mark_all_notifications_read_endpoint(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Marks all notifications as read for current user."""
    user_id_variants = set()
    if hasattr(current_user, "email") and current_user.email:
        user_id_variants.add(current_user.email.lower().strip())
    if hasattr(current_user, "reg_no") and current_user.reg_no:
        user_id_variants.add(current_user.reg_no.strip())
    if hasattr(current_user, "id"):
        user_id_variants.add(str(current_user.id))
        user_id_variants.add(f"STAFF_{current_user.id}")
    user_id_variants.add("ALL")

    now_utc = datetime.datetime.utcnow()
    records = db.query(NotificationRecord).filter(
        and_(NotificationRecord.recipient_user_id.in_(list(user_id_variants)), NotificationRecord.is_read == False)
    ).all()

    for r in records:
        r.is_read = True
        r.read_at = now_utc

    db.commit()
    return {"success": True, "marked_count": len(records)}


@router.delete("/{notification_id}")
def delete_notification_endpoint(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Deletes a notification record."""
    record = db.query(NotificationRecord).filter_by(notification_id=notification_id).first()
    if record:
        db.delete(record)
        db.commit()
    return {"success": True, "notification_id": notification_id}


# ── 3. PREFERENCES ──────────────────────────────────────────────────────

@router.get("/preferences")
def get_notification_preferences_endpoint(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Returns user notification preferences."""
    user_id = current_user.email if hasattr(current_user, "email") and current_user.email else str(current_user.id)
    pref = db.query(NotificationPreference).filter_by(user_id=user_id).first()

    default_categories = {
        "assignments": True, "attendance": True, "timetable": True,
        "exams": True, "marks": True, "leave": True, "meetings": True,
        "events": True, "files": True, "reports": True, "announcements": True,
        "achievements": True, "placement": True, "contests": True, "system": True,
        "app_updates": True
    }

    if not pref:
        return {
            "push_enabled": True,
            "email_enabled": True,
            "categories": default_categories
        }

    categories = json.loads(pref.categories_json) if pref.categories_json else default_categories
    return {
        "push_enabled": pref.push_enabled,
        "email_enabled": pref.email_enabled,
        "categories": categories
    }


@router.put("/preferences")
def update_notification_preferences_endpoint(
    req: PreferenceUpdateRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Updates user notification category preferences."""
    user_id = current_user.email if hasattr(current_user, "email") and current_user.email else str(current_user.id)
    pref = db.query(NotificationPreference).filter_by(user_id=user_id).first()

    if not pref:
        pref = NotificationPreference(
            user_id=user_id,
            push_enabled=req.push_enabled,
            email_enabled=req.email_enabled,
            categories_json=json.dumps(req.categories)
        )
        db.add(pref)
    else:
        pref.push_enabled = req.push_enabled
        pref.email_enabled = req.email_enabled
        pref.categories_json = json.dumps(req.categories)

    db.commit()
    return {"success": True, "message": "Notification preferences updated successfully"}


# ── 4. ADMIN ANNOUNCEMENTS & APP UPDATE BROADCASTS ──────────────────────

@router.post("/announcements")
def create_announcement_notification_endpoint(
    req: AnnouncementCreateRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(require_security_access(resource_name="Create Announcement", required_roles=["admin", "super admin", "hod"]))
):
    """Admin endpoint to create and publish announcements with multi-channel push & email delivery."""
    actor_id = getattr(current_user, "email", None) or getattr(current_user, "username", None) or "Admin"
    
    result = NotificationService.emit_event(
        event_type="ANNOUNCEMENT_CREATED",
        title=req.title,
        body=req.message,
        actor_user_id=actor_id,
        recipient_scope=req.recipient_scope,
        recipient_target=req.recipient_target,
        entity_type="announcement",
        route=req.action_route or "/dashboard",
        priority=req.priority,
        send_email_notification=req.send_email
    )

    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error"))

    return result


@router.post("/app-update")
def broadcast_app_update_notification_endpoint(
    req: AppUpdateBroadcastRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(require_security_access(resource_name="App Update Broadcast", required_roles=["admin", "super admin"]))
):
    """Admin endpoint to broadcast app update notifications to all app users."""
    event_type = "APP_UPDATE_REQUIRED" if req.is_mandatory else "APP_UPDATE_AVAILABLE"
    actor_id = getattr(current_user, "email", None) or "Admin"
    
    result = NotificationService.emit_event(
        event_type=event_type,
        title=req.title,
        body=req.message,
        actor_user_id=actor_id,
        recipient_scope="ALL",
        entity_type="app_update",
        route=req.action_route or "/dashboard",
        priority="high" if req.is_mandatory else "normal",
        metadata={"version": req.version, "is_mandatory": req.is_mandatory}
    )
    return result


class TestPushRequest(BaseModel):
    title: Optional[str] = "Contest Reminder 🔔"
    message: Optional[str] = "Sunday LeetCode Contest starts in 30 minutes! Tap to view leaderboard."
    route: Optional[str] = "/weekly-contest"
    priority: Optional[str] = "high"


@router.post("/test-push")
def send_test_push_notification_endpoint(
    req: TestPushRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Triggers an immediate real system push notification to all active devices registered to current user."""
    user_id = current_user.email if hasattr(current_user, "email") and current_user.email else (
        current_user.reg_no if hasattr(current_user, "reg_no") else str(current_user.id)
    )

    result = NotificationService.emit_event(
        event_type="CONTEST_REMINDER",
        title=req.title or "Contest Reminder 🔔",
        body=req.message or "Sunday LeetCode Contest starts in 30 minutes!",
        actor_user_id="System Engine",
        recipient_scope="INDIVIDUAL",
        recipient_target=user_id,
        entity_type="contest",
        route=req.route or "/weekly-contest",
        priority=req.priority or "high"
    )
    return {
        "success": True,
        "message": f"Real system push dispatched to user {user_id}",
        "details": result
    }


# ── 5. SECURE FILE ACCESS & PREVIEW / DOWNLOAD ───────────────────────────

@router.get("/files/{file_id}")
def get_notification_file_metadata_endpoint(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Retrieves metadata for file notifications after verifying user authorization."""
    file_record = db.query(NotificationFile).filter_by(file_id=file_id, is_deleted=False).first()
    if not file_record:
        raise HTTPException(status_code=440, detail="File document no longer available or has expired.")

    # Authorization Check
    user_role = str(getattr(current_user, "role", "")).upper()
    str(getattr(current_user, "department", "")).upper()
    scope = file_record.access_scope.upper()

    if scope == "ADMIN_ONLY" and "ADMIN" not in user_role:
        raise HTTPException(status_code=403, detail="Access denied: Admin authorization required to view this file.")

    return {
        "fileId": file_record.file_id,
        "filename": file_record.filename,
        "fileType": file_record.file_type,
        "fileSize": file_record.file_size,
        "uploadedBy": file_record.uploaded_by,
        "uploadedAt": file_record.uploaded_at.isoformat() if file_record.uploaded_at else None,
        "accessScope": file_record.access_scope
    }


@router.get("/files/{file_id}/download")
def download_notification_file_endpoint(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Secure stream download of notification attachment."""
    file_record = db.query(NotificationFile).filter_by(file_id=file_id, is_deleted=False).first()
    if not file_record or not os.path.exists(file_record.storage_path):
        raise HTTPException(status_code=440, detail="File document not found or expired.")

    user_role = str(getattr(current_user, "role", "")).upper()
    if file_record.access_scope.upper() == "ADMIN_ONLY" and "ADMIN" not in user_role:
        raise HTTPException(status_code=403, detail="Access denied.")

    return FileResponse(
        path=file_record.storage_path,
        filename=file_record.filename,
        media_type="application/octet-stream"
    )


@router.get("/files/{file_id}/preview")
def preview_notification_file_endpoint(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Secure preview stream for PDF/images."""
    file_record = db.query(NotificationFile).filter_by(file_id=file_id, is_deleted=False).first()
    if not file_record or not os.path.exists(file_record.storage_path):
        raise HTTPException(status_code=440, detail="File document not found or expired.")

    user_role = str(getattr(current_user, "role", "")).upper()
    if file_record.access_scope.upper() == "ADMIN_ONLY" and "ADMIN" not in user_role:
        raise HTTPException(status_code=403, detail="Access denied.")

    media_type = "application/pdf" if file_record.file_type.lower() == "pdf" else "image/png"
    return FileResponse(
        path=file_record.storage_path,
        filename=file_record.filename,
        media_type=media_type
    )
