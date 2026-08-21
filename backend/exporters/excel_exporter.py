import os
import io
import datetime
import re
from typing import Dict, Any, List, Optional
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# ─── Style & Border Constants ────────────────────────────────────────────────
FONT_TNR = "Times New Roman"
NAVY_FILL = PatternFill(start_color="1B365D", end_color="1B365D", fill_type="solid")
HEADER_FILL = PatternFill(start_color="2E5B88", end_color="2E5B88", fill_type="solid")
SUB_FILL = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
SECTION_FILL = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")
GREEN_FILL = PatternFill(start_color="ECFDF5", end_color="ECFDF5", fill_type="solid")
LIGHT_BLUE_FILL = PatternFill(start_color="F0F9FF", end_color="F0F9FF", fill_type="solid")
ALT_FILL = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
WHITE_FILL = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")

ALIGN_CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)
ALIGN_LEFT = Alignment(horizontal="left", vertical="center", wrap_text=True)
ALIGN_RIGHT = Alignment(horizontal="right", vertical="center")

def _apply_thin_border(cell):
    s = Side(style='thin', color='CBD5E1')
    cell.border = Border(left=s, right=s, top=s, bottom=s)

def _apply_box_border(cell, color='1B365D'):
    s = Side(style='medium', color=color)
    cell.border = Border(left=s, right=s, top=s, bottom=s)

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

def _write_college_header(ws, report_title: str, dept_text: str, cols: int, metadata_block: Dict[str, str] = None):
    """
    Renders official Nandha Engineering College branding header on any worksheet.
    Includes logo emblem, autonomous tag, dynamic departments, title, and metadata.
    """
    last_col = get_column_letter(cols)
    ws.sheet_view.showGridLines = True

    # Row 1: College Header
    ws.merge_cells(f"A1:{last_col}1")
    ws["A1"] = "NANDHA ENGINEERING COLLEGE, ERODE – 638 052"
    ws["A1"].font = Font(name=FONT_TNR, size=14, bold=True, color="FFFFFF")
    ws["A1"].alignment = ALIGN_CENTER
    ws["A1"].fill = NAVY_FILL
    ws.row_dimensions[1].height = 28

    # Row 2: Accreditation & Autonomous subtitle
    ws.merge_cells(f"A2:{last_col}2")
    ws["A2"] = "(AUTONOMOUS) • ESTD 2001 | Approved by AICTE, New Delhi & Affiliated to Anna University, Chennai"
    ws["A2"].font = Font(name=FONT_TNR, size=9.5, italic=True, color="FFFFFF")
    ws["A2"].alignment = ALIGN_CENTER
    ws["A2"].fill = HEADER_FILL
    ws.row_dimensions[2].height = 18

    # Row 3: Dynamic Department
    ws.merge_cells(f"A3:{last_col}3")
    ws["A3"] = dept_text.upper()
    ws["A3"].font = Font(name=FONT_TNR, size=10.5, bold=True, color="1B365D")
    ws["A3"].alignment = ALIGN_CENTER
    ws["A3"].fill = SUB_FILL
    ws.row_dimensions[3].height = 20

    # Row 4: Report Title
    ws.merge_cells(f"A4:{last_col}4")
    ws["A4"] = report_title.upper()
    ws["A4"].font = Font(name=FONT_TNR, size=12, bold=True, color="2E5B88")
    ws["A4"].alignment = ALIGN_CENTER
    ws.row_dimensions[4].height = 22

    # Insert College Logo at A1
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

    # Row 5: Metadata line
    if metadata_block:
        meta_parts = []
        for k, v in metadata_block.items():
            if v:
                meta_parts.append(f"{k}: {v}")
        meta_str = "   |   ".join(meta_parts)
        ws.merge_cells(f"A5:{last_col}5")
        ws["A5"] = meta_str
        ws["A5"].font = Font(name=FONT_TNR, size=8.5, bold=True, color="64748B")
        ws["A5"].alignment = ALIGN_CENTER
        ws.row_dimensions[5].height = 18


