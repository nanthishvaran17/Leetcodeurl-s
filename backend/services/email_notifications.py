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
    
    <p style="margin-top: 15px;">If you did not expect this account, please contact the system administrator.</p>
    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;"/>
    <p style="font-size: 11px; color: #666; line-height: 1.4;">
        Nandha Engineering College (Autonomous)<br/>
        LeetCode Intelligence System<br/><br/>
        This is an automated notification. Please do not reply directly to this email.
    </p>
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

