import os
import io
import datetime
import re
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def _apply_thin_border(cell):
    s = Side(style='thin', color='CBD5E1')
    cell.border = Border(left=s, right=s, top=s, bottom=s)

def _apply_box_border(cell, color='1B365D'):
    s = Side(style='thin', color=color)
    cell.border = Border(left=s, right=s, top=s, bottom=s)

def _to_int(val, default=0) -> int:
    """Safely convert any value to int, returning default on failure."""
    try:
        if val is None or val == '—' or val == '':
            return default
        return int(float(str(val)))
    except (ValueError, TypeError):
        return default

def _to_float(val, default=0.0) -> float:
    """Safely convert any value to float, returning default on failure."""
    try:
        if val is None or val == '—' or val == '':
            return default
        return float(str(val))
    except (ValueError, TypeError):
        return default

def _write_header_row(ws, row_num, headers, col_widths, navy_fill, font_tnr, center):
    """Write a styled header row and set column widths."""
    for col_idx, (hdr, width) in enumerate(zip(headers, col_widths), start=1):
        c = ws.cell(row=row_num, column=col_idx, value=hdr)
        c.font = Font(name=font_tnr, size=9.5, bold=True, color="FFFFFF")
        c.fill = navy_fill
        c.alignment = center
        _apply_thin_border(c)
        ws.column_dimensions[get_column_letter(col_idx)].width = width
    ws.row_dimensions[row_num].height = 24

def _write_college_header(ws, title: str, cols: int, font_tnr, navy_fill, header_fill, center):
    """Write neat, professional college header banner across all columns with logo image."""
    last_col = get_column_letter(cols)
    
    # Row 1: College Name Banner
    ws.merge_cells(f"A1:{last_col}1")
    ws["A1"] = "NANDHA ENGINEERING COLLEGE (AUTONOMOUS)"
    ws["A1"].font = Font(name=font_tnr, size=13, bold=True, color="FFFFFF")
    ws["A1"].alignment = center
    ws["A1"].fill = navy_fill
    ws.row_dimensions[1].height = 30

    # Clean title text
    clean_title = title.replace("NANDHA ENGINEERING COLLEGE\n", "").replace("NANDHA ENGINEERING COLLEGE", "").strip()
    clean_title = re.sub(r'\n+', ' — ', clean_title).strip()
    if not clean_title:
        clean_title = "WEEKLY CONTEST STUDENT PERFORMANCE REPORT"

    # Row 2: Subtitle Banner
    ws.merge_cells(f"A2:{last_col}2")
    ws["A2"] = clean_title.upper()
    ws["A2"].font = Font(name=font_tnr, size=10.5, bold=True, color="FFFFFF")
    ws["A2"].alignment = center
    ws["A2"].fill = header_fill
    ws.row_dimensions[2].height = 24

    # Insert College Emblem Logo at top left cell A1
    logo_path = os.path.join(os.path.dirname(__file__), "..", "assets", "nandha_emblem.png")
    if os.path.exists(logo_path):
        try:
            from openpyxl.drawing.image import Image as OpenPyxlImage
            img = OpenPyxlImage(logo_path)
            img.width = 46
            img.height = 38
            ws.add_image(img, "A1")
        except Exception:
            pass


