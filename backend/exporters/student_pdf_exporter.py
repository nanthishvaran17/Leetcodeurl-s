import io
import datetime
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

def draw_page_border(canvas, doc):
    """Draws a premium double-line border around the page with a footer."""
    canvas.saveState()
    
    # Outer Border
    canvas.setStrokeColor(colors.HexColor('#1B365D'))
    canvas.setLineWidth(2)
    # Margin of 20 points around the page
    canvas.rect(20, 20, A4[0] - 40, A4[1] - 40)
    
    # Inner Border
    canvas.setStrokeColor(colors.HexColor('#64748B'))
    canvas.setLineWidth(0.5)
    canvas.rect(24, 24, A4[0] - 48, A4[1] - 48)
    
    # Footer text
    canvas.setFont('Helvetica-Oblique', 8)
    canvas.setFillColor(colors.HexColor('#64748B'))
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    canvas.drawString(30, 30, f"Generated automatically by System on {timestamp}")
    canvas.drawRightString(A4[0] - 30, 30, "Confidential / Official Report")
    
    canvas.restoreState()

def export_student_pdf_from_dataset(dataset: dict, report_type: str = "STUDENT") -> bytes:
    buffer = io.BytesIO()
    # Adjust margins to fit well inside the border
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=A4,
        rightMargin=50, leftMargin=50,
        topMargin=50, bottomMargin=50
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        textColor=colors.HexColor('#1B365D'),
        alignment=1, # Center
        spaceAfter=15
    )
    
    sub_style = ParagraphStyle(
        'SubStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        textColor=colors.HexColor('#475569'),
        alignment=1,
        spaceAfter=25
    )

    rows = dataset.get("rows", [])
    s = rows[0] if rows else {}

    story = []

    # LOGO
    # Look for logo in backend static folder first, then frontend public
    base_dir = os.path.dirname(os.path.dirname(__file__))
    logo_path = os.path.join(base_dir, "static", "nec_25_logo.png")
    if not os.path.exists(logo_path):
        # fallback to frontend public
        frontend_dir = os.path.join(os.path.dirname(base_dir), "frontend", "public")
        logo_path = os.path.join(frontend_dir, "nec_25_logo.png")
        if not os.path.exists(logo_path):
            logo_path = os.path.join(frontend_dir, "logo.png")

    if os.path.exists(logo_path):
        try:
            # Add Logo centered
            logo = Image(logo_path, width=2.5*inch, height=0.8*inch)
            logo.hAlign = 'CENTER'
            story.append(logo)
            story.append(Spacer(1, 10))
        except Exception:
            pass

    # HEADER
    story.append(Paragraph("NANDHA ENGINEERING COLLEGE (AUTONOMOUS)", title_style))
    
    report_titles = {
        "STUDENT": "DETAILED STUDENT ANALYTICS",
        "OFFICIAL_SUMMARY": "STUDENT PERFORMANCE SUMMARY",
        "WEEKLY_CONTEST_MATRIX": "STUDENT CONTEST MATRIX"
    }
    subtitle = report_titles.get(report_type, "STUDENT INTELLIGENCE REPORT")
    story.append(Paragraph(subtitle, sub_style))

    # SECTION 1: PROFILE
    story.append(Paragraph("<b>1. STUDENT PROFILE</b>", styles['Heading2']))
    story.append(Spacer(1, 5))
    
    profile_data = [
        ["Name", s.get("name", "N/A"), "Register No", s.get("reg_no") or s.get("register_number", "N/A")],
        ["Department", s.get("dept", "N/A"), "Year", s.get("year", "N/A")],
        ["LeetCode ID", s.get("username", "N/A"), "Active Streak", f"{s.get('active_streak', 0)} Days"]
    ]
    
    t_prof = Table(profile_data, colWidths=[1.1*inch, 2.2*inch, 1.1*inch, 2.2*inch])
    t_prof.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F8FAFC')),
        ('BACKGROUND', (2, 0), (2, -1), colors.HexColor('#F8FAFC')),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#334155')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('PADDING', (0, 0), (-1, -1), 10)
    ]))
    story.append(t_prof)
    story.append(Spacer(1, 15))

    # SECTION 2: PROBLEM SOLVING METRICS
    # Always include Problem Solving Metrics for a richer report, unless strictly excluded
    story.append(Paragraph("<b>2. PROBLEM SOLVING METRICS</b>", styles['Heading2']))
    story.append(Spacer(1, 5))
    
    perf_data = [
        ["Metric", "Value"],
        ["Total Solved", str(s.get("total_solved", 0))],
        ["Easy", str(s.get("easy", 0))],
        ["Medium", str(s.get("medium", 0))],
        ["Hard", str(s.get("hard", 0))],
        ["College Rank", str(s.get("college_rank", "N/A"))]
    ]
    
    t_perf = Table(perf_data, colWidths=[3.3*inch, 3.3*inch])
    t_perf_style = [
        ('BACKGROUND', (0, 0), (1, 0), colors.HexColor('#1B365D')),
        ('TEXTCOLOR', (0, 0), (1, 0), colors.whitesmoke),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('PADDING', (0, 0), (-1, -1), 8)
    ]
    # Zebra striping for the data rows
    for i in range(1, len(perf_data)):
        if i % 2 == 1:
            t_perf_style.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#F8FAFC')))
    t_perf.setStyle(TableStyle(t_perf_style))
    story.append(t_perf)
    story.append(Spacer(1, 15))

    # SECTION 3: CONTEST PERFORMANCE
    if report_type in ("STUDENT", "STUDENT_DETAIL", "WEEKLY_CONTEST_MATRIX"):
        story.append(Paragraph("<b>3. CONTEST PERFORMANCE</b>", styles['Heading2']))
        story.append(Spacer(1, 5))
        
        contest_data = [
            ["Metric", "Value"],
            ["Contest Rating", str(s.get("contest_rating") or s.get("rating", "N/A"))],
            ["Last Contest Name", str(dataset.get("contestName") or dataset.get("title", "Weekly Contest"))],
            ["Contest Solved", str(s.get("contest_solved", 0))],
            ["Contest Score", str(s.get("contest_score", 0))]
        ]
        
        t_cont = Table(contest_data, colWidths=[3.3*inch, 3.3*inch])
        t_cont_style = [
            ('BACKGROUND', (0, 0), (1, 0), colors.HexColor('#1B365D')),
            ('TEXTCOLOR', (0, 0), (1, 0), colors.whitesmoke),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('PADDING', (0, 0), (-1, -1), 8)
        ]
        # Zebra striping
        for i in range(1, len(contest_data)):
            if i % 2 == 1:
                t_cont_style.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#F8FAFC')))
        t_cont.setStyle(TableStyle(t_cont_style))
        story.append(t_cont)

    doc.build(story, onFirstPage=draw_page_border, onLaterPages=draw_page_border)
    buffer.seek(0)
    return buffer.getvalue()
