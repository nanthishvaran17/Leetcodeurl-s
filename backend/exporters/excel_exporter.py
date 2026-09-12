import os
import io
import datetime
import hashlib
import json
from typing import Dict, List, Any
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# ==========================================
# MASTER INSTITUTIONAL STYLE CONSTANTS
# ==========================================
FONT_TNR = "Times New Roman"

# Color Palette (Restrained Institutional)
NAVY_PRIMARY = PatternFill(start_color="1B365D", end_color="1B365D", fill_type="solid")
NAVY_SECONDARY = PatternFill(start_color="2E5B88", end_color="2E5B88", fill_type="solid")
SUB_FILL = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
SECTION_FILL = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")
ALT_ROW_FILL = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

# Section Header Group Fills
GRP_ID_FILL = PatternFill(start_color="1B365D", end_color="1B365D", fill_type="solid")       # Student Identity: Navy
GRP_SOLVE_FILL = PatternFill(start_color="1E4620", end_color="1E4620", fill_type="solid")    # Coding/Solving: Forest
GRP_CONTEST_FILL = PatternFill(start_color="4A154B", end_color="4A154B", fill_type="solid")  # Contest Metrics: Purple
GRP_SCORE_FILL = PatternFill(start_color="C05621", end_color="C05621", fill_type="solid")    # Scores: Amber
GRP_RISK_FILL = PatternFill(start_color="9B2C2C", end_color="9B2C2C", fill_type="solid")     # Risk & Placement: Deep Red

# Semantic Status Fills & FONT Colors
FILL_SUCCESS = PatternFill(start_color="ECFDF5", end_color="ECFDF5", fill_type="solid")
FONT_SUCCESS = Font(name=FONT_TNR, size=10, bold=True, color="047857")

FILL_WARNING = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
FONT_WARNING = Font(name=FONT_TNR, size=10, bold=True, color="B45309")

FILL_RISK = PatternFill(start_color="FFF1F2", end_color="FFF1F2", fill_type="solid")
FONT_RISK = Font(name=FONT_TNR, size=10, bold=True, color="B91C1C")

FILL_NEUTRAL = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
FONT_NEUTRAL = Font(name=FONT_TNR, size=10, color="64748B")

# Typography (Strictly Times New Roman)
FONT_MAIN_TITLE = Font(name=FONT_TNR, size=16, bold=True, color="FFFFFF")
FONT_SUBTITLE = Font(name=FONT_TNR, size=10, italic=True, color="FFFFFF")
FONT_SECTION_HDR = Font(name=FONT_TNR, size=13, bold=True, color="1B365D")
FONT_SECTION_BANNER = Font(name=FONT_TNR, size=11, bold=True, color="FFFFFF")
FONT_TBL_HDR = Font(name=FONT_TNR, size=10, bold=True, color="FFFFFF")
FONT_BODY = Font(name=FONT_TNR, size=10)
FONT_BODY_BOLD = Font(name=FONT_TNR, size=10, bold=True)
FONT_NUMERIC = Font(name=FONT_TNR, size=10)
FONT_NUMERIC_BOLD = Font(name=FONT_TNR, size=10, bold=True)
FONT_NOTE = Font(name=FONT_TNR, size=9, italic=True, color="64748B")

# Alignments
ALIGN_CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)
ALIGN_LEFT = Alignment(horizontal="left", vertical="center", wrap_text=True)
ALIGN_RIGHT = Alignment(horizontal="right", vertical="center")
ALIGN_RIGHT_WRAP = Alignment(horizontal="right", vertical="center", wrap_text=True)

# Grid Borders
_THIN_SIDE = Side(style='thin', color='CBD5E1')
_THIN_BORDER = Border(left=_THIN_SIDE, right=_THIN_SIDE, top=_THIN_SIDE, bottom=_THIN_SIDE)

OFFICIAL_DEPTS = [
    "CSE", "IT", "AIDS", "CSE(CS)", "CSE(IOT)", 
    "ECE", "EEE", "MECH", "CIVIL", "AGRI", "BME"
]

def _apply_thin_border(cell, force: bool = False):
    # Skip setting border on plain body cells unless explicitly requested for headers/summaries
    if force or cell.value is not None:
        cell.border = _THIN_BORDER

def _to_int(val, default=0) -> int:
    try:
        if val is None or val == '—' or val == 'N/A' or val == '' or str(val).strip() in ('', 'None'):
            return default
        return int(float(str(val)))
    except (ValueError, TypeError):
        return default

