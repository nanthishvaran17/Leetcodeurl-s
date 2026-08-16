import datetime
import hashlib
import uuid
import re
from typing import Optional, List, Dict
from fastapi import Request, Depends, HTTPException, status
from sqlalchemy.orm import Session
import jwt

from backend.database import get_db
from backend.config import settings
from backend.models import User, AdminAuditLog
from backend.logger import logger

# In-memory sliding window tracking for Security Alert emails
# Key: source_identifier -> List of failure timestamps
BLOCKED_ATTEMPTS: Dict[str, List[datetime.datetime]] = {}
ALERT_COOLDOWN: Dict[str, datetime.datetime] = {}

# Constants
WINDOW_MINUTES = 10
THRESHOLD_ATTEMPTS = 5
COOLDOWN_MINUTES = 15

def get_hashed_ip(request: Request) -> str:
    """Generates an anonymized/hashed IP address for audit and tracking."""
    client_host = request.client.host if request.client else "127.0.0.1"
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client_host = forwarded.split(",")[0].strip()
    
    salt = settings.SECRET_KEY[:8]
    hashed = hashlib.sha256(f"{client_host}_{salt}".encode('utf-8')).hexdigest()[:16]
    return f"ip_{hashed}"

def categorize_user_agent(user_agent_str: Optional[str]) -> str:
    """Categorizes User-Agent string cleanly into a category."""
    if not user_agent_str:
        return "API Client"
    ua = user_agent_str.lower()
    if "firefox" in ua:
        return "Firefox Browser"
    elif "edg" in ua:
        return "Edge Browser"
    elif "chrome" in ua or "crios" in ua:
        return "Chrome Browser"
    elif "safari" in ua and "chrome" not in ua:
        return "Safari Browser"
    elif "postman" in ua or "curl" in ua or "python" in ua or "axios" in ua:
        return "Automated API / Tool"
    elif "mobile" in ua or "android" in ua or "iphone" in ua:
        return "Mobile Browser"
    return "Web Browser"

