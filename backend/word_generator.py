import os
import io
import datetime
from typing import Optional
from sqlalchemy.orm import Session

try:
    import docx
    from docx.shared import Inches, Pt, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False

from backend.models import Student, Department, LeetCodeProfileStats, WeeklySession
from backend.config import settings

def set_cell_background(cell, fill_hex: str):
    """Utility to set XML background color for docx table cell."""
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), fill_hex)
    tcPr.append(shd)

def generate_word_report(db: Session, dept_id: Optional[int] = None) -> bytes:
    """
    Generates an executive Microsoft Word (.docx) report using Times New Roman font ONLY.
    Features official college header branding, executive summary table, and student performance roster.
    """
    doc = docx.Document() if DOCX_AVAILABLE else None

    if not doc:
        # Fallback if docx is not installed: create a basic text buffer
        buffer = io.BytesIO()
        content = f"NANDHA ENGINEERING COLLEGE (AUTONOMOUS)\n" \
                  f"LeetCode Performance Summary Report - {datetime.date.today().strftime('%d.%m.%Y')}\n\n"
        buffer.write(content.encode('utf-8'))
        buffer.seek(0)
        return buffer.getvalue()

    # Set Document Margins to 0.75 inch
    sections = doc.sections
    for s in sections:
        s.top_margin = Inches(0.75)
        s.bottom_margin = Inches(0.75)
        s.left_margin = Inches(0.75)
        s.right_margin = Inches(0.75)

    # 1. Header Banner
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_title = p_title.add_run("NANDHA ENGINEERING COLLEGE (AUTONOMOUS)")
    run_title.font.name = "Times New Roman"
    run_title.font.size = Pt(16)
    run_title.font.bold = True
    run_title.font.color.rgb = RGBColor(15, 23, 42)

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_sub = p_sub.add_run("Approved by AICTE, New Delhi & Affiliated to Anna University, Chennai | Erode - 638 052, Tamil Nadu")
    run_sub.font.name = "Times New Roman"
    run_sub.font.size = Pt(9)
    run_sub.font.bold = True
    run_sub.font.color.rgb = RGBColor(2, 132, 199)

    dept_obj = db.query(Department).filter(Department.id == dept_id).first() if dept_id else None
    dept_name = f"Department of {dept_obj.name}" if dept_obj else "Official College LeetCode Performance Summary"

    p_report = doc.add_paragraph()
    p_report.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_report = p_report.add_run(f"{dept_name}\nWeekly Performance & Contest Evaluation Report - {datetime.date.today().strftime('%d.%m.%Y')}")
    run_report.font.name = "Times New Roman"
    run_report.font.size = Pt(11)
    run_report.font.bold = True
    run_report.font.color.rgb = RGBColor(51, 65, 85)

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # 2. Executive Summary Metrics Table
    query = db.query(Student).filter(Student.is_active == True)
    if dept_id:
        query = query.filter(Student.department_id == dept_id)
    students = query.all()

    total_count = len(students)
    active_solvers = [s for s in students if s.stats and s.stats.total_solved > 0]
    above_500 = [s for s in students if s.stats and s.stats.total_solved > 500]
    total_problems = sum(s.stats.total_solved for s in students if s.stats)

    doc.add_heading("I. Executive Summary Metrics", level=2)
    p_head = doc.paragraphs[-1]
    for r in p_head.runs:
        r.font.name = "Times New Roman"
        r.font.color.rgb = RGBColor(15, 23, 42)

    table_exec = doc.add_table(rows=5, cols=2)
    table_exec.alignment = WD_TABLE_ALIGNMENT.CENTER
    exec_data = [
        ("Total Enrolled Students Monitored", str(total_count)),
        ("Active Problems Solvers (Total Solved > 0)", str(len(active_solvers))),
        ("Advanced Star Solvers (Total Solved > 500)", str(len(above_500))),
        ("Total Problems Solved Across Roster", f"{total_problems:,}"),
        ("Report Generation Timestamp", datetime.datetime.now().strftime("%d-%b-%Y %I:%M %p IST"))
    ]

    for row_idx, (label, val) in enumerate(exec_data):
        row_cells = table_exec.rows[row_idx].cells
        
        # Label cell
        p_l = row_cells[0].paragraphs[0]
        run_l = p_l.add_run(label)
        run_l.font.name = "Times New Roman"
        run_l.font.size = Pt(10)
        run_l.font.bold = True
        
        # Value cell
        p_v = row_cells[1].paragraphs[0]
        p_v.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        run_v = p_v.add_run(val)
        run_v.font.name = "Times New Roman"
        run_v.font.size = Pt(10)
        run_v.font.bold = True
        run_v.font.color.rgb = RGBColor(2, 132, 199)

        if row_idx % 2 == 0:
            set_cell_background(row_cells[0], "F8FAFC")
            set_cell_background(row_cells[1], "F8FAFC")

    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    # 3. Student Performance Roster Table
    doc.add_heading("II. Student Performance Roster (Top Performers)", level=2)
    p_head2 = doc.paragraphs[-1]
    for r in p_head2.runs:
        r.font.name = "Times New Roman"
        r.font.color.rgb = RGBColor(15, 23, 42)

    sorted_students = sorted(students, key=lambda s: (s.stats.total_solved if s.stats else 0), reverse=True)[:50]

    headers = ["Rank", "Reg No", "Student Name", "Dept", "Year", "Easy", "Med", "Hard", "Total", "Rating"]
    table_roster = doc.add_table(rows=1 + len(sorted_students), cols=len(headers))
    table_roster.alignment = WD_TABLE_ALIGNMENT.CENTER

    hdr_cells = table_roster.rows[0].cells
    for i, h in enumerate(headers):
        p = hdr_cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(h)
        run.font.name = "Times New Roman"
        run.font.size = Pt(9.5)
        run.font.bold = True
        run.font.color.rgb = RGBColor(255, 255, 255)
        set_cell_background(hdr_cells[i], "0F172A")

    for idx, s in enumerate(sorted_students, start=1):
        st = s.stats
        row_cells = table_roster.rows[idx].cells
        row_vals = [
            f"#{idx}",
            s.reg_no,
            s.name,
            s.department.code if s.department else "",
            s.year_level,
            str(st.easy_solved if st else 0),
            str(st.medium_solved if st else 0),
            str(st.hard_solved if st else 0),
            str(st.total_solved if st else 0),
            f"{round(st.contest_rating, 1):,}" if (st and st.contest_rating) else "Unrated"
        ]

        for i, val in enumerate(row_vals):
            p = row_cells[i].paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if i in [0, 1, 3, 4, 5, 6, 7, 8, 9] else WD_ALIGN_PARAGRAPH.LEFT
            run = p.add_run(val)
            run.font.name = "Times New Roman"
            run.font.size = Pt(9)
            if i in [0, 8]:
                run.font.bold = True
                run.font.color.rgb = RGBColor(15, 23, 42)

        if idx % 2 == 1:
            for cell in row_cells:
                set_cell_background(cell, "F1F5F9")

    # Save to byte stream
    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()


