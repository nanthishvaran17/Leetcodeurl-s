import logging
from typing import Optional, List
from backend.services.email_service import send_email
from backend.config import settings

logger = logging.getLogger(__name__)

from backend.services.email_templates import generate_professional_template


def notify_staff_created(staff_email: str, staff_name: str, role: str, department: str, raw_password: str):
    """Sends a welcome email with credentials to newly created staff."""
    title = "Welcome to the LeetCode Tracker System"
    portal_url = f"{settings.FRONTEND_ORIGIN}/"

    content = f"""
    <p style="margin-top: 0;">Dear {staff_name},</p>
    <p>Your institutional account has been successfully created. You can now access the faculty and administrative dashboards.</p>

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
            <td>Department</td>
            <td>{department or "N/A"}</td>
        </tr>
        <tr>
            <td>Email / Username</td>
            <td style="word-break: break-all;">{staff_email}</td>
        </tr>
        <tr>
            <td>Temporary Password</td>
            <td><code style="background:#f1f5f9; padding:4px 8px; border-radius:4px; font-size: 15px; color:#0f172a; word-break: break-all;">{raw_password}</code></td>
        </tr>
    </table>

    <div class="security-notice">
        <strong>⚠️ Security Notice:</strong> Please log in and change your temporary password immediately after your first access.
    </div>
    """

    action_button = f'<a href="{portal_url}" class="btn" target="_blank">Access Portal</a>'
    html_body = generate_professional_template(title, content, action_button, fallback_url=portal_url)

    logger.info(f"[NOTIFY] Sending staff creation email to {staff_email} via portal_url: {portal_url}")
    send_email(staff_email, "Your Institutional Account is Ready", html_body=html_body)


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
    title = "Password Changed Successfully"

    pass_html = ""
    if new_password:
        pass_html = f"""
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 6px; margin: 20px 0; word-break: break-word; overflow-wrap: anywhere;">
            <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Your New / Temporary Password</p>
            <p style="margin: 0; font-family: 'Courier New', Courier, monospace; font-size: 20px; font-weight: bold; color: #0f172a; letter-spacing: 1px; word-break: break-all;">{new_password}</p>
        </div>
        """

    content = f"""
    <p style="margin-top: 0;">Dear {staff_name},</p>
    <p>This is a confirmation that your account password was successfully updated.</p>
    {pass_html}
    <p>If you did not perform this action, please contact the system administrator immediately to secure your account.</p>
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
        <tr>
            <td>New Temporary Password</td>
            <td><code style="background:#f1f5f9; padding:4px 8px; border-radius:4px; font-size: 15px; color:#0f172a; word-break: break-all;">{temp_password}</code></td>
        </tr>
    </table>

    <div class="security-notice">
        <strong>⚠️ Mandatory Action Required:</strong> You will be forced to change this temporary password immediately upon your next login.
    </div>
    """

    action_button = f'<a href="{portal_url}" class="btn" target="_blank">Login to Reset Password</a>'

    html_body = generate_professional_template(title, content, action_button, fallback_url=portal_url)
    send_email(staff_email, "Account Password Reset (Action Required)", html_body=html_body)