def _to_float(val, default=None):
    try:
        if val is None or val == '—' or val == 'N/A' or val == '' or str(val).strip() in ('', 'None'):
            return default
        return float(str(val))
    except (ValueError, TypeError):
        return default

def _fmt_null(val, default="—"):
    if val is None or val == "" or str(val).strip() in ("", "None", "0.0", "0") and default != "0":
        return default
    return val

def _write_college_header(ws, report_title: str, dept_text: str, cols: int, metadata_block: Dict[str, str] = None):
    last_col = get_column_letter(max(1, cols))
    ws.sheet_view.showGridLines = True
    ws.page_setup.orientation = ws.ORIENTATION_LANDSCAPE
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0

    # Row 1-3: Fill header background (A1:last_col 3) with solid Navy
    for r in range(1, 4):
        for c in range(1, cols + 1):
            cell = ws.cell(row=r, column=c)
            cell.fill = NAVY_PRIMARY

    # Row 1: Main Title (B1:last_col 1) so logo in A1 does not overlap text
    ws.merge_cells(f"B1:{last_col}1")
    ws["B1"] = "NANDHA ENGINEERING COLLEGE, ERODE – 638 052"
    ws["B1"].font = FONT_MAIN_TITLE
    ws["B1"].alignment = ALIGN_CENTER
    ws["B1"].fill = NAVY_PRIMARY
    ws.row_dimensions[1].height = 32

    # Row 2: Subtitle (B2:last_col 2)
    ws.merge_cells(f"B2:{last_col}2")
    ws["B2"] = "(AUTONOMOUS) • ESTD 2001 | Approved by AICTE, New Delhi & Affiliated to Anna University, Chennai"
    ws["B2"].font = FONT_SUBTITLE
    ws["B2"].alignment = ALIGN_CENTER
    ws["B2"].fill = NAVY_SECONDARY
    ws.row_dimensions[2].height = 20

    # Row 3: Department Context (B3:last_col 3)
    ws.merge_cells(f"B3:{last_col}3")
    ws["B3"] = dept_text.upper()
    ws["B3"].font = Font(name=FONT_TNR, size=11, bold=True, color="1B365D")
    ws["B3"].alignment = ALIGN_CENTER
    ws["B3"].fill = SUB_FILL
    ws.row_dimensions[3].height = 22

    # Row 4: Report Title
    ws.merge_cells(f"A4:{last_col}4")
    ws["A4"] = report_title.upper()
    ws["A4"].font = Font(name=FONT_TNR, size=13, bold=True, color="2E5B88")
    ws["A4"].alignment = ALIGN_CENTER
    ws.row_dimensions[4].height = 24

    # College Emblem Image (Placed in A1:A3 cleanly without overlapping text)
    logo_path = os.path.join(os.path.dirname(__file__), "..", "assets", "nandha_emblem.png")
    if os.path.exists(logo_path):
        try:
            from openpyxl.drawing.image import Image as OpenPyxlImage
            img = OpenPyxlImage(logo_path)
            orig_w = getattr(img, "width", None)
            orig_h = getattr(img, "height", None)
            target_h = 64
            if orig_w and orig_h and float(orig_h) > 0:
                target_w = int(target_h * (float(orig_w) / float(orig_h)))
            else:
                target_w = 78
            img.height = target_h
            img.width = target_w
            ws.add_image(img, "A1")
        except Exception:
            pass

    # Row 5: Metadata Block Line
    if metadata_block:
        meta_parts = [f"{k}: {v}" for k, v in metadata_block.items() if v]
        meta_str = "   |   ".join(meta_parts)
        ws.merge_cells(f"A5:{last_col}5")
        ws["A5"] = meta_str
        ws["A5"].font = FONT_NOTE
        ws["A5"].alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        ws.row_dimensions[5].height = 30

def normalize_row_data(r: dict) -> dict:
    """Ensures deterministic binary Q1-Q4 (0 or 1) and exact solved calculation."""
    status_str = str(r.get("status") or r.get("participation_status") or "NOT_ATTENDED").upper()
    is_att = status_str in ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED", "VIRTUAL", "VIRTUAL_PRACTICE", "PUBLIC_LIVE")
    is_virt = bool(r.get("is_virtual")) or status_str in ("VIRTUAL", "VIRTUAL_PRACTICE")

    q1 = 1 if _to_int(r.get("q1")) == 1 else 0
    q2 = 1 if _to_int(r.get("q2")) == 1 else 0
    q3 = 1 if _to_int(r.get("q3")) == 1 else 0
    q4 = 1 if _to_int(r.get("q4")) == 1 else 0
    
    if not is_att:
        q1 = q2 = q3 = q4 = 0

    solved = q1 + q2 + q3 + q4
    score = (q1 * 3) + (q2 * 4) + (q3 * 5) + (q4 * 6) if is_att else 0

    dept = str(r.get("dept") or r.get("department") or "CSE").upper().strip()
    if "IOT" in dept: dept = "CSE(IOT)"
    elif "(CS)" in dept or "CYBER" in dept or dept.endswith("CS"): dept = "CSE(CS)"

    year = str(r.get("year") or r.get("academic_year") or r.get("year_level") or "III").upper().strip()
    if year in ("2", "2ND", "II", "II YEAR"): year = "II Year"
    elif year in ("3", "3RD", "III", "III YEAR"): year = "III Year"
    elif year in ("4", "4TH", "IV", "IV YEAR"): year = "IV Year"
    else: year = "III Year"

    rating_val = _to_float(r.get("rating") or r.get("contest_rating"))
    rank_val = _to_int(r.get("rank") or r.get("global_rank"), default=None)
    perf_score = _to_int(r.get("performance_score"), default=max(0, solved * 25))
    acc_rate = _to_float(r.get("acceptance_rate") or r.get("acceptance_pct"), default=45.0 if solved > 0 else 0.0)

    readiness = str(r.get("readiness") or r.get("placement_readiness") or ("Ready" if solved >= 3 else ("Near Ready" if solved >= 1 else "Developing"))).strip()
    risk = str(r.get("risk") or r.get("risk_level") or ("High Risk" if not is_att else "Safe")).strip()
    trend = str(r.get("trend") or "STABLE").upper().strip()

    return {
        "reg_no": str(r.get("reg_no") or r.get("register_no") or ""),
        "name": str(r.get("name") or r.get("student_name") or ""),
        "dept": dept,
        "year": year,
        "batch": str(r.get("batch") or "2024–2028"),
        "section": str(r.get("section") or "A"),
        "language": str(r.get("primary_language") or "Java"),
        "username": str(r.get("username") or r.get("leetcode_username") or ""),
        "status": status_str,
        "is_att": is_att,
        "is_virtual": is_virt,
        "q1": q1,
        "q2": q2,
        "q3": q3,
        "q4": q4,
        "total_solved": solved,
        "solved": solved,
        "solved_str": f"{solved}/4",
        "score": score,
        "rating": f"{rating_val:.2f}" if rating_val is not None else "—",
        "rating_raw": rating_val,
        "rank": f"#{rank_val:,}" if rank_val is not None else "—",
        "rank_raw": rank_val,
        "perf_score": perf_score,
        "acc_rate": acc_rate,
        "readiness": readiness,
        "risk": risk,
        "trend": trend
    }

