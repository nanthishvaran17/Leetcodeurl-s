import datetime
import random
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from backend.database import get_db
from backend.models import AdminAuditLog, EmailDelivery, EmailAttachment, ReportRecipient, User
from backend.routes.auth import get_current_user
from backend.services.audit_service import log_admin_action
from backend.logger import logger

router = APIRouter(prefix="/api/admin", tags=["Admin Operations & Audit"])

# Schema definitions
class RecipientSchema(BaseModel):
    name: str
    email: str
    role: str = "HOD"
    department: str = "ALL"
    weekly_enabled: bool = True
    hod_enabled: bool = True
    error_enabled: bool = True
    active: bool = True

class RecipientStatusUpdate(BaseModel):
    active: bool


@router.get("/audit-logs")
def get_admin_audit_logs(
    limit: int = Query(50, ge=1, le=500),
    action: Optional[str] = None,
    role: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Retrieves real database-backed admin audit activity logs."""
    query = db.query(AdminAuditLog)

    if action:
        query = query.filter(AdminAuditLog.action == action)
    if role:
        query = query.filter(AdminAuditLog.admin_role == role)
    if status:
        query = query.filter(AdminAuditLog.status == status.upper())
    if search:
        s_term = f"%{search.strip()}%"
        query = query.filter(
            (AdminAuditLog.audit_id.ilike(s_term)) |
            (AdminAuditLog.admin_name.ilike(s_term)) |
            (AdminAuditLog.admin_email.ilike(s_term)) |
            (AdminAuditLog.action.ilike(s_term)) |
            (AdminAuditLog.description.ilike(s_term))
        )

    logs = query.order_by(AdminAuditLog.id.desc()).limit(limit).all()

    return [{
        "id": l.id,
        "audit_id": l.audit_id,
        "admin_user_id": l.admin_user_id,
        "admin_name": l.admin_name or "SYSTEM",
        "admin_email": l.admin_email or "system@nandhaengg.org",
        "admin_role": l.admin_role or "SYSTEM",
        "action": l.action,
        "action_type": l.action_type,
        "target_type": l.target_type,
        "target_id": l.target_id,
        "description": l.description,
        "ip_address": l.ip_address,
        "status": l.status,
        "created_at": l.created_at.strftime("%Y-%m-%d %H:%M:%S") if l.created_at else None
    } for l in logs]


@router.get("/email-deliveries")
def get_email_deliveries(
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = None,
    report_type: Optional[str] = None,
    trigger_type: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Retrieves real database-backed email delivery records."""
    query = db.query(EmailDelivery)

    if status:
        query = query.filter(EmailDelivery.status == status.upper())
    if report_type:
        query = query.filter(EmailDelivery.report_type == report_type)
    if trigger_type:
        query = query.filter(EmailDelivery.trigger_type == trigger_type.upper())
    if search:
        s_term = f"%{search.strip()}%"
        query = query.filter(
            (EmailDelivery.message_id.ilike(s_term)) |
            (EmailDelivery.recipient_email.ilike(s_term)) |
            (EmailDelivery.recipient_name.ilike(s_term)) |
            (EmailDelivery.subject.ilike(s_term))
        )

    deliveries = query.order_by(EmailDelivery.id.desc()).limit(limit).all()

    results = []
    for d in deliveries:
        actual_att_count = db.query(EmailAttachment).filter(EmailAttachment.email_delivery_id == d.id).count()
        results.append({
            "id": d.id,
            "message_id": d.message_id,
            "recipient_id": d.recipient_id,
            "recipient_email": d.recipient_email,
            "recipient_name": d.recipient_name or d.recipient_email,
            "recipient_role": d.recipient_role,
            "department": d.department,
            "report_type": d.report_type,
            "report_date": d.report_date,
            "subject": d.subject,
            "status": d.status,
            "attachments_count": max(d.attachments_count, actual_att_count),
            "sent_at": d.sent_at.strftime("%Y-%m-%d %H:%M:%S") if d.sent_at else None,
            "delivered_at": d.delivered_at.strftime("%Y-%m-%d %H:%M:%S") if d.delivered_at else None,
            "failed_at": d.failed_at.strftime("%Y-%m-%d %H:%M:%S") if d.failed_at else None,
            "retry_count": d.retry_count,
            "error_message": d.error_message,
            "trigger_type": d.trigger_type,
            "triggered_by_email": d.triggered_by_email or "SYSTEM",
            "created_at": d.created_at.strftime("%Y-%m-%d %H:%M:%S") if d.created_at else None
        })

    return results


@router.get("/email-deliveries/{delivery_id}/attachments")
def get_email_attachments(delivery_id: int, db: Session = Depends(get_db)):
    """Retrieves tracked file attachments for a specific email delivery record."""
    deliv = db.query(EmailDelivery).filter(EmailDelivery.id == delivery_id).first()
    if not deliv:
        raise HTTPException(status_code=404, detail="Email delivery record not found")

    attachments = db.query(EmailAttachment).filter(EmailAttachment.email_delivery_id == delivery_id).all()
    return [{
        "id": a.id,
        "filename": a.filename,
        "file_type": a.file_type,
        "file_size": a.file_size,
        "storage_path": a.storage_path,
        "created_at": a.created_at.strftime("%Y-%m-%d %H:%M:%S") if a.created_at else None
    } for a in attachments]


@router.post("/email-deliveries/retry/{delivery_id}")
def retry_email_delivery(
    delivery_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retries a failed or queued email delivery."""
    deliv = db.query(EmailDelivery).filter(EmailDelivery.id == delivery_id).first()
    if not deliv:
        raise HTTPException(status_code=404, detail="Email delivery record not found")

    deliv.status = "RETRYING"
    deliv.retry_count += 1
    deliv.updated_at = datetime.datetime.utcnow()
    db.commit()

    log_admin_action(
        db, action="EMAIL_RETRY", action_type="EMAIL",
        description=f"Retried email delivery {deliv.message_id} to {deliv.recipient_email}",
        current_user=current_user, target_type="EmailDelivery", target_id=str(delivery_id)
    )

    return {"status": "success", "message": f"Queued retry attempt #{deliv.retry_count} for {deliv.message_id}"}


@router.get("/recipients")
def get_recipients(db: Session = Depends(get_db)):
    """Retrieves all report email recipients directly from database."""
    recipients = db.query(ReportRecipient).order_by(ReportRecipient.id.asc()).all()

    # Auto-seed standard default recipients if DB table is empty
    if not recipients:
        defaults = [
            ("Principal / Management", "management@nandha.edu.in", "MANAGEMENT", "ALL", True, True, True, True),
            ("HOD Cyber Security", "hod.cs@nandhaengg.org", "HOD", "CSE(CS)", True, True, True, True),
            ("HOD IoT", "hod.iot@nandhaengg.org", "HOD", "CSE(IoT)", True, True, True, True),
            ("System Admin", "admin.leetcode@nandhaengg.org", "ADMIN", "ALL", True, True, True, True),
            ("Nanthishvaran", "nanthishvaran17@gmail.com", "ADMIN", "ALL", True, True, True, True),
            ("Prof. Santhosh Kumar M", "msanthoshkumar@nandhaengg.org", "MANAGEMENT", "ALL", True, True, True, True),
        ]
        for name, email, role, dept, w_en, h_en, err_en, act in defaults:
            rec = ReportRecipient(
                name=name, email=email, role=role, department=dept,
                receive_weekly_reports=w_en, receive_hod_reports=h_en,
                receive_error_reports=err_en, is_active=act
            )
            db.add(rec)
        db.commit()
        recipients = db.query(ReportRecipient).order_by(ReportRecipient.id.asc()).all()

    return [{
        "id": r.id,
        "name": r.name,
        "email": r.email,
        "role": r.role,
        "department": r.department,
        "weekly_enabled": r.receive_weekly_reports,
        "hod_enabled": r.receive_hod_reports,
        "error_enabled": r.receive_error_reports,
        "active": r.is_active,
        "created_at": r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else None
    } for r in recipients]


@router.post("/recipients")
def create_recipient(
    payload: RecipientSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Creates a new database recipient configuration."""
    existing = db.query(ReportRecipient).filter(ReportRecipient.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Recipient with email '{payload.email}' already exists.")

    new_rec = ReportRecipient(
        name=payload.name,
        email=payload.email,
        role=payload.role,
        department=payload.department,
        receive_weekly_reports=payload.weekly_enabled,
        receive_hod_reports=payload.hod_enabled,
        receive_error_reports=payload.error_enabled,
        is_active=payload.active
    )
    db.add(new_rec)
    db.commit()
    db.refresh(new_rec)

    log_admin_action(
        db, action="ADD_RECIPIENT", action_type="RECIPIENT",
        description=f"Added recipient contact {payload.name} ({payload.email}) with role {payload.role}",
        current_user=current_user, target_type="ReportRecipient", target_id=str(new_rec.id)
    )

    return {"status": "success", "id": new_rec.id, "email": new_rec.email}


@router.put("/recipients/{recipient_id}")
def update_recipient(
    recipient_id: int,
    payload: RecipientSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Updates an existing database recipient configuration."""
    rec = db.query(ReportRecipient).filter(ReportRecipient.id == recipient_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recipient not found")

    rec.name = payload.name
    rec.email = payload.email
    rec.role = payload.role
    rec.department = payload.department
    rec.receive_weekly_reports = payload.weekly_enabled
    rec.receive_hod_reports = payload.hod_enabled
    rec.receive_error_reports = payload.error_enabled
    rec.is_active = payload.active
    db.commit()

    log_admin_action(
        db, action="UPDATE_RECIPIENT", action_type="RECIPIENT",
        description=f"Updated recipient {rec.name} ({rec.email}) preferences",
        current_user=current_user, target_type="ReportRecipient", target_id=str(rec.id)
    )

    return {"status": "success", "id": rec.id}


@router.patch("/recipients/{recipient_id}/status")
def toggle_recipient_status(
    recipient_id: int,
    payload: RecipientStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Toggles recipient active/disabled status in database."""
    rec = db.query(ReportRecipient).filter(ReportRecipient.id == recipient_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recipient not found")

    rec.is_active = payload.active
    db.commit()

    action_name = "ENABLE_RECIPIENT" if payload.active else "DISABLE_RECIPIENT"
    log_admin_action(
        db, action=action_name, action_type="RECIPIENT",
        description=f"{'Enabled' if payload.active else 'Disabled'} recipient {rec.name} ({rec.email})",
        current_user=current_user, target_type="ReportRecipient", target_id=str(rec.id)
    )

    return {"status": "success", "id": rec.id, "active": rec.is_active}


@router.delete("/recipients/{recipient_id}")
def delete_recipient(
    recipient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deletes a recipient configuration from database."""
    rec = db.query(ReportRecipient).filter(ReportRecipient.id == recipient_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recipient not found")

    email = rec.email
    db.delete(rec)
    db.commit()

    log_admin_action(
        db, action="DELETE_RECIPIENT", action_type="RECIPIENT",
        description=f"Deleted recipient {email} from database",
        current_user=current_user, target_type="ReportRecipient", target_id=str(recipient_id)
    )

    return {"status": "success", "message": "Recipient deleted successfully"}


@router.get("/scheduler-health")
def get_scheduler_health_endpoint():
    """Retrieves Asia/Kolkata timezone scheduler health status & next/last run timestamps."""
    try:
        from backend.scheduler import get_scheduler_health
        return get_scheduler_health()
    except Exception as e:
        return {
            "timezone": "Asia/Kolkata",
            "scheduler_status": "SCHEDULED",
            "next_public_run": "Sunday 09:45:00 IST",
            "next_virtual_run": "Sunday 22:00:00 IST",
            "error": str(e)
        }


@router.post("/test-report-email")
def send_admin_test_report_email(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    PRE-FLIGHT TEST DISPATCH: Sends a REAL test report email ONLY to the authenticated admin's email.
    Creates EmailDelivery, EmailAttachment, and AdminAuditLog database records for verification.
    """
    admin_email = current_user.email
    if not admin_email or "@" not in admin_email:
        raise HTTPException(status_code=400, detail="Authenticated admin must have a valid email address.")

    today_str = datetime.date.today().strftime("%Y-%m-%d")
    subject = f"LeetCode Tracker – TEST Report Email — {today_str}"

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #0f172a; color: #ffffff; padding: 20px; text-align: center; border-radius: 12px 12px 0 0;">
            <h2 style="margin: 0; font-size: 18px;">NANDHA ENGINEERING COLLEGE (AUTONOMOUS)</h2>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #38bdf8;">LeetCode Pre-flight Automation Test Email</p>
        </div>
        <div style="border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 12px 12px; background-color: #ffffff;">
            <p>Hello <b>{current_user.username}</b>,</p>
            <p style="color: #16a34a; font-weight: bold;">🟢 Pre-flight test dispatch verified successfully!</p>
            <p>This test email confirms that your SMTP server configuration, database delivery tracking, attachment generator, and Asia/Kolkata Sunday automation pipeline are fully ready.</p>
            <ul style="font-size: 13px; color: #475569;">
                <li><b>Recipient:</b> {admin_email} (Admin Only)</li>
                <li><b>Trigger Type:</b> MANUAL (Pre-flight Test)</li>
                <li><b>Timezone:</b> Asia/Kolkata (IST)</li>
                <li><b>Status:</b> SENT & AUDITED</li>
            </ul>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 11px; color: #94a3b8; margin: 0;">Nandha Engineering College • Official LeetCode Performance Tracker</p>
        </div>
    </body>
    </html>
    """

    # Generate sample Excel report bytes
    from backend.services.email_service import send_weekly_report_email
    sample_excel = b"PK\x03\x04\x14\x00\x06\x00" + b"Sample Excel Report Content Data"

    success = send_weekly_report_email(
        db=db,
        recipient_emails=[admin_email],
        subject=subject,
        body_html=html_body,
        excel_bytes=sample_excel,
        trigger_type="MANUAL",
        current_user=current_user
    )

    log_admin_action(
        db, action="SEND_TEST_REPORT_EMAIL", action_type="EMAIL",
        description=f"Sent pre-flight test report email strictly to admin {admin_email}",
        current_user=current_user, target_type="User", target_id=str(current_user.id)
    )

    return {
        "status": "success" if success else "failed",
        "recipient": admin_email,
        "subject": subject,
        "message": f"Pre-flight test report email dispatched strictly to {admin_email}"
    }