def evaluate_security_alert_threshold(
    db: Session,
    source_id: str,
    username_or_role: str,
    requested_resource: str,
    contest_info: Optional[str],
    reason: str
):
    """
    Evaluates blocked attempts for source_id within a 10-minute sliding window.
    If >= 5 blocked attempts occur, triggers a single security alert notification email
    and logs an AdminAuditLog SECURITY_ALERT entry.
    """
    now = datetime.datetime.utcnow()
    cutoff = now - datetime.timedelta(minutes=WINDOW_MINUTES)
    
    if source_id not in BLOCKED_ATTEMPTS:
        BLOCKED_ATTEMPTS[source_id] = []
    
    BLOCKED_ATTEMPTS[source_id] = [
        ts for ts in BLOCKED_ATTEMPTS[source_id] if ts > cutoff
    ]
    BLOCKED_ATTEMPTS[source_id].append(now)
    
    attempt_count = len(BLOCKED_ATTEMPTS[source_id])
    
    last_alert = ALERT_COOLDOWN.get(source_id)
    if last_alert and (now - last_alert) < datetime.timedelta(minutes=COOLDOWN_MINUTES):
        return
    
    if attempt_count >= THRESHOLD_ATTEMPTS:
        ALERT_COOLDOWN[source_id] = now
        
        time_str = datetime.datetime.now().strftime("%d-%m-%Y %H:%M IST")
        subject = "[SECURITY ALERT] Unauthorized Tracker Access Attempt"
        
        alert_details = (
            f"SECURITY ALERT: {attempt_count} blocked protected-resource attempts detected.\n"
            f"Time: {time_str}\n"
            f"Source: {source_id}\n"
            f"User/Role: {username_or_role}\n"
            f"Resource: {requested_resource}\n"
            f"Contest: {contest_info or 'N/A'}\n"
            f"Attempts: {attempt_count} blocked attempts in {WINDOW_MINUTES} minutes\n"
            f"Reason: {reason}\n"
            f"Action: Request blocked"
        )
        
        logger.warning(alert_details)
        
        try:
            alert_audit = AdminAuditLog(
                audit_id=f"ALT-{uuid.uuid4().hex[:8].upper()}",
                admin_user_id=None,
                admin_name=username_or_role,
                admin_email=None,
                admin_role="SECURITY_SYSTEM",
                action="SECURITY_ALERT",
                action_type="SECURITY",
                target_type="Resource",
                target_id=requested_resource,
                description=alert_details,
                ip_address=source_id,
                user_agent="SecurityAlertEngine",
                status="ALERT",
                metadata_json={
                    "attempts": attempt_count,
                    "window_minutes": WINDOW_MINUTES,
                    "reason": reason,
                    "contest": contest_info,
                    "source": source_id
                }
            )
            db.add(alert_audit)
            db.commit()
        except Exception as ex:
            db.rollback()
            logger.error(f"Failed to record security alert audit: {ex}")
            
        try:
            from backend.services.email_service import send_email
            admin_email = getattr(settings, "ALERT_EMAIL_RECIPIENT", "admin@nandha.edu.in")
            email_body_html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e1e8ed; border-radius: 8px;">
                <h2 style="color: #dc2626; margin-top: 0;">🔒 Security Alert: Unauthorized Access Threshold Exceeded</h2>
                <p>The institutional LeetCode Tracker access-control layer detected repeated unauthorized access attempts.</p>
                <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                    <tr style="background: #f8fafc;"><td style="padding: 8px; font-weight: bold; width: 140px;">Timestamp:</td><td style="padding: 8px;">{time_str}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">Source Hash:</td><td style="padding: 8px;"><code>{source_id}</code></td></tr>
                    <tr style="background: #f8fafc;"><td style="padding: 8px; font-weight: bold;">User / Account:</td><td style="padding: 8px;">{username_or_role}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">Requested Resource:</td><td style="padding: 8px;">{requested_resource}</td></tr>
                    <tr style="background: #f8fafc;"><td style="padding: 8px; font-weight: bold;">Contest Session:</td><td style="padding: 8px;">{contest_info or 'N/A'}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">Blocked Attempts:</td><td style="padding: 8px; font-weight: bold; color: #dc2626;">{attempt_count} attempts in {WINDOW_MINUTES} min</td></tr>
                    <tr style="background: #f8fafc;"><td style="padding: 8px; font-weight: bold;">Denial Reason:</td><td style="padding: 8px;">{reason}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">Action Taken:</td><td style="padding: 8px; color: #16a34a; font-weight: bold;">All Requests Blocked (Fail-Closed)</td></tr>
                </table>
                <p style="font-size: 12px; color: #64748b; margin-top: 20px;">This is an automated institutional security notification. No credentials, tokens, or student data were exposed.</p>
            </div>
            """
            send_email(admin_email, subject, email_body_html)
        except Exception as email_err:
            logger.warning(f"Security Alert email dispatch notice: {email_err}")

import time
import threading

_RECENT_ACCESS_LOGS: Dict[tuple, float] = {}
_RECENT_ACCESS_LOCK = threading.Lock()

def log_security_access_event(
    db: Session,
    request: Request,
    user: Optional[User],
    action: str,
    resource: str,
    result: str,
    denial_reason: Optional[str] = None,
    session_id: Optional[str] = None,
    debounce_seconds: float = 2.0
):
    """
    Persists a lightweight security access log into AdminAuditLog without
    logging any credentials, tokens, or sensitive student payload data.
    Deduplicates identical (admin, action, resource, result) events within debounce window
    to eliminate duplicate audit logs caused by React StrictMode or concurrent page mounts.
    """
    username = user.username if user else "UNKNOWN"
    user_id = user.id if user else None
    user_email = user.email if user else None
    user_role = user.role if user else "UNKNOWN"

    # 1. In-memory debounce check
    dedup_key = (username, action, resource, result)
    now_ts = time.time()
    with _RECENT_ACCESS_LOCK:
        last_ts = _RECENT_ACCESS_LOGS.get(dedup_key, 0.0)
        if now_ts - last_ts < debounce_seconds:
            return
        _RECENT_ACCESS_LOGS[dedup_key] = now_ts

        # Housekeeping: prune old entries if map grows
        if len(_RECENT_ACCESS_LOGS) > 500:
            threshold = now_ts - 60.0
            expired = [k for k, v in _RECENT_ACCESS_LOGS.items() if v < threshold]
            for k in expired:
                _RECENT_ACCESS_LOGS.pop(k, None)

    # 2. Database safety-net debounce check (within last debounce_seconds)
    try:
        cutoff = datetime.datetime.utcnow() - datetime.timedelta(seconds=debounce_seconds)
        existing = db.query(AdminAuditLog.id).filter(
            AdminAuditLog.admin_name == username,
            AdminAuditLog.action == action,
            AdminAuditLog.target_id == resource,
            AdminAuditLog.status == result,
            AdminAuditLog.created_at >= cutoff
        ).first()
        if existing:
            return
    except Exception:
        pass

    hashed_ip = get_hashed_ip(request)
    ua_category = categorize_user_agent(request.headers.get("User-Agent"))
    correlation_id = f"req_{uuid.uuid4().hex[:12]}"
    
    desc = f"{action} on {resource} -> {result}"
    if denial_reason:
        desc += f" ({denial_reason})"
        
    try:
        audit_entry = AdminAuditLog(
            audit_id=f"SEC-{uuid.uuid4().hex[:8].upper()}",
            admin_user_id=user_id,
            admin_name=username,
            admin_email=user_email,
            admin_role=user_role,
            action=action,
            action_type="SECURITY_ACCESS",
            target_type="Resource",
            target_id=resource,
            description=desc,
            ip_address=hashed_ip,
            user_agent=ua_category,
            status=result,
            metadata_json={
                "route": request.url.path,
                "resource": resource,
                "session_id": session_id,
                "denial_reason": denial_reason,
                "correlation_id": correlation_id,
                "user_agent_category": ua_category
            }
        )
        db.add(audit_entry)
        db.commit()
    except Exception as ex:
        db.rollback()
        logger.error(f"Failed to record security audit log: {ex}")

def extract_current_user_optional(request: Request, db: Session) -> Optional[User]:
    """Extracts authenticated user from HttpOnly Cookie or Bearer token if present."""
    from backend.routes.auth import get_current_user_from_request
    return get_current_user_from_request(request, db)


def require_security_access(
    required_roles: Optional[List[str]] = None,
    resource_name: Optional[str] = None,
    dept_scoped: bool = False
):
    """
    FastAPI Dependency Factory that enforces server-side authentication & role authorization
    BEFORE executing database queries or endpoints.
    
    Fail closed: Does not trust any frontend role claim.
    """
    async def dependency(request: Request, db: Session = Depends(get_db)) -> User:
        nonlocal resource_name
        target_resource = resource_name or request.url.path
            
        hashed_ip = get_hashed_ip(request)
        user = extract_current_user_optional(request, db)
        
        session_id = request.path_params.get("session_id") or request.query_params.get("session_id")
        contest_info = f"Session {session_id}" if session_id else None

        # 1. AUTHENTICATION CHECK
        if not user:
            log_security_access_event(
                db, request, None, action="ACCESS_RESOURCE",
                resource=target_resource, result="BLOCKED",
                denial_reason="NOT_AUTHENTICATED", session_id=session_id
            )
            evaluate_security_alert_threshold(
                db, hashed_ip, "UNKNOWN", target_resource, contest_info, "NOT_AUTHENTICATED"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required to access this institutional resource.",
                headers={"WWW-Authenticate": "Bearer"}
            )

        user_role_clean = (user.role or "").strip().lower()
        
        # 2. ROLE & PERMISSION CHECK
        if user_role_clean in ["admin", "super admin", "super_admin"]:
            log_security_access_event(
                db, request, user, action="ACCESS_RESOURCE",
                resource=target_resource, result="SUCCESS", session_id=session_id
            )
            return user

        allowed_roles_norm = [r.lower() for r in (required_roles or ["admin", "super admin", "hod", "faculty", "staff"])]
        
        if user_role_clean == "student" and "student" not in allowed_roles_norm:
            log_security_access_event(
                db, request, user, action="ACCESS_RESOURCE",
                resource=target_resource, result="BLOCKED",
                denial_reason="ROLE_NOT_ALLOWED", session_id=session_id
            )
            evaluate_security_alert_threshold(
                db, hashed_ip, f"User {user.username} ({user.role})", target_resource, contest_info, "ROLE_NOT_ALLOWED"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access restricted: Your account role does not have authorization for this resource."
            )

        if allowed_roles_norm and user_role_clean not in allowed_roles_norm:
            log_security_access_event(
                db, request, user, action="ACCESS_RESOURCE",
                resource=target_resource, result="BLOCKED",
                denial_reason="ROLE_NOT_ALLOWED", session_id=session_id
            )
            evaluate_security_alert_threshold(
                db, hashed_ip, f"User {user.username} ({user.role})", target_resource, contest_info, "ROLE_NOT_ALLOWED"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access restricted: Insufficient role permissions."
            )

        # 3. DEPARTMENT SCOPE CHECK FOR PROFESSOR / HOD / FACULTY
        if dept_scoped and user_role_clean in ["hod", "faculty", "staff", "professor"]:
            req_dept = request.query_params.get("dept") or request.query_params.get("department")
            if req_dept and user.department_id:
                user_dept_code = user.department.code if user.department else None
                if user_dept_code and req_dept.upper() != user_dept_code.upper() and req_dept.upper() != "ALL":
                    log_security_access_event(
                        db, request, user, action="ACCESS_RESOURCE",
                        resource=target_resource, result="BLOCKED",
                        denial_reason="DEPT_OUT_OF_SCOPE", session_id=session_id
                    )
                    evaluate_security_alert_threshold(
                        db, hashed_ip, f"User {user.username} ({user.role})", target_resource, contest_info, "DEPT_OUT_OF_SCOPE"
                    )
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access restricted: You are only authorized to access data within your assigned department."
                    )

        log_security_access_event(
            db, request, user, action="ACCESS_RESOURCE",
            resource=target_resource, result="SUCCESS", session_id=session_id
        )
        return user

    return dependency

def get_current_user_optional(request: Request, db: Session = Depends(get_db)) -> Optional[User]:
    """Safely resolves current authenticated user from HttpOnly cookie or Bearer header."""
    from backend.routes.auth import get_current_user_from_request
    return get_current_user_from_request(request, db)

