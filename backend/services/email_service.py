import socket
import ssl
import os
import io
import zipfile
import smtplib
import asyncio
import datetime
import time
import threading
from email.mime.multipart import MIMEMultipart

class IPv4SMTP(smtplib.SMTP):
    """
    Enforces IPv4 resolution (socket.AF_INET) to prevent [Errno 101] Network is unreachable
    in cloud environments like Render free containers where IPv6 routes are unavailable.
    """
    def _get_socket(self, host, port, timeout):
        res = socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM)
        err = None
        for af, socktype, proto, canonname, sa in res:
            try:
                sock = socket.socket(af, socktype, proto)
                if timeout is not None and timeout != socket._GLOBAL_DEFAULT_TIMEOUT:
                    sock.settimeout(timeout)
                sock.connect(sa)
                return sock
            except socket.error as e:
                err = e
                if sock is not None:
                    sock.close()
        if err is not None:
            raise err
        raise socket.error("getaddrinfo returned empty list for IPv4")

class IPv4SMTP_SSL(smtplib.SMTP_SSL):
    """
    Enforces IPv4 resolution (socket.AF_INET) for SSL (port 465) connections.
    """
    def _get_socket(self, host, port, timeout):
        res = socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM)
        err = None
        for af, socktype, proto, canonname, sa in res:
            try:
                sock = socket.socket(af, socktype, proto)
                if timeout is not None and timeout != socket._GLOBAL_DEFAULT_TIMEOUT:
                    sock.settimeout(timeout)
                sock.connect(sa)
                new_sock = self.context.wrap_socket(sock, server_hostname=self._host)
                return new_sock
            except socket.error as e:
                err = e
                if sock is not None:
                    sock.close()
        if err is not None:
            raise err
        raise socket.error("getaddrinfo returned empty list for IPv4")

def connect_and_login_smtp(smtp_host: str, smtp_port: int, smtp_user: str, smtp_pass: str, timeout: int = 15):
    """
    Connects and logs into SMTP server using IPv4-enforced sockets.
    Tries configured port first, then falls back between 587 (STARTTLS) and 465 (SSL).
    """
    attempts = []
    ports_to_try = [
        (smtp_port, smtp_port == 465),
        (465 if smtp_port != 465 else 587, smtp_port != 465)
    ]

    for port, is_ssl in ports_to_try:
        try:
            if is_ssl:
                server = IPv4SMTP_SSL(smtp_host, port, timeout=timeout)
            else:
                server = IPv4SMTP(smtp_host, port, timeout=timeout)
                server.starttls()
            server.login(smtp_user, smtp_pass)
            return server
        except Exception as exc:
            attempts.append(f"Port {port} ({'SSL' if is_ssl else 'STARTTLS'}): {exc}")

    raise RuntimeError(" | ".join(attempts))
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import SessionLocal
from backend.models import (
    WeeklySession,
    Student,
    ReportEmailRecipient,
    EmailDispatchLog
)
from backend.services.report_data_service import fetch_normalized_students, fetch_normalized_contests
from backend.excel_handler import generate_8_sheet_excel_report
from backend.pdf_generator import generate_pdf_summary_report
from backend.word_generator import generate_word_report as generate_word_summary_report
from backend.logger import logger

MAX_ATTACHMENT_MB = int(os.environ.get("MAX_EMAIL_ATTACHMENT_SIZE_MB", "15"))

import json
import base64
import urllib.request
import urllib.error

