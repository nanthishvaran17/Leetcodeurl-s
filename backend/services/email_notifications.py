import logging
from typing import Optional, List
from pydantic import BaseModel
from backend.services.email_service import send_email
from backend.config import settings

logger = logging.getLogger(__name__)

def generate_professional_template(title: str, content: str, action_button: Optional[str] = None, fallback_url: Optional[str] = None) -> str:
    \"\"\"
    Generates a standardized professional HTML email wrapper with institutional branding.
    Optimized for Gmail, Outlook, Desktop, Mobile, and Tablet.
    \"\"\"
    logo_url = "https://raw.githubusercontent.com/nanthishvaran17/Leetcodeurl-s/main/frontend/public/nec_25_logo.png"

    button_html = ""
    if action_button:
        button_html = f"""
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 30px auto;">
            <tr>
                <td align="center">
                    {action_button}
                </td>
            </tr>
        </table>
        """
        if fallback_url:
            button_html += f"""
            <div style="text-align: center; margin-top: 10px; font-size: 13px; color: #64748b; word-wrap: break-word;">
                Or copy and paste this link into your browser:<br>
                <a href="{fallback_url}" style="color: #3b82f6; text-decoration: underline;">{fallback_url}</a>
            </div>
            """

    return f"""<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>{title}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: #f4f7f6;
            color: #333333;
            margin: 0;
            padding: 0;
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
        }}
        table {{ border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }}
        img {{ border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }}
        .container {{
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }}
        .header {{
            background-color: #0f172a;
            padding: 24px;
            text-align: center;
            border-bottom: 4px solid #3b82f6;
        }}
        .header-logo {{
            width: 80px;
            height: auto;
            margin-bottom: 15px;
            display: inline-block;
        }}
        .header h1 {{
            color: #ffffff;
            margin: 0;
            font-size: 18px;
            font-weight: 700;
            letter-spacing: 0.5px;
            line-height: 1.4;
        }}
        .header .sub-header {{
            color: #38bdf8;
            margin: 4px 0 0 0;
            font-size: 14px;
            font-weight: 500;
        }}
        .content {{
            padding: 32px 24px;
            line-height: 1.6;
            font-size: 15px;
            color: #1e293b;
        }}
        .footer {{
            background-color: #f8fafc;
            padding: 24px;
            text-align: center;
            font-size: 12px;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
            line-height: 1.5;
        }}
        .btn {{
            display: inline-block;
            background-color: #3b82f6;
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            text-align: center;
        }}
        .data-table {{
            width: 100%;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            border-collapse: separate;
            border-spacing: 0;
            margin: 24px 0;
            overflow: hidden;
            table-layout: fixed;
        }}
        .data-table td {{
            padding: 12px 16px;
            border-bottom: 1px solid #e2e8f0;
            word-wrap: break-word;
            word-break: break-word;
            overflow-wrap: break-word;
        }}
        .data-table tr:last-child td {{
            border-bottom: none;
        }}
        .data-table td:first-child {{
            font-weight: 600;
            color: #475569;
            width: 35%;
            background-color: #f8fafc;
            border-right: 1px solid #e2e8f0;
        }}
        .security-notice {{
            background-color: #fffbeb;
            border-left: 4px solid #f59e0b;
            padding: 16px;
            border-radius: 4px;
            margin: 24px 0;
            color: #92400e;
            font-size: 14px;
        }}
        @media only screen and (max-width: 600px) {{
            .container {{ width: 100% !important; border-radius: 0 !important; }}
            .content {{ padding: 24px 16px !important; }}
            .data-table td {{ display: block; width: 100% !important; box-sizing: border-box; border-right: none !important; }}
            .data-table td:first-child {{ border-bottom: none; padding-bottom: 4px; }}
            .data-table td:nth-child(2) {{ padding-top: 4px; padding-bottom: 16px; font-weight: 500; }}
        }}
    </style>
</head>
<body style="background-color: #f4f7f6; margin: 0; padding: 20px 0;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
            <td style="padding: 20px 0;">
                <table role="presentation" class="container" align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
                    <tr>
                        <td class="header">
                            <img src="{logo_url}" alt="Nandha Engineering College Logo" class="header-logo" width="80" />
                            <h1>{settings.COLLEGE_NAME}</h1>
                            <div class="sub-header">LeetCode Tracker System</div>
                        </td>
                    </tr>
                    <tr>
                        <td class="content">
                            <h2 style="color: #0f172a; margin-top: 0; margin-bottom: 20px; font-size: 22px;">{title}</h2>
                            {content}
                            {button_html}
                        </td>
                    </tr>
                    <tr>
                        <td class="footer">
                            <strong>{settings.COLLEGE_NAME}</strong><br>
                            LeetCode Tracker System<br><br>
                            This is an automated notification. Please do not reply directly to this email.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""

def notify_staff_created(staff_email: str, staff_name: str, role: str, department: str, raw_password: str):
    """Sends a welcome email with credentials to newly created staff."""
    title = "Welcome to the LeetCode Tracker System"
    portal_url = f"{settings.FRONTEND_ORIGIN}/"
    
    content = f"""
    <p style="margin-top: 0;">Dear {staff_name},</p>
    <p>Your institutional account has been successfully created. You can now access the faculty and administrative dashboards.</p>
    
    <table class="data-table" role="presentation" border="0" cellpadding="0" cellspacing="0">
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
            <td>{staff_email}</td>
        </tr>
        <tr>
            <td>Temporary Password</td>
            <td><code style="background:#f1f5f9; padding:4px 8px; border-radius:4px; font-size: 15px; color:#0f172a;">{raw_password}</code></td>
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
    
    changes_html = "".join([f"<tr><td>{k.replace('_', ' ').title()}</td><td>{v}</td></tr>" for k, v in changes.items()])
    
    content = f"""
    <p>Dear {staff_name},</p>
    <p>Your institutional profile has been recently updated by the administrator. Please review the changes below:</p>
    
    <table class="data-table">
        {changes_html}
    </table>
    """
    
    html_body = generate_professional_template(title, content)
    send_email(staff_email, "Account Profile Updated", html_body=html_body)


