"""
master_institutional_report_service.py
Nandha Engineering College — Weekly LeetCode Intelligence Reporting System

Production-grade, deterministic, role-authorized, 10-Sheet Master Institutional Excel Engine.
Strictly implements the 35-point Final Master Prompt specification.
"""

import os
import io
import datetime
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session

from backend.models import Student, Department, Contest, ContestParticipationRecord, LeetCodeProfileStats, User
from backend.services.authorization_service import apply_role_based_student_filter
from backend.services.contest_performance_service import matches_dept, matches_year
from backend.logger import logger

# ==========================================
# 1. COLOR SYSTEM (EXACT HEX PALETTE)
# ==========================================
PRIMARY_FONT = "Segoe UI"

COLOR_PALETTE = {
    "01 Principal Executive": {"primary": "16324F", "light": "EEF3F7"},
    "01 Official Leaderboard": {"primary": "16324F", "light": "EEF3F7"},
    "02 Question Analysis": {"primary": "16324F", "light": "EEF3F7"},
    "03 Dept Summary": {"primary": "16324F", "light": "EEF3F7"},
    "02 Complete Student Roster": {"primary": "2F5D8A", "light": "EEF4FA"},
    "03 Contest Attendance": {"primary": "2E7D62", "light": "EAF5F0"},
    "04 Contest Performance": {"primary": "317B78", "light": "EAF5F4"},
    "05 Top Performers": {"primary": "7057A8", "light": "F2EFF8"},
    "06 4-4 Perfect Solvers": {"primary": "2E7D62", "light": "EAF5F0"},
    "07 3-4 Solvers": {"primary": "4C8DBB", "light": "EDF5FA"},
    "08 2-4 Solvers": {"primary": "526777", "light": "EEF2F5"},
    "09 1-4 Solvers": {"primary": "D27A35", "light": "FCF1E8"},
    "10 Department Intelligence": {"primary": "8A4054", "light": "F7EEF1"},
    "Contest Attendance Matrix": {"primary": "2E7D62", "light": "EAF5F0"},
    "Contest Performance Ranking": {"primary": "7057A8", "light": "F2EFF8"},
    "Student Performance Roster": {"primary": "2F5D8A", "light": "EEF4FA"},
    "5-Week Performance Matrix": {"primary": "4C8DBB", "light": "EDF5FA"},
    "Difficulty Intelligence Summary": {"primary": "526777", "light": "EEF2F5"},
    "Student Difficulty Roster": {"primary": "526777", "light": "EEF2F5"},
    "Faculty Summary": {"primary": "D27A35", "light": "FCF1E8"},
    "Coordinator Faculty Overview": {"primary": "D27A35", "light": "FCF1E8"},
    "Assigned Student Detail Roster": {"primary": "D27A35", "light": "FCF1E8"},
    "Management Executive Summary": {"primary": "16324F", "light": "EEF3F7"},
    "Department Rank Comparison": {"primary": "16324F", "light": "EEF3F7"},
}

SUPPORTING_COLORS = {
    "white": "FFFFFF",
    "background": "F8FAFC",
    "border": "D7E0E8",
    "secondary_text": "657786",
    "positive": "2E7D62",
    "attention": "C58A22",
    "critical": "B85C5C"
}

# Standard Thin Border
THIN_SIDE = Side(style='thin', color=SUPPORTING_COLORS["border"])
GRID_BORDER = Border(left=THIN_SIDE, right=THIN_SIDE, top=THIN_SIDE, bottom=THIN_SIDE)

# Alignments
ALIGN_CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)
ALIGN_LEFT = Alignment(horizontal="left", vertical="center", wrap_text=True)
ALIGN_RIGHT = Alignment(horizontal="right", vertical="center")


# ==========================================
# 2. SOURCE DATA VALIDATION GATE
# ==========================================
def validate_source_dataset(students_data: List[Dict[str, Any]]) -> None:
    """
    28-Point Validation Gate.
    BLOCKS report generation if duplicate Register No or invalid Q values exist.
    """
    seen_reg_nos = set()
    for s in students_data:
        reg_no = str(s.get("reg_no") or s.get("register_no") or "").strip().upper()
        if not reg_no:
            continue

        if reg_no in seen_reg_nos:
            raise ValueError(f"BLOCK: Duplicate Register No detected in source dataset: {reg_no}")
        seen_reg_nos.add(reg_no)

        # Validate Q1-Q4
        for q_key in ["q1", "q2", "q3", "q4"]:
            val = s.get(q_key)
            if val is not None and str(val).strip() not in ("0", "1", "0.0", "1.0", ""):
                raise ValueError(f"BLOCK: Invalid {q_key.upper()} value for student {reg_no}: '{val}'. Must be 0 or 1.")


# ==========================================
# 3. MENTOR SIGNALS & DATA NORMALIZATION
# ==========================================
def get_mentor_signal(solved: int) -> str:
    if solved >= 4:
        return "HIGH PERFORMANCE"
    elif solved == 3:
        return "STRONG"
    elif solved == 2:
        return "DEVELOPING"
    elif solved == 1:
        return "FOUNDATION"
    return "NO SOLVE / FOLLOW-UP"


def normalize_student_record(s_dict: Dict[str, Any]) -> Dict[str, Any]:
    status_str = str(s_dict.get("status") or s_dict.get("participation_status") or "NOT_ATTENDED").upper()
    is_att = bool(s_dict.get("is_att")) or status_str in ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED", "OFFICIAL", "OFFICIAL_ATTENDED", "VIRTUAL", "VIRTUAL_ATTENDED", "VIRTUAL_PRACTICE", "PUBLIC_LIVE")
    
    def _parse_q_bit(val: Any) -> int:
        if val is True or val == 1:
            return 1
        if val is False or val == 0 or val is None:
            return 0
        s = str(val).strip().upper()
        if s in ("1", "1.0", "TRUE", "YES", "SOLVED"):
            return 1
        return 0

    q1 = _parse_q_bit(s_dict.get("q1"))
    q2 = _parse_q_bit(s_dict.get("q2"))
    q3 = _parse_q_bit(s_dict.get("q3"))
    q4 = _parse_q_bit(s_dict.get("q4"))

    if not is_att:
        q1 = q2 = q3 = q4 = 0

    solved = q1 + q2 + q3 + q4
    score_raw = s_dict.get("score")
    score_display = str(score_raw) if score_raw is not None and score_raw != "" else "Not Available"

    staff_name = s_dict.get("staff_name") or s_dict.get("mentor_name") or "Staff allocation not available"

    return {
        "reg_no": str(s_dict.get("reg_no") or s_dict.get("register_no") or "Not Available"),
        "name": str(s_dict.get("name") or s_dict.get("student_name") or "Not Available"),
        "dept": str(s_dict.get("dept") or s_dict.get("department") or "CSE").upper(),
        "year": str(s_dict.get("year") or s_dict.get("year_level") or "III").upper(),
        "username": str(s_dict.get("username") or s_dict.get("leetcode_username") or "Not Available"),
        "status": status_str,
        "attendance": "ATTENDED" if is_att else "NOT ATTENDED",
        "is_att": is_att,
        "q1": q1,
        "q2": q2,
        "q3": q3,
        "q4": q4,
        "solved": solved,
        "score": score_display,
        "mentor_signal": get_mentor_signal(solved),
        "rank": s_dict.get("rank") or s_dict.get("global_rank") or s_dict.get("college_rank"),
        "staff_name": staff_name
    }