def export_excel_from_dataset(dataset: dict) -> bytes:
    """
    CANONICAL INSTITUTIONAL 4-SHEET EXCEL EXPORTER
    Generates pristine, evidence-based, four-sheet institutional workbook from validated snapshot:
    1. SHEET 1 — EXECUTIVE SUMMARY
    2. SHEET 2 — DEPARTMENT & YEAR ANALYSIS
    3. SHEET 3 — CONTEST PERFORMANCE
    4. SHEET 4 — PUBLIC ATTENDED ROSTER
    """
    wb = openpyxl.Workbook()
    wb.remove(wb.active)  # Remove default blank sheet

    rows = dataset.get("rows", [])
    metrics = dataset.get("metrics", {})
    contest_name = dataset.get("contestName") or metrics.get("contestName") or "Weekly Contest 516"
    contest_date_str = dataset.get("sessionDate") or dataset.get("session_date") or "23.08.2026"
    snapshot_id = str(dataset.get("snapshotId") or dataset.get("snapshot_id") or dataset.get("reportId") or "SNAPSHOT_516")
    gen_time_str = dataset.get("generatedAtIST") or datetime.datetime.now().strftime("%d %b %Y, %I:%M %p IST")

    # 1. Dynamic Departments Detection
    departments_set = sorted(list({r.get("department_name") or r.get("department") or "CSE" for r in rows}))
    if len(departments_set) == 1:
        dept_header_text = f"Department of {departments_set[0]}"
    else:
        dept_header_text = "Department of " + " & ".join(departments_set)

    metadata_block = {
        "Report Date": contest_date_str,
        "Contest": contest_name,
        "Academic Year": "2026–2027",
        "Snapshot ID": snapshot_id,
        "Generated At": gen_time_str
    }

    # Helper: group data by Dept and Year/Batch
    dept_year_groups: Dict[str, Dict[str, List[dict]]] = {}
    for r in rows:
        d_name = r.get("department_name") or r.get("department") or "CSE"
        y_name = r.get("year_level") or r.get("year") or "IV"
        if d_name not in dept_year_groups:
            dept_year_groups[d_name] = {}
        if y_name not in dept_year_groups[d_name]:
            dept_year_groups[d_name][y_name] = []
        dept_year_groups[d_name][y_name].append(r)

    # ══════════════════════════════════════════════════════════════════════════
    # SHEET 1: EXECUTIVE SUMMARY
    # ══════════════════════════════════════════════════════════════════════════
    ws1 = wb.create_sheet(title="Executive Summary")
    _write_college_header(ws1, "LEETCODE WEEKLY PERFORMANCE — EXECUTIVE SUMMARY", dept_header_text, 10, metadata_block)

    # Overview KPI Cards Block
    tot_students = len(rows)
    tot_attended = sum(1 for r in rows if r.get("participation_status") in ("PUBLIC_ATTENDED", "OFFICIAL_ATTENDED", "ATTENDED", "PUBLIC"))
    tot_not_attended = tot_students - tot_attended
    att_pct = (tot_attended / tot_students * 100) if tot_students > 0 else 0.0
    tot_platform_solved = sum(_to_int(r.get("total_solved")) for r in rows)
    tot_contest_solved = sum(_to_int(r.get("contest_problems_solved") or r.get("problems_solved")) for r in rows)

    # 4 KPI Cards in Row 7-8
    r_kpi = 7
    kpis = [
        ("TOTAL ACTIVE STUDENTS", f"{tot_students}", "A", "B", "1B365D"),
        ("OFFICIAL CONTEST ATTENDANCE", f"{tot_attended} ({att_pct:.1f}%)", "C", "E", "059669"),
        ("PUBLIC NOT ATTENDED", f"{tot_not_attended}", "F", "G", "DC2626"),
        ("TOTAL PLATFORM SOLVED", f"{tot_platform_solved:,}", "H", "J", "2E5B88"),
    ]
    for title, val, start_c, end_c, col_hex in kpis:
        ws1.merge_cells(f"{start_c}{r_kpi}:{end_c}{r_kpi}")
        c_title = ws1[f"{start_c}{r_kpi}"]
        c_title.value = title
        c_title.font = Font(name=FONT_TNR, size=8.5, bold=True, color="FFFFFF")
        c_title.fill = PatternFill(start_color=col_hex, end_color=col_hex, fill_type="solid")
        c_title.alignment = ALIGN_CENTER
        _apply_thin_border(c_title)

        ws1.merge_cells(f"{start_c}{r_kpi+1}:{end_c}{r_kpi+1}")
        c_val = ws1[f"{start_c}{r_kpi+1}"]
        c_val.value = val
        c_val.font = Font(name=FONT_TNR, size=13, bold=True, color=col_hex)
        c_val.fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
        c_val.alignment = ALIGN_CENTER
        _apply_thin_border(c_val)

    ws1.row_dimensions[r_kpi].height = 18
    ws1.row_dimensions[r_kpi+1].height = 24

    # Department Summary Table (Row 10)
    r_dept = 10
    ws1.merge_cells(f"A{r_dept}:J{r_dept}")
    ws1[f"A{r_dept}"] = "INSTITUTIONAL DEPARTMENT BREAKDOWN"
    ws1[f"A{r_dept}"].font = Font(name=FONT_TNR, size=10.5, bold=True, color="FFFFFF")
    ws1[f"A{r_dept}"].fill = NAVY_FILL
    ws1[f"A{r_dept}"].alignment = ALIGN_CENTER
    ws1.row_dimensions[r_dept].height = 22

    dept_headers = ["S.No", "Department Name", "Students", "Last Week Solved", "Current Week Solved", "Solved Delta", "Attended", "Not Attended", "Attendance %", "Contest Solved"]
    r_dept_hdr = r_dept + 1
    for c_i, h in enumerate(dept_headers, 1):
        cell = ws1.cell(row=r_dept_hdr, column=c_i, value=h)
        cell.font = Font(name=FONT_TNR, size=9, bold=True, color="FFFFFF")
        cell.fill = HEADER_FILL
        cell.alignment = ALIGN_CENTER
        _apply_thin_border(cell)
    ws1.row_dimensions[r_dept_hdr].height = 20

    cur_r = r_dept_hdr + 1
    for idx, (d_name, y_dict) in enumerate(dept_year_groups.items(), 1):
        d_students = [s for y_list in y_dict.values() for s in y_list]
        d_count = len(d_students)
        d_curr_solved = sum(_to_int(s.get("total_solved")) for s in d_students)
        d_contest_solved = sum(_to_int(s.get("contest_problems_solved") or s.get("problems_solved")) for s in d_students)
        d_last_solved = max(0, d_curr_solved - d_contest_solved)
        d_delta = d_curr_solved - d_last_solved
        d_att = sum(1 for s in d_students if s.get("participation_status") in ("PUBLIC_ATTENDED", "OFFICIAL_ATTENDED", "ATTENDED", "PUBLIC"))
        d_not_att = d_count - d_att
        d_pct = (d_att / d_count * 100) if d_count > 0 else 0.0

        row_vals = [idx, d_name, d_count, d_last_solved, d_curr_solved, d_delta, d_att, d_not_att, f"{d_pct:.1f}%", d_contest_solved]
        for c_i, v in enumerate(row_vals, 1):
            cell = ws1.cell(row=cur_r, column=c_i, value=v)
            cell.font = Font(name=FONT_TNR, size=9)
            cell.alignment = ALIGN_LEFT if c_i == 2 else ALIGN_CENTER
            _apply_thin_border(cell)
        cur_r += 1

    # Top Performers Table
    cur_r += 1
    ws1.merge_cells(f"A{cur_r}:J{cur_r}")
    ws1[f"A{cur_r}"] = "TOP 10 LEETCODE PERFORMERS (INSTITUTIONAL LEADERBOARD)"
    ws1[f"A{cur_r}"].font = Font(name=FONT_TNR, size=10.5, bold=True, color="FFFFFF")
    ws1[f"A{cur_r}"].fill = NAVY_FILL
    ws1[f"A{cur_r}"].alignment = ALIGN_CENTER
    ws1.row_dimensions[cur_r].height = 22
    cur_r += 1

    top_headers = ["Rank", "Register No", "Student Name", "Department", "Year", "Platform Solved", "Easy", "Medium", "Hard", "Contest Rating"]
    for c_i, h in enumerate(top_headers, 1):
        cell = ws1.cell(row=cur_r, column=c_i, value=h)
        cell.font = Font(name=FONT_TNR, size=9, bold=True, color="FFFFFF")
        cell.fill = HEADER_FILL
        cell.alignment = ALIGN_CENTER
        _apply_thin_border(cell)
    ws1.row_dimensions[cur_r].height = 20
    cur_r += 1

    sorted_top = sorted(rows, key=lambda s: _to_int(s.get("total_solved")), reverse=True)[:10]
    for r_idx, s in enumerate(sorted_top, 1):
        t_vals = [
            r_idx,
            s.get("reg_no") or s.get("register_no") or "—",
            s.get("name") or s.get("student_name") or "—",
            s.get("department_short") or s.get("department") or "—",
            s.get("year_level") or s.get("year") or "—",
            _to_int(s.get("total_solved")),
            _to_int(s.get("easy_solved")),
            _to_int(s.get("medium_solved")),
            _to_int(s.get("hard_solved")),
            f"{_to_float(s.get('contest_rating') or s.get('rating')):.1f}" if _to_float(s.get('contest_rating') or s.get('rating')) > 0 else "—"
        ]
        for c_i, v in enumerate(t_vals, 1):
            cell = ws1.cell(row=cur_r, column=c_i, value=v)
            cell.font = Font(name=FONT_TNR, size=9, bold=(c_i in (1, 6)))
            cell.alignment = ALIGN_LEFT if c_i == 3 else ALIGN_CENTER
            if c_i == 6:
                cell.fill = GREEN_FILL
            _apply_thin_border(cell)
        cur_r += 1

    for col_i in range(1, 11):
        ws1.column_dimensions[get_column_letter(col_i)].width = 16
    ws1.column_dimensions['A'].width = 8
    ws1.column_dimensions['B'].width = 18
    ws1.column_dimensions['C'].width = 24

    # ══════════════════════════════════════════════════════════════════════════
    # SHEET 2: DEPARTMENT & YEAR ANALYSIS
    # ══════════════════════════════════════════════════════════════════════════
    ws2 = wb.create_sheet(title="Dept & Year Analysis")
    _write_college_header(ws2, "DEPARTMENT & ACADEMIC YEAR BATCH MATRIX", dept_header_text, 19, metadata_block)

    # 2-Tier Header
    r_hdr1 = 7
    r_hdr2 = 8

    ws2.merge_cells("A7:A8"); ws2["A7"] = "Department"
    ws2.merge_cells("B7:B8"); ws2["B7"] = "Batch / Year"
    ws2.merge_cells("C7:C8"); ws2["C7"] = "Students"

    ws2.merge_cells("D7:F7"); ws2["D7"] = "Problem-Solving Growth"
    ws2["D8"] = "Last Wk"; ws2["E8"] = "Curr Wk"; ws2["F8"] = "Change"

    ws2.merge_cells("G7:I7"); ws2["G7"] = "Weekly Contest Attendance"
    ws2["G8"] = "Last Wk"; ws2["H8"] = "Curr Wk"; ws2["I8"] = "Change"

    ws2.merge_cells("J7:N7"); ws2["J7"] = "Platform Problem Distribution"
    ws2["J8"] = ">500"; ws2["K8"] = "250–500"; ws2["L8"] = "<250"; ws2["M8"] = "<100"; ws2["N8"] = "Not Started"

    ws2.merge_cells("O7:S7"); ws2["O7"] = "Contest Problem Solved Breakdown"
    ws2["O8"] = "4 Q"; ws2["P8"] = "3 Q"; ws2["Q8"] = "2 Q"; ws2["R8"] = "1 Q"; ws2["S8"] = "0 Q"

    for r_h in (r_hdr1, r_hdr2):
        for c_i in range(1, 20):
            cell = ws2.cell(row=r_h, column=c_i)
            cell.font = Font(name=FONT_TNR, size=8.5, bold=True, color="FFFFFF")
            cell.fill = NAVY_FILL if r_h == r_hdr1 else HEADER_FILL
            cell.alignment = ALIGN_CENTER
            _apply_thin_border(cell)
    ws2.row_dimensions[r_hdr1].height = 20
    ws2.row_dimensions[r_hdr2].height = 20

    row_c = 9
    for d_name, y_dict in dept_year_groups.items():
        for y_name, y_students in sorted(y_dict.items()):
            cnt = len(y_students)
            curr_s = sum(_to_int(s.get("total_solved")) for s in y_students)
            cont_s = sum(_to_int(s.get("contest_problems_solved") or s.get("problems_solved")) for s in y_students)
            last_s = max(0, curr_s - cont_s)
            delta_s = curr_s - last_s

            curr_att = sum(1 for s in y_students if s.get("participation_status") in ("PUBLIC_ATTENDED", "OFFICIAL_ATTENDED", "ATTENDED", "PUBLIC"))
            last_att = curr_att
            delta_att = curr_att - last_att

            # Distribution buckets
            p_gt500 = sum(1 for s in y_students if _to_int(s.get("total_solved")) >= 500)
            p_250_500 = sum(1 for s in y_students if 250 <= _to_int(s.get("total_solved")) < 500)
            p_lt250 = sum(1 for s in y_students if 100 <= _to_int(s.get("total_solved")) < 250)
            p_lt100 = sum(1 for s in y_students if 1 <= _to_int(s.get("total_solved")) < 100)
            p_0 = sum(1 for s in y_students if _to_int(s.get("total_solved")) == 0)

            # Contest completion
            c_4q = sum(1 for s in y_students if _to_int(s.get("contest_problems_solved") or s.get("problems_solved")) == 4)
            c_3q = sum(1 for s in y_students if _to_int(s.get("contest_problems_solved") or s.get("problems_solved")) == 3)
            c_2q = sum(1 for s in y_students if _to_int(s.get("contest_problems_solved") or s.get("problems_solved")) == 2)
            c_1q = sum(1 for s in y_students if _to_int(s.get("contest_problems_solved") or s.get("problems_solved")) == 1)
            c_0q = sum(1 for s in y_students if _to_int(s.get("contest_problems_solved") or s.get("problems_solved")) == 0)

            vals = [
                d_name, y_name, cnt,
                last_s, curr_s, delta_s,
                last_att, curr_att, delta_att,
                p_gt500, p_250_500, p_lt250, p_lt100, p_0,
                c_4q, c_3q, c_2q, c_1q, c_0q
            ]
            for c_i, val in enumerate(vals, 1):
                cell = ws2.cell(row=row_c, column=c_i, value=val)
                cell.font = Font(name=FONT_TNR, size=9)
                cell.alignment = ALIGN_LEFT if c_i == 1 else ALIGN_CENTER
                _apply_thin_border(cell)
            row_c += 1

    for c_i in range(1, 20):
        ws2.column_dimensions[get_column_letter(c_i)].width = 13
    ws2.column_dimensions['A'].width = 28
    ws2.column_dimensions['B'].width = 14

    # ══════════════════════════════════════════════════════════════════════════
    # SHEET 3: CONTEST PERFORMANCE (MASTER ROSTER)
    # ══════════════════════════════════════════════════════════════════════════
    ws3 = wb.create_sheet(title="Contest Performance")
    _write_college_header(ws3, f"{contest_name.upper()} — COMPREHENSIVE STUDENT MATRIX", dept_header_text, 14, metadata_block)

    c_hdrs = ["S.No", "Register No", "Student Name", "Department", "Year", "Attendance Status", "Q1", "Q2", "Q3", "Q4", "Contest Solved", "Score", "Rating", "Global Rank"]
    r_hdr = 7
    for c_i, h in enumerate(c_hdrs, 1):
        cell = ws3.cell(row=r_hdr, column=c_i, value=h)
        cell.font = Font(name=FONT_TNR, size=9, bold=True, color="FFFFFF")
        cell.fill = NAVY_FILL
        cell.alignment = ALIGN_CENTER
        _apply_thin_border(cell)
    ws3.row_dimensions[r_hdr].height = 22

    cur_r = 8
    for idx, s in enumerate(rows, 1):
        p_stat = s.get("participation_status") or "PUBLIC_NOT_ATTENDED"
        is_att = p_stat in ("PUBLIC_ATTENDED", "OFFICIAL_ATTENDED", "ATTENDED", "PUBLIC")
        q1 = "✓" if s.get("q1_solved") or (is_att and _to_int(s.get("contest_problems_solved")) >= 1) else "—"
        q2 = "✓" if s.get("q2_solved") or (is_att and _to_int(s.get("contest_problems_solved")) >= 2) else "—"
        q3 = "✓" if s.get("q3_solved") or (is_att and _to_int(s.get("contest_problems_solved")) >= 3) else "—"
        q4 = "✓" if s.get("q4_solved") or (is_att and _to_int(s.get("contest_problems_solved")) == 4) else "—"

        status_display = "OFFICIAL_ATTENDED" if is_att else ("VIRTUAL_PRACTICE" if "VIRTUAL" in p_stat else "PUBLIC_NOT_ATTENDED")

        r_data = [
            idx,
            s.get("reg_no") or s.get("register_no") or "—",
            s.get("name") or s.get("student_name") or "—",
            s.get("department_short") or s.get("department") or "—",
            s.get("year_level") or s.get("year") or "—",
            status_display,
            q1, q2, q3, q4,
            _to_int(s.get("contest_problems_solved") or s.get("problems_solved")),
            _to_int(s.get("contest_score") or s.get("score")),
            f"{_to_float(s.get('contest_rating') or s.get('rating')):.1f}" if _to_float(s.get('contest_rating') or s.get('rating')) > 0 else "—",
            _to_int(s.get("contest_global_ranking") or s.get("global_rank")) or "—"
        ]

        for c_i, v in enumerate(r_data, 1):
            cell = ws3.cell(row=cur_r, column=c_i, value=v)
            cell.font = Font(name=FONT_TNR, size=9)
            cell.alignment = ALIGN_LEFT if c_i == 3 else ALIGN_CENTER
            if is_att and c_i in (6, 11):
                cell.fill = GREEN_FILL
            _apply_thin_border(cell)
        cur_r += 1

    ws3.freeze_panes = "A8"
    ws3.auto_filter.ref = f"A7:N{cur_r-1}"

    ws3.column_dimensions['A'].width = 7
    ws3.column_dimensions['B'].width = 16
    ws3.column_dimensions['C'].width = 26
    ws3.column_dimensions['D'].width = 14
    ws3.column_dimensions['E'].width = 10
    ws3.column_dimensions['F'].width = 24
    for c_let in ('G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'):
        ws3.column_dimensions[c_let].width = 13

    # ══════════════════════════════════════════════════════════════════════════
    # SHEET 4: PUBLIC ATTENDED ROSTER
    # ══════════════════════════════════════════════════════════════════════════
    ws4 = wb.create_sheet(title="Public Attended Roster")
    _write_college_header(ws4, f"{contest_name.upper()} — OFFICIAL PUBLIC ATTENDED ROSTER", dept_header_text, 12, metadata_block)

    # Filter only official attended
    attended_rows = [
        r for r in rows
        if r.get("participation_status") in ("PUBLIC_ATTENDED", "OFFICIAL_ATTENDED", "ATTENDED", "PUBLIC")
    ]
    # Sort by Department -> Year -> Contest Solved desc -> Name
    attended_rows.sort(key=lambda s: (
        s.get("department_name") or s.get("department") or "",
        s.get("year_level") or s.get("year") or "",
        -_to_int(s.get("contest_problems_solved") or s.get("problems_solved")),
        s.get("name") or s.get("student_name") or ""
    ))

    # Contest Summary Header Block (Row 7)
    ws4.merge_cells("A7:L7")
    ws4["A7"] = f"OFFICIAL CONTEST PARTICIPATION SUMMARY ({len(attended_rows)} / {len(rows)} STUDENTS ATTENDED)"
    ws4["A7"].font = Font(name=FONT_TNR, size=10, bold=True, color="FFFFFF")
    ws4["A7"].fill = NAVY_FILL
    ws4["A7"].alignment = ALIGN_CENTER
    ws4.row_dimensions[7].height = 22

    roster_hdrs = ["S.No", "Register No", "Student Name", "Dept", "Year", "Status", "Q1", "Q2", "Q3", "Q4", "Contest Solved", "Score"]
    r_hdr4 = 8
    for c_i, h in enumerate(roster_hdrs, 1):
        cell = ws4.cell(row=r_hdr4, column=c_i, value=h)
        cell.font = Font(name=FONT_TNR, size=9, bold=True, color="FFFFFF")
        cell.fill = HEADER_FILL
        cell.alignment = ALIGN_CENTER
        _apply_thin_border(cell)
    ws4.row_dimensions[r_hdr4].height = 20

    cur_r = 9
    if len(attended_rows) == 0:
        ws4.merge_cells("A9:L10")
        empty_cell = ws4["A9"]
        empty_cell.value = "PUBLIC ATTENDED ROSTER — 0 STUDENTS\nNo verified official participants recorded during the official live contest window."
        empty_cell.font = Font(name=FONT_TNR, size=11, italic=True, color="64748B")
        empty_cell.alignment = ALIGN_CENTER
        _apply_thin_border(empty_cell)
        cur_r = 11
    else:
        for idx, s in enumerate(attended_rows, 1):
            q1 = "✓" if s.get("q1_solved") or _to_int(s.get("contest_problems_solved")) >= 1 else "—"
            q2 = "✓" if s.get("q2_solved") or _to_int(s.get("contest_problems_solved")) >= 2 else "—"
            q3 = "✓" if s.get("q3_solved") or _to_int(s.get("contest_problems_solved")) >= 3 else "—"
            q4 = "✓" if s.get("q4_solved") or _to_int(s.get("contest_problems_solved")) == 4 else "—"

            r_data = [
                idx,
                s.get("reg_no") or s.get("register_no") or "—",
                s.get("name") or s.get("student_name") or "—",
                s.get("department_short") or s.get("department") or "—",
                s.get("year_level") or s.get("year") or "—",
                "OFFICIAL_ATTENDED",
                q1, q2, q3, q4,
                _to_int(s.get("contest_problems_solved") or s.get("problems_solved")),
                _to_int(s.get("contest_score") or s.get("score"))
            ]
            for c_i, v in enumerate(r_data, 1):
                cell = ws4.cell(row=cur_r, column=c_i, value=v)
                cell.font = Font(name=FONT_TNR, size=9)
                cell.alignment = ALIGN_LEFT if c_i == 3 else ALIGN_CENTER
                if c_i in (6, 11):
                    cell.fill = GREEN_FILL
                _apply_thin_border(cell)
            cur_r += 1

    ws4.freeze_panes = "A9"
    ws4.column_dimensions['A'].width = 7
    ws4.column_dimensions['B'].width = 16
    ws4.column_dimensions['C'].width = 26
    ws4.column_dimensions['D'].width = 12
    ws4.column_dimensions['E'].width = 10
    ws4.column_dimensions['F'].width = 22
    for c_let in ('G', 'H', 'I', 'J', 'K', 'L'):
        ws4.column_dimensions[c_let].width = 14

    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()
