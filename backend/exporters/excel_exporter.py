import os
import io
import datetime
import hashlib
import json
from typing import Dict, List, Any, Optional
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
GRP_SOLVE_FILL = PatternFill(start_color="1B365D", end_color="1B365D", fill_type="solid")    # Coding/Solving: Navy
GRP_CONTEST_FILL = PatternFill(start_color="1B365D", end_color="1B365D", fill_type="solid")  # Contest Metrics: Navy
GRP_SCORE_FILL = PatternFill(start_color="1B365D", end_color="1B365D", fill_type="solid")    # Scores: Navy
GRP_RISK_FILL = PatternFill(start_color="1B365D", end_color="1B365D", fill_type="solid")     # Risk & Placement: Navy

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
FONT_DOC_MAIN_TITLE = Font(name=FONT_TNR, size=13, bold=True, color="000000")
FONT_DOC_SUBTITLE = Font(name=FONT_TNR, size=11, bold=True, color="000000")
FONT_DOC_SECTION = Font(name=FONT_TNR, size=12, bold=True, color="000000")
FONT_DOC_TBL_HDR = Font(name=FONT_TNR, size=10, bold=True, color="000000")

# Alignments
ALIGN_CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)
ALIGN_LEFT = Alignment(horizontal="left", vertical="center", wrap_text=True)
ALIGN_RIGHT = Alignment(horizontal="right", vertical="center")
ALIGN_RIGHT_WRAP = Alignment(horizontal="right", vertical="center", wrap_text=True)

# Grid Borders (Crisp, sharp dark borders around every cell like All Borders in Excel)
_THIN_SIDE = Side(style='thin', color='000000')
_THIN_BORDER = Border(left=_THIN_SIDE, right=_THIN_SIDE, top=_THIN_SIDE, bottom=_THIN_SIDE)

OFFICIAL_DEPTS = [
    "CSE", "IT", "AIDS", "CSE(CS)", "CSE(IOT)", 
    "ECE", "EEE", "MECH", "CIVIL", "AGRI", "BME"
]

def _apply_thin_border(cell, force: bool = True):
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

def _write_college_header(ws, report_title: str, dept_text: str, cols: int, metadata_block: Optional[Dict[str, str]] = None, custom_dept_header: Optional[str] = None):
    from backend.exporters.nec_master_excel_design import apply_master_college_identity
    import re
    dept_parts = dept_text.split("•")
    dept_raw = dept_parts[0].strip()
    
    # Strip case-insensitive "DEPARTMENT OF" prefix if present
    dept_clean = re.sub(r'(?i)^department\s+of\s+', '', dept_raw).strip()
    if dept_clean.upper() in ("ALL", "ALL DEPARTMENTS", "DEPARTMENT PERFORMANCE SUMMARY", "PERFORMANCE SUMMARY"):
        dept_val = "ALL DEPARTMENTS"
    else:
        dept_val = dept_clean if dept_clean else "ALL DEPARTMENTS"
    
    year_val = "ALL"
    if len(dept_parts) > 1:
        y_raw = re.sub(r'(?i)cohort:\s*', '', dept_parts[1]).strip()
        y_raw = re.sub(r'(?i)\s*year\s*', '', y_raw).strip()
        year_val = y_raw if y_raw else "ALL"
    elif metadata_block and metadata_block.get("Year"):
        year_val = metadata_block["Year"].strip()

    session_date = (metadata_block.get("Date") or metadata_block.get("Report Date") or "") if metadata_block else ""
    tot_roster_val = metadata_block.get("Total Roster", 0) if metadata_block else 0
    if isinstance(tot_roster_val, str):
        try:
            total_roster = int(tot_roster_val.split()[0].replace(",", ""))
        except Exception:
            total_roster = 0
    else:
        total_roster = tot_roster_val
    
    apply_master_college_identity(
        ws=ws,
        report_title=report_title,
        department=dept_val,
        year=year_val,
        contest_name=metadata_block.get("Contest", "") if metadata_block else "",
        session_date=session_date,
        total_roster=total_roster,
        cols=cols,
        custom_dept_header=custom_dept_header
    )

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
        "reg_no": str(r.get("reg_no") or r.get("register_no") or "").strip().upper(),
        "name": str(r.get("name") or r.get("student_name") or "").strip().upper(),
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
        "rating": f"{int(round(rating_val)):,}" if rating_val is not None else "—",  # type: ignore
        "rating_raw": int(round(rating_val)) if rating_val is not None else None,  # type: ignore
        "rank": f"#{rank_val:,}" if rank_val is not None else "—",
        "rank_raw": rank_val,
        "perf_score": perf_score,
        "acc_rate": acc_rate,
        "readiness": readiness,
        "risk": risk,
        "trend": trend
    }

