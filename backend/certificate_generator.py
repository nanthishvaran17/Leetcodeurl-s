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

from backend.config import settings
from backend.models import Student, CertificateRecord
from backend.logger import logger

CERT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "reports", "certificates")
os.makedirs(CERT_DIR, exist_ok=True)

def generate_student_certificate(student: Student, cert_type: str = "Top Performer") -> Dict[str, Any]:
    """
    Generates a high-resolution PDF certificate with embedded QR verification code.
    """
    cert_id = f"CERT-{uuid.uuid4().hex[:8].upper()}"
    filename = f"{student.reg_no}_{cert_type.replace(' ', '_')}.pdf"
    pdf_path = os.path.join(CERT_DIR, filename)

    # 1. Generate QR Code containing verification URL
    qr_url = f"http://localhost:3000/verify/{cert_id}"
    qr = qrcode.QRCode(version=1, box_size=4, border=1)
    qr.add_data(qr_url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="#1B365D", back_color="white")
    
    qr_path = os.path.join(CERT_DIR, f"{cert_id}_qr.png")
    qr_img.save(qr_path)

    # 2. Build PDF Document
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=landscape(letter),
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    story = []
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'CertTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=28,
        leading=34,
        textColor=colors.HexColor('#1B365D'),
        alignment=1
    )

    subtitle_style = ParagraphStyle(
        'CertSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#555555'),
        alignment=1
    )

    name_style = ParagraphStyle(
        'StudentName',
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=colors.HexColor('#0056B3'),
        alignment=1
    )

    body_style = ParagraphStyle(
        'CertBody',
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#333333'),
        alignment=1
    )

    # Header
    story.append(Spacer(1, 20))
    story.append(Paragraph(settings.COLLEGE_NAME.upper(), title_style))
    story.append(Spacer(1, 10))
    story.append(Paragraph("CERTIFICATE OF EXCELLENCE", ParagraphStyle('SubHead', parent=title_style, fontSize=20, textColor=colors.HexColor('#D97706'))))
    story.append(Spacer(1, 15))
    story.append(Paragraph("PROUDLY PRESENTED TO", subtitle_style))
    story.append(Spacer(1, 10))
    story.append(Paragraph(student.name.upper(), name_style))
    story.append(Paragraph(f"Register No: {student.reg_no} | Department of {student.department.name if student.department else ''}", subtitle_style))
    story.append(Spacer(1, 20))

    cert_msg = f"For outstanding algorithmic problem-solving performance, consistency, and securing <b>{cert_type}</b> recognition in the Weekly LeetCode Tracking Program during the academic session."
    story.append(Paragraph(cert_msg, body_style))
    story.append(Spacer(1, 30))

    # Bottom layout: Signatures & QR code
    qr_element = Image(qr_path, width=1.2*inch, height=1.2*inch)
    
    table_data = [
        [
            Paragraph("______________________<br/><b>HOD / Coordinator</b>", body_style),
            qr_element,
            Paragraph(f"<b>Verification Code:</b><br/>{cert_id}<br/><i>Issue Date: {datetime.date.today().strftime('%b %d, %Y')}</i>", body_style)
        ]
    ]

    t = Table(table_data, colWidths=[3.0*inch, 2.0*inch, 3.0*inch])
    t.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')
    ]))

    story.append(t)

    doc.build(story)
    logger.info(f"Generated Certificate {cert_id} for student {student.name}")

    return {
        "certificate_code": cert_id,
        "pdf_path": pdf_path,
        "qr_path": qr_path,
        "issue_date": datetime.date.today().isoformat()
    }
