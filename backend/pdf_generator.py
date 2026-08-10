import io
import datetime
from typing import Optional
from sqlalchemy.orm import Session

from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable
from reportlab.lib.units import inch

from backend.models import Student, WeeklySession, WeeklySessionSnapshot, Department, WeeklyStudentProgress
from backend.config import settings
from backend.logger import logger

def generate_pdf_summary_report(db: Session, dept_id: Optional[int] = None) -> bytes:
    """
    Generates a PDF executive summary report using ReportLab.
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

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#1B365D'),
        alignment=0
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#555555')
    )

    header_cell_style = ParagraphStyle(
        'HeaderCell',
        fontName='Helvetica-Bold',
        fontSize=10,
        textColor=colors.white,
        alignment=1
    )

    cell_style = ParagraphStyle(
        'NormalCell',
        fontName='Helvetica',
        fontSize=9,
        leading=11,
        textColor=colors.HexColor('#333333')
    )

    cell_bold_style = ParagraphStyle(
        'BoldCell',
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.HexColor('#1B365D')
    )

    # 1. Header Section
    dept_obj = db.query(Department).filter(Department.id == dept_id).first() if dept_id else None
    dept_text = f"Department: {dept_obj.name}" if dept_obj else "All Departments"

    story.append(Paragraph(settings.COLLEGE_NAME.upper(), title_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph(f"Weekly LeetCode Session Performance Report & Leaderboard | {dept_text}", subtitle_style))
    story.append(Paragraph(f"Generated on: {datetime.datetime.now().strftime('%d-%b-%Y %I:%M %p IST')}", subtitle_style))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#1B365D'), spaceAfter=15))

    # 2. Executive Summary Metrics
    latest_session = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()
    
    student_query = db.query(Student).filter(Student.is_active == True)
    if dept_id:
        student_query = student_query.filter(Student.department_id == dept_id)
    students = student_query.all()
    total_students = len(students)

    started_count = 0
    not_started_count = 0
    total_progress = 0

    if latest_session:
        snapshots = db.query(WeeklySessionSnapshot).filter(
            WeeklySessionSnapshot.session_id == latest_session.id
        ).all()
        
        stud_ids = {s.id for s in students}
        for sn in snapshots:
            if sn.student_id in stud_ids:
                if sn.status == "STARTED":
                    started_count += 1
                    total_progress += sn.problems_added
                else:
                    not_started_count += 1

    avg_progress = round(total_progress / total_students, 1) if total_students > 0 else 0.0

    # Top student
    top_student = sorted(students, key=lambda x: (x.stats.total_solved if x.stats else 0), reverse=True)
    top_name = top_student[0].name if top_student else "N/A"

    summary_data = [
        [Paragraph("Total Students", header_cell_style), Paragraph("Started", header_cell_style),
         Paragraph("Not Started", header_cell_style), Paragraph("Avg Progress", header_cell_style), Paragraph("Top Performer", header_cell_style)],
        [Paragraph(str(total_students), cell_bold_style), Paragraph(str(started_count), cell_bold_style),
         Paragraph(str(not_started_count), cell_bold_style), Paragraph(f"+{avg_progress}", cell_bold_style), Paragraph(top_name, cell_bold_style)]
    ]

    summary_table = Table(summary_data, colWidths=[1.1*inch, 1.1*inch, 1.1*inch, 1.2*inch, 2.3*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1B365D')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#F8F9FA')),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 15))

    # 3. Top College Leaderboard Table
    story.append(Paragraph("College Leaderboard Summary (Top Performers)", ParagraphStyle('SecTitle', parent=styles['Heading2'], textColor=colors.HexColor('#1B365D'))))
    story.append(Spacer(1, 6))

    lb_headers = [Paragraph("Rank", header_cell_style), Paragraph("Register No", header_cell_style),
                  Paragraph("Student Name", header_cell_style), Paragraph("Dept", header_cell_style),
                  Paragraph("Year", header_cell_style), Paragraph("Sec", header_cell_style),
                  Paragraph("Solved", header_cell_style), Paragraph("Progress", header_cell_style)]

    lb_rows = [lb_headers]

    for rank, s in enumerate(top_student[:15], 1):
        latest_prog = db.query(WeeklyStudentProgress).filter(WeeklyStudentProgress.student_id == s.id).order_by(WeeklyStudentProgress.id.desc()).first()
        prog_str = f"+{latest_prog.weekly_progress}" if latest_prog else "+0"

        lb_rows.append([
            Paragraph(f"#{rank}", cell_bold_style),
            Paragraph(s.reg_no, cell_style),
            Paragraph(s.name, cell_style),
            Paragraph(s.department.code if s.department else "", cell_style),
            Paragraph(s.year_level, cell_style),
            Paragraph(s.section.name if s.section else "", cell_style),
            Paragraph(str(s.stats.total_solved if s.stats else 0), cell_bold_style),
            Paragraph(prog_str, cell_style)
        ])

    lb_table = Table(lb_rows, colWidths=[0.6*inch, 1.2*inch, 2.0*inch, 0.8*inch, 0.6*inch, 0.5*inch, 0.7*inch, 0.8*inch])
    lb_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1B365D')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E0E0E0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8F9FA')])
    ]))

    story.append(lb_table)

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
