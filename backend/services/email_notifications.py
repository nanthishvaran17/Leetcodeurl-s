import logging
from typing import Optional, List
from backend.services.email_service import send_email
from backend.config import settings

logger = logging.getLogger(__name__)

from backend.services.email_templates import generate_professional_template


def notify_staff_created(staff_email: str, staff_name: str, role: str, username: str, setup_token: str):
    """Sends a welcome email with secure setup link to newly created staff."""
    title = "Nandha Engineering College — Institutional Account Created"
    setup_url = f"{settings.FRONTEND_ORIGIN}/setup-account?token={setup_token}"

    content = f"""
    <p style="margin-top: 0; font-weight: bold;">NANDHA ENGINEERING COLLEGE (AUTONOMOUS)</p>
    <p style="font-weight: bold;">LeetCode Intelligence System</p>
    <br/>
    <p>Dear {staff_name},</p>
    <p>Your institutional account has been successfully created.</p>
    <br/>
    <p><strong>Account Details:</strong></p>
    <table class="data-table" role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;">
        <tr>
            <td>Name</td>
            <td>{staff_name}</td>
        </tr>
        <tr>
            <td>Role</td>
            <td>{role}</td>
        </tr>
        <tr>
            <td>Email</td>
            <td>{staff_email}</td>
        </tr>
        <tr>
            <td>Username</td>
            <td>{username}</td>
        </tr>
    </table>

    <div class="security-notice">
        For security, your password is not included in this email.
    </div>
    
    <p style="margin-top: 15px; color: #334155; font-size: 14px;">If you did not expect this account, please contact the system administrator.</p>
    """

    action_button = f'<a href="{setup_url}" class="btn" target="_blank">Set Up My Account</a>'
    html_body = generate_professional_template(title, content, action_button, fallback_url=setup_url)

    logger.info(f"[NOTIFY] Sending staff creation email to {staff_email} with setup_url: {setup_url}")
    send_email(staff_email, title, html_body=html_body)


def notify_staff_updated(staff_email: str, staff_name: str, changes: dict):
    """Sends an email indicating that the staff profile was updated."""
    if not changes:
        return

    title = "Your Institutional Profile has been Updated"
    changes_html = "".join([f'<tr><td>{k.replace("_", " ").title()}</td><td style="word-break: break-word;">{v}</td></tr>' for k, v in changes.items()])

    content = f"""
    <p style="margin-top: 0;">Dear {staff_name},</p>
    <p>Your institutional profile has been recently updated by the administrator. Please review the changes below:</p>

    <table class="data-table" role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;">
        {changes_html}
    </table>
    """

    html_body = generate_professional_template(title, content)
    send_email(staff_email, "Account Profile Updated", html_body=html_body)


def notify_password_changed(staff_email: str, staff_name: str, new_password: Optional[str] = None):
    import datetime
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    title = "Password Changed Successfully"

    content = f"""
    <p style="margin-top: 0;">Dear {staff_name},</p>
    <p>Your LeetCode Intelligence System password was successfully changed.</p>
    <br/>
    <p><strong>Account:</strong> {staff_email}</p>
    <p><strong>Date & Time:</strong> {timestamp}</p>
    
    <div class="security-notice">
        For your security, your password is never displayed or sent by email.
    </div>
    <p>If you did not perform this action, please contact the system administrator immediately.</p>
    """
    html_body = generate_professional_template(title, content)
    send_email(staff_email, "Security Alert: Password Changed", html_body=html_body)


def notify_forgot_password_otp(staff_email: str, otp: str):
    title = "Password Recovery OTP"
    content = f"""
    <p style="margin-top: 0;">A password recovery request was initiated for your account.</p>
    <p>Use the following 6-digit One Time Password (OTP) to reset your password:</p>

    <div style="text-align: center; margin: 28px 0;">
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e293b; background: #f1f5f9; padding: 16px 24px; border-radius: 8px; display: inline-block; max-width: 100%; box-sizing: border-box; word-break: break-all;">
            {otp}
        </div>
    </div>

    <p>This OTP is valid for 15 minutes. <strong>Do not share this code with anyone.</strong></p>
    """
    html_body = generate_professional_template(title, content)
    send_email(staff_email, "Password Recovery OTP", html_body=html_body)


def notify_student_created(student_email: str, student_name: str, reg_no: str, department: str, year: str):
    if not student_email:
        return

    title = "Student Registration Successful"
    content = f"""
    <p style="margin-top: 0;">Dear {student_name},</p>
    <p>Your student profile has been registered in the LeetCode Tracker System.</p>

    <table class="data-table" role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;">
        <tr><td>Name</td><td>{student_name}</td></tr>
        <tr><td>Register Number</td><td>{reg_no}</td></tr>
        <tr><td>Department</td><td>{department}</td></tr>
        <tr><td>Academic Year</td><td>{year}</td></tr>
    </table>
    """
    html_body = generate_professional_template(title, content)
    send_email(student_email, "Student Account Registered", html_body=html_body)


