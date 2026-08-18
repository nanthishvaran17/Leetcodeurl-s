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

    # 3. Build Story
    pdf_buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        pdf_buffer,
        pagesize=landscape(A4),
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
    clean_name = html.escape(student_name or "").upper()
    clean_reg = html.escape(register_no or "").upper()
    clean_dept_full = html.escape(department_name or resolve_department_name(department_code))
    clean_recognition = html.escape(recognition or "Top Performer")
    clean_program = html.escape(program or "Institutional LeetCode Continuous Performance Tracking System")

    # ─── HEADER: Logo & College Accreditation ───
    if os.path.exists(COLLEGE_LOGO_PATH):
        try:
            emblem_img = Image(COLLEGE_LOGO_PATH, width=0.85 * inch, height=0.85 * inch)
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
        f"For exceptional algorithmic problem-solving competence, dedication, "
        f"and achieving <b>{clean_recognition}</b> distinction in the {clean_program} "
        f"during the academic session."
    )
    story.append(Paragraph(cert_msg, body_style))
    story.append(Spacer(1, 6))

    # Recognition Badge
    story.append(Paragraph(f"<b>★ {clean_recognition.upper()} &nbsp;•&nbsp; WEEKLY LEETCODE PROGRAM ★</b>", badge_style))
    story.append(Spacer(1, 14))

    # ─── BOTTOM 3-COLUMN LAYOUT: Left (Principal), Center (QR + Verification), Right (HOD) ───
    # 1. Left Subtable: Principal Signature
    principal_img_cell = _load_signature_cell(principal_sig)
    principal_text_cell = Paragraph(
        "____________________________<br/>"
        "<b>PRINCIPAL</b><br/>"
        "<font size='7.5' color='#475569'>Nandha Engineering College</font>",
        sig_style
    )
    left_subtable = Table([[principal_img_cell], [principal_text_cell]], colWidths=[3.0 * inch])
    left_subtable.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, 0), 'BOTTOM'),
        ('VALIGN', (0, 1), (-1, 1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))

    # 2. Center Subtable: Verification QR Code + Details
    center_text_cell = Paragraph(
        f"<b>CERTIFICATE VERIFICATION</b><br/>"
        f"Verification Code: <b>{verification_id}</b><br/>"
        f"Issue Date: {issue_date_display}<br/>"
        f"<font color='#64748B' size='7'>Scan QR to verify authenticity</font>",
        sig_style
    )
    center_subtable = Table([[qr_img_cell], [center_text_cell]], colWidths=[2.8 * inch])
    center_subtable.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))

    # 3. Right Subtable: HOD / Coordinator Signature
    hod_img_cell = _load_signature_cell(hod_sig)
    hod_text_cell = Paragraph(
        "____________________________<br/>"
        "<b>HOD / COORDINATOR</b><br/>"
        f"<font size='7.5' color='#475569'>{clean_dept_full}</font>",
        sig_style
    )
    right_subtable = Table([[hod_img_cell], [hod_text_cell]], colWidths=[3.0 * inch])
    right_subtable.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, 0), 'BOTTOM'),
        ('VALIGN', (0, 1), (-1, 1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))

    # 4. Main 3-column table
    main_footer_table = Table([[left_subtable, center_subtable, right_subtable]], colWidths=[3.1 * inch, 2.8 * inch, 3.1 * inch])
    main_footer_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
        ('LEFTPADDING', (0, 0), (-1, -1), 2),
        ('RIGHTPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))

    story.append(main_footer_table)

    # 4. Build Document
    doc.build(story, onFirstPage=draw_ornate_border)
    pdf_bytes = pdf_buffer.getvalue()

    if target_path:
        try:
            os.makedirs(os.path.dirname(target_path), exist_ok=True)
            with open(target_path, "wb") as f:
                f.write(pdf_bytes)
        except Exception as e:
            logger.warning(f"Note saving certificate cache to {target_path}: {e}")

    logger.info(f"[CERTIFICATE_GENERATED] Verification ID: {verification_id} for Student: {student_name} ({register_no})")
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

