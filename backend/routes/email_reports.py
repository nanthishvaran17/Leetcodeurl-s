import datetime
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
from backend.services.email_templates import generate_professional_template

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
    dept: Optional[str] = "ALL"
    year: Optional[str] = "ALL"
    attendance: Optional[str] = "ALL"
    custom_message: Optional[str] = None
    is_safe_test: Optional[bool] = False

class TestEmailSchema(BaseModel):
    recipient: str

class CheckDuplicateSchema(BaseModel):
    recipient_emails: List[str]
    session_id: Optional[int] = None



@router.get("/provider-diagnostics")
def get_email_provider_diagnostics():
    """
    Returns active email provider configuration, connectivity status, and health metrics.
    """
    from backend.services.email_service import get_active_email_provider
    provider_info = get_active_email_provider()
    return {
        "status": "healthy" if provider_info["configured"] else "unconfigured",
        "active_provider": provider_info["provider"],
        "transport": provider_info["transport"],
        "is_configured": provider_info["configured"],
        "sender_email": provider_info["sender"],
        "timeout_seconds": provider_info["timeout_seconds"],
        "max_retries": provider_info["max_retries"],
        "timestamp_ist": datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=5, minutes=30))).isoformat()
    }


@router.post("/test")
def send_provider_test_email(payload: TestEmailSchema):
    """
    Sends a test email via the active email provider (Brevo API or SMTP) without attachments.
    Tests credential validity and network connectivity.
    """
    from backend.services.email_service import send_email, get_active_email_provider

    if not payload.recipient or "@" not in payload.recipient:
        raise HTTPException(status_code=400, detail="Invalid test email recipient address.")

    provider_info = get_active_email_provider()
    provider_name = "Brevo Official API (Port 443 HTTPS)" if provider_info["provider"] == "BREVO_API" else "Gmail SMTP"

    subject = f"Nandha Engineering College — Email Provider Test ({provider_info['provider']})"
    title = "Email Delivery Verification"
    content = f"""
    <p style="margin-top: 0;">This is a verified test dispatch from the <strong>Nandha Engineering College LeetCode system</strong>.</p>
    <p style="color: #16a34a; font-weight: bold;">🟢 Active Provider: {provider_name} verified successfully!</p>
    
    <table class="data-table" role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;">
        <tr>
            <td>Timeout</td>
            <td>{provider_info['timeout_seconds']}s</td>
        </tr>
        <tr>
            <td>Max Retries</td>
            <td>{provider_info['max_retries']}</td>
        </tr>
    </table>
    """

    body_html = generate_professional_template(title, content)

    success, err_msg = send_email(payload.recipient, subject, body_html)

    if success:
        return {"success": True, "message": f"🟢 {provider_name} TEST SUCCESS", "provider": provider_info["provider"]}
    else:
        return {"success": False, "message": f"🔴 {provider_name} TEST FAILED", "error": err_msg or "Unknown email delivery error.", "provider": provider_info["provider"]}


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
    clean_email = payload.email.strip().lower()
    clean_name = payload.name.strip()
    if not clean_email or "@" not in clean_email or "." not in clean_email:
        raise HTTPException(status_code=400, detail="Invalid email address format.")
    if not clean_name:
        raise HTTPException(status_code=400, detail="Recipient full name is required.")

    existing = db.query(ReportEmailRecipient).filter(ReportEmailRecipient.email.ilike(clean_email)).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Recipient with email '{clean_email}' already exists.")

    new_rec = ReportEmailRecipient(
        name=clean_name,
        email=clean_email,
        role=payload.role.strip().upper(),
        department=payload.department.strip() if payload.department else "ALL",
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

    clean_email = payload.email.strip().lower()
    clean_name = payload.name.strip()
    if not clean_email or "@" not in clean_email or "." not in clean_email:
        raise HTTPException(status_code=400, detail="Invalid email address format.")
    if not clean_name:
        raise HTTPException(status_code=400, detail="Recipient full name is required.")

    if clean_email != rec.email.lower():
        existing = db.query(ReportEmailRecipient).filter(
            ReportEmailRecipient.email.ilike(clean_email),
            ReportEmailRecipient.id != recipient_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Recipient with email '{clean_email}' already exists.")

    rec.name = clean_name
    rec.email = clean_email
    rec.role = payload.role.strip().upper()
    rec.department = payload.department.strip() if payload.department else "ALL"
    rec.receive_weekly_reports = payload.receive_weekly_reports
    rec.receive_hod_reports = payload.receive_hod_reports
    rec.receive_error_reports = payload.receive_error_reports
    db.commit()
    return {"status": "success", "id": rec.id}


@router.patch("/recipients/{recipient_id}/status")
def toggle_report_email_recipient_status(recipient_id: int, payload: Dict[str, Any], db: Session = Depends(get_db)):
    """
    Toggles active/inactive status of a recipient contact.
    """
    rec = db.query(ReportEmailRecipient).filter(ReportEmailRecipient.id == recipient_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recipient not found")

    if "active" in payload:
        rec.is_active = bool(payload["active"])
    elif "is_active" in payload:
        rec.is_active = bool(payload["is_active"])
    else:
        rec.is_active = not rec.is_active

    db.commit()
    return {"status": "success", "id": rec.id, "is_active": rec.is_active}


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


@router.post("/trigger-weekly")
def trigger_automated_weekly_email_dispatch(session_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    """
    Triggers automated weekly contest performance report dispatch to all active recipients.
    """
    from backend.models import WeeklySession
    if not session_id:
        sess = db.query(WeeklySession).filter(WeeklySession.status == "FINALIZED").order_by(WeeklySession.id.desc()).first()
        if not sess:
            sess = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()
        session_id = sess.id if sess else None

    if not session_id:
        raise HTTPException(status_code=404, detail="No weekly session available for report email dispatch.")

    res = queue_weekly_report_dispatches(db, session_id=session_id)
    return res


@router.post("/check-duplicate")
def check_duplicate_report_email(payload: CheckDuplicateSchema, db: Session = Depends(get_db)):
    """
    Checks if an identical report has already been successfully delivered to any of the selected recipients.
    Returns duplicate details for administrator confirmation.
    """
    duplicates = []
    for email in payload.recipient_emails:
        clean_email = email.strip().lower()
        query = db.query(EmailDispatchLog).filter(
            EmailDispatchLog.recipient.ilike(clean_email),
            EmailDispatchLog.status == "SENT"
        )
        if payload.session_id:
            query = query.filter(EmailDispatchLog.session_id == payload.session_id)
        log = query.order_by(EmailDispatchLog.id.desc()).first()

        if log:
            duplicates.append({
                "recipient": log.recipient,
                "sent_at": log.sent_at.isoformat() if log.sent_at else log.created_at.isoformat(),
                "email_id": log.email_id,
                "subject": log.subject,
                "session_id": log.session_id,
                "dispatch_type": getattr(log, 'dispatch_type', 'MANUAL') or 'MANUAL'
            })

    return {
        "has_duplicates": len(duplicates) > 0,
        "duplicate_count": len(duplicates),
        "duplicates": duplicates
    }


@router.get("/logs")
def get_email_delivery_logs(
    limit: int = Query(100, ge=1, le=500),
    status: Optional[str] = None,
    dispatch_type: Optional[str] = None,
    recipient: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Retrieves email delivery audit logs with optional status, dispatch type, and recipient filters.
    """
    query = db.query(EmailDispatchLog)
    if status and status.upper() != "ALL":
        query = query.filter(EmailDispatchLog.status == status.upper())
    if dispatch_type and dispatch_type.upper() != "ALL":
        query = query.filter(EmailDispatchLog.dispatch_type == dispatch_type.upper())
    if recipient and recipient.strip():
        query = query.filter(EmailDispatchLog.recipient.ilike(f"%{recipient.strip()}%"))

    logs = query.order_by(EmailDispatchLog.id.desc()).limit(limit).all()
    return [{
        "id": l.id,
        "email_id": l.email_id,
        "report_id": l.report_id,
        "session_id": l.session_id,
        "recipient": l.recipient,
        "role": l.role,
        "subject": l.subject,
        "dispatch_type": getattr(l, 'dispatch_type', 'AUTOMATED') or 'AUTOMATED',
        "provider": getattr(l, 'provider', 'BREVO_API') or 'BREVO_API',
        "status": l.status,
        "attachment_count": l.attachment_count,
        "total_attachment_bytes": getattr(l, 'total_attachment_bytes', 0) or 0,
        "error_message": l.error_message,
        "retry_count": l.retry_count,
        "idempotency_key": l.idempotency_key,
        "sent_at": l.sent_at.isoformat() if l.sent_at else None,
        "created_at": l.created_at.isoformat() if l.created_at else None
    } for l in logs]


@router.post("/send-manual")
def trigger_manual_report_email(payload: ManualSendSchema, db: Session = Depends(get_db)):
    """
    Triggers manual email dispatch to selected recipient emails with filtered Excel report.
    """
    if not payload.recipient_emails:
        raise HTTPException(status_code=400, detail="At least one recipient email must be specified.")

    res = send_manual_report_email(
        db,
        session_id=payload.session_id,
        recipient_emails=[str(e) for e in payload.recipient_emails],
        dept=payload.dept or "ALL",
        year=payload.year or "ALL",
        attendance=payload.attendance or "ALL",
        custom_message=payload.custom_message,
        is_safe_test=bool(payload.is_safe_test)
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

    # If error is a permanent 550 recipient refusal, do NOT auto retry
    if log.error_message and ("5.1.10" in log.error_message or "550" in log.error_message or "RecipientNotFound" in log.error_message):
        raise HTTPException(
            status_code=400,
            detail="Cannot retry: Recipient was permanently rejected by destination mail server (550 5.1.10 RecipientNotFound). Please update recipient email first."
        )

    log.status = "RETRYING"
    log.error_message = None
    db.commit()

    _trigger_email_queue_worker()

    return {"status": "success", "message": f"Queued retry attempt for log id {log_id}"}


@router.get("/delivery-diagnostics")
def get_email_delivery_diagnostics():
    """
    Returns email delivery diagnostics telemetry (Recipient, SMTP Server, SMTP Response, Delivery Status, Timestamp, Error Code).
    """
    from backend.services.email_service import get_delivery_diagnostics
    diagnostics = get_delivery_diagnostics()
    return {
        "status": "success",
        "total_records": len(diagnostics),
        "diagnostics": diagnostics
    }

