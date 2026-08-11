"""
mailer.py — Sends the weekly report email with Excel + PDF attachments.
Uses Gmail SMTP (TLS) with exponential backoff on SMTP failures.
"""
import logging
import smtplib
import time
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Optional

import config

log = logging.getLogger(__name__)


# ─── HTML email template ──────────────────────────────────────────────────────

def _html_body(
    recipient_name: str,
    recipient_role: str,
    analysis: dict,
    settings: dict,
) -> str:
    student   = settings.get("student", {})
    s_name    = student.get("name", "Student")
    s_reg     = student.get("reg_no", "")
    s_dept    = student.get("department", "CSE (Cyber Security)")
    contest   = analysis.get("latest_title", "Latest Contest")
    rating    = analysis.get("current_rating") or 0
    rd        = analysis.get("rating_delta")
    rank      = analysis.get("current_ranking") or 0
    solved    = analysis.get("problems_solved") or 0
    total     = analysis.get("total_problems") or 4
    streak    = analysis.get("streak", 0)
    narrative = analysis.get("narrative", "")
    milestones = analysis.get("milestones_crossed") or []

    delta_html = ""
    if rd is not None:
        color = "#1DB954" if rd >= 0 else "#E53935"
        sign  = "▲" if rd >= 0 else "▼"
        delta_html = f'<span style="color:{color};font-weight:bold">{sign} {abs(rd):.0f}</span>'

    milestone_html = ""
    for m in milestones:
        milestone_html += f"""
        <tr>
          <td colspan="2" style="padding:10px;background:#FFF9E6;border-radius:6px;
                                  color:#F5B800;font-weight:bold;font-size:14px;">
            🎉 Rating milestone crossed: {m}! Outstanding achievement.
          </td>
        </tr>"""

    weak_tags = analysis.get("weak_tags") or []
    tag_rows = ""
    for t in weak_tags[:5]:
        bar_w = min(int(t["accuracy"]), 100)
        bar_c = "#E53935" if t["accuracy"] < 50 else "#F5B800" if t["accuracy"] < 75 else "#1DB954"
        tag_rows += f"""
        <tr>
          <td style="padding:6px 8px;font-size:12px;">{t['tag']}</td>
          <td style="padding:6px 8px;">
            <div style="background:#eee;border-radius:4px;height:10px;width:100%">
              <div style="background:{bar_c};width:{bar_w}%;height:10px;border-radius:4px"></div>
            </div>
          </td>
          <td style="padding:6px 8px;font-size:12px;color:{bar_c};font-weight:bold">{t['accuracy']}%</td>
        </tr>"""

    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LeetCode Weekly Contest Report</title>
