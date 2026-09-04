from typing import Optional
from backend.config import settings

def generate_professional_template(title: str, content: str, action_button: Optional[str] = None, fallback_url: Optional[str] = None) -> str:
    """
    Generates a standardized professional HTML email wrapper with institutional branding.
    Optimized for Gmail (Android/Mobile/Desktop), Outlook (Desktop/Web), Apple Mail, and mobile screens (320px-430px).
    """
    logo_url = "https://files.catbox.moe/ylpqjc.png"

    button_html = ""
    if action_button:
        # Check if action_button is a raw tag or full element
        if action_button.strip().startswith("<table") or action_button.strip().startswith("<div"):
            button_html = f"""
            <div style="margin: 28px 0; text-align: center;">
                {action_button}
            </div>
            """
        else:
            button_html = f"""
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0;">
                <tr>
                    <td align="center" style="padding: 0;">
                        {action_button}
                    </td>
                </tr>
            </table>
            """
        if fallback_url:
            button_html += f"""
            <div style="text-align: center; margin-top: 12px; font-size: 13px; color: #64748b; word-break: break-word; overflow-wrap: anywhere; line-height: 1.4;">
                Or copy and paste this link into your browser:<br>
                <a href="{fallback_url}" style="color: #3b82f6; text-decoration: underline; word-break: break-all;">{fallback_url}</a>
            </div>
            """

    return f"""<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>{title}</title>
    <!--[if mso]>
    <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
    </noscript>
    <![endif]-->
    <style type="text/css">
        body {{
            font-family: Arial, Helvetica, sans-serif;
            background-color: #f4f7f6;
            color: #333333;
            margin: 0;
            padding: 0;
            width: 100% !important;
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
        }}
        table {{
            border-collapse: collapse;
            mso-table-lspace: 0pt;
            mso-table-rspace: 0pt;
        }}
        img {{
            border: 0;
            height: auto;
            line-height: 100%;
            outline: none;
            text-decoration: none;
            -ms-interpolation-mode: bicubic;
            max-width: 100%;
            display: block;
        }}
        a {{
            color: #3b82f6;
            text-decoration: underline;
        }}
        .email-wrapper {{
            width: 100% !important;
            background-color: #f4f7f6;
            margin: 0;
            padding: 20px 0;
        }}
        .email-container {{
            width: 100% !important;
            max-width: 600px !important;
            margin: 0 auto !important;
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
            width: 140px;
            max-width: 140px;
            height: auto;
            margin: 0 auto 15px auto;
            display: block;
        }}
        .header h1 {{
            color: #ffffff !important;
            margin: 0;
            font-size: 18px;
            font-weight: 700;
            letter-spacing: 0.5px;
            line-height: 1.4;
            word-break: break-word;
            overflow-wrap: anywhere;
        }}
        .header .sub-header {{
            color: #38bdf8 !important;
            margin: 4px 0 0 0;
            font-size: 14px;
            font-weight: 500;
        }}
        .email-content {{
            padding: 32px 24px;
            line-height: 1.6;
            font-size: 15px;
            color: #1e293b;
            word-break: break-word;
            overflow-wrap: anywhere;
        }}
        .email-content h2 {{
            color: #0f172a;
            margin-top: 0;
            margin-bottom: 20px;
            font-size: 22px;
            line-height: 1.3;
            word-break: break-word;
            overflow-wrap: anywhere;
        }}
        .footer {{
            background-color: #f8fafc;
            padding: 24px;
            text-align: center;
            font-size: 12px;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
            line-height: 1.5;
            word-break: break-word;
            overflow-wrap: anywhere;
        }}
        .btn {{
            display: inline-block;
            background-color: #3b82f6;
            color: #ffffff !important;
            text-decoration: none !important;
            padding: 14px 28px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            text-align: center;
            min-height: 44px;
            line-height: 20px;
            box-sizing: border-box;
        }}
        .data-table {{
            width: 100% !important;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            border-collapse: separate;
            border-spacing: 0;
            margin: 24px 0;
            overflow: hidden;
            table-layout: auto;
        }}
        .data-table th, .data-table td {{
            padding: 12px 16px;
            border-bottom: 1px solid #e2e8f0;
            word-break: break-word;
            overflow-wrap: anywhere;
            font-size: 14px;
            line-height: 1.5;
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
            word-break: break-word;
            overflow-wrap: anywhere;
        }}
        /* Responsive styles for mobile devices */
        @media only screen and (max-width: 600px) {{
            .email-wrapper {{ padding: 0 !important; }}
            .email-container {{ width: 100% !important; max-width: 100% !important; border-radius: 0 !important; }}
            .email-content {{ padding: 20px 16px !important; font-size: 14px !important; }}
            .header {{ padding: 20px 16px !important; }}
            .header h1 {{ font-size: 16px !important; }}
            .email-content h2 {{ font-size: 18px !important; }}
            .footer {{ padding: 20px 16px !important; }}
            .btn {{ display: block !important; width: 100% !important; padding: 14px 12px !important; box-sizing: border-box !important; }}
            
            /* Enforcing 2-column layout on mobile */
            .data-table td {{
                box-sizing: border-box !important;
                padding: 10px 12px !important;
                font-size: 13px !important;
            }}
            .data-table td:first-child {{
                width: 35% !important;
                background-color: #f8fafc !important;
            }}
            .data-table td:nth-child(2) {{
                width: 65% !important;
            }}
        }}

        /* Dark mode overrides */
        @media (prefers-color-scheme: dark) {{
            body, .email-wrapper {{ background-color: #0f172a !important; color: #e2e8f0 !important; }}
            .email-container {{ background-color: #1e293b !important; color: #e2e8f0 !important; }}
            .email-content {{ color: #e2e8f0 !important; }}
            .email-content h2 {{ color: #ffffff !important; }}
            .footer {{ background-color: #0f172a !important; color: #94a3b8 !important; border-top-color: #334155 !important; }}
            .data-table {{ border-color: #334155 !important; }}
            .data-table td, .data-table th {{ border-bottom-color: #334155 !important; }}
            .data-table td:first-child {{ background-color: #0f172a !important; color: #cbd5e1 !important; border-right-color: #334155 !important; }}
            .security-notice {{ background-color: #451a03 !important; color: #fef3c7 !important; border-left-color: #f59e0b !important; }}
        }}

        /* Outlook OGSC Dark Mode targeting */
        [data-ogsc] .email-wrapper {{ background-color: #0f172a !important; }}
        [data-ogsc] .email-container {{ background-color: #1e293b !important; }}
        [data-ogsc] .email-content {{ color: #e2e8f0 !important; }}
        [data-ogsc] .email-content h2 {{ color: #ffffff !important; }}
        [data-ogsc] .footer {{ background-color: #0f172a !important; color: #94a3b8 !important; }}
        [data-ogsc] .data-table td:first-child {{ background-color: #0f172a !important; color: #cbd5e1 !important; }}
    </style>
</head>
<body style="background-color: #f4f7f6; margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-wrapper" style="background-color: #f4f7f6; margin: 0; padding: 20px 0; width: 100%;">
        <tr>
            <td align="center" style="padding: 0;">
                <!--[if mso]>
                <table role="presentation" align="center" border="0" cellpadding="0" cellspacing="0" width="600">
                <tr>
                <td>
                <![endif]-->
                <table role="presentation" class="email-container" align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                    <tr>
                        <td class="header" style="background-color: #0f172a; padding: 24px; text-align: center; border-bottom: 4px solid #3b82f6;">
                            <img src="{logo_url}" alt="{settings.COLLEGE_NAME} Logo" class="header-logo" width="140" height="auto" style="width:140px; max-width:140px; height:auto; margin:0 auto 15px auto; display:block; border:0; outline:none; text-decoration:none;" />
                            <h1 style="color: #ffffff; margin: 0; font-size: 18px; font-weight: 700; letter-spacing: 0.5px; line-height: 1.4; word-break: break-word; overflow-wrap: anywhere;">{settings.COLLEGE_NAME}</h1>
                            <div class="sub-header" style="color: #38bdf8; margin: 4px 0 0 0; font-size: 14px; font-weight: 500;">LeetCode Tracker System</div>
                        </td>
                    </tr>
                    <tr>
                        <td class="email-content" style="padding: 32px 24px; line-height: 1.6; font-size: 15px; color: #1e293b; word-break: break-word; overflow-wrap: anywhere;">
                            <h2 style="color: #0f172a; margin-top: 0; margin-bottom: 20px; font-size: 22px; line-height: 1.3; word-break: break-word; overflow-wrap: anywhere;">{title}</h2>
                            {content}
                            {button_html}
                        </td>
                    </tr>
                    <tr>
                        <td class="footer" style="background-color: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; line-height: 1.5; word-break: break-word; overflow-wrap: anywhere;">
                            <strong style="color: #475569;">{settings.COLLEGE_NAME}</strong><br>
                            LeetCode Tracker System<br><br>
                            This is an automated notification. Please do not reply directly to this email.
                        </td>
                    </tr>
                </table>
                <!--[if mso]>
                </td>
                </tr>
                </table>
                <![endif]-->
            </td>
        </tr>
    </table>
</body>
</html>
"""
