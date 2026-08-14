import io
import os
import uuid
import datetime
import qrcode
import html
import base64
from typing import Dict, Any, Optional
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle
from reportlab.lib.units import inch, mm
from sqlalchemy.orm import Session

from backend.config import settings
from backend.models import Student, CertificateRecord, AuthorizedSignature
from backend.logger import logger

CERT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "reports", "certificates")
os.makedirs(CERT_DIR, exist_ok=True)

COLLEGE_LOGO_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend", "assets", "nandha_emblem.png")
if not os.path.exists(COLLEGE_LOGO_PATH):
    COLLEGE_LOGO_PATH = os.path.join(os.path.dirname(__file__), "assets", "nandha_emblem.png")

DEPARTMENT_NAME_MAPPING = {
    "CSE(CS)": "Department of Computer Science and Engineering (Cyber Security)",
    "CSE-CS": "Department of Computer Science and Engineering (Cyber Security)",
    "CSE_CS": "Department of Computer Science and Engineering (Cyber Security)",
    "CYBER SECURITY": "Department of Computer Science and Engineering (Cyber Security)",
    "COMPUTER SCIENCE AND ENGINEERING (CYBER SECURITY)": "Department of Computer Science and Engineering (Cyber Security)",
    "CSE(IOT)": "Department of Computer Science and Engineering (IoT)",
    "CSE-IOT": "Department of Computer Science and Engineering (IoT)",
    "CSE_IOT": "Department of Computer Science and Engineering (IoT)",
    "IOT": "Department of Computer Science and Engineering (IoT)",
    "COMPUTER SCIENCE AND ENGINEERING (IOT)": "Department of Computer Science and Engineering (IoT)"
}


def resolve_department_name(dept_raw: Optional[str]) -> str:
    """Standardizes department string to official institutional title."""
    if not dept_raw:
        return "Department of Computer Science and Engineering"
    normalized = dept_raw.strip().upper()
    return DEPARTMENT_NAME_MAPPING.get(normalized, f"Department of {dept_raw.strip()}")


def draw_ornate_border(canvas, doc):
    """Draws an executive academic double navy & gold ornate certificate border for A4 landscape."""
    canvas.saveState()
    width, height = doc.pagesize # A4 landscape: 841.89 pt x 595.27 pt (297mm x 210mm)

    # 1. Background Warm Ivory tint
    canvas.setFillColor(colors.HexColor('#FCFCFA'))
    canvas.rect(0, 0, width, height, fill=1, stroke=0)

    # 2. Outer Deep Navy Border
    canvas.setStrokeColor(colors.HexColor('#0B192C'))
    canvas.setLineWidth(4.5)
    canvas.rect(20, 20, width - 40, height - 40)

    # 3. Inner Metallic Gold Line
    canvas.setStrokeColor(colors.HexColor('#C5A059'))
    canvas.setLineWidth(1.5)
    canvas.rect(26, 26, width - 52, height - 52)

    # 4. Refined Corner Ornaments
    corner_size = 14
    canvas.setFillColor(colors.HexColor('#C5A059'))
    # Top-Left
    canvas.rect(22, height - 22 - corner_size, corner_size, corner_size, fill=1, stroke=0)
    # Top-Right
    canvas.rect(width - 22 - corner_size, height - 22 - corner_size, corner_size, corner_size, fill=1, stroke=0)
    # Bottom-Left
    canvas.rect(22, 22, corner_size, corner_size, fill=1, stroke=0)
    # Bottom-Right
    canvas.rect(width - 22 - corner_size, 22, corner_size, corner_size, fill=1, stroke=0)

    # Corner Inner Diamonds
    canvas.setFillColor(colors.HexColor('#0B192C'))
    canvas.circle(29, height - 29, 3, fill=1, stroke=0)
    canvas.circle(width - 29, height - 29, 3, fill=1, stroke=0)
    canvas.circle(29, 29, 3, fill=1, stroke=0)
    canvas.circle(width - 29, 29, 3, fill=1, stroke=0)

    canvas.restoreState()


def get_active_signature(db: Session, sig_type: str, department_code: Optional[str] = None) -> Optional[AuthorizedSignature]:
    """Retrieves current active authorized signature record from database."""
    query = db.query(AuthorizedSignature).filter(
        AuthorizedSignature.is_active == True,
        AuthorizedSignature.signature_type == sig_type
    )
    if department_code and department_code != "ALL":
        query = query.filter(AuthorizedSignature.department.in_([department_code, "ALL"]))
    return query.order_by(AuthorizedSignature.id.desc()).first()


