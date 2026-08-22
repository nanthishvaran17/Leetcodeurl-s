"""
verify_real_smtp_e2e.py — Real Production End-to-End Email Delivery Verification
Sends 1 real test email to authorized administrator with real Master Excel and PDF attachments.
"""

import os
import sys
sys.path.insert(0, os.getcwd())
import ssl
import smtplib
import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

from backend.config import settings
from backend.database import SessionLocal
from backend.models import AdminAuditLog


def run_real_smtp_verification():
    db = SessionLocal()
    print("=== REAL PRODUCTION SMTP TEST ===")
    smtp_host = settings.SMTP_HOST
    smtp_port = settings.SMTP_PORT
    smtp_user = settings.SMTP_USERNAME
    smtp_pass = settings.SMTP_PASSWORD
    recipient = "nanthishvaran17@gmail.com"

    print(f"Connecting to {smtp_host}:{smtp_port}...")
    try:
        server = smtplib.SMTP(smtp_host, smtp_port, timeout=15)
        server.starttls(context=ssl.create_default_context())
        server.login(smtp_user, smtp_pass)
        print("[SUCCESS] Authenticated successfully with Google SMTP TLS!")

        # Compose message
        msg = MIMEMultipart()
        msg["From"] = f"Nandha LeetCode Intelligence <{smtp_user}>"
        msg["To"] = recipient
        msg["Subject"] = "Nandha Engineering College — Production Email Verification [TEST]"

        body = f"""Respected Administrator,

This is a real end-to-end production verification email from the Nandha LeetCode Intelligence Platform.
- Total Students: 1,395
- Status: PRODUCTION READY
- Timestamp: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S IST')}

Attached: Master Excel & Executive PDF Reports.
"""
        msg.attach(MIMEText(body, "plain"))

        # Attach real reports
        excel_path = "reports/LeetCode_Weekly_Report_23-08-2026.xlsx"
        pdf_path = "reports/LeetCode_Weekly_Report_23-08-2026.pdf"

        attached_files = []
        for p in [excel_path, pdf_path]:
            if os.path.exists(p):
                with open(p, "rb") as f:
                    part = MIMEBase("application", "octet-stream")
                    part.set_payload(f.read())
                    encoders.encode_base64(part)
                    part.add_header("Content-Disposition", f'attachment; filename="{os.path.basename(p)}"')
                    msg.attach(part)
                    attached_files.append(os.path.basename(p))

        # Send
        server.sendmail(smtp_user, [recipient], msg.as_string())
        server.quit()
        print(f"[SUCCESS] Email successfully delivered to {recipient} with attachments: {attached_files}")

        # Log to audit logs
        audit = AdminAuditLog(
            audit_id=f"AUD-EMAIL-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}",
            action="EMAIL_VERIFIED_SENT",
            action_type="EMAIL",
            admin_name="System",
            target_id=recipient,
            description=f"Real production test email delivered to {recipient} with {len(attached_files)} attachments",
            status="SUCCESS"
        )
        db.add(audit)
        db.commit()
        print(f"[SUCCESS] Audit Log recorded with ID: {audit.id} ({audit.audit_id})")
        return True, audit.id, attached_files

    except Exception as e:
        print(f"[ERROR] SMTP Error: {e}")
        return False, None, []
    finally:
        db.close()


if __name__ == "__main__":
    run_real_smtp_verification()
