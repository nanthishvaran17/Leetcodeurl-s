import io
import os
import re
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas
from typing import Any, Callable, Tuple, List, Dict, Optional

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
            self.draw_page_decorations(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont('Helvetica', 7.5)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(20, 15, "Nandha Engineering College (Autonomous), Erode – 638 052 | Confidential • Official LeetCode Performance Record")
        self.setFont('Helvetica-Bold', 7.5)
        self.drawRightString(self._pagesize[0] - 20, 15, f"Page {self._pageNumber} of {page_count}")
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
    Authoritative Institutional Dynamic PDF Exporter for Nandha Engineering College.
    Maintains 100% parameter, column, and visual theme parity with Master Excel Exporters:
      - Master Institutional Header: College emblem, Department, Title, and Cohort Year context
      - Single Contest / Friday Official: EXACT 10 Columns (S.No, Reg No, Name, Acc, Cutoff, Q1, Q2, Q3, Q4, Total Solved)
      - Nandha Navy Blue (#1B365D) theme, Light Blue (#E6F0FA) total summary rows
      - Bottom Section 1: Total Solved Count under all question columns
      - Bottom Section 2: Accommodation-Wise Performance Summary (Hostel vs Day Scholar)
      - Bottom Section 3: Contest Performance & Problem-Wise Solve Summary
      - Multi-page dynamic pagination with repeating header row & clean footer
    """
    output = io.BytesIO()

    rows = (
        dataset.get("allStudents")
        or dataset.get("rows")
        or dataset.get("all_rows")
        or dataset.get("all_students_current")
        or dataset.get("all_students")
        or dataset.get("students")
        or []
    )
    first_row = rows[0] if rows else {}

    contest_name = str(
        dataset.get("contest_name")
        or dataset.get("contestName")
        or (dataset.get("current_session") or {}).get("contest_name")
        or dataset.get("title")
        or dataset.get("sessionName")
        or "WEEKLY CONTEST"
    ).split("\n")[0].strip()

    session_date = str(
        dataset.get("session_date")
        or dataset.get("sessionDate")
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
    is_historical = (report_type in ("HISTORICAL_CONTEST_INTELLIGENCE", "HISTORICAL_CONTEST_INTEL")) or ("weeklyData" in first_row)
    is_single_contest = (
        any(k in report_type for k in ("CONTEST_PERFORMANCE", "OFFICIAL_CONTEST", "SUNDAY_LIVE", "SUNDAY_CONTEST", "WEEKLY_CONTEST", "SINGLE_CONTEST", "SINGLE_SHEET", "FRIDAY_OFFICIAL", "FRIDAY_REPORT", "FRIDAY"))
        or any(k in first_row for k in ("q1_display", "q1_time", "contest_solved", "q1", "contest_easy"))
        or (bool(session_date or contest_name) and report_type in ("12TH_TNEA_CUTOFF_ANALYSIS", "HOD_DEPARTMENT_INTELLIGENCE", "LEADERBOARD", "WEEKLY_STUDENT_PERFORMANCE", "OFFICIAL_SUMMARY"))
    ) and not is_historical and not is_wow and not is_five_week and "COORDINATOR" not in report_type

    # Extract Contest Number
    c_match = re.search(r'(?:Weekly Contest|Biweekly Contest|WC|BW|Contest|\b)\s*(\d{2,4})\b', contest_name, re.IGNORECASE)
    contest_number = c_match.group(1) if c_match else ""
    if not contest_number:
        num_m = re.search(r'\d+', contest_name)
        contest_number = num_m.group(0) if num_m else ""

    if contest_number:
        single_sheet_title = f"STUDENT PERFORMANCE OF WEEKLY CONTEST {contest_number}"
        contest_display = f"Weekly Contest {contest_number}"
    elif contest_name:
        single_sheet_title = f"STUDENT PERFORMANCE OF {contest_name.upper()}"
        contest_display = contest_name
    else:
        single_sheet_title = "STUDENT PERFORMANCE OF WEEKLY CONTEST"
        contest_display = "Weekly Contest"

    # Department normalization
    dept = str(dataset.get("deptFilter") or dataset.get("department") or dataset.get("dept") or "ALL").strip().upper()
    if (dept.isdigit() or dept in ("ALL", "NONE", "")) and rows:
        unique_depts = list({str(r.get("dept") or r.get("department") or "").strip().upper() for r in rows if r.get("dept") or r.get("department")})
        if len(unique_depts) == 1 and unique_depts[0]:
            dept = unique_depts[0]
        elif len(unique_depts) > 1:
            dept = "ALL DEPARTMENTS"

    if "CSE(CS)" in dept or "CSE (CS)" in dept or dept == "CS" or "CYBER" in dept:
        dept_full_title = "DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING (CYBER SECURITY)"
    elif dept == "CSE":
        dept_full_title = "DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING"
    elif dept == "IT":
        dept_full_title = "DEPARTMENT OF INFORMATION TECHNOLOGY"
    elif dept in ("AIDS", "AI&DS"):
        dept_full_title = "DEPARTMENT OF ARTIFICIAL INTELLIGENCE AND DATA SCIENCE"
    elif dept == "ECE":
        dept_full_title = "DEPARTMENT OF ELECTRONICS AND COMMUNICATION ENGINEERING"
    elif dept == "EEE":
        dept_full_title = "DEPARTMENT OF ELECTRICAL AND ELECTRONICS ENGINEERING"
    elif dept == "MECH":
        dept_full_title = "DEPARTMENT OF MECHANICAL ENGINEERING"
    elif dept in ("ALL", "ALL DEPARTMENTS", "NONE", ""):
        dept_full_title = "INSTITUTIONAL MASTER REPORT • ALL DEPARTMENTS"
    else:
        dept_full_title = f"DEPARTMENT OF {dept}"

    # Year cohort normalization
    year = str(dataset.get("yearFilter") or dataset.get("year") or dataset.get("year_level") or "ALL").strip().upper()
    if (year.isdigit() or year in ("ALL", "NONE", "")) and rows:
        unique_years = list({str(r.get("year") or r.get("year_level") or "").strip().upper() for r in rows if r.get("year") or r.get("year_level")})
        if len(unique_years) == 1 and unique_years[0]:
            y_u = unique_years[0]
            year = f"{y_u} YEAR" if not y_u.endswith("YEAR") else y_u
        elif len(unique_years) > 1:
            year = "ALL YEARS"

    if year in ("1", "I", "1ST"):
        year_display = "I YEAR"
    elif year in ("2", "II", "2ND"):
        year_display = "II YEAR"
    elif year in ("3", "III", "3RD"):
        year_display = "III YEAR"
    elif year in ("4", "IV", "4TH"):
        year_display = "IV YEAR"
    elif "YEAR" in year:
        year_display = year
    else:
        year_display = f"{year} YEAR" if year != "ALL" else "ALL YEARS"

    # Fast student database metadata map for accommodation and 12th cutoff
    student_meta_map: Dict[str, Dict[str, Any]] = {}
    try:
        from backend.database import SessionLocal
        from backend.models import Student
        db_s = SessionLocal()
        try:
            db_students = db_s.query(Student).all()
            for st in db_students:
                s_dict = {
                    "accommodation": st.accommodation,
                    "twelfth_cutoff": st.twelfth_cutoff,
                    "global_rank": getattr(st, "global_rank", None) or getattr(st, "contest_global_ranking", None)
                }
                if st.reg_no:
                    student_meta_map[str(st.reg_no).strip().upper()] = s_dict
                if st.id:
                    student_meta_map[str(st.id)] = s_dict
        finally:
            db_s.close()
    except Exception:
        pass

    # Sort rows: Solvers first, then highest solved, then rank, then name
    def _row_sort_key(r):
        q1 = 1 if str(r.get("q1", "")).lower() in ("1", "true", "solved", "yes") or r.get("q1") == 1 else 0
        q2 = 1 if str(r.get("q2", "")).lower() in ("1", "true", "solved", "yes") or r.get("q2") == 1 else 0
        q3 = 1 if str(r.get("q3", "")).lower() in ("1", "true", "solved", "yes") or r.get("q3") == 1 else 0
        q4 = 1 if str(r.get("q4", "")).lower() in ("1", "true", "solved", "yes") or r.get("q4") == 1 else 0

        tot = r.get("solved") if r.get("solved") is not None else (r.get("total_solved") if r.get("total_solved") is not None else r.get("total_contest_solved"))
        try:
            tot_int = int(tot) if tot is not None else 0
        except Exception:
            tot_int = 0
        sol = max(tot_int, q1 + q2 + q3 + q4)

        rnk_raw = r.get("rank") or r.get("contest_rank") or r.get("global_rank") or r.get("contest_global_rank")
        try:
            rnk = int(str(rnk_raw).replace("#", "").replace(",", "")) if rnk_raw is not None else 999999
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
    usable_width = base_width - (margin * 2) # ~801.89 pt

    elements = []
    styles = getSampleStyleSheet()

    # Typography Styles
    college_style = ParagraphStyle(
        'CollegeTitle',
        parent=styles['Heading1'],
        fontSize=12.5,
        textColor=colors.HexColor("#1B365D"),
        alignment=1,
        fontName='Helvetica-Bold',
        spaceAfter=2
    )
    dept_style = ParagraphStyle(
        'DeptTitle',
        parent=styles['Heading2'],
        fontSize=10,
        textColor=colors.HexColor("#1E293B"),
        alignment=1,
        fontName='Helvetica-Bold',
        spaceAfter=2
    )
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading2'],
        fontSize=9.5,
        textColor=colors.HexColor("#1B365D"),
        alignment=1,
        fontName='Helvetica-Bold',
        spaceAfter=3
    )
    meta_style = ParagraphStyle(
        'MetaStyle',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor("#475569"),
        fontName='Helvetica-Bold',
        alignment=1,
        spaceAfter=8
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
    assets_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")
    logo_path = os.path.join(assets_dir, "nec_25_logo.png")
    if not os.path.exists(logo_path):
        logo_path = os.path.join(assets_dir, "round_logo.png")

    if os.path.exists(logo_path):
        try:
            img = Image(logo_path, width=42, height=42)
            img.hAlign = 'CENTER'
            elements.append(img)
            elements.append(Spacer(1, 2))
        except Exception:
            pass

    # Header block
    elements.append(Paragraph("<b>NANDHA ENGINEERING COLLEGE (AUTONOMOUS)</b>", college_style))
    if is_single_contest:
        elements.append(Paragraph(f"<b>{dept_full_title}</b>", dept_style))
        elements.append(Paragraph(f"<b>{single_sheet_title}</b>", title_style))
        meta_txt = f"<b>ACADEMIC COHORT: {year_display} • TOTAL ROSTER: {len(sorted_rows)} STUDENTS</b>"
        if session_date:
            meta_txt += f"<b> • CONTEST DATE: {session_date}</b>"
        elements.append(Paragraph(meta_txt, meta_style))
    else:
        rep_main = raw_title if raw_title else f"{report_type.replace('_', ' ')} REPORT"
        elements.append(Paragraph(f"<b>{dept_full_title}</b>", dept_style))
        elements.append(Paragraph(f"<b>{rep_main.upper()}</b>", title_style))
        from backend.time_utils import now_ist, format_ist_datetime
        now_str = dataset.get("generatedAtIST") or dataset.get("generated_at") or format_ist_datetime(now_ist())
        elements.append(Paragraph(f"<b>COHORT: {year_display} • ROSTER: {len(sorted_rows)} STUDENTS • GENERATED AT: {now_str}</b>", meta_style))

    if not sorted_rows:
        doc = SimpleDocTemplate(output, pagesize=(base_width, doc_height),
                                rightMargin=margin, leftMargin=margin, topMargin=20, bottomMargin=25)
        elements.append(Paragraph("No student records available for the selected filters.", styles["Normal"]))
        doc.build(elements, canvasmaker=NumberedCanvas, onFirstPage=add_page_decorations, onLaterPages=add_page_decorations)
        return output.getvalue()

    # Typography for Table Cells
    fs = 7.5
    hs = 8.0
    leading = fs + 2.0
    h_leading = hs + 2.0

    cell_style = ParagraphStyle('CellStyle', parent=styles['Normal'], fontSize=fs, alignment=1, textColor=colors.HexColor("#0F172A"), leading=leading)
    left_cell_style = ParagraphStyle('LeftCellStyle', parent=styles['Normal'], fontSize=fs, alignment=0, textColor=colors.HexColor("#0F172A"), fontName='Helvetica-Bold', leading=leading)
    header_style = ParagraphStyle('HeaderStyle', parent=styles['Normal'], fontSize=hs, alignment=1, textColor=colors.white, fontName='Helvetica-Bold', leading=h_leading)

    solved_cell_style = ParagraphStyle('SolvedCellStyle', parent=styles['Normal'], fontSize=fs, alignment=1, textColor=colors.HexColor("#047857"), fontName='Helvetica-Bold', leading=leading)
    unsolved_cell_style = ParagraphStyle('UnsolvedCellStyle', parent=styles['Normal'], fontSize=fs, alignment=1, textColor=colors.HexColor("#94A3B8"), leading=leading)
    total_label_style = ParagraphStyle('TotalLabelStyle', parent=styles['Normal'], fontSize=8.0, alignment=1, textColor=colors.HexColor("#1B365D"), fontName='Helvetica-Bold', leading=10)
    total_cell_style = ParagraphStyle('TotalCellStyle', parent=styles['Normal'], fontSize=8.0, alignment=1, textColor=colors.HexColor("#1B365D"), fontName='Helvetica-Bold', leading=10)

    # Aggregators for Single Contest metrics & summary tables
    sum_q1 = 0
    sum_q2 = 0
    sum_q3 = 0
    sum_q4 = 0
    sum_total_solved = 0

    count_q4 = 0
    count_q3 = 0
    count_q2 = 0
    count_q1 = 0
    count_q0 = 0
    count_below_20k = 0
    count_below_5k = 0

    hostel_stats = {"count": 0, "attended": 0, "q1": 0, "q2": 0, "q3": 0, "q4": 0, "total_solved": 0}
    ds_stats = {"count": 0, "attended": 0, "q1": 0, "q2": 0, "q3": 0, "q4": 0, "total_solved": 0}

    # =========================================================================
    # SINGLE CONTEST / FRIDAY REPORT: EXACT 10 COLUMNS MATCHING EXCEL
    # =========================================================================
    if is_single_contest:
        headers = [
            "S.No", 
            "Reg No", 
            "Name", 
            "Acc",
            "Cutoff",
            "Q1 (Easy)", 
            "Q2 (Medium)", 
            "Q3 (Medium)", 
            "Q4 (Hard)", 
            "Total Solved"
        ]
        # Col Widths total 800pt across usable width (801.89pt)
        col_widths = [35.0, 85.0, 215.0, 38.0, 52.0, 75.0, 75.0, 75.0, 75.0, 75.0]

        table_data = [[Paragraph(f"<b>{h}</b>", header_style) for h in headers]]

        for idx, r in enumerate(sorted_rows, 1):
            reg_no = str(r.get("reg_no") or r.get("register_no") or "").strip().upper()
            student_name = str(r.get("name") or r.get("student_name") or "").strip().upper()

            # Questions
            q1 = 1 if str(r.get("q1", "")).lower() in ("1", "true", "solved", "yes") or r.get("q1") == 1 else 0
            q2 = 1 if str(r.get("q2", "")).lower() in ("1", "true", "solved", "yes") or r.get("q2") == 1 else 0
            q3 = 1 if str(r.get("q3", "")).lower() in ("1", "true", "solved", "yes") or r.get("q3") == 1 else 0
            q4 = 1 if str(r.get("q4", "")).lower() in ("1", "true", "solved", "yes") or r.get("q4") == 1 else 0

            tot = r.get("solved") if r.get("solved") is not None else (r.get("total_solved") if r.get("total_solved") is not None else r.get("total_contest_solved"))
            try:
                tot_int = int(tot) if tot is not None else 0
            except Exception:
                tot_int = 0
            solved_count = max(tot_int, q1 + q2 + q3 + q4)

            # Accommodation
            raw_acc = str(r.get("accommodation") or r.get("hostel_dayscholar") or r.get("residence") or "").strip()
            if not raw_acc and reg_no in student_meta_map:
                raw_acc = str(student_meta_map[reg_no].get("accommodation") or "").strip()
            acc_is_hostel = "HOSTEL" in raw_acc.upper() or raw_acc.upper() == "H"
            acc_val = "H" if acc_is_hostel else "D"

            # 12th Cutoff
            raw_cutoff = r.get("twelfth_cutoff") if r.get("twelfth_cutoff") is not None else r.get("cutoff")
            if (raw_cutoff is None or raw_cutoff == "") and reg_no in student_meta_map:
                raw_cutoff = student_meta_map[reg_no].get("twelfth_cutoff")
            cutoff_disp = "—"
            if raw_cutoff not in (None, "", "—", "-"):
                try:
                    co_val = float(raw_cutoff)
                    if co_val > 0 and co_val == co_val:
                        cutoff_disp = f"{co_val:.2f}"
                except (ValueError, TypeError):
                    cutoff_disp = "—"

            # Metrics aggregation
            sum_q1 += q1
            sum_q2 += q2
            sum_q3 += q3
            sum_q4 += q4
            sum_total_solved += solved_count

            if solved_count >= 4: count_q4 += 1
            elif solved_count == 3: count_q3 += 1
            elif solved_count == 2: count_q2 += 1
            elif solved_count == 1: count_q1 += 1
            else: count_q0 += 1

            is_attended = (solved_count > 0)
            target_group = hostel_stats if acc_is_hostel else ds_stats
            target_group["count"] += 1
            if is_attended:
                target_group["attended"] += 1
            target_group["q1"] += q1
            target_group["q2"] += q2
            target_group["q3"] += q3
            target_group["q4"] += q4
            target_group["total_solved"] += solved_count

            # Global Rank < 20000 check
            gr_val = r.get("global_rank") or r.get("contest_global_rank") or r.get("profile_rank")
            if not gr_val and reg_no in student_meta_map:
                gr_val = student_meta_map[reg_no].get("global_rank")
            if gr_val not in (None, "", "—", "Unrated", "-"):
                try:
                    gr_int = int(str(gr_val).replace("#", "").replace(",", "").strip())
                    if 0 < gr_int < 20000:
                        count_below_20k += 1
                except (ValueError, TypeError):
                    pass

            # Contest Rank < 5000 check
            cr_val = r.get("contest_rank") or r.get("rank")
            if cr_val not in (None, "", "—", "Unrated", "-"):
                try:
                    cr_int = int(str(cr_val).replace("#", "").replace(",", "").strip())
                    if 0 < cr_int < 5000:
                        count_below_5k += 1
                except (ValueError, TypeError):
                    pass

            q1_p = Paragraph("<b>1</b>", solved_cell_style) if q1 == 1 else Paragraph("0", unsolved_cell_style)
            q2_p = Paragraph("<b>1</b>", solved_cell_style) if q2 == 1 else Paragraph("0", unsolved_cell_style)
            q3_p = Paragraph("<b>1</b>", solved_cell_style) if q3 == 1 else Paragraph("0", unsolved_cell_style)
            q4_p = Paragraph("<b>1</b>", solved_cell_style) if q4 == 1 else Paragraph("0", unsolved_cell_style)
            tot_p = Paragraph(f"<b>{solved_count}</b>", cell_style) if solved_count > 0 else Paragraph("0", unsolved_cell_style)

            row_cells = [
                Paragraph(str(idx), cell_style),
                Paragraph(reg_no, cell_style),
                Paragraph(student_name, left_cell_style),
                Paragraph(acc_val, cell_style),
                Paragraph(cutoff_disp, cell_style),
                q1_p,
                q2_p,
                q3_p,
                q4_p,
                tot_p
            ]
            table_data.append(row_cells)

        # TOTAL ROW UNDER TABLE
        total_row_idx = len(table_data)
        total_cells = [
            Paragraph(f"<b>TOTAL SOLVED COUNT ({len(sorted_rows)} STUDENTS)</b>", total_label_style),
            "", "", "", "",
            Paragraph(f"<b>{sum_q1}</b>", total_cell_style),
            Paragraph(f"<b>{sum_q2}</b>", total_cell_style),
            Paragraph(f"<b>{sum_q3}</b>", total_cell_style),
            Paragraph(f"<b>{sum_q4}</b>", total_cell_style),
            Paragraph(f"<b>{sum_total_solved}</b>", total_cell_style),
        ]
        table_data.append(total_cells)

        t = Table(table_data, colWidths=col_widths, repeatRows=1, splitByRow=True)

        table_style = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1B365D")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 4.5),
            ('TOPPADDING', (0, 0), (-1, 0), 4.5),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 2.5),
            ('TOPPADDING', (0, 1), (-1, -1), 2.5),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ('BOX', (0, 0), (-1, -1), 1.0, colors.HexColor("#1B365D")),
            # Total row styles
            ('SPAN', (0, total_row_idx), (4, total_row_idx)),
            ('BACKGROUND', (0, total_row_idx), (-1, total_row_idx), colors.HexColor("#E6F0FA")),
            ('TOPPADDING', (0, total_row_idx), (-1, total_row_idx), 4.0),
            ('BOTTOMPADDING', (0, total_row_idx), (-1, total_row_idx), 4.0),
            ('LINEABOVE', (0, total_row_idx), (-1, total_row_idx), 1.0, colors.HexColor("#1B365D")),
            ('LINEBELOW', (0, total_row_idx), (-1, total_row_idx), 1.0, colors.HexColor("#1B365D")),
        ]

        for i in range(1, total_row_idx):
            bg = colors.HexColor("#F8FAFC") if i % 2 == 0 else colors.white
            table_style.append(('BACKGROUND', (0, i), (-1, i), bg))

        t.setStyle(TableStyle(table_style))
        elements.append(t)
        elements.append(Spacer(1, 12))

        # =========================================================================
        # SUMMARY TABLES (HOSTEL/DAY SCHOLAR & CONTEST PERFORMANCE BREAKDOWN)
        # =========================================================================
        summary_flowables = []

        # Table 1: Accommodation Summary
        h_pct_num = (hostel_stats['attended'] / hostel_stats['count']) if hostel_stats['count'] > 0 else 0.0
        ds_pct_num = (ds_stats['attended'] / ds_stats['count']) if ds_stats['count'] > 0 else 0.0
        tot_roster_cnt = len(sorted_rows)
        tot_attended_cnt = hostel_stats["attended"] + ds_stats["attended"]
        tot_pct_num = (tot_attended_cnt / tot_roster_cnt) if tot_roster_cnt > 0 else 0.0

        acc_banner_style = ParagraphStyle('AccBanner', parent=styles['Normal'], fontSize=8.5, textColor=colors.white, fontName='Helvetica-Bold', alignment=1)
        acc_subhdr_style = ParagraphStyle('AccSubHdr', parent=styles['Normal'], fontSize=7.5, textColor=colors.white, fontName='Helvetica-Bold', alignment=1)

        acc_table_data = [
            [Paragraph("<b>ACCOMMODATION-WISE CONSOLIDATED PERFORMANCE SUMMARY (HOSTEL vs DAY SCHOLAR)</b>", acc_banner_style)] + [""] * 9,
            [
                Paragraph("<b>S.No</b>", acc_subhdr_style),
                Paragraph("<b>Accommodation Category</b>", acc_subhdr_style),
                Paragraph("<b>Total Students</b>", acc_subhdr_style),
                Paragraph("<b>Attended (&ge;1 Solved)</b>", acc_subhdr_style),
                Paragraph("<b>Q1 (Easy)</b>", acc_subhdr_style),
                Paragraph("<b>Q2 (Medium)</b>", acc_subhdr_style),
                Paragraph("<b>Q3 (Medium)</b>", acc_subhdr_style),
                Paragraph("<b>Q4 (Hard)</b>", acc_subhdr_style),
                Paragraph("<b>Total Solved</b>", acc_subhdr_style),
                Paragraph("<b>Participation %</b>", acc_subhdr_style),
            ],
            [
                Paragraph("1", cell_style),
                Paragraph("Hostel (H)", cell_style),
                Paragraph(str(hostel_stats["count"]), cell_style),
                Paragraph(str(hostel_stats["attended"]), cell_style),
                Paragraph(str(hostel_stats["q1"]), cell_style),
                Paragraph(str(hostel_stats["q2"]), cell_style),
                Paragraph(str(hostel_stats["q3"]), cell_style),
                Paragraph(str(hostel_stats["q4"]), cell_style),
                Paragraph(str(hostel_stats["total_solved"]), cell_style),
                Paragraph(f"{h_pct_num * 100:.1f}%", cell_style),
            ],
            [
                Paragraph("2", cell_style),
                Paragraph("Day Scholar (D)", cell_style),
                Paragraph(str(ds_stats["count"]), cell_style),
                Paragraph(str(ds_stats["attended"]), cell_style),
                Paragraph(str(ds_stats["q1"]), cell_style),
                Paragraph(str(ds_stats["q2"]), cell_style),
                Paragraph(str(ds_stats["q3"]), cell_style),
                Paragraph(str(ds_stats["q4"]), cell_style),
                Paragraph(str(ds_stats["total_solved"]), cell_style),
                Paragraph(f"{ds_pct_num * 100:.1f}%", cell_style),
            ],
            [
                Paragraph("", total_cell_style),
                Paragraph("<b>TOTAL</b>", total_cell_style),
                Paragraph(f"<b>{tot_roster_cnt}</b>", total_cell_style),
                Paragraph(f"<b>{tot_attended_cnt}</b>", total_cell_style),
                Paragraph(f"<b>{sum_q1}</b>", total_cell_style),
                Paragraph(f"<b>{sum_q2}</b>", total_cell_style),
                Paragraph(f"<b>{sum_q3}</b>", total_cell_style),
                Paragraph(f"<b>{sum_q4}</b>", total_cell_style),
                Paragraph(f"<b>{sum_total_solved}</b>", total_cell_style),
                Paragraph(f"<b>{tot_pct_num * 100:.1f}%</b>", total_cell_style),
            ]
        ]

        acc_col_widths = [35.0, 160.0, 85.0, 95.0, 70.0, 70.0, 70.0, 70.0, 75.0, 70.0]
        acc_table = Table(acc_table_data, colWidths=acc_col_widths)
        acc_table.setStyle(TableStyle([
            ('SPAN', (0, 0), (-1, 0)),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1B365D")),
            ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor("#2E5B88")),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ('BACKGROUND', (0, 4), (-1, 4), colors.HexColor("#E6F0FA")),
            ('TOPPADDING', (0, 0), (-1, -1), 3.0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3.0),
        ]))
        summary_flowables.append(acc_table)
        summary_flowables.append(Spacer(1, 10))

        # Table 2: Contest Performance Breakdown
        perf_data = [
            [Paragraph(f"<b>CONTEST PERFORMANCE & PROBLEM-WISE SOLVE SUMMARY ({contest_display.upper()})</b>", acc_banner_style)] + [""] * 3,
            [
                Paragraph("<b>Contest & Session</b>", acc_subhdr_style),
                Paragraph("<b>Solve Distribution (4Q / 3Q / 2Q / 1Q / 0Q)</b>", acc_subhdr_style),
                Paragraph("<b>Institutional Milestones</b>", acc_subhdr_style),
                Paragraph("<b>Attendance & Rate</b>", acc_subhdr_style),
            ],
            [
                Paragraph(f"<b>{contest_display}</b><br/>{session_date or 'Official Session'}", cell_style),
                Paragraph(f"4Q: <b>{count_q4}</b>  •  3Q: <b>{count_q3}</b>  •  2Q: <b>{count_q2}</b>  •  1Q: <b>{count_q1}</b>  •  0Q: <b>{count_q0}</b>", cell_style),
                Paragraph(f"Global Rank &lt; 20,000: <b>{count_below_20k}</b><br/>Contest Rank &lt; 5,000: <b>{count_below_5k}</b>", cell_style),
                Paragraph(f"Attended: <b>{tot_attended_cnt} / {tot_roster_cnt}</b><br/>Participation: <b>{tot_pct_num * 100:.1f}%</b>", cell_style),
            ]
        ]
        perf_col_widths = [160.0, 310.0, 180.0, 150.0]
        perf_table = Table(perf_data, colWidths=perf_col_widths)
        perf_table.setStyle(TableStyle([
            ('SPAN', (0, 0), (-1, 0)),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1B365D")),
            ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor("#2E5B88")),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ('TOPPADDING', (0, 0), (-1, -1), 4.0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4.0),
            ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor("#F8FAFC")),
        ]))
        summary_flowables.append(perf_table)

        elements.append(KeepTogether(summary_flowables))

    # =========================================================================
    # MULTI-CONTEST / CUMULATIVE / HISTORICAL / WOW REPORTS
    # =========================================================================
    else:
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
            columns_spec = [
                ("S.No", lambda r, i: str(i), 0.8, False),
                ("Reg No", lambda r, i: _safe_str(r.get("reg_no")).upper(), 1.6, False),
                ("Student Name", lambda r, i: _safe_str(r.get("name")).upper(), 2.6, True),
                ("Dept", lambda r, i: _safe_str(r.get("dept")), 1.3, False),
                ("Yr", lambda r, i: _safe_str(r.get("year")), 0.7, False),
            ]
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

            columns_spec.extend([
                ("Attended", lambda r, i: _safe_str(r.get("contests_attended") or r.get("total_attended"), "0"), 1.2, False),
                ("Total Solved", lambda r, i: _safe_str(r.get("total_solved") or r.get("solved"), "0"), 1.3, False),
                ("Global Rank", lambda r, i: _safe_str(r.get("global_rank") or r.get("contest_global_rank") or r.get("rank")), 1.4, False),
                ("Rating", lambda r, i: _safe_str(r.get("rating") or r.get("contest_rating")), 1.3, False),
            ])
        else:
            # General cumulative roster / Leaderboard
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

        headers = [col[0] for col in columns_spec]
        table_data = [[Paragraph(f"<b>{h}</b>", header_style) for h in headers]]

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
                        p = Paragraph(val_str, solved_cell_style)
                    else:
                        p = Paragraph(val_str, unsolved_cell_style)
                elif cell_tag == "DELTA":
                    if val_str.startswith("+"):
                        p = Paragraph(val_str, solved_cell_style)
                    else:
                        p = Paragraph(val_str, cell_style)
                else:
                    p = Paragraph(val_str, target_style)

                row_cells.append(p)
            table_data.append(row_cells)

        total_weight = sum(col[2] for col in columns_spec)
        num_cols = len(columns_spec)
        doc_width = max(base_width, num_cols * 50.0 + margin * 2) if num_cols > 15 else base_width
        usable_w = doc_width - (margin * 2)
        col_widths = [(col[2] / total_weight) * usable_w for col in columns_spec]

        t = Table(table_data, colWidths=col_widths, repeatRows=1, splitByRow=True)
        t_style = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1B365D")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 4.5),
            ('TOPPADDING', (0, 0), (-1, 0), 4.5),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 2.5),
            ('TOPPADDING', (0, 1), (-1, -1), 2.5),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ('BOX', (0, 0), (-1, -1), 1.0, colors.HexColor("#1B365D"))
        ]
        for i in range(1, len(table_data)):
            bg = colors.HexColor("#F8FAFC") if i % 2 == 0 else colors.white
            t_style.append(('BACKGROUND', (0, i), (-1, i), bg))
        t.setStyle(TableStyle(t_style))
        elements.append(t)

    doc = SimpleDocTemplate(
        output,
        pagesize=(base_width, doc_height),
        rightMargin=margin,
        leftMargin=margin,
        topMargin=20,
        bottomMargin=30
    )

    doc.build(
        elements,
        canvasmaker=NumberedCanvas,
        onFirstPage=add_page_decorations,
        onLaterPages=add_page_decorations
    )
    return output.getvalue()