def export_weekly_performance_excel(dataset: dict, include_extra_sheets: bool = False) -> bytes:
    """
    COORDINATOR WEEKLY PERFORMANCE EXCEL EXPORTER
    Generates the official institutional workbook matching the exact templates:
      Sheet 1: Weekly Performance (Leetcode Performance - Weekly Report, Image 1)
      Optional Sheet 2: Contest Performance (Image 2)
      Optional Sheet 3: Department Summary
      Optional Sheet 4: Full Student Roster
    """
    wb = openpyxl.Workbook()
    if wb.active is not None:
        wb.remove(wb.active)

    d_raw = (dataset.get("department_name") or dataset.get("department") or "").strip()
    if "Cyber" in d_raw or "(CS)" in d_raw or d_raw == "1" or d_raw == "CSE(CS)":
        dept_name = "Department of CSE (Cyber Security)"
        default_coord = "M. Santhoshkumar, AP / CSE (Cyber Security)"
    elif "Things" in d_raw or "IoT" in d_raw or "IOT" in d_raw or d_raw == "2" or d_raw == "CSE(IOT)":
        dept_name = "Department of CSE (Internet of Things )"
        default_coord = "P.Devayani /AP"
    else:
        dept_name = str(dataset.get("department_name") or "Department of CSE (Cyber Security)")
        default_coord = "M. Santhoshkumar, AP / CSE (Cyber Security)"

    raw_rep_date = None
    candidates = [
        (dataset.get("current_session") or {}).get("session_date"),
        (dataset.get("currentWeek") or {}).get("date"),
        dataset.get("contest_date"),
        dataset.get("contestDate"),
        dataset.get("session_date"),
        dataset.get("sessionDate"),
        (dataset.get("batch_summaries") or [{}])[0].get("contest_date") if dataset.get("batch_summaries") else None,
        dataset.get("report_date"),
        dataset.get("reportDate"),
    ]
    for cand in candidates:
        if cand:
            c_str = str(cand).strip()
            if not c_str.isdigit() and len(c_str) >= 8 and ('.' in c_str or '-' in c_str or '/' in c_str):
                raw_rep_date = c_str
                break

    # If raw_rep_date was not found or candidate was a numeric session ID like "14"
    if not raw_rep_date:
        sid = dataset.get("session_id") or dataset.get("sessionId")
        if sid and str(sid).strip().isdigit():
            try:
                from backend.database import SessionLocal
                from backend.models import WeeklySession
                _db = SessionLocal()
                ws_obj = _db.query(WeeklySession).filter(WeeklySession.id == int(sid)).first()
                if ws_obj and ws_obj.session_date:
                    raw_rep_date = str(ws_obj.session_date).strip()
                _db.close()
            except Exception:
                pass

    if not raw_rep_date:
        raw_rep_date = "11.10.2026"

    report_date = raw_rep_date.replace("-", ".").replace("/", ".")
    raw_c_date = str(dataset.get("contest_date") or dataset.get("contestDate") or report_date)
    contest_date = raw_c_date.replace("-", ".").replace("/", ".")
    coordinator = str(dataset.get("coordinator") or dataset.get("academicCoordinator") or default_coord)

    # Institutional Cohort Mapping: Support filtering by year (II, III, IV) or showing all cohorts
    all_canonical = [
        {"label": "2023 - 2027", "year": "IV"},
        {"label": "2024 - 2028", "year": "III"},
        {"label": "2025 - 2029", "year": "II"}
    ]
    raw_yr = str(dataset.get("year") or dataset.get("yearFilter") or (dataset.get("filters") or {}).get("year") or "").strip().upper()
    raw_batches_val = dataset.get("batch_summaries")
    raw_batches: List[Dict[str, Any]] = [b for b in raw_batches_val if isinstance(b, dict)] if isinstance(raw_batches_val, list) else []

    if not raw_yr or raw_yr in ("ALL", "NONE", ""):
        if len(raw_batches) == 1 and raw_batches[0].get("year"):
            target_year = raw_batches[0].get("year")
        else:
            target_year = "ALL"
    else:
        target_year = "II" if raw_yr in ("2", "II") else ("III" if raw_yr in ("3", "III") else ("IV" if raw_yr in ("4", "IV") else raw_yr))

    batch_summaries: List[Dict[str, Any]] = []
    if target_year != "ALL":
        # Strictly include only the requested cohort; never add dummy 0 rows for other years
        batch_summaries = [b for b in raw_batches if b.get("year") == target_year or (b.get("batch") and target_year in str(b.get("batch")))]
        if not batch_summaries:
            found_cb = next((cb for cb in all_canonical if cb["year"] == target_year), None)
            if found_cb:
                batch_summaries = [{
                    "batch": found_cb["label"],
                    "year": found_cb["year"],
                    "total_students": 0,
                    "current_week": {},
                    "last_week": {}
                }]
            else:
                batch_summaries = raw_batches
    else:
        # ALL YEARS: Guarantee all 3 canonical cohorts in IV, III, II order
        for cb in all_canonical:
            found = next((b for b in raw_batches if str(b.get("batch", "")).replace(" ", "") == cb["label"].replace(" ", "") or b.get("year") == cb["year"]), None)
            if found:
                batch_summaries.append(found)
            else:
                batch_summaries.append({
                    "batch": cb["label"],
                    "year": cb["year"],
                    "total_students": 0,
                    "current_week": {},
                    "last_week": {}
                })

    assets_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")
    logo_path = os.path.join(assets_dir, "round_logo.png")
    if not os.path.exists(logo_path):
        logo_path = os.path.join(assets_dir, "nandha_emblem.png")

    # =========================================================================
    # SHEET 1: LEETCODE PERFORMANCE - WEEKLY REPORT (Image 1 Preview Match)
    # =========================================================================
    ws1 = wb.create_sheet(title="Weekly Performance")
    ws1.sheet_view.showGridLines = True
    ws1.page_setup.paperSize = ws1.PAPERSIZE_A4
    ws1.page_setup.orientation = ws1.ORIENTATION_LANDSCAPE
    ws1.sheet_properties.pageSetUpPr.fitToPage = True
    ws1.page_setup.fitToWidth = 1
    ws1.page_setup.fitToHeight = 0
    ws1.page_margins.left = 0.4
    ws1.page_margins.right = 0.4
    ws1.page_margins.top = 0.5
    ws1.page_margins.bottom = 0.5

    # Embed Logo if available
    if os.path.exists(logo_path):
        try:
            from openpyxl.drawing.image import Image as OpenPyxlImage
            img1 = OpenPyxlImage(logo_path)
            img1.width = 90
            img1.height = 90
            ws1.add_image(img1, "A1")
        except Exception:
            pass

    # Header Rows 1-5 (Centered Times New Roman across full table width)
    ws1.merge_cells("A1:M1")
    ws1["A1"] = "NANDHA ENGINEERING COLLEGE, ERODE - 638 052."
    ws1["A1"].font = FONT_DOC_MAIN_TITLE
    ws1["A1"].alignment = ALIGN_CENTER

    ws1.merge_cells("A2:M2")
    ws1["A2"] = dept_name
    ws1["A2"].font = FONT_DOC_SUBTITLE
    ws1["A2"].alignment = ALIGN_CENTER

    ws1.merge_cells("A3:M3")
    ws1["A3"] = f"Date: {report_date}"
    ws1["A3"].font = FONT_DOC_SUBTITLE
    ws1["A3"].alignment = ALIGN_CENTER

    ws1.merge_cells("A4:M4")
    ws1["A4"] = "Leetcode Performance - Weekly Report"
    ws1["A4"].font = FONT_DOC_SECTION
    ws1["A4"].alignment = ALIGN_CENTER

    ws1.merge_cells("A5:M5")
    ws1["A5"] = f"Name & Designation of the Academic Coordinator: {coordinator}"
    ws1["A5"].font = FONT_DOC_SUBTITLE
    ws1["A5"].alignment = ALIGN_CENTER

    ws1.row_dimensions[1].height = 26
    ws1.row_dimensions[2].height = 20
    ws1.row_dimensions[3].height = 20
    ws1.row_dimensions[4].height = 24
    ws1.row_dimensions[5].height = 30

    HDR_SLATE_FILL = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    SUBHDR_SLATE_FILL = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

    # Table Header Rows 6-7 (Two-level header exactly matching Image 1)

    h_r6 = [
        ("Batch", 1, 1, 6, 7),
        ("Number of Students\n(Total Count)", 2, 2, 6, 7),
        ("Number of Problems Solved", 3, 7, 6, 6),
        ("Weekly Contest Attended:\n(give the count here)", 8, 11, 6, 6),
        ("Leetcode Contest Rating and\nRanking", 12, 13, 6, 6),
    ]
    for text, s_c, e_c, s_r, e_r in h_r6:
        if s_c == e_c and s_r == e_r:
            c = ws1.cell(row=s_r, column=s_c, value=text)
        else:
            ws1.merge_cells(start_row=s_r, start_column=s_c, end_row=e_r, end_column=e_c)
            c = ws1.cell(row=s_r, column=s_c, value=text)
        c.font = FONT_DOC_TBL_HDR
        c.alignment = ALIGN_CENTER
        for r_x in range(s_r, e_r + 1):
            for c_x in range(s_c, e_c + 1):
                cell_h = ws1.cell(row=r_x, column=c_x)
                cell_h.fill = HDR_SLATE_FILL
                _apply_thin_border(cell_h)

    h_r7 = [
        (3, "Above 500"),
        (4, "250 - 500"),
        (5, "Less than 250"),
        (6, "Less than 100"),
        (7, "Not yet started"),
        (8, "4 Q Solved"),
        (9, "3 Q Solved"),
        (10, "2 Q Solved"),
        (11, "1 Q Solved"),
        (12, "Rating:\nAbove 1500"),
        (13, "Ranking:\nBelow 20000"),
    ]
    for col_i, text in h_r7:
        c = ws1.cell(row=7, column=col_i, value=text)
        c.font = FONT_DOC_TBL_HDR
        c.alignment = ALIGN_CENTER
        c.fill = SUBHDR_SLATE_FILL
        _apply_thin_border(c)

    ws1.row_dimensions[6].height = 42
    ws1.row_dimensions[7].height = 36

    # Populate Batch Rows (2 rows per batch: Last Week & Current Week)
    cur_r1 = 8
    for b in batch_summaries:
        b_label = str(b.get("batch", ""))
        raw_b_tot = b.get("total_students") or b.get("num_students") or 0
        b_tot = int(raw_b_tot) if isinstance(raw_b_tot, (int, float, str)) else 0
        lw: Dict[str, Any] = b["last_week"] if isinstance(b.get("last_week"), dict) else {}
        cw: Dict[str, Any] = b["current_week"] if isinstance(b.get("current_week"), dict) else {}

        # Row 1: Last Week
        c_batch_lw = ws1.cell(row=cur_r1, column=1, value=f"{b_label}\n(Last Week)")
        c_batch_lw.font = FONT_NUMERIC_BOLD
        c_batch_lw.alignment = ALIGN_CENTER

        # Total count merged vertically across 2 rows
        ws1.merge_cells(start_row=cur_r1, start_column=2, end_row=cur_r1 + 1, end_column=2)
        c_tot = ws1.cell(row=cur_r1, column=2, value=b_tot)
        c_tot.font = FONT_NUMERIC_BOLD
        c_tot.alignment = ALIGN_CENTER

        # Last Week problem solve counts (always pure integers)
        lw_above_500 = int(lw.get("prob_above_500") if lw.get("prob_above_500") is not None else (lw.get("above_500") or 0))
        lw_250_500 = int(lw.get("prob_250_500") if lw.get("prob_250_500") is not None else (lw.get("250_500") or 0))
        lw_100_249 = int(lw.get("prob_100_249") if lw.get("prob_100_249") is not None else (lw.get("101_250") or 0))
        lw_1_99 = int(lw.get("prob_1_99") if lw.get("prob_1_99") is not None else (lw.get("less_100") or 0))
        lw_0 = int(lw.get("prob_0") if lw.get("prob_0") is not None else (lw.get("not_started") or 0))

        ws1.cell(row=cur_r1, column=3, value=lw_above_500).font = FONT_NUMERIC_BOLD
        ws1.cell(row=cur_r1, column=4, value=lw_250_500).font = FONT_NUMERIC_BOLD
        ws1.cell(row=cur_r1, column=5, value=lw_100_249).font = FONT_NUMERIC_BOLD
        ws1.cell(row=cur_r1, column=6, value=lw_1_99).font = FONT_NUMERIC_BOLD
        ws1.cell(row=cur_r1, column=7, value=lw_0).font = FONT_NUMERIC_BOLD

        # Last Week contest attended counts
        ws1.cell(row=cur_r1, column=8, value=int(lw.get("q4", 0) or 0)).font = FONT_NUMERIC_BOLD
        ws1.cell(row=cur_r1, column=9, value=int(lw.get("q3", 0) or 0)).font = FONT_NUMERIC_BOLD
        ws1.cell(row=cur_r1, column=10, value=int(lw.get("q2", 0) or 0)).font = FONT_NUMERIC_BOLD
        ws1.cell(row=cur_r1, column=11, value=int(lw.get("q1", 0) or 0)).font = FONT_NUMERIC_BOLD

        # Rating / Ranking for Last Week
        lw_r = lw.get("rating_above_1500") or lw.get("rating_1500") or 0
        lw_rnk = lw.get("rank_below_20000") or lw.get("ranking_20000") or 0
        ws1.cell(row=cur_r1, column=12, value=int(lw_r) if lw_r and int(lw_r) > 0 else "-").font = FONT_NUMERIC_BOLD
        ws1.cell(row=cur_r1, column=13, value=int(lw_rnk) if lw_rnk and int(lw_rnk) > 0 else "-").font = FONT_NUMERIC_BOLD

        # Row 2: Current Week
        cur_r1 += 1
        c_batch_cw = ws1.cell(row=cur_r1, column=1, value=f"{b_label}\n(Current Week)")
        c_batch_cw.font = FONT_NUMERIC_BOLD
        c_batch_cw.alignment = ALIGN_CENTER

        # Current Week problem solve counts
        cw_cats: Dict[str, Any] = cw["categories"] if isinstance(cw.get("categories"), dict) else {}
        cw_above_500 = int(cw.get("prob_above_500") if cw.get("prob_above_500") is not None else (cw.get("above_500") or cw_cats.get("Above 500", 0) or 0))
        cw_250_500 = int(cw.get("prob_250_500") if cw.get("prob_250_500") is not None else (cw.get("250_500") or cw_cats.get("250 - 500", 0) or 0))
        cw_100_249 = int(cw.get("prob_100_249") if cw.get("prob_100_249") is not None else (cw.get("101_250") or cw_cats.get("Less than 250", 0) or 0))
        cw_1_99 = int(cw.get("prob_1_99") if cw.get("prob_1_99") is not None else (cw.get("less_100") or cw_cats.get("Less than 100", 0) or 0))
        cw_0 = int(cw.get("prob_0") if cw.get("prob_0") is not None else (cw.get("not_started") or cw_cats.get("Not Yet Started", 0) or 0))

        ws1.cell(row=cur_r1, column=3, value=cw_above_500).font = FONT_NUMERIC_BOLD
        ws1.cell(row=cur_r1, column=4, value=cw_250_500).font = FONT_NUMERIC_BOLD
        ws1.cell(row=cur_r1, column=5, value=cw_100_249).font = FONT_NUMERIC_BOLD
        ws1.cell(row=cur_r1, column=6, value=cw_1_99).font = FONT_NUMERIC_BOLD
        ws1.cell(row=cur_r1, column=7, value=cw_0).font = FONT_NUMERIC_BOLD

        # Current Week contest attended counts
        ws1.cell(row=cur_r1, column=8, value=int(cw.get("q4", 0) or 0)).font = FONT_NUMERIC_BOLD
        ws1.cell(row=cur_r1, column=9, value=int(cw.get("q3", 0) or 0)).font = FONT_NUMERIC_BOLD
        ws1.cell(row=cur_r1, column=10, value=int(cw.get("q2", 0) or 0)).font = FONT_NUMERIC_BOLD
        ws1.cell(row=cur_r1, column=11, value=int(cw.get("q1", 0) or 0)).font = FONT_NUMERIC_BOLD

        # Rating / Ranking
        cw_r = cw.get("rating_above_1500") or cw.get("rating_1500") or 0
        cw_rnk = cw.get("rank_below_20000") or cw.get("ranking_20000") or 0
        ws1.cell(row=cur_r1, column=12, value=int(cw_r) if cw_r and int(cw_r) > 0 else "-").font = FONT_NUMERIC_BOLD
        ws1.cell(row=cur_r1, column=13, value=int(cw_rnk) if cw_rnk and int(cw_rnk) > 0 else "-").font = FONT_NUMERIC_BOLD

        # Apply borders, row height 36 for luxurious 2-line rendering, and center alignment
        for r_x in (cur_r1 - 1, cur_r1):
            ws1.row_dimensions[r_x].height = 36
            for c_x in range(1, 14):
                cell_item = ws1.cell(row=r_x, column=c_x)
                _apply_thin_border(cell_item)
                cell_item.alignment = ALIGN_CENTER
        cur_r1 += 1

    col_w1 = {1: 17.5, 2: 12.0, 3: 9.0, 4: 9.0, 5: 9.0, 6: 9.0, 7: 9.5, 8: 8.5, 9: 8.5, 10: 8.5, 11: 8.5, 12: 13.0, 13: 13.5}
    for c_i, w in col_w1.items():
        ws1.column_dimensions[get_column_letter(c_i)].width = w

    # =========================================================================
    # SHEET 2: LEETCODE CONTEST PERFORMANCE - WEEKLY REPORT (Image 2 Match)
    # Always included: provides the single-contest breakdown with 4,3,2,1,0 solved,
    # ratings (Above 2000, 1500, 1250), and Global Ranking below 20000.
    # =========================================================================
    ws2 = wb.create_sheet(title="Contest Performance")
    ws2.sheet_view.showGridLines = True
    ws2.page_setup.paperSize = ws2.PAPERSIZE_A4
    ws2.page_setup.orientation = ws2.ORIENTATION_LANDSCAPE
    ws2.sheet_properties.pageSetUpPr.fitToPage = True
    ws2.page_setup.fitToWidth = 1
    ws2.page_setup.fitToHeight = 1
    ws2.page_margins.left = 0.4
    ws2.page_margins.right = 0.4
    ws2.page_margins.top = 0.5
    ws2.page_margins.bottom = 0.5

    if os.path.exists(logo_path):
        try:
            from openpyxl.drawing.image import Image as OpenPyxlImage
            img2 = OpenPyxlImage(logo_path)
            img2.width = 90
            img2.height = 90
            ws2.add_image(img2, "A1")
        except Exception:
            pass

    ws2.merge_cells("A1:M1")
    ws2["A1"] = "NANDHA ENGINEERING COLLEGE, ERODE - 638 052."
    ws2["A1"].font = FONT_DOC_MAIN_TITLE
    ws2["A1"].alignment = ALIGN_CENTER

    ws2.merge_cells("A2:M2")
    ws2["A2"] = dept_name
    ws2["A2"].font = FONT_DOC_SUBTITLE
    ws2["A2"].alignment = ALIGN_CENTER

    ws2.merge_cells("A3:M3")
    ws2["A3"] = f"Date: {report_date}"
    ws2["A3"].font = FONT_DOC_SUBTITLE
    ws2["A3"].alignment = ALIGN_CENTER

    ws2.merge_cells("A4:M4")
    ws2["A4"] = "Leetcode Contest Performance - Weekly Report"
    ws2["A4"].font = FONT_DOC_SECTION
    ws2["A4"].alignment = ALIGN_CENTER

    ws2.merge_cells("A5:M5")
    ws2["A5"] = f"Name & Designation of the Academic Coordinator: {coordinator}"
    ws2["A5"].font = FONT_DOC_SUBTITLE
    ws2["A5"].alignment = ALIGN_CENTER

    ws2.row_dimensions[1].height = 26
    ws2.row_dimensions[2].height = 20
    ws2.row_dimensions[3].height = 20
    ws2.row_dimensions[4].height = 24
    ws2.row_dimensions[5].height = 30

    # Table Header Rows 6-7 for Sheet 2
    h2_r6 = [
        ("Batch", 1, 1, 6, 7),
        ("Number of Students\n(Total Count)", 2, 2, 6, 7),
        ("Contest taken on ---\n(Date)", 3, 3, 6, 7),
        ("Number of Problems Solved", 4, 8, 6, 6),
        ("Leetcode Contest Rating and\nRanking", 9, 11, 6, 6),
        ("Global Ranking\nBelow 20000", 12, 12, 6, 7),
        ("Contest Rank\nBelow 5000", 13, 13, 6, 7),
    ]
    for text, s_c, e_c, s_r, e_r in h2_r6:
        if s_c == e_c and s_r == e_r:
            c = ws2.cell(row=s_r, column=s_c, value=text)
        else:
            ws2.merge_cells(start_row=s_r, start_column=s_c, end_row=e_r, end_column=e_c)
            c = ws2.cell(row=s_r, column=s_c, value=text)
        c.font = FONT_DOC_TBL_HDR
        c.alignment = ALIGN_CENTER
        for r_x in range(s_r, e_r + 1):
            for c_x in range(s_c, e_c + 1):
                cell_h = ws2.cell(row=r_x, column=c_x)
                cell_h.fill = HDR_SLATE_FILL
                _apply_thin_border(cell_h)

    h2_r7 = [
        (4, 4),
        (5, 3),
        (6, 2),
        (7, 1),
        (8, 0),
        (9, "Above\n2000"),
        (10, "Above\n1500"),
        (11, "Above\n1250"),
    ]
    for col_i, text in h2_r7:
        c = ws2.cell(row=7, column=col_i, value=text)
        c.font = FONT_DOC_TBL_HDR
        c.alignment = ALIGN_CENTER
        c.fill = SUBHDR_SLATE_FILL
        _apply_thin_border(c)

    ws2.row_dimensions[6].height = 42
    ws2.row_dimensions[7].height = 36

    cur_r2 = 8
    for b in batch_summaries:
        b_label = str(b.get("batch", ""))
        cw: Dict[str, Any] = b["current_week"] if isinstance(b.get("current_week"), dict) else {}
        lw: Dict[str, Any] = b["last_week"] if isinstance(b.get("last_week"), dict) else {}
        raw_b_tot2 = b.get("total_students") or b.get("num_students") or lw.get("total_students") or cw.get("total_students") or 0
        b_tot = int(raw_b_tot2) if isinstance(raw_b_tot2, (int, float, str)) else 0
        c_date = str(b.get("contest_date") or contest_date or report_date)

        q4 = int(cw.get("q4", 0) or 0)
        q3 = int(cw.get("q3", 0) or 0)
        q2 = int(cw.get("q2", 0) or 0)
        q1 = int(cw.get("q1", 0) or 0)
        q0 = cw.get("q0")
        if q0 is None or q0 == 0:
            q0 = max(0, b_tot - (q4 + q3 + q2 + q1))
        else:
            q0 = int(q0)

        r_2000 = cw.get("rating_above_2000") or cw.get("rating_2000") or 0
        r_1500 = cw.get("rating_above_1500") or cw.get("rating_1500") or 0
        r_1250 = cw.get("rating_above_1250") or cw.get("rating_1250") or 0
        rk_20k = cw.get("rank_below_20000") or cw.get("ranking_20000") or 0
        rk_5k = cw.get("rank_below_5000") or cw.get("ranking_5000") or cw.get("rank_below_5k") or 0

        fmt_m = lambda val: int(val) if (isinstance(val, (int, float)) and val > 0) else "—"

        row_vals2 = [
            (1, b_label),
            (2, b_tot),
            (3, c_date),
            (4, q4),
            (5, q3),
            (6, q2),
            (7, q1),
            (8, q0),
            (9, fmt_m(r_2000)),
            (10, fmt_m(r_1500)),
            (11, fmt_m(r_1250)),
            (12, fmt_m(rk_20k)),
            (13, fmt_m(rk_5k)),
        ]
        for col_i, val in row_vals2:
            c = ws2.cell(row=cur_r2, column=col_i, value=val)
            c.font = FONT_NUMERIC_BOLD
            c.alignment = ALIGN_CENTER
            _apply_thin_border(c)
        ws2.row_dimensions[cur_r2].height = 28
        cur_r2 += 1

    col_w2 = {1: 17.5, 2: 12.0, 3: 12.0, 4: 7.0, 5: 7.0, 6: 7.0, 7: 7.0, 8: 7.0, 9: 9.5, 10: 9.5, 11: 9.5, 12: 13.5, 13: 13.5}
    for c_i, w in col_w2.items():
        ws2.column_dimensions[get_column_letter(c_i)].width = w

    # =========================================================================
    # SHEET 3: DEPARTMENT PERFORMANCE SUMMARY
    # =========================================================================
    ws_dept = wb.create_sheet(title="Department Summary")
    ws_dept.sheet_view.showGridLines = True
    ws_dept.page_setup.orientation = ws_dept.ORIENTATION_LANDSCAPE

    _write_college_header(
        ws_dept,
        "COORDINATOR WEEKLY PERFORMANCE REPORT",
        "ALL DEPARTMENTS",
        13,
        {
            "Report ID": str(dataset.get("report_id") or dataset.get("reportId") or "REP-2026"),
            "Report Date": report_date,
            "Total Roster": f"{dataset.get('total_students', 0)} Students",
            "Verified Solvers": f"{dataset.get('verified_students', 0)} Solvers"
        },
        custom_dept_header="DEPARTMENT PERFORMANCE SUMMARY"
    )

    d_row = 7
    dept_headers = ["S.No", "Department", "Coordinator", "Total", "Verified", "Avg Solved", "Total Solved", "Above 500", "250–500", "4/4 Solved", "3/4 Solved", "2/4 Solved", "1/4 Solved"]
    for c_i, h in enumerate(dept_headers, 1):
        c = ws_dept.cell(row=d_row, column=c_i, value=h)
        c.font = FONT_TBL_HDR
        c.fill = NAVY_SECONDARY
        c.alignment = ALIGN_CENTER
        _apply_thin_border(c)
    ws_dept.row_dimensions[d_row].height = 28
    d_row += 1

    dept_summaries = dataset.get("department_summaries") or dataset.get("dept_summaries") or []
    sum_tot = sum_ver = sum_tot_solved = sum_ab500 = sum_250_500 = sum_q4 = sum_q3 = sum_q2 = sum_q1 = 0

    for d_i, d in enumerate(dept_summaries, 1):
        d_cats = d.get("categories") or {}
        d_cw = d.get("current_week") or {}
        d_m = d.get("metrics") or {}

        t_students = int(d.get("total_students", 0) or 0)
        v_students = int(d_m.get("verified_students") or d_m.get("verified") or t_students)
        t_solved = int(d_m.get("total_solved", 0) or 0)

        # Precise Average Solved Calculation
        avg_s = d_m.get("avg_solved") if d_m.get("avg_solved") is not None else d_m.get("average_solved")
        if (avg_s is None or avg_s == 0) and t_students > 0 and t_solved > 0:
            avg_s = round(t_solved / t_students, 1)
        elif avg_s is None:
            avg_s = 0.0

        c_ab500 = int(d_cats.get("Above 500", 0) or 0)
        c_250_500 = int(d_cats.get("250 - 500") or d_cats.get("250–500", 0) or 0)
        cq4 = int(d_cw.get("q4", 0) or 0)
        cq3 = int(d_cw.get("q3", 0) or 0)
        cq2 = int(d_cw.get("q2", 0) or 0)
        cq1 = int(d_cw.get("q1", 0) or 0)

        sum_tot += t_students
        sum_ver += v_students
        sum_tot_solved += t_solved
        sum_ab500 += c_ab500
        sum_250_500 += c_250_500
        sum_q4 += cq4
        sum_q3 += cq3
        sum_q2 += cq2
        sum_q1 += cq1

        d_vals = [
            d_i,
            d.get("department") or d.get("dept") or "",
            d.get("coordinator") or "—",
            t_students,
            v_students,
            round(avg_s, 1) if isinstance(avg_s, float) else avg_s,
            t_solved,
            c_ab500,
            c_250_500,
            cq4,
            cq3,
            cq2,
            cq1,
        ]
        for c_i, v in enumerate(d_vals, 1):
            c = ws_dept.cell(row=d_row, column=c_i, value=v)
            c.font = FONT_BODY_BOLD if c_i == 2 else (FONT_BODY if c_i == 3 else FONT_NUMERIC)
            c.alignment = ALIGN_LEFT if c_i == 3 else ALIGN_CENTER
            _apply_thin_border(c)
        ws_dept.row_dimensions[d_row].height = 26
        d_row += 1

    # Total Summary Row for Institutional Consolidation
    if dept_summaries:
        ws_dept.cell(row=d_row, column=1, value="")
        tot_label_cell = ws_dept.cell(row=d_row, column=2, value="TOTAL")
        tot_label_cell.font = FONT_BODY_BOLD
        tot_label_cell.alignment = ALIGN_CENTER
        tot_label_cell.fill = SUB_FILL
        _apply_thin_border(tot_label_cell)

        tot_coord_cell = ws_dept.cell(row=d_row, column=3, value="INSTITUTIONAL SUMMARY")
        tot_coord_cell.font = FONT_BODY_BOLD
        tot_coord_cell.alignment = ALIGN_LEFT
        tot_coord_cell.fill = SUB_FILL
        _apply_thin_border(tot_coord_cell)

        overall_avg = round(sum_tot_solved / sum_tot, 1) if sum_tot > 0 else 0.0

        tot_summary_vals = [
            sum_tot,
            sum_ver,
            overall_avg,
            sum_tot_solved,
            sum_ab500,
            sum_250_500,
            sum_q4,
            sum_q3,
            sum_q2,
            sum_q1
        ]
        for c_i, v in enumerate(tot_summary_vals, 4):
            c = ws_dept.cell(row=d_row, column=c_i, value=v)
            c.font = FONT_NUMERIC_BOLD
            c.alignment = ALIGN_CENTER
            c.fill = SUB_FILL
            _apply_thin_border(c)
        ws_dept.row_dimensions[d_row].height = 26

    # Column Widths Optimized for Alignment & Readability
    dept_col_widths = {
        1: 8.0,   # S.No
        2: 15.0,  # Department
        3: 40.0,  # Coordinator
        4: 10.0,  # Total
        5: 10.0,  # Verified
        6: 13.0,  # Avg Solved
        7: 15.0,  # Total Solved
        8: 12.0,  # Above 500
        9: 12.0,  # 250–500
        10: 12.0, # 4/4 Solved
        11: 12.0, # 3/4 Solved
        12: 12.0, # 2/4 Solved
        13: 12.0  # 1/4 Solved
    }
    for c_i, w in dept_col_widths.items():
        ws_dept.column_dimensions[get_column_letter(c_i)].width = w

    # SHEET 4: FULL STUDENT ROSTER
    ws_roster = wb.create_sheet(title="Full Student Roster")
    ws_roster.sheet_view.showGridLines = True
    ws_roster.page_setup.paperSize = ws_roster.PAPERSIZE_A4
    ws_roster.page_setup.orientation = ws_roster.ORIENTATION_LANDSCAPE
    ws_roster.sheet_properties.pageSetUpPr.fitToPage = True
    ws_roster.page_setup.fitToWidth = 1
    ws_roster.page_setup.fitToHeight = 0

    raw_roster = dataset.get("all_students_current") or dataset.get("allStudents") or dataset.get("rows") or []
    if target_year != "ALL":
        y_aliases = {target_year}
        if target_year == "II": y_aliases.update({"2", "2ND", "II YEAR"})
        elif target_year == "III": y_aliases.update({"3", "3RD", "III YEAR"})
        elif target_year == "IV": y_aliases.update({"4", "4TH", "IV YEAR"})
        filtered_roster = [
            s for s in raw_roster 
            if str(s.get("year") or s.get("year_level") or s.get("academic_year") or "").strip().upper() in y_aliases
            or target_year in str(s.get("year") or s.get("year_level") or s.get("academic_year") or "").strip().upper()
        ]
        roster_rows = filtered_roster if filtered_roster else raw_roster
    else:
        roster_rows = raw_roster

    yr_header_text = f"{target_year} Year" if target_year != "ALL" else "All Years"
    r_dept_text = f"{dept_name} • COHORT: {yr_header_text}"
    _write_college_header(
        ws_roster,
        f"COORDINATOR WEEKLY PERFORMANCE REPORT — FULL STUDENT ROSTER ({yr_header_text.upper()})",
        r_dept_text,
        14,
        {
            "Date": report_date,
            "Total Roster": f"{len(roster_rows)} Students",
            "Report ID": str(dataset.get("report_id") or dataset.get("reportId") or "REP-2026"),
            "Department": dept_name,
            "Year": yr_header_text,
            "Contest": str(dataset.get("contest_date") or contest_date)
        }
    )

    r_hdr_row = 7
    r_headers = ["S.No", "Register No", "Student Name", "Dept", "Yr", "Easy", "Med", "Hard", "Total", "Rating", "Rank", "Category", "Curr Week", "Last Week"]
    for c_i, h in enumerate(r_headers, 1):
        c = ws_roster.cell(row=r_hdr_row, column=c_i, value=h)
        c.font = FONT_TBL_HDR
        c.fill = NAVY_PRIMARY
        c.alignment = ALIGN_CENTER
        _apply_thin_border(c)
    ws_roster.row_dimensions[r_hdr_row].height = 24

    def _fmt_res(r_val):
        if not r_val or r_val in ("NOT_PARTICIPATED", "NOT_ATTENDED", "NONE", "—"):
            return "—"
        s = str(r_val)
        if "SOLVED" in s:
            return s.replace("_SOLVED", "/4")
        return s

    for idx, s in enumerate(roster_rows, 1):
        row_num = r_hdr_row + idx
        pub_res = _fmt_res(s.get("public_result") or s.get("current_week_result"))
        last_res = _fmt_res(s.get("last_public_result") or s.get("last_week_result"))

        # Resolve contest rating and global rank
        c_rating = "—"
        for rk in ("contest_rating", "rating", "rating_val"):
            rv = s.get(rk)
            if rv is not None and str(rv).strip() not in ("—", "None", "nan", "NaN", "null", "", "0", "1500", "1500.0"):
                c_rating = rv
                break

        g_rank = "—"
        for rk in ("global_rank", "contest_global_ranking", "contest_global_rank", "contest_rank", "profile_rank"):
            gv = s.get(rk)
            if gv is not None and str(gv).strip() not in ("—", "None", "nan", "NaN", "null", "", "0", "5000001", "5,000,001", "N/A"):
                g_rank = gv
                break

        vals = [
            s.get("s_no") or idx,
            str(s.get("reg_no") or s.get("register_no") or "").strip().upper(),
            str(s.get("name") or s.get("student_name") or "").strip().upper(),
            str(s.get("dept") or s.get("department") or ""),
            str(s.get("year") or s.get("academic_year") or ""),
            s.get("easy") if s.get("easy") is not None else "—",
            s.get("medium") if s.get("medium") is not None else "—",
            s.get("hard") if s.get("hard") is not None else "—",
            s.get("total_solved") if s.get("total_solved") is not None else "—",
            c_rating,
            g_rank,
            str(s.get("category") or "—"),
            pub_res,
            last_res
        ]
        for c_i, v in enumerate(vals, 1):
            c = ws_roster.cell(row=row_num, column=c_i, value=v)
            c.font = FONT_BODY
            c.alignment = ALIGN_LEFT if c_i == 3 else ALIGN_CENTER
            _apply_thin_border(c)
        ws_roster.row_dimensions[row_num].height = 20

    # Column Auto-Widths & Min-Widths ONLY for ws_dept and ws_roster (ws1 and ws2 keep their exact A4 landscape widths)
    for sheet in [ws_roster]:
        for col in sheet.columns:
            if not col or col[0].column is None:
                continue
            col_idx = col[0].column
            col_letter = get_column_letter(col_idx)
            hdr_val = ""
            for r_chk in range(12, 0, -1):
                cell_v = str(sheet.cell(row=r_chk, column=col_idx).value or "").strip().upper()
                if cell_v and not cell_v.startswith("NANDHA") and not cell_v.startswith("(AUTONOMOUS)") and not cell_v.startswith("COORDINATOR") and not cell_v.startswith("TOTAL"):
                    hdr_val = cell_v
                    break

            max_len = len(hdr_val)
            for cell in col:
                if cell.row is not None and cell.row >= 7:
                    val_s = str(cell.value or "")
                    if len(val_s) > max_len and len(val_s) < 80:
                        max_len = len(val_s)

            if "REGISTER" in hdr_val: w = max(15.0, max_len + 2)
            elif "NAME" in hdr_val: w = max(24.0, max_len + 2)
            elif "DEPARTMENT" in hdr_val or hdr_val == "DEPT": w = max(14.0, max_len + 2)
            elif "COORDINATOR" in hdr_val: w = max(20.0, max_len + 2)
            elif "CATEGORY" in hdr_val: w = max(15.0, max_len + 2)
            else: w = max(8.0, min(max_len + 2, 22.0))
            sheet.column_dimensions[col_letter].width = w

    try:
        wb.active = ws1
    except Exception:
        pass

    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()