def generate_snapshot_word_report(db: Session, snapshot_id: str) -> bytes:
    """
    Generates an executive Microsoft Word (.docx) report using Times New Roman font ONLY,
    based on the frozen HODSnapshot data.
    """
    doc = docx.Document() if DOCX_AVAILABLE else None

    from backend.models import HODSnapshot
    snapshot = db.query(HODSnapshot).filter(HODSnapshot.snapshot_id == snapshot_id).first()
    if not snapshot:
        raise ValueError("Snapshot not found")
        
    metrics = snapshot.metrics

    if not doc:
        buffer = io.BytesIO()
        content = f"NANDHA ENGINEERING COLLEGE (AUTONOMOUS)\n" \
                  f"Executive Snapshot: {snapshot.title}\n\n"
        buffer.write(content.encode('utf-8'))
        buffer.seek(0)
        return buffer.getvalue()

    # Set Document Margins to 0.75 inch
    sections = doc.sections
    for s in sections:
        s.top_margin = Inches(0.75)
        s.bottom_margin = Inches(0.75)
        s.left_margin = Inches(0.75)
        s.right_margin = Inches(0.75)

    # 1. Header Banner
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_title = p_title.add_run("NANDHA ENGINEERING COLLEGE (AUTONOMOUS)")
    run_title.font.name = "Times New Roman"
    run_title.font.size = Pt(16)
    run_title.font.bold = True
    run_title.font.color.rgb = RGBColor(15, 23, 42)

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_sub = p_sub.add_run("Approved by AICTE, New Delhi & Affiliated to Anna University, Chennai | Erode - 638 052, Tamil Nadu")
    run_sub.font.name = "Times New Roman"
    run_sub.font.size = Pt(9)
    run_sub.font.bold = True
    run_sub.font.color.rgb = RGBColor(2, 132, 199)

    p_report = doc.add_paragraph()
    p_report.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_report = p_report.add_run(f"Executive Point-in-Time Snapshot: {snapshot.title}")
    run_report.font.name = "Times New Roman"
    run_report.font.size = Pt(11)
    run_report.font.bold = True
    run_report.font.color.rgb = RGBColor(51, 65, 85)

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # 2. Executive Summary Metrics Table
    total_students = metrics.get("total_students", 0)
    synced_students = metrics.get("synced_students", 0)
    failed_sync = metrics.get("failed_sync", 0)
    total_solved = metrics.get("total_solved_college", 0)

    doc.add_heading("I. Executive Summary Metrics", level=2)
    p_head = doc.paragraphs[-1]
    for r in p_head.runs:
        r.font.name = "Times New Roman"
        r.font.color.rgb = RGBColor(15, 23, 42)

    table_exec = doc.add_table(rows=5, cols=2)
    table_exec.alignment = WD_TABLE_ALIGNMENT.CENTER
    dt_str = snapshot.created_at.strftime('%d-%b-%Y %I:%M %p IST') if isinstance(snapshot.created_at, datetime.datetime) else snapshot.created_at
    exec_data = [
        ("Total Enrolled Students Monitored", str(total_students)),
        ("Verified Active Solvers", str(synced_students)),
        ("Unverified / Failed Sync", str(failed_sync)),
        ("Total Problems Solved (Verified)", f"{total_solved:,}"),
        ("Frozen Timestamp", dt_str)
    ]

    for row_idx, (label, val) in enumerate(exec_data):
        row_cells = table_exec.rows[row_idx].cells
        p_l = row_cells[0].paragraphs[0]
        run_l = p_l.add_run(label)
        run_l.font.name = "Times New Roman"
        run_l.font.size = Pt(10)
        run_l.font.bold = True
        
        p_v = row_cells[1].paragraphs[0]
        p_v.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        run_v = p_v.add_run(val)
        run_v.font.name = "Times New Roman"
        run_v.font.size = Pt(10)
        run_v.font.bold = True
        run_v.font.color.rgb = RGBColor(2, 132, 199)

        if row_idx % 2 == 0:
            set_cell_background(row_cells[0], "F8FAFC")
            set_cell_background(row_cells[1], "F8FAFC")

    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    # 3. Student Performance Roster Table
    doc.add_heading("II. Snapshot Leaderboard (Top Performers)", level=2)
    p_head2 = doc.paragraphs[-1]
    for r in p_head2.runs:
        r.font.name = "Times New Roman"
        r.font.color.rgb = RGBColor(15, 23, 42)

    all_students = []
    dept_summary = metrics.get("department_summary", {})
    for dept, d_stats in dept_summary.items():
        if "students" in d_stats:
            for s in d_stats["students"]:
                s["dept_name"] = dept
                all_students.append(s)
                
    sorted_students = sorted(all_students, key=lambda x: x.get("total_solved") or 0, reverse=True)[:50]

    headers = ["Rank", "Reg No", "Student Name", "Dept", "Verification", "Total", "Rating"]
    table_roster = doc.add_table(rows=1 + len(sorted_students), cols=len(headers))
    table_roster.alignment = WD_TABLE_ALIGNMENT.CENTER

    hdr_cells = table_roster.rows[0].cells
    for i, h in enumerate(headers):
        p = hdr_cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(h)
        run.font.name = "Times New Roman"
        run.font.size = Pt(9.5)
        run.font.bold = True
        run.font.color.rgb = RGBColor(255, 255, 255)
        set_cell_background(hdr_cells[i], "0F172A")

    for idx, s in enumerate(sorted_students, start=1):
        row_cells = table_roster.rows[idx].cells
        row_vals = [
            f"#{idx}",
            s.get("reg_no", ""),
            s.get("name", ""),
            s.get("dept_name", ""),
            "Verified" if s.get("verified") else "Unverified",
            str(s.get("total_solved") or 0),
            str(round(s.get("contest_rating") or 0, 1)) if s.get("contest_rating") else "Unrated"
        ]

        for i, val in enumerate(row_vals):
            p = row_cells[i].paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if i in [0, 1, 3, 4, 5, 6] else WD_ALIGN_PARAGRAPH.LEFT
            run = p.add_run(val)
            run.font.name = "Times New Roman"
            run.font.size = Pt(9)
            if i in [0, 5]:
                run.font.bold = True
                run.font.color.rgb = RGBColor(15, 23, 42)
            if i == 4 and val == "Unverified":
                run.font.color.rgb = RGBColor(156, 0, 6) # Red

        if idx % 2 == 1:
            for cell in row_cells:
                set_cell_background(cell, "F1F5F9")

    # Save to byte stream
    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()


