import os
import io
import shutil
import datetime
from typing import Optional
from sqlalchemy.orm import Session

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable
from reportlab.lib.units import inch

from backend.models import Student, WeeklySession, WeeklySessionSnapshot, Department, WeeklyStudentProgress
from backend.config import settings
from backend.logger import logger

def get_college_logo_path() -> Optional[str]:
    """
    Generates and returns the official Nandha Engineering College Emblem logo image for ReportLab PDF generation.
    """
    assets_dir = os.path.join(os.path.dirname(__file__), "assets")
    os.makedirs(assets_dir, exist_ok=True)
    emblem_path = os.path.join(assets_dir, "nandha_emblem.png")

    # 1. Check if emblem already exists and is valid
    if os.path.exists(emblem_path) and os.path.getsize(emblem_path) > 500:
        return emblem_path

    # 2. Check artifact directory for user uploaded image files
    import glob
    artifacts_dir = r"C:\Users\Nanth\.gemini\antigravity-ide\brain\c359f76e-577f-48b8-9306-ec7d344b7d1e"
    if os.path.exists(artifacts_dir):
        pngs = glob.glob(os.path.join(artifacts_dir, "*.png"))
        if pngs:
            pngs.sort(key=os.path.getmtime, reverse=True)
            for candidate in pngs:
                if os.path.getsize(candidate) > 500:
                    try:
                        shutil.copy(candidate, emblem_path)
                        return emblem_path
                    except Exception:
                        pass

    # 3. Fallback to generator script
    try:
        from backend.assets.generate_pdf_logo import generate_nandha_college_logo
        return generate_nandha_college_logo()
    except Exception as e:
        logger.error(f"Error generating snapshot PDF: {e}", exc_info=True)
        raise ValueError(f"Could not generate PDF: {str(e)}")