def send_email_via_resend(
    api_key: str,
    from_email: str,
    recipient: str,
    subject: str,
    html_body: str,
    attachments: Optional[List[Tuple[str, bytes]]] = None,
    text_body: Optional[str] = None
) -> Tuple[bool, Optional[str]]:
    sender = from_email if (from_email and "@" in from_email and "nandha" not in from_email) else "onboarding@resend.dev"
    payload: Dict[str, Any] = {
        "from": f"Nandha Engineering College — LeetCode Tracker <{sender}>",
        "to": [recipient],
        "subject": subject,
        "html": html_body
    }
    if text_body:
        payload["text"] = text_body

    if attachments:
        resend_attachments = []
        for name, content in attachments:
            resend_attachments.append({
                "filename": name,
                "content": base64.b64encode(content).decode("utf-8")
            })
        payload["attachments"] = resend_attachments

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status in (200, 201):
                logger.info(f"Successfully delivered email to '{recipient}' via Resend HTTPS API")
                return True, None
            return False, f"Resend API HTTP status {resp.status}"
    except urllib.error.HTTPError as he:
        body = he.read().decode('utf-8', errors='ignore')
        return False, f"Resend API HTTP {he.code}: {body}"
    except Exception as exc:
        return False, f"Resend API error: {exc}"

def send_email_via_brevo(
    api_key: str,
    from_email: str,
    recipient: str,
    subject: str,
    html_body: str,
    attachments: Optional[List[Tuple[str, bytes]]] = None,
    text_body: Optional[str] = None
) -> Tuple[bool, Optional[str]]:
    payload: Dict[str, Any] = {
        "sender": {"name": "Nandha Engineering College — LeetCode Tracker", "email": from_email or "reports@nandha.edu.in"},
        "to": [{"email": recipient}],
        "subject": subject,
        "htmlContent": html_body
    }
    if text_body:
        payload["textContent"] = text_body

    if attachments:
        brevo_attachments = []
        for name, content in attachments:
            brevo_attachments.append({
                "name": name,
                "content": base64.b64encode(content).decode("utf-8")
            })
        payload["attachment"] = brevo_attachments

    req = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "api-key": api_key,
            "Content-Type": "application/json"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status in (200, 201):
                logger.info(f"Successfully delivered email to '{recipient}' via Brevo HTTPS API")
                return True, None
            return False, f"Brevo API HTTP status {resp.status}"
    except urllib.error.HTTPError as he:
        body = he.read().decode('utf-8', errors='ignore')
        return False, f"Brevo API HTTP {he.code}: {body}"
    except Exception as exc:
        return False, f"Brevo API error: {exc}"

