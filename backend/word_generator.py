import os
import io
import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

try:
    import docx
    from docx import Document
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

def set_document_margins(doc, top=0.75, bottom=0.75, left=0.75, right=0.75):
    """Utility to set margins for all sections in docx."""
    for section in doc.sections:
        section.top_margin = Inches(top)
        section.bottom_margin = Inches(bottom)
        section.left_margin = Inches(left)
        section.right_margin = Inches(right)

def set_table_borders(table, color="CCCCCC", sz="4", val="single"):
    """Applies clean borders to all cells in a docx table."""
    for row in table.rows:
        for cell in row.cells:
            tcPr = cell._tc.get_or_add_tcPr()
            tcBorders = OxmlElement('w:tcBorders')
            for border_name in ['top', 'left', 'bottom', 'right']:
                border = OxmlElement(f'w:{border_name}')
                border.set(qn('w:val'), val)
                border.set(qn('w:sz'), sz)
                border.set(qn('w:space'), '0')
                border.set(qn('w:color'), color)
                tcBorders.append(border)
            tcPr.append(tcBorders)

def generate_word_report(db: Session, dept_id: Optional[int] = None) -> bytes:
    """
    CANONICAL OFFICIAL WEEKLY PERFORMANCE WORD REPORT (.DOCX) GENERATOR.
    Produces the official two-department institucional report using exact Times New Roman typography,
    landscape layout, official table headers, mutually exclusive problem-solving categories,
    and real SQLite contest results (preventing roster-attended conflation).
    """
    if not DOCX_AVAILABLE:
        buffer = io.BytesIO()
        content = f"NANDHA ENGINEERING COLLEGE, ERODE - 638 052.\n" \
                  f"Leetcode Performance - Weekly Report\n" \
                  f"Date: {datetime.date.today().strftime('%d.%m.%Y')}\n\n"
        buffer.write(content.encode('utf-8'))
        buffer.seek(0)
        return buffer.getvalue()

    doc = Document()
    
    # Configure Landscape A4 layout
    from docx.enum.section import WD_ORIENT
    for section in doc.sections:
        section.orientation = WD_ORIENT.LANDSCAPE
        section.page_width = Inches(11.69)
        section.page_height = Inches(8.27)
        section.top_margin = Inches(0.5)
        section.bottom_margin = Inches(0.5)
        section.left_margin = Inches(0.5)
        section.right_margin = Inches(0.5)

    from backend.routes.weekly_contests import get_normalized_contest_data, derive_academic_year

    # 1. Dynamically identify Current and Last completed weekly contest sessions
    completed_sessions = db.query(WeeklySession).filter(
        WeeklySession.status.in_(['COMPLETED', 'FINALIZED'])
    ).order_by(WeeklySession.id.desc()).all()

    current_sess = completed_sessions[0] if len(completed_sessions) > 0 else None
    last_sess = completed_sessions[1] if len(completed_sessions) > 1 else None

    curr_norm = get_normalized_contest_data(current_sess.id, db=db) if current_sess else {"rows": [], "metrics": {}}
    last_norm = get_normalized_contest_data(last_sess.id, db=db) if last_sess else {"rows": [], "metrics": {}}

    all_students = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None))).all()
    all_depts = db.query(Department).order_by(Department.id.asc()).all()

    target_depts = [d for d in all_depts if d.id == dept_id] if dept_id else all_depts

    batch_definitions = [
        ("2023 - 2027", "IV"),
        ("2024 - 2028", "III"),
        ("2025 - 2029", "II")
    ]

    report_date_str = datetime.date.today().strftime("%d.%m.%Y")

    for dept_index, dept in enumerate(target_depts):
        if dept_index > 0:
            doc.add_page_break()

        # ── 1. OFFICIAL INSTITUTIONAL HEADER ──
        p_inst = doc.add_paragraph()
        p_inst.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_inst.paragraph_format.space_after = Pt(2)
        r_inst = p_inst.add_run("NANDHA ENGINEERING COLLEGE, ERODE - 638 052.")
        r_inst.font.name = "Times New Roman"
        r_inst.font.size = Pt(14)
        r_inst.font.bold = True
        r_inst.font.color.rgb = RGBColor(15, 23, 42)

        p_dept = doc.add_paragraph()
        p_dept.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_dept.paragraph_format.space_after = Pt(2)
        dept_title = f"Department of {dept.name}" if not dept.name.startswith("Department of") else dept.name
        r_dept = p_dept.add_run(dept_title)
        r_dept.font.name = "Times New Roman"
        r_dept.font.size = Pt(11)
        r_dept.font.bold = True
        r_dept.font.color.rgb = RGBColor(30, 41, 59)

        p_date = doc.add_paragraph()
        p_date.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        p_date.paragraph_format.space_after = Pt(2)
        r_date = p_date.add_run(f"Date: {report_date_str}")
        r_date.font.name = "Times New Roman"
        r_date.font.size = Pt(10)
        r_date.font.bold = True

        p_title = doc.add_paragraph()
        p_title.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p_title.paragraph_format.space_after = Pt(2)
        r_title = p_title.add_run("Leetcode Performance - Weekly Report")
        r_title.font.name = "Times New Roman"
        r_title.font.size = Pt(10.5)
        r_title.font.bold = True
        r_title.font.underline = True

        p_coord = doc.add_paragraph()
        p_coord.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p_coord.paragraph_format.space_after = Pt(6)
        r_coord = p_coord.add_run("Name & Designation of the Academic Coordinator:")
        r_coord.font.name = "Times New Roman"
        r_coord.font.size = Pt(10)
        r_coord.font.bold = True

        # ── 2. OFFICIAL MULTI-LEVEL TABLE ──
        # 2 header rows + 6 data rows (3 batches x 2 weeks) = 8 rows, 13 columns
        table = doc.add_table(rows=8, cols=13)
        table.alignment = WD_TABLE_ALIGNMENT.CENTER

        col_widths = [
            Inches(1.2), Inches(0.9),
            Inches(0.7), Inches(0.7), Inches(0.7), Inches(0.7), Inches(0.75),
            Inches(0.65), Inches(0.65), Inches(0.65), Inches(0.65),
            Inches(0.95), Inches(0.95)
        ]

        for row in table.rows:
            for c_idx, width in enumerate(col_widths):
                row.cells[c_idx].width = width

        # Row 0 (Main Headers)
        # Merge Batch vertically: cell(0,0) with cell(1,0)
        table.cell(0, 0).merge(table.cell(1, 0))
        table.cell(0, 0).paragraphs[0].text = "Batch"

        # Merge Number of Students vertically: cell(0,1) with cell(1,1)
        table.cell(0, 1).merge(table.cell(1, 1))
        table.cell(0, 1).paragraphs[0].text = "Number of Students\n(Total Count)"

        # Merge Number of Problems Solved horizontally: cell(0,2) to cell(0,6)
        table.cell(0, 2).merge(table.cell(0, 6))
        table.cell(0, 2).paragraphs[0].text = "Number of Problems Solved"

        # Merge Weekly Contest Attended horizontally: cell(0,7) to cell(0,10)
        table.cell(0, 7).merge(table.cell(0, 10))
        table.cell(0, 7).paragraphs[0].text = "Weekly Contest Attended"

        # Merge Leetcode Contest Rating and Ranking: cell(0,11) to cell(0,12)
        table.cell(0, 11).merge(table.cell(0, 12))
        table.cell(0, 11).paragraphs[0].text = "Leetcode Contest Rating and Ranking"

        # Row 1 (Sub-Headers)
        sub_headers = [
            (2, "Above 500"),
            (3, "250 - 500"),
            (4, "Less than 250"),
            (5, "Less than 100"),
            (6, "Not yet started"),
            (7, "4 Q Solved"),
            (8, "3 Q Solved"),
            (9, "2 Q Solved"),
            (10, "1 Q Solved"),
            (11, "Rating:\nAbove 1500"),
            (12, "Ranking:\nBelow 20000")
        ]

        for col_idx, sub_title in sub_headers:
            table.cell(1, col_idx).paragraphs[0].text = sub_title

        # Style Header Rows
        for r_idx in range(2):
            for c_idx in range(13):
                cell = table.cell(r_idx, c_idx)
                set_cell_background(cell, "0F172A")
                cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
                for p in cell.paragraphs:
                    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    for run in p.runs:
                        run.font.name = "Times New Roman"
                        run.font.size = Pt(8.5)
                        run.font.bold = True
                        run.font.color.rgb = RGBColor(255, 255, 255)

        # ── 3. DATA ROWS FOR EACH BATCH (LAST WEEK & CURRENT WEEK) ──
        dept_students = [s for s in all_students if s.department_id == dept.id]
        curr_row = 2

        for batch_label, yr_lvl in batch_definitions:
            b_studs = [s for s in dept_students if derive_academic_year(s) == yr_lvl]
            b_reg_nos = {s.reg_no for s in b_studs}
            total_students_count = len(b_studs)

            # Mutually exclusive problem solving categories
            above_500 = sum(1 for s in b_studs if s.stats and (s.stats.total_solved or 0) > 500)
            between_250_500 = sum(1 for s in b_studs if s.stats and 250 <= (s.stats.total_solved or 0) <= 500)
            between_100_249 = sum(1 for s in b_studs if s.stats and 100 <= (s.stats.total_solved or 0) < 250)
            between_1_99 = sum(1 for s in b_studs if s.stats and 1 <= (s.stats.total_solved or 0) < 100)
            not_started = sum(1 for s in b_studs if not s.stats or (s.stats.total_solved or 0) == 0)

            rating_above_1500 = sum(1 for s in b_studs if s.stats and s.stats.contest_rating and s.stats.contest_rating > 1500)
            ranking_below_20000 = sum(1 for s in b_studs if s.stats and s.stats.contest_global_ranking and 0 < s.stats.contest_global_ranking < 20000)

            # Last Week Contest Stats (from normalized dataset)
            last_rows = [r for r in last_norm.get('rows', []) if r['reg_no'] in b_reg_nos]
            last_4q = sum(1 for r in last_rows if r.get('total_solved') == 4)
            last_3q = sum(1 for r in last_rows if r.get('total_solved') == 3)
            last_2q = sum(1 for r in last_rows if r.get('total_solved') == 2)
            last_1q = sum(1 for r in last_rows if r.get('total_solved') == 1)

            # Current Week Contest Stats (from normalized dataset)
            curr_rows = [r for r in curr_norm.get('rows', []) if r['reg_no'] in b_reg_nos]
            curr_4q = sum(1 for r in curr_rows if r.get('total_solved') == 4)
            curr_3q = sum(1 for r in curr_rows if r.get('total_solved') == 3)
            curr_2q = sum(1 for r in curr_rows if r.get('total_solved') == 2)
            curr_1q = sum(1 for r in curr_rows if r.get('total_solved') == 1)

            # Last Week Row
            last_week_cells = table.rows[curr_row].cells
            last_week_vals = [
                f"{batch_label}\n(Last Week)",
                str(total_students_count),
                str(above_500),
                str(between_250_500),
                str(between_100_249),
                str(between_1_99),
                str(not_started),
                str(last_4q),
                str(last_3q),
                str(last_2q),
                str(last_1q),
                str(rating_above_1500),
                str(ranking_below_20000)
            ]

            # Current Week Row
            curr_week_cells = table.rows[curr_row + 1].cells
            curr_week_vals = [
                f"{batch_label}\n(Current Week)",
                str(total_students_count),
                str(above_500),
                str(between_250_500),
                str(between_100_249),
                str(between_1_99),
                str(not_started),
                str(curr_4q),
                str(curr_3q),
                str(curr_2q),
                str(curr_1q),
                str(rating_above_1500),
                str(ranking_below_20000)
            ]

            for c_i in range(13):
                # Last week cell
                p_l = last_week_cells[c_i].paragraphs[0]
                p_l.text = last_week_vals[c_i]
                p_l.alignment = WD_ALIGN_PARAGRAPH.CENTER
                last_week_cells[c_i].vertical_alignment = WD_ALIGN_VERTICAL.CENTER
                for run in p_l.runs:
                    run.font.name = "Times New Roman"
                    run.font.size = Pt(8.5)
                    if c_i in (0, 1):
                        run.font.bold = True

                # Current week cell
                p_c = curr_week_cells[c_i].paragraphs[0]
                p_c.text = curr_week_vals[c_i]
                p_c.alignment = WD_ALIGN_PARAGRAPH.CENTER
                curr_week_cells[c_i].vertical_alignment = WD_ALIGN_VERTICAL.CENTER
                for run in p_c.runs:
                    run.font.name = "Times New Roman"
                    run.font.size = Pt(8.5)
                    if c_i in (0, 1):
                        run.font.bold = True

                set_cell_background(last_week_cells[c_i], "FFFFFF")
                set_cell_background(curr_week_cells[c_i], "F8FAFC")

            curr_row += 2

        # Apply clean table borders
        set_table_borders(table, color="64748B", sz="4", val="single")

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

    set_document_margins(doc, 0.75, 0.75, 0.75, 0.75)

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
                run.font.color.rgb = RGBColor(156, 0, 6)

        if idx % 2 == 1:
            for cell in row_cells:
                set_cell_background(cell, "F1F5F9")

    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()


