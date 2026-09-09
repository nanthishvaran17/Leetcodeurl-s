import datetime
import time
import secrets
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from backend.models import AdminAuditLog, User
from backend.logger import logger

def generate_audit_id() -> str:
    """Generates unique formatted Audit ID: AUD-YYYY-XXXXXXXX with timestamp + cryptographically secure random entropy."""
    year_str = datetime.date.today().strftime("%Y")
    ts_part = hex(int(time.time() * 1000))[2:][-4:].upper()
    rand_part = secrets.token_hex(3).upper()
    return f"AUD-{year_str}-{ts_part}{rand_part}"

def log_admin_action(
    db: Session,
    action: str,
    action_type: str = "GENERAL",
    description: Optional[str] = None,
    current_user: Optional[User] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    status: str = "SUCCESS",
    metadata_json: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    event_id: Optional[str] = None
) -> AdminAuditLog:
    """
    Persists an admin activity audit log entry into AdminAuditLog table.
    Captures complete user identity (id, name, email, role).
    Guarantees unique audit_id with automated retry on rare duplicate collisions.
    """
    audit_id = generate_audit_id()
    if event_id:
        existing = db.query(AdminAuditLog).filter(AdminAuditLog.audit_id == event_id).first()
        if existing:
            return existing
        audit_id = event_id
    
    admin_id = current_user.id if current_user else None
    admin_name = current_user.username if current_user else "SYSTEM"
    admin_email = current_user.email if current_user else "system@nandhaengg.org"
    admin_role = current_user.role if current_user else "SYSTEM"

    # Deeply enrich metadata payload dictionary with complete audit telemetry
    meta = dict(metadata_json) if metadata_json else {}
    meta.setdefault("admin_id", admin_id)
    meta.setdefault("admin_name", admin_name)
    meta.setdefault("admin_email", admin_email)
    meta.setdefault("admin_role", admin_role)
    meta.setdefault("action", action)
    meta.setdefault("action_type", action_type)
    meta.setdefault("status", status)
    if target_type:
        meta.setdefault("target_type", target_type)
    if target_id:
        meta.setdefault("target_id", str(target_id))
    if ip_address:
        meta.setdefault("ip_address", ip_address)
    if user_agent:
        meta.setdefault("user_agent", user_agent)
    meta.setdefault("timestamp_utc", datetime.datetime.now(datetime.timezone.utc).isoformat())

    audit_entry = AdminAuditLog(
        audit_id=audit_id,
        admin_user_id=admin_id,
        admin_name=admin_name,
        admin_email=admin_email,
        admin_role=admin_role,
        action=action,
        action_type=action_type,
        target_type=target_type,
        target_id=target_id,
        description=description,
        ip_address=ip_address,
        user_agent=user_agent,
        status=status,
        metadata_json=meta,
        created_at=datetime.datetime.now(datetime.timezone.utc)
    )

    for attempt in range(3):
        try:
            db.add(audit_entry)
            db.commit()
            db.refresh(audit_entry)
            logger.info(f"Audit Log Recorded: [{audit_entry.audit_id}] {action} by {admin_name} ({admin_email})")
            return audit_entry
        except Exception as e:
            db.rollback()
            if attempt < 2 and ("unique" in str(e).lower() or "duplicate" in str(e).lower()):
                audit_entry.audit_id = generate_audit_id()
                continue
            logger.error(f"Failed to record audit log: {e}")
            return audit_entry

    return audit_entry

