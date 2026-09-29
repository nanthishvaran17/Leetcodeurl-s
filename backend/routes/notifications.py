import os
import json
import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import Optional, Dict, Any, cast
from pydantic import BaseModel

from backend.database import get_db
from backend.models import (
    User, NotificationRecord, NotificationPreference, NotificationFile
)
from backend.routes.auth import get_current_user as get_current_active_user
from backend.services.notification_service import NotificationService

router = APIRouter(prefix="/api/notifications", tags=["Notifications Engine"])

def require_security_access(resource_name: str = "", required_roles: Optional[list] = None):
    def check_access(current_user: User = Depends(get_current_active_user)):
        if required_roles:
            role_str = (current_user.role or "").lower()
            if not any(r.lower() in role_str for r in required_roles):
                raise HTTPException(status_code=403, detail=f"Access denied for {resource_name}")
        return current_user
    return check_access


# SCHEMAS 

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
    version: str = "2.2.0"
    is_mandatory: bool = False
    action_route: str = "/dashboard"


def get_primary_user_id(current_user: Any) -> str:
    if hasattr(current_user, "email") and current_user.email and str(current_user.email).strip():
        return str(current_user.email).strip().lower()
    if hasattr(current_user, "reg_no") and current_user.reg_no and str(current_user.reg_no).strip():
        return str(current_user.reg_no).strip().upper()
    if hasattr(current_user, "username") and current_user.username and str(current_user.username).strip():
        return str(current_user.username).strip()
    if hasattr(current_user, "id") and current_user.id is not None and str(current_user.id) != "0":
        role_str = str(getattr(current_user, "role", "")).upper()
        if "STUDENT" in role_str:
            return str(current_user.id)
        return f"STAFF_{current_user.id}"
    return "anonymous_user"

# 1. FCM DEVICE TOKEN REGISTRATION 