def generate_universal_word(report_data: dict) -> bytes:
    """Generates a universal Word document directly from the unified JSON dataset."""
    doc = Document()
    set_document_margins(doc, 0.75, 0.75, 0.75, 0.75)
    
    # Title
    doc.add_heading('NANDHA ENGINEERING COLLEGE', 0)
    p = doc.paragraphs[-1]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for r in p.runs:
        r.font.name = "Times New Roman"
        r.font.bold = True
        
    doc.add_heading(f"Report: {report_data.get('title', 'Universal Report')}", level=1)
    p = doc.paragraphs[-1]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for r in p.runs:
        r.font.name = "Times New Roman"
        r.font.color.rgb = RGBColor(15, 23, 42)
        
    doc.add_paragraph(f"Generated: {report_data.get('generatedAt', '')}")
    doc.add_paragraph(f"Status: {report_data.get('dataStatus', 'UNKNOWN')}")
    
    metrics = report_data.get("metrics", {})
    if metrics:
        doc.add_heading("Executive Summary Metrics", level=2)
        table = doc.add_table(rows=1, cols=2)
        table.style = 'Table Grid'
        
        hdr_cells = table.rows[0].cells
        hdr_cells[0].text = 'Metric'
        hdr_cells[1].text = 'Value'
        
        for k, v in metrics.items():
            row_cells = table.add_row().cells
            row_cells[0].text = str(k)
            row_cells[1].text = str(v)
            
    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()
