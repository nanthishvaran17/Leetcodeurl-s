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
        c.font = Font(name=font_tnr, size=9, bold=True, color="FFFFFF")
        c.fill = navy_fill
        c.alignment = center
        _apply_thin_border(c)
        ws.column_dimensions[get_column_letter(col_idx)].width = width
    ws.row_dimensions[row_num].height = 22

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

    # Clean title text to prevent duplicate "NANDHA ENGINEERING COLLEGE" lines and text overlapping
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
            img.width = 52
            img.height = 42
            ws.add_image(img, "A1")
        except Exception:
            pass

def export_excel_from_dataset(dataset: dict) -> bytes:
    """
    EXCEL EXPORTER
    Generates Excel directly from normalized ReportDataset.
    Includes:
    - Cover Sheet with College Logo, Executive Metrics, and Batch Breakdown Summary
    - Master Contest Matrix (for Weekly Contest datasets)
    - Per-Department & Year Sheet Tabs (e.g. CSE(CS)-III, CSE(IOT)-III, etc.)
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

    is_weekly = (
        dataset.get("report_type", "").lower() in ("weekly_contest", "weekly contest")
        or bool(dataset.get("rows"))
    )

    rows = dataset.get("rows", [])
    all_students = dataset.get("allStudents") or []

    # ── SHEET 1: WEEKLY CONTEST SUMMARY ──────────────────────────────────────
    sheet1_title = "Weekly Contest Summary" if is_weekly else "Report Overview"
    ws_cover = wb.create_sheet(title=sheet1_title)
    ws_cover.sheet_view.showGridLines = True

    # Try inserting Logo Image at top left if PIL / openpyxl image works
    logo_path = os.path.join(os.path.dirname(__file__), "..", "assets", "nandha_emblem.png")
    if os.path.exists(logo_path):
        try:
            from openpyxl.drawing.image import Image as OpenPyxlImage
            img = OpenPyxlImage(logo_path)
            img.width = 65
            img.height = 55
            ws_cover.add_image(img, "A1")
        except Exception:
            pass

    ws_cover.merge_cells("A2:L2")
    ws_cover["A2"] = "NANDHA ENGINEERING COLLEGE (AUTONOMOUS)"
    ws_cover["A2"].font = Font(name=font_tnr, size=16, bold=True, color="1B365D")
    ws_cover["A2"].alignment = center

    ws_cover.merge_cells("A3:L3")
    ws_cover["A3"] = "Approved by AICTE, New Delhi | Affiliated to Anna University, Chennai | Erode - 638 052"
    ws_cover["A3"].font = Font(name=font_tnr, size=10, italic=True)
    ws_cover["A3"].alignment = center

    ws_cover.merge_cells("A5:L5")
    ws_cover["A5"] = dataset.get("title", "PUBLIC WEEKLY CONTEST PERFORMANCE REPORT").upper()
    ws_cover["A5"].font = Font(name=font_tnr, size=14, bold=True, color="2E5B88")
    ws_cover["A5"].alignment = center

    now_ist = datetime.datetime.utcnow() + datetime.timedelta(hours=5, minutes=30)
    gen_ist_str = dataset.get("generatedAtIST") or now_ist.strftime("%d %b %Y, %I:%M %p IST")
    rep_id = str(dataset.get('reportId') or dataset.get('report_id') or 'WEEKLY_REPORT')
    status_str = str(dataset.get('dataStatus') or dataset.get('data_status') or 'FINALIZED')

    ws_cover["A7"] = f"Report ID: {rep_id}   |   Status: {status_str}   |   Generated: {gen_ist_str}"
    ws_cover["A7"].font = Font(name=font_tnr, size=10, bold=True, color="0284C7")
    ws_cover["A7"].alignment = center

    # Executive Summary Metrics Block
    metrics = dataset.get("metrics", {})
    r_idx = 10
    ws_cover.merge_cells(f"B{r_idx}:K{r_idx}")
    ws_cover[f"B{r_idx}"] = "WEEKLY CONTEST EXECUTIVE SUMMARY"
    ws_cover[f"B{r_idx}"].font = Font(name=font_tnr, size=11, bold=True, color="FFFFFF")
    ws_cover[f"B{r_idx}"].fill = navy_fill
    ws_cover[f"B{r_idx}"].alignment = center
    ws_cover.row_dimensions[r_idx].height = 24
    r_idx += 1

    virt_val = metrics.get("virtualAttended", 0)
    if virt_val == 0 and metrics.get("virtualDataStatus") != "AVAILABLE":
        virt_disp = "NOT AVAILABLE"
    else:
        virt_disp = virt_val

    dept_disp = dataset.get("deptFilter") or "All Departments"
    if dept_disp == "ALL": dept_disp = "All Departments"
    year_disp = dataset.get("yearFilter") or "All Years"
    if year_disp == "ALL": year_disp = "All Years"
    else: year_disp = f"{year_disp} Year"
    att_disp = dataset.get("attendanceFilter") or "All"
    if att_disp == "PUBLIC_ATTENDED": att_disp = "Public Attended"
    elif att_disp == "PUBLIC_NOT_ATTENDED": att_disp = "Not Attended"
    elif att_disp == "VIRTUAL_ATTENDED": att_disp = "Virtual Attended"
    elif att_disp == "ALL": att_disp = "All Attendance"

    summary_items = [
        ("College Name", "Nandha Engineering College (Autonomous)"),
        ("Contest Name", dataset.get("contestName") or metrics.get("contestName") or "Weekly Contest"),
        ("Department Scope", dept_disp),
        ("Academic Year Scope", year_disp),
        ("Attendance Scope", att_disp),
        ("Report Type", "Public Weekly Contest Report"),
        ("Generated At", gen_ist_str),
        ("Total Roster Students", metrics.get("totalStudents", len(rows))),
        ("Public Attended", metrics.get("officialAttended", 0)),
        ("Public Not Attended", metrics.get("notAttended", 0)),
        ("Virtual Attended", virt_disp),
        ("Data Errors", metrics.get("dataErrors", 0)),
        ("Participation Rate", metrics.get("participationRate", "—")),
        ("4 Questions Solved", metrics.get("4 Q Solved", 0)),
        ("3 Questions Solved", metrics.get("3 Q Solved", 0)),
        ("2 Questions Solved", metrics.get("2 Q Solved", 0)),
        ("1 Question Solved", metrics.get("1 Q Solved", 0)),
    ]

    for label_text, val_text in summary_items:
        ws_cover.cell(row=r_idx, column=2, value=label_text).font = Font(name=font_tnr, size=10, bold=True)
        val_cell = ws_cover.cell(row=r_idx, column=6, value=f"{val_text:,}" if isinstance(val_text, (int, float)) and val_text > 999 else (val_text if val_text is not None else "—"))
        val_cell.font = Font(name=font_tnr, size=10, bold=True, color="0284C7")
        val_cell.alignment = right if isinstance(val_text, (int, float)) else left
        ws_cover.merge_cells(f"B{r_idx}:E{r_idx}")
        ws_cover.merge_cells(f"F{r_idx}:K{r_idx}")
        _apply_thin_border(ws_cover.cell(row=r_idx, column=2))
        _apply_thin_border(ws_cover.cell(row=r_idx, column=6))
        ws_cover.row_dimensions[r_idx].height = 19
        r_idx += 1

    r_idx += 2

    # ── SHEET 2: STUDENT PERFORMANCE MATRIX ──────────────────────────────────
    STATUS_LABEL = {
        "PUBLIC_ATTENDED":    "🟢 PUBLIC",
        "ATTENDED":           "🟢 PUBLIC",
        "VIRTUAL_ATTENDED":   "🔵 VIRTUAL",
        "PUBLIC_NOT_ATTENDED":"🔴 NOT ATTENDED",
        "NOT_ATTENDED":       "🔴 NOT ATTENDED",
        "DATA_ERROR":         "⚠️ DATA ERROR",
        "PENDING":            "🟡 PENDING",
    }

    def _write_matrix_tab(ws_tab, tab_header_title, student_row_list):
        ws_tab.sheet_view.showGridLines = True
        _write_college_header(
            ws_tab,
            title=tab_header_title,
            cols=17,
            font_tnr=font_tnr,
            navy_fill=navy_fill,
            header_fill=header_fill,
            center=center
        )

        m_headers   = [
            "S.No", "Register No", "Student Name", "Department", "Year",
            "LeetCode Handle", "Attendance Status", "Contest Name", "Contest Rating",
            "Contest Rank", "Profile Rank", "Total Solved",
            "Q1", "Q2", "Q3", "Q4", "Total Contest Solved"
        ]
        m_col_widths = [8, 16, 28, 14, 10, 20, 20, 24, 16, 14, 14, 14, 8, 8, 8, 8, 20]
        _write_header_row(ws_tab, 3, m_headers, m_col_widths, navy_fill, font_tnr, center)

        for idx, r in enumerate(student_row_list, start=1):
            row_num   = 3 + idx
            p_status  = r.get("participation_status") or "PENDING"
            attended  = p_status in ("PUBLIC_ATTENDED", "ATTENDED", "VIRTUAL_ATTENDED")
            is_virtual = p_status == "VIRTUAL_ATTENDED"
            row_fill  = (green_fill if attended else red_fill) if idx % 2 != 0 else (
                PatternFill(start_color="D1FAE5", end_color="D1FAE5", fill_type="solid") if attended
                else PatternFill(start_color="FFE4E6", end_color="FFE4E6", fill_type="solid")
            )

            status_label = STATUS_LABEL.get(p_status, p_status)
            c_name_val = r.get("contest_name") or dataset.get("contestName") or "Weekly Contest"
            
            v_q1 = r.get("q1")
            v_q2 = r.get("q2")
            v_q3 = r.get("q3")
            v_q4 = r.get("q4")

            q1_disp = v_q1 if (attended and v_q1 != "—") else "—"
            q2_disp = v_q2 if (attended and v_q2 != "—") else "—"
            q3_disp = v_q3 if (attended and v_q3 != "—") else "—"
            q4_disp = v_q4 if (attended and v_q4 != "—") else "—"

            solved_cnt = r.get("total_solved") if (attended and r.get("total_solved") != "—") else "—"
            rank_disp = r.get("rank") or r.get("contest_rank") or "—"
            rating_disp = r.get("rating") or r.get("contest_rating") or "—"
            if not attended:
                rank_disp = "—"
                rating_disp = "—"

            row_data = [
                idx,
                r.get("reg_no", ""),
                r.get("name", ""),
                r.get("dept", ""),
                r.get("year", ""),
                r.get("username", "") or r.get("reg_no", ""),
                status_label,
                c_name_val,
                rating_disp,
                rank_disp,
                r.get("profile_rank", "—"),
                r.get("profile_total_solved", "—"),
                q1_disp,
                q2_disp,
                q3_disp,
                q4_disp,
                solved_cnt,
            ]

            for col_idx, val in enumerate(row_data, start=1):
                c = ws_tab.cell(row=row_num, column=col_idx, value=val)
                c.fill = row_fill
                c.font = Font(
                    name=font_tnr, size=9.5,
                    bold=(col_idx in (1, 7, 17)),
                    color=("006400" if (attended and not is_virtual) else ("0051A8" if is_virtual else "8B0000"))
                    if col_idx == 7 else "1E293B"
                )
                c.alignment = center if col_idx not in (3, 6, 8) else left
                _apply_thin_border(c)
            ws_tab.row_dimensions[row_num].height = 20

        ws_tab.freeze_panes = "A4"

    if is_weekly and rows:
        # Sheet 2: Student Performance
        ws_perf = wb.create_sheet(title="Student Performance")
        _write_matrix_tab(ws_perf, dataset.get("title", "Weekly Contest — Student Performance Matrix"), rows)

        # Sheet 3: Public Attended
        pub_attended_rows = [r for r in rows if r.get("participation_status") in ("PUBLIC_ATTENDED", "ATTENDED") or r.get("status") == "PUBLIC"]
        if pub_attended_rows:
            ws_pub = wb.create_sheet(title="Public Attended")
            _write_matrix_tab(ws_pub, f"{dataset.get('contestName', 'Weekly Contest')} — Public Attended Roster", pub_attended_rows)

        # Sheet 4: Public Not Attended
        pub_not_rows = [r for r in rows if r.get("participation_status") in ("PUBLIC_NOT_ATTENDED", "NOT_ATTENDED", "PENDING") or r.get("status") == "NOT ATTENDED"]
        if pub_not_rows:
            ws_not = wb.create_sheet(title="Public Not Attended")
            _write_matrix_tab(ws_not, f"{dataset.get('contestName', 'Weekly Contest')} — Public Not Attended Roster", pub_not_rows)

        # Sheet 5: Virtual Attended
        virt_rows = [r for r in rows if r.get("participation_status") == "VIRTUAL_ATTENDED" or r.get("status") == "VIRTUAL"]
        if virt_rows:
            ws_virt = wb.create_sheet(title="Virtual Attended")
            _write_matrix_tab(ws_virt, f"{dataset.get('contestName', 'Weekly Contest')} — Virtual Attended Roster", virt_rows)

    # ── SHEET 3+: PER-DEPARTMENT & YEAR SHEET TABS ────────────────────────────
    # Group students by Department & Year for dedicated class/dept tabs
    target_list = rows if rows else all_students
    if target_list:
        dept_year_groups = {}
        for s in target_list:
            d_name = s.get("dept") or s.get("department") or "CSE"
            y_name = s.get("year") or "III"
            raw_key = f"{d_name}-{y_name}"
            clean_key = re.sub(r'[\\/*?:\[\]]', '', raw_key).strip()[:31] or "Sheet"
            if clean_key not in dept_year_groups:
                dept_year_groups[clean_key] = []
            dept_year_groups[clean_key].append(s)

        for sheet_key, s_list in dept_year_groups.items():
            # Ensure unique sheet title
            final_title = sheet_key
            counter = 1
            while final_title in wb.sheetnames:
                final_title = f"{sheet_key[:28]}_{counter}"
                counter += 1

            ws_d = wb.create_sheet(title=final_title)
            ws_d.sheet_view.showGridLines = True

            sheet_title = f"{dataset.get('title', 'Weekly Report')} — {final_title}"
            if is_weekly:
                _write_college_header(ws_d, sheet_title, 12, font_tnr, navy_fill, header_fill, center)
                m_headers    = ["S.No", "Register No", "Student Name", "Dept", "Year", "Status", "Q1", "Q2", "Q3", "Q4", "Contest Solved", "Rank"]
                m_col_widths = [6,       16,            28,             12,     8,      18,       6,    6,    6,    6,    14,               10]
                _write_header_row(ws_d, 3, m_headers, m_col_widths, navy_fill, font_tnr, center)

                for idx, r in enumerate(s_list, start=1):
                    row_num = 3 + idx
                    p_status = r.get("participation_status") or "PENDING"
                    attended = p_status in ("PUBLIC_ATTENDED", "ATTENDED", "VIRTUAL_ATTENDED")
                    is_virtual = p_status == "VIRTUAL_ATTENDED"
                    row_fill = (green_fill if attended else red_fill) if idx % 2 != 0 else (
                        PatternFill(start_color="D1FAE5", end_color="D1FAE5", fill_type="solid") if attended
                        else PatternFill(start_color="FFE4E6", end_color="FFE4E6", fill_type="solid")
                    )
                    status_label = STATUS_LABEL.get(p_status, p_status)
                    q1 = 1 if _to_int(r.get("q1")) > 0 else 0
                    q2 = 1 if _to_int(r.get("q2")) > 0 else 0
                    q3 = 1 if _to_int(r.get("q3")) > 0 else 0
                    q4 = 1 if _to_int(r.get("q4")) > 0 else 0
                    solved_cnt = q1 + q2 + q3 + q4

                    row_data = [
                        idx,
                        r.get("reg_no", ""),
                        r.get("name", ""),
                        r.get("dept", ""),
                        r.get("year", ""),
                        status_label,
                        q1 if attended else "—",
                        q2 if attended else "—",
                        q3 if attended else "—",
                        q4 if attended else "—",
                        solved_cnt if attended else "—",
                        r.get("rank") or r.get("contest_rank") or "—" if attended else "—",
                    ]
                    for col_idx, val in enumerate(row_data, start=1):
                        c = ws_d.cell(row=row_num, column=col_idx, value=val)
                        c.fill = row_fill
                        c.font = Font(name=font_tnr, size=9)
                        c.alignment = center if col_idx not in (3,) else left
                        _apply_thin_border(c)
                    ws_d.row_dimensions[row_num].height = 18
                ws_d.freeze_panes = "A4"

            else:
                _write_college_header(ws_d, sheet_title, 11, font_tnr, navy_fill, header_fill, center)
                headers    = ["S.No", "Register No", "Student Name", "Department", "Year", "LeetCode URL", "Username", "Easy", "Medium", "Hard", "Total Solved"]
                col_widths = [6, 16, 28, 12, 8, 36, 18, 10, 10, 10, 12]
                _write_header_row(ws_d, 3, headers, col_widths, navy_fill, font_tnr, center)

                for idx, student in enumerate(s_list, start=1):
                    r_num = 3 + idx
                    r_fill = alt_fill if idx % 2 == 0 else white_fill
                    lc_url = student.get("leetcode_url") or student.get("url") or ""
                    r_data = [
                        idx,
                        student.get("reg_no", ""),
                        student.get("name", ""),
                        student.get("dept", ""),
                        student.get("year", ""),
                        lc_url,
                        student.get("username", ""),
                        student.get("easy") if student.get("easy") is not None else "—",
                        student.get("medium") if student.get("medium") is not None else "—",
                        student.get("hard") if student.get("hard") is not None else "—",
                        student.get("total_solved") if student.get("total_solved") is not None else "—",
                    ]
                    for col_idx, val in enumerate(r_data, start=1):
                        c = ws_d.cell(row=r_num, column=col_idx, value=val)
                        c.fill = r_fill
                        c.font = Font(name=font_tnr, size=10)
                        c.alignment = center if col_idx not in (3, 6, 7) else left
                        _apply_thin_border(c)
                    ws_d.row_dimensions[r_num].height = 18
                ws_d.freeze_panes = "A4"

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output.getvalue()