@router.post("/register-device")
def register_device_token_endpoint(
    req: DeviceRegisterRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Registers client FCM device token for multi-device push notification delivery."""
    user_id = get_primary_user_id(current_user)
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
    user_id = get_primary_user_id(current_user)
    return NotificationService.unregister_device_token(db, user_id=user_id, device_token=req.device_token)


def get_user_id_variants(current_user: Any) -> set:
    user_id_variants = set()
    primary_id = get_primary_user_id(current_user)
    if primary_id and primary_id != "anonymous_user":
        user_id_variants.add(primary_id)
        
    if hasattr(current_user, "email") and current_user.email and str(current_user.email).strip():
        user_id_variants.add(str(current_user.email).lower().strip())
        user_id_variants.add(str(current_user.email).strip())
    if hasattr(current_user, "reg_no") and current_user.reg_no and str(current_user.reg_no).strip():
        user_id_variants.add(str(current_user.reg_no).strip())
        user_id_variants.add(str(current_user.reg_no).upper().strip())
    if hasattr(current_user, "username") and current_user.username and str(current_user.username).strip():
        user_id_variants.add(str(current_user.username).strip())
        user_id_variants.add(str(current_user.username).lower().strip())
    if hasattr(current_user, "id") and current_user.id is not None and str(current_user.id) != "0":
        user_id_variants.add(str(current_user.id))
        user_id_variants.add(f"STAFF_{current_user.id}")

    user_id_variants.add("ALL")
    user_id_variants.add("SYSTEM")
    
    role_str = str(getattr(current_user, "role", "")).upper()
    if "ADMIN" in role_str:
        user_id_variants.add("ADMIN")
        user_id_variants.add("STAFF")
        user_id_variants.add("FACULTY")
        user_id_variants.add("HOD")
        user_id_variants.add("STUDENT")
    elif any(r in role_str for r in ["HOD", "FACULTY", "STAFF", "MENTOR", "INSTRUCTOR"]):
        user_id_variants.add("STAFF")
        user_id_variants.add("FACULTY")
        user_id_variants.add("HOD")
    else:
        user_id_variants.add("STUDENT")
    
    return user_id_variants


# 2. IN-APP NOTIFICATION CENTER 

@router.get("")
def get_user_notifications_endpoint(
    category: Optional[str] = Query(None),
    is_read: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Returns paginated in-app notifications for the authenticated user with event deduplication."""
    user_id_variants = get_user_id_variants(current_user)

    query = db.query(NotificationRecord).filter(
        NotificationRecord.recipient_user_id.in_(list(user_id_variants))
    )

    if category and isinstance(category, str) and category.lower() != "all":
        cat_lower = category.lower().strip()
        if cat_lower == "exams":
            query = query.filter(NotificationRecord.category.in_(["exams", "exam", "marks", "result"]))
        elif cat_lower == "reports":
            query = query.filter(NotificationRecord.category.in_(["reports", "report", "files", "file"]))
        elif cat_lower == "contests":
            query = query.filter(NotificationRecord.category.in_(["contests", "contest", "achievements", "achievement"]))
        elif cat_lower == "assignments":
            query = query.filter(NotificationRecord.category.in_(["assignments", "assignment"]))
        elif cat_lower == "attendance":
            query = query.filter(NotificationRecord.category.in_(["attendance"]))
        elif cat_lower == "announcements":
            query = query.filter(or_(
                NotificationRecord.category.in_(["announcements", "announcement", "system", "account", "timetable", "leave", "meetings", "events", "placement", "app_updates"]),
                NotificationRecord.category.is_(None)
            ))
        else:
            query = query.filter(NotificationRecord.category == cat_lower)

    records = query.order_by(NotificationRecord.created_at.desc()).all()

    # Deduplicate records by event_id or (title, body) group so users never see duplicated cards
    grouped_map = {}
    for r in records:
        group_key = r.event_id if r.event_id else f"{r.title}_{r.body}"
        if group_key not in grouped_map:
            grouped_map[group_key] = []
        grouped_map[group_key].append(r)

    items = []
    for group_key, grp_records in grouped_map.items():
        # Representative record is the most recent
        r = grp_records[0]
        # Any duplicate read means the notification event is considered read for this user
        any_read = any(rec.is_read for rec in grp_records)
        
        if is_read is not None and any_read != is_read:
            continue

        items.append({
            "id": r.notification_id,
            "eventId": r.event_id,
            "type": r.event_type,
            "category": r.category,
            "title": r.title,
            "message": r.body,
            "body": r.body,
            "priority": r.priority,
            "isRead": any_read,
            "readAt": r.read_at.isoformat() if r.read_at else None,
            "actionRoute": r.route,
            "entityType": r.entity_type,
            "entityId": r.entity_id,
            "fileId": r.file_id,
            "createdBy": r.actor_user_id,
            "createdAt": r.created_at.isoformat() if r.created_at else None,
            "expiresAt": r.expires_at.isoformat() if r.expires_at else None
        })

    # Calculate exact unread count across unique notification events for this user
    all_user_records = db.query(NotificationRecord).filter(
        NotificationRecord.recipient_user_id.in_(list(user_id_variants))
    ).all()
    
    unread_event_groups = set()
    for rec in all_user_records:
        g_key = rec.event_id if rec.event_id else f"{rec.title}_{rec.body}"
        if not rec.is_read:
            # Check if any record in this group was read
            unread_event_groups.add(g_key)

    # Remove groups where at least one record is marked read
    for rec in all_user_records:
        g_key = rec.event_id if rec.event_id else f"{rec.title}_{rec.body}"
        if rec.is_read and g_key in unread_event_groups:
            unread_event_groups.remove(g_key)

    total_count = len(items)
    paginated_items = items[(page - 1) * limit : page * limit]

    return {
        "items": paginated_items,
        "total": total_count,
        "unreadCount": len(unread_event_groups),
        "page": page,
        "limit": limit
    }


@router.get("/unread-count")
def get_unread_notification_count_endpoint(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Returns exact unread notification count across unique notification events."""
    user_id_variants = get_user_id_variants(current_user)

    all_user_records = db.query(NotificationRecord).filter(
        NotificationRecord.recipient_user_id.in_(list(user_id_variants))
    ).all()

    unread_groups = set()
    for rec in all_user_records:
        g_key = rec.event_id if rec.event_id else f"{rec.title}_{rec.body}"
        if not rec.is_read:
            unread_groups.add(g_key)

    for rec in all_user_records:
        g_key = rec.event_id if rec.event_id else f"{rec.title}_{rec.body}"
        if rec.is_read and g_key in unread_groups:
            unread_groups.remove(g_key)

    return {"unreadCount": len(unread_groups)}


@router.put("/{notification_id}/read")
def mark_notification_read_endpoint(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Marks notification as read (updates all duplicate records matching event_id or notification_id for current user)."""
    user_id_variants = get_user_id_variants(current_user)

    # Locate target record to extract notification_id, event_id, title & body
    target = db.query(NotificationRecord).filter(
        or_(
            NotificationRecord.notification_id == notification_id,
            NotificationRecord.event_id == notification_id
        )
    ).first()

    now_utc = datetime.datetime.now(datetime.timezone.utc)
    updated_count = 0

    if target:
        event_id = target.event_id
        title = target.title
        body = target.body

        # Query all records matching event_id, notification_id, or title+body for user_id_variants
        records = db.query(NotificationRecord).filter(
            and_(
                NotificationRecord.recipient_user_id.in_(list(user_id_variants)),
                or_(
                    NotificationRecord.notification_id == notification_id,
                    (NotificationRecord.event_id == event_id if event_id else False),
                    and_(NotificationRecord.title == title, NotificationRecord.body == body)
                )
            )
        ).all()

        if not records:
            records = [target]

        for r in records:
            cast(Any, r).is_read = True
            cast(Any, r).read_at = now_utc
            updated_count += 1

        db.commit()

    return {"success": True, "notification_id": notification_id, "is_read": True, "marked_count": updated_count}


@router.put("/{notification_id}/unread")
def mark_notification_unread_endpoint(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Marks notification as unread for current user."""
    user_id_variants = get_user_id_variants(current_user)

    target = db.query(NotificationRecord).filter(
        or_(
            NotificationRecord.notification_id == notification_id,
            NotificationRecord.event_id == notification_id
        )
    ).first()

    updated_count = 0

    if target:
        event_id = target.event_id
        title = target.title
        body = target.body

        records = db.query(NotificationRecord).filter(
            and_(
                NotificationRecord.recipient_user_id.in_(list(user_id_variants)),
                or_(
                    NotificationRecord.notification_id == notification_id,
                    (NotificationRecord.event_id == event_id if event_id else False),
                    and_(NotificationRecord.title == title, NotificationRecord.body == body)
                )
            )
        ).all()

        if not records:
            records = [target]

        for r in records:
            cast(Any, r).is_read = False
            cast(Any, r).read_at = None
            updated_count += 1

        db.commit()

    return {"success": True, "notification_id": notification_id, "is_read": False, "marked_count": updated_count}


@router.post("/mark-all-read")
def mark_all_notifications_read_endpoint(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Marks all notifications as read for current user across all user ID variants."""
    user_id_variants = get_user_id_variants(current_user)
    now_utc = datetime.datetime.now(datetime.timezone.utc)

    records = db.query(NotificationRecord).filter(
        and_(
            NotificationRecord.recipient_user_id.in_(list(user_id_variants)),
            NotificationRecord.is_read == False
        )
    ).all()

    for r in records:
        cast(Any, r).is_read = True
        cast(Any, r).read_at = now_utc

    db.commit()
    return {"success": True, "marked_count": len(records)}


@router.delete("/{notification_id}")
def delete_notification_endpoint(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Deletes notification record and all its duplicates for current user."""
    user_id_variants = get_user_id_variants(current_user)

    target = db.query(NotificationRecord).filter(
        or_(
            NotificationRecord.notification_id == notification_id,
            NotificationRecord.event_id == notification_id
        )
    ).first()

    deleted_count = 0

    if target:
        event_id = target.event_id
        title = target.title
        body = target.body

        records = db.query(NotificationRecord).filter(
            and_(
                NotificationRecord.recipient_user_id.in_(list(user_id_variants)),
                or_(
                    NotificationRecord.notification_id == notification_id,
                    (NotificationRecord.event_id == event_id if event_id else False),
                    and_(NotificationRecord.title == title, NotificationRecord.body == body)
                )
            )
        ).all()

        if not records:
            records = [target]

        for r in records:
            db.delete(r)
            deleted_count += 1

        db.commit()

    return {"success": True, "notification_id": notification_id, "deleted_count": deleted_count}



# 3. PREFERENCES 

@router.get("/preferences")
def get_notification_preferences_endpoint(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Returns user notification preferences."""
    user_id_variants = list(get_user_id_variants(current_user))
    pref = db.query(NotificationPreference).filter(
        NotificationPreference.user_id.in_(user_id_variants)
    ).first()

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

    categories = json.loads(str(pref.categories_json)) if pref.categories_json else default_categories
    return {
        "push_enabled": pref.push_enabled,
        "email_enabled": pref.email_enabled,
        "categories": categories
    }


@router.put("/preferences")
@router.post("/preferences")
def update_notification_preferences_endpoint(
    req: PreferenceUpdateRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Updates user notification category preferences."""
    primary_id = get_primary_user_id(current_user)
    user_id_variants = list(get_user_id_variants(current_user))

    pref = db.query(NotificationPreference).filter(
        NotificationPreference.user_id.in_(user_id_variants)
    ).first()

    if not pref:
        pref = NotificationPreference(
            user_id=primary_id,
            push_enabled=req.push_enabled,
            email_enabled=req.email_enabled,
            categories_json=json.dumps(req.categories)
        )
        db.add(pref)
    else:
        cast(Any, pref).push_enabled = req.push_enabled
        cast(Any, pref).email_enabled = req.email_enabled
        cast(Any, pref).categories_json = json.dumps(req.categories)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        try:
            # Fallback: update by primary_id directly if unique constraint triggered
            pref_existing = db.query(NotificationPreference).filter_by(user_id=primary_id).first()
            if pref_existing:
                cast(Any, pref_existing).push_enabled = req.push_enabled
                cast(Any, pref_existing).email_enabled = req.email_enabled
                cast(Any, pref_existing).categories_json = json.dumps(req.categories)
                db.commit()
            else:
                raise HTTPException(status_code=500, detail=f"Database error saving notification preferences: {str(e)}")
        except HTTPException:
            raise
        except Exception as retry_err:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Database error saving notification preferences: {str(retry_err)}")

    return {"success": True, "message": "Notification preferences updated successfully"}


# 4. ADMIN ANNOUNCEMENTS & APP UPDATE BROADCASTS 

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
    title: Optional[str] = "Contest Reminder"
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
    user_id = get_primary_user_id(current_user)

    result = NotificationService.emit_event(
        event_type="CONTEST_REMINDER",
        title=req.title or "Contest Reminder",
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


@router.post("/trigger-daily-faculty-digest")
def trigger_daily_faculty_digest_endpoint(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Manually triggers the daily 10:00 AM IST Faculty Performance Analysis process."""
    user_role = str(getattr(current_user, "role", "")).upper()
    if "ADMIN" not in user_role and "FACULTY" not in user_role and "STAFF" not in user_role:
        raise HTTPException(status_code=403, detail="Faculty or Admin privileges required.")

    from backend.services.automatic_notification_engine import AutomaticNotificationEngine
    res = AutomaticNotificationEngine.run_daily_faculty_performance_job(db)
    return {"success": True, "result": res}


@router.post("/trigger-daily-hod-digest")
def trigger_daily_hod_digest_endpoint(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Manually triggers the daily 10:05 AM IST HOD Department Digest process."""
    user_role = str(getattr(current_user, "role", "")).upper()
    if "ADMIN" not in user_role and "HOD" not in user_role:
        raise HTTPException(status_code=403, detail="HOD or Admin privileges required.")

    from backend.services.automatic_notification_engine import AutomaticNotificationEngine
    res = AutomaticNotificationEngine.run_daily_hod_performance_job(db)
    return {"success": True, "result": res}


@router.post("/trigger-daily-principal-digest")
def trigger_daily_principal_digest_endpoint(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Manually triggers the daily 10:10 AM IST Principal Executive Digest process."""
    user_role = str(getattr(current_user, "role", "")).upper()
    if "ADMIN" not in user_role and "PRINCIPAL" not in user_role:
        raise HTTPException(status_code=403, detail="Principal or Admin privileges required.")

    from backend.services.automatic_notification_engine import AutomaticNotificationEngine
    res = AutomaticNotificationEngine.run_daily_principal_executive_job(db)
    return {"success": True, "result": res}


# 5. SECURE FILE ACCESS & PREVIEW / DOWNLOAD 

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
    storage_path = str(file_record.storage_path) if file_record and file_record.storage_path else ""
    filename = str(file_record.filename) if file_record and file_record.filename else ""
    access_scope = str(file_record.access_scope) if file_record and file_record.access_scope else ""

    if not file_record or not os.path.exists(storage_path):
        raise HTTPException(status_code=440, detail="File document not found or expired.")

    user_role = str(getattr(current_user, "role", "")).upper()
    if access_scope.upper() == "ADMIN_ONLY" and "ADMIN" not in user_role:
        raise HTTPException(status_code=403, detail="Access denied.")

    return FileResponse(
        path=storage_path,
        filename=filename,
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
    storage_path = str(file_record.storage_path) if file_record and file_record.storage_path else ""
    filename = str(file_record.filename) if file_record and file_record.filename else ""
    access_scope = str(file_record.access_scope) if file_record and file_record.access_scope else ""
    file_type = str(file_record.file_type) if file_record and file_record.file_type else ""

    if not file_record or not os.path.exists(storage_path):
        raise HTTPException(status_code=440, detail="File document not found or expired.")

    user_role = str(getattr(current_user, "role", "")).upper()
    if access_scope.upper() == "ADMIN_ONLY" and "ADMIN" not in user_role:
        raise HTTPException(status_code=403, detail="Access denied.")

    media_type = "application/pdf" if file_type.lower() == "pdf" else "image/png"
    return FileResponse(
        path=storage_path,
        filename=filename,
        media_type=media_type
    )
