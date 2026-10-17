import io
import os
import re
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas
from typing import Any, Callable, Tuple, List, Dict

class NumberedCanvas(canvas.Canvas):
    _startPage: Callable[[], None]
    _pagesize: Tuple[float, float]
    _pageNumber: int

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
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont('Helvetica-Bold', 8)
        self.setFillColor(colors.HexColor("#475569"))
        self.drawRightString(self._pagesize[0] - 25, 15, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()


def _safe_str(val: Any, default: str = "—") -> str:
    if val is None:
        return default
    s = str(val).strip()
    if not s or s.lower() in ("none", "null", "nan"):
        return default
    return s


def export_dynamic_pdf(dataset: dict) -> bytes:
    """
    Institutional Dynamic PDF Exporter for Nandha Engineering College.
    Generates publication-quality, A4-landscape reports with:
      - Institutional header & logo
      - Smart curated columns matching report type
      - Semantic status badges
      - Clean pagination (repeatRows=1, Page X of Y)
      - Guaranteed zero LayoutError crashes
    """
    output = io.BytesIO()

    rows = dataset.get("rows") or dataset.get("allStudents") or dataset.get("all_rows") or dataset.get("all_students_current") or []
    first_row = rows[0] if rows else {}

    contest_name = str(
        dataset.get("contestName")
        or (dataset.get("current_session") or {}).get("contest_name")
        or dataset.get("title")
        or dataset.get("sessionName")
        or "WEEKLY CONTEST"
    ).split("\n")[0].strip()

    session_date = str(
        dataset.get("sessionDate")
        or dataset.get("session_date")
        or (dataset.get("current_session") or {}).get("session_date")
        or dataset.get("report_date")
        or ""
    ).strip()

    report_type = str(dataset.get("reportType") or dataset.get("report_type") or "").upper().strip()
    raw_title = dataset.get("reportTitle") or dataset.get("title") or ""

    prev_c_lbl = str(dataset.get("prevContest") or (dataset.get("wowSummary") or {}).get("prevContest") or "Last Week").strip()
    curr_c_lbl = str(dataset.get("currContest") or (dataset.get("wowSummary") or {}).get("currContest") or contest_name or "This Week").strip()

    is_wow = (
        report_type in ("WEEK_ON_WEEK_INTELLIGENCE", "WOW_INTEL", "WEEK_ON_WEEK")
        or (bool(rows) and any(k in first_row for k in ("prev_status", "curr_status", "solved_delta", "trend")))
        or "wowSummary" in dataset
    )

    is_five_week = (report_type in ("FIVE_WEEK_PERFORMANCE_TREND", "FIVE_WEEK_TREND")) or ("c1_solved" in first_row)
    is_historical = (report_type == "HISTORICAL_CONTEST_INTELLIGENCE") or ("weeklyData" in first_row)
    is_single_contest = (
        any(k in report_type for k in ("CONTEST_PERFORMANCE", "OFFICIAL_CONTEST", "SUNDAY_LIVE", "SUNDAY_CONTEST", "WEEKLY_CONTEST", "SINGLE_CONTEST", "SINGLE_SHEET"))
        or any(k in first_row for k in ("q1_display", "q1_time", "contest_solved", "q1", "contest_easy"))
        or (bool(session_date or contest_name) and report_type in ("12TH_TNEA_CUTOFF_ANALYSIS", "HOD_DEPARTMENT_INTELLIGENCE", "LEADERBOARD", "WEEKLY_STUDENT_PERFORMANCE"))
    ) and not is_historical and not is_wow and not is_five_week and "COORDINATOR" not in report_type

    # Sort rows to show top performers first
    def _row_sort_key(r):
        sol_raw = r.get("total_solved") or r.get("solved") or r.get("contest_solved") or 0
        if isinstance(sol_raw, str) and "/" in sol_raw:
            try:
                sol = int(sol_raw.split("/")[0])
            except Exception:
                sol = 0
        else:
            try:
                sol = int(sol_raw)
            except Exception:
                sol = 0

        rnk_raw = r.get("rank") or r.get("contest_rank") or r.get("global_rank") or r.get("contest_global_rank")
        try:
            rnk = int(rnk_raw) if rnk_raw is not None else 999999
        except Exception:
            rnk = 999999

        return (0 if sol > 0 else 1, -sol, rnk, str(r.get("name") or ""))

    if is_wow:
        def _wow_sort_key(r):
            try:
                sno = int(r.get("s_no") or 0)
            except Exception:
                sno = 99999
            return (sno if sno > 0 else 99999, str(r.get("reg_no") or ""))
        sorted_rows = sorted(rows, key=_wow_sort_key)
    elif rows and not is_five_week and not is_historical:
        sorted_rows = sorted(rows, key=_row_sort_key)
    else:
        sorted_rows = list(rows)

    # Base page dimensions: A4 Landscape
    base_width, doc_height = landscape(A4)
    margin = 20

    # Title Determination
    if is_wow:
        report_title = f"WEEK-ON-WEEK INTELLIGENCE — {prev_c_lbl.upper()} VS {curr_c_lbl.upper()}"
    elif is_five_week:
        d_title = dataset.get("title") or dataset.get("reportTitle")
        report_title = (d_title.upper() if d_title else "FIVE-WEEK LONGITUDINAL PERFORMANCE MATRIX")
    elif is_historical:
        session_headers = dataset.get("sessionHeaders", [])
        if session_headers and len(session_headers) >= 1:
            first_c = session_headers[0].get("contestNum")
            last_c = session_headers[-1].get("contestNum")
            if first_c and last_c and first_c != last_c:
                report_title = f"WEEKLY CONTEST {first_c} TO {last_c} — HISTORICAL INTELLIGENCE REPORT"
            elif first_c:
                report_title = f"WEEKLY CONTEST {first_c} — HISTORICAL INTELLIGENCE REPORT"
            else:
                report_title = "HISTORICAL INTELLIGENCE REPORT"
        else:
            report_title = "HISTORICAL INTELLIGENCE REPORT"
    elif is_single_contest:
        report_title = f"{contest_name.upper()} — STUDENT PERFORMANCE REPORT"
    elif raw_title:
        report_title = str(raw_title).upper().strip()
    else:
        report_title = f"{contest_name.upper()} — PERFORMANCE REPORT"

    elements = []
    styles = getSampleStyleSheet()

    # Enhanced Typography Styles
    college_style = ParagraphStyle(
        'CollegeTitle',
        parent=styles['Heading1'],
        fontSize=13,
        textColor=colors.HexColor("#1B365D"),
        alignment=1,
        spaceAfter=3
    )
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading2'],
        fontSize=10,
        textColor=colors.HexColor("#1E293B"),
        alignment=1,
        spaceAfter=4
    )
    timestamp_style = ParagraphStyle(
        'TimestampStyle',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor("#64748B"),
        fontName='Helvetica-Bold',
        alignment=1,
        spaceAfter=12
    )

    def add_page_decorations(canvas, doc):
        canvas.saveState()
        current_width, current_height = doc.pagesize
        # Subtle outer border
        canvas.setStrokeColor(colors.HexColor("#CBD5E1"))
        canvas.setLineWidth(0.75)
        canvas.rect(12, 12, current_width - 24, current_height - 24)
        canvas.restoreState()

    # College Branding Logo
    logo_path = r"E:\Leetcode Web\backend\static\nec_25_logo.png"
    if not os.path.exists(logo_path):
        logo_path = r"E:\Leetcode Web\round_logo.png"

    if os.path.exists(logo_path):
        img = Image(logo_path, width=48, height=48)
        img.hAlign = 'CENTER'
        elements.append(img)
        elements.append(Spacer(1, 4))

    elements.append(Paragraph("<b>NANDHA ENGINEERING COLLEGE (AUTONOMOUS)</b>", college_style))
    elements.append(Paragraph(f"<b>{report_title}</b>", title_style))

    from backend.time_utils import now_ist, format_ist_datetime
    now_str = dataset.get("generatedAtIST") or dataset.get("generated_at") or format_ist_datetime(now_ist())
    elements.append(Paragraph(f"Generated at: {now_str}", timestamp_style))

    if not sorted_rows:
        doc = SimpleDocTemplate(output, pagesize=(base_width, doc_height),
                                rightMargin=margin, leftMargin=margin, topMargin=20, bottomMargin=25)
        elements.append(Paragraph("No student records available for this report.", styles["Normal"]))
        doc.build(elements, canvasmaker=NumberedCanvas, onFirstPage=add_page_decorations, onLaterPages=add_page_decorations)
        return output.getvalue()

    # Typography for Table Cells
    fs = 7.5
    hs = 8.0
    leading = fs + 2.0
    h_leading = hs + 2.0

    cell_style = ParagraphStyle('CellStyle', parent=styles['Normal'], fontSize=fs, alignment=1, textColor=colors.HexColor("#0F172A"), leading=leading)
    left_cell_style = ParagraphStyle('LeftCellStyle', parent=styles['Normal'], fontSize=fs, alignment=0, textColor=colors.HexColor("#0F172A"), leading=leading)
    header_style = ParagraphStyle('HeaderStyle', parent=styles['Normal'], fontSize=hs, alignment=1, textColor=colors.white, fontName='Helvetica-Bold', leading=h_leading)

    success_cell_style = ParagraphStyle('SuccessCellStyle', parent=styles['Normal'], fontSize=fs, alignment=1, textColor=colors.HexColor("#047857"), fontName='Helvetica-Bold', leading=leading)
    risk_cell_style = ParagraphStyle('RiskCellStyle', parent=styles['Normal'], fontSize=fs, alignment=1, textColor=colors.HexColor("#B91C1C"), fontName='Helvetica-Bold', leading=leading)
    neutral_cell_style = ParagraphStyle('NeutralCellStyle', parent=styles['Normal'], fontSize=fs, alignment=1, textColor=colors.HexColor("#475569"), leading=leading)

    # Build Curated Columns Scheme
    # Format: list of (column_header, value_extractor_fn, relative_width_weight, is_left_aligned)
    columns_spec = []

    if is_wow:
        columns_spec = [
            ("S.No", lambda r, i: str(i), 0.8, False),
            ("Reg No", lambda r, i: _safe_str(r.get("reg_no")).upper(), 1.6, False),
            ("Student Name", lambda r, i: _safe_str(r.get("name")).upper(), 2.6, True),
            ("Dept", lambda r, i: _safe_str(r.get("dept")), 1.3, False),
            ("Yr", lambda r, i: _safe_str(r.get("year")), 0.7, False),
            (f"{prev_c_lbl} Status", lambda r, i: ("ATTENDED" if str(r.get("prev_status") or "").upper().strip() in ("ATTENDED", "PUBLIC", "VIRTUAL") else "ABSENT", "STATUS"), 1.6, False),
            (f"{prev_c_lbl} Solved", lambda r, i: _safe_str(r.get("prev_solved"), "0"), 1.2, False),
            (f"{prev_c_lbl} Score", lambda r, i: _safe_str(r.get("prev_score"), "0"), 1.1, False),
            (f"{curr_c_lbl} Status", lambda r, i: ("ATTENDED" if str(r.get("curr_status") or "").upper().strip() in ("ATTENDED", "PUBLIC", "VIRTUAL") else "ABSENT", "STATUS"), 1.6, False),
            (f"{curr_c_lbl} Solved", lambda r, i: _safe_str(r.get("curr_solved"), "0"), 1.2, False),
            (f"{curr_c_lbl} Score", lambda r, i: _safe_str(r.get("curr_score"), "0"), 1.1, False),
            ("Δ Solved", lambda r, i: (f"+{r.get('solved_delta')}" if isinstance(r.get('solved_delta'), int) and r.get('solved_delta') > 0 else str(r.get('solved_delta', 0)), "DELTA"), 1.2, False),
            ("Trend", lambda r, i: (_safe_str(r.get("trend"), "Stable →"), "TREND"), 1.5, False),
        ]
    elif is_five_week:
        sess_hdrs = dataset.get("sessionHeaders") or ["Contest 1", "Contest 2", "Contest 3", "Contest 4", "Contest 5"]
        columns_spec = [
            ("S.No", lambda r, i: str(i), 0.8, False),
            ("Reg No", lambda r, i: _safe_str(r.get("reg_no")).upper(), 1.6, False),
            ("Student Name", lambda r, i: _safe_str(r.get("name")).upper(), 2.6, True),
            ("Dept", lambda r, i: _safe_str(r.get("dept")), 1.3, False),
            ("Yr", lambda r, i: _safe_str(r.get("year")), 0.7, False),
            (sess_hdrs[0] if len(sess_hdrs) > 0 else "C1", lambda r, i: _safe_str(r.get("c1_solved"), "—"), 1.1, False),
            (sess_hdrs[1] if len(sess_hdrs) > 1 else "C2", lambda r, i: _safe_str(r.get("c2_solved"), "—"), 1.1, False),
            (sess_hdrs[2] if len(sess_hdrs) > 2 else "C3", lambda r, i: _safe_str(r.get("c3_solved"), "—"), 1.1, False),
            (sess_hdrs[3] if len(sess_hdrs) > 3 else "C4", lambda r, i: _safe_str(r.get("c4_solved"), "—"), 1.1, False),
            (sess_hdrs[4] if len(sess_hdrs) > 4 else "C5", lambda r, i: _safe_str(r.get("c5_solved"), "—"), 1.1, False),
            ("5-W Solved", lambda r, i: _safe_str(r.get("solved_5w"), "0"), 1.3, False),
            ("Att %", lambda r, i: _safe_str(r.get("attendance_rate"), "—"), 1.1, False),
            ("Trajectory", lambda r, i: (_safe_str(r.get("trajectory"), "—"), "TREND"), 1.5, False),
        ]
    elif is_historical:
        # Build base columns
        columns_spec = [
            ("S.No", lambda r, i: str(i), 0.8, False),
            ("Reg No", lambda r, i: _safe_str(r.get("reg_no")).upper(), 1.6, False),
            ("Student Name", lambda r, i: _safe_str(r.get("name")).upper(), 2.6, True),
            ("Dept", lambda r, i: _safe_str(r.get("dept")), 1.3, False),
            ("Yr", lambda r, i: _safe_str(r.get("year")), 0.7, False),
        ]
        # Append weekly contest columns
        weekly_keys = []
        if "weeklyData" in first_row and isinstance(first_row["weeklyData"], list):
            for wd in first_row["weeklyData"]:
                c_num = wd.get("contestNum")
                if c_num and c_num not in weekly_keys:
                    weekly_keys.append(c_num)

        for c_num in weekly_keys:
            def _extract_c(r, i, cn=c_num):
                w_list = r.get("weeklyData") or []
                for item in w_list:
                    if item.get("contestNum") == cn:
                        if item.get("att"):
                            return str(item.get("solved", 0))
                        return "—"
                return "—"
            columns_spec.append((f"C{c_num}", _extract_c, 1.0, False))

        # Add center metrics
        columns_spec.extend([
            ("Attended", lambda r, i: _safe_str(r.get("contests_attended") or r.get("total_attended"), "0"), 1.2, False),
            ("Total Solved", lambda r, i: _safe_str(r.get("total_solved") or r.get("solved"), "0"), 1.3, False),
            ("Global Rank", lambda r, i: _safe_str(r.get("global_rank") or r.get("contest_global_rank") or r.get("rank")), 1.4, False),
            ("Rating", lambda r, i: _safe_str(r.get("rating") or r.get("contest_rating")), 1.3, False),
        ])
    elif is_single_contest:
        # Standard Single Sheet / Weekly Contest Report
        def _fmt_q(val):
            s = str(val).strip() if val is not None else ""
            if s in ("1", "SOLVED", "YES", "TRUE"):
                return ("✓", "SUCCESS")
            elif s in ("0", "UNSOLVED", "NO", "FALSE", "—", "-"):
                return ("—", "NEUTRAL")
            return (s if s else "—", "NEUTRAL")

        columns_spec = [
            ("S.No", lambda r, i: str(i), 0.8, False),
            ("Reg No", lambda r, i: _safe_str(r.get("reg_no")).upper(), 1.6, False),
            ("Student Name", lambda r, i: _safe_str(r.get("name")).upper(), 2.8, True),
            ("Dept", lambda r, i: _safe_str(r.get("dept")), 1.3, False),
            ("Yr", lambda r, i: _safe_str(r.get("year")), 0.7, False),
            ("Status", lambda r, i: (_safe_str(r.get("status") or r.get("participation_status") or r.get("category"), "ABSENT"), "STATUS"), 1.6, False),
            ("Q1", lambda r, i: _fmt_q(r.get("q1") if r.get("q1") is not None else r.get("q1_display")), 0.8, False),
            ("Q2", lambda r, i: _fmt_q(r.get("q2") if r.get("q2") is not None else r.get("q2_display")), 0.8, False),
            ("Q3", lambda r, i: _fmt_q(r.get("q3") if r.get("q3") is not None else r.get("q3_display")), 0.8, False),
            ("Q4", lambda r, i: _fmt_q(r.get("q4") if r.get("q4") is not None else r.get("q4_display")), 0.8, False),
            ("Solved", lambda r, i: _safe_str(r.get("solved") or r.get("total_solved") or r.get("total_contest_solved"), "0"), 1.2, False),
            ("Score", lambda r, i: _safe_str(r.get("score") or r.get("contest_score"), "0"), 1.1, False),
            ("Rank", lambda r, i: _safe_str(r.get("rank") or r.get("contest_rank") or r.get("global_rank") or r.get("contest_global_rank")), 1.4, False),
            ("Rating", lambda r, i: _safe_str(r.get("rating") or r.get("contest_rating")), 1.3, False),
        ]
    else:
        # General cumulative roster / Leaderboard / Faculty report
        columns_spec = [
            ("S.No", lambda r, i: str(i), 0.8, False),
            ("Reg No", lambda r, i: _safe_str(r.get("reg_no")).upper(), 1.6, False),
            ("Student Name", lambda r, i: _safe_str(r.get("name")).upper(), 2.8, True),
            ("Dept", lambda r, i: _safe_str(r.get("dept")), 1.3, False),
            ("Yr", lambda r, i: _safe_str(r.get("year")), 0.7, False),
            ("Easy", lambda r, i: _safe_str(r.get("easy") or r.get("easy_solved"), "0"), 1.0, False),
            ("Med", lambda r, i: _safe_str(r.get("medium") or r.get("medium_solved"), "0"), 1.0, False),
            ("Hard", lambda r, i: _safe_str(r.get("hard") or r.get("hard_solved"), "0"), 1.0, False),
            ("Total Solved", lambda r, i: _safe_str(r.get("total_solved") or r.get("total") or r.get("solved"), "0"), 1.4, False),
            ("Global Rank", lambda r, i: _safe_str(r.get("global_rank") or r.get("profile_rank") or r.get("rank")), 1.5, False),
            ("Rating", lambda r, i: _safe_str(r.get("rating") or r.get("contest_rating")), 1.4, False),
        ]

    # Build Header Row
    headers = [col[0] for col in columns_spec]
    table_data = [[Paragraph(f"<b>{h}</b>", header_style) for h in headers]]

    # Build Data Rows
    for idx, r in enumerate(sorted_rows, 1):
        row_cells = []
        for col_name, extractor, weight, is_left in columns_spec:
            extracted = extractor(r, idx)
            cell_tag = None
            if isinstance(extracted, tuple):
                val_str, cell_tag = extracted
            else:
                val_str = extracted if isinstance(extracted, str) else str(extracted)

            target_style = left_cell_style if is_left else cell_style

            if cell_tag == "STATUS":
                s_up = val_str.upper().strip()
                if s_up in ("ATTENDED", "PUBLIC", "VIRTUAL", "VERIFIED", "LIVE"):
                    p = Paragraph(val_str, success_cell_style)
                elif s_up in ("ABSENT", "UNVERIFIED", "NOT_ATTENDED", "UNLINKED"):
                    p = Paragraph(val_str, risk_cell_style)
                else:
                    p = Paragraph(val_str, neutral_cell_style)
            elif cell_tag == "SUCCESS":
                p = Paragraph(val_str, success_cell_style)
            elif cell_tag == "RISK":
                p = Paragraph(val_str, risk_cell_style)
            elif cell_tag == "DELTA":
                if val_str.startswith("+"):
                    p = Paragraph(val_str, success_cell_style)
                elif val_str.startswith("-"):
                    p = Paragraph(val_str, risk_cell_style)
                else:
                    p = Paragraph(val_str, neutral_cell_style)
            elif cell_tag == "TREND":
                if "↑" in val_str or "Improving" in val_str:
                    p = Paragraph(val_str, success_cell_style)
                elif "↓" in val_str or "Declining" in val_str:
                    p = Paragraph(val_str, risk_cell_style)
                else:
                    p = Paragraph(val_str, neutral_cell_style)
            else:
                p = Paragraph(val_str, target_style)

            row_cells.append(p)
        table_data.append(row_cells)

    # Calculate Table Width & Column Widths
    total_weight = sum(col[2] for col in columns_spec)
    num_cols = len(columns_spec)

    # Wide table handling: if many columns (e.g. historical report with 15 contests)
    if num_cols > 15:
        # Dynamically widen page to fit all columns without cramping
        doc_width = max(base_width, num_cols * 50.0 + margin * 2)
    else:
        doc_width = base_width

    usable_width = doc_width - (margin * 2)
    col_widths = [(col[2] / total_weight) * usable_width for col in columns_spec]

    doc = SimpleDocTemplate(
        output,
        pagesize=(doc_width, doc_height),
        rightMargin=margin,
        leftMargin=margin,
        topMargin=20,
        bottomMargin=30
    )

    t = Table(table_data, colWidths=col_widths, repeatRows=1, splitByRow=True)

    h_pad = 4.0 if num_cols > 15 else 5.0
    v_pad = 2.5 if num_cols > 15 else 3.5

    table_style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0F172A")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), h_pad),
        ('TOPPADDING', (0, 0), (-1, 0), h_pad),
        ('BOTTOMPADDING', (0, 1), (-1, -1), v_pad),
        ('TOPPADDING', (0, 1), (-1, -1), v_pad),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#64748B"))
    ]

    for i in range(1, len(table_data)):
        bg = colors.HexColor("#F8FAFC") if i % 2 == 0 else colors.white
        table_style.append(('BACKGROUND', (0, i), (-1, i), bg))

    t.setStyle(TableStyle(table_style))
    elements.append(t)

    doc.build(
        elements,
        canvasmaker=NumberedCanvas,
        onFirstPage=add_page_decorations,
        onLaterPages=add_page_decorations
    )
    return output.getvalue()
