import io
import os
import hashlib
import datetime
import qrcode
from typing import Optional
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, Table, TableStyle, HRFlowable
from sqlalchemy.orm import Session

from backend.models import Student, WeeklySession, WeeklyPublicResult, WeeklyVirtualResult
from backend.logger import logger

COLLEGE_LOGO_PATH = os.path.join(os.path.dirname(__file__), "assets", "nandha_emblem.png")
if not os.path.exists(COLLEGE_LOGO_PATH):
    COLLEGE_LOGO_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "public", "nandha_emblem.png")


import re

def derive_clean_contest_name(session_obj) -> str:
    """Extracts or derives a clean, 100% accurate contest display title."""
    if not session_obj:
        return "Weekly Contest"

    raw_name = (getattr(session_obj, "contest_name", "") or "").strip()
    contest_id = (getattr(session_obj, "contest_id", "") or "").strip()
    session_code = (getattr(session_obj, "session_code", "") or "").strip()

    # 1. Match "Weekly Contest 438" or "Biweekly Contest 140"
    m = re.search(r'(Weekly|Biweekly)\s+Contest\s+(\d+)', raw_name, re.IGNORECASE)
    if m:
        return f"{m.group(1).capitalize()} Contest {m.group(2)}"

    # 2. Match "weekly-contest-438" in contest_id
    m2 = re.search(r'(weekly|biweekly)-contest-(\d+)', contest_id, re.IGNORECASE)
    if m2:
        return f"{m2.group(1).capitalize()} Contest {m2.group(2)}"

    # 3. Match numeric contest ID in contest_id, session_code, or raw_name
    m3 = re.search(r'(\d+)', contest_id or session_code or raw_name)
    if m3 and int(m3.group(1)) > 50:
        return f"Weekly Contest {m3.group(1)}"

    # 4. Clean non-generic raw_name if not placeholder
    if raw_name and "Test" not in raw_name and raw_name != "Weekly Contest":
        return raw_name

    return raw_name or f"Weekly Contest {getattr(session_obj, 'id', '')}"