def generate_universal_word(report_data: dict) -> bytes:
    """Generates a universal Word document directly from the unified JSON dataset."""
    if not DOCX_AVAILABLE:
        buffer = io.BytesIO()
        buffer.write(f"Report: {report_data.get('title', 'Universal Report')}\n".encode('utf-8'))
        buffer.seek(0)
        return buffer.getvalue()

    doc = Document()
    set_document_margins(doc, 0.75, 0.75, 0.75, 0.75)
    
    # Title Banner
    p_college = doc.add_paragraph()
    p_college.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_coll = p_college.add_run("NANDHA ENGINEERING COLLEGE (AUTONOMOUS)")
    r_coll.font.name = "Times New Roman"
    r_coll.font.size = Pt(16)
    r_coll.font.bold = True
    r_coll.font.color.rgb = RGBColor(15, 23, 42)
    
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_title = p_title.add_run(report_data.get('title', 'Universal Performance Report'))
    r_title.font.name = "Times New Roman"
    r_title.font.size = Pt(13)
    r_title.font.bold = True
    r_title.font.color.rgb = RGBColor(2, 132, 199)
    
    p_meta = doc.add_paragraph()
    p_meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    dt_str = report_data.get('generatedAt', '')
    if 'T' in dt_str:
        try:
            dt_obj = datetime.datetime.fromisoformat(dt_str.replace('Z', ''))
            dt_str = dt_obj.strftime("%d-%b-%Y %I:%M %p")
        except Exception:
            pass
    r_meta = p_meta.add_run(f"Generated: {dt_str}   |   Status: {report_data.get('dataStatus', 'READY')}")
    r_meta.font.name = "Times New Roman"
    r_meta.font.size = Pt(9.5)
    r_meta.font.color.rgb = RGBColor(100, 116, 139)
    
    doc.add_paragraph().paragraph_format.space_after = Pt(6)
    
    # 1. Executive Summary Metrics Table
    metrics = report_data.get("metrics", {})
    if metrics:
        doc.add_heading("I. Executive Summary Metrics", level=2)
        p_h = doc.paragraphs[-1]
        for r in p_h.runs:
            r.font.name = "Times New Roman"
            r.font.color.rgb = RGBColor(15, 23, 42)
            
        metric_items = list(metrics.items())
        table_m = doc.add_table(rows=len(metric_items), cols=2)
        table_m.alignment = WD_TABLE_ALIGNMENT.CENTER
        
        for r_idx, (k, v) in enumerate(metric_items):
            row_cells = table_m.rows[r_idx].cells
            
            p_k = row_cells[0].paragraphs[0]
            label_text = str(k)
            r_k = p_k.add_run(label_text)
            r_k.font.name = "Times New Roman"
            r_k.font.size = Pt(10)
            r_k.font.bold = True
            
            p_v = row_cells[1].paragraphs[0]
            p_v.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            val_str = f"{v:,}" if isinstance(v, (int, float)) and v > 999 else str(v if v is not None else "—")
            r_v = p_v.add_run(val_str)
            r_v.font.name = "Times New Roman"
            r_v.font.size = Pt(10)
            r_v.font.bold = True
            r_v.font.color.rgb = RGBColor(2, 132, 199)
            
            if r_idx % 2 == 0:
                set_cell_background(row_cells[0], "F8FAFC")
                set_cell_background(row_cells[1], "F8FAFC")

        doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # 2. Category Distribution Table (if present)
    distribution = report_data.get("distribution")
    if distribution:
        doc.add_heading("II. Problem Solving Category Summary", level=2)
        p_h2 = doc.paragraphs[-1]
        for r in p_h2.runs:
            r.font.name = "Times New Roman"
            r.font.color.rgb = RGBColor(15, 23, 42)

        dist_items = list(distribution.items())
        table_d = doc.add_table(rows=1 + len(dist_items), cols=2)
        table_d.alignment = WD_TABLE_ALIGNMENT.CENTER
        
        hdr_cells = table_d.rows[0].cells
        hdr_cells[0].paragraphs[0].add_run("Category Range").font.bold = True
        hdr_cells[1].paragraphs[0].add_run("Student Count").font.bold = True
        hdr_cells[1].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
        set_cell_background(hdr_cells[0], "0F172A")
        set_cell_background(hdr_cells[1], "0F172A")
        for cell in hdr_cells:
            for r in cell.paragraphs[0].runs:
                r.font.name = "Times New Roman"
                r.font.color.rgb = RGBColor(255, 255, 255)

        for idx, (cat, cnt) in enumerate(dist_items, start=1):
            row_cells = table_d.rows[idx].cells
            row_cells[0].paragraphs[0].add_run(str(cat)).font.name = "Times New Roman"
            
            pv = row_cells[1].paragraphs[0]
            pv.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            rv = pv.add_run(str(cnt))
            rv.font.name = "Times New Roman"
            rv.font.bold = True
            
            if idx % 2 == 1:
                set_cell_background(row_cells[0], "F1F5F9")
                set_cell_background(row_cells[1], "F1F5F9")

        doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # 3. Top Performers Table (if topStudents present)
    top_students = report_data.get("topStudents")
    if top_students:
        doc.add_heading("III. Top Performers Leaderboard", level=2)
        p_h3 = doc.paragraphs[-1]
        for r in p_h3.runs:
            r.font.name = "Times New Roman"
            r.font.color.rgb = RGBColor(15, 23, 42)

        headers = ["Rank", "Reg No", "Student Name", "Dept", "Year", "Easy", "Med", "Hard", "Total Solved", "Rating"]
        table_top = doc.add_table(rows=1 + len(top_students), cols=len(headers))
        table_top.alignment = WD_TABLE_ALIGNMENT.CENTER
        
        hdr_cells = table_top.rows[0].cells
        for i, h in enumerate(headers):
            p = hdr_cells[i].paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = p.add_run(h)
            run.font.name = "Times New Roman"
            run.font.size = Pt(9)
            run.font.bold = True
            run.font.color.rgb = RGBColor(255, 255, 255)
            set_cell_background(hdr_cells[i], "0F172A")
            
        for idx, s in enumerate(top_students, start=1):
            row_cells = table_top.rows[idx].cells
            row_vals = [
                f"#{idx}",
                s.get("reg_no", ""),
                s.get("name", ""),
                s.get("dept", ""),
                s.get("year", ""),
                str(s.get("easy", 0)),
                str(s.get("medium", 0)),
                str(s.get("hard", 0)),
                str(s.get("total_solved", 0)),
                f"{round(s['rating'], 1):,}" if s.get("rating") else "Unrated"
            ]
            for i, val in enumerate(row_vals):
                p = row_cells[i].paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER if i != 2 else WD_ALIGN_PARAGRAPH.LEFT
                run = p.add_run(val)
                run.font.name = "Times New Roman"
                run.font.size = Pt(8.5)
                if i in (0, 8):
                    run.font.bold = True
                    run.font.color.rgb = RGBColor(15, 23, 42)
                    
            if idx % 2 == 1:
                for c in row_cells:
                    set_cell_background(c, "F1F5F9")

        doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # 4. Full Roster Table (if allStudents present)
    all_students = report_data.get("allStudents")
    if all_students:
        doc.add_heading("IV. Student Performance Master Roster", level=2)
        p_h4 = doc.paragraphs[-1]
        for r in p_h4.runs:
            r.font.name = "Times New Roman"
            r.font.color.rgb = RGBColor(15, 23, 42)

        headers = ["S.No", "Reg No", "Student Name", "Dept", "Year", "Total Solved", "Status"]
        table_all = doc.add_table(rows=1 + len(all_students), cols=len(headers))
        table_all.alignment = WD_TABLE_ALIGNMENT.CENTER
        
        hdr_cells = table_all.rows[0].cells
        for i, h in enumerate(headers):
            p = hdr_cells[i].paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = p.add_run(h)
            run.font.name = "Times New Roman"
            run.font.size = Pt(9)
            run.font.bold = True
            run.font.color.rgb = RGBColor(255, 255, 255)
            set_cell_background(hdr_cells[i], "0F172A")
            
        for idx, s in enumerate(all_students, start=1):
            row_cells = table_all.rows[idx].cells
            row_vals = [
                str(idx),
                s.get("reg_no", ""),
                s.get("name", ""),
                s.get("dept", ""),
                s.get("year", ""),
                str(s.get("total_solved") if s.get("total_solved") is not None else "—"),
                s.get("status", "UNVERIFIED")
            ]
            for i, val in enumerate(row_vals):
                p = row_cells[i].paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER if i != 2 else WD_ALIGN_PARAGRAPH.LEFT
                run = p.add_run(val)
                run.font.name = "Times New Roman"
                run.font.size = Pt(8.5)
                if i == 5:
                    run.font.bold = True
                    run.font.color.rgb = RGBColor(2, 132, 199)
                if i == 6 and val == "UNVERIFIED":
                    run.font.color.rgb = RGBColor(220, 38, 38)
                elif i == 6 and val == "VERIFIED":
                    run.font.color.rgb = RGBColor(16, 185, 129)
                    
            if idx % 2 == 1:
                for c in row_cells:
                    set_cell_background(c, "F8FAFC")

        doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # 5. Official Contest Participations Table (if participations present)
    participations = report_data.get("participations")
    if participations:
        doc.add_heading("V. Official Contest Participation Log", level=2)
        p_h5 = doc.paragraphs[-1]
        for r in p_h5.runs:
            r.font.name = "Times New Roman"
            r.font.color.rgb = RGBColor(15, 23, 42)

        headers = ["S.No", "Contest Name", "Date", "Reg No", "Student Name", "Dept", "Score", "Rank"]
        table_p = doc.add_table(rows=1 + len(participations), cols=len(headers))
        table_p.alignment = WD_TABLE_ALIGNMENT.CENTER
        
        hdr_cells = table_p.rows[0].cells
        for i, h in enumerate(headers):
            p = hdr_cells[i].paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = p.add_run(h)
            run.font.name = "Times New Roman"
            run.font.size = Pt(9)
            run.font.bold = True
            run.font.color.rgb = RGBColor(255, 255, 255)
            set_cell_background(hdr_cells[i], "0F172A")
            
        for idx, p_item in enumerate(participations, start=1):
            row_cells = table_p.rows[idx].cells
            row_vals = [
                str(idx),
                p_item.get("contest_name", ""),
                p_item.get("date", ""),
                p_item.get("reg_no", ""),
                p_item.get("student_name", ""),
                p_item.get("dept", ""),
                f"{p_item.get('problems_solved', 0)} / {p_item.get('total_problems', 4)}",
                str(p_item.get("rank", "-"))
            ]
            for i, val in enumerate(row_vals):
                p = row_cells[i].paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER if i not in (1, 4) else WD_ALIGN_PARAGRAPH.LEFT
                run = p.add_run(val)
                run.font.name = "Times New Roman"
                run.font.size = Pt(8.5)
                if i in (1, 6):
                    run.font.bold = True
                    
            if idx % 2 == 1:
                for c in row_cells:
                    set_cell_background(c, "F8FAFC")

    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()