def notify_student_updated(recipient_email: str, recipient_name: str, student_name: str, reg_no: str, changes: dict):
    if not changes:
        return

    title = "Student Record Updated"
    changes_html = "".join([f'<tr><td>{k.replace("_", " ").title()}</td><td style="word-break: break-word;">{v}</td></tr>' for k, v in changes.items()])

    content = f"""
    <p style="margin-top: 0;">Dear {recipient_name},</p>
    <p>The institutional record for student <strong>{student_name} ({reg_no})</strong> has been updated.</p>

    <table class="data-table" role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;">
        {changes_html}
    </table>
    """
    html_body = generate_professional_template(title, content)
    send_email(recipient_email, f"Student Record Updated: {student_name}", html_body=html_body)


def notify_faculty_allocation(faculty_email: str, faculty_name: str, students: List[dict]):
    if not students:
        return

    title = "New Student Mentorship Allocation"

    if len(students) == 1:
        content = f"""
        <p style="margin-top: 0;">Dear {faculty_name},</p>
        <p>A new student has been assigned to your mentoring portfolio.</p>
        """
    else:
        content = f"""
        <p style="margin-top: 0;">Dear {faculty_name},</p>
        <p><strong>{len(students)} students</strong> have been newly assigned to your mentoring portfolio.</p>
        """

    table_rows = ""
    for s in students:
        table_rows += f"""
            <tr>
                <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; word-break: break-word;">{s.get('name', 'N/A')}</td>
                <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; word-break: break-word;">{s.get('reg_no', 'N/A')}</td>
                <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; word-break: break-word;">{s.get('year_level', 'N/A')}</td>
            </tr>
        """

    content += f"""
        <table class="data-table" role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;">
            <thead>
                <tr>
                    <th style="text-align: left; padding: 10px 12px; border-bottom: 2px solid #cbd5e1; background-color: #f8fafc; color: #475569; font-weight: 600; font-size: 13px;">Student Name</th>
                    <th style="text-align: left; padding: 10px 12px; border-bottom: 2px solid #cbd5e1; background-color: #f8fafc; color: #475569; font-weight: 600; font-size: 13px;">Register Number</th>
                    <th style="text-align: left; padding: 10px 12px; border-bottom: 2px solid #cbd5e1; background-color: #f8fafc; color: #475569; font-weight: 600; font-size: 13px;">Academic Year</th>
                </tr>
            </thead>
            <tbody>
                {table_rows}
            </tbody>
        </table>
        <p>Please log in to the faculty portal to review your updated student list.</p>
    """

    portal_url = f"{settings.FRONTEND_ORIGIN}/faculty"
    action_button = f'<a href="{portal_url}" class="btn" target="_blank">View Portfolio</a>'

    html_body = generate_professional_template(title, content, action_button, fallback_url=portal_url)
    send_email(faculty_email, "Student Allocation Updated", html_body=html_body)


def notify_faculty_unallocation(faculty_email: str, faculty_name: str, students: List[dict]):
    if not students:
        return

    title = "Student Mentorship Removed"

    if len(students) == 1:
        s = students[0]
        content = f"""
        <p style="margin-top: 0;">Dear {faculty_name},</p>
        <p>The following student has been removed from your mentoring portfolio.</p>
        <table class="data-table" role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;">
            <tr><td>Name</td><td>{s.get('name')}</td></tr>
            <tr><td>Register Number</td><td>{s.get('reg_no')}</td></tr>
            <tr><td>Department</td><td>{s.get('department')}</td></tr>
        </table>
        """
    else:
        content = f"""
        <p style="margin-top: 0;">Dear {faculty_name},</p>
        <p><strong>{len(students)} students</strong> have been removed from your mentoring portfolio.</p>
        """

    html_body = generate_professional_template(title, content)
    send_email(faculty_email, "Student Mentorship Updated", html_body=html_body)


def notify_default_password_reset(staff_email: str, staff_name: str, temp_password: str):
    """Sends a notification to a staff member about their password being reset to a temporary default."""
    title = "Administrative Password Reset"
    portal_url = f"{settings.FRONTEND_ORIGIN}/"

    content = f"""
    <p style="margin-top: 0;">Dear {staff_name},</p>
    <p>Your institutional account password has been reset by the system administrator.</p>

    <table class="data-table" role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;">
        <tr>
            <td>Institutional Email</td>
            <td style="word-break: break-all;"><strong>{staff_email}</strong></td>
        </tr>
    </table>

    <div class="security-notice">
        <strong>Mandatory Action Required:</strong> Please use the "Forgot Password" feature on the portal to securely set your new password. Your current sessions have been invalidated.
    </div>
    """

    action_button = f'<a href="{portal_url}" class="btn" target="_blank">Login to Reset Password</a>'

    html_body = generate_professional_template(title, content, action_button, fallback_url=portal_url)
    send_email(staff_email, "Account Password Reset (Action Required)", html_body=html_body)

