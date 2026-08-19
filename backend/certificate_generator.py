import io
import os
import re
import uuid
import hashlib
import datetime
import qrcode
import html
import base64
from typing import Dict, Any, Optional, List, Tuple
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, NextPageTemplate, PageBreak,
    SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, HRFlowable
)
from reportlab.lib.units import inch, mm
from sqlalchemy.orm import Session

from backend.config import settings
from backend.models import (
    Student, CertificateRecord, AuthorizedSignature,
    WeeklySession, WeeklyPublicResult, WeeklyVirtualResult
)
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


def _load_signature_cell(sig: Optional[AuthorizedSignature]):
    """Loads signature image from disk or base64 image_data fallback."""
    if not sig:
        return Spacer(1, 0.55 * inch)
    if sig.image_path and os.path.exists(sig.image_path):
        try:
            img = Image(sig.image_path, width=1.6 * inch, height=0.55 * inch, kind='proportional')
            img.hAlign = 'CENTER'
            return img
        except Exception as e:
            logger.warning(f"Error loading signature from path: {e}")
    if sig.image_data and "base64," in sig.image_data:
        try:
            b64_data = sig.image_data.split("base64,")[1]
            raw_bytes = base64.b64decode(b64_data)
            buf = io.BytesIO(raw_bytes)
            img = Image(buf, width=1.6 * inch, height=0.55 * inch, kind='proportional')
            img.hAlign = 'CENTER'
            return img
        except Exception as e:
            logger.warning(f"Error loading signature from base64 data: {e}")
    return Spacer(1, 0.55 * inch)


