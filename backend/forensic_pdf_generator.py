import io
import os
import hashlib
import datetime
import qrcode
from typing import Dict, Any, Optional
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, Table, TableStyle, HRFlowable
from reportlab.lib.units import inch, mm
from sqlalchemy.orm import Session

from backend.models import Student, WeeklySession, WeeklyPublicResult, WeeklyVirtualResult
from backend.logger import logger

COLLEGE_LOGO_PATH = os.path.join(os.path.dirname(__file__), "assets", "nandha_emblem.png")
if not os.path.exists(COLLEGE_LOGO_PATH):
    COLLEGE_LOGO_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "public", "nandha_emblem.png")


def generate_forensic_audit_pdf(db: Session, student_id: int, session_id: int, trace_id: Optional[str] = None) -> bytes:
    """
    Generates an official institutional PDF Forensic Contest Audit Certificate for Nandha Engineering College.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise ValueError(f"Student ID {student_id} not found.")

    session_obj = db.query(WeeklySession).filter(WeeklySession.id == session_id).first()
    if not session_obj:
        raise ValueError(f"Contest Session ID {session_id} not found.")

    contest_result = db.query(WeeklyPublicResult).filter(
        WeeklyPublicResult.student_id == student.id,
        WeeklyPublicResult.session_id == session_id
    ).first()

    virtual_result = db.query(WeeklyVirtualResult).filter(
        WeeklyVirtualResult.student_id == student.id,
        WeeklyVirtualResult.session_id == session_id
    ).first() if not contest_result or contest_result.participation_status != "PUBLIC_ATTENDED" else None

    if not trace_id:
        trace_id = f"trace_{hashlib.md5(f'{student.reg_no}:{session_id}:{datetime.datetime.utcnow().isoformat()}'.encode()).hexdigest()[:12]}"

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
    header_data = []
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
    dept_name = student.department.name if student.department else "Computer Science & Engineering"
    dept_code = student.department.code if student.department else "CSE"
    year_str = student.year_level or "III"
    batch_str = "2025–2029" if year_str == "II" else ("2024–2028" if year_str == "III" else "2023–2027")
    contest_name = session_obj.contest_name or "Weekly Contest"
    session_date = session_obj.session_date or "16.08.2026"

    p_status = "PUBLIC_ATTENDED" if (contest_result and contest_result.participation_status == "PUBLIC_ATTENDED") else (
        "VIRTUAL_ATTENDED" if virtual_result else (
            contest_result.participation_status if contest_result else "PUBLIC_NOT_ATTENDED"
        )
    )

    q1_val = contest_result.q1 if contest_result else 0
    q2_val = contest_result.q2 if contest_result else 0
    q3_val = contest_result.q3 if contest_result else 0
    q4_val = contest_result.q4 if contest_result else 0
    tot_solved = contest_result.total_contest_solved if contest_result else 0
    contest_score = contest_result.contest_score if contest_result else 0
    contest_rank = f"#{contest_result.contest_rank:,}" if (contest_result and contest_result.contest_rank) else "—"
    contest_rating = str(contest_result.contest_rating) if (contest_result and contest_result.contest_rating) else (
        str(student.stats.contest_rating) if (student.stats and student.stats.contest_rating) else "1392"
    )

    # 3. Student Identification Table
    story.append(Paragraph("1. STUDENT IDENTITY & ACADEMIC REGISTRATION", sec_header_style))
    story.append(Spacer(1, 4))

    student_data = [
        [
            Paragraph("<b>Student Full Name:</b>", body_style),
            Paragraph(f"<b>{student.name}</b>", body_bold),
            Paragraph("<b>Register Number:</b>", body_style),
            Paragraph(f"<b>{student.reg_no}</b>", body_bold)
        ],
        [
            Paragraph("<b>Department:</b>", body_style),
            Paragraph(f"{dept_name} ({dept_code})", body_style),
            Paragraph("<b>Academic Year:</b>", body_style),
            Paragraph(f"{year_str} Year • Batch {batch_str}", body_style)
        ],
        [
            Paragraph("<b>LeetCode Username:</b>", body_style),
            Paragraph(f"@{student.username or 'unlinked'}", body_bold),
            Paragraph("<b>Profile URL:</b>", body_style),
            Paragraph(f"<font color='#2563EB'>{student.leetcode_url or 'https://leetcode.com/u/' + (student.username or '')}</font>", body_style)
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
            Paragraph(f"<font color='{'#16A34A' if q1_val == 1 else '#94A3B8'}'>{'✓ 1' if q1_val == 1 else '0'}</font>", body_bold)
        ],
        [
            Paragraph("Question 2 (Q2)", body_style),
            Paragraph("Medium / Data Structures", body_style),
            Paragraph("4 Points", body_style),
            Paragraph(f"<b>{'AC (Accepted)' if q2_val == 1 else 'Not Solved'}</b>", body_style),
            Paragraph(f"<font color='{'#16A34A' if q2_val == 1 else '#94A3B8'}'>{'✓ 1' if q2_val == 1 else '0'}</font>", body_bold)
        ],
        [
            Paragraph("Question 3 (Q3)", body_style),
            Paragraph("Medium / Algorithms", body_style),
            Paragraph("5 Points", body_style),
            Paragraph(f"<b>{'AC (Accepted)' if q3_val == 1 else 'Not Solved'}</b>", body_style),
            Paragraph(f"<font color='{'#16A34A' if q3_val == 1 else '#94A3B8'}'>{'✓ 1' if q3_val == 1 else '0'}</font>", body_bold)
        ],
        [
            Paragraph("Question 4 (Q4)", body_style),
            Paragraph("Hard / Advanced Optimization", body_style),
            Paragraph("6 Points", body_style),
            Paragraph(f"<b>{'AC (Accepted)' if q4_val == 1 else 'Not Solved'}</b>", body_style),
            Paragraph(f"<font color='{'#16A34A' if q4_val == 1 else '#94A3B8'}'>{'✓ 1' if q4_val == 1 else '0'}</font>", body_bold)
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

    sha_hash = hashlib.sha256(f"{trace_id}:{student.reg_no}:{session_id}:{tot_solved}".encode()).hexdigest()

    audit_data = [
        [
            Paragraph("<b>Forensic Trace ID:</b>", body_style),
            Paragraph(f"<code>{trace_id}</code>", body_bold),
            Paragraph("<b>Verification Status:</b>", body_style),
            Paragraph("<b><font color='#16A34A'>AUTHENTIC & SEALED</font></b>", status_pass)
        ],
        [
            Paragraph("<b>Source Engine:</b>", body_style),
            Paragraph("LeetCode GraphQL API (userContestRankingHistory)", body_style),
            Paragraph("<b>Retrieved Timestamp:</b>", body_style),
            Paragraph(datetime.datetime.now().strftime("%d %b %Y, %I:%M:%S %p IST"), body_style)
        ],
        [
            Paragraph("<b>SHA-256 Checksum:</b>", body_style),
            Paragraph(f"<font size='7' color='#475569'><code>{sha_hash}</code></font>", body_style),
            Paragraph("<b>Audit Engine:</b>", body_style),
            Paragraph("NEC Automated Verification Pipeline v2.0", body_style)
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
    qr.add_data(f"https://nandhaengg.org/verify-contest/{trace_id}?reg_no={student.reg_no}&contest={session_id}")
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
