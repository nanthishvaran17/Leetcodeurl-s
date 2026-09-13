import os
import io
import datetime
from typing import Dict, List
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak, HRFlowable
)
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

def _to_int(val, default=0) -> int:
    try:
        if val is None or val == '—' or val == '':
            return default
        return int(float(str(val)))
    except (ValueError, TypeError):
        return default

def _to_float(val, default=0.0) -> float:
    try:
        if val is None or val == '—' or val == '':
            return default
        return float(str(val))
    except (ValueError, TypeError):
        return default

def _get_platform_solved(s: dict) -> int:
    pts = _to_int(s.get("profile_total_solved"))
    if pts > 0:
        return pts
    ts = _to_int(s.get("total_solved"))
    cts = _to_int(s.get("total_contest_solved") or s.get("contest_problems_solved") or s.get("problems_solved"))
    if ts > 4 or (ts > 0 and ts != cts):
        return ts
    return pts or ts

def _get_contest_solved(s: dict) -> int:
    return _to_int(
        s.get("total_contest_solved") or 
        s.get("contest_problems_solved") or 
        s.get("problems_solved") or 
        (s.get("total_solved") if _to_int(s.get("total_solved")) <= 4 else 0)
    )

def _get_contest_score(s: dict) -> int:
    return _to_int(s.get("contest_score") or s.get("score"))

def resolve_dept_full_name(d_raw: str, reg_no: str = "") -> str:
    r_upper = str(reg_no).upper()
    if "CC" in r_upper:
        return "Computer Science and Engineering (Cyber Security)"
    if "CI" in r_upper or "CIR" in r_upper:
        return "Computer Science and Engineering (Internet of Things)"
    d = str(d_raw).strip().upper()
    if d in ("CSE(CS)", "CS", "CYBER", "CYBER SECURITY", "CSE_CS", "CSE-CS", "CSE (CS)"):
        return "Computer Science and Engineering (Cyber Security)"
    if d in ("CSE(IOT)", "IOT", "INTERNET OF THINGS", "CSE_IOT", "CSE-IOT", "CSE (IOT)"):
        return "Computer Science and Engineering (Internet of Things)"
    if d in ("IT", "INFORMATION TECHNOLOGY"):
        return "Information Technology"
    if d in ("AIDS", "AI&DS", "AI-DS", "ARTIFICIAL INTELLIGENCE"):
        return "Artificial Intelligence and Data Science"
    if d in ("ECE", "ELECTRONICS"):
        return "Electronics and Communication Engineering"
    if d in ("EEE", "ELECTRICAL"):
        return "Electrical and Electronics Engineering"
    if d in ("MECH", "MECHANICAL"):
        return "Mechanical Engineering"
    if d in ("CIVIL",):
        return "Civil Engineering"
    if d in ("AGRI", "AGRICULTURE"):
        return "Agriculture Engineering"
    if d in ("BME", "BIOMEDICAL"):
        return "Biomedical Engineering"
    if d in ("CSE", "COMPUTER SCIENCE"):
        return "Computer Science and Engineering"
    return str(d_raw).strip() or "Computer Science and Engineering"

def resolve_dept_code(d_raw: str, reg_no: str = "") -> str:
    r_upper = str(reg_no).upper()
    if "CC" in r_upper:
        return "CSE(CS)"
    if "CI" in r_upper or "CIR" in r_upper:
        return "CSE(IOT)"
    d = str(d_raw).strip().upper()
    if d in ("CSE(CS)", "CS", "CYBER", "CYBER SECURITY", "CSE_CS", "CSE-CS", "CSE (CS)"):
        return "CSE(CS)"
    if d in ("CSE(IOT)", "IOT", "INTERNET OF THINGS", "CSE_IOT", "CSE-IOT", "CSE (IOT)"):
        return "CSE(IOT)"
    if d in ("IT", "INFORMATION TECHNOLOGY"):
        return "IT"
    if d in ("AIDS", "AI&DS", "AI-DS", "ARTIFICIAL INTELLIGENCE"):
        return "AIDS"
    if d in ("ECE", "ELECTRONICS"):
        return "ECE"
    if d in ("EEE", "ELECTRICAL"):
        return "EEE"
    if d in ("MECH", "MECHANICAL"):
        return "MECH"
    if d in ("CIVIL",):
        return "CIVIL"
    if d in ("AGRI", "AGRICULTURE"):
        return "AGRI"
    if d in ("BME", "BIOMEDICAL"):
        return "BME"
    if d in ("CSE", "COMPUTER SCIENCE"):
        return "CSE"
    return str(d_raw).strip() or "CSE"

