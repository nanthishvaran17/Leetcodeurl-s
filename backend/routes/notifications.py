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
    User, Student, WeeklySession, FacultyStudentAssignment, NotificationRecord, NotificationPreference, NotificationFile
)
from backend.routes.auth import get_current_user as get_current_active_user
from backend.services.notification_service import NotificationService
from backend.time_utils import IST

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
            "isArchived": any(rec.is_archived for rec in grp_records),
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
@router.post("/{notification_id}/read")
def mark_notification_read_endpoint(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Marks notification as read (updates all duplicate records matching event_id or notification_id for current user)."""
    user_id_variants = get_user_id_variants(current_user)
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    updated_count = 0

    # Handle special case 'all' or 'mark-all'
    if notification_id.lower() in ['all', 'mark-all', 'mark-all-read', 'read-all']:
        records = db.query(NotificationRecord).filter(
            and_(
                NotificationRecord.recipient_user_id.in_(list(user_id_variants)),
                or_(
                    NotificationRecord.is_read == False,
                    NotificationRecord.is_read == None,
                    NotificationRecord.is_read.is_(None)
                )
            )
        ).all()
        for r in records:
            cast(Any, r).is_read = True
            cast(Any, r).read_at = now_utc
            updated_count += 1
        db.commit()
        return {"success": True, "marked_count": updated_count}

    # Locate target record to extract notification_id, event_id, title & body
    target = db.query(NotificationRecord).filter(
        or_(
            NotificationRecord.notification_id == notification_id,
            NotificationRecord.event_id == notification_id
        )
    ).first()

    if target:
        event_id = target.event_id
        title = target.title
        body = target.body

        or_clauses = [NotificationRecord.notification_id == notification_id]
        if event_id:
            or_clauses.append(NotificationRecord.event_id == event_id)
        or_clauses.append(and_(NotificationRecord.title == title, NotificationRecord.body == body))

        records = db.query(NotificationRecord).filter(
            and_(
                NotificationRecord.recipient_user_id.in_(list(user_id_variants)),
                or_(*or_clauses)
            )
        ).all()

        if not records:
            records = [target]

        for r in records:
            cast(Any, r).is_read = True
            cast(Any, r).read_at = now_utc
            updated_count += 1

        db.commit()
    else:
        # Fallback: update any unread records for current user variants
        records = db.query(NotificationRecord).filter(
            and_(
                NotificationRecord.recipient_user_id.in_(list(user_id_variants)),
                or_(
                    NotificationRecord.notification_id == notification_id,
                    NotificationRecord.event_id == notification_id
                )
            )
        ).all()
        for r in records:
            cast(Any, r).is_read = True
            cast(Any, r).read_at = now_utc
            updated_count += 1
        db.commit()

    return {"success": True, "notification_id": notification_id, "is_read": True, "marked_count": updated_count}


@router.put("/{notification_id}/unread")
@router.post("/{notification_id}/unread")
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

        or_clauses = [NotificationRecord.notification_id == notification_id]
        if event_id:
            or_clauses.append(NotificationRecord.event_id == event_id)
        or_clauses.append(and_(NotificationRecord.title == title, NotificationRecord.body == body))

        records = db.query(NotificationRecord).filter(
            and_(
                NotificationRecord.recipient_user_id.in_(list(user_id_variants)),
                or_(*or_clauses)
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
@router.put("/mark-all-read")
@router.post("/mark-all-as-read")
@router.put("/mark-all-as-read")
@router.post("/read-all")
@router.put("/read-all")
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
            or_(
                NotificationRecord.is_read == False,
                NotificationRecord.is_read == None,
                NotificationRecord.is_read.is_(None)
            )
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

        or_clauses = [NotificationRecord.notification_id == notification_id]
        if event_id:
            or_clauses.append(NotificationRecord.event_id == event_id)
        or_clauses.append(and_(NotificationRecord.title == title, NotificationRecord.body == body))

        records = db.query(NotificationRecord).filter(
            and_(
                NotificationRecord.recipient_user_id.in_(list(user_id_variants)),
                or_(*or_clauses)
            )
        ).all()

        if not records:
            records = [target]

        for r in records:
            db.delete(r)
            deleted_count += 1

        db.commit()

    return {"success": True, "notification_id": notification_id, "deleted_count": deleted_count}


@router.put("/{notification_id}/archive")
def archive_notification_endpoint(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Marks a notification and its duplicates as archived for the current user."""
    user_id_variants = get_user_id_variants(current_user)

    target = db.query(NotificationRecord).filter(
        or_(
            NotificationRecord.notification_id == notification_id,
            NotificationRecord.event_id == notification_id
        )
    ).first()

    archived_count = 0

    if target:
        event_id = target.event_id
        title = target.title
        body = target.body

        or_clauses = [NotificationRecord.notification_id == notification_id]
        if event_id:
            or_clauses.append(NotificationRecord.event_id == event_id)
        or_clauses.append(and_(NotificationRecord.title == title, NotificationRecord.body == body))

        records = db.query(NotificationRecord).filter(
            and_(
                NotificationRecord.recipient_user_id.in_(list(user_id_variants)),
                or_(*or_clauses)
            )
        ).all()

        if not records:
            records = [target]

        for r in records:
            cast(Any, r).is_archived = True
            archived_count += 1

        db.commit()

    return {"success": True, "notification_id": notification_id, "archived_count": archived_count}



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


class SimulateSingleDaySurgeRequest(BaseModel):
    student_id: Optional[int] = None
    student_name: Optional[str] = "Raj"
    reg_no: Optional[str] = "732224CS101"
    solved_today: int = 100
    total_solved: int = 250


@router.post("/simulate-single-day-surge")
def simulate_single_day_surge_endpoint(
    req: SimulateSingleDaySurgeRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """
    Simulates / triggers the high single-day milestone notification (e.g., student solving 100 on the same day).
    Emits personalized 'Dear Sir/Ma'am' alerts to mentors, staff, and the student.
    """
    from backend.services.automatic_notification_engine import AutomaticNotificationEngine
    target_student = None
    if req.student_id:
        target_student = db.query(Student).filter_by(id=req.student_id).first()
    if not target_student and req.reg_no:
        target_student = db.query(Student).filter(Student.reg_no.ilike(req.reg_no)).first()
    if not target_student:
        target_student = db.query(Student).filter(Student.is_active == True).first()

    student_id = target_student.id if target_student else 1
    # Use existing or override name
    if target_student and req.student_name != "Raj":
        s_name = target_student.name
        s_reg = target_student.reg_no
    else:
        s_name = req.student_name or "Raj"
        s_reg = req.reg_no or "732224CS101"

    now_ist = datetime.datetime.now(tz=IST)
    today_ist_str = now_ist.strftime("%d-%b-%Y")
    time_ist_str = now_ist.strftime("%I:%M %p IST")
    dept_name = target_student.department.name if target_student and target_student.department else "Computer Science and Engineering"

    staff_title = f"100 Solved in a Single Day: {s_name} ({s_reg})"
    staff_body = (
        f"Dear Faculty & Staff,\n\n"
        f"Your student / mentee {s_name} (Roll No: {s_reg}) has achieved a remarkable milestone "
        f"of solving {req.solved_today} LeetCode problems on the same day today ({today_ist_str})!\n\n"
        f"Student Details:\n"
        f"• Student Name: {s_name}\n"
        f"• Roll Number: {s_reg}\n"
        f"• Department: {dept_name}\n"
        f"• Problems Solved Today: {req.solved_today}\n"
        f"• Cumulative Total Solved: {req.total_solved}\n"
        f"• Recorded At: {time_ist_str}\n\n"
        f"This unique dedication demonstrates top problem-solving performance. "
        f"Please appreciate and mentor them to maintain this exceptional momentum!"
    )

    idempotency_key = f"manual_sim_single_day_{student_id}_{int(now_ist.timestamp())}"

    # Emit to staff role
    res_staff = NotificationService.emit_event(
        event_type="STUDENT_DAILY_SURGE_MILESTONE",
        title=staff_title,
        body=staff_body,
        priority="high",
        recipient_scope="ROLE",
        recipient_target="STAFF",
        entity_type="student",
        entity_id=str(student_id),
        route=f"/student/{student_id}",
        event_id=f"{idempotency_key}_staff"
    )

    # Emit to current logged-in user so they instantly see it
    current_uid = get_primary_user_id(current_user)
    res_user = NotificationService.emit_event(
        event_type="STUDENT_DAILY_SURGE_MILESTONE",
        title=staff_title,
        body=staff_body,
        priority="high",
        recipient_scope="USER",
        recipient_target=current_uid,
        entity_type="student",
        entity_id=str(student_id),
        route=f"/student/{student_id}",
        event_id=f"{idempotency_key}_caller"
    )

    return {
        "success": True,
        "message": f"Single-day surge notification for {s_name} ({req.solved_today} solved) dispatched successfully!",
        "staff_result": res_staff,
        "user_result": res_user
    }


class SimulateFetchSurgeRequest(BaseModel):
    student_id: Optional[int] = None
    student_name: Optional[str] = "Sanjay"
    reg_no: Optional[str] = "732224IT055"
    previous_solved: int = 150
    current_solved: int = 201
    delta_easy: int = 25
    delta_medium: int = 20
    delta_hard: int = 6


@router.post("/simulate-fetch-surge")
def simulate_fetch_surge_endpoint(
    req: SimulateFetchSurgeRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """
    Simulates / triggers the high problem surge alert when a student's total solved jumps >= 50 between fetch cycles.
    Example: Sanjay had 150 at last fetch, now 201 (+51 delta).
    """
    target_student = None
    if req.student_id:
        target_student = db.query(Student).filter_by(id=req.student_id).first()
    if not target_student and req.reg_no:
        target_student = db.query(Student).filter(Student.reg_no.ilike(req.reg_no)).first()
    if not target_student:
        target_student = db.query(Student).filter(Student.is_active == True).first()

    student_id = target_student.id if target_student else 1
    s_name = req.student_name or (target_student.name if target_student else "Sanjay")
    s_reg = req.reg_no or (target_student.reg_no if target_student else "732224IT055")
    dept_name = target_student.department.name if target_student and target_student.department else "Information Technology"

    delta = max(0, req.current_solved - req.previous_solved)
    now_ist = datetime.datetime.now(tz=IST)
    curr_time_str = now_ist.strftime("%d-%b-%Y %I:%M %p IST")
    prev_time = now_ist - datetime.timedelta(hours=6)
    prev_time_str = prev_time.strftime("%d-%b-%Y %I:%M %p IST")

    title = f"High Problem Surge Alert: {s_name} (+{delta} Solved)"
    body = (
        f"Dear Faculty & Staff,\n\n"
        f"Significant problem-solving growth detected for {s_name} ({s_reg}) between sync cycles!\n\n"
        f"• Student Name: {s_name}\n"
        f"• Roll Number: {s_reg}\n"
        f"• Department: {dept_name}\n"
        f"• Previous Solved: {req.previous_solved} (Recorded: {prev_time_str})\n"
        f"• Current Solved: {req.current_solved} (Recorded: {curr_time_str})\n"
        f"• Net Delta Increase: +{delta} problems solved\n"
        f"  [Breakdown: Easy +{req.delta_easy} | Medium +{req.delta_medium} | Hard +{req.delta_hard}]\n\n"
        f"Sync Interval: From {prev_time_str} to {curr_time_str}\n\n"
        f"This substantial surge has been verified and synchronized to the live database."
    )

    idempotency_key = f"manual_sim_fetch_surge_{student_id}_{int(now_ist.timestamp())}"

    res_staff = NotificationService.emit_event(
        event_type="STUDENT_FETCH_SURGE_DELTA",
        title=title,
        body=body,
        priority="high",
        recipient_scope="ROLE",
        recipient_target="STAFF",
        entity_type="student",
        entity_id=str(student_id),
        route=f"/student/{student_id}",
        event_id=f"{idempotency_key}_staff"
    )

    current_uid = get_primary_user_id(current_user)
    res_user = NotificationService.emit_event(
        event_type="STUDENT_FETCH_SURGE_DELTA",
        title=title,
        body=body,
        priority="high",
        recipient_scope="USER",
        recipient_target=current_uid,
        entity_type="student",
        entity_id=str(student_id),
        route=f"/student/{student_id}",
        event_id=f"{idempotency_key}_caller"
    )

    return {
        "success": True,
        "message": f"Fetch surge alert for {s_name} (+{delta} solved) dispatched successfully!",
        "staff_result": res_staff,
        "user_result": res_user
    }


class SimulateContestSyncRequest(BaseModel):
    session_id: Optional[int] = None
    contest_name: Optional[str] = "Weekly Contest 438"


@router.post("/simulate-contest-sync-broadcast")
def simulate_contest_sync_broadcast_endpoint(
    req: SimulateContestSyncRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """
    Simulates / triggers the 'Contest Results Published & Web/App Synced' notification to staff and mentors.
    """
    from backend.services.automatic_notification_engine import AutomaticNotificationEngine
    res = AutomaticNotificationEngine.emit_contest_finalized_sync_broadcast(db, req.session_id)
    
    # Also emit directly to current user
    session = db.query(WeeklySession).filter_by(id=req.session_id).first() if req.session_id else db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()
    contest_name = (session.contest_name if session else None) or req.contest_name or "Weekly Contest"
    current_uid = get_primary_user_id(current_user)

    now_ts = int(datetime.datetime.now(datetime.timezone.utc).timestamp())
    NotificationService.emit_event(
        event_type="CONTEST_RESULTS_SYNCED",
        title=f"Contest Results Published & Web/App Synced — {contest_name}",
        body=(
            f"Dear Faculty & Staff,\n\n"
            f"Official results and attendance datasets for {contest_name} have been finalized and published!\n\n"
            f"• All leaderboards, ratings, streaks, and attendance records are fully synchronized!\n"
            f"• Web Portal & Mobile App: Data is live and up-to-date.\n\n"
            f"Tap to view the updated leaderboards and download the finalized contest report."
        ),
        priority="high",
        recipient_scope="USER",
        recipient_target=current_uid,
        route="/weekly-contest",
        event_id=f"sim_contest_synced_user_{now_ts}"
    )

    return {
        "success": True,
        "message": f"Contest results & web/app sync broadcast for {contest_name} dispatched!",
        "details": res
    }


@router.post("/simulate-contest-attendance")
def simulate_contest_attendance_endpoint(
    req: SimulateContestSyncRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """
    Simulates / triggers the Sunday contest attendance & absentee list report for staff and mentors.
    """
    from backend.services.automatic_notification_engine import AutomaticNotificationEngine
    res = AutomaticNotificationEngine.emit_sunday_contest_role_summaries(db, req.session_id)

    session = db.query(WeeklySession).filter_by(id=req.session_id).first() if req.session_id else db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()
    contest_name = (session.contest_name if session else None) or req.contest_name or "Weekly Contest"
    current_uid = get_primary_user_id(current_user)
    now_ts = int(datetime.datetime.now(datetime.timezone.utc).timestamp())

    # Emit attendance overview to current user
    NotificationService.emit_event(
        event_type="SUNDAY_CONTEST_ATTENDANCE_REPORT",
        title=f"Sunday Contest Attendance & Absentee Report — {contest_name}",
        body=(
            f"Dear Faculty & Staff,\n\n"
            f"Sunday Contest Attendance Report for {contest_name} has been published!\n\n"
            f"• Attended Students List: Verified and updated on the leaderboard.\n"
            f"• Absent Students (Not Attended): Flagged for mentor follow-up.\n"
            f"• All attendance records and penalty scores are synchronized with the mobile app.\n\n"
            f"Tap to view the complete attendance roster and student records."
        ),
        priority="high",
        recipient_scope="USER",
        recipient_target=current_uid,
        route="/weekly-contest",
        event_id=f"sim_contest_attendance_user_{now_ts}"
    )

    return {
        "success": True,
        "message": f"Sunday contest attendance notification dispatched!",
        "details": res
    }


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