</head>
<body style="margin:0;padding:0;background:#F0F4FA;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F4FA;padding:24px 0;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(27,42,74,0.10);">

        <!-- Header -->
        <tr>
          <td style="background:#1B2A4A;padding:28px 32px;">
            <p style="margin:0;font-size:11px;color:#F5B800;font-weight:700;
                      letter-spacing:2px;text-transform:uppercase;">
              Nandha Engineering College • {s_dept}
            </p>
            <h1 style="margin:8px 0 4px;font-size:22px;color:#ffffff;font-weight:800;">
              LeetCode Weekly Contest Report
            </h1>
            <p style="margin:0;font-size:13px;color:#B0BEC5;">
              {contest}
            </p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:28px 32px 0;">
            <p style="font-size:14px;color:#333;line-height:1.7;">
              Dear <strong>{recipient_name}</strong> ({recipient_role}),
            </p>
            <p style="font-size:13px;color:#555;line-height:1.7;">
              Please find attached the latest weekly LeetCode performance report workbooks,
              contest matrix and executive PDF summary for your review.
            </p>
          </td>
        </tr>

        <!-- KPI tiles -->
        <tr>
          <td style="padding:20px 32px;">
            <table width="100%" cellpadding="0" cellspacing="8">
              <tr>
                <td width="25%" style="background:#F0F4FA;border-radius:8px;
                                        padding:14px 10px;text-align:center;
                                        border:1px solid #D0D9EC;">
                  <div style="font-size:10px;color:#B0BEC5;font-weight:700;
                               text-transform:uppercase;letter-spacing:1px;">Rating</div>
                  <div style="font-size:26px;font-weight:800;color:#1B2A4A;margin:4px 0;">
                    {rating:.0f}
                  </div>
                  <div>{delta_html}</div>
                </td>
                <td width="25%" style="background:#F0F4FA;border-radius:8px;
                                        padding:14px 10px;text-align:center;
                                        border:1px solid #D0D9EC;">
                  <div style="font-size:10px;color:#B0BEC5;font-weight:700;
                               text-transform:uppercase;letter-spacing:1px;">Global Rank</div>
                  <div style="font-size:20px;font-weight:800;color:#1B2A4A;margin:4px 0;">
                    #{rank:,}
                  </div>
                </td>
                <td width="25%" style="background:#F0F4FA;border-radius:8px;
                                        padding:14px 10px;text-align:center;
                                        border:1px solid #D0D9EC;">
                  <div style="font-size:10px;color:#B0BEC5;font-weight:700;
                               text-transform:uppercase;letter-spacing:1px;">Solved</div>
                  <div style="font-size:26px;font-weight:800;color:#1B2A4A;margin:4px 0;">
                    {solved}/{total}
                  </div>
                </td>
                <td width="25%" style="background:#F0F4FA;border-radius:8px;
                                        padding:14px 10px;text-align:center;
                                        border:1px solid #D0D9EC;">
                  <div style="font-size:10px;color:#B0BEC5;font-weight:700;
                               text-transform:uppercase;letter-spacing:1px;">Streak</div>
                  <div style="font-size:26px;font-weight:800;color:#1B2A4A;margin:4px 0;">
                    {streak}w 🔥
                  </div>
                </td>
              </tr>
              {milestone_html}
            </table>
          </td>
        </tr>

        <!-- Narrative -->
        <tr>
          <td style="padding:0 32px 20px;">
            <div style="background:#F8F9FF;border-left:4px solid #1B2A4A;
                         border-radius:0 8px 8px 0;padding:14px 16px;">
              <p style="margin:0;font-size:13px;color:#333;line-height:1.75;font-style:italic;">
                {narrative}
              </p>
            </div>
          </td>
        </tr>

        <!-- Student info -->
        <tr>
          <td style="padding:0 32px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#1B2A4A;border-radius:8px;">
              <tr>
                <td style="padding:12px 16px;">
                  <p style="margin:0;font-size:12px;color:#B0BEC5;">Student</p>
                  <p style="margin:2px 0 0;font-size:14px;font-weight:700;color:#fff;">
                    {s_name} — {s_reg}
                  </p>
                </td>
                <td style="padding:12px 16px;">
                  <p style="margin:0;font-size:12px;color:#B0BEC5;">Department</p>
                  <p style="margin:2px 0 0;font-size:14px;font-weight:700;color:#fff;">
                    {s_dept}
                  </p>
                </td>
                <td style="padding:12px 16px;">
                  <p style="margin:0;font-size:12px;color:#B0BEC5;">LeetCode</p>
                  <p style="margin:2px 0 0;">
                    <a href="https://leetcode.com/u/{student.get('leetcode_username', '')}"
                       style="font-size:13px;font-weight:700;color:#F5B800;
                              text-decoration:none;">
                      {student.get('leetcode_username', config.LEETCODE_USERNAME)}
                    </a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        {"<!-- Tag weakness -->" + _tag_section_html(tag_rows) if tag_rows else ""}

        <!-- Footer -->
        <tr>
          <td style="background:#F0F4FA;border-top:1px solid #D0D9EC;
                      padding:16px 32px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#B0BEC5;">
              This report was automatically generated by the NEC LeetCode Contest Reporter.<br>
              Data sourced from the LeetCode Public GraphQL API.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