def make_numbered_canvas(header_info: Dict[str, str]):
    class CustomNumberedCanvas(canvas.Canvas):
        """
        Two-pass canvas to dynamically compute and print 'Page X of Y' in footer,
        along with institutional security tags and generation timestamp.
        """
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._saved_page_states = []

        def showPage(self):
            self._saved_page_states.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            num_pages = len(self._saved_page_states)
            for state in self._saved_page_states:
                self.__dict__.update(state)
                self.draw_page_decorations(num_pages)
                super().showPage()
            super().save()

        def draw_page_decorations(self, page_count: int):
            self.saveState()
            self.setFont("Times-Roman", 7.5)
            self.setFillColor(colors.HexColor("#64748B"))
            
            p_width, p_height = landscape(A4)
            left_x = 28.8
            right_x = p_width - 28.8
            
            # Header Top Border Line on pages > 1
            if self._pageNumber > 1:
                self.setStrokeColor(colors.HexColor("#CBD5E1"))
                self.setLineWidth(0.5)
                self.line(left_x, p_height - 24, right_x, p_height - 24)
                self.drawString(left_x, p_height - 18, f"NANDHA ENGINEERING COLLEGE (AUTONOMOUS) • {header_info.get('dept', '')}")
                self.drawRightString(right_x, p_height - 18, f"{header_info.get('contest_name', '')} • OFFICIAL RECORD")

            # Footer Bottom Border Line
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(left_x, 30, right_x, 30)
            
            # Footer text
            left_footer = f"Nandha Engineering College, Erode – 638 052 | Confidential • Internal Academic Record"
            page_str = f"Page {self._pageNumber} of {page_count}"
            self.drawString(left_x, 18, left_footer)
            self.drawRightString(right_x, 18, page_str)
            self.restoreState()
    return CustomNumberedCanvas