def generate_pdf_summary_report(db: Session, dept_id: Optional[int] = None) -> bytes:
    """
    Generates an official Nandha Engineering College PDF executive summary report using ReportLab.
    Features:
    - Official College Logo on the Left
    - Centered College Header Text
    - Executive Summary Metrics Box
    - Top 20 Performers Leaderboard
    - Clean Professional Formatting (Signatures Removed as requested)
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    story = []
    styles = getSampleStyleSheet()

    # Custom styles - Times New Roman font ONLY
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Times-Bold',
        fontSize=16,
        leading=20,
        textColor=colors.HexColor('#0F172A'),
        alignment=1
    )

    address_style = ParagraphStyle(
        'DocAddress',
        parent=styles['Normal'],
        fontName='Times-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#0284C7'),
        alignment=1
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Times-Bold',
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor('#334155'),
        alignment=1
    )

    meta_style = ParagraphStyle(
        'DocMeta',
        parent=styles['Normal'],
        fontName='Times-Roman',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#64748B'),
        alignment=1
    )

    header_cell_style = ParagraphStyle(
        'HeaderCell',
        fontName='Times-Bold',
        fontSize=9,
        textColor=colors.white,
        alignment=1
    )

    cell_style = ParagraphStyle(
        'NormalCell',
        fontName='Times-Roman',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#334155')
    )

    cell_bold_style = ParagraphStyle(
        'BoldCell',
        fontName='Times-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#0F172A'),
        alignment=1
    )

    # 1. Header Section - Official Nandha Engineering College Logo & Banner
    dept_obj = db.query(Department).filter(Department.id == dept_id).first() if dept_id else None
    dept_text = f"Department of {dept_obj.name}" if dept_obj else "Department of Computer Science and Engineering (Cyber Security & IoT)"

    # Header Paragraphs
    p_title = Paragraph("NANDHA ENGINEERING COLLEGE (AUTONOMOUS)", title_style)
    p_address = Paragraph("Approved by AICTE, New Delhi & Affiliated to Anna University, Chennai | Erode - 638 052, Tamil Nadu", address_style)
    p_dept = Paragraph(dept_text, subtitle_style)
    p_report = Paragraph("Weekly LeetCode Session Performance Report & Executive Leaderboard", subtitle_style)
    p_meta = Paragraph(f"Generated on: {datetime.datetime.now().strftime('%d-%b-%Y %I:%M %p IST')}", meta_style)

    header_text_elements = [
        p_title,
        Spacer(1, 2),
        p_address,
        Spacer(1, 3),
        p_dept,
        Spacer(1, 2),
        p_report,
        Spacer(1, 2),
        p_meta
    ]

    logo_path = get_college_logo_path()
    if logo_path and os.path.exists(logo_path):
        try:
            img = Image(logo_path, width=1.5*inch, height=1.0*inch)
            header_table = Table([[img, header_text_elements]], colWidths=[1.6*inch, 5.4*inch])
            header_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('ALIGN', (0, 0), (0, 0), 'LEFT'),
                ('ALIGN', (1, 0), (1, 0), 'CENTER'),
            ]))
            story.append(header_table)
        except Exception as e:
            logger.warning(f"Could not render logo image in PDF: {e}")
            for el in header_text_elements:
                story.append(el)
    else:
        for el in header_text_elements:
            story.append(el)

    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#0284C7'), spaceAfter=12))

    # 2. Executive Summary Metrics
    student_query = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None)))
    if dept_id:
        student_query = student_query.filter(Student.department_id == dept_id)
    students = student_query.all()
    total_students = len(students)

    started_count = sum(1 for s in students if s.stats and (s.stats.total_solved or 0) > 0)
    not_started_count = total_students - started_count
    
    total_solved_sum = sum((s.stats.total_solved or 0) if s.stats else 0 for s in students)
    avg_progress = round(total_solved_sum / max(total_students, 1), 1)

    # Top student
    top_student = sorted(students, key=lambda x: (x.stats.total_solved or 0) if x.stats else 0, reverse=True)
    top_name = top_student[0].name if top_student else "N/A"

    summary_data = [
        [
            Paragraph("Total Students", header_cell_style),
            Paragraph("Active Solvers", header_cell_style),
            Paragraph("Not Started", header_cell_style),
            Paragraph("Avg Progress", header_cell_style),
            Paragraph("Top Performer", header_cell_style)
        ],
        [
            Paragraph(str(total_students), cell_bold_style),
            Paragraph(str(started_count), cell_bold_style),
            Paragraph(str(not_started_count), cell_bold_style),
            Paragraph(f"+{avg_progress}", cell_bold_style),
            Paragraph(top_name, cell_bold_style)
        ]
    ]

    summary_table = Table(summary_data, colWidths=[1.2*inch, 1.2*inch, 1.2*inch, 1.2*inch, 2.2*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#F8FAFC')),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 14))

    # 3. Top 20 College Leaderboard Table
    story.append(Paragraph("College Leaderboard Summary (Top 20 Performers)", ParagraphStyle('SecTitle', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=11, textColor=colors.HexColor('#0F172A'))))
    story.append(Spacer(1, 6))

    lb_headers = [
        Paragraph("Rank", header_cell_style),
        Paragraph("Register No", header_cell_style),
        Paragraph("Student Name", header_cell_style),
        Paragraph("Dept", header_cell_style),
        Paragraph("Year", header_cell_style),
        Paragraph("Sec", header_cell_style),
        Paragraph("Solved", header_cell_style),
        Paragraph("Progress", header_cell_style)
    ]

    lb_rows = [lb_headers]

    # Top 20 Performers (Clean rank strings without special prefix artifacts)
    for rank, s in enumerate(top_student[:20], 1):
        latest_prog = db.query(WeeklyStudentProgress).filter(WeeklyStudentProgress.student_id == s.id).order_by(WeeklyStudentProgress.id.desc()).first()
        prog_str = f"+{latest_prog.weekly_progress}" if latest_prog else "+0"
        rank_str = f"#{rank}"

        lb_rows.append([
            Paragraph(rank_str, cell_bold_style),
            Paragraph(s.reg_no, cell_style),
            Paragraph(s.name, cell_style),
            Paragraph(s.department.code if s.department else "CSE", cell_style),
            Paragraph(s.year_level, cell_style),
            Paragraph(s.section.name if s.section else "A", cell_style),
            Paragraph(str((s.stats.total_solved or 0) if s.stats else 0), cell_bold_style),
            Paragraph(prog_str, cell_style)
        ])

    lb_table = Table(lb_rows, colWidths=[0.6*inch, 1.2*inch, 2.2*inch, 0.8*inch, 0.6*inch, 0.4*inch, 0.6*inch, 0.6*inch])
    lb_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4.5),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')])
    ]))

    story.append(lb_table)

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


def generate_snapshot_pdf_report(db: Session, snapshot_id: str) -> bytes:
    """
    Generates an official Nandha Engineering College PDF executive summary report using frozen HODSnapshot data.
    """
    from backend.models import HODSnapshot
    snapshot = db.query(HODSnapshot).filter(HODSnapshot.snapshot_id == snapshot_id).first()
    if not snapshot:
        raise ValueError("Snapshot not found")
        
    metrics = snapshot.metrics

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    story = []
    styles = getSampleStyleSheet()

    # Custom styles - Times New Roman font ONLY
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Times-Bold',
        fontSize=16,
        leading=20,
        textColor=colors.HexColor('#0F172A'),
        alignment=1
    )

    address_style = ParagraphStyle(
        'DocAddress',
        parent=styles['Normal'],
        fontName='Times-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#0284C7'),
        alignment=1
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Heading2'],
        fontName='Times-Bold',
        fontSize=13,
        leading=16,
        textColor=colors.HexColor('#1E293B'),
        alignment=1
    )

    meta_style = ParagraphStyle(
        'DocMeta',
        parent=styles['Normal'],
        fontName='Times-Roman',
        fontSize=10,
        textColor=colors.HexColor('#64748B'),
        alignment=1
    )
    
    cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Times-Roman',
        fontSize=9,
        textColor=colors.HexColor('#1E293B')
    )

    cell_bold_style = ParagraphStyle(
        'TableBoldCell',
        parent=styles['Normal'],
        fontName='Times-Bold',
        fontSize=9,
        textColor=colors.HexColor('#0F172A')
    )

    header_cell_style = ParagraphStyle(
        'HeaderCell',
        parent=styles['Normal'],
        fontName='Times-Bold',
        fontSize=9.5,
        textColor=colors.white
    )

    # 1. Header Section
    p_title = Paragraph("NANDHA ENGINEERING COLLEGE (AUTONOMOUS)", title_style)
    p_address = Paragraph("Approved by AICTE, New Delhi & Affiliated to Anna University, Chennai | Erode - 638 052, Tamil Nadu", address_style)
    p_dept = Paragraph("All Departments", subtitle_style)
    p_report = Paragraph(f"Executive Point-in-Time Snapshot: {snapshot.title}", subtitle_style)
    dt_str = snapshot.created_at.strftime('%d-%b-%Y %I:%M %p IST') if isinstance(snapshot.created_at, datetime.datetime) else snapshot.created_at
    p_meta = Paragraph(f"Frozen at: {dt_str}", meta_style)

    header_text_elements = [
        p_title,
        Spacer(1, 2),
        p_address,
        Spacer(1, 3),
        p_dept,
        Spacer(1, 2),
        p_report,
        Spacer(1, 2),
        p_meta
    ]

    logo_path = get_college_logo_path()
    if logo_path and os.path.exists(logo_path):
        try:
            img = Image(logo_path, width=1.5*inch, height=1.0*inch)
            header_table = Table([[img, header_text_elements]], colWidths=[1.6*inch, 5.4*inch])
            header_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('ALIGN', (0, 0), (0, 0), 'LEFT'),
                ('ALIGN', (1, 0), (1, 0), 'CENTER'),
            ]))
            story.append(header_table)
        except Exception as e:
            logger.warning(f"Could not render logo image in PDF: {e}")
            for el in header_text_elements:
                story.append(el)
    else:
        for el in header_text_elements:
            story.append(el)

    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#0284C7'), spaceAfter=12))

    # 2. Executive Summary Metrics
    total_students = metrics.get("total_students", 0)
    started_count = metrics.get("synced_students", 0)
    not_started_count = total_students - started_count
    
    total_solved_sum = metrics.get("total_solved_college", 0)
    avg_progress = round(total_solved_sum / max(total_students, 1), 1)

    # Compile list of all students from department_summary to find top performers
    all_students = []
    dept_summary = metrics.get("department_summary", {})
    for dept, d_stats in dept_summary.items():
        if "students" in d_stats:
            for s in d_stats["students"]:
                s["dept_name"] = dept
                all_students.append(s)
                
    # Top student
    top_students = sorted(all_students, key=lambda x: x.get("total_solved") or 0, reverse=True)
    top_name = top_students[0].get("name") if top_students else "N/A"

    summary_data = [
        [
            Paragraph("Total Students", header_cell_style),
            Paragraph("Verified Solvers", header_cell_style),
            Paragraph("Unverified/Failed", header_cell_style),
            Paragraph("Avg Solved", header_cell_style),
            Paragraph("Top Performer", header_cell_style)
        ],
        [
            Paragraph(str(total_students), cell_bold_style),
            Paragraph(str(started_count), cell_bold_style),
            Paragraph(str(not_started_count + metrics.get("failed_sync", 0)), cell_bold_style),
            Paragraph(f"{avg_progress}", cell_bold_style),
            Paragraph(top_name, cell_bold_style)
        ]
    ]

    summary_table = Table(summary_data, colWidths=[1.2*inch, 1.2*inch, 1.2*inch, 1.2*inch, 2.2*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#F8FAFC')),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 14))

    # 3. Top 20 College Leaderboard Table
    story.append(Paragraph("College Leaderboard Snapshot (Top 20 Performers)", ParagraphStyle('SecTitle', parent=styles['Heading2'], fontName='Times-Bold', fontSize=11, textColor=colors.HexColor('#0F172A'))))
    story.append(Spacer(1, 6))

    lb_headers = [
        Paragraph("Rank", header_cell_style),
        Paragraph("Register No", header_cell_style),
        Paragraph("Student Name", header_cell_style),
        Paragraph("Dept", header_cell_style),
        Paragraph("Solved", header_cell_style),
        Paragraph("Rating", header_cell_style)
    ]

    lb_rows = [lb_headers]

    for rank, s in enumerate(top_students[:20], 1):
        rank_str = f"#{rank}"
        rating_str = str(round(s.get("contest_rating") or 0, 1)) if s.get("contest_rating") else "N/A"

        lb_rows.append([
            Paragraph(rank_str, cell_bold_style),
            Paragraph(s.get("reg_no", ""), cell_style),
            Paragraph(s.get("name", ""), cell_style),
            Paragraph(s.get("dept_name", ""), cell_style),
            Paragraph(str(s.get("total_solved") or 0), cell_bold_style),
            Paragraph(rating_str, cell_style)
        ])

    lb_table = Table(lb_rows, colWidths=[0.6*inch, 1.4*inch, 2.4*inch, 1.2*inch, 0.7*inch, 0.7*inch])
    lb_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4.5),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')])
    ]))

    story.append(lb_table)

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


def generate_universal_pdf(report_data: dict) -> bytes:
    """Generates a universal PDF directly from the unified JSON dataset."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    story = []
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Times-Bold',
        fontSize=15,
        leading=18,
        textColor=colors.HexColor('#0F172A'),
        alignment=1
    )
    
    sub_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontName='Times-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#0284C7'),
        alignment=1
    )

    meta_style = ParagraphStyle(
        'DocMeta',
        parent=styles['Normal'],
        fontName='Times-Roman',
        fontSize=8.5,
        textColor=colors.HexColor('#64748B'),
        alignment=1
    )

    header_cell_style = ParagraphStyle(
        'HCell', fontName='Times-Bold', fontSize=8.5, textColor=colors.white, alignment=1
    )
    cell_style = ParagraphStyle(
        'NCell', fontName='Times-Roman', fontSize=8, leading=10, textColor=colors.HexColor('#334155')
    )
    cell_bold_style = ParagraphStyle(
        'BCell', fontName='Times-Bold', fontSize=8, leading=10, textColor=colors.HexColor('#0F172A'), alignment=1
    )

    # Header
    logo_path = get_college_logo_path()
    header_els = [
        Paragraph("NANDHA ENGINEERING COLLEGE (AUTONOMOUS)", title_style),
        Spacer(1, 3),
        Paragraph(report_data.get('title', 'Universal Performance Report'), sub_style),
        Spacer(1, 2),
        Paragraph(f"Generated: {report_data.get('generatedAt', '')} | Status: {report_data.get('dataStatus', 'READY')}", meta_style)
    ]

    if logo_path and os.path.exists(logo_path):
        try:
            img = Image(logo_path, width=1.2*inch, height=0.8*inch)
            t_hdr = Table([[img, header_els]], colWidths=[1.3*inch, 5.7*inch])
            t_hdr.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('ALIGN', (0,0), (0,0), 'LEFT'),
                ('ALIGN', (1,0), (1,0), 'CENTER'),
            ]))
            story.append(t_hdr)
        except Exception:
            for el in header_els: story.append(el)
    else:
        for el in header_els: story.append(el)

    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0284C7'), spaceAfter=10))

    # Metrics
    metrics = report_data.get("metrics", {})
    if metrics:
        story.append(Paragraph("<b>Executive Summary Metrics</b>", ParagraphStyle('H2', fontName='Times-Bold', fontSize=10, textColor=colors.HexColor('#0F172A'))))
        story.append(Spacer(1, 4))
        
        m_items = list(metrics.items())
        m_rows = []
        for i in range(0, len(m_items), 2):
            k1, v1 = m_items[i]
            val1 = f"{v1:,}" if isinstance(v1, (int, float)) and v1 > 999 else str(v1 if v1 is not None else "—")
            row = [Paragraph(str(k1), cell_bold_style), Paragraph(val1, cell_style)]
            if i + 1 < len(m_items):
                k2, v2 = m_items[i+1]
                val2 = f"{v2:,}" if isinstance(v2, (int, float)) and v2 > 999 else str(v2 if v2 is not None else "—")
                row.extend([Paragraph(str(k2), cell_bold_style), Paragraph(val2, cell_style)])
            else:
                row.extend([Paragraph("", cell_style), Paragraph("", cell_style)])
            m_rows.append(row)

        t_m = Table(m_rows, colWidths=[1.8*inch, 1.7*inch, 1.8*inch, 1.7*inch])
        t_m.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(t_m)
        story.append(Spacer(1, 10))

    # Category Distribution
    distribution = report_data.get("distribution")
    if distribution:
        story.append(Paragraph("<b>Problem Solving Distribution</b>", ParagraphStyle('H2', fontName='Times-Bold', fontSize=10, textColor=colors.HexColor('#0F172A'))))
        story.append(Spacer(1, 4))
        d_rows = [[Paragraph("Category Range", header_cell_style), Paragraph("Student Count", header_cell_style)]]
        for cat, count in distribution.items():
            d_rows.append([Paragraph(str(cat), cell_style), Paragraph(str(count), cell_bold_style)])
        t_d = Table(d_rows, colWidths=[4.0*inch, 3.0*inch])
        t_d.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0F172A')),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
            ('TOPPADDING', (0,0), (-1,-1), 3),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')])
        ]))
        story.append(t_d)
        story.append(Spacer(1, 10))

    # Top Students
    top_students = report_data.get("topStudents")
    if top_students:
        story.append(Paragraph("<b>Top Performers Leaderboard</b>", ParagraphStyle('H2', fontName='Times-Bold', fontSize=10, textColor=colors.HexColor('#0F172A'))))
        story.append(Spacer(1, 4))
        top_rows = [[
            Paragraph("Rank", header_cell_style),
            Paragraph("Reg No", header_cell_style),
            Paragraph("Name", header_cell_style),
            Paragraph("Dept", header_cell_style),
            Paragraph("Year", header_cell_style),
            Paragraph("Solved", header_cell_style),
            Paragraph("Rating", header_cell_style)
        ]]
        for idx, s in enumerate(top_students, 1):
            top_rows.append([
                Paragraph(f"#{idx}", cell_bold_style),
                Paragraph(s.get("reg_no", ""), cell_style),
                Paragraph(s.get("name", ""), cell_style),
                Paragraph(s.get("dept", ""), cell_style),
                Paragraph(s.get("year", ""), cell_style),
                Paragraph(str(s.get("total_solved", 0)), cell_bold_style),
                Paragraph(str(round(s["rating"], 1)) if s.get("rating") else "—", cell_style)
            ])
        t_top = Table(top_rows, colWidths=[0.5*inch, 1.2*inch, 2.3*inch, 0.9*inch, 0.6*inch, 0.7*inch, 0.8*inch])
        t_top.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0F172A')),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
            ('TOPPADDING', (0,0), (-1,-1), 3),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')])
        ]))
        story.append(t_top)
        story.append(Spacer(1, 10))

    # All Students
    all_students = report_data.get("allStudents")
    if all_students:
        story.append(Paragraph("<b>Student Performance Roster</b>", ParagraphStyle('H2', fontName='Times-Bold', fontSize=10, textColor=colors.HexColor('#0F172A'))))
        story.append(Spacer(1, 4))
        all_rows = [[
            Paragraph("S.No", header_cell_style),
            Paragraph("Reg No", header_cell_style),
            Paragraph("Name", header_cell_style),
            Paragraph("Dept", header_cell_style),
            Paragraph("Year", header_cell_style),
            Paragraph("Solved", header_cell_style),
            Paragraph("Status", header_cell_style)
        ]]
        for idx, s in enumerate(all_students[:100], 1):
            all_rows.append([
                Paragraph(str(idx), cell_style),
                Paragraph(s.get("reg_no", ""), cell_style),
                Paragraph(s.get("name", ""), cell_style),
                Paragraph(s.get("dept", ""), cell_style),
                Paragraph(s.get("year", ""), cell_style),
                Paragraph(str(s.get("total_solved") if s.get("total_solved") is not None else "—"), cell_bold_style),
                Paragraph(s.get("status", "UNVERIFIED"), cell_style)
            ])
        t_all = Table(all_rows, colWidths=[0.5*inch, 1.3*inch, 2.3*inch, 0.8*inch, 0.6*inch, 0.7*inch, 0.8*inch])
        t_all.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0F172A')),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
            ('TOPPADDING', (0,0), (-1,-1), 2.5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')])
        ]))
        story.append(t_all)
        story.append(Spacer(1, 10))

    # Participations
    participations = report_data.get("participations")
    if participations:
        story.append(Paragraph("<b>Official Contest Participation Log</b>", ParagraphStyle('H2', fontName='Times-Bold', fontSize=10, textColor=colors.HexColor('#0F172A'))))
        story.append(Spacer(1, 4))
        p_rows = [[
            Paragraph("S.No", header_cell_style),
            Paragraph("Contest", header_cell_style),
            Paragraph("Date", header_cell_style),
            Paragraph("Reg No", header_cell_style),
            Paragraph("Name", header_cell_style),
            Paragraph("Dept", header_cell_style),
            Paragraph("Solved", header_cell_style),
            Paragraph("Rank", header_cell_style)
        ]]
        for idx, p in enumerate(participations, 1):
            p_rows.append([
                Paragraph(str(idx), cell_style),
                Paragraph(p.get("contest_name", ""), cell_style),
                Paragraph(p.get("date", ""), cell_style),
                Paragraph(p.get("reg_no", ""), cell_style),
                Paragraph(p.get("student_name", ""), cell_style),
                Paragraph(p.get("dept", ""), cell_style),
                Paragraph(f"{p.get('problems_solved', 0)} / {p.get('total_problems', 4)}", cell_bold_style),
                Paragraph(str(p.get("rank", "-")), cell_style)
            ])
        t_p = Table(p_rows, colWidths=[0.4*inch, 1.5*inch, 0.8*inch, 1.1*inch, 1.5*inch, 0.6*inch, 0.6*inch, 0.5*inch])
        t_p.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0F172A')),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
            ('TOPPADDING', (0,0), (-1,-1), 3),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')])
        ]))
        story.append(t_p)

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes

