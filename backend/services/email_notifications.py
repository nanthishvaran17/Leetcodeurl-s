import logging
from typing import Optional, List
from pydantic import BaseModel
from backend.services.email_service import send_email
from backend.config import settings

logger = logging.getLogger(__name__)

def generate_professional_template(title: str, content: str, action_button: Optional[str] = None) -> str:
    """
    Generates a standardized professional HTML email wrapper with institutional branding.
    """
    button_html = f"""
    <div style="text-align: center; margin: 30px 0;">
        {action_button}
    </div>
    """ if action_button else ""

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {{
                font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #f4f7f6;
                color: #333333;
                margin: 0;
                padding: 0;
            }}
            .container {{
                max-width: 600px;
                margin: 40px auto;
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
            .header h1 {{
                color: #ffffff;
                margin: 0;
                font-size: 20px;
                letter-spacing: 0.5px;
            }}
            .content {{
                padding: 32px 24px;
                line-height: 1.6;
                font-size: 15px;
            }}
            .footer {{
                background-color: #f8fafc;
                padding: 20px 24px;
                text-align: center;
                font-size: 13px;
                color: #64748b;
                border-top: 1px solid #e2e8f0;
            }}
            .btn {{
                display: inline-block;
                background-color: #3b82f6;
                color: #ffffff !important;
                text-decoration: none;
                padding: 12px 24px;
                border-radius: 6px;
                font-weight: 600;
                font-size: 15px;
            }}
            .data-table {{
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
            }}
            .data-table td {{
                padding: 8px 0;
                border-bottom: 1px solid #f1f5f9;
            }}
            .data-table td:first-child {{
                font-weight: 600;
                color: #475569;
                width: 40%;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>{settings.COLLEGE_NAME}</h1>
            </div>
            <div class="content">
                <h2 style="color: #1e293b; margin-top: 0;">{title}</h2>
                {content}
                {button_html}
            </div>
            <div class="footer">
                <p>This is an automated notification from the LeetCode Tracker System.</p>
                <p>&copy; {settings.COLLEGE_NAME}. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """

def notify_staff_created(staff_email: str, staff_name: str, role: str, department: str, raw_password: str):
    """Sends a welcome email with credentials to newly created staff."""
    title = "Welcome to the LeetCode Tracker System"
    portal_url = f"{settings.FRONTEND_ORIGIN}/login"
    
    content = f"""
    <p>Dear {staff_name},</p>
    <p>Your institutional account has been successfully created. You can now access the faculty and administrative dashboards.</p>
    
    <table class="data-table">
        <tr><td>Name</td><td>{staff_name}</td></tr>
        <tr><td>Role</td><td>{role}</td></tr>
        <tr><td>Department</td><td>{department or "N/A"}</td></tr>
        <tr><td>Username / Email</td><td>{staff_email}</td></tr>
        <tr><td>Temporary Password</td><td><code style="background:#f1f5f9;padding:4px 8px;border-radius:4px;">{raw_password}</code></td></tr>
    </table>
    
    <p><strong>Security Notice:</strong> Please log in and change your password immediately upon your first access.</p>
    """
    
    action_button = f'<a href="{portal_url}" class="btn">Access Portal</a>'
    html_body = generate_professional_template(title, content, action_button)
    
    logger.info(f"[NOTIFY] Sending staff creation email to {staff_email}")
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
