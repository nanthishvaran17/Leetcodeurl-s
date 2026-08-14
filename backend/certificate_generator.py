import io
import os
import uuid
import datetime
import qrcode
from typing import Dict, Any
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle
from reportlab.lib.units import inch
from reportlab.graphics.shapes import Drawing, Rect, Line, String

from backend.config import settings
from backend.models import Student, CertificateRecord
from backend.logger import logger

CERT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "reports", "certificates")
os.makedirs(CERT_DIR, exist_ok=True)

def draw_ornate_border(canvas, doc):
    """Draws an executive double gold & navy ornate certificate border."""
    canvas.saveState()
    width, height = doc.pagesize

    # Outer Navy Border
    canvas.setStrokeColor(colors.HexColor('#0B192C'))
    canvas.setLineWidth(5)
    canvas.rect(18, 18, width - 36, height - 36)

    # Inner Gold Border
    canvas.setStrokeColor(colors.HexColor('#D4AF37'))
    canvas.setLineWidth(2)
    canvas.rect(26, 26, width - 52, height - 52)

    # Corner Decorative Squares
    corner_size = 12
    canvas.setFillColor(colors.HexColor('#D4AF37'))
    canvas.rect(20, 20, corner_size, corner_size, fill=1, stroke=0)
    canvas.rect(width - 20 - corner_size, 20, corner_size, corner_size, fill=1, stroke=0)
    canvas.rect(20, height - 20 - corner_size, corner_size, corner_size, fill=1, stroke=0)
    canvas.rect(width - 20 - corner_size, height - 20 - corner_size, corner_size, corner_size, fill=1, stroke=0)

    canvas.restoreState()


def generate_student_certificate(student: Student, cert_type: str = "Top Performer") -> Dict[str, Any]:
    """
    Generates a high-resolution, executive PDF certificate with scannable QR verification and dual signatures.
    """
    cert_id = f"CERT-{uuid.uuid4().hex[:8].upper()}"
    filename = f"{student.reg_no}_{cert_id}.pdf"
    pdf_path = os.path.join(CERT_DIR, filename)

    # 1. Generate QR Code linking to student's live verified profile
    clean_username = student.username or ""
    clean_reg = student.reg_no or ""
    qr_url = f"https://leetcode.com/{clean_username}" if clean_username else f"https://leetcode-student-data.web.app"
    
    qr = qrcode.QRCode(version=1, box_size=4, border=1)
    qr.add_data(qr_url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="#0B192C", back_color="white")
    
    qr_path = os.path.join(CERT_DIR, f"{cert_id}_qr.png")
    qr_img.save(qr_path)

    # 2. Build PDF Document
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=landscape(letter),
        rightMargin=45,
        leftMargin=45,
        topMargin=45,
        bottomMargin=45
    )

    story = []
    styles = getSampleStyleSheet()

    inst_title_style = ParagraphStyle(
        'InstTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0B192C'),
        alignment=1
    )

    inst_sub_style = ParagraphStyle(
        'InstSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#64748B'),
        alignment=1
    )

    award_title_style = ParagraphStyle(
        'AwardTitle',
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=colors.HexColor('#B45309'),
        alignment=1
    )

    subtitle_style = ParagraphStyle(
        'CertSub',
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#64748B'),
        alignment=1
    )

    name_style = ParagraphStyle(
        'StudentName',
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=colors.HexColor('#0284C7'),
        alignment=1
    )

    body_style = ParagraphStyle(
        'CertBody',
        fontName='Helvetica',
        fontSize=11,
        leading=16,
        textColor=colors.HexColor('#1E293B'),
        alignment=1
    )

    sig_style = ParagraphStyle(
        'SigStyle',
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#0B192C'),
        alignment=1
    )

    import html
    clean_college = html.escape(settings.COLLEGE_NAME or "NANDHA ENGINEERING COLLEGE (AUTONOMOUS)").upper()
    clean_name = html.escape(student.name or "").upper()
    clean_dept = html.escape(student.department.name if student.department else "Computer Science and Engineering")
    clean_cert_type = html.escape(cert_type)

    # Header Section
    story.append(Spacer(1, 10))
    story.append(Paragraph(clean_college, inst_title_style))
    story.append(Paragraph("Approved by AICTE, New Delhi • Affiliated to Anna University, Chennai • Accredited by NAAC with 'A+' Grade", inst_sub_style))
    story.append(Spacer(1, 12))

    # Gold Award Banner
    story.append(Paragraph("CERTIFICATE OF EXCELLENCE", award_title_style))
    story.append(Spacer(1, 10))
    story.append(Paragraph("THIS CERTIFICATE IS PROUDLY PRESENTED TO", subtitle_style))
    story.append(Spacer(1, 8))

    # Student Name & Credentials
    story.append(Paragraph(clean_name, name_style))
    story.append(Paragraph(f"Register No: <b>{clean_reg}</b> • Department of {clean_dept}", subtitle_style))
    story.append(Spacer(1, 14))

    # Citation Description
    cert_msg = f"For exceptional algorithmic problem-solving competence, dedication, and achieving <b>{clean_cert_type}</b> distinction in the Institutional LeetCode Continuous Performance Tracking System during the academic session."
    story.append(Paragraph(cert_msg, body_style))
    story.append(Spacer(1, 20))

    # Bottom layout: Dual Signatures & Scannable QR Verification
    qr_element = Image(qr_path, width=1.1*inch, height=1.1*inch)
    
    table_data = [
        [
            Paragraph("<i>Digitally Signed</i><br/><br/><b>PRINCIPAL</b><br/>Nandha Engineering College", sig_style),
            Paragraph(f"{qr_element}<br/><b>Verification ID:</b> {cert_id}<br/><i>Date: {datetime.date.today().strftime('%b %d, %Y')}</i>", sig_style),
            Paragraph("<i>Digitally Signed</i><br/><br/><b>HOD / COORDINATOR</b><br/>Department of " + clean_dept, sig_style)
        ]
    ]

    t = Table(table_data, colWidths=[2.8*inch, 2.6*inch, 2.8*inch])
    t.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')
    ]))

    story.append(t)

    # Build Document with ornate border canvas
    doc.build(story, onFirstPage=draw_ornate_border)
    logger.info(f"Generated Certificate {cert_id} for student {student.name}")

    return {
        "certificate_code": cert_id,
        "pdf_path": pdf_path,
        "qr_path": qr_path,
        "issue_date": datetime.date.today().isoformat()
    }