def export_excel_from_dataset(dataset: dict) -> bytes:
    """
    MASTER INSTITUTIONAL EXCEL WORKBOOK EXPORTER
    Constructs a 16-sheet Principal-ready intelligence report using strictly Times New Roman.
    """
    rpt_t = str(dataset.get("report_type") or dataset.get("reportType") or "").upper()
    if any(k in rpt_t for k in ("WEEK_ON_WEEK", "WOW", "HISTORICAL")) or dataset.get("wowSummary") or dataset.get("histSummary") or dataset.get("sessionHeaders"):
        from backend.exporters.dynamic_excel_exporter import export_dynamic_excel
        return export_dynamic_excel(dataset)

    SPECIALIZED_REPORTS = {
        "FACULTY_CONSOLIDATED", "FACULTY_COORDINATOR_CONSOLIDATED",
        "HOD_DEPARTMENT_INTELLIGENCE", "PRINCIPAL_EXECUTIVE",
        "MANAGEMENT_EXECUTIVE_SUMMARY", "12TH_TNEA_CUTOFF_ANALYSIS",
        "OFFICIAL_SUMMARY", "STUDENT_PERFORMANCE", "STUDENT_DETAIL",
        "CONTEST_ATTENDANCE_PARTICIPATION", "CONTEST_PERFORMANCE_RANKING",
        "PROBLEM_DIFFICULTY_INTELLIGENCE", "FIVE_WEEK_PERFORMANCE_TREND",
        "FIVE_WEEK_TREND", "HISTORICAL_CONTEST_INTELLIGENCE", "HISTORICAL_CONTEST_INTEL",
        "WEEK_ON_WEEK_INTELLIGENCE", "MASTER_10_SHEET", "MASTER_TRACKER",
        "WEEKLY_CONTEST_MATRIX"
    }

    if rpt_t not in SPECIALIZED_REPORTS and (
        rpt_t in ("WEEKLY_COORDINATOR", "COORDINATOR", "COORDINATOR_WEEKLY_PERFORMANCE")
        or (rpt_t in ("WEEKLY_PERFORMANCE", "WEEKLY_STUDENT_PERFORMANCE") and "COORDINATOR" in str(dataset.get("title") or "").upper())
    ):
        return export_weekly_performance_excel(dataset)

    wb = openpyxl.Workbook()
    if wb.active is not None:
        wb.remove(wb.active)  # Remove default sheet

    raw_rows = dataset.get("rows") or dataset.get("all_rows") or []
    rows = [normalize_row_data(r) for r in raw_rows]
    # Filter out synthetic / test / hardening student records.
    # These must never appear in official institutional reports.
    # Patterns excluded:
    #   TEST_*          — load-test race students (TEST_RACE_0000, etc.)
    #   7322STU*        — hardening/RBAC test accounts (7322STUBETA, 7322STU_RBAC_B, etc.)
    #   hardening_*     — hardening test accounts
    def _is_real_student(r) -> bool:
        reg = str(r.get("reg_no") or "").strip().upper()
        name = str(r.get("name") or "").strip().upper()
        if reg.startswith("TEST") or reg.startswith("7322STU") or reg.startswith("HARDENING") or reg.startswith("CONCUR"):
            return False
        if name.startswith("RACE TEST STUDENT") or name.startswith("STUDENT BETA") or name.startswith("HARDENING") or name.startswith("CONCURRENT"):
            return False
        return True
    rows = [r for r in rows if _is_real_student(r)]
    metrics = dataset.get("metrics", {})

    from backend.services.contest_discovery import get_immediately_previous_sunday_date, calculate_contest_number
    _prev_sun = get_immediately_previous_sunday_date()
    _def_cname = f"Weekly Contest {calculate_contest_number(_prev_sun)}"
    _def_cdate = _prev_sun.strftime("%d.%m.%Y")

    contest_name = dataset.get("contestName") or metrics.get("contestName") or dataset.get("contest_name") or _def_cname
    contest_date_str = dataset.get("sessionDate") or dataset.get("session_date") or _def_cdate
    snapshot_id = str(dataset.get("snapshotId") or dataset.get("snapshot_id") or dataset.get("reportId") or f"SESSION_{calculate_contest_number(_prev_sun)}_OFFICIAL")
    from backend.time_utils import now_ist, format_ist_datetime
    gen_time_str = dataset.get("generatedAtIST") or format_ist_datetime(now_ist())

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
    
    tot_data_errors = sum(1 for r in rows if str(r.get("status") or "").upper() in ("USERNAME_NOT_FOUND", "INVALID_USERNAME", "PENDING_USERNAME", "UNLINKED", "ERROR", "DATA_ERROR", "FETCH_FAILED", "FETCH_ERROR"))
    tot_not_attended = tot_students - tot_attended - tot_data_errors
    if tot_not_attended < 0:
        tot_not_attended = 0
        
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
        ("OFFICIAL ATTENDANCE", f"{tot_attended:,} ({att_pct:.1f}%)", "C", "D", "059669"),
        ("NOT ATTENDED", f"{tot_not_attended:,}", "E", "F", "DC2626"),
        ("DATA ERRORS", f"{tot_data_errors:,}", "G", "H", "B45309"),
        ("TOTAL SOLVES", f"{total_solves:,}", "I", "J", "2E5B88"),
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
        cell.alignment = ALIGN_CENTER if c_i > 1 else ALIGN_LEFT
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
            # Center Align: S.No, Register No, Department, Year, Username, Status, Q1-Q4, Solved. Left Align: Student Name
            cell.alignment = ALIGN_LEFT if c_i == 3 else ALIGN_CENTER
            if r["is_att"] and c_i in (7, 12):
                cell.font = FONT_SUCCESS
                cell.fill = FILL_SUCCESS
            _apply_thin_border(cell)
        ws2.row_dimensions[row_num].height = 22

    ws2.auto_filter.ref = f"A{r2_hdr}:L{r2_hdr + tot_students}"

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
            # Center Align all except Student Name (3) and Evidence Summary (10)
            cell.alignment = ALIGN_LEFT if c_i in (3, 10) else ALIGN_CENTER
            if c_i == 7:
                cell.fill = FILL_SUCCESS if is_live else (FILL_WARNING if is_virt else FILL_RISK)
                cell.font = FONT_SUCCESS if is_live else (FONT_WARNING if is_virt else FONT_RISK)
            _apply_thin_border(cell)
        ws3.row_dimensions[row_num].height = 22

    ws3.auto_filter.ref = f"A{r3_hdr}:J{r3_hdr + tot_students}"

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
                # Center Align all except Student Name (3)
                cell.alignment = ALIGN_LEFT if c_i == 3 else ALIGN_CENTER
                if c_i in (1, 11, 12):
                    cell.font = FONT_BODY_BOLD
                _apply_thin_border(cell)
            ws_t.row_dimensions[row_num].height = 22

        ws_t.auto_filter.ref = f"A{rt_hdr}:L{rt_hdr + len(tier_rows)}"

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

        depts_to_show = [d for d in (depts_present if depts_present else OFFICIAL_DEPTS) if len(dept_map.get(d, [])) > 0]
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

    # 
    # SHEETS: CSE(CS) & CSE(IOT) — YEAR-WISE ENUMERATED ROSTERS
    # Generates one sheet per dept+year combination for Cyber Security and IoT.
    # Each sheet lists students with S.No, Reg No, Name, Username, Status, Q1-Q4, Solved.
    # 
    TARGET_DEPTS_YEAR_ENUM = ["CSE(CS)", "CSE(IOT)", "IT"]
    YEAR_ORDER = ["II", "III", "IV"]
    YEAR_LABEL_MAP = {"II": "II Year", "III": "III Year", "IV": "IV Year"}
    DEPT_FULL_NAME = {
        "CSE(CS)": "Cyber Security",
        "CSE(IOT)": "Internet of Things",
        "IT": "Information Technology"
    }

    def render_year_dept_sheet(dept_name: str, year_key: str, dept_year_rows: list):
        if not dept_year_rows:
            return
        year_label = YEAR_LABEL_MAP.get(year_key, year_key)
        full_dept = DEPT_FULL_NAME.get(dept_name, dept_name)
        sheet_title = f"{dept_name} - {year_label}"
        title_text = f"{contest_name.upper()} — {dept_name} ({full_dept}) • {year_label} STUDENT ROSTER"
        
        ws_yr = wb.create_sheet(title=sheet_title)
        _write_college_header(ws_yr, title_text, f"DEPARTMENT OF {dept_name} ({full_dept}) • {year_label}", 12, metadata_block)
        
        yr_hdr_row = 7
        yr_headers = ["S.No", "Register No", "Student Name", "LeetCode Username", "Status", "Q1", "Q2", "Q3", "Q4", "Solved", "Score", "Rank"]
        for c_i, h in enumerate(yr_headers, 1):
            cell = ws_yr.cell(row=yr_hdr_row, column=c_i, value=h)
            cell.font = FONT_TBL_HDR
            cell.fill = NAVY_PRIMARY
            cell.alignment = ALIGN_CENTER
            _apply_thin_border(cell)
        ws_yr.row_dimensions[yr_hdr_row].height = 28

        # Sort: attended first (by score desc), then not attended by name
        sorted_yr = sorted(
            dept_year_rows,
            key=lambda x: (0 if x["is_att"] else 1, -x["score"], x["name"].strip().upper())
        )

        d_att_count = sum(1 for r in sorted_yr if r["is_att"])
        d_not_count = len(sorted_yr) - d_att_count

        for idx, r in enumerate(sorted_yr, 1):
            row_num = yr_hdr_row + idx
            rank_val = r.get("rank") or "—"
            vals = [
                idx,
                r["reg_no"],
                r["name"],
                r["username"] or "—",
                r["status"],
                r["q1"],
                r["q2"],
                r["q3"],
                r["q4"],
                r["solved_str"],
                r["score"] if r["score"] else "—",
                rank_val
            ]
            for c_i, v in enumerate(vals, 1):
                cell = ws_yr.cell(row=row_num, column=c_i, value=v)
                cell.font = FONT_BODY
                cell.alignment = ALIGN_LEFT if c_i == 3 else ALIGN_CENTER
                if r["is_att"]:
                    if c_i == 5:
                        cell.fill = FILL_SUCCESS
                        cell.font = FONT_SUCCESS
                    elif c_i in (10, 11):
                        cell.fill = FILL_SUCCESS
                        cell.font = FONT_SUCCESS
                elif c_i == 5:
                    cell.fill = FILL_RISK
                    cell.font = FONT_RISK
                _apply_thin_border(cell)
            ws_yr.row_dimensions[row_num].height = 22

        # Summary footer row
        footer_row = yr_hdr_row + len(sorted_yr) + 2
        ws_yr.merge_cells(f"A{footer_row}:L{footer_row}")
        summary_cell = ws_yr[f"A{footer_row}"]
        att_pct_yr = (d_att_count / len(sorted_yr) * 100) if sorted_yr else 0.0
        summary_cell.value = (
            f"SUMMARY: {dept_name} • {year_label} — "
            f"Total: {len(sorted_yr)} | Attended: {d_att_count} ({att_pct_yr:.1f}%) | Not Attended: {d_not_count}"
        )
        summary_cell.font = Font(name=FONT_TNR, size=10, bold=True, color="1B365D")
        summary_cell.fill = SUB_FILL
        summary_cell.alignment = ALIGN_LEFT
        _apply_thin_border(summary_cell)

        ws_yr.auto_filter.ref = f"A{yr_hdr_row}:L{yr_hdr_row + len(sorted_yr)}"

    for t_dept in TARGET_DEPTS_YEAR_ENUM:
        dept_all_rows = dept_map.get(t_dept, [])
        if not dept_all_rows:
            continue
        # Build year sub-groups from the dept rows
        dept_year_buckets: Dict[str, list] = {}
        for r in dept_all_rows:
            y_key = r["year"]
            if y_key not in dept_year_buckets:
                dept_year_buckets[y_key] = []
            dept_year_buckets[y_key].append(r)
        # Render in canonical year order
        for y_key in YEAR_ORDER:
            if y_key in dept_year_buckets:
                render_year_dept_sheet(t_dept, y_key, dept_year_buckets[y_key])
        # Any remaining years not in YEAR_ORDER
        for y_key, y_rows in dept_year_buckets.items():
            if y_key not in YEAR_ORDER:
                render_year_dept_sheet(t_dept, y_key, y_rows)


    for ws_item in wb.worksheets:
        s_title = ws_item.title
        ws_item.sheet_view.showGridLines = True
        for col in ws_item.columns:
            if not col or col[0].column is None:
                continue
            col_idx = col[0].column
            col_letter = get_column_letter(col_idx)
            
            # Lookup column header title from row 7 or row 11
            hdr_val = ""
            for r_chk in range(12, 0, -1):
                cell_v = str(ws_item.cell(row=r_chk, column=col_idx).value or "").strip().upper()
                if cell_v and not any(cell_v.startswith(p) for p in ("NANDHA", "(AUTONOMOUS)", "CONTEST", "DEPARTMENT OF", "COORDINATOR", "SUMMARY", "TOTAL")):
                    hdr_val = cell_v
                    break

            max_len = len(hdr_val)
            for cell in col:
                if cell.row is not None and cell.row >= 7:
                    val_s = str(cell.value or "").strip()
                    if val_s and len(val_s) > max_len and len(val_s) < 90:
                        max_len = len(val_s)
            
            if s_title == "Executive Summary":
                if col_idx == 1:
                    w = max(22.0, max_len + 4)  # Metric / Student Counts
                elif col_idx in (2, 3, 4, 5):
                    w = 18.0  # 4/4, 3/4, 2/4, 1/4 Solvers
                elif col_idx == 6:
                    w = 18.0  # 0/4 / Absent
                else:
                    w = 15.0  # Q1, Q2, Q3, Q4 Solves
            else:
                if "REGISTER" in hdr_val:
                    w = max(22.0, max_len + 5)
                elif "NAME" in hdr_val or "STUDENT" in hdr_val:
                    w = max(32.0, max_len + 5)
                elif "DEPARTMENT" in hdr_val or hdr_val in ("DEPT", "DEPARTMENT NAME"):
                    w = max(20.0, max_len + 5)
                elif "YEAR" in hdr_val or hdr_val in ("YR", "YEAR LEVEL"):
                    w = max(14.0, max_len + 5)
                elif "USERNAME" in hdr_val or "LEETCODE" in hdr_val or "HANDLE" in hdr_val:
                    w = max(26.0, max_len + 5)
                elif "STATUS" in hdr_val or "ATTENDANCE" in hdr_val:
                    w = max(22.0, max_len + 5)
                elif "EVIDENCE" in hdr_val:
                    w = max(36.0, max_len + 5)
                elif hdr_val in ("Q1", "Q2", "Q3", "Q4"):
                    w = 12.0
                elif hdr_val in ("SOLVED", "SCORE", "LIVE", "VIRTUAL", "ATTENDED"):
                    w = 15.0
                elif hdr_val in ("S.NO", "NO", "RANK", "S. NO", "S.NO."):
                    w = 14.0
                else:
                    w = max(14.0, min(max_len + 5, 45.0))

            ws_item.column_dimensions[col_letter].width = w

    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()
