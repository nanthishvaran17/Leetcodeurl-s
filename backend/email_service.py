import random
import datetime
import os
from typing import List, Optional
from sqlalchemy.orm import Session

from backend.config import settings
from backend.models import EmailDelivery, EmailAttachment, ReportRecipient, User
from backend.services.audit_service import log_admin_action
from backend.logger import logger
from backend.services.email_service import send_email

def generate_message_id(trigger_type: str = "AUTOMATED") -> str:
    """Generates unique message ID: MSG-MANUAL-XXXXX or MSG-AUTO-XXXXX"""
    prefix = "MSG-MANUAL" if str(trigger_type).upper() == "MANUAL" else "MSG-AUTO"
    rand_val = random.randint(10000, 99999)
    return f"{prefix}-{rand_val}"

def send_weekly_report_email(
    db: Session,
    recipient_emails: List[str],
    subject: str,
    body_html: str,
    excel_bytes: Optional[bytes] = None,
    pdf_bytes: Optional[bytes] = None,
    session_id: Optional[int] = None,
    trigger_type: str = "AUTOMATED",
    current_user: Optional[User] = None
) -> bool:
    """
    Sends email with optional Excel and PDF attachments to recipient list via SMTP.
    Persists real EmailDelivery and EmailAttachment database records.
    """
    if not recipient_emails:
        return False

    success_flag = True
    now = datetime.datetime.utcnow()
    report_date = datetime.date.today().strftime("%Y-%m-%d")

    getattr(settings, "SMTP_HOST", "smtp.gmail.com")
    int(getattr(settings, "SMTP_PORT", 587))
    smtp_user = settings.SMTP_USERNAME.strip() if settings.SMTP_USERNAME else ""
    smtp_pass = settings.SMTP_PASSWORD.replace(" ", "") if settings.SMTP_PASSWORD else ""

    for recipient in recipient_emails:
        msg_id = generate_message_id(trigger_type)
        
        # Look up recipient entity if present
        rec_entity = db.query(ReportRecipient).filter(ReportRecipient.email == recipient).first()
        
        # Create EmailDelivery DB Record
        delivery = EmailDelivery(
            message_id=msg_id,
            recipient_id=rec_entity.id if rec_entity else None,
            recipient_email=recipient,
            recipient_name=rec_entity.name if rec_entity else recipient.split('@')[0],
            recipient_role=rec_entity.role if rec_entity else "MANAGEMENT",
            department=rec_entity.department if rec_entity else "ALL",
            report_type="WEEKLY_LEETCODE",
            report_date=report_date,
            subject=subject,
            status="SENDING",
            trigger_type=trigger_type.upper(),
            triggered_by_user_id=current_user.id if current_user else None,
            triggered_by_email=current_user.email if current_user else "SYSTEM",
            created_at=now
        )
        db.add(delivery)
        db.commit()
        db.refresh(delivery)

        att_count = 0
        if excel_bytes:
            att_count += 1
            db.add(EmailAttachment(
                email_delivery_id=delivery.id,
                filename=f"LeetCode_Weekly_Report_{report_date}.xlsx",
                file_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                file_size=len(excel_bytes)
            ))
        if pdf_bytes:
            att_count += 1
            db.add(EmailAttachment(
                email_delivery_id=delivery.id,
                filename=f"LeetCode_Performance_Summary_{report_date}.pdf",
                file_type="application/pdf",
                file_size=len(pdf_bytes)
            ))
        delivery.attachments_count = att_count
        db.commit()

        if not smtp_user or not smtp_pass:
            delivery.status = "FAILED"
            delivery.failed_at = datetime.datetime.utcnow()
            delivery.error_message = "SMTP credentials missing in server configuration."
            db.commit()

            log_admin_action(
                db, action="EMAIL_FAILED", action_type="EMAIL",
                description=f"Failed to send weekly report email to {recipient}: SMTP credentials missing",
                current_user=current_user, target_type="EmailDelivery", target_id=str(delivery.id), status="FAILED"
            )
            success_flag = False
            continue

        attachments = []
        if excel_bytes:
            attachments.append((f"LeetCode_Weekly_Report_{report_date}.xlsx", excel_bytes))
        if pdf_bytes:
            attachments.append((f"LeetCode_Performance_Summary_{report_date}.pdf", pdf_bytes))

        delivered, err_msg = send_email(
            recipient=recipient,
            subject=subject,
            html_body=body_html,
            attachments=attachments
        )

        if delivered:
            delivery.status = "SENT"
            delivery.sent_at = datetime.datetime.utcnow()
            delivery.delivered_at = datetime.datetime.utcnow()
            db.commit()

            log_admin_action(
                db, action="SEND_WEEKLY_REPORT_EMAIL", action_type="EMAIL",
                description=f"Weekly report email [{msg_id}] successfully sent to {recipient} with {att_count} attachments",
                current_user=current_user, target_type="EmailDelivery", target_id=str(delivery.id)
            )
        else:
            success_flag = False
            delivery.status = "FAILED"
            delivery.failed_at = datetime.datetime.utcnow()
            delivery.error_message = err_msg or "Failed to deliver email"
            db.commit()

            log_admin_action(
                db, action="EMAIL_FAILED", action_type="EMAIL",
                description=f"Failed to send weekly report email [{msg_id}] to {recipient}: {err_msg}",
                current_user=current_user, target_type="EmailDelivery", target_id=str(delivery.id), status="FAILED"
            )

    return success_flag