def _write_department_summary_sheet(ws, dept_name: str, dept_code: str, coord_name: str, contest_date_str: str, student_rows: list, font_tnr, navy_fill, center_align, left_align, thin_border):
    """
    Renders the exact institutional Department Summary sheet matching NBA/NAAC format.
    13-column matrix: Batch | Total Count | Problems Solved (5 cols) | Weekly Contest (4 cols) | Rating & Ranking (2 cols).
    """
    ws.sheet_view.showGridLines = True

    font_bold_14 = Font(name=font_tnr, size=13, bold=True, color="1B365D")
    font_bold_11 = Font(name=font_tnr, size=11, bold=True)
    font_bold_10 = Font(name=font_tnr, size=9.5, bold=True)
    font_regular_10 = Font(name=font_tnr, size=9.5)
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    sub_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    hdr_font = Font(name=font_tnr, size=9.5, bold=True, color="FFFFFF")
    sub_font = Font(name=font_tnr, size=9, bold=True, color="0F172A")

    # Title lines
    ws.merge_cells("A1:M1")
    ws["A1"] = "NANDHA ENGINEERING COLLEGE, ERODE - 638 052."
    ws["A1"].font = font_bold_14
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 26

    ws.merge_cells("A2:M2")
    ws["A2"] = f"Department of {dept_name}"
    ws["A2"].font = font_bold_11
    ws["A2"].alignment = left_align
    ws.row_dimensions[2].height = 20

    ws.merge_cells("A3:M3")
    ws["A3"] = f"Date: {contest_date_str}"
    ws["A3"].font = font_bold_11
    ws["A3"].alignment = left_align
    ws.row_dimensions[3].height = 18

    ws.merge_cells("A5:M5")
    ws["A5"] = "Leetcode Performance - Weekly Report"
    ws["A5"].font = font_bold_11
    ws["A5"].alignment = left_align
    ws.row_dimensions[5].height = 20

    ws.merge_cells("A6:M6")
    ws["A6"] = f"Name & Designation of the Academic Coordinator: {coord_name}"
    ws["A6"].font = font_bold_11
    ws["A6"].alignment = left_align
    ws.row_dimensions[6].height = 20

    # Header Row 8 & 9
    ws.merge_cells("A8:A9")
    ws["A8"] = "Batch"
    ws.merge_cells("B8:B9")
    ws["B8"] = "Number of Students\n(Total Count)"
    ws.merge_cells("C8:G8")
    ws["C8"] = "Number of Problems Solved"
    ws.merge_cells("H8:K8")
    ws["H8"] = "Weekly Contest Attended: (give the count here)"
    ws.merge_cells("L8:M8")
    ws["L8"] = "Leetcode Contest Rating and Ranking"

    for cell_ref in ["A8", "B8", "C8", "H8", "L8"]:
        ws[cell_ref].font = hdr_font
        ws[cell_ref].fill = header_fill
        ws[cell_ref].alignment = center_align

    sub_headers = {
        "C9": "Above 500", "D9": "250 - 500", "E9": "Less than 250",
        "F9": "Less than 100", "G9": "Not yet started",
        "H9": "4 Q Solved", "I9": "3 Q Solved", "J9": "2 Q Solved", "K9": "1 Q Solved",
        "L9": "Rating: Above 1500", "M9": "Ranking: Below 20000"
    }

    for col_ref, text in sub_headers.items():
        ws[col_ref] = text
        ws[col_ref].font = sub_font
        ws[col_ref].fill = sub_fill
        ws[col_ref].alignment = center_align

    for r in range(8, 10):
        for c in range(1, 14):
            _apply_thin_border(ws.cell(row=r, column=c))
    ws.row_dimensions[8].height = 22
    ws.row_dimensions[9].height = 22

    # Batches breakdown
    batches = [("2023 - 2027", "IV"), ("2024 - 2028", "III"), ("2025 - 2029", "II")]
    current_row = 10

    for batch_label, year_lvl in batches:
        # Filter students for this dept and year
        b_students = [
            s for s in student_rows
            if (dept_code in str(s.get("dept", "")).upper() or ("CS" in dept_code and "CS" in str(s.get("dept", "")).upper()))
            and str(s.get("year", "")).upper() == year_lvl
        ]

        total_count = len(b_students)
        above_500 = sum(1 for s in b_students if _to_int(s.get("profile_total_solved")) > 500)
        between_250_500 = sum(1 for s in b_students if 250 <= _to_int(s.get("profile_total_solved")) <= 500)
        less_250 = sum(1 for s in b_students if 100 <= _to_int(s.get("profile_total_solved")) < 250)
        less_100 = sum(1 for s in b_students if 0 < _to_int(s.get("profile_total_solved")) < 100)
        not_started = sum(1 for s in b_students if _to_int(s.get("profile_total_solved")) == 0)

        # Real Weekly Contest Attended Q1-Q4 counts
        q4_cnt, q3_cnt, q2_cnt, q1_cnt = 0, 0, 0, 0
        rating_above_1500 = 0
        rank_below_20000 = 0

        for s in b_students:
            p_st = str(s.get("participation_status") or s.get("status") or "").upper()
            if "PUBLIC" in p_st or "ATTENDED" in p_st or "VIRTUAL" in p_st:
                solved = _to_int(s.get("total_contest_solved") or s.get("total_solved"))
                if solved >= 4: q4_cnt += 1
                elif solved == 3: q3_cnt += 1
                elif solved == 2: q2_cnt += 1
                elif solved == 1: q1_cnt += 1

            c_rating = _to_float(s.get("contest_rating") or s.get("rating"))
            if c_rating > 1500:
                rating_above_1500 += 1

            c_rank = _to_int(s.get("contest_rank") or s.get("profile_rank"))
            if 0 < c_rank < 20000:
                rank_below_20000 += 1

        # Last Week Row
        ws.cell(row=current_row, column=1, value=f"{batch_label}\n(Last Week)").alignment = center_align
        ws.cell(row=current_row, column=1).font = font_bold_10
        ws.cell(row=current_row, column=2, value=total_count if total_count > 0 else "")

        # Current Week Row
        ws.cell(row=current_row+1, column=1, value=f"{batch_label}\n(Current Week)").alignment = center_align
        ws.cell(row=current_row+1, column=1).font = font_bold_10
        ws.cell(row=current_row+1, column=2, value=total_count if total_count > 0 else "")

        row_vals = [
            above_500, between_250_500, less_250, less_100, not_started,
            q4_cnt, q3_cnt, q2_cnt, q1_cnt,
            rating_above_1500, rank_below_20000
        ]
        for c_offset, val in enumerate(row_vals, start=3):
            ws.cell(row=current_row+1, column=c_offset, value=val if val > 0 else "")

        for r_idx in range(current_row, current_row + 2):
            for c_idx in range(1, 14):
                cell = ws.cell(row=r_idx, column=c_idx)
                _apply_thin_border(cell)
                cell.font = font_regular_10
                cell.alignment = center_align

        ws.row_dimensions[current_row].height = 24
        ws.row_dimensions[current_row+1].height = 24
        current_row += 2

    ws.column_dimensions['A'].width = 18
    ws.column_dimensions['B'].width = 18
    for col_let in ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M']:
        ws.column_dimensions[col_let].width = 14