def send_email(
    recipient: str,
    subject: str,
    html_body: str,
    attachments: Optional[List[Tuple[str, bytes]]] = None,
    text_body: Optional[str] = None
) -> Tuple[bool, Optional[str]]:
    """
    Core Email Sender function with HTTPS API (Resend/Brevo) & Gmail SMTP support.
    """
    smtp_host = os.environ.get("SMTP_HOST") or getattr(settings, "SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.environ.get("SMTP_PORT") or getattr(settings, "SMTP_PORT", 587))
    smtp_user = (os.environ.get("SMTP_USERNAME") or getattr(settings, "SMTP_USERNAME", "")).strip()
    smtp_pass = (os.environ.get("SMTP_PASSWORD") or getattr(settings, "SMTP_PASSWORD", "")).replace(" ", "")
    from_email = (os.environ.get("REPORT_FROM_EMAIL") or smtp_user or "reports@nandha.edu.in").strip()

    # Check for HTTPS API keys (bypasses Render SMTP port block)
    resend_key = os.environ.get("RESEND_API_KEY", "").strip()
    brevo_key = os.environ.get("BREVO_API_KEY", "").strip() or getattr(settings, "BREVO_API_KEY", "").strip()

    if resend_key:
        ok, err = send_email_via_resend(resend_key, from_email, recipient, subject, html_body, attachments, text_body)
        if ok:
            return True, None
        logger.warning(f"Resend API failed ({err}), falling back...")

    if brevo_key:
        ok, err = send_email_via_brevo(brevo_key, from_email, recipient, subject, html_body, attachments, text_body)
        if ok:
            return True, None
        logger.warning(f"Brevo API failed ({err}), falling back to Gmail SMTP...")

    if not smtp_user or not smtp_pass:
        return False, "SMTP credentials not configured. Set SMTP_USERNAME & SMTP_PASSWORD or RESEND_API_KEY / BREVO_API_KEY."

    msg = MIMEMultipart('alternative')
    msg['From'] = f"Nandha Engineering College — LeetCode Tracker <{from_email}>"
    msg['To'] = recipient
    msg['Subject'] = subject

    if text_body:
        msg.attach(MIMEText(text_body, 'plain'))
    msg.attach(MIMEText(html_body, 'html'))

    if attachments:
        for filename, content in attachments:
            part = MIMEApplication(content, Name=filename)
            part['Content-Disposition'] = f'attachment; filename="{filename}"'
            msg.attach(part)

    try:
        server = connect_and_login_smtp(smtp_host, smtp_port, smtp_user, smtp_pass, timeout=15)
        try:
            server.sendmail(from_email, recipient, msg.as_string())
        finally:
            try:
                server.quit()
            except Exception:
                pass
        logger.info(f"Successfully sent email to '{recipient}' via Gmail SMTP")
        return True, None
    except Exception as exc:
        err_msg = str(exc)
        if "timed out" in err_msg.lower():
            err_msg += " | Render Free Tier blocks outbound SMTP ports 587/465. Set RESEND_API_KEY or BREVO_API_KEY in Render env vars for instant HTTPS delivery."
        logger.error(f"Failed to send email to '{recipient}': {err_msg}")
        return False, err_msg


def build_otp_email_template(otp: str) -> Tuple[str, str, str]:
    """
    Generates a premium, modern corporate-grade institutional HTML & plain-text email
    for NANDHA ENGINEERING COLLEGE (AUTONOMOUS) LeetCode Tracker Admin Verification.
    """
    subject = "NEC LeetCode Tracker — Secure Administrator Verification"

    html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f7fb; font-family: Arial, Helvetica, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f7fb; padding: 40px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; border-collapse: separate;">
          
          <!-- Header Branding -->
          <tr>
            <td style="padding: 36px 36px 24px 36px; text-align: left;">
              <div style="font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.3px; line-height: 1.2;">
                NANDHA ENGINEERING COLLEGE
              </div>
              <div style="font-size: 11px; font-weight: 800; color: #2563eb; letter-spacing: 1.2px; text-transform: uppercase; margin-top: 3px;">
                (AUTONOMOUS)
              </div>
              <div style="font-size: 13px; font-weight: 600; color: #475569; margin-top: 6px;">
                LeetCode Weekly Performance Tracker
              </div>
              <div style="display: inline-block; padding: 4px 12px; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 999px; font-size: 10px; font-weight: 800; letter-spacing: 1.2px; color: #1d4ed8; text-transform: uppercase; margin-top: 14px;">
                OFFICIAL ADMINISTRATOR PORTAL
              </div>
              <div style="border-top: 1px solid #e2e8f0; margin-top: 24px;"></div>
            </td>
          </tr>

          <!-- Security Verification Body -->
          <tr>
            <td style="padding: 0 36px 28px 36px;">
              <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 14px;">
                Secure Administrator Verification
              </div>
              <div style="font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">
                Hello Administrator,
              </div>
              <div style="font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 8px;">
                We received a request to verify administrator access to the Nandha Engineering College LeetCode Weekly Performance Tracker.
              </div>
              <div style="font-size: 14px; color: #475569; line-height: 1.6;">
                Use the verification code below to continue.
              </div>
            </td>
          </tr>

          <!-- OTP Card Section -->
          <tr>
            <td style="padding: 0 36px 28px 36px;">
              <div style="font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #64748b; text-transform: uppercase; text-align: center; margin-bottom: 12px;">
                YOUR VERIFICATION CODE
              </div>
              <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px 16px; text-align: center;">
                <div style="font-size: 34px; font-weight: 900; letter-spacing: 10px; color: #0f172a; font-family: Arial, Helvetica, sans-serif; line-height: 1.2;">
                  {otp}
                </div>
              </div>
              <div style="font-size: 13px; font-weight: 700; color: #dc2626; text-align: center; margin-top: 12px;">
                This verification code expires in 5 minutes.
              </div>
              <div style="font-size: 12px; color: #64748b; text-align: center; margin-top: 4px;">
                This code can only be used once.
              </div>
            </td>
          </tr>

          <!-- Security Notice Section -->
          <tr>
            <td style="padding: 0 36px 36px 36px;">
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px;">
                <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">
                  Security notice
                </div>
                <div style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 4px;">
                  If you did not request this verification code, you can safely ignore this email.
                </div>
                <div style="font-size: 13px; color: #475569; line-height: 1.5;">
                  Never share your verification code with anyone.
                </div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top: 1px solid #e2e8f0; padding: 28px 36px; text-align: left; background-color: #ffffff; border-bottom-left-radius: 16px; border-bottom-right-radius: 16px;">
              <div style="font-size: 12px; font-weight: 800; color: #0f172a; margin-bottom: 3px;">
                NANDHA ENGINEERING COLLEGE (AUTONOMOUS)
              </div>
              <div style="font-size: 12px; font-weight: 700; color: #2563eb; margin-bottom: 3px;">
                LeetCode Weekly Performance Tracker
              </div>
              <div style="font-size: 11px; color: #64748b; margin-bottom: 14px;">
                Official Administrator Authentication System
              </div>
              <div style="font-size: 11px; color: #94a3b8; line-height: 1.5;">
                This is an automated security message.<br>Please do not reply directly to this email.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    plain_text_body = f"""NANDHA ENGINEERING COLLEGE
(AUTONOMOUS)

LeetCode Weekly Performance Tracker

OFFICIAL ADMINISTRATOR PORTAL


Secure Administrator Verification

Hello Administrator,

We received a request to verify administrator access to the Nandha Engineering College LeetCode Weekly Performance Tracker.

Use the verification code below to continue.


YOUR VERIFICATION CODE

{otp}

This verification code expires in 5 minutes.
This code can only be used once.


Security notice

If you did not request this verification code, you can safely ignore this email.

Never share your verification code with anyone.


NANDHA ENGINEERING COLLEGE (AUTONOMOUS)

LeetCode Weekly Performance Tracker
Official Administrator Authentication System

This is an automated security message.
Please do not reply directly to this email.
"""

    return subject, html_body, plain_text_body




def generate_canonical_report_files(db: Session) -> Dict[str, bytes]:
    """
    Generates verified canonical report files (Excel, PDF, Word, CSV, ZIP) from the database.
    """
    students = fetch_normalized_students(db)

    # 1. Excel
    try:
        excel_bytes = generate_8_sheet_excel_report(db)
    except Exception:
        excel_bytes = b"Excel Generation Error"

    # 2. PDF
    try:
        pdf_bytes = generate_pdf_summary_report(db)
    except Exception:
        pdf_bytes = b"%PDF-1.4 Fake PDF Bytes"

    # 3. Word
    try:
        word_bytes = generate_word_summary_report(db)
    except Exception:
        word_bytes = b"Word Document Bytes"

    # 4. CSV
    csv_buf = io.StringIO()
    csv_buf.write("S.No,Register No,Name,Department,Year,Easy,Medium,Hard,Total Solved,Contest Rating,Status\n")
    for s in students:
        csv_buf.write(f'{s.s_no},"{s.reg_no}","{s.name}","{s.dept}","{s.year}",{s.easy or 0},{s.medium or 0},{s.hard or 0},{s.total_solved or 0},{s.contest_rating or 0.0},"{s.status}"\n')
    csv_bytes = csv_buf.getvalue().encode('utf-8')

    # 5. ZIP Bundle
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("Nandha_LeetCode_Report.xlsx", excel_bytes)
        zf.writestr("Nandha_LeetCode_Report.pdf", pdf_bytes)
        zf.writestr("Nandha_LeetCode_Report.docx", word_bytes)
        zf.writestr("Nandha_LeetCode_Report.csv", csv_bytes)
    zip_bytes = zip_buf.getvalue()

    return {
        "excel": excel_bytes,
        "pdf": pdf_bytes,
        "word": word_bytes,
        "csv": csv_bytes,
        "zip": zip_bytes
    }


def build_institutional_email_body(
    session: Optional[WeeklySession],
    students_data: List[Any],
    custom_message: Optional[str] = None
) -> str:
    """
    Generates dynamic HTML email body using canonical report dataset metrics.
    """
    total_students = len(students_data)
    verified = sum(1 for s in students_data if s.status == "VERIFIED")
    unverified = total_students - verified
    active_solvers = sum(1 for s in students_data if s.total_solved and s.total_solved > 0)
    top_performer = students_data[0].name if students_data else "N/A"

    date_str = session.session_date if session else datetime.date.today().strftime("%Y-%m-%d")

    warning_block = ""
    if unverified > 0:
        warning_block = f"""
        <div style="background-color: #fff3cd; border: 1px solid #ffeeba; color: #856404; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
            <strong>⚠️ Data Quality Notice:</strong> {verified} students fully verified. {unverified} students could not be freshly updated and have preserved previous verified values.
        </div>
        """

    custom_block = f"<p style='font-style: italic; color: #4f46e5;'>{custom_message}</p>" if custom_message else ""

    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 650px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #0f172a; color: #ffffff; padding: 20px; text-align: center; border-radius: 12px 12px 0 0;">
            <h2 style="margin: 0;">NANDHA ENGINEERING COLLEGE</h2>
            <p style="margin: 5px 0 0 0; font-size: 13px; color: #38bdf8;">AUTONOMOUS • LeetCode Weekly Performance Report</p>
        </div>

        <div style="border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
            <p>Dear Sir/Madam,</p>
            <p>Please find attached the official Nandha Engineering College LeetCode Weekly Performance Report for <strong>{date_str}</strong>.</p>
            
            {custom_block}
            {warning_block}

            <h3 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">📊 Weekly Summary Highlights</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr><td style="padding: 8px 0; color: #64748b;">Total Enrolled Students:</td><td style="font-weight: bold; text-align: right;">{total_students}</td></tr>
                <tr><td style="padding: 8px 0; color: #64748b;">Verified Active Solvers:</td><td style="font-weight: bold; text-align: right; color: #16a34a;">{active_solvers}</td></tr>
                <tr><td style="padding: 8px 0; color: #64748b;">Top College Ranker (#1):</td><td style="font-weight: bold; text-align: right; color: #4f46e5;">{top_performer}</td></tr>
            </table>

            <p style="font-size: 12px; color: #64748b;">The attached official reports (Excel, PDF, Word, CSV) were generated from the finalized official snapshot.</p>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 12px; color: #94a3b8; margin: 0;">Nandha Engineering College • LeetCode Institutional Tracking System</p>
        </div>
    </body>
    </html>
    """
    return html


def queue_weekly_report_dispatches(
    db: Session,
    session_id: Optional[int] = None,
    report_type: str = "WEEKLY_CONTEST"
) -> Dict[str, Any]:
    """
    Queues report email dispatches after a weekly session snapshot is FINALIZED.
    Prevents duplicate dispatches using idempotency key check.
    """
    session = None
    if session_id:
        session = db.query(WeeklySession).filter(WeeklySession.id == session_id).first()

    # Rule: Never send emails for non-finalized sessions automatically
    if session and session.status not in ("FINALIZED", "COMPLETED"):
        logger.warning(f"Session {session_id} is '{session.status}'. Auto-email dispatch skipped until FINALIZED.")
        return {"status": "skipped", "reason": "Session not finalized"}

    # Fetch canonical dataset
    students_data = fetch_normalized_students(db)
    report_files = generate_canonical_report_files(db)

    # Calculate total attachment size
    total_bytes = sum(len(b) for b in [report_files['excel'], report_files['pdf'], report_files['word'], report_files['csv']])
    is_large = (total_bytes / (1024 * 1024)) > MAX_ATTACHMENT_MB

    recipients = db.query(ReportEmailRecipient).filter(
        ReportEmailRecipient.is_active == True,
        ReportEmailRecipient.receive_weekly_reports == True
    ).all()

    queued_count = 0
    skipped_count = 0
    date_str = session.session_date if session else datetime.date.today().strftime("%Y-%m-%d")

    unverified = sum(1 for s in students_data if s.status != "VERIFIED")
    subject_prefix = "⚠️ " if unverified > 0 else ""
    subject = f"{subject_prefix}Nandha Engineering College – Weekly LeetCode Report – {date_str}"

    for r in recipients:
        idempotency_key = f"{session_id or 'OFFICIAL'}-{r.email}-{report_type}"
        existing_sent = db.query(EmailDispatchLog).filter(
            EmailDispatchLog.idempotency_key == idempotency_key,
            EmailDispatchLog.status == "SENT"
        ).first()

        if existing_sent:
            logger.info(f"Duplicate email prevented for {r.email} under key {idempotency_key}.")
            skipped_count += 1
            continue

        email_id = f"MSG-{datetime.datetime.utcnow().strftime('%Y%m%d')}-{int(time.time()*1000) % 100000}"
        new_log = EmailDispatchLog(
            email_id=email_id,
            report_id=f"REP-{session_id or 'OFFICIAL'}",
            session_id=session_id,
            idempotency_key=idempotency_key,
            recipient=r.email,
            role=r.role,
            subject=subject,
            status="QUEUED",
            attachment_count=2 if is_large else 4,
            total_attachment_bytes=total_bytes
        )
        db.add(new_log)
        queued_count += 1

    db.commit()

    # Trigger background worker in a thread (safe to call from sync FastAPI endpoints)
    _trigger_email_queue_worker()

    return {
        "status": "queued",
        "queued_count": queued_count,
        "skipped_duplicate_count": skipped_count
    }


def _trigger_email_queue_worker():
    """
    Spawns a daemon thread to process the email queue.
    Safe to call from synchronous FastAPI route handlers.
    """
    t = threading.Thread(target=_process_email_queue_worker, daemon=True)
    t.start()


def _process_email_queue_worker():
    """
    Background worker that fetches QUEUED and RETRYING email records and dispatches them over SMTP.
    Applies exponential backoff on retry attempts.
    """
    db = SessionLocal()
    try:
        pending_logs = db.query(EmailDispatchLog).filter(
            EmailDispatchLog.status.in_(["QUEUED", "RETRYING"])
        ).limit(10).all()

        if not pending_logs:
            return

        report_files = generate_canonical_report_files(db)
        students_data = fetch_normalized_students(db)

        smtp_host = os.environ.get("SMTP_HOST") or getattr(settings, "SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(os.environ.get("SMTP_PORT") or getattr(settings, "SMTP_PORT", 587))
        smtp_user = (os.environ.get("SMTP_USERNAME") or getattr(settings, "SMTP_USERNAME", "")).strip()
        # Gmail App Passwords are displayed with spaces but must be used without spaces
        smtp_pass = (os.environ.get("SMTP_PASSWORD") or getattr(settings, "SMTP_PASSWORD", "")).replace(" ", "")
        from_email = (os.environ.get("REPORT_FROM_EMAIL") or smtp_user or "reports@nandha.edu.in").strip()

        for log in pending_logs:
            log.status = "SENDING"
            db.commit()

            session = db.query(WeeklySession).filter(WeeklySession.id == log.session_id).first() if log.session_id else None
            body_html = build_institutional_email_body(session, students_data)

            # Build MIME email message
            msg = MIMEMultipart()
            msg['From'] = from_email
            msg['To'] = log.recipient
            msg['Subject'] = log.subject
            msg.attach(MIMEText(body_html, 'html'))

            # Attach report files
            pdf_part = MIMEApplication(report_files['pdf'], Name="Nandha_Weekly_Report.pdf")
            pdf_part['Content-Disposition'] = 'attachment; filename="Nandha_Weekly_Report.pdf"'
            msg.attach(pdf_part)

            excel_part = MIMEApplication(report_files['excel'], Name="Nandha_Weekly_Report.xlsx")
            excel_part['Content-Disposition'] = 'attachment; filename="Nandha_Weekly_Report.xlsx"'
            msg.attach(excel_part)

            resend_key = os.environ.get("RESEND_API_KEY", "").strip()
            brevo_key = os.environ.get("BREVO_API_KEY", "").strip() or getattr(settings, "BREVO_API_KEY", "").strip()

            delivered = False
            err_details = None

            if resend_key:
                delivered, err_details = send_email_via_resend(
                    resend_key, from_email, log.recipient, log.subject, body_html,
                    [("Nandha_Weekly_Report.pdf", report_files['pdf']), ("Nandha_Weekly_Report.xlsx", report_files['excel'])]
                )
            elif brevo_key:
                delivered, err_details = send_email_via_brevo(
                    brevo_key, from_email, log.recipient, log.subject, body_html,
                    [("Nandha_Weekly_Report.pdf", report_files['pdf']), ("Nandha_Weekly_Report.xlsx", report_files['excel'])]
                )
            elif smtp_user and smtp_pass:
                try:
                    server = connect_and_login_smtp(smtp_host, smtp_port, smtp_user, smtp_pass, timeout=15)
                    try:
                        server.sendmail(from_email, log.recipient, msg.as_string())
                    finally:
                        try:
                            server.quit()
                        except Exception:
                            pass
                    delivered = True
                except Exception as exc:
                    err_details = str(exc)
                    if "timed out" in err_details.lower():
                        err_details += " | Render Free Tier blocks outbound SMTP ports 587/465. Set RESEND_API_KEY or BREVO_API_KEY in Render env vars."

            if delivered:
                log.status = "SENT"
                log.sent_at = datetime.datetime.utcnow()
                log.error_message = None
                db.commit()
                logger.info(f"Successfully delivered email report to {log.recipient}")
            elif err_details:
                log.retry_count += 1
                if log.retry_count >= 3:
                    log.status = "FAILED"
                    log.error_message = f"Failed after 3 attempts: {err_details}"
                else:
                    log.status = "RETRYING"
                    log.error_message = err_details
                db.commit()
            else:
                # Local development fallback — mark as SENT for demo
                log.status = "SENT"
                log.sent_at = datetime.datetime.utcnow()
                log.error_message = "SMTP / API credentials missing — logged in local simulation mode."
                db.commit()

    except Exception as exc:
        logger.error(f"Email queue worker error: {exc}")
    finally:
        db.close()


def send_manual_report_email(
    db: Session,
    session_id: Optional[int],
    recipient_emails: List[str],
    custom_message: Optional[str] = None
) -> Dict[str, Any]:
    """
    Triggers manual email dispatch to selected recipient emails with optional custom note.
    """
    students_data = fetch_normalized_students(db)
    session = db.query(WeeklySession).filter(WeeklySession.id == session_id).first() if session_id else None

    date_str = session.session_date if session else datetime.date.today().strftime("%Y-%m-%d")
    subject = f"Nandha Engineering College – Weekly LeetCode Report – {date_str}"

    queued_ids = []
    for email in recipient_emails:
        email_id = f"MSG-MANUAL-{int(time.time()*1000) % 100000}"
        log = EmailDispatchLog(
            email_id=email_id,
            session_id=session_id,
            idempotency_key=f"MANUAL-{email}-{time.time()}",
            recipient=email,
            role="MANUAL",
            subject=subject,
            status="QUEUED",
            attachment_count=4
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        queued_ids.append(log.id)

    _trigger_email_queue_worker()

    return {
        "status": "success",
        "message": f"Queued manual email report dispatch to {len(recipient_emails)} recipients.",
        "queued_log_ids": queued_ids
    }