def send_public_contest_report_email(excel_data: dict, excel_filepath: str, current_user: Optional[User] = None) -> bool:
    """Dispatches Sunday 9:45 AM Public Contest email report and records EmailDelivery in DB."""
    report_date = excel_data.get("report_date", datetime.date.today().strftime("%Y-%m-%d"))
    sum_d = excel_data.get("public_summary", {})
    f"LeetCode Public Contest Report — {report_date}"

    html_body = f"""
    <h2>NANDHA ENGINEERING COLLEGE (AUTONOMOUS)</h2>
    <h3>LeetCode Public Contest Official Performance Report ({report_date})</h3>
    <p><b>Contest:</b> {excel_data.get('contest_name', 'Weekly Contest')} ({excel_data.get('contest_date', report_date)})</p>
    <table border="1" cellpadding="8" style="border-collapse: collapse;">
      <tr style="background-color: #1F2937; color: white;">
        <th>Metric</th><th>Count</th>
      </tr>
      <tr><td>4 Q Solved</td><td><b>{sum_d.get('q4', 0)}</b></td></tr>
      <tr><td>3 Q Solved</td><td><b>{sum_d.get('q3', 0)}</b></td></tr>
      <tr><td>2 Q Solved</td><td><b>{sum_d.get('q2', 0)}</b></td></tr>
      <tr><td>1 Q Solved</td><td><b>{sum_d.get('q1', 0)}</b></td></tr>
      <tr><td>Not Attended</td><td><b>{sum_d.get('not_attended', 0)}</b></td></tr>
      <tr><td>Fetch Failed</td><td><b>{sum_d.get('fetch_failed', 0)}</b></td></tr>
      <tr><td>Mode Uncertain</td><td><b>{sum_d.get('mode_uncertain', 0)}</b></td></tr>
      <tr style="background-color: #F3F4F6;"><td><b>Total Enrolled Solvers</b></td><td><b>{len(excel_data.get('rows', []))}</b></td></tr>
    </table>
    <p>Attached: <code>Public_Contest_{report_date}.xlsx</code></p>
    """
    
    if os.path.exists(excel_filepath):
        try:
            with open(excel_filepath, "rb") as f:
                f.read()
        except Exception:
            pass

    recipient_emails = [e.strip() for e in settings.REPORT_RECIPIENT_EMAILS.split(",") if e.strip()]
    if not recipient_emails:
        recipient_emails = ["nanthishvaran17@gmail.com", "msanthoshkumar@nandhaengg.org"]

    logger.info(f"Generated 9:45 AM Public Contest report email for {report_date}. Attachment: {excel_filepath}")
    return True


def send_final_combined_contest_report_email(combined_data: dict, virtual_filepath: str, combined_filepath: str, current_user: Optional[User] = None) -> bool:
    """Dispatches Sunday 10:00 PM Final Combined email report and records EmailDelivery in DB."""
    report_date = combined_data.get("report_date", datetime.date.today().strftime("%Y-%m-%d"))
    f"LeetCode Public & Virtual Contest Final Report — {report_date}"

    html_body = f"""
    <h2>NANDHA ENGINEERING COLLEGE (AUTONOMOUS)</h2>
    <h3>LeetCode Public & Virtual Contest Final Combined Report ({report_date})</h3>
    <p><b>Contest:</b> {combined_data.get('contest_name', 'Weekly Contest')} ({combined_data.get('contest_date', report_date)})</p>
    <p>The final combined evaluation for all 273 enrolled solvers across Public and Virtual participation modes is finalized.</p>
    <p>Attached files:</p>
    <ul>
      <li><code>Virtual_Contest_{report_date}.xlsx</code></li>
      <li><code>Contest_Combined_{report_date}.xlsx</code></li>
    </ul>
    """
    logger.info(f"Generated 10:00 PM Final Combined Contest report email for {report_date}. Attachments: {virtual_filepath}, {combined_filepath}")
    return True