def generate_student_certificate(
    db: Session,
    student: Student,
    cert_type: str = "Top Performer",
    custom_date_str: Optional[str] = None,
    created_by: str = "Admin"
) -> Dict[str, Any]:
    """
    Generates a high-resolution, print-ready A4 Landscape PDF certificate with scannable QR verification,
    official college emblem, dynamic student metadata, and authorized signatures.
    """
    # 1. Authoritative Student & Department Validation
    raw_dept = student.department.code if student.department else "CSE(CS)"
    dept_full_title = resolve_department_name(raw_dept)
    
    # 2. Unique Verification ID & Production Verification URL
    cert_id = f"CERT-{uuid.uuid4().hex[:8].upper()}"
    verification_url = f"https://leetcode-student-data.web.app/verify/{cert_id}"
    
    # Date Display
    today_dt = datetime.date.today()
    issue_date_display = custom_date_str or today_dt.strftime("%b %d, %Y")

    # 3. Lookup Signatures
    principal_sig = get_active_signature(db, "PRINCIPAL")
    dept_sig_type = "HOD_CSE_IOT" if ("IOT" in raw_dept.upper()) else "HOD_CSE_CS"
    hod_sig = get_active_signature(db, dept_sig_type, raw_dept)

    principal_ver = principal_sig.version if principal_sig else "v1"
    hod_ver = hod_sig.version if hod_sig else "v1"

    # 4. Generate QR Code linking directly to production verification page
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=4,
        border=1
    )
    qr.add_data(verification_url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="#0B192C", back_color="white")
    
    qr_filename = f"{cert_id}_qr.png"
    qr_path = os.path.join(CERT_DIR, qr_filename)
    qr_img.save(qr_path)

    # 5. Persist Certificate Record in Database
    cert_record = CertificateRecord(
        verification_id=cert_id,
        certificate_type=cert_type,
        student_id=student.id,
        student_name=student.name,
        register_no=student.reg_no,
        department=raw_dept,
        department_name=dept_full_title,
        program="Institutional LeetCode Continuous Performance Tracking System",
        recognition="Top Performer",
        issue_date=issue_date_display,
        status="VALID",
        principal_signature_version=principal_ver,
        hod_signature_version=hod_ver,
        verification_url=verification_url,
        qr_path=qr_path,
        created_by=created_by
    )
    db.add(cert_record)
    db.commit()
    db.refresh(cert_record)

    # 6. Build High-Resolution A4 Landscape Document
    pdf_filename = f"{student.reg_no}_{cert_id}.pdf"
    pdf_path = os.path.join(CERT_DIR, pdf_filename)
    cert_record.pdf_path = pdf_path
    db.commit()

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=landscape(A4), # 841.89 pt x 595.27 pt (297mm x 210mm)
        rightMargin=36,
        leftMargin=36,
        topMargin=32,
        bottomMargin=32
    )

    story = []
    styles = getSampleStyleSheet()

    inst_title_style = ParagraphStyle(
        'InstTitle',
        fontName='Times-Bold',
        fontSize=18,
        leading=21,
        textColor=colors.HexColor('#0B192C'),
        alignment=1
    )

    inst_sub_style = ParagraphStyle(
        'InstSub',
        fontName='Times-Roman',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#475569'),
        alignment=1
    )

    divider_style = ParagraphStyle(
        'GoldDivider',
        fontName='Times-Bold',
        fontSize=10,
        leading=12,
        textColor=colors.HexColor('#C5A059'),
        alignment=1
    )

    award_title_style = ParagraphStyle(
        'AwardTitle',
        fontName='Times-Bold',
        fontSize=20,
        leading=23,
        textColor=colors.HexColor('#B45309'),
        alignment=1
    )

    present_style = ParagraphStyle(
        'PresentText',
        fontName='Times-Bold',
        fontSize=9.5,
        leading=12,
        textColor=colors.HexColor('#475569'),
        alignment=1
    )

    name_style = ParagraphStyle(
        'StudentName',
        fontName='Times-Bold',
        fontSize=22,
        leading=25,
        textColor=colors.HexColor('#0B192C'),
        alignment=1
    )

    credentials_style = ParagraphStyle(
        'Credentials',
        fontName='Times-Roman',
        fontSize=10.5,
        leading=13,
        textColor=colors.HexColor('#1E293B'),
        alignment=1
    )

    body_style = ParagraphStyle(
        'CertBody',
        fontName='Times-Roman',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#334155'),
        alignment=1
    )

    badge_style = ParagraphStyle(
        'BadgeStyle',
        fontName='Times-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#065F46'),
        alignment=1
    )

    sig_style = ParagraphStyle(
        'SigStyle',
        fontName='Times-Roman',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#0B192C'),
        alignment=1
    )

    clean_college = html.escape(settings.COLLEGE_NAME or "NANDHA ENGINEERING COLLEGE (AUTONOMOUS)").upper()
    clean_name = html.escape(student.name or "").upper()
    clean_reg = html.escape(student.reg_no or "").upper()
    clean_dept_full = html.escape(dept_full_title)

    # ─── HEADER: Logo & College Accreditation ───
    if os.path.exists(COLLEGE_LOGO_PATH):
        try:
            emblem_img = Image(COLLEGE_LOGO_PATH, width=0.85*inch, height=0.85*inch)
            emblem_img.hAlign = 'CENTER'
            story.append(emblem_img)
            story.append(Spacer(1, 4))
        except Exception as e:
            logger.warning(f"Note loading college emblem: {e}")

    story.append(Paragraph(clean_college, inst_title_style))
    story.append(Paragraph("(AUTONOMOUS)", inst_sub_style))
    story.append(Paragraph("Approved by AICTE, New Delhi • Affiliated to Anna University, Chennai • Accredited by NAAC with 'A+' Grade", inst_sub_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph("────────────── ◆ ──────────────", divider_style))
    story.append(Spacer(1, 6))

    # ─── TITLE & PRESENTATION ───
    story.append(Paragraph("CERTIFICATE OF EXCELLENCE", award_title_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph("THIS CERTIFICATE IS PROUDLY PRESENTED TO", present_style))
    story.append(Spacer(1, 6))

    # ─── STUDENT NAME & DETAILS ───
    story.append(Paragraph(f"<u>{clean_name}</u>", name_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph(f"Register No: <b>{clean_reg}</b> &nbsp;|&nbsp; <b>{clean_dept_full}</b>", credentials_style))
    story.append(Spacer(1, 8))

    # ─── CITATION & RECOGNITION ───
    cert_msg = (
        "For exceptional algorithmic problem-solving competence, dedication, "
        "and achieving <b>Top Performer</b> distinction in the Institutional LeetCode "
        "Continuous Performance Tracking System during the academic session."
    )
    story.append(Paragraph(cert_msg, body_style))
    story.append(Spacer(1, 6))

    # Recognition Badge
    story.append(Paragraph("<b>★ TOP PERFORMER &nbsp;•&nbsp; WEEKLY LEETCODE PROGRAM ★</b>", badge_style))
    story.append(Spacer(1, 14))

    # ─── BOTTOM 3-COLUMN LAYOUT: Left (Principal), Center (QR + Verification), Right (HOD) ───
    qr_element = Image(qr_path, width=0.9*inch, height=0.9*inch)
    
    # Check for uploaded physical signature images
    principal_img_block = ""
    if principal_sig and principal_sig.image_path and os.path.exists(principal_sig.image_path):
        try:
            p_img = Image(principal_sig.image_path, width=1.5*inch, height=0.5*inch)
            p_img.hAlign = 'CENTER'
        except Exception:
            pass

    left_block = (
        "<br/>"
        "____________________________<br/>"
        "<b>PRINCIPAL</b><br/>"
        "Nandha Engineering College"
    )

    center_block = (
        f"<b>CERTIFICATE VERIFICATION</b><br/>"
        f"Verification Code: <b>{cert_id}</b><br/>"
        f"Issue Date: {issue_date_display}<br/>"
        f"<font color='#64748B' size='7'>Scan QR to verify authenticity</font>"
    )

    right_block = (
        "<br/>"
        "____________________________<br/>"
        "<b>HOD / COORDINATOR</b><br/>"
        f"{clean_dept_full}"
    )

    table_data = [
        [
            Paragraph(left_block, sig_style),
            Table([[qr_element], [Paragraph(center_block, sig_style)]], colWidths=[2.6*inch]),
            Paragraph(right_block, sig_style)
        ]
    ]

    t = Table(table_data, colWidths=[3.2*inch, 2.8*inch, 3.2*inch])
    t.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
    ]))

    story.append(t)

    # 7. Build PDF with custom ornate border on first page
    doc.build(story, onFirstPage=draw_ornate_border)
    logger.info(f"[CERTIFICATE_GENERATED] Verification ID: {cert_id} for Student: {student.name} ({student.reg_no})")

    return {
        "success": True,
        "verification_id": cert_id,
        "verification_url": verification_url,
        "student_name": student.name,
        "register_no": student.reg_no,
        "department": raw_dept,
        "department_name": dept_full_title,
        "recognition": "Top Performer",
        "issue_date": issue_date_display,
        "pdf_path": pdf_path,
        "pdf_filename": pdf_filename,
        "qr_path": qr_path,
        "status": "VALID"
    }