def notify_password_changed(staff_email: str, staff_name: str):
    title = "Password Changed Successfully"
    content = f"""
    <p>Dear {staff_name},</p>
    <p>This is a confirmation that your password was successfully changed.</p>
    <p>If you did not perform this action, please contact the system administrator immediately to secure your account.</p>
    """
    html_body = generate_professional_template(title, content)
    send_email(staff_email, "Security Alert: Password Changed", html_body=html_body)


def notify_forgot_password_otp(staff_email: str, otp: str):
    title = "Password Recovery OTP"
    content = f"""
    <p>A password recovery request was initiated for your account.</p>
    <p>Use the following 6-digit One Time Password (OTP) to reset your password:</p>
    
    <div style="text-align: center; margin: 30px 0;">
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e293b; background: #f1f5f9; padding: 20px; border-radius: 8px; display: inline-block;">
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
    <p>Dear {student_name},</p>
    <p>Your student profile has been registered in the LeetCode Tracker System.</p>
    
    <table class="data-table">
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
    changes_html = "".join([f"<tr><td>{k.replace('_', ' ').title()}</td><td>{v}</td></tr>" for k, v in changes.items()])
    
    content = f"""
    <p>Dear {recipient_name},</p>
    <p>The institutional record for student <strong>{student_name} ({reg_no})</strong> has been updated.</p>
    
    <table class="data-table">
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
        s = students[0]
        content = f"""
        <p>Dear {faculty_name},</p>
        <p>A new student has been assigned to your mentoring portfolio.</p>
        <table class="data-table">
            <tr><td>Name</td><td>{s.get('name')}</td></tr>
            <tr><td>Register Number</td><td>{s.get('reg_no')}</td></tr>
            <tr><td>Department</td><td>{s.get('department')}</td></tr>
        </table>
        """
    else:
        content = f"""
        <p>Dear {faculty_name},</p>
        <p><strong>{len(students)} students</strong> have been newly assigned to your mentoring portfolio.</p>
        <p>Please log in to the faculty portal to review your updated student list.</p>
        """
        
    portal_url = f"{settings.FRONTEND_ORIGIN}/faculty"
    action_button = f'<a href="{portal_url}" class="btn">View Portfolio</a>'
    
    html_body = generate_professional_template(title, content, action_button)
    send_email(faculty_email, "Student Allocation Updated", html_body=html_body)


def notify_faculty_unallocation(faculty_email: str, faculty_name: str, students: List[dict]):
    if not students:
        return
        
    title = "Student Mentorship Removed"
    
    if len(students) == 1:
        s = students[0]
        content = f"""
        <p>Dear {faculty_name},</p>
        <p>The following student has been removed from your mentoring portfolio.</p>
        <table class="data-table">
            <tr><td>Name</td><td>{s.get('name')}</td></tr>
            <tr><td>Register Number</td><td>{s.get('reg_no')}</td></tr>
            <tr><td>Department</td><td>{s.get('department')}</td></tr>
        </table>
        """
    else:
        content = f"""
        <p>Dear {faculty_name},</p>
        <p><strong>{len(students)} students</strong> have been removed from your mentoring portfolio.</p>
        """
        
    html_body = generate_professional_template(title, content)
    send_email(faculty_email, "Student Mentorship Updated", html_body=html_body)