"""


def _tag_section_html(tag_rows: str) -> str:
    if not tag_rows:
        return ""
    return f"""
        <tr>
          <td style="padding:0 32px 20px;">
            <p style="font-size:12px;font-weight:700;color:#1B2A4A;
                       text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">
              Topic Weakness (Lowest Accuracy)
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid #D0D9EC;border-radius:8px;overflow:hidden;">
              <tr style="background:#1B2A4A;">
                <th style="padding:8px;font-size:11px;color:#fff;text-align:left;">Tag</th>
                <th style="padding:8px;font-size:11px;color:#fff;text-align:left;width:50%">Progress</th>
                <th style="padding:8px;font-size:11px;color:#fff;">Accuracy</th>
              </tr>
              {tag_rows}
            </table>
          </td>
        </tr>"""


# ─── Send email ────────────────────────────────────────────────────────────────

def send_report(
    analysis:      dict,
    settings:      dict,
    excel_path:    Path,
    pdf_path:      Path,
    recipients:    list[dict],  # [{name, email, role}]
    test_only:     bool = False,  # if True, send only to first recipient
) -> list[str]:
    """
    Sends the report to each recipient in the list.
    Returns list of successfully emailed addresses.
    """
    if test_only:
        recipients = recipients[:1]
        log.info("[MAILER] Test mode — sending to first recipient only.")

    contest = analysis.get("latest_title", "LeetCode Contest")
    student = settings.get("student", {})
    sent_to = []

    for recipient in recipients:
        r_name  = recipient.get("name", "Faculty")
        r_email = recipient.get("email")
        r_role  = recipient.get("role", "Faculty")

        if not r_email:
            log.warning(f"[MAILER] Skipping recipient with no email: {r_name}")
            continue

        msg = MIMEMultipart("alternative")
        msg["Subject"] = (
            f"[LeetCode Report] {student.get('name', 'Student')} — {contest}"
        )
        msg["From"]    = f"{config.SENDER_NAME} <{config.SMTP_USER}>"
        msg["To"]      = r_email

        html = _html_body(r_name, r_role, analysis, settings)
        msg.attach(MIMEText(html, "html", "utf-8"))

        # Attach Excel
        _attach_file(msg, excel_path, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        # Attach PDF
        _attach_file(msg, pdf_path, "application/pdf")

        _smtp_send_with_retry(msg, r_email)
        sent_to.append(r_email)
        log.info(f"[MAILER] ✅ Sent to {r_name} <{r_email}>")

    return sent_to


def _attach_file(msg: MIMEMultipart, path: Path, mime_type: str) -> None:
    maintype, subtype = mime_type.split("/", 1)
    with open(path, "rb") as f:
        part = MIMEApplication(f.read(), Name=path.name)
    part["Content-Disposition"] = f'attachment; filename="{path.name}"'
    part["Content-Type"] = f"{mime_type}; name=\"{path.name}\""
    msg.attach(part)


def _smtp_send_with_retry(msg: MIMEMultipart, to_addr: str, retries: int = 3) -> None:
    delay = 5.0
    for attempt in range(1, retries + 1):
        try:
            with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=30) as smtp:
                smtp.ehlo()
                smtp.starttls()
                smtp.ehlo()
                smtp.login(config.SMTP_USER, config.SMTP_PASSWORD)
                smtp.sendmail(config.SMTP_USER, to_addr, msg.as_string())
            return
        except Exception as exc:
            log.warning(f"[MAILER] Attempt {attempt}/{retries} failed for {to_addr}: {exc}")
            if attempt < retries:
                time.sleep(delay)
                delay *= 2
    raise RuntimeError(f"[MAILER] All {retries} SMTP attempts failed for {to_addr}")