def export_pdf_from_dataset(dataset: dict) -> bytes:
    """
    CANONICAL INSTITUTIONAL MULTI-PAGE PDF EXPORTER
    Generates high-resolution, multi-page, evidence-based PDF using the master intelligence engine.
    Fully content-driven dynamic pagination with zero artificial blank areas.
    """
    if "metadata" in dataset and "summary" in dataset and "departments" in dataset:
        from backend.pdf_v2.engine import build_intelligence_pdf
        return build_intelligence_pdf(dataset)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=0.4 * inch,
        rightMargin=0.4 * inch,
        topMargin=0.4 * inch,
        bottomMargin=0.4 * inch
    )

    story = []
    styles = getSampleStyleSheet()

    # Custom Typography (Times New Roman strictly) 
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Times-Bold',
        fontSize=13,
        leading=16,
        textColor=colors.HexColor('#1B365D'),
        alignment=1
    )
    sub_title_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Times-Bold',
        fontSize=9.5,
        leading=12,
        textColor=colors.HexColor('#2E5B88'),
        alignment=1
    )
    dept_style = ParagraphStyle(
        'DeptTitle',
        parent=styles['Normal'],
        fontName='Times-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.HexColor('#0F172A'),
        alignment=1
    )
    meta_style = ParagraphStyle(
        'DocMeta',
        parent=styles['Normal'],
        fontName='Times-Roman',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#64748B'),
        alignment=1
    )
    sec_hdr_style = ParagraphStyle(
        'SecHdr',
        parent=styles['Normal'],
        fontName='Times-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.white,
        alignment=1,
        keepWithNext=True
    )
    th_style = ParagraphStyle(
        'TH',
        parent=styles['Normal'],
        fontName='Times-Bold',
        fontSize=7.5,
        leading=9,
        textColor=colors.white,
        alignment=1,
        wordWrap='CJK'
    )
    td_style = ParagraphStyle(
        'TD',
        parent=styles['Normal'],
        fontName='Times-Roman',
        fontSize=7.5,
        leading=9,
        textColor=colors.HexColor('#1E293B'),
        alignment=1,
        wordWrap='CJK'
    )
    td_left = ParagraphStyle(
        'TDLeft',
        parent=styles['Normal'],
        fontName='Times-Roman',
        fontSize=7.5,
        leading=9,
        textColor=colors.HexColor('#1E293B'),
        alignment=0,
        wordWrap='CJK'
    )
    td_bold = ParagraphStyle(
        'TDBold',
        parent=styles['Normal'],
        fontName='Times-Bold',
        fontSize=7.5,
        leading=9,
        textColor=colors.HexColor('#0F172A'),
        alignment=1,
        wordWrap='CJK'
    )

    rows = dataset.get("rows", [])
    metrics = dataset.get("metrics", {})

    from backend.services.contest_discovery import get_immediately_previous_sunday_date, calculate_contest_number
    _prev_sun = get_immediately_previous_sunday_date()
    _def_cname = f"Weekly Contest {calculate_contest_number(_prev_sun)}"
    _def_cdate = _prev_sun.strftime("%d.%m.%Y")

    contest_name = dataset.get("contestName") or metrics.get("contestName") or dataset.get("contest_name") or _def_cname
    contest_date_str = dataset.get("sessionDate") or dataset.get("session_date") or _def_cdate
    snapshot_id = str(dataset.get("snapshotId") or dataset.get("snapshot_id") or dataset.get("reportId") or f"SNAPSHOT_{calculate_contest_number(_prev_sun)}")
    gen_time_str = dataset.get("generatedAtIST") or datetime.datetime.now().strftime("%d %b %Y, %I:%M %p IST")

    # Dynamic Department resolution helper
    def resolve_dept_full_name(d_raw: str, reg_no: str = "") -> str:
        r_upper = str(reg_no).upper()
        if "CC" in r_upper:
            return "Computer Science and Engineering (Cyber Security)"
        if "CI" in r_upper or "CIR" in r_upper:
            return "Computer Science and Engineering (Internet of Things)"
        d = str(d_raw).strip().upper()
        if d in ("CSE(CS)", "CS", "CYBER", "CYBER SECURITY", "CSE_CS", "CSE-CS", "CSE (CS)"):
            return "Computer Science and Engineering (Cyber Security)"
        if d in ("CSE(IOT)", "IOT", "INTERNET OF THINGS", "CSE_IOT", "CSE-IOT", "CSE (IOT)"):
            return "Computer Science and Engineering (Internet of Things)"
        if d in ("IT", "INFORMATION TECHNOLOGY"):
            return "Information Technology"
        if d in ("AIDS", "AI&DS", "AI-DS", "ARTIFICIAL INTELLIGENCE"):
            return "Artificial Intelligence and Data Science"
        if d in ("ECE", "ELECTRONICS"):
            return "Electronics and Communication Engineering"
        if d in ("EEE", "ELECTRICAL"):
            return "Electrical and Electronics Engineering"
        if d in ("MECH", "MECHANICAL"):
            return "Mechanical Engineering"
        if d in ("CIVIL",):
            return "Civil Engineering"
        if d in ("AGRI", "AGRICULTURE"):
            return "Agriculture Engineering"
        if d in ("BME", "BIOMEDICAL"):
            return "Biomedical Engineering"
        if d in ("CSE", "COMPUTER SCIENCE"):
            return "Computer Science and Engineering"
        return str(d_raw).strip() or "Computer Science and Engineering"

    def resolve_dept_code(d_raw: str, reg_no: str = "") -> str:
        r_upper = str(reg_no).upper()
        if "CC" in r_upper:
            return "CSE(CS)"
        if "CI" in r_upper or "CIR" in r_upper:
            return "CSE(IOT)"
        d = str(d_raw).strip().upper()
        if d in ("CSE(CS)", "CS", "CYBER", "CYBER SECURITY", "CSE_CS", "CSE-CS", "CSE (CS)"):
            return "CSE(CS)"
        if d in ("CSE(IOT)", "IOT", "INTERNET OF THINGS", "CSE_IOT", "CSE-IOT", "CSE (IOT)"):
            return "CSE(IOT)"
        if d in ("IT", "INFORMATION TECHNOLOGY"):
            return "IT"
        if d in ("AIDS", "AI&DS", "AI-DS", "ARTIFICIAL INTELLIGENCE"):
            return "AIDS"
        if d in ("ECE", "ELECTRONICS"):
            return "ECE"
        if d in ("EEE", "ELECTRICAL"):
            return "EEE"
        if d in ("MECH", "MECHANICAL"):
            return "MECH"
        if d in ("CIVIL",):
            return "CIVIL"
        if d in ("AGRI", "AGRICULTURE"):
            return "AGRI"
        if d in ("BME", "BIOMEDICAL"):
            return "BME"
        if d in ("CSE", "COMPUTER SCIENCE"):
            return "CSE"
        return str(d_raw).strip() or "CSE"

    def _get_platform_solved(s: dict) -> int:
        p = _to_int(s.get("profile_total_solved") or s.get("platform_total_solved") or s.get("cumulative_solved"))
        if p > 0:
            return p
        ts = _to_int(s.get("total_solved"))
        if ts > 4:
            return ts
        return 0

    def _get_contest_solved(s: dict) -> int:
        c = _to_int(s.get("total_contest_solved") or s.get("contest_problems_solved") or s.get("problems_solved"))
        if c > 0:
            return c
        ts = _to_int(s.get("total_solved"))
        if 0 < ts <= 4:
            return ts
        q_count = sum(1 for q in (s.get("q1"), s.get("q2"), s.get("q3"), s.get("q4")) if q and _to_int(q) >= 1)
        return q_count

    def _get_contest_score(s: dict) -> int:
        score = _to_int(s.get("contest_score") or s.get("score"))
        if score > 0:
            return score
        q1 = 1 if s.get("q1") and _to_int(s.get("q1")) >= 1 else 0
        q2 = 1 if s.get("q2") and _to_int(s.get("q2")) >= 1 else 0
        q3 = 1 if s.get("q3") and _to_int(s.get("q3")) >= 1 else 0
        q4 = 1 if s.get("q4") and _to_int(s.get("q4")) >= 1 else 0
        calc = q1 * 3 + q2 * 4 + q3 * 5 + q4 * 6
        if calc > 0:
            return calc
        c_solv = _get_contest_solved(s)
        if c_solv >= 4:
            return 18
        elif c_solv == 3:
            return 12
        elif c_solv == 2:
            return 7
        elif c_solv == 1:
            return 3
        return 0

    # Department & Year grouping
    dept_year_groups: Dict[str, Dict[str, List[dict]]] = {}
    for r in rows:
        reg_no = r.get("reg_no") or r.get("register_no") or ""
        d_raw = r.get("dept") or r.get("department_short") or r.get("department_name") or r.get("department") or "CSE"
        d_name = resolve_dept_full_name(d_raw, reg_no)
        y_name = r.get("year_level") or r.get("year") or "III"
        if "YEAR" in str(y_name).upper():
            y_name = str(y_name).upper().replace("YEAR", "").strip()
        if d_name not in dept_year_groups:
            dept_year_groups[d_name] = {}
        if y_name not in dept_year_groups[d_name]:
            dept_year_groups[d_name][y_name] = []
        dept_year_groups[d_name][y_name].append(r)

    departments_set = sorted(list(dept_year_groups.keys()))
    if len(departments_set) == 1:
        dept_header_text = f"Department of {departments_set[0]}"
    elif len(departments_set) == 2:
        dept_header_text = f"Department of {departments_set[0]} & {departments_set[1]}"
    elif len(departments_set) > 2:
        dept_header_text = "Institutional Performance Summary — All Academic Departments"
    else:
        dept_header_text = "Department of Computer Science and Engineering"

    # Calculations
    tot_students = len(rows)
    tot_attended = sum(1 for r in rows if r.get("participation_status") in ("PUBLIC_ATTENDED", "OFFICIAL_ATTENDED", "ATTENDED", "PUBLIC"))
    tot_not_attended = tot_students - tot_attended
    att_pct = (tot_attended / tot_students * 100) if tot_students > 0 else 0.0
    tot_platform_solved = sum(_get_platform_solved(r) for r in rows)
    avg_platform_solved = (tot_platform_solved / tot_students) if tot_students > 0 else 0.0
    tot_contest_solved = sum(_get_contest_solved(r) for r in rows)

    # Helper: Header Banner
    def build_header_flowables():
        logo_path = os.path.join(os.path.dirname(__file__), "..", "assets", "nandha_emblem.png")
        header_text_cells = [
            Paragraph("NANDHA ENGINEERING COLLEGE, ERODE – 638 052", title_style),
            Spacer(1, 1),
            Paragraph("(AUTONOMOUS) • ESTD 2001 | Approved by AICTE & Affiliated to Anna University", meta_style),
            Spacer(1, 1),
            Paragraph(dept_header_text.upper(), dept_style),
            Spacer(1, 1),
            Paragraph(f"LEETCODE PERFORMANCE — {contest_name.upper()}", sub_title_style),
            Spacer(1, 1),
            Paragraph(f"Report Date: {contest_date_str}   |   Snapshot ID: {snapshot_id}   |   Generated: {gen_time_str}", meta_style)
        ]
        if os.path.exists(logo_path):
            try:
                img = Image(logo_path, width=0.95*inch, height=0.75*inch)
                t_hdr = Table([[img, header_text_cells]], colWidths=[1.1*inch, 9.75*inch])
                t_hdr.setStyle(TableStyle([
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('ALIGN', (0, 0), (0, 0), 'LEFT'),
                    ('ALIGN', (1, 0), (1, 0), 'CENTER'),
                ]))
                return [t_hdr]
            except Exception:
                return header_text_cells
        return header_text_cells

    # SECTION 1: HEADER & EXECUTIVE DASHBOARD
    story.extend(build_header_flowables())
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#1B365D'), spaceAfter=6))

    # KPI Summary Cards Table
    kpi_card_data = [
        [
            Paragraph("<b>TOTAL ACTIVE STUDENTS</b>", sec_hdr_style),
            Paragraph("<b>OFFICIAL ATTENDED</b>", sec_hdr_style),
            Paragraph("<b>PUBLIC NOT ATTENDED</b>", sec_hdr_style),
            Paragraph("<b>TOTAL PLATFORM SOLVED</b>", sec_hdr_style)
        ],
        [
            Paragraph(f"<font size=11><b>{tot_students}</b></font><br/><font size=7 color='#64748B'>Verified Roster</font>", td_bold),
            Paragraph(f"<font size=11 color='#059669'><b>{tot_attended}</b></font><br/><font size=7 color='#059669'>{att_pct:.1f}% Attendance</font>", td_bold),
            Paragraph(f"<font size=11 color='#DC2626'><b>{tot_not_attended}</b></font><br/><font size=7 color='#DC2626'>{100-att_pct:.1f}% Absent</font>", td_bold),
            Paragraph(f"<font size=11 color='#1B365D'><b>{tot_platform_solved:,}</b></font><br/><font size=7 color='#64748B'>Avg {avg_platform_solved:.1f}/std</font>", td_bold)
        ]
    ]
    t_kpi = Table(kpi_card_data, colWidths=[2.7125*inch]*4)
    t_kpi.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#1B365D')),
        ('BACKGROUND', (1, 0), (1, 0), colors.HexColor('#059669')),
        ('BACKGROUND', (2, 0), (2, 0), colors.HexColor('#DC2626')),
        ('BACKGROUND', (3, 0), (3, 0), colors.HexColor('#2E5B88')),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#F8FAFC')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(t_kpi)
    story.append(Spacer(1, 8))

    # Executive Overview Narrative Table
    overview_text = (
        f"<b>Official Executive Overview:</b> During the Sunday 08:00 AM – 09:30 AM IST contest window for <b>{contest_name}</b>, "
        f"a total of <b>{tot_attended}</b> out of <b>{tot_students}</b> active students officially participated ({att_pct:.1f}% attendance rate). "
        f"The cumulative problem-solving tally across the institutional database stands at <b>{tot_platform_solved:,}</b> problems solved. "
        f"All metrics are source-validated and locked under immutable snapshot <code>{snapshot_id}</code>."
    )
    t_narrative = Table([[Paragraph(overview_text, td_left)]], colWidths=[10.85*inch])
    t_narrative.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F0F9FF')),
        ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#0284C7')),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(t_narrative)
    story.append(Spacer(1, 8))

    # SECTION 2: LIVE CONTEST PERFORMANCE MATRIX
    c_4q_tot = sum(1 for s in rows if _get_contest_solved(s) >= 4)
    c_3q_tot = sum(1 for s in rows if _get_contest_solved(s) == 3)
    c_2q_tot = sum(1 for s in rows if _get_contest_solved(s) == 2)
    c_1q_tot = sum(1 for s in rows if _get_contest_solved(s) == 1)
    c_0q_tot = sum(1 for s in rows if _get_contest_solved(s) == 0)

    contest_summary_table = [
        [Paragraph(f"<b>{contest_name.upper()} — LIVE CONTEST PERFORMANCE MATRIX</b>", sec_hdr_style), "", "", "", "", ""],
        [
            Paragraph("<b>4/4 Solved (Perfect)</b>", th_style),
            Paragraph("<b>3/4 Solved</b>", th_style),
            Paragraph("<b>2/4 Solved</b>", th_style),
            Paragraph("<b>1/4 Solved</b>", th_style),
            Paragraph("<b>0/4 Attempted</b>", th_style),
            Paragraph("<b>Total Contest Solves</b>", th_style)
        ],
        [
            Paragraph(f"<b>{c_4q_tot}</b>", td_bold),
            Paragraph(f"<b>{c_3q_tot}</b>", td_bold),
            Paragraph(f"<b>{c_2q_tot}</b>", td_bold),
            Paragraph(f"<b>{c_1q_tot}</b>", td_bold),
            Paragraph(f"<b>{c_0q_tot}</b>", td_bold),
            Paragraph(f"<font color='#1B365D'><b>{tot_contest_solved}</b></font>", td_bold)
        ]
    ]
    t_csum = Table(contest_summary_table, colWidths=[1.8083*inch]*6, repeatRows=2)
    t_csum.setStyle(TableStyle([
        ('SPAN', (0, 0), (5, 0)),
        ('BACKGROUND', (0, 0), (5, 0), colors.HexColor('#1B365D')),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#2E5B88')),
        ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor('#FFFFFF')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(t_csum)
    story.append(Spacer(1, 10))

    # SECTION 3: DEPARTMENT-WISE SUMMARY (Flows dynamically without artificial page break)
    dept_table_data = [
        [Paragraph("<b>INSTITUTIONAL DEPARTMENT COMPARATIVE SUMMARY</b>", sec_hdr_style), "", "", "", "", "", "", "", ""],
        [
            Paragraph("<b>S.No</b>", th_style),
            Paragraph("<b>Department Name</b>", th_style),
            Paragraph("<b>Students</b>", th_style),
            Paragraph("<b>Last Wk Solved</b>", th_style),
            Paragraph("<b>Curr Wk Solved</b>", th_style),
            Paragraph("<b>Delta Solved</b>", th_style),
            Paragraph("<b>Attended</b>", th_style),
            Paragraph("<b>Not Attended</b>", th_style),
            Paragraph("<b>Attendance %</b>", th_style)
        ]
    ]

    for idx, (d_name, y_dict) in enumerate(dept_year_groups.items(), 1):
        d_students = [s for y_list in y_dict.values() for s in y_list]
        d_count = len(d_students)
        d_curr_solved = sum(_get_platform_solved(s) for s in d_students)
        d_contest_solved = sum(_get_contest_solved(s) for s in d_students)
        d_last_solved = max(0, d_curr_solved - d_contest_solved)
        d_delta = d_contest_solved
        d_att = sum(1 for s in d_students if s.get("participation_status") in ("PUBLIC_ATTENDED", "OFFICIAL_ATTENDED", "ATTENDED", "PUBLIC"))
        d_not_att = d_count - d_att
        d_pct = (d_att / d_count * 100) if d_count > 0 else 0.0

        dept_table_data.append([
            Paragraph(str(idx), td_style),
            Paragraph(f"<b>{d_name}</b>", td_left),
            Paragraph(str(d_count), td_style),
            Paragraph(f"{d_last_solved:,}", td_style),
            Paragraph(f"<b>{d_curr_solved:,}</b>", td_style),
            Paragraph(f"<font color='#059669'>+{d_delta:,}</font>", td_bold),
            Paragraph(f"<font color='#059669'>{d_att}</font>", td_bold),
            Paragraph(f"<font color='#DC2626'>{d_not_att}</font>", td_style),
            Paragraph(f"<b>{d_pct:.1f}%</b>", td_bold),
        ])

    # Total row
    is_multi_dept = len(dept_year_groups) > 1
    total_label = "COLLEGE AGGREGATE (TOTAL)" if is_multi_dept else "DEPARTMENT TOTAL (AGGREGATE)"

    dept_table_data.append([
        Paragraph(f"<b>{total_label}</b>", td_bold),
        "",
        Paragraph(f"<b>{tot_students}</b>", td_bold),
        Paragraph(f"<b>{max(0, tot_platform_solved - tot_contest_solved):,}</b>", td_bold),
        Paragraph(f"<b>{tot_platform_solved:,}</b>", td_bold),
        Paragraph(f"<font color='#059669'><b>+{tot_contest_solved:,}</b></font>", td_bold),
        Paragraph(f"<font color='#059669'><b>{tot_attended}</b></font>", td_bold),
        Paragraph(f"<font color='#DC2626'><b>{tot_not_attended}</b></font>", td_bold),
        Paragraph(f"<b>{att_pct:.1f}%</b>", td_bold),
    ])

    t_dept = Table(dept_table_data, colWidths=[0.5*inch, 3.15*inch, 0.85*inch, 1.1*inch, 1.1*inch, 1.0*inch, 0.85*inch, 0.95*inch, 1.35*inch], repeatRows=2)
    t_dept.setStyle(TableStyle([
        ('SPAN', (0, 0), (8, 0)),
        ('SPAN', (0, -1), (1, -1)),
        ('BACKGROUND', (0, 0), (8, 0), colors.HexColor('#1B365D')),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#2E5B88')),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#F1F5F9')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(t_dept)
    story.append(Spacer(1, 10))

    # SECTION 4: ACADEMIC YEAR & BATCH MATRIX (Flows dynamically)
    batch_table_data = [
        [Paragraph("<b>ACADEMIC YEAR & BATCH PROBLEM-SOLVING DISTRIBUTION</b>", sec_hdr_style), "", "", "", "", "", "", ""],
        [
            Paragraph("<b>Department</b>", th_style),
            Paragraph("<b>Year / Batch</b>", th_style),
            Paragraph("<b>Students</b>", th_style),
            Paragraph("<b>>500 Solved</b>", th_style),
            Paragraph("<b>250–500</b>", th_style),
            Paragraph("<b>100–250</b>", th_style),
            Paragraph("<b>1–99</b>", th_style),
            Paragraph("<b>0 Solved</b>", th_style)
        ]
    ]

    for d_name, y_dict in dept_year_groups.items():
        for y_name, y_students in sorted(y_dict.items()):
            cnt = len(y_students)
            p_gt500 = sum(1 for s in y_students if _get_platform_solved(s) >= 500)
            p_250_500 = sum(1 for s in y_students if 250 <= _get_platform_solved(s) < 500)
            p_lt250 = sum(1 for s in y_students if 100 <= _get_platform_solved(s) < 250)
            p_lt100 = sum(1 for s in y_students if 1 <= _get_platform_solved(s) < 100)
            p_0 = sum(1 for s in y_students if _get_platform_solved(s) == 0)

            batch_table_data.append([
                Paragraph(d_name, td_left),
                Paragraph(f"<b>{y_name} Year</b>", td_style),
                Paragraph(str(cnt), td_style),
                Paragraph(str(p_gt500), td_style),
                Paragraph(str(p_250_500), td_style),
                Paragraph(str(p_lt250), td_style),
                Paragraph(str(p_lt100), td_style),
                Paragraph(f"<font color='#DC2626'><b>{p_0}</b></font>" if p_0 > 0 else "0", td_bold if p_0 > 0 else td_style)
            ])

    t_batch = Table(batch_table_data, colWidths=[3.15*inch, 1.3*inch, 0.9*inch, 1.1*inch, 1.1*inch, 1.1*inch, 1.1*inch, 1.1*inch], repeatRows=2)
    t_batch.setStyle(TableStyle([
        ('SPAN', (0, 0), (7, 0)),
        ('BACKGROUND', (0, 0), (7, 0), colors.HexColor('#1B365D')),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#2E5B88')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(t_batch)
    story.append(Spacer(1, 10))

    # SECTION 5: TOP PERFORMERS (Problems Solved & Contest Score)
    top_table_data = [
        [Paragraph("<b>INSTITUTIONAL TOP 10 LEETCODE PERFORMERS</b>", sec_hdr_style), "", "", "", "", "", ""],
        [
            Paragraph("<b>Rank</b>", th_style),
            Paragraph("<b>Register No</b>", th_style),
            Paragraph("<b>Student Name</b>", th_style),
            Paragraph("<b>Department</b>", th_style),
            Paragraph("<b>Year</b>", th_style),
            Paragraph("<b>Problems Solved</b>", th_style),
            Paragraph("<b>Score</b>", th_style)
        ]
    ]
    sorted_top = sorted(
        rows,
        key=lambda s: (-_get_contest_score(s), -_get_contest_solved(s), s.get("name") or "")
    )[:10]
    for r_idx, s in enumerate(sorted_top, 1):
        reg_no = s.get("reg_no") or s.get("register_no") or ""
        d_raw = s.get("dept") or s.get("department_short") or s.get("department") or ""
        d_code = resolve_dept_code(d_raw, reg_no)
        y_val = s.get("year") or s.get("year_level") or ""
        if "YEAR" in str(y_val).upper():
            y_val = str(y_val).upper().replace("YEAR", "").strip()
        c_solv = _get_contest_solved(s)
        c_score = _get_contest_score(s)

        top_table_data.append([
            Paragraph(str(r_idx), td_bold),
            Paragraph(reg_no, td_style),
            Paragraph(f"<b>{s.get('name') or ''}</b>", td_left),
            Paragraph(d_code, td_style),
            Paragraph(y_val, td_style),
            Paragraph(f"<font color='#059669'><b>{c_solv}</b></font>", td_bold),
            Paragraph(f"<font color='#1B365D'><b>{c_score}</b></font>", td_bold)
        ])

    t_top = Table(top_table_data, colWidths=[0.6*inch, 1.6*inch, 3.45*inch, 1.7*inch, 0.8*inch, 1.35*inch, 1.35*inch], repeatRows=2)
    t_top.setStyle(TableStyle([
        ('SPAN', (0, 0), (6, 0)),
        ('BACKGROUND', (0, 0), (6, 0), colors.HexColor('#1B365D')),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#2E5B88')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(t_top)
    story.append(Spacer(1, 10))

    # SECTION 6: CONTEST PUBLIC ATTENDED ROSTER (Flows dynamically & splits cleanly across pages)
    attended_rows = [
        r for r in rows
        if r.get("participation_status") in ("PUBLIC_ATTENDED", "OFFICIAL_ATTENDED", "ATTENDED", "PUBLIC")
    ]
    attended_rows.sort(key=lambda s: (
        resolve_dept_full_name(s.get("dept") or s.get("department_name") or s.get("department") or "", s.get("reg_no") or ""),
        s.get("year_level") or s.get("year") or "",
        -_get_contest_score(s),
        -_get_contest_solved(s),
        s.get("name") or s.get("student_name") or ""
    ))

    roster_table_data = [
        [Paragraph(f"<b>OFFICIAL CONTEST PUBLIC ATTENDED ROSTER ({len(attended_rows)} STUDENTS)</b>", sec_hdr_style), "", "", "", "", "", "", "", "", ""],
        [
            Paragraph("<b>S.No</b>", th_style),
            Paragraph("<b>Reg No</b>", th_style),
            Paragraph("<b>Student Name</b>", th_style),
            Paragraph("<b>Dept</b>", th_style),
            Paragraph("<b>Year</b>", th_style),
            Paragraph("<b>Q1</b>", th_style),
            Paragraph("<b>Q2</b>", th_style),
            Paragraph("<b>Q3</b>", th_style),
            Paragraph("<b>Q4</b>", th_style),
            Paragraph("<b>Score</b>", th_style)
        ]
    ]

    if len(attended_rows) == 0:
        roster_table_data.append([
            Paragraph("—", td_style),
            Paragraph("PUBLIC ATTENDED ROSTER — 0 STUDENTS: No verified official participants for this contest.", td_left),
            "", "", "", "", "", "", "", ""
        ])
        t_roster = Table(roster_table_data, colWidths=[0.5*inch, 1.5*inch, 3.15*inch, 1.2*inch, 0.7*inch, 0.7*inch, 0.7*inch, 0.7*inch, 0.7*inch, 1.0*inch], repeatRows=2)
        t_roster.setStyle(TableStyle([
            ('SPAN', (0, 0), (9, 0)),
            ('SPAN', (1, 2), (9, 2)),
            ('BACKGROUND', (0, 0), (9, 0), colors.HexColor('#1B365D')),
            ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#2E5B88')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        story.append(t_roster)
    else:
        for idx, s in enumerate(attended_rows, 1):
            reg_no = s.get("reg_no") or s.get("register_no") or ""
            d_raw = s.get("dept") or s.get("department_short") or s.get("department") or ""
            d_code = resolve_dept_code(d_raw, reg_no)
            y_val = s.get("year") or s.get("year_level") or ""
            if "YEAR" in str(y_val).upper():
                y_val = str(y_val).upper().replace("YEAR", "").strip()

            c_solved = _get_contest_solved(s)
            q1 = "1" if s.get("q1") or c_solved >= 1 else "0"
            q2 = "1" if s.get("q2") or c_solved >= 2 else "0"
            q3 = "1" if s.get("q3") or c_solved >= 3 else "0"
            q4 = "1" if s.get("q4") or c_solved >= 4 else "0"
            score_val = _get_contest_score(s)

            roster_table_data.append([
                Paragraph(str(idx), td_style),
                Paragraph(reg_no, td_style),
                Paragraph(s.get("name") or "", td_left),
                Paragraph(d_code, td_style),
                Paragraph(y_val, td_style),
                Paragraph(f"<font color='#059669'>{q1}</font>", td_bold),
                Paragraph(f"<font color='#059669'>{q2}</font>", td_bold),
                Paragraph(f"<font color='#059669'>{q3}</font>", td_bold),
                Paragraph(f"<font color='#059669'>{q4}</font>", td_bold),
                Paragraph(f"<b>{score_val}</b>", td_bold)
            ])

        t_roster = Table(roster_table_data, colWidths=[0.5*inch, 1.5*inch, 3.15*inch, 1.2*inch, 0.7*inch, 0.7*inch, 0.7*inch, 0.7*inch, 0.7*inch, 1.0*inch], repeatRows=2)
        t_roster.setStyle(TableStyle([
            ('SPAN', (0, 0), (9, 0)),
            ('BACKGROUND', (0, 0), (9, 0), colors.HexColor('#1B365D')),
            ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#2E5B88')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('TOPPADDING', (0, 0), (-1, -1), 2.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ]))
        story.append(t_roster)

    canvas_maker = make_numbered_canvas({
        "dept": dept_header_text.upper(),
        "contest_name": f"LEETCODE PERFORMANCE — {contest_name.upper()}"
    })
    doc.build(story, canvasmaker=canvas_maker)
    return buffer.getvalue()