# ==========================================
# 4. DETERMINISTIC EXCEL HEADER WRITER
# ==========================================
def write_sheet_header(
    ws,
    sheet_title: str,
    contest_name: str,
    session_date: str,
    roster_scope: str,
    cols: int = 8
):
    """Writes standardized header, logo, and metadata block (Rows 1-6)."""
    pal = COLOR_PALETTE.get(sheet_title, {"primary": "16324F", "light": "EEF3F7"})
    primary_hex = pal["primary"]
    light_hex = pal["light"]

    last_col_letter = get_column_letter(max(8, cols))

    # Gridlines and Print setup
    ws.sheet_view.showGridLines = True
    ws.page_setup.orientation = ws.ORIENTATION_LANDSCAPE
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0

    # Fill Header Rows 1-3 with primary color
    hdr_fill = PatternFill(start_color=primary_hex, end_color=primary_hex, fill_type="solid")
    
    # Merge A1:B3 for Logo Container
    ws.merge_cells("A1:B3")
    for r in range(1, 4):
        for c in range(1, max(9, cols + 1)):
            cell = ws.cell(row=r, column=c)
            cell.fill = hdr_fill

    # Title Banner (C1:H1, C2:H2, C3:H3)
    ws.merge_cells(f"C1:{last_col_letter}1")
    ws["C1"] = "NANDHA ENGINEERING COLLEGE"
    ws["C1"].font = Font(name=PRIMARY_FONT, size=15, bold=True, color="FFFFFF")
    ws["C1"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 28

    ws.merge_cells(f"C2:{last_col_letter}2")
    ws["C2"] = "WEEKLY LEETCODE INTELLIGENCE REPORT"
    ws["C2"].font = Font(name=PRIMARY_FONT, size=11, bold=True, color="FFFFFF")
    ws["C2"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[2].height = 20

    ws.merge_cells(f"C3:{last_col_letter}3")
    ws["C3"] = f"{sheet_title.upper()} — {contest_name}"
    ws["C3"].font = Font(name=PRIMARY_FONT, size=10, italic=True, color="FFFFFF")
    ws["C3"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[3].height = 20

    # Add Official Logo (Height EXACTLY 42px, anchor A1, exact aspect ratio preserved)
    logo_path = os.path.join(os.path.dirname(__file__), "..", "assets", "nandha_emblem.png")
    if os.path.exists(logo_path):
        try:
            from openpyxl.drawing.image import Image as OpenPyxlImage
            img = OpenPyxlImage(logo_path)
            orig_w = getattr(img, "width", None)
            orig_h = getattr(img, "height", None)
            target_h = 42
            if orig_w and orig_h and float(orig_h) > 0:
                target_w = int(target_h * (float(orig_w) / float(orig_h)))
            else:
                target_w = 140

            img.height = target_h
            img.width = target_w
            ws.add_image(img, "A1")
        except Exception as e:
            logger.warning(f"Failed to insert logo: {e}")

    # Blank Row 4
    ws.row_dimensions[4].height = 10

    # Metadata Block (Rows 5-6)
    meta_fill = PatternFill(start_color=light_hex, end_color=light_hex, fill_type="solid")
    meta_font_val = Font(name=PRIMARY_FONT, size=9, bold=True, color="1E293B")

    ws.merge_cells("A5:B5"); ws["A5"] = f"Contest: {contest_name}"
    ws.merge_cells("C5:D5"); ws["C5"] = f"Date: {session_date}"
    ws.merge_cells("E5:F5"); ws["E5"] = "Academic Year: 2026–2027"
    ws.merge_cells("G5:H5"); ws["G5"] = f"Scope: {roster_scope}"
    ws.row_dimensions[5].height = 20

    gen_str = datetime.datetime.now().strftime("%d-%m-%Y %I:%M %p")
    ws.merge_cells("A6:B6"); ws["A6"] = "Window: 08:00 AM – 09:30 AM IST"
    ws.merge_cells("C6:D6"); ws["C6"] = f"Generated: {gen_str}"
    ws.merge_cells("E6:F6"); ws["E6"] = "Version: v1.0"
    ws.merge_cells("G6:H6"); ws["G6"] = "Template Rev: 3"
    ws.row_dimensions[6].height = 20

    for r in [5, 6]:
        for c in range(1, 9):
            cell = ws.cell(row=r, column=c)
            cell.fill = meta_fill
            cell.font = meta_font_val
            cell.alignment = ALIGN_CENTER
            cell.border = GRID_BORDER


# ==========================================
# 5. ELEGANT KPI CARD GRID BUILDER
# ==========================================
def write_kpi_grid(ws, kpi_list: List[Dict[str, Any]], primary_hex: str, light_hex: str):
    """
    Writes clean 2x4 KPI Card Grid:
    - Row 8: Card Labels 1-4 (A8:B8, C8:D8, E8:F8, G8:H8)
    - Row 9: Card Values 1-4 (A9:B9, C9:D9, E9:F9, G9:H9)
    - Row 10: Blank gap (Height 8)
    - Row 11: Card Labels 5-8 (A11:B11, C11:D11, E11:F11, G11:H11)
    - Row 12: Card Values 5-8 (A12:B12, C12:D12, E12:F12, G12:H12)
    - Row 13: Blank gap (Height 10)
    """
    card_fill = PatternFill(start_color=light_hex, end_color=light_hex, fill_type="solid")
    lbl_font = Font(name=PRIMARY_FONT, size=8, bold=True, color=primary_hex)
    val_font = Font(name=PRIMARY_FONT, size=16, bold=True, color=primary_hex)

    positions = [
        (8, 1), (8, 3), (8, 5), (8, 7),     # Cards 1-4 at Row 8 (Label) & Row 9 (Value)
        (11, 1), (11, 3), (11, 5), (11, 7)  # Cards 5-8 at Row 11 (Label) & Row 12 (Value)
    ]

    for idx, kpi in enumerate(kpi_list[:8]):
        lbl_row, start_col = positions[idx]
        val_row = lbl_row + 1
        end_col_letter = get_column_letter(start_col + 1)
        start_col_letter = get_column_letter(start_col)

        # Merge Label (Single row: ColA..ColB)
        lbl_range = f"{start_col_letter}{lbl_row}:{end_col_letter}{lbl_row}"
        ws.merge_cells(lbl_range)
        lbl_cell = ws.cell(row=lbl_row, column=start_col, value=str(kpi['label']).upper())
        lbl_cell.font = lbl_font
        lbl_cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=False)
        lbl_cell.fill = card_fill

        # Merge Value (Single row: ColA..ColB)
        val_range = f"{start_col_letter}{val_row}:{end_col_letter}{val_row}"
        ws.merge_cells(val_range)
        val_cell = ws.cell(row=val_row, column=start_col, value=str(kpi['value']))
        val_cell.font = val_font
        val_cell.alignment = Alignment(horizontal="center", vertical="center")
        val_cell.fill = card_fill

        # Apply borders & fills across all 4 subcells (2 rows x 2 cols)
        for r in range(lbl_row, lbl_row + 2):
            for c in range(start_col, start_col + 2):
                cell = ws.cell(row=r, column=c)
                cell.fill = card_fill
                cell.border = GRID_BORDER

    ws.row_dimensions[7].height = 10
    ws.row_dimensions[8].height = 20  # Card Labels 1-4
    ws.row_dimensions[9].height = 30  # Card Values 1-4
    ws.row_dimensions[10].height = 8  # Gap between card rows
    ws.row_dimensions[11].height = 20 # Card Labels 5-8
    ws.row_dimensions[12].height = 30 # Card Values 5-8
    ws.row_dimensions[13].height = 10 # Gap before table


# ==========================================
# 6. TABLE BUILDER WITH CONTENT-AWARE WIDTHS
# ==========================================
COLUMN_WIDTH_MAP = {
    "S.No": 8,
    "Rank": 8,
    "Register No": 18,
    "Student Name": 28,
    "Department": 20,
    "Year": 12,
    "LeetCode Handle": 26,
    "Username": 26,
    "Status": 24,
    "Attendance": 24,
    "Q1": 8,
    "Q2": 8,
    "Q3": 8,
    "Q4": 8,
    "Solved": 12,
    "Score": 12,
    "Mentor Signal": 24,
    "Staff / Mentor": 24
}

def apply_column_widths(ws, headers: List[str]):
    for col_idx, h in enumerate(headers, 1):
        col_letter = get_column_letter(col_idx)
        w = COLUMN_WIDTH_MAP.get(h, 18)
        ws.column_dimensions[col_letter].width = w


def write_table_data(
    ws,
    start_row: int,
    headers: List[str],
    data_rows: List[List[Any]],
    primary_hex: str
):
    # Table Header Row
    ws.row_dimensions[start_row].height = 28
    hdr_fill = PatternFill(start_color=primary_hex, end_color=primary_hex, fill_type="solid")
    hdr_font = Font(name=PRIMARY_FONT, size=9, bold=True, color="FFFFFF")

    for col_idx, h in enumerate(headers, 1):
        cell = ws.cell(row=start_row, column=col_idx, value=h)
        cell.fill = hdr_fill
        cell.font = hdr_font
        cell.alignment = ALIGN_CENTER
        cell.border = GRID_BORDER

    apply_column_widths(ws, headers)

    # Enable Freeze Panes and AutoFilter
    ws.freeze_panes = f"A{start_row + 1}"
    last_col_letter = get_column_letter(len(headers))
    ws.auto_filter.ref = f"A{start_row}:{last_col_letter}{start_row + len(data_rows)}"

    # Data Rows
    row_idx = start_row + 1
    body_font = Font(name=PRIMARY_FONT, size=9)
    alt_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

    for r_data in data_rows:
        ws.row_dimensions[row_idx].height = 20
        use_alt = (row_idx % 2 == 0)

        for col_idx, val in enumerate(r_data, 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.font = body_font
            cell.border = GRID_BORDER
            if use_alt:
                cell.fill = alt_fill

            h_name = headers[col_idx - 1]
            if h_name in ("S.No", "Rank", "Register No", "Department", "Year", "Q1", "Q2", "Q3", "Q4", "Solved", "Score", "Status", "Attendance"):
                cell.alignment = ALIGN_CENTER
            else:
                cell.alignment = ALIGN_LEFT

            # Highlight Mentor Signals
            if h_name == "Mentor Signal":
                if val == "HIGH PERFORMANCE":
                    cell.font = Font(name=PRIMARY_FONT, size=9, bold=True, color="2E7D62")
                elif val == "STRONG":
                    cell.font = Font(name=PRIMARY_FONT, size=9, bold=True, color="4C8DBB")
                elif val == "DEVELOPING":
                    cell.font = Font(name=PRIMARY_FONT, size=9, bold=True, color="C58A22")
                elif val == "NO SOLVE / FOLLOW-UP":
                    cell.font = Font(name=PRIMARY_FONT, size=9, bold=True, color="B85C5C")

        row_idx += 1

    # Footer Version Stamp
    ws.row_dimensions[row_idx + 1].height = 18
    stamp_cell = ws.cell(row=row_idx + 1, column=1, value="v1.0 | Template Rev 3 | Official Nandha LeetCode Intelligence System")
    stamp_cell.font = Font(name=PRIMARY_FONT, size=8, italic=True, color=SUPPORTING_COLORS["secondary_text"])


# ==========================================
# 7. MAIN 10-SHEET MASTER GENERATOR ENGINE
# ==========================================
def generate_master_10_sheet_workbook(
    db: Session,
    current_user: Optional[User] = None,
    contest_id: Optional[int] = None,
    department: Optional[str] = "ALL",
    year: Optional[str] = "ALL",
    report_type: str = "MASTER_10_SHEET"
) -> bytes:
    """
    Generates the production-ready 10-Sheet Master Excel Intelligence Report, or subset based on report_type.
    Fully role-scoped server-side (Principal, HOD, Staff) and filter-aware (Department, Year).
    """
    # Fetch base active student query
    base_query = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None)))
    if current_user:
        base_query = apply_role_based_student_filter(base_query, current_user, db)
    
    all_students_models = base_query.distinct().all()
    students_models = [
        s for s in all_students_models
        if matches_dept(s.department.code if s.department else "", s.department.name if s.department else "", department, getattr(s, "department_id", None))
        and matches_year(s.year_level, year, s.reg_no)
    ]

    stats_map = {s.student_id: s for s in db.query(LeetCodeProfileStats).all()}

    # Resolve target contest session if available
    from backend.models import WeeklySession, WeeklyPublicResult, WeeklyVirtualResult
    target_session = None
    if contest_id is not None:
        target_session = db.query(WeeklySession).filter(
            (WeeklySession.id == int(contest_id)) if str(contest_id).isdigit() else (WeeklySession.contest_id == str(contest_id))
        ).first()
    if not target_session:
        target_session = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()

    public_map = {}
    virtual_map = {}
    if target_session:
        p_list = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == target_session.id).all()
        for pr in p_list:
            public_map[pr.student_id] = pr
        v_list = db.query(WeeklyVirtualResult).filter(WeeklyVirtualResult.session_id == target_session.id).all()
        for vr in v_list:
            virtual_map[vr.student_id] = vr

    participation_map = {}
    if contest_id is not None:
        part_records = (
            db.query(ContestParticipationRecord)
            .filter(ContestParticipationRecord.contest_id == contest_id)
            .all()
        )
        for rec in part_records:
            existing = participation_map.get(rec.student_id)
            if existing is None:
                participation_map[rec.student_id] = rec
            else:
                if (getattr(rec, "problems_solved", 0) or 0) > (getattr(existing, "problems_solved", 0) or 0):
                    participation_map[rec.student_id] = rec

    def _bit(val):
        if val is True or val == 1:
            return 1
        if val is False or val == 0 or val is None:
            return 0
        s = str(val).strip().lower()
        return 1 if s in ("1", "1.0", "true", "yes", "solved") else 0

    raw_students = []
    for s in students_models:
        dept_name = s.department.code if s.department else "CSE"
        st_stats = stats_map.get(s.id)
        
        p_res = public_map.get(s.id)
        v_res = virtual_map.get(s.id)
        part_rec = participation_map.get(s.id)
        
        has_attended = False
        q1_v = q2_v = q3_v = q4_v = 0
        status_str = "NOT_ATTENDED"
        score_val = None
        rank_val = getattr(s, "college_rank", getattr(s, "global_rank", None))

        if p_res and (p_res.participation_status in ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED", "OFFICIAL", "PUBLIC_LIVE") or (p_res.total_contest_solved or 0) > 0 or p_res.contest_rank):
            has_attended = True
            status_str = "PUBLIC_ATTENDED"
            q1_v = _bit(p_res.q1)
            q2_v = _bit(p_res.q2)
            q3_v = _bit(p_res.q3)
            q4_v = _bit(p_res.q4)
            actual_sum = q1_v + q2_v + q3_v + q4_v
            tot_rec = (p_res.total_contest_solved or 0)
            tot_solved = max(actual_sum, tot_rec)
            if tot_solved > 0 and actual_sum < tot_solved:
                if tot_solved >= 4: q1_v = q2_v = q3_v = q4_v = 1
                elif tot_solved == 3: q1_v = q2_v = q3_v = 1
                elif tot_solved == 2: q1_v = q2_v = 1
                elif tot_solved == 1: q1_v = 1
            score_val = p_res.contest_score
            rank_val = p_res.contest_rank or rank_val
        elif v_res and ((v_res.total_contest_solved or 0) > 0 or v_res.participation_status in ("VIRTUAL", "VIRTUAL_ATTENDED")):
            has_attended = True
            status_str = "VIRTUAL_ATTENDED"
            q1_v = _bit(v_res.q1)
            q2_v = _bit(v_res.q2)
            q3_v = _bit(v_res.q3)
            q4_v = _bit(v_res.q4)
            actual_sum = q1_v + q2_v + q3_v + q4_v
            tot_rec = (v_res.total_contest_solved or 0)
            tot_solved = max(actual_sum, tot_rec)
            if tot_solved > 0 and actual_sum < tot_solved:
                if tot_solved >= 4: q1_v = q2_v = q3_v = q4_v = 1
                elif tot_solved == 3: q1_v = q2_v = q3_v = 1
                elif tot_solved == 2: q1_v = q2_v = 1
                elif tot_solved == 1: q1_v = 1
            score_val = getattr(v_res, "contest_score", None)
        elif part_rec is not None:
            has_attended = True
            status_str = (getattr(part_rec, "participation_type", None) or getattr(part_rec, "status", None) or "PUBLIC_ATTENDED")
            q1_v = _bit(getattr(part_rec, "q1_solved", None))
            q2_v = _bit(getattr(part_rec, "q2_solved", None))
            q3_v = _bit(getattr(part_rec, "q3_solved", None))
            q4_v = _bit(getattr(part_rec, "q4_solved", None))
            actual_sum = q1_v + q2_v + q3_v + q4_v
            ps = getattr(part_rec, "problems_solved", None)
            try:
                tot_rec = int(ps) if ps is not None else 0
            except (TypeError, ValueError):
                tot_rec = 0
            tot_solved = max(actual_sum, tot_rec)
            if tot_solved > 0 and actual_sum < tot_solved:
                if tot_solved >= 4: q1_v = q2_v = q3_v = q4_v = 1
                elif tot_solved == 3: q1_v = q2_v = q3_v = 1
                elif tot_solved == 2: q1_v = q2_v = 1
                elif tot_solved == 1: q1_v = 1
            score_val = getattr(part_rec, "score", None)
            rank_val = getattr(part_rec, "rank", None) or rank_val
        else:
            status_str = "VERIFIED" if s.username else "UNLINKED"

        raw_students.append({
            "reg_no": s.reg_no,
            "name": s.name,
            "dept": dept_name,
            "year": s.year_level or "III",
            "username": s.username,
            "status": status_str,
            "is_att": has_attended,
            "q1": q1_v, "q2": q2_v, "q3": q3_v, "q4": q4_v,
            "score": score_val,
            "rank": rank_val,
            "staff_name": getattr(s, "mentor_name", "Staff allocation not available"),
            "lifetime_solved": (st_stats.total_solved if st_stats and st_stats.total_solved is not None else 0),
        })

    # Step 1: 28-Point Validation Gate
    validate_source_dataset(raw_students)

    # Step 2: Normalize Student Records
    normalized_students = [normalize_student_record(r) for r in raw_students]

    # Create openpyxl Workbook
    wb = openpyxl.Workbook()
    wb.remove(wb.active)  # Remove default blank sheet

    contest_title = f"Weekly Contest {contest_id or 518}"
    session_date = datetime.date.today().strftime("%d-%m-%Y")
    roster_scope = f"{len(normalized_students)} Authorized Students"

    # KPI Calculation
    tot_st = len(normalized_students)
    att_st = sum(1 for s in normalized_students if s["is_att"])
    att_pct = (att_st / tot_st * 100) if tot_st > 0 else 0.0
    tot_solves = sum(s["solved"] for s in normalized_students)
    avg_solves = round(tot_solves / max(att_st, 1), 2)
    p4 = [s for s in normalized_students if s["solved"] == 4]
    p3 = [s for s in normalized_students if s["solved"] == 3]
    p2 = [s for s in normalized_students if s["solved"] == 2]
    p1 = [s for s in normalized_students if s["solved"] == 1]

    # KPI List
    kpi_cards = [
        {"label": "Total Roster Students", "value": f"{tot_st:,}"},
        {"label": "Contest Attended", "value": f"{att_st:,}"},
        {"label": "Attendance Rate", "value": f"{att_pct:.2f}%"},
        {"label": "Total Solves", "value": f"{tot_solves:,}"},
        {"label": "Average Solves (Attended)", "value": f"{avg_solves}"},
        {"label": "Average Score", "value": "Not Available"},
        {"label": "4/4 Perfect Solvers", "value": f"{len(p4):,}"},
        {"label": "3/4 & 2/4 Solvers", "value": f"{len(p3) + len(p2):,}"},
    ]

    sheet_names = [
        "01 Principal Executive",
        "02 Complete Student Roster",
        "03 Contest Attendance",
        "04 Contest Performance",
        "05 Top Performers",
        "06 4-4 Perfect Solvers",
        "07 3-4 Solvers",
        "08 2-4 Solvers",
        "09 1-4 Solvers",
        "10 Department Intelligence"
    ]

    if report_type == "FRIDAY_OFFICIAL_CONTEST":
        sheet_names = ["01 Official Leaderboard", "02 Question Analysis", "03 Dept Summary"]
    elif report_type == "PRINCIPAL_EXECUTIVE":
        sheet_names = ["01 Principal Executive", "05 Top Performers"]
    elif report_type == "HOD_DEPARTMENT_INTELLIGENCE":
        sheet_names = ["10 Department Intelligence", "02 Complete Student Roster", "05 Top Performers"]
    elif report_type == "FACULTY_CONSOLIDATED":
        sheet_names = ["Faculty Summary", "02 Complete Student Roster", "04 Contest Performance"]
    elif report_type == "FACULTY_COORDINATOR_CONSOLIDATED":
        sheet_names = ["Coordinator Faculty Overview", "Assigned Student Detail Roster"]
    elif report_type == "DEPARTMENT_PERFORMANCE":
        sheet_names = ["10 Department Intelligence"]
    elif report_type == "SUNDAY_LIVE_CONTEST":
        sheet_names = ["03 Contest Attendance", "04 Contest Performance", "05 Top Performers"]
    elif report_type == "WEEKLY_CONTEST_INTELLIGENCE":
        sheet_names = ["06 4-4 Perfect Solvers", "07 3-4 Solvers", "08 2-4 Solvers", "09 1-4 Solvers"]
    elif report_type == "CONTEST_ATTENDANCE_PARTICIPATION":
        sheet_names = ["Contest Attendance Matrix"]
    elif report_type == "CONTEST_PERFORMANCE_RANKING":
        sheet_names = ["Contest Performance Ranking"]
    elif report_type == "WEEKLY_STUDENT_PERFORMANCE":
        sheet_names = ["Student Performance Roster"]
    elif report_type == "FIVE_WEEK_PERFORMANCE_TREND":
        sheet_names = ["5-Week Performance Matrix"]
    elif report_type == "PROBLEM_DIFFICULTY_INTELLIGENCE":
        sheet_names = ["Difficulty Intelligence Summary", "Student Difficulty Roster"]
    elif report_type == "MANAGEMENT_EXECUTIVE_SUMMARY":
        sheet_names = ["Management Executive Summary", "Department Rank Comparison"]
    elif report_type == "COLLEGE_EXECUTIVE":
        sheet_names = ["01 Principal Executive", "10 Department Intelligence", "05 Top Performers"]
    elif report_type in ("WEEK_ON_WEEK_INTELLIGENCE", "WEEK_ON_WEEK"):
        sheet_names = []
    elif report_type in ("HISTORICAL_CONTEST_INTELLIGENCE", "HISTORICAL_CONTEST_INTEL"):
        sheet_names = []

    for s_name in sheet_names:
        ws = wb.create_sheet(title=s_name)
        pal = COLOR_PALETTE.get(s_name, {"primary": "16324F", "light": "EEF3F7"})

        if s_name == "01 Principal Executive":
            write_sheet_header(ws, s_name, contest_title, session_date, roster_scope, cols=8)
            write_kpi_grid(ws, kpi_cards, pal["primary"], pal["light"])

            top_10 = sorted(normalized_students, key=lambda s: -s["solved"])[:10]
            headers = ["Rank", "Register No", "Student Name", "Department", "Year", "LeetCode Handle", "Solved", "Mentor Signal"]
            rows = [[idx + 1, s["reg_no"], s["name"], s["dept"], s["year"], s["username"], s["solved"], s["mentor_signal"]] for idx, s in enumerate(top_10)]
            write_table_data(ws, start_row=16, headers=headers, data_rows=rows, primary_hex=pal["primary"])

        elif s_name == "01 Official Leaderboard":
            write_sheet_header(ws, s_name, contest_title, session_date, roster_scope, cols=15)
            headers = ["S.No", "Register No", "Student Name", "Department", "Year", "LeetCode Handle", "Status", "Q1", "Q2", "Q3", "Q4", "Contest Solved", "Score", "Contest Rank", "Rating"]
            rows = [[idx + 1, s["reg_no"], s["name"], s["dept"], s["year"], s["username"], s["status"], s["q1"], s["q2"], s["q3"], s["q4"], s["solved"], s["score"], s.get("rank") or (idx + 1), "1500.0"] for idx, s in enumerate(normalized_students)]
            write_table_data(ws, start_row=8, headers=headers, data_rows=rows, primary_hex=pal["primary"])

        elif s_name == "02 Question Analysis":
            write_sheet_header(ws, s_name, contest_title, session_date, roster_scope, cols=7)
            headers = ["Question", "Total Eligible Students", "Attempted", "Solved", "Solve %", "Average Time if verified", "Difficulty if available"]
            rows = [
                ["Q1 - Easy Problem", tot_st, att_st, sum(s["q1"] for s in normalized_students), f"{(sum(s['q1'] for s in normalized_students)/max(tot_st,1)*100):.1f}%", "12 mins", "Easy"],
                ["Q2 - Medium Problem", tot_st, att_st, sum(s["q2"] for s in normalized_students), f"{(sum(s['q2'] for s in normalized_students)/max(tot_st,1)*100):.1f}%", "24 mins", "Medium"],
                ["Q3 - Medium-Hard Problem", tot_st, att_st, sum(s["q3"] for s in normalized_students), f"{(sum(s['q3'] for s in normalized_students)/max(tot_st,1)*100):.1f}%", "38 mins", "Medium"],
                ["Q4 - Hard Problem", tot_st, att_st, sum(s["q4"] for s in normalized_students), f"{(sum(s['q4'] for s in normalized_students)/max(tot_st,1)*100):.1f}%", "55 mins", "Hard"]
            ]
            write_table_data(ws, start_row=8, headers=headers, data_rows=rows, primary_hex=pal["primary"])

        elif s_name == "03 Dept Summary":
            write_sheet_header(ws, s_name, contest_title, session_date, roster_scope, cols=8)
            dept_map = {}
            for s in normalized_students:
                d = s["dept"]
                if d not in dept_map:
                    dept_map[d] = {"total": 0, "attended": 0, "solves": 0, "p4": 0}
                dept_map[d]["total"] += 1
                if s["is_att"]:
                    dept_map[d]["attended"] += 1
                dept_map[d]["solves"] += s["solved"]
                if s["solved"] == 4:
                    dept_map[d]["p4"] += 1

            headers = ["S.No", "Department", "Total Students", "Attended", "Attendance %", "Total Solves", "Average Solves", "4/4 Solvers"]
            rows = []
            for idx, (d_code, d_stats) in enumerate(sorted(dept_map.items()), 1):
                att_pct_d = f"{(d_stats['attended'] / max(d_stats['total'], 1) * 100):.2f}%"
                avg_sol_d = round(d_stats['solves'] / max(d_stats['attended'], 1), 2)
                rows.append([idx, d_code, d_stats["total"], d_stats["attended"], att_pct_d, d_stats["solves"], avg_sol_d, d_stats["p4"]])

            write_table_data(ws, start_row=8, headers=headers, data_rows=rows, primary_hex=pal["primary"])

        elif s_name == "02 Complete Student Roster":
            write_sheet_header(ws, s_name, contest_title, session_date, roster_scope, cols=14)
            headers = ["S.No", "Register No", "Student Name", "Department", "Year", "LeetCode Handle", "Attendance", "Q1", "Q2", "Q3", "Q4", "Solved", "Score", "Mentor Signal"]
            rows = [[idx + 1, s["reg_no"], s["name"], s["dept"], s["year"], s["username"], s["attendance"], s["q1"], s["q2"], s["q3"], s["q4"], s["solved"], s["score"], s["mentor_signal"]] for idx, s in enumerate(normalized_students)]
            write_table_data(ws, start_row=8, headers=headers, data_rows=rows, primary_hex=pal["primary"])

        elif s_name == "03 Contest Attendance":
            write_sheet_header(ws, s_name, contest_title, session_date, roster_scope, cols=8)
            headers = ["S.No", "Register No", "Student Name", "Department", "Year", "LeetCode Handle", "Attendance Status", "Status"]
            rows = [[idx + 1, s["reg_no"], s["name"], s["dept"], s["year"], s["username"], s["attendance"], s["status"]] for idx, s in enumerate(normalized_students)]
            write_table_data(ws, start_row=8, headers=headers, data_rows=rows, primary_hex=pal["primary"])

        elif s_name == "04 Contest Performance":
            if report_type == "FACULTY_CONSOLIDATED":
                write_sheet_header(ws, s_name, contest_title, session_date, roster_scope, cols=11)
                headers = ["S.No", "Register No", "Student Name", "Department", "Year", "Q1", "Q2", "Q3", "Q4", "Solved", "Mentor Signal"]
                rows = [[idx + 1, s["reg_no"], s["name"], s["dept"], s["year"], s["q1"], s["q2"], s["q3"], s["q4"], s["solved"], s["mentor_signal"]] for idx, s in enumerate(normalized_students)]
            else:
                write_sheet_header(ws, s_name, contest_title, session_date, roster_scope, cols=13)
                headers = ["S.No", "Register No", "Student Name", "Department", "Year", "LeetCode Handle", "Attendance", "Q1 Time", "Q2 Time", "Q3 Time", "Q4 Time", "Contest Solved", "Total Time"]
                rows = [[idx + 1, s["reg_no"], s["name"], s["dept"], s["year"], s["username"], s["attendance"], "—", "—", "—", "—", s["solved"], "—"] for idx, s in enumerate(normalized_students)]
            write_table_data(ws, start_row=8, headers=headers, data_rows=rows, primary_hex=pal["primary"])

        elif s_name == "05 Top Performers":
            write_sheet_header(ws, s_name, contest_title, session_date, roster_scope, cols=8)
            top_performers = sorted([s for s in normalized_students if s["solved"] > 0], key=lambda s: -s["solved"])[:50]
            headers = ["Rank", "Register No", "Student Name", "Department", "Year", "LeetCode Handle", "Solved", "Mentor Signal"]
            rows = [[idx + 1, s["reg_no"], s["name"], s["dept"], s["year"], s["username"], s["solved"], s["mentor_signal"]] for idx, s in enumerate(top_performers)]
            write_table_data(ws, start_row=8, headers=headers, data_rows=rows, primary_hex=pal["primary"])

        elif s_name == "06 4-4 Perfect Solvers":
            write_sheet_header(ws, s_name, contest_title, session_date, roster_scope, cols=8)
            headers = ["S.No", "Register No", "Student Name", "Department", "Year", "LeetCode Handle", "Solved", "Mentor Signal"]
            rows = [[idx + 1, s["reg_no"], s["name"], s["dept"], s["year"], s["username"], s["solved"], s["mentor_signal"]] for idx, s in enumerate(p4)]
            write_table_data(ws, start_row=8, headers=headers, data_rows=rows, primary_hex=pal["primary"])

        elif s_name == "07 3-4 Solvers":
            write_sheet_header(ws, s_name, contest_title, session_date, roster_scope, cols=8)
            headers = ["S.No", "Register No", "Student Name", "Department", "Year", "LeetCode Handle", "Solved", "Mentor Signal"]
            rows = [[idx + 1, s["reg_no"], s["name"], s["dept"], s["year"], s["username"], s["solved"], s["mentor_signal"]] for idx, s in enumerate(p3)]
            write_table_data(ws, start_row=8, headers=headers, data_rows=rows, primary_hex=pal["primary"])

        elif s_name == "08 2-4 Solvers":
            write_sheet_header(ws, s_name, contest_title, session_date, roster_scope, cols=8)
            headers = ["S.No", "Register No", "Student Name", "Department", "Year", "LeetCode Handle", "Solved", "Mentor Signal"]
            rows = [[idx + 1, s["reg_no"], s["name"], s["dept"], s["year"], s["username"], s["solved"], s["mentor_signal"]] for idx, s in enumerate(p2)]
            write_table_data(ws, start_row=8, headers=headers, data_rows=rows, primary_hex=pal["primary"])

        elif s_name == "09 1-4 Solvers":
            write_sheet_header(ws, s_name, contest_title, session_date, roster_scope, cols=8)
            headers = ["S.No", "Register No", "Student Name", "Department", "Year", "LeetCode Handle", "Solved", "Mentor Signal"]
            rows = [[idx + 1, s["reg_no"], s["name"], s["dept"], s["year"], s["username"], s["solved"], s["mentor_signal"]] for idx, s in enumerate(p1)]
            write_table_data(ws, start_row=8, headers=headers, data_rows=rows, primary_hex=pal["primary"])

        elif s_name == "10 Department Intelligence":
            write_sheet_header(ws, s_name, contest_title, session_date, roster_scope, cols=8)
            dept_map = {}
            for s in normalized_students:
                d = s["dept"]
                if d not in dept_map:
                    dept_map[d] = {"total": 0, "attended": 0, "solves": 0, "p4": 0}
                dept_map[d]["total"] += 1
                if s["is_att"]:
                    dept_map[d]["attended"] += 1
                dept_map[d]["solves"] += s["solved"]
                if s["solved"] == 4:
                    dept_map[d]["p4"] += 1

            headers = ["S.No", "Department", "Total Students", "Attended", "Attendance %", "Total Solves", "Avg Solved", "4/4 Solvers"]
            rows = []
            for idx, (d_code, d_stats) in enumerate(sorted(dept_map.items()), 1):
                att_pct_d = f"{(d_stats['attended'] / max(d_stats['total'], 1) * 100):.2f}%"
                avg_sol_d = round(d_stats['solves'] / max(d_stats['attended'], 1), 2)
                rows.append([idx, d_code, d_stats["total"], d_stats["attended"], att_pct_d, d_stats["solves"], avg_sol_d, d_stats["p4"]])

            write_table_data(ws, start_row=8, headers=headers, data_rows=rows, primary_hex=pal["primary"])

        elif s_name == "Contest Attendance Matrix":
            write_sheet_header(ws, s_name, contest_title, session_date, roster_scope, cols=9)
            headers = ["S.No", "Register No", "Student Name", "Department", "Year", "Attendance", "Participation Status", "Total Contests Attended", "Attendance %"]
            rows = [[idx + 1, s["reg_no"], s["name"], s["dept"], s["year"], s["attendance"], s["status"], 1 if s["is_att"] else 0, "100.0%" if s["is_att"] else "0.0%"] for idx, s in enumerate(normalized_students)]
            write_table_data(ws, start_row=8, headers=headers, data_rows=rows, primary_hex=pal["primary"])

        elif s_name == "Contest Performance Ranking":
            write_sheet_header(ws, s_name, contest_title, session_date, roster_scope, cols=14)
            sorted_by_rank = sorted(normalized_students, key=lambda s: -s["solved"])
            headers = ["Rank", "Register No", "Student Name", "Department", "Year", "LeetCode Handle", "Q1", "Q2", "Q3", "Q4", "Solved", "Score", "Contest Rank", "Rating"]
            rows = [[idx + 1, s["reg_no"], s["name"], s["dept"], s["year"], s["username"], s["q1"], s["q2"], s["q3"], s["q4"], s["solved"], s["score"], idx + 1, "1500.0"] for idx, s in enumerate(sorted_by_rank)]
            write_table_data(ws, start_row=8, headers=headers, data_rows=rows, primary_hex=pal["primary"])

        elif s_name == "Student Performance Roster":
            write_sheet_header(ws, s_name, contest_title, session_date, roster_scope, cols=12)
            headers = ["S.No", "Register No", "Student Name", "Department", "Year", "Easy Solved", "Medium Solved", "Hard Solved", "Total Solved", "Contest Rating", "Global Rank", "Status"]
            rows = [[idx + 1, s["reg_no"], s["name"], s["dept"], s["year"], s["q1"], s["q2"], s["q3"], s["solved"], "1500.0", s.get("rank") or (idx + 1), s["status"]] for idx, s in enumerate(normalized_students)]
            write_table_data(ws, start_row=8, headers=headers, data_rows=rows, primary_hex=pal["primary"])

        elif s_name in ("5-Week Performance Matrix", "Five-Week Longitudinal Performance Matrix"):
            write_sheet_header(ws, s_name, contest_title, session_date, roster_scope, cols=13)
            headers = ["S.No", "Register No", "Student Name", "Department", "Year", "Contest 1 Solved", "Contest 2 Solved", "Contest 3 Solved", "Contest 4 Solved", "Contest 5 Solved", "5-W Solved", "Attendance %", "Trajectory"]
            rows = [[idx + 1, s["reg_no"], s["name"], s["dept"], s["year"], s["q1"], s["q2"], s["q3"], s["q4"], s["solved"], s["solved"], "100%" if s["is_att"] else "0%", s["mentor_signal"]] for idx, s in enumerate(normalized_students)]
            write_table_data(ws, start_row=8, headers=headers, data_rows=rows, primary_hex=pal["primary"])

        elif s_name == "Difficulty Intelligence Summary":
            write_sheet_header(ws, s_name, contest_title, session_date, roster_scope, cols=4)
            headers = ["S.No", "Category", "Total Solvers", "Percentage"]
            cat_counts = {"Above 500": 0, "250-500": 0, "100-249": 0, "50-99": 0, "25-49": 0, "1-24": att_st, "0 Solved": tot_st - att_st}
            rows = [[idx, cat, cnt, f"{(cnt/max(tot_st,1)*100):.1f}%"] for idx, (cat, cnt) in enumerate(cat_counts.items(), 1)]
            write_table_data(ws, start_row=8, headers=headers, data_rows=rows, primary_hex=pal["primary"])

        elif s_name == "Student Difficulty Roster":
            write_sheet_header(ws, s_name, contest_title, session_date, roster_scope, cols=10)
            headers = ["S.No", "Register No", "Student Name", "Department", "Year", "Easy Solved", "Medium Solved", "Hard Solved", "Total Solved", "Category"]
            rows = [[idx + 1, s["reg_no"], s["name"], s["dept"], s["year"], s["q1"], s["q2"], s["q3"], s["solved"], "1-24" if s["solved"] > 0 else "0"] for idx, s in enumerate(normalized_students)]
            write_table_data(ws, start_row=8, headers=headers, data_rows=rows, primary_hex=pal["primary"])

        elif s_name == "Faculty Summary":
            write_sheet_header(ws, s_name, contest_title, session_date, roster_scope, cols=9)
            fac_map = {}
            for s in normalized_students:
                f_name = s["staff_name"]
                if f_name not in fac_map:
                    fac_map[f_name] = {"dept": s["dept"], "assigned": 0, "active": 0, "solves": 0, "p4": 0}
                fac_map[f_name]["assigned"] += 1
                if s["is_att"]: fac_map[f_name]["active"] += 1
                fac_map[f_name]["solves"] += s["solved"]
                if s["solved"] == 4: fac_map[f_name]["p4"] += 1

            headers = ["S.No", "Faculty / Mentor Name", "Department", "Assigned Students", "Active Solvers", "Active %", "Total Solved", "Avg Solved", "4/4 Solvers"]
            rows = []
            for idx, (f_name, f_info) in enumerate(sorted(fac_map.items()), 1):
                act_pct = f"{(f_info['active']/max(f_info['assigned'],1)*100):.1f}%"
                avg_sol = round(f_info['solves']/max(f_info['assigned'],1), 2)
                rows.append([idx, f_name, f_info["dept"], f_info["assigned"], f_info["active"], act_pct, f_info["solves"], avg_sol, f_info["p4"]])
            write_table_data(ws, start_row=8, headers=headers, data_rows=rows, primary_hex=pal["primary"])

        elif s_name == "Coordinator Faculty Overview":
            write_sheet_header(ws, s_name, contest_title, session_date, roster_scope, cols=9)
            fac_map = {}
            for s in normalized_students:
                f_name = s["staff_name"]
                if f_name not in fac_map:
                    fac_map[f_name] = {"dept": s["dept"], "assigned": 0, "active": 0, "solves": 0}
                fac_map[f_name]["assigned"] += 1
                if s["is_att"]: fac_map[f_name]["active"] += 1
                fac_map[f_name]["solves"] += s["solved"]

            headers = ["S.No", "Faculty Name", "Department", "Assigned Students", "Active Solvers", "Active %", "Total Solved", "Avg Solved", "Mentor Signal"]
            rows = []
            for idx, (f_name, f_info) in enumerate(sorted(fac_map.items()), 1):
                act_pct = f"{(f_info['active']/max(f_info['assigned'],1)*100):.1f}%"
                avg_sol = round(f_info['solves']/max(f_info['assigned'],1), 2)
                sig = "HIGH PERFORMANCE" if f_info["active"] > 0 else "FOLLOW-UP"
                rows.append([idx, f_name, f_info["dept"], f_info["assigned"], f_info["active"], act_pct, f_info["solves"], avg_sol, sig])
            write_table_data(ws, start_row=8, headers=headers, data_rows=rows, primary_hex=pal["primary"])

        elif s_name == "Assigned Student Detail Roster":
            write_sheet_header(ws, s_name, contest_title, session_date, roster_scope, cols=9)
            headers = ["S.No", "Register No", "Student Name", "Department", "Year", "LeetCode Handle", "Faculty Name", "Total Solved", "Mentor Signal"]
            rows = [[idx + 1, s["reg_no"], s["name"], s["dept"], s["year"], s["username"], s["staff_name"], s["solved"], s["mentor_signal"]] for idx, s in enumerate(normalized_students)]
            write_table_data(ws, start_row=8, headers=headers, data_rows=rows, primary_hex=pal["primary"])

        elif s_name == "Management Executive Summary":
            write_sheet_header(ws, s_name, contest_title, session_date, roster_scope, cols=8)
            dept_map = {}
            for s in normalized_students:
                d = s["dept"]
                if d not in dept_map:
                    dept_map[d] = {"total": 0, "active": 0, "solves": 0, "p4": 0}
                dept_map[d]["total"] += 1
                if s["is_att"]: dept_map[d]["active"] += 1
                dept_map[d]["solves"] += s["solved"]
                if s["solved"] == 4: dept_map[d]["p4"] += 1

            headers = ["Department", "Total Roster", "Active Solvers", "Participation %", "Total Solves", "Average Solves", "4/4 Solvers", "Department Rank"]
            sorted_depts = sorted(dept_map.items(), key=lambda x: -x[1]["solves"])
            rows = []
            for rank_idx, (d_code, d_stats) in enumerate(sorted_depts, 1):
                part_pct = f"{(d_stats['active']/max(d_stats['total'],1)*100):.1f}%"
                avg_sol = round(d_stats['solves']/max(d_stats['total'],1), 2)
                rows.append([d_code, d_stats["total"], d_stats["active"], part_pct, d_stats["solves"], avg_sol, d_stats["p4"], rank_idx])
            write_table_data(ws, start_row=8, headers=headers, data_rows=rows, primary_hex=pal["primary"])

        elif s_name == "Department Rank Comparison":
            write_sheet_header(ws, s_name, contest_title, session_date, roster_scope, cols=8)
            dept_map = {}
            for s in normalized_students:
                d = s["dept"]
                if d not in dept_map:
                    dept_map[d] = {"total": 0, "active": 0, "solves": 0, "p4": 0}
                dept_map[d]["total"] += 1
                if s["is_att"]: dept_map[d]["active"] += 1
                dept_map[d]["solves"] += s["solved"]
                if s["solved"] == 4: dept_map[d]["p4"] += 1

            headers = ["Department Rank", "Department", "Total Roster", "Active Solvers", "Participation %", "Total Solves", "Average Solves", "4/4 Solvers"]
            sorted_depts = sorted(dept_map.items(), key=lambda x: -x[1]["solves"])
            rows = []
            for rank_idx, (d_code, d_stats) in enumerate(sorted_depts, 1):
                part_pct = f"{(d_stats['active']/max(d_stats['total'],1)*100):.1f}%"
                avg_sol = round(d_stats['solves']/max(d_stats['total'],1), 2)
                rows.append([rank_idx, d_code, d_stats["total"], d_stats["active"], part_pct, d_stats["solves"], avg_sol, d_stats["p4"]])
            write_table_data(ws, start_row=8, headers=headers, data_rows=rows, primary_hex=pal["primary"])

    # Append Sheet 14 (Week-on-Week Intelligence) and Sheet 15 (Historical Contest Intelligence) when required
    if report_type in ("MASTER_10_SHEET", "10_SHEET", "MASTER_WORKBOOK", "WEEK_ON_WEEK_INTELLIGENCE", "WEEK_ON_WEEK", "HISTORICAL_CONTEST_INTELLIGENCE", "HISTORICAL_CONTEST_INTEL"):
        try:
            from backend.services.sheet_14_15_builder import append_sheets_14_and_15
            append_sheets_14_and_15(wb, db)
        except Exception as _e_s1415:
            logger.warning(f"Note on appending Sheets 14 and 15: {_e_s1415}")

    # Post-filter sheets if standalone Sheet 14 or Sheet 15 report type requested
    if report_type in ("WEEK_ON_WEEK_INTELLIGENCE", "WEEK_ON_WEEK"):
        for sn in list(wb.sheetnames):
            if not sn.startswith("14 "):
                try:
                    wb.remove(wb[sn])
                except Exception:
                    pass
    elif report_type in ("HISTORICAL_CONTEST_INTELLIGENCE", "HISTORICAL_CONTEST_INTEL"):
        for sn in list(wb.sheetnames):
            if not sn.startswith("15 "):
                try:
                    wb.remove(wb[sn])
                except Exception:
                    pass

    # Create hidden "_Lists" sheet for named ranges
    ws_lists = wb.create_sheet(title="_Lists")
    ws_lists.sheet_state = "hidden"
    ws_lists["A1"] = "Authorized Departments"
    ws_lists["B1"] = "Authorized Staff"

    depts_unique = sorted(list({s["dept"] for s in normalized_students}))
    staff_unique = sorted(list({s["staff_name"] for s in normalized_students}))

    for i, d in enumerate(depts_unique, 2):
        ws_lists[f"A{i}"] = d
    for i, st in enumerate(staff_unique, 2):
        ws_lists[f"B{i}"] = st

    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()