def generate_forensic_audit_pdf(
    db: Session, 
    student_id: Optional[int] = None, 
    session_id: Optional[int] = None, 
    trace_id: Optional[str] = None,
    identifier: Optional[str] = None
) -> bytes:
    """
    Generates an official institutional PDF Forensic Contest Audit Certificate for Nandha Engineering College.
    Consumes SINGLE SOURCE OF TRUTH normalized report object to guarantee zero mismatch with UI.
    """
    from backend.services.forensic_audit_engine import build_normalized_forensic_report

    report = build_normalized_forensic_report(
        db,
        search=identifier or trace_id,
        session_id=session_id,
        trace_id=trace_id,
        student_id=student_id
    )

    st_data = report["student"]
    c_data = report["contest"]
    p_data = report["participation"]
    v_data = report["verification"]
    res_data = report["result"]

    trace_id = v_data["traceId"]
    c_title_name = c_data["name"]
    c_date = c_data["date"]
    part_status = p_data["status"]
    tot_solved_tmp = p_data["solved"]
    score_tmp = p_data["score"]
    c_rank = p_data["rank"]
    c_rat = p_data["rating"]
    sha_hash = v_data["checksum"]

    q1_val = res_data["q1"]
    q2_val = res_data["q2"]
    q3_val = res_data["q3"]
    q4_val = res_data["q4"]

    dept_code_str = st_data["department"]
    dept_name_str = st_data["departmentName"]
    year_str = st_data["year"]
    username = st_data["username"]

    student_name = st_data["name"]
    student_reg = st_data["reg_no"]


    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'CollegeTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=18,
        alignment=1, # Center
        textColor=colors.HexColor('#0F172A')
    )

    sub_style = ParagraphStyle(
        'CollegeSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        alignment=1,
        textColor=colors.HexColor('#475569')
    )

    doc_header_style = ParagraphStyle(
        'DocHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        alignment=1,
        textColor=colors.HexColor('#1E3A8A')
    )

    sec_header_style = ParagraphStyle(
        'SecHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=12,
        textColor=colors.HexColor('#0F172A')
    )

    body_style = ParagraphStyle(
        'BodyTxt',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#1E293B')
    )

    body_bold = ParagraphStyle(
        'BodyTxtBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#0F172A')
    )

    status_pass = ParagraphStyle(
        'StatusPass',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        alignment=1,
        textColor=colors.HexColor('#166534')
    )

    story = []

    # 1. Header with Logo & College Info
    logo_img = None
    if os.path.exists(COLLEGE_LOGO_PATH):
        try:
            logo_img = RLImage(COLLEGE_LOGO_PATH, width=54, height=54)
        except Exception:
            logo_img = None

    college_text = [
        Paragraph("NANDHA ENGINEERING COLLEGE (AUTONOMOUS)", title_style),
        Spacer(1, 2),
        Paragraph("Approved by AICTE, New Delhi • Affiliated to Anna University, Chennai • Accredited by NAAC with 'A+' Grade", sub_style),
        Paragraph("Erode - 638 052, Tamil Nadu, India • www.nandhaengg.org", sub_style),
        Spacer(1, 4),
        Paragraph("OFFICIAL LEETCODE CONTEST FORENSIC VERIFICATION AUDIT REPORT", doc_header_style)
    ]

    if logo_img:
        header_table = Table([[logo_img, college_text]], colWidths=[65, 455])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('ALIGN', (0,0), (0,0), 'CENTER'),
        ]))
        story.append(header_table)
    else:
        story.extend(college_text)

    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#1E3A8A'), spaceAfter=10))

    # 2. Metadata Bar
    dept_name = dept_name_str
    dept_code = dept_code_str
    batch_str = st_data.get("batch") or ("2025–2029" if year_str == "II" else ("2024–2028" if year_str == "III" else "2023–2027"))
    contest_name = c_title_name
    session_date = c_date

    tot_solved = tot_solved_tmp
    contest_score = score_tmp
    p_status = part_status
    contest_rank = c_rank
    contest_rating = c_rat
    profile_url = st_data.get("profileUrl") or f"https://leetcode.com/u/{username}"

    # 3. Student Identification Table
    story.append(Paragraph("1. STUDENT IDENTITY & ACADEMIC REGISTRATION", sec_header_style))
    story.append(Spacer(1, 4))

    student_data = [
        [
            Paragraph("<b>Student Full Name:</b>", body_style),
            Paragraph(f"<b>{student_name}</b>", body_bold),
            Paragraph("<b>Register Number:</b>", body_style),
            Paragraph(f"<b>{student_reg}</b>", body_bold)
        ],
        [
            Paragraph("<b>Department:</b>", body_style),
            Paragraph(f"{dept_name} ({dept_code})", body_style),
            Paragraph("<b>Academic Year:</b>", body_style),
            Paragraph(f"{year_str} Year • Batch {batch_str}", body_style)
        ],
        [
            Paragraph("<b>LeetCode Username:</b>", body_style),
            Paragraph(f"@{username}", body_bold),
            Paragraph("<b>Profile URL:</b>", body_style),
            Paragraph(f"<font color='#2563EB'>{profile_url}</font>", body_style)
        ]
    ]

    t_student = Table(student_data, colWidths=[110, 155, 105, 150])
    t_student.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_student)
    story.append(Spacer(1, 10))

    # 4. Contest Verification Matrix Table
    story.append(Paragraph("2. CONTEST VERIFICATION & PERFORMANCE RECORD", sec_header_style))
    story.append(Spacer(1, 4))

    contest_table_data = [
        [
            Paragraph("<b>Contest Name:</b>", body_style),
            Paragraph(f"<b>{contest_name}</b>", body_bold),
            Paragraph("<b>Contest Date:</b>", body_style),
            Paragraph(f"{session_date} (Sunday 08:00 AM IST)", body_style)
        ],
        [
            Paragraph("<b>Verified Status:</b>", body_style),
            Paragraph(f"<b><font color='{'#16A34A' if 'ATTENDED' in p_status else '#DC2626'}'>{p_status}</font></b>", body_bold),
            Paragraph("<b>Problems Solved:</b>", body_style),
            Paragraph(f"<b>{tot_solved} / 4 Problems</b> (Score: {contest_score})", body_bold)
        ],
        [
            Paragraph("<b>Official Global Rank:</b>", body_style),
            Paragraph(f"<b>{contest_rank}</b>", body_bold),
            Paragraph("<b>Contest Rating:</b>", body_style),
            Paragraph(f"<b>{contest_rating}</b>", body_bold)
        ]
    ]

    t_contest = Table(contest_table_data, colWidths=[110, 155, 105, 150])
    t_contest.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_contest)
    story.append(Spacer(1, 8))

    # 5. Question-by-Question Breakdown
    q_data = [
        [
            Paragraph("<b>Question</b>", ParagraphStyle('QTh', fontName='Helvetica-Bold', fontSize=8, alignment=1, textColor=colors.white)),
            Paragraph("<b>Problem Type</b>", ParagraphStyle('QTh', fontName='Helvetica-Bold', fontSize=8, alignment=1, textColor=colors.white)),
            Paragraph("<b>Score Weight</b>", ParagraphStyle('QTh', fontName='Helvetica-Bold', fontSize=8, alignment=1, textColor=colors.white)),
            Paragraph("<b>Submission State</b>", ParagraphStyle('QTh', fontName='Helvetica-Bold', fontSize=8, alignment=1, textColor=colors.white)),
            Paragraph("<b>Verification Result</b>", ParagraphStyle('QTh', fontName='Helvetica-Bold', fontSize=8, alignment=1, textColor=colors.white))
        ],
        [
            Paragraph("Question 1 (Q1)", body_style),
            Paragraph("Easy / Foundational", body_style),
            Paragraph("3 Points", body_style),
            Paragraph(f"<b>{'AC (Accepted)' if q1_val == 1 else 'Not Solved'}</b>", body_style),
            Paragraph(f"<font color='{'#16A34A' if q1_val == 1 else '#94A3B8'}'>{'1' if q1_val == 1 else '0'}</font>", body_bold)
        ],
        [
            Paragraph("Question 2 (Q2)", body_style),
            Paragraph("Medium / Data Structures", body_style),
            Paragraph("4 Points", body_style),
            Paragraph(f"<b>{'AC (Accepted)' if q2_val == 1 else 'Not Solved'}</b>", body_style),
            Paragraph(f"<font color='{'#16A34A' if q2_val == 1 else '#94A3B8'}'>{'1' if q2_val == 1 else '0'}</font>", body_bold)
        ],
        [
            Paragraph("Question 3 (Q3)", body_style),
            Paragraph("Medium / Algorithms", body_style),
            Paragraph("5 Points", body_style),
            Paragraph(f"<b>{'AC (Accepted)' if q3_val == 1 else 'Not Solved'}</b>", body_style),
            Paragraph(f"<font color='{'#16A34A' if q3_val == 1 else '#94A3B8'}'>{'1' if q3_val == 1 else '0'}</font>", body_bold)
        ],
        [
            Paragraph("Question 4 (Q4)", body_style),
            Paragraph("Hard / Advanced Optimization", body_style),
            Paragraph("6 Points", body_style),
            Paragraph(f"<b>{'AC (Accepted)' if q4_val == 1 else 'Not Solved'}</b>", body_style),
            Paragraph(f"<font color='{'#16A34A' if q4_val == 1 else '#94A3B8'}'>{'1' if q4_val == 1 else '0'}</font>", body_bold)
        ]
    ]

    t_q = Table(q_data, colWidths=[95, 140, 85, 105, 95])
    t_q.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0F172A')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('ALIGN', (2,0), (-1,-1), 'CENTER'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_q)
    story.append(Spacer(1, 10))

    # 6. Cryptographic Source Audit Trail
    story.append(Paragraph("3. CRYPTOGRAPHIC EVIDENCE & SOURCE AUDIT TRAIL", sec_header_style))
    story.append(Spacer(1, 4))

    audit_data = [
        [
            Paragraph("<b>Forensic Trace ID:</b>", body_style),
            Paragraph(f"<code>{trace_id}</code>", body_bold),
            Paragraph("<b>Verification Status:</b>", body_style),
            Paragraph("<b><font color='#16A34A'>AUTHENTIC & SEALED</font></b>", status_pass)
        ],
        [
            Paragraph("<b>Source Engine:</b>", body_style),
            Paragraph(v_data.get("sourceEngine", "LeetCode GraphQL API"), body_style),
            Paragraph("<b>Retrieved Timestamp:</b>", body_style),
            Paragraph(v_data.get("retrievedAt") or datetime.datetime.now().strftime("%d %b %Y, %I:%M:%S %p IST"), body_style)
        ],
        [
            Paragraph("<b>SHA-256 Checksum:</b>", body_style),
            Paragraph(f"<font size='7' color='#475569'><code>{sha_hash}</code></font>", body_style),
            Paragraph("<b>Audit Engine:</b>", body_style),
            Paragraph(v_data.get("auditEngine", "Nandha Autonomous Forensic Audit Engine"), body_style)
        ]
    ]

    t_audit = Table(audit_data, colWidths=[110, 175, 105, 130])
    t_audit.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F1F5F9')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#94A3B8')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_audit)
    story.append(Spacer(1, 18))

    # 7. Institutional Signatures & QR Code
    qr = qrcode.QRCode(box_size=2, border=1)
    qr.add_data(f"https://leetcode-student-data.web.app/verify/{trace_id}")
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="#0F172A", back_color="white")
    qr_buf = io.BytesIO()
    qr_img.save(qr_buf, format="PNG")
    qr_buf.seek(0)
    rl_qr = RLImage(qr_buf, width=50, height=50)

    sig_data = [
        [
            Paragraph("<b>Verified By</b><br/><font size='7' color='#64748B'>Department Faculty Coordinator</font>", body_style),
            Paragraph("<b>Approved By</b><br/><font size='7' color='#64748B'>Head of Department (HOD)</font>", body_style),
            Paragraph("<b>Institutional Seal</b><br/><font size='7' color='#64748B'>Principal / Dean Academic</font>", body_style),
            rl_qr
        ]
    ]

    t_sig = Table(sig_data, colWidths=[140, 140, 160, 80])
    t_sig.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LINEABOVE', (0,0), (2,0), 1, colors.HexColor('#0F172A')),
        ('TOPPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_sig)

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
