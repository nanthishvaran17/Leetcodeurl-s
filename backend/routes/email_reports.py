from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from backend.database import get_db
from backend.models import ReportEmailRecipient, EmailDispatchLog
from backend.services.email_service import (
    queue_weekly_report_dispatches,
    send_manual_report_email,
    _trigger_email_queue_worker
)

router = APIRouter(prefix="/api/email", tags=["Automated Report Email Delivery"])

class RecipientCreateSchema(BaseModel):
    name: str
    email: str
    role: str = "HOD" # MANAGEMENT, HOD, DEPARTMENT_COORDINATOR, ADMIN
    department: Optional[str] = "ALL"
    receive_weekly_reports: bool = True
    receive_hod_reports: bool = True
    receive_error_reports: bool = True

class ManualSendSchema(BaseModel):
    session_id: Optional[int] = None
    recipient_emails: List[str]
    custom_message: Optional[str] = None

class TestEmailSchema(BaseModel):
    recipient: str


@router.post("/test")
def send_smtp_test_email(payload: TestEmailSchema):
    """
    Sends a test email via Gmail SMTP (STARTTLS port 587) without attachments.
    Tests credential validity and network connectivity.
    """
    from backend.services.email_service import send_email

    if not payload.recipient or "@" not in payload.recipient:
        raise HTTPException(status_code=400, detail="Invalid test email recipient address.")

    subject = "Nandha Engineering College - SMTP Test"
    body_html = """
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #0f172a; color: #ffffff; padding: 16px 20px; text-align: center; border-radius: 12px 12px 0 0;">
            <h3 style="margin: 0;">NANDHA ENGINEERING COLLEGE</h3>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #38bdf8;">LeetCode System — Gmail SMTP Verification</p>
        </div>
        <div style="border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
            <p>This is a test email from the <strong>Nandha Engineering College LeetCode system</strong>.</p>
            <p style="color: #16a34a; font-weight: bold;">🟢 Gmail SMTP connection & authentication verified successfully!</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 11px; color: #94a3b8; margin: 0;">Nandha Engineering College • LeetCode Institutional Tracking Platform</p>
        </div>
    </body>
    </html>
    """

    success, err_msg = send_email(payload.recipient, subject, body_html)

    if success:
        return {"success": True, "message": "🟢 SMTP TEST SUCCESS"}
    else:
        return {"success": False, "message": "🔴 SMTP TEST FAILED", "error": err_msg or "Unknown SMTP authentication or connection error."}


@router.get("/recipients")
def get_report_email_recipients(db: Session = Depends(get_db)):
    """
    Returns configured report email recipients.
    """
    recipients = db.query(ReportEmailRecipient).order_by(ReportEmailRecipient.id.asc()).all()
    return [{
        "id": r.id,
        "name": r.name,
        "email": r.email,
        "role": r.role,
        "department": r.department,
        "is_active": r.is_active,
        "receive_weekly_reports": r.receive_weekly_reports,
        "receive_hod_reports": r.receive_hod_reports,
        "receive_error_reports": r.receive_error_reports,
        "created_at": r.created_at.isoformat() if r.created_at else None
    } for r in recipients]


@router.post("/recipients")
def create_report_email_recipient(payload: RecipientCreateSchema, db: Session = Depends(get_db)):
    """
    Creates a new recipient contact for institutional report emails.
    """
    existing = db.query(ReportEmailRecipient).filter(ReportEmailRecipient.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Recipient with email '{payload.email}' already exists.")

    new_rec = ReportEmailRecipient(
        name=payload.name,
        email=payload.email,
        role=payload.role,
        department=payload.department,
        receive_weekly_reports=payload.receive_weekly_reports,
        receive_hod_reports=payload.receive_hod_reports,
        receive_error_reports=payload.receive_error_reports
    )
    db.add(new_rec)
    db.commit()
    db.refresh(new_rec)
    return {"status": "success", "id": new_rec.id, "email": new_rec.email}


@router.put("/recipients/{recipient_id}")
def update_report_email_recipient(recipient_id: int, payload: RecipientCreateSchema, db: Session = Depends(get_db)):
    """
    Updates an existing recipient configuration.
    """
    rec = db.query(ReportEmailRecipient).filter(ReportEmailRecipient.id == recipient_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recipient not found")

    rec.name = payload.name
    rec.email = payload.email
    rec.role = payload.role
    rec.department = payload.department
    rec.receive_weekly_reports = payload.receive_weekly_reports
    rec.receive_hod_reports = payload.receive_hod_reports
    rec.receive_error_reports = payload.receive_error_reports
    db.commit()
    return {"status": "success", "id": rec.id}


@router.delete("/recipients/{recipient_id}")
def delete_report_email_recipient(recipient_id: int, db: Session = Depends(get_db)):
    """
    Deletes a recipient contact.
    """
    rec = db.query(ReportEmailRecipient).filter(ReportEmailRecipient.id == recipient_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recipient not found")

    db.delete(rec)
    db.commit()
    return {"status": "success", "message": "Recipient deleted"}


@router.get("/logs")
def get_email_delivery_logs(
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Retrieves email delivery audit logs.
    """
    query = db.query(EmailDispatchLog)
    if status:
        query = query.filter(EmailDispatchLog.status == status.upper())

    logs = query.order_by(EmailDispatchLog.id.desc()).limit(limit).all()
    return [{
        "id": l.id,
        "email_id": l.email_id,
        "report_id": l.report_id,
        "session_id": l.session_id,
        "recipient": l.recipient,
        "role": l.role,
        "subject": l.subject,
        "status": l.status,
        "attachment_count": l.attachment_count,
        "error_message": l.error_message,
        "retry_count": l.retry_count,
        "sent_at": l.sent_at.isoformat() if l.sent_at else None,
        "created_at": l.created_at.isoformat() if l.created_at else None
    } for l in logs]


@router.post("/send-manual")
def trigger_manual_report_email(payload: ManualSendSchema, db: Session = Depends(get_db)):
    """
    Triggers manual email dispatch to selected recipient emails with custom message.
    """
    if not payload.recipient_emails:
        raise HTTPException(status_code=400, detail="At least one recipient email must be specified.")

    res = send_manual_report_email(
        db,
        session_id=payload.session_id,
        recipient_emails=[str(e) for e in payload.recipient_emails],
        custom_message=payload.custom_message
    )
    return res


@router.post("/retry/{log_id}")
def retry_failed_email_dispatch(log_id: int, db: Session = Depends(get_db)):
    """
    Retries a failed email dispatch item.
    """
    log = db.query(EmailDispatchLog).filter(EmailDispatchLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Email log item not found")

    log.status = "RETRYING"
    log.error_message = None
    db.commit()

    _trigger_email_queue_worker()

    return {"status": "success", "message": f"Queued retry attempt for log id {log_id}"}