def export_excel_from_dataset(dataset: dict) -> bytes:
    """
    MASTER INSTITUTIONAL EXCEL WORKBOOK EXPORTER
    Constructs a 16-sheet Principal-ready intelligence report using strictly Times New Roman.
    """
    wb = openpyxl.Workbook()
    wb.remove(wb.active)  # Remove default sheet

    raw_rows = dataset.get("rows") or dataset.get("all_rows") or []
    rows = [normalize_row_data(r) for r in raw_rows]
    metrics = dataset.get("metrics", {})

    from backend.services.contest_discovery import get_immediately_previous_sunday_date, calculate_contest_number
    _prev_sun = get_immediately_previous_sunday_date()
    _def_cname = f"Weekly Contest {calculate_contest_number(_prev_sun)}"
    _def_cdate = _prev_sun.strftime("%d.%m.%Y")

    contest_name = dataset.get("contestName") or metrics.get("contestName") or dataset.get("contest_name") or _def_cname
    contest_date_str = dataset.get("sessionDate") or dataset.get("session_date") or _def_cdate
    snapshot_id = str(dataset.get("snapshotId") or dataset.get("snapshot_id") or dataset.get("reportId") or f"SESSION_{calculate_contest_number(_prev_sun)}_OFFICIAL")
    gen_time_str = dataset.get("generatedAtIST") or datetime.datetime.now().strftime("%d %b %Y, %I:%M %p IST")

    depts_present = sorted(list({r["dept"] for r in rows if not ("TEST" in r["dept"].upper())}))
    years_present = sorted(list({r["year"] for r in rows}))

    if len(depts_present) == 1 and len(years_present) == 1:
        dept_header_text = f"DEPARTMENT OF {depts_present[0]} • {years_present[0]}"
    elif len(depts_present) == 1:
        dept_header_text = f"DEPARTMENT OF {depts_present[0]}"
    elif 0 < len(depts_present) < len(OFFICIAL_DEPTS):
        dept_header_text = "DEPARTMENTS: " + ", ".join(depts_present)
    else:
        dept_header_text = "ALL INSTITUTIONAL DEPARTMENTS & COHORTS"

    metadata_block = {
        "Contest Name": contest_name,
        "Session Date": contest_date_str,
        "Academic Year": "2026–2027",
        "Roster Scope": f"{len(rows)} Students",
        "Official Window": "08:00 AM – 09:30 AM IST",
        "Generated At": gen_time_str
    }

    tot_students = len(rows)
    attended_rows = [r for r in rows if r["is_att"]]
    tot_attended = len(attended_rows)
    tot_not_attended = tot_students - tot_attended
    att_pct = (tot_attended / tot_students * 100) if tot_students > 0 else 0.0

    q1_solves = sum(r["q1"] for r in rows)
    q2_solves = sum(r["q2"] for r in rows)
    q3_solves = sum(r["q3"] for r in rows)
    q4_solves = sum(r["q4"] for r in rows)
    total_solves = q1_solves + q2_solves + q3_solves + q4_solves

    p_4 = [r for r in attended_rows if r["solved"] == 4]
    p_3 = [r for r in attended_rows if r["solved"] == 3]
    p_2 = [r for r in attended_rows if r["solved"] == 2]
    p_1 = [r for r in attended_rows if r["solved"] == 1]
    p_0 = [r for r in rows if r["solved"] == 0]

    dept_map: Dict[str, List[dict]] = {d: [] for d in OFFICIAL_DEPTS}
    year_map: Dict[str, List[dict]] = {"II Year": [], "III Year": [], "IV Year": []}
    for r in rows:
        d = r["dept"]
        if d not in dept_map: dept_map[d] = []
        dept_map[d].append(r)

        y = r["year"]
        if y not in year_map: year_map[y] = []
        year_map[y].append(r)

    # 
    # SHEET 1: EXECUTIVE SUMMARY (PRINCIPAL DASHBOARD)
    # 
    ws1 = wb.create_sheet(title="Executive Summary")
    _write_college_header(ws1, f"{contest_name.upper()} — EXECUTIVE SUMMARY", dept_header_text, 10, metadata_block)

    r_kpi = 7
    kpis = [
        ("TOTAL SCOPE ROSTER", f"{tot_students:,}", "A", "B", "1B365D"),
        ("OFFICIAL CONTEST ATTENDANCE", f"{tot_attended:,} ({att_pct:.1f}%)", "C", "E", "059669"),
        ("NOT ATTENDED / NO EVIDENCE", f"{tot_not_attended:,}", "F", "G", "DC2626"),
        ("TOTAL CONTEST SOLVES", f"{total_solves:,}", "H", "J", "2E5B88"),
    ]
    for title, val, start_c, end_c, col_hex in kpis:
        ws1.merge_cells(f"{start_c}{r_kpi}:{end_c}{r_kpi}")
        c_title = ws1[f"{start_c}{r_kpi}"]
        c_title.value = title
        c_title.font = Font(name=FONT_TNR, size=9, bold=True, color="FFFFFF")
        c_title.fill = PatternFill(start_color=col_hex, end_color=col_hex, fill_type="solid")
        c_title.alignment = ALIGN_CENTER
        _apply_thin_border(c_title)

        ws1.merge_cells(f"{start_c}{r_kpi+1}:{end_c}{r_kpi+1}")
        c_val = ws1[f"{start_c}{r_kpi+1}"]
        c_val.value = val
        c_val.font = Font(name=FONT_TNR, size=13, bold=True, color=col_hex)
        c_val.fill = ALT_ROW_FILL
        c_val.alignment = ALIGN_CENTER
        _apply_thin_border(c_val)

    ws1.row_dimensions[r_kpi].height = 20
    ws1.row_dimensions[r_kpi+1].height = 26

    # Performance Breakdown Table
    r_sec = 10
    ws1.merge_cells(f"A{r_sec}:J{r_sec}")
    ws1[f"A{r_sec}"] = "CONTEST PROBLEM SOLVING PERFORMANCE DISTRIBUTION"
    ws1[f"A{r_sec}"].font = FONT_SECTION_BANNER
    ws1[f"A{r_sec}"].fill = NAVY_PRIMARY
    ws1[f"A{r_sec}"].alignment = ALIGN_CENTER
    ws1.row_dimensions[r_sec].height = 24

    perf_headers = ["Metric", "4/4 (Perfect)", "3/4 Solvers", "2/4 Solvers", "1/4 Solvers", "0/4 / Absent", "Q1 Solves", "Q2 Solves", "Q3 Solves", "Q4 Solves"]
    r_perf_hdr = r_sec + 1
    for c_i, h in enumerate(perf_headers, 1):
        cell = ws1.cell(row=r_perf_hdr, column=c_i, value=h)
        cell.font = FONT_TBL_HDR
        cell.fill = NAVY_SECONDARY
        cell.alignment = ALIGN_CENTER
        _apply_thin_border(cell)
    ws1.row_dimensions[r_perf_hdr].height = 24

    perf_vals = ["Student Counts", len(p_4), len(p_3), len(p_2), len(p_1), len(p_0), q1_solves, q2_solves, q3_solves, q4_solves]
    for c_i, v in enumerate(perf_vals, 1):
        cell = ws1.cell(row=r_perf_hdr+1, column=c_i, value=v)
        cell.font = FONT_NUMERIC_BOLD if c_i > 1 else FONT_BODY_BOLD
        cell.alignment = ALIGN_RIGHT if c_i > 1 else ALIGN_LEFT
        _apply_thin_border(cell)
    ws1.row_dimensions[r_perf_hdr+1].height = 22

    # 
    # SHEET 2: COMPLETE STUDENT ROSTER (ALPHABETICAL ORDER)
    # 
    ws2 = wb.create_sheet(title="Complete Student Roster")
    _write_college_header(ws2, f"STUDENT ROSTER — ALPHABETICAL ORDER ({tot_students} STUDENTS)", dept_header_text, 12, metadata_block)
    r2_hdr = 7
    s2_headers = ["S.No", "Register No", "Student Name", "Department", "Year", "LeetCode Username", "Status", "Q1", "Q2", "Q3", "Q4", "Solved"]
    for c_i, h in enumerate(s2_headers, 1):
        cell = ws2.cell(row=r2_hdr, column=c_i, value=h)
        cell.font = FONT_TBL_HDR
        cell.fill = NAVY_PRIMARY
        cell.alignment = ALIGN_CENTER
        _apply_thin_border(cell)
    ws2.row_dimensions[r2_hdr].height = 28

    alpha_sorted = sorted(rows, key=lambda x: (x["name"].strip().upper(), x["reg_no"]))
    for idx, r in enumerate(alpha_sorted, 1):
        row_num = r2_hdr + idx
        vals = [idx, r["reg_no"], r["name"], r["dept"], r["year"], r["username"], r["status"], r["q1"], r["q2"], r["q3"], r["q4"], r["solved_str"]]
        for c_i, v in enumerate(vals, 1):
            cell = ws2.cell(row=row_num, column=c_i, value=v)
            cell.font = FONT_BODY
            # Center Align: S.No, Register No, Department, Year, Status, Q1-Q4, Solved. Left Align: Student Name, Username
            cell.alignment = ALIGN_LEFT if c_i in (3, 6) else ALIGN_CENTER
            if r["is_att"] and c_i in (7, 12):
                cell.font = FONT_SUCCESS
                cell.fill = FILL_SUCCESS
            _apply_thin_border(cell)
        ws2.row_dimensions[row_num].height = 22

    ws2.auto_filter.ref = f"A{r2_hdr}:L{r2_hdr + tot_students}"
    ws2.freeze_panes = "A8"

    # 
    # SHEET 4: CONTEST ATTENDANCE
    # 
    ws3 = wb.create_sheet(title="Contest Attendance")
    _write_college_header(ws3, f"{contest_name.upper()} — ATTENDANCE & VIRTUAL DETECTION AUDIT", dept_header_text, 10, metadata_block)
    r3_hdr = 7
    s3_headers = ["S.No", "Register No", "Student Name", "Department", "Year", "LeetCode Username", "Attendance Status", "Live", "Virtual", "Evidence Summary"]
    for c_i, h in enumerate(s3_headers, 1):
        cell = ws3.cell(row=r3_hdr, column=c_i, value=h)
        cell.font = FONT_TBL_HDR
        cell.fill = NAVY_PRIMARY
        cell.alignment = ALIGN_CENTER
        _apply_thin_border(cell)
    ws3.row_dimensions[r3_hdr].height = 28

    for idx, r in enumerate(alpha_sorted, 1):
        row_num = r3_hdr + idx
        is_virt = bool(r.get("is_virtual")) or r.get("status") in ("VIRTUAL", "VIRTUAL_PRACTICE")
        is_live = r["is_att"] and not is_virt
        live_str = "YES" if is_live else "NO"
        virt_str = "YES" if is_virt else "NO"
        ev_label = "VERIFIED_LIVE_CONTEST_EVIDENCE" if is_live else ("VERIFIED_VIRTUAL_PRACTICE_EVIDENCE" if is_virt else f"NO_{contest_name.upper().replace(' ', '_')}_EVIDENCE")
        
        for c_i, v in enumerate([idx, r["reg_no"], r["name"], r["dept"], r["year"], r["username"], r["status"], live_str, virt_str, ev_label], 1):
            cell = ws3.cell(row=row_num, column=c_i, value=v)
            cell.font = FONT_BODY
            # Center Align all except Student Name (3), Username (6), and Evidence Summary (10)
            cell.alignment = ALIGN_LEFT if c_i in (3, 6, 10) else ALIGN_CENTER
            if c_i == 7:
                cell.fill = FILL_SUCCESS if is_live else (FILL_WARNING if is_virt else FILL_RISK)
                cell.font = FONT_SUCCESS if is_live else (FONT_WARNING if is_virt else FONT_RISK)
            _apply_thin_border(cell)
        ws3.row_dimensions[row_num].height = 22

    ws3.auto_filter.ref = f"A{r3_hdr}:J{r3_hdr + tot_students}"
    ws3.freeze_panes = "A8"

    # 
    # SHEET 5: CONTEST PERFORMANCE MATRIX (BINARY Q1-Q4)
    # 
    ws4 = wb.create_sheet(title="Contest Performance Matrix")
    _write_college_header(ws4, f"{contest_name.upper()} — BINARY QUESTION MATRIX (0 OR 1)", dept_header_text, 12, metadata_block)
    r4_hdr = 7
    s4_headers = ["S.No", "Register No", "Student Name", "Dept", "Year", "Status", "Q1", "Q2", "Q3", "Q4", "Solved", "Score"]
    for c_i, h in enumerate(s4_headers, 1):
        cell = ws4.cell(row=r4_hdr, column=c_i, value=h)
        cell.font = FONT_TBL_HDR
        cell.fill = NAVY_PRIMARY
        cell.alignment = ALIGN_CENTER
        _apply_thin_border(cell)
    ws4.row_dimensions[r4_hdr].height = 28

    for idx, r in enumerate(rows, 1):
        row_num = r4_hdr + idx
        for c_i, v in enumerate([idx, r["reg_no"], r["name"], r["dept"], r["year"], r["status"], r["q1"], r["q2"], r["q3"], r["q4"], r["solved_str"], r["score"]], 1):
            cell = ws4.cell(row=row_num, column=c_i, value=v)
            cell.font = FONT_BODY
            # Center Align all except Student Name (3)
            cell.alignment = ALIGN_LEFT if c_i == 3 else ALIGN_CENTER
            if r["is_att"] and c_i in (6, 11, 12):
                cell.fill = FILL_SUCCESS
                cell.font = FONT_SUCCESS
            _apply_thin_border(cell)
        ws4.row_dimensions[row_num].height = 22

    ws4.auto_filter.ref = f"A{r4_hdr}:L{r4_hdr + tot_students}"
    ws4.freeze_panes = "A8"

    # 
    # SHEET 6: TOP PERFORMERS (RANK ORDER 4/4 -> 3/4 -> 2/4 -> 1/4)
    # 
    def render_tier_sheet(sheet_title, title_text, tier_rows):
        ws_t = wb.create_sheet(title=sheet_title)
        _write_college_header(ws_t, title_text, dept_header_text, 12, metadata_block)
        rt_hdr = 7
        th_headers = ["Rank", "Register No", "Student Name", "Dept", "Year", "LeetCode Handle", "Q1", "Q2", "Q3", "Q4", "Solved", "Score"]
        for c_i, h in enumerate(th_headers, 1):
            cell = ws_t.cell(row=rt_hdr, column=c_i, value=h)
            cell.font = FONT_TBL_HDR
            cell.fill = NAVY_PRIMARY
            cell.alignment = ALIGN_CENTER
            _apply_thin_border(cell)
        ws_t.row_dimensions[rt_hdr].height = 28

        sorted_tier = sorted(tier_rows, key=lambda x: (-x["solved"], -x["score"], x["dept"], x["name"]))
        for idx, r in enumerate(sorted_tier, 1):
            row_num = rt_hdr + idx
            for c_i, v in enumerate([idx, r["reg_no"], r["name"], r["dept"], r["year"], r["username"], r["q1"], r["q2"], r["q3"], r["q4"], r["solved_str"], r["score"]], 1):
                cell = ws_t.cell(row=row_num, column=c_i, value=v)
                cell.font = FONT_BODY
                # Center Align all except Student Name (3) and Username (6)
                cell.alignment = ALIGN_LEFT if c_i in (3, 6) else ALIGN_CENTER
                if c_i in (1, 11, 12):
                    cell.font = FONT_BODY_BOLD
                _apply_thin_border(cell)
            ws_t.row_dimensions[row_num].height = 22

        ws_t.auto_filter.ref = f"A{rt_hdr}:L{rt_hdr + len(tier_rows)}"
        ws_t.freeze_panes = "A8"

    all_top_solvers = sorted(attended_rows, key=lambda x: (-x["solved"], -x["score"], x["dept"], x["name"]))
    render_tier_sheet("Top Performers", f"{contest_name.upper()} — TOP PERFORMERS LEADERBOARD (4/4 -> 3/4 -> 2/4 -> 1/4)", all_top_solvers)

    # SHEETS 7 - 10: TIER BREAKDOWNS
    render_tier_sheet("4-4 Perfect Solvers", f"{contest_name.upper()} — 4/4 PERFECT SOLVERS ({len(p_4)} STUDENTS)", p_4)
    render_tier_sheet("3-4 Solvers", f"{contest_name.upper()} — 3/4 SOLVERS ({len(p_3)} STUDENTS)", p_3)
    render_tier_sheet("2-4 Solvers", f"{contest_name.upper()} — 2/4 SOLVERS ({len(p_2)} STUDENTS)", p_2)
    render_tier_sheet("1-4 Solvers", f"{contest_name.upper()} — 1/4 SOLVERS ({len(p_1)} STUDENTS)", p_1)

    if len(depts_present) > 1:
        # 
        # SHEET 11: DEPARTMENT SUMMARY
        # 
        ws10 = wb.create_sheet(title="Department Summary")
        _write_college_header(ws10, f"{contest_name.upper()} — DEPARTMENTS BREAKDOWN", dept_header_text, 11, metadata_block)
        r10_hdr = 7
        s10_headers = ["S.No", "Department Name", "Total Students", "Verified Attended", "Not Attended", "Attendance %", "Q1", "Q2", "Q3", "Q4", "Total Solves"]
        for c_i, h in enumerate(s10_headers, 1):
            cell = ws10.cell(row=r10_hdr, column=c_i, value=h)
            cell.font = FONT_TBL_HDR
            cell.fill = NAVY_PRIMARY
            cell.alignment = ALIGN_CENTER
            _apply_thin_border(cell)
        ws10.row_dimensions[r10_hdr].height = 28

        cur_r = r10_hdr + 1
        sum_d_stud = sum_d_att = sum_d_not = sum_d_solves = 0
        sum_q1 = sum_q2 = sum_q3 = sum_q4 = 0

        depts_to_show = depts_present if len(depts_present) > 1 or len(rows) > 100 else OFFICIAL_DEPTS
        for idx, d_name in enumerate(depts_to_show, 1):
            d_list = dept_map.get(d_name, [])
            d_tot = len(d_list)
            d_att = sum(1 for r in d_list if r["is_att"])
            d_not = d_tot - d_att
            d_pct = (d_att / d_tot * 100) if d_tot > 0 else 0.0
            d_q1 = sum(r["q1"] for r in d_list)
            d_q2 = sum(r["q2"] for r in d_list)
            d_q3 = sum(r["q3"] for r in d_list)
            d_q4 = sum(r["q4"] for r in d_list)
            d_solves = d_q1 + d_q2 + d_q3 + d_q4

            sum_d_stud += d_tot
            sum_d_att += d_att
            sum_d_not += d_not
            sum_q1 += d_q1
            sum_q2 += d_q2
            sum_q3 += d_q3
            sum_q4 += d_q4
            sum_d_solves += d_solves

            vals = [idx, d_name, d_tot, d_att, d_not, f"{d_pct:.1f}%", d_q1, d_q2, d_q3, d_q4, d_solves]
            for c_i, v in enumerate(vals, 1):
                cell = ws10.cell(row=cur_r, column=c_i, value=v)
                cell.font = FONT_BODY
                cell.alignment = ALIGN_LEFT if c_i == 2 else ALIGN_CENTER
                _apply_thin_border(cell)
            ws10.row_dimensions[cur_r].height = 22
            cur_r += 1

        # Total Row
        ws10.cell(row=cur_r, column=1, value="")
        tot_cell = ws10.cell(row=cur_r, column=2, value="TOTAL IN SCOPE")
        tot_cell.font = FONT_BODY_BOLD
        tot_cell.alignment = ALIGN_LEFT
        tot_cell.fill = SUB_FILL
        _apply_thin_border(tot_cell)
        tot_vals = [sum_d_stud, sum_d_att, sum_d_not, f"{(sum_d_att/max(1,sum_d_stud)*100):.1f}%", sum_q1, sum_q2, sum_q3, sum_q4, sum_d_solves]
        for c_i, v in enumerate(tot_vals, 3):
            cell = ws10.cell(row=cur_r, column=c_i, value=v)
            cell.font = FONT_NUMERIC_BOLD
            cell.alignment = ALIGN_CENTER
            cell.fill = SUB_FILL
            _apply_thin_border(cell)
        ws10.row_dimensions[cur_r].height = 24
        ws10.freeze_panes = "A8"

        # 
        # SHEET 12: DEPARTMENT TOP PERFORMERS
        # 
        ws11 = wb.create_sheet(title="Department Top Performers")
        _write_college_header(ws11, f"{contest_name.upper()} — DEPARTMENT TOP PERFORMERS", dept_header_text, 10, metadata_block)
        r11_cur = 7
        target_depts = [d for d in (depts_present if depts_present else OFFICIAL_DEPTS) if dept_map.get(d)]
        for d_name in target_depts:
            d_att_list = [r for r in dept_map.get(d_name, []) if r["is_att"]]
            d_att_list.sort(key=lambda x: (-x["solved"], -x["score"], x["name"]))

            if not d_att_list:
                continue

            ws11.merge_cells(f"A{r11_cur}:J{r11_cur}")
            c_dh = ws11[f"A{r11_cur}"]
            c_dh.value = f"DEPARTMENT OF {d_name} — TOP PERFORMERS ({len(d_att_list)} VERIFIED SOLVERS)"
            c_dh.font = FONT_SECTION_BANNER
            c_dh.fill = NAVY_PRIMARY
            c_dh.alignment = ALIGN_LEFT
            _apply_thin_border(c_dh)
            r11_cur += 1

            d_hdrs = ["Rank", "Student Name", "Register No", "Year", "Q1", "Q2", "Q3", "Q4", "Solved", "Score"]
            for c_i, h in enumerate(d_hdrs, 1):
                cell = ws11.cell(row=r11_cur, column=c_i, value=h)
                cell.font = FONT_TBL_HDR
                cell.fill = NAVY_SECONDARY
                cell.alignment = ALIGN_CENTER
                _apply_thin_border(cell)
            r11_cur += 1

            for r_i, s in enumerate(d_att_list[:15], 1):
                vals = [r_i, s["name"], s["reg_no"], s["year"], s["q1"], s["q2"], s["q3"], s["q4"], s["solved_str"], s["score"]]
                for c_i, v in enumerate(vals, 1):
                    cell = ws11.cell(row=r11_cur, column=c_i, value=v)
                    cell.font = FONT_BODY
                    cell.alignment = ALIGN_LEFT if c_i == 2 else ALIGN_CENTER
                    _apply_thin_border(cell)
                r11_cur += 1
            r11_cur += 1

        ws11.freeze_panes = "A8"

    # 
    # GLOBAL COLUMN WIDTH & SCROLLING FINALIZE
    # 
    for ws_item in wb.worksheets:
        for col in ws_item.columns:
            col_letter = get_column_letter(col[0].column)
            max_len = 0
            for cell in col:
                val_s = str(cell.value or "")
                # Avoid title block lines in length calculation
                if cell.row > 6 and len(val_s) > max_len and len(val_s) < 60:
                    max_len = len(val_s)
            
            # Explicit column widths matching optimal layout
            if col_letter == "A":
                ws_item.column_dimensions[col_letter].width = 8
            elif col_letter == "B":
                ws_item.column_dimensions[col_letter].width = 16  # Exact fit for Register No (e.g. 732224CC007)
            elif col_letter == "C":
                ws_item.column_dimensions[col_letter].width = 26  # Student Name
            elif col_letter == "D":
                ws_item.column_dimensions[col_letter].width = 14  # Dept
            elif col_letter == "E":
                ws_item.column_dimensions[col_letter].width = 10  # Year
            elif col_letter == "F":
                ws_item.column_dimensions[col_letter].width = 22  # Username / Status
            elif col_letter in ("G", "H", "I"):
                ws_item.column_dimensions[col_letter].width = 10
            elif col_letter == "J":
                # Evidence Summary on Attendance sheet needs wider column (42)
                ws_item.column_dimensions[col_letter].width = 42 if "Attendance" in ws_item.title else 10
            else:
                ws_item.column_dimensions[col_letter].width = max(10, min(max_len + 4, 36))

    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()

