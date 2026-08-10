import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from typing import List, Optional
from sqlalchemy.orm import Session

from backend.config import settings
from backend.models import EmailLog, WeeklySession
from backend.logger import logger

def send_weekly_report_email(
    db: Session,
    recipient_emails: List[str],
    subject: str,
    body_html: str,
    excel_bytes: Optional[bytes] = None,
    pdf_bytes: Optional[bytes] = None,
    session_id: Optional[int] = None
) -> bool:
    """
    Sends email with optional Excel and PDF attachments to recipient list via SMTP.
    Logs success or failure in EmailLog table.
    """
    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        logger.warning("SMTP credentials not configured in settings. Email delivery skipped.")
        # Log skipped email
        for email in recipient_emails:
            log_entry = EmailLog(
                session_id=session_id,
                recipient=email,
                subject=subject,
                status="FAILED",
                error_message="SMTP credentials missing in configuration."
            )
            db.add(log_entry)
        db.commit()
        return False

    success_flag = True

    for recipient in recipient_emails:
        msg = MIMEMultipart()
        msg['From'] = settings.SMTP_FROM_EMAIL or settings.SMTP_USERNAME
        msg['To'] = recipient
        msg['Subject'] = subject

        msg.attach(MIMEText(body_html, 'html'))

        if excel_bytes:
            excel_part = MIMEApplication(excel_bytes, Name="LeetCode_Weekly_Report.xlsx")
            excel_part['Content-Disposition'] = 'attachment; filename="LeetCode_Weekly_Report.xlsx"'
            msg.attach(excel_part)

        if pdf_bytes:
            pdf_part = MIMEApplication(pdf_bytes, Name="LeetCode_Performance_Summary.pdf")
            pdf_part['Content-Disposition'] = 'attachment; filename="LeetCode_Performance_Summary.pdf"'
            msg.attach(pdf_part)

        try:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
                server.starttls()
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.sendmail(msg['From'], recipient, msg.as_string())

            log_entry = EmailLog(
                session_id=session_id,
                recipient=recipient,
                subject=subject,
                status="SENT",
                error_message=None
            )
            db.add(log_entry)
            logger.info(f"Report email successfully sent to '{recipient}'")

        except Exception as e:
            success_flag = False
            err_msg = str(e)
            logger.error(f"Failed to send email to '{recipient}': {err_msg}")
            log_entry = EmailLog(
                session_id=session_id,
                recipient=recipient,
                subject=subject,
                status="FAILED",
                error_message=err_msg
            )
            db.add(log_entry)

    db.commit()
    return success_flag