def notify_admin_staff_created(admin_email: str, staff_data: dict, admin_data: dict, event_data: dict):
    """Sends a detailed, professional institutional email to the administrator when a staff account is created."""
    import datetime
    from backend.time_utils import ensure_ist, now_utc

    title = "Staff Account Created Successfully"
    subject_line = f"Staff Account Created | {staff_data.get('full_name', '')} | Nandha Engineering College"
    
    # Safe getters
    staff_name = staff_data.get('full_name')
    role = staff_data.get('role')
    department = staff_data.get('department')
    email = staff_data.get('email')
    account_status = staff_data.get('status', 'Active')
    
    # Canonical timezone conversion to IST (Asia/Kolkata)
    raw_created_at = staff_data.get('created_at')
    if isinstance(raw_created_at, datetime.datetime):
        created_at_ist = ensure_ist(raw_created_at)
    elif isinstance(raw_created_at, str) and raw_created_at.strip():
        try:
            parsed = datetime.datetime.fromisoformat(raw_created_at.replace("Z", "+00:00"))
            created_at_ist = ensure_ist(parsed)
        except Exception:
            created_at_ist = ensure_ist(now_utc())
    else:
        created_at_ist = ensure_ist(now_utc())

    created_date = created_at_ist.strftime("%d %B %Y")
    created_time = created_at_ist.strftime("%I:%M %p IST")
    event_timestamp_str = f"{created_date}, {created_time}"
    
    account_id = staff_data.get('account_id')
    staff_id = staff_data.get('staff_id')
    permissions = staff_data.get('permissions', [])
    
    event_id = event_data.get('event_id')
    created_by = admin_data.get('created_by')
    
    # Standardized 2-Column Table Styles
    label_style = "padding:10px 12px; border-bottom:1px solid #e2e8f0; color:#64748b; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; width:170px; min-width:170px; max-width:170px; background-color:#f8fafc; vertical-align:top;"
    value_style = "padding:10px 12px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-weight:600; font-size:14px; vertical-align:top; word-break:break-word; overflow-wrap:anywhere;"
    
    # Build Staff Details Rows
    details_rows = []
    if staff_name: details_rows.append(f"<tr><td style='{label_style}'>STAFF NAME</td><td style='{value_style}'>{staff_name}</td></tr>")
    if role: details_rows.append(f"<tr><td style='{label_style}'>DESIGNATION / ROLE</td><td style='{value_style}'>{role}</td></tr>")
    if department and department not in ["None", "N/A", "null"]: details_rows.append(f"<tr><td style='{label_style}'>DEPARTMENT</td><td style='{value_style}'>{department}</td></tr>")
    if email: details_rows.append(f"<tr><td style='{label_style}'>EMAIL ADDRESS</td><td style='{value_style}'>{email}</td></tr>")
    
    status_color = "#16a34a" if str(account_status).lower() == "active" else "#dc2626"
    status_html = f"<span style='color:{status_color}; font-weight:bold;'>{account_status}</span>"
    details_rows.append(f"<tr><td style='{label_style}'>ACCOUNT STATUS</td><td style='{value_style}'>{status_html}</td></tr>")
    details_rows.append(f"<tr><td style='{label_style}'>CREATED DATE</td><td style='{value_style}'>{created_date}</td></tr>")
    details_rows.append(f"<tr><td style='{label_style}'>CREATED TIME</td><td style='{value_style}'>{created_time}</td></tr>")
    
    details_html = f'<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%; border-collapse:separate; border-spacing:0; border:1px solid #e2e8f0; border-radius:6px; margin:16px 0; overflow:hidden;">{"".join(details_rows)}</table>'
    
    # System Access
    if permissions:
        perms_html = "".join([f"<li style='margin-bottom:4px;'>{p}</li>" for p in permissions if p])
        sys_access = f"<ul style='padding-left:20px; color:#334155; margin:0;'>{perms_html}</ul>"
    else:
        sys_access = "<p style='color:#334155; margin:0;'>The account has been configured according to the assigned role.</p>"
        
    # Account Info Rows
    acc_rows = []
    if account_id: acc_rows.append(f"<tr><td style='{label_style}'>ACCOUNT ID</td><td style='{value_style} font-family:monospace;'>{account_id}</td></tr>")
    if staff_id and staff_id not in ["None", "N/A", "null"]: acc_rows.append(f"<tr><td style='{label_style}'>STAFF ID</td><td style='{value_style} font-family:monospace;'>{staff_id}</td></tr>")
    if created_by: acc_rows.append(f"<tr><td style='{label_style}'>CREATED BY</td><td style='{value_style}'>{created_by}</td></tr>")
    acc_rows.append(f"<tr><td style='{label_style}'>CREATED ON</td><td style='{value_style}'>{event_timestamp_str}</td></tr>")
    
    acc_info_html = f'<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%; border-collapse:separate; border-spacing:0; border:1px solid #e2e8f0; border-radius:6px; margin:16px 0; overflow:hidden;">{"".join(acc_rows)}</table>'
    
    # Audit Info Rows
    audit_label_style = "padding:6px 12px; color:#64748b; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; width:140px; min-width:140px; max-width:140px; vertical-align:top;"
    audit_value_style = "padding:6px 12px; color:#334155; vertical-align:top; word-break:break-word; overflow-wrap:anywhere;"
    
    audit_rows = [
        f"<tr><td style='{audit_label_style}'>EVENT:</td><td style='{audit_value_style} font-weight:bold; color:#0f172a;'>Staff Account Created</td></tr>"
    ]
    if event_id: audit_rows.append(f"<tr><td style='{audit_label_style}'>EVENT ID:</td><td style='{audit_value_style}'>{event_id}</td></tr>")
    if account_id: audit_rows.append(f"<tr><td style='{audit_label_style}'>ACCOUNT ID:</td><td style='{audit_value_style}'>{account_id}</td></tr>")
    if created_by: audit_rows.append(f"<tr><td style='{audit_label_style}'>CREATED BY:</td><td style='{audit_value_style}'>{created_by}</td></tr>")
    audit_rows.append(f"<tr><td style='{audit_label_style}'>TIMESTAMP:</td><td style='{audit_value_style}'>{event_timestamp_str}</td></tr>")
    audit_rows.append(f"<tr><td style='{audit_label_style}'>STATUS:</td><td style='{audit_value_style}'><span style='color:#16a34a; font-weight:bold;'>Successful</span></td></tr>")
    
    audit_html = f'<div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:16px; margin-top:24px;"><table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%; font-size:12px; font-family:monospace; border-collapse:collapse;">{"".join(audit_rows)}</table></div>'
    
    content = f"""
    <div style="text-align:center; margin-bottom:32px;">
        <h2 style="margin:0; font-size:20px; color:#1e293b; letter-spacing:-0.5px;">Nandha Engineering College</h2>
        <p style="margin:4px 0 0 0; font-size:14px; color:#64748b; font-weight:500;">LeetCode Intelligence System</p>
    </div>
    
    <p style="color:#334155; font-size:15px; line-height:1.6;">A new staff account has been successfully created in the Nandha Engineering College LeetCode Intelligence System.</p>
    
    <div style="margin-top:32px;">
        <h4 style="color:#0f172a; margin:0 0 12px 0; font-size:14px; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">Staff Account Details</h4>
        {details_html}
    </div>
    
    <div style="margin-top:32px;">
        <h4 style="color:#0f172a; margin:0 0 12px 0; font-size:14px; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">System Access</h4>
        {sys_access}
    </div>
    
    <div style="margin-top:32px;">
        <h4 style="color:#0f172a; margin:0 0 12px 0; font-size:14px; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">Account Information</h4>
        {acc_info_html}
    </div>
    
    <div class="security-notice" style="margin-top:32px; background:#fff1f2; border:1px solid #fecdd3; padding:16px; border-radius:6px;">
        <h4 style="margin:0 0 8px 0; color:#be123c; font-size:13px; text-transform:uppercase;">Security Notice</h4>
        <p style="margin:0; font-size:13px; color:#9f1239; line-height:1.5;">For security reasons, passwords, OTPs, authentication tokens, API keys, and other confidential credentials must never be included in this email. If any account information is incorrect, the Administrator can review and update the account from the administration panel.</p>
    </div>
    {audit_html}
    """
    
    portal_url = f"{settings.FRONTEND_ORIGIN}/settings"
    action_button = f'<a href="{portal_url}" style="display:inline-block; background-color:#2563eb; color:#ffffff; padding:14px 28px; text-decoration:none; border-radius:6px; font-weight:bold; font-size:15px; text-align:center; min-width:200px;">View Staff Account</a>'
    
    html_body = generate_professional_template(title, content, action_button, fallback_url=settings.FRONTEND_ORIGIN)
    send_email(admin_email, subject_line, html_body=html_body)