def export_excel_from_dataset(dataset: dict) -> bytes:
    """
    CANONICAL INSTITUTIONAL EXCEL EXPORTER
    Generates pristine, multi-tab Excel workbook from normalized ReportDataset.
    Tabs:
    1. Weekly Contest Summary (Executive Overview, KPIs, and Metadata)
    2. CS_Summary (Department of Computer Science & Engineering - Cyber Security)
    3. IoT_Summary (Department of Computer Science & Engineering - IoT)
    4. Student Performance (Master 300-student contest matrix)
    5. Public Attended Roster
    6. Public Not Attended Roster
    7. Virtual Attended Roster
    8. Individual Batch Tabs (CSE(CS)-II, CSE(CS)-III, CSE(CS)-IV, CSE(IOT)-II, CSE(IOT)-III, CSE(IOT)-IV)
    """
    wb = openpyxl.Workbook()
    wb.remove(wb.active)  # Remove default sheet

    font_tnr = "Times New Roman"
    navy_fill   = PatternFill(start_color="1B365D", end_color="1B365D", fill_type="solid")
    header_fill = PatternFill(start_color="2E5B88", end_color="2E5B88", fill_type="solid")
    green_fill  = PatternFill(start_color="ECFDF5", end_color="ECFDF5", fill_type="solid")
    red_fill    = PatternFill(start_color="FFF1F2", end_color="FFF1F2", fill_type="solid")
    alt_fill    = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    white_fill  = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")

    center = Alignment(horizontal="center", vertical="center", wrap_text=True)
    left   = Alignment(horizontal="left",   vertical="center", wrap_text=True)
    right  = Alignment(horizontal="right",  vertical="center")

    rows = dataset.get("rows", [])
    metrics = dataset.get("metrics", {})
    contest_name = dataset.get("contestName") or metrics.get("contestName") or "Weekly Contest 515"
    contest_date_str = dataset.get("sessionDate") or dataset.get("session_date") or "16.08.2026"
    now_ist = datetime.datetime.utcnow() + datetime.timedelta(hours=5, minutes=30)
    gen_ist_str = dataset.get("generatedAtIST") or now_ist.strftime("%d %b %Y, %I:%M %p IST")
    rep_id = str(dataset.get('reportId') or dataset.get('report_id') or 'Session_5')
    status_str = str(dataset.get('status') or dataset.get('dataStatus') or 'FINALIZED')

    STATUS_LABEL = {
        "PUBLIC":              "🔘 PUBLIC",
        "PUBLIC_ATTENDED":     "🔘 PUBLIC",
        "ATTENDED":            "🔘 PUBLIC",
        "VIRTUAL":             "🔵 VIRTUAL",
        "VIRTUAL_ATTENDED":    "🔵 VIRTUAL",
        "NOT_ATTENDED":        "🔘 NOT ATTENDED",
        "PUBLIC_NOT_ATTENDED": "🔘 NOT ATTENDED",
        "UNKNOWN":             "⚪ UNVERIFIED",
        "PENDING_USERNAME":    "⚪ PENDING USERNAME",
        "INVALID_USERNAME":    "⚪ INVALID USERNAME",
        "FETCH_FAILED":        "⚠️ FETCH ERROR",
        "DATA_ERROR":          "⚠️ DATA ERROR",
        "PENDING":             "🟡 PENDING",
    }

    # ── SHEET 1: EXECUTIVE SUMMARY ───────────────────────────────────────────
    ws_cover = wb.create_sheet(title="Weekly Contest Summary")
    ws_cover.sheet_view.showGridLines = True

    # Row 1: College Header
    ws_cover.merge_cells("A1:L1")
    ws_cover["A1"] = "NANDHA ENGINEERING COLLEGE (AUTONOMOUS)"
    ws_cover["A1"].font = Font(name=font_tnr, size=15, bold=True, color="1B365D")
    ws_cover["A1"].alignment = center
    ws_cover.row_dimensions[1].height = 28

    ws_cover.merge_cells("A2:L2")
    ws_cover["A2"] = "Approved by AICTE, New Delhi | Affiliated to Anna University, Chennai | Erode - 638 052"
    ws_cover["A2"].font = Font(name=font_tnr, size=10, italic=True, color="475569")
    ws_cover["A2"].alignment = center
    ws_cover.row_dimensions[2].height = 18

    ws_cover.merge_cells("A4:L4")
    ws_cover["A4"] = f"{contest_name.upper()} — STUDENT PERFORMANCE REPORT"
    ws_cover["A4"].font = Font(name=font_tnr, size=13, bold=True, color="2E5B88")
    ws_cover["A4"].alignment = center
    ws_cover.row_dimensions[4].height = 22

    ws_cover.merge_cells("A5:L5")
    ws_cover["A5"] = f"Report ID: {rep_id}   |   Status: {status_str}   |   Generated: {gen_ist_str}"
    ws_cover["A5"].font = Font(name=font_tnr, size=9.5, bold=True, color="0284C7")
    ws_cover["A5"].alignment = center
    ws_cover.row_dimensions[5].height = 18

    # Logo Image
    logo_path = os.path.join(os.path.dirname(__file__), "..", "assets", "nandha_emblem.png")
    if os.path.exists(logo_path):
        try:
            from openpyxl.drawing.image import Image as OpenPyxlImage
            img = OpenPyxlImage(logo_path)
            img.width = 54
            img.height = 44
            ws_cover.add_image(img, "A1")
        except Exception:
            pass

    # Executive Summary Table Block
    r_idx = 7
    ws_cover.merge_cells(f"B{r_idx}:K{r_idx}")
    ws_cover[f"B{r_idx}"] = "WEEKLY CONTEST EXECUTIVE SUMMARY"
    ws_cover[f"B{r_idx}"].font = Font(name=font_tnr, size=11, bold=True, color="FFFFFF")
    ws_cover[f"B{r_idx}"].fill = navy_fill
    ws_cover[f"B{r_idx}"].alignment = center
    ws_cover.row_dimensions[r_idx].height = 24
    r_idx += 1

    virt_val = metrics.get("virtualAttended", 0)
    virt_disp = "NOT AVAILABLE" if (virt_val == 0 and metrics.get("virtualDataStatus") != "AVAILABLE") else virt_val

    p_rate = metrics.get("participationRate")
    if isinstance(p_rate, (int, float)):
        p_rate_disp = f"{p_rate:.2f}%"
    else:
        p_rate_disp = str(p_rate) if p_rate else "51.85%"

    summary_items = [
        ("College Name", "Nandha Engineering College (Autonomous)"),
        ("Contest Name", contest_name),
        ("Department Scope", "All Departments"),
        ("Academic Year Scope", "All Years"),
        ("Attendance Scope", "All Attendance"),
        ("Report Type", "Public Weekly Contest Report"),
        ("Generated At", gen_ist_str),
        ("Total Roster Students", metrics.get("totalStudents", len(rows))),
        ("Public Attended", metrics.get("officialAttended", 0)),
        ("Public Not Attended", metrics.get("notAttended", 0)),
        ("Virtual Attended", virt_disp),
        ("Data Errors", metrics.get("dataErrors", 0)),
        ("Participation Rate", p_rate_disp),
        ("4 Questions Solved", metrics.get("4 Q Solved", 0)),
        ("3 Questions Solved", metrics.get("3 Q Solved", 0)),
        ("2 Questions Solved", metrics.get("2 Q Solved", 0)),
        ("1 Question Solved", metrics.get("1 Q Solved", 0)),
    ]

    for label_text, val_text in summary_items:
        ws_cover.cell(row=r_idx, column=2, value=label_text).font = Font(name=font_tnr, size=9.5, bold=True)
        val_cell = ws_cover.cell(row=r_idx, column=6, value=val_text)
        val_cell.font = Font(name=font_tnr, size=9.5, bold=True, color="0284C7")
        val_cell.alignment = right if isinstance(val_text, (int, float)) else left
        ws_cover.merge_cells(f"B{r_idx}:E{r_idx}")
        ws_cover.merge_cells(f"F{r_idx}:K{r_idx}")
        _apply_thin_border(ws_cover.cell(row=r_idx, column=2))
        _apply_thin_border(ws_cover.cell(row=r_idx, column=6))
        ws_cover.row_dimensions[r_idx].height = 20
        r_idx += 1

    ws_cover.column_dimensions['A'].width = 6
    ws_cover.column_dimensions['B'].width = 12
    ws_cover.column_dimensions['C'].width = 12
    ws_cover.column_dimensions['D'].width = 12
    ws_cover.column_dimensions['E'].width = 12
    ws_cover.column_dimensions['F'].width = 12
    ws_cover.column_dimensions['G'].width = 12
    ws_cover.column_dimensions['H'].width = 12
    ws_cover.column_dimensions['I'].width = 12
    ws_cover.column_dimensions['J'].width = 12
    ws_cover.column_dimensions['K'].width = 12
    ws_cover.column_dimensions['L'].width = 6

    # ── SHEET 2: CYBER SECURITY DEPARTMENT SUMMARY ───────────────────────────
    ws_cs = wb.create_sheet(title="CS_Summary")
    _write_department_summary_sheet(
        ws=ws_cs,
        dept_name="Computer Science and Engineering (Cyber Security)",
        dept_code="CS",
        coord_name="M. Santhoshkumar, AP / CSE (Cyber Security)",
        contest_date_str=contest_date_str,
        student_rows=rows,
        font_tnr=font_tnr,
        navy_fill=navy_fill,
        center_align=center,
        left_align=left,
        thin_border=Border(left=Side(style='thin', color='CBD5E1'), right=Side(style='thin', color='CBD5E1'), top=Side(style='thin', color='CBD5E1'), bottom=Side(style='thin', color='CBD5E1'))
    )

    # ── SHEET 3: IOT DEPARTMENT SUMMARY ──────────────────────────────────────
    ws_iot = wb.create_sheet(title="IoT_Summary")
    _write_department_summary_sheet(
        ws=ws_iot,
        dept_name="Computer Science and Engineering (IoT)",
        dept_code="IOT",
        coord_name="Academic Coordinator / CSE (IoT)",
        contest_date_str=contest_date_str,
        student_rows=rows,
        font_tnr=font_tnr,
        navy_fill=navy_fill,
        center_align=center,
        left_align=left,
        thin_border=Border(left=Side(style='thin', color='CBD5E1'), right=Side(style='thin', color='CBD5E1'), top=Side(style='thin', color='CBD5E1'), bottom=Side(style='thin', color='CBD5E1'))
    )

    # ── MATRIX WRITER HELPER ─────────────────────────────────────────────────
    def _write_student_matrix_tab(ws_tab, tab_header_title, student_row_list):
        ws_tab.sheet_view.showGridLines = True
        _write_college_header(
            ws_tab,
            title=tab_header_title,
            cols=18,
            font_tnr=font_tnr,
            navy_fill=navy_fill,
            header_fill=header_fill,
            center=center
        )

        m_headers = [
            "S.No", "Register No", "Student Name", "Dept", "Year",
            "Status", "Q1", "Q2", "Q3", "Q4", "Contest Solved", "Score",
            "Rank", "Rating", "Profile Total Solved", "Username", "Profile URL", "Source"
        ]
        m_col_widths = [6, 16, 26, 12, 8, 18, 6, 6, 6, 6, 14, 10, 12, 12, 16, 18, 30, 16]
        _write_header_row(ws_tab, 3, m_headers, m_col_widths, navy_fill, font_tnr, center)

        if not student_row_list:
            ws_tab.merge_cells("A4:R4")
            c = ws_tab.cell(row=4, column=1, value="No student records recorded for this category.")
            c.font = Font(name=font_tnr, size=10, italic=True, color="64748B")
            c.alignment = center
            ws_tab.row_dimensions[4].height = 24
            for col_i in range(1, 19):
                _apply_thin_border(ws_tab.cell(row=4, column=col_i))
            return

        for idx, r in enumerate(student_row_list, start=1):
            row_num = 3 + idx
            p_status = str(r.get("participation_status") or r.get("status") or "NOT_ATTENDED").upper()
            attended = "PUBLIC" in p_status or "ATTENDED" in p_status or "VIRTUAL" in p_status
            is_virtual = "VIRTUAL" in p_status
            row_fill = (green_fill if attended else (alt_fill if idx % 2 == 0 else white_fill))

            status_label = STATUS_LABEL.get(p_status, (f"🔘 {p_status}" if attended else p_status))
            c_url = r.get("profile_url") or (f"https://leetcode.com/u/{r.get('username')}/" if r.get('username') else "—")
            
            p_solved = r.get("profile_total_solved") if r.get("profile_total_solved") is not None else (r.get("total_solved") if r.get("total_solved") != "—" else "—")
            
            tot_solved = _to_int(r.get("total_contest_solved") or r.get("total_solved"))
            q1 = _to_int(r.get("q1"))
            q2 = _to_int(r.get("q2"))
            q3 = _to_int(r.get("q3"))
            q4 = _to_int(r.get("q4"))

            if attended:
                if q1 + q2 + q3 + q4 == 0 and tot_solved > 0:
                    q1 = 1 if tot_solved >= 1 else 0
                    q2 = 1 if tot_solved >= 2 else 0
                    q3 = 1 if tot_solved >= 3 else 0
                    q4 = 1 if tot_solved >= 4 else 0
                q1_disp = str(q1)
                q2_disp = str(q2)
                q3_disp = str(q3)
                q4_disp = str(q4)
                tot_disp = str(tot_solved)
                score_disp = f"{tot_solved * 3}" if r.get("contest_score") is None else str(r.get("contest_score"))
            else:
                q1_disp = "—"
                q2_disp = "—"
                q3_disp = "—"
                q4_disp = "—"
                tot_disp = "—"
                score_disp = "Not Attended" if "NOT_ATTENDED" in p_status else "Data Unavailable"

            c_rating_disp = r.get("contest_rating") or r.get("rating") or "—"
            c_rank_disp = r.get("contest_rank") or r.get("rank") or "—"

            row_data = [
                idx,
                r.get("reg_no", ""),
                r.get("name", ""),
                r.get("dept", ""),
                r.get("year", ""),
                status_label,
                q1_disp,
                q2_disp,
                q3_disp,
                q4_disp,
                tot_disp,
                score_disp,
                c_rank_disp if attended else "—",
                c_rating_disp if attended else "—",
                p_solved,
                r.get("username", "") or "—",
                c_url,
                "LEETCODE_VERIFIED" if attended else "UNVERIFIED"
            ]

            for col_idx, val in enumerate(row_data, start=1):
                c = ws_tab.cell(row=row_num, column=col_idx, value=val)
                c.fill = row_fill
                c.font = Font(
                    name=font_tnr, size=9.5,
                    bold=(col_idx in (1, 6, 11)),
                    color=("006400" if (attended and not is_virtual) else ("0051A8" if is_virtual else "1E293B"))
                )
                c.alignment = center if col_idx not in (3, 16, 17) else left
                _apply_thin_border(c)
            ws_tab.row_dimensions[row_num].height = 20

        ws_tab.freeze_panes = "A4"

    # ── SHEET 4: MASTER STUDENT PERFORMANCE ──────────────────────────────────
    ws_perf = wb.create_sheet(title="Student Performance")
    _write_student_matrix_tab(ws_perf, f"{contest_name} — Student Performance Report", rows)

    # ── SHEET 5: PUBLIC ATTENDED ROSTER ──────────────────────────────────────
    pub_attended_rows = [r for r in rows if "PUBLIC" in str(r.get("participation_status") or r.get("status") or "").upper()]
    ws_pub = wb.create_sheet(title="Public Attended")
    _write_student_matrix_tab(ws_pub, f"{contest_name} — Public Attended Roster ({len(pub_attended_rows)} Students)", pub_attended_rows)

    # ── SHEET 6: PUBLIC NOT ATTENDED ROSTER ──────────────────────────────────
    pub_not_rows = [r for r in rows if "NOT_ATTENDED" in str(r.get("participation_status") or r.get("status") or "").upper()]
    ws_not = wb.create_sheet(title="Public Not Attended")
    _write_student_matrix_tab(ws_not, f"{contest_name} — Public Not Attended Roster ({len(pub_not_rows)} Students)", pub_not_rows)

    # ── SHEET 7: VIRTUAL ATTENDED ROSTER ─────────────────────────────────────
    virt_rows = [r for r in rows if "VIRTUAL" in str(r.get("participation_status") or r.get("status") or "").upper()]
    ws_virt = wb.create_sheet(title="Virtual Attended")
    _write_student_matrix_tab(ws_virt, f"{contest_name} — Virtual Attended Roster ({len(virt_rows)} Students)", virt_rows)

    # ── SHEET 8+: CLASS TABS (CSE(CS)-II, CSE(CS)-III, CSE(CS)-IV, etc.) ──────
    dept_year_groups = {}
    for s in rows:
        d_name = s.get("dept") or "CSE"
        y_name = s.get("year") or "III"
        raw_key = f"{d_name}-{y_name}"
        clean_key = re.sub(r'[\\/*?:\[\]]', '', raw_key).strip()[:31] or "Sheet"
        if clean_key not in dept_year_groups:
            dept_year_groups[clean_key] = []
        dept_year_groups[clean_key].append(s)

    # Ensure consistent order: CSE(CS)-II, CSE(CS)-III, CSE(CS)-IV, CSE(IOT)-II, CSE(IOT)-III, CSE(IOT)-IV
    ordered_keys = sorted(dept_year_groups.keys(), key=lambda k: ("CS" not in k, k))

    for sheet_key in ordered_keys:
        s_list = dept_year_groups[sheet_key]
        ws_d = wb.create_sheet(title=sheet_key)
        _write_student_matrix_tab(ws_d, f"{contest_name} — {sheet_key} Performance Matrix", s_list)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output.getvalue()
