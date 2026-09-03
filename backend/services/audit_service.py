import datetime
import random
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from backend.models import AdminAuditLog, User
from backend.logger import logger

def generate_audit_id() -> str:
    """Generates unique formatted Audit ID: AUD-YYYY-XXXXX"""
    year_str = datetime.date.today().strftime("%Y")
    rand_num = random.randint(10000, 99999)
    return f"AUD-{year_str}-{rand_num}"

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
    user_agent: Optional[str] = None
) -> AdminAuditLog:
    """
    Persists an admin activity audit log entry into AdminAuditLog table.
    Captures complete user identity (id, name, email, role).
    """
    audit_id = generate_audit_id()
    
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
    meta.setdefault("timestamp_utc", datetime.datetime.utcnow().isoformat() + "Z")

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
        created_at=datetime.datetime.utcnow()
    )

    try:
        db.add(audit_entry)
        db.commit()
        db.refresh(audit_entry)
        logger.info(f"Audit Log Recorded: [{audit_id}] {action} by {admin_name} ({admin_email})")
        return audit_entry
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to record audit log: {e}")
        return audit_entry