def render_certificate_pdf_bytes(
    student_name: str,
    register_no: str,
    department_code: str,
    department_name: str,
    program: str,
    recognition: str,
    issue_date_display: str,
    verification_id: str,
    verification_url: str,
    db: Session,
    target_path: Optional[str] = None
) -> bytes:
    """
    Renders an authoritative print-ready A4 landscape PDF certificate in memory.
    Optionally saves to target_path for local caching.
    """
    # 1. Signatures
    principal_sig = get_active_signature(db, "PRINCIPAL")
    dept_sig_type = "HOD_CSE_IOT" if ("IOT" in (department_code or "").upper()) else "HOD_CSE_CS"
    hod_sig = get_active_signature(db, dept_sig_type, department_code)

    # 2. QR Code (in-memory)
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=4,
        border=1
    )
    qr.add_data(verification_url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="#0B192C", back_color="white")

    qr_buf = io.BytesIO()
    qr_img.save(qr_buf, format="PNG")
    qr_buf.seek(0)
    qr_img_cell = Image(qr_buf, width=0.85 * inch, height=0.85 * inch)
    qr_img_cell.hAlign = 'CENTER'

    # Cache QR to disk if possible
    try:
        qr_filename = f"{verification_id}_qr.png"
        qr_path = os.path.join(CERT_DIR, qr_filename)
        qr_img.save(qr_path)
    except Exception:
        pass

    # 3. Setup Single-Page Document Template (A4 Landscape)
    pdf_buffer = io.BytesIO()
    
    width, height = landscape(A4)
    frame_margin = 36 # 0.5 inch margins inside ornate border
    f_landscape = Frame(
        frame_margin, frame_margin,
        width - (2 * frame_margin), height - (2 * frame_margin),
        id='F_Landscape',
        leftPadding=24, rightPadding=24, topPadding=18, bottomPadding=18
    )
    tmpl_landscape = PageTemplate(
        id='Page1_GoldCertificate',
        frames=f_landscape,
        pagesize=landscape(A4),
        onPage=draw_ornate_border
    )

    doc = BaseDocTemplate(pdf_buffer, pageTemplates=[tmpl_landscape])

    story = []

    clean_college = html.escape(settings.COLLEGE_NAME or "NANDHA ENGINEERING COLLEGE (AUTONOMOUS)").upper()
    clean_name = html.escape(student_name or "").upper()
    clean_reg = html.escape(register_no or "").upper()
    clean_dept_full = html.escape(department_name or resolve_department_name(department_code))
    clean_recognition = html.escape(recognition or "Top Performer")
    clean_program = html.escape(program or "Institutional LeetCode Continuous Performance Tracking System")

    # Styles
    c_title_style = ParagraphStyle(
        'C_CollegeTitle', fontName='Helvetica-Bold', fontSize=18, leading=22, alignment=1, textColor=colors.HexColor('#0B192C')
    )
    c_sub_style = ParagraphStyle(
        'C_CollegeSub', fontName='Helvetica-Bold', fontSize=8.5, leading=11, alignment=1, textColor=colors.HexColor('#475569')
    )
    c_cert_head = ParagraphStyle(
        'C_CertHead', fontName='Helvetica-Bold', fontSize=22, leading=26, alignment=1, textColor=colors.HexColor('#C5A059')
    )
    c_presented_to = ParagraphStyle(
        'C_PresentedTo', fontName='Helvetica-Bold', fontSize=9, leading=12, alignment=1, textColor=colors.HexColor('#64748B')
    )
    c_student_name = ParagraphStyle(
        'C_StudentName', fontName='Helvetica-Bold', fontSize=26, leading=30, alignment=1, textColor=colors.HexColor('#0B192C')
    )
    c_reg_dept = ParagraphStyle(
        'C_RegDept', fontName='Helvetica-Bold', fontSize=10.5, leading=14, alignment=1, textColor=colors.HexColor('#1E293B')
    )
    c_citation = ParagraphStyle(
        'C_Citation', fontName='Helvetica', fontSize=9.5, leading=13.5, alignment=1, textColor=colors.HexColor('#334155')
    )
    c_badge_style = ParagraphStyle(
        'C_Badge', fontName='Helvetica-Bold', fontSize=9, leading=12, alignment=1, textColor=colors.HexColor('#065F46')
    )

    # 1. Emblem / Logo
    if os.path.exists(COLLEGE_LOGO_PATH):
        try:
            logo_img = Image(COLLEGE_LOGO_PATH, width=48, height=48)
            logo_img.hAlign = 'CENTER'
            story.append(logo_img)
            story.append(Spacer(1, 4))
        except Exception:
            pass

    # 2. Institutional Title & Accreditation
    story.append(Paragraph(clean_college, c_title_style))
    story.append(Spacer(1, 2))
    story.append(Paragraph("(AUTONOMOUS)", ParagraphStyle('C_Auto', fontName='Helvetica-Bold', fontSize=10, leading=12, alignment=1, textColor=colors.HexColor('#475569'))))
    story.append(Spacer(1, 2))
    story.append(Paragraph("Approved by AICTE, New Delhi • Affiliated to Anna University, Chennai • Accredited by NAAC with 'A+' Grade", c_sub_style))
    story.append(Spacer(1, 8))

    # Divider bar
    story.append(HRFlowable(width="75%", thickness=1.5, color=colors.HexColor('#C5A059'), spaceBefore=2, spaceAfter=10))

    # 3. Certificate Main Heading
    story.append(Paragraph("CERTIFICATE OF EXCELLENCE", c_cert_head))
    story.append(Spacer(1, 4))
    story.append(Paragraph("THIS CERTIFICATE IS PROUDLY PRESENTED TO", c_presented_to))
    story.append(Spacer(1, 8))

    # 4. Student Name & Reg/Dept
    story.append(Paragraph(f"<u>{clean_name}</u>", c_student_name))
    story.append(Spacer(1, 6))
    story.append(Paragraph(f"Register No: <b>{clean_reg}</b> | <b>{clean_dept_full}</b>", c_reg_dept))
    story.append(Spacer(1, 10))

    # 5. Citation Text
    citation_text = f"For exceptional algorithmic problem-solving competence, dedication, and achieving <b>{clean_recognition}</b> distinction in the {clean_program} during the academic session."
    story.append(Paragraph(citation_text, c_citation))
    story.append(Spacer(1, 10))

    # 6. Distinction Pill Badge
    badge_p = Paragraph(f"★ {clean_recognition.upper()} • WEEKLY LEETCODE PROGRAM ★", c_badge_style)
    badge_table = Table([[badge_p]], colWidths=[360])
    badge_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#D1FAE5')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#059669')),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    badge_table.hAlign = 'CENTER'
    story.append(badge_table)
    story.append(Spacer(1, 14))

    # 7. Signatures & Verification Cell (Bottom Table)
    p_sig_cell = _load_signature_cell(principal_sig)
    h_sig_cell = _load_signature_cell(hod_sig)

    p_info = Paragraph("<b>PRINCIPAL</b><br/><font size='7' color='#475569'>Nandha Engineering College</font>", ParagraphStyle('PSig', fontName='Helvetica-Bold', fontSize=8, leading=10, alignment=1, textColor=colors.HexColor('#0B192C')))
    h_info = Paragraph(f"<b>HOD / COORDINATOR</b><br/><font size='7' color='#475569'>{clean_dept_full}</font>", ParagraphStyle('HSig', fontName='Helvetica-Bold', fontSize=8, leading=10, alignment=1, textColor=colors.HexColor('#0B192C')))
    
    ver_text = Paragraph(
        f"<b>CERTIFICATE VERIFICATION</b><br/>"
        f"<font size='7' color='#475569'>Verification Code: <b>{verification_id}</b><br/>"
        f"Issue Date: {issue_date_display}<br/>"
        f"Scan QR to verify authenticity</font>",
        ParagraphStyle('VSig', fontName='Helvetica', fontSize=7.5, leading=9.5, alignment=1, textColor=colors.HexColor('#0B192C'))
    )

    left_stack = [p_sig_cell, Spacer(1, 2), HRFlowable(width="80%", thickness=1, color=colors.HexColor('#0B192C'), spaceAfter=2), p_info]
    center_stack = [qr_img_cell, Spacer(1, 2), ver_text]
    right_stack = [h_sig_cell, Spacer(1, 2), HRFlowable(width="80%", thickness=1, color=colors.HexColor('#0B192C'), spaceAfter=2), h_info]

    sig_table = Table([[left_stack, center_stack, right_stack]], colWidths=[240, 220, 240])
    sig_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'BOTTOM'),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ]))
    sig_table.hAlign = 'CENTER'
    story.append(sig_table)

    # 8. Build Document
    doc.build(story)
    pdf_bytes = pdf_buffer.getvalue()

    if target_path:
        try:
            os.makedirs(os.path.dirname(target_path), exist_ok=True)
            with open(target_path, "wb") as f:
                f.write(pdf_bytes)
        except Exception as e:
            logger.warning(f"Note saving certificate cache to {target_path}: {e}")

    logger.info(f"[CERTIFICATE_GENERATED] Verification ID: {verification_id} (Official Certificate of Excellence) for Student: {student_name} ({register_no})")
    return pdf_bytes


def build_certificate_pdf_from_record(
    cert: CertificateRecord,
    db: Session,
    target_path: Optional[str] = None
) -> bytes:
    """
    Generates authoritative PDF bytes for an existing verified CertificateRecord.
    Guarantees that missing disk PDFs are instantly reconstructed from verified DB records.
    """
    dept_code = cert.department or "CSE(CS)"
    dept_name = cert.department_name or resolve_department_name(dept_code)
    ver_url = cert.verification_url or f"https://leetcode-student-data.web.app/verify/{cert.verification_id}"

    if not target_path and cert.pdf_path:
        target_path = cert.pdf_path
    elif not target_path:
        target_path = os.path.join(CERT_DIR, f"{cert.register_no}_{cert.verification_id}.pdf")

    pdf_bytes = render_certificate_pdf_bytes(
        student_name=cert.student_name,
        register_no=cert.register_no,
        department_code=dept_code,
        department_name=dept_name,
        program=cert.program or "Institutional LeetCode Continuous Performance Tracking System",
        recognition=cert.recognition or "Top Performer",
        issue_date_display=cert.issue_date or datetime.date.today().strftime("%b %d, %Y"),
        verification_id=cert.verification_id,
        verification_url=ver_url,
        db=db,
        target_path=target_path
    )

    if cert.pdf_path != target_path:
        cert.pdf_path = target_path
        try:
            db.commit()
        except Exception:
            db.rollback()

    return pdf_bytes


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

    # Paths
    pdf_filename = f"{student.reg_no}_{cert_id}.pdf"
    pdf_path = os.path.join(CERT_DIR, pdf_filename)
    qr_filename = f"{cert_id}_qr.png"
    qr_path = os.path.join(CERT_DIR, qr_filename)

    # 4. Persist Certificate Record in Database
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
        pdf_path=pdf_path,
        created_by=created_by
    )
    db.add(cert_record)
    db.commit()
    db.refresh(cert_record)

    # 5. Render Document and Cache to Disk
    render_certificate_pdf_bytes(
        student_name=student.name,
        register_no=student.reg_no,
        department_code=raw_dept,
        department_name=dept_full_title,
        program="Institutional LeetCode Continuous Performance Tracking System",
        recognition="Top Performer",
        issue_date_display=issue_date_display,
        verification_id=cert_id,
        verification_url=verification_url,
        db=db,
        target_path=pdf_path
    )

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

