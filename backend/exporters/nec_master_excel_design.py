"""
nec_master_excel_design.py
Nandha Engineering College — Unified Backend Excel Master Design System

Provides reusable styling, header, logo, metadata, table, and A4 print setup functions
for ALL downloadable .xlsx Excel reports across the institution.

Guarantees 100% visual consistency based on the Faculty Consolidated Performance Report Master Design,
while preserving each report's unique table structure, data, KPIs, formulas, and filter behavior.
"""

import os
import datetime
from zoneinfo import ZoneInfo
from typing import List, Dict, Any, Optional

IST_TZ = ZoneInfo("Asia/Kolkata")
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# ==========================================
# 1. INSTITUTIONAL COLOR & FONT PALETTE
# ==========================================
PRIMARY_FONT = "Times New Roman"

# Colors
NAVY_PRIMARY_HEX = "1B365D"      # Dark Institutional Navy
NAVY_SECONDARY_HEX = "2E5B88"    # Medium Navy Subtitle
LIGHT_BG_HEX = "E6F0FA"          # Light Blue Title & Metadata Strip
ALT_ROW_HEX = "F8FAFC"           # Light Gray Alternate Rows
BORDER_COLOR_HEX = "000000"      # Crisp Black Cell Border

# Fills
FILL_NAVY_PRIMARY = PatternFill(start_color=NAVY_PRIMARY_HEX, end_color=NAVY_PRIMARY_HEX, fill_type="solid")
FILL_NAVY_SECONDARY = PatternFill(start_color=NAVY_SECONDARY_HEX, end_color=NAVY_SECONDARY_HEX, fill_type="solid")
FILL_LIGHT_BG = PatternFill(start_color=LIGHT_BG_HEX, end_color=LIGHT_BG_HEX, fill_type="solid")
FILL_ALT_ROW = PatternFill(start_color=ALT_ROW_HEX, end_color=ALT_ROW_HEX, fill_type="solid")

# Fonts
FONT_COLLEGE_TITLE = Font(name=PRIMARY_FONT, size=16, bold=True, color="FFFFFF")
FONT_SUBTITLE = Font(name=PRIMARY_FONT, size=10, italic=True, color="FFFFFF")
FONT_DEPT_HEADER = Font(name=PRIMARY_FONT, size=11, bold=True, color=NAVY_PRIMARY_HEX)
FONT_REPORT_TITLE = Font(name=PRIMARY_FONT, size=13, bold=True, color=NAVY_PRIMARY_HEX)
FONT_METADATA = Font(name=PRIMARY_FONT, size=9.5, bold=True, color="1E293B")
FONT_TABLE_HEADER = Font(name=PRIMARY_FONT, size=10, bold=True, color="FFFFFF")
FONT_DATA_BODY = Font(name=PRIMARY_FONT, size=9.5)
FONT_DATA_BOLD = Font(name=PRIMARY_FONT, size=9.5, bold=True)
FONT_FOOTER = Font(name=PRIMARY_FONT, size=8.5, italic=True, color="64748B")

# Alignments
ALIGN_CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)
ALIGN_LEFT = Alignment(horizontal="left", vertical="center", wrap_text=True)
ALIGN_RIGHT = Alignment(horizontal="right", vertical="center")

# No-Wrap Alignments for Data Cells (Guarantees values stay on a single line)
ALIGN_CENTER_NOWRAP = Alignment(horizontal="center", vertical="center", wrap_text=False)
ALIGN_LEFT_NOWRAP = Alignment(horizontal="left", vertical="center", wrap_text=False)

# Crisp Thin Black Cell Borders
THIN_BLACK_SIDE = Side(style='thin', color=BORDER_COLOR_HEX)
BORDER_GRID = Border(left=THIN_BLACK_SIDE, right=THIN_BLACK_SIDE, top=THIN_BLACK_SIDE, bottom=THIN_BLACK_SIDE)

# Column Width Standards
COLUMN_WIDTH_MAP = {
    "S.No": 10,
    "Rank": 10,
    "Register No": 20,
    "Student Name": 30,
    "Department": 18,
    "Year": 12,
    "Accommo\ndation": 15,
    "Accommodation": 15,
    "12th\nCutoff": 14,
    "12th Cutoff": 14,
    "Cutoff": 14,
    "Easy": 10,
    "Medium": 10,
    "Hard": 10,
    "Q1": 8, "Q2": 8, "Q3": 8, "Q4": 8,
    "Total Solved": 16,
    "Total\nSolved": 16,
    "Solved": 14,
    "Contests\nAttended": 16,
    "Contests Attended": 16,
    "Attended": 14,
    "Global Rank": 16,
    "Contest\nRating": 16,
    "Contest Rating": 16,
    "Rating": 14,
    "LeetCode Handle": 24,
    "Username": 24,
    "Status": 20,
    "Attendance": 20,
    "Mentor Signal": 24,
    "Staff / Mentor": 26,
    "Faculty Name": 26,
    "Faculty / Mentor Name": 26,
    "Evidence Summary": 36,
    "Verified Evidence": 36,
    "Evidence": 32,
    "Contest Evidence": 36,
}


def get_asset_logo_paths() -> tuple[Optional[str], Optional[str]]:
    """Finds official NANDHA Emblem (white crest badge) and 25 NEC Anniversary logos on disk."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    left_logo = os.path.join(base_dir, "assets", "nandha_emblem.png")
    if not os.path.exists(left_logo):
        left_logo = os.path.join(base_dir, "assets", "nandha_emblem_white_transparent.png")
        if not os.path.exists(left_logo):
            left_logo = None

    right_logo = os.path.join(base_dir, "assets", "nec_25_years_logo_transparent.png")
    if not os.path.exists(right_logo):
        right_logo = os.path.join(base_dir, "assets", "nec_25_years_logo.png")
        if not os.path.exists(right_logo):
            right_logo = None

    return left_logo, right_logo


def apply_master_college_identity(
    ws,
    report_title: str,
    department: str = "ALL",
    year: str = "ALL",
    contest_name: str = "",
    session_date: str = "",
    total_roster: int = 0,
    cols: int = 14
) -> int:
    """
    Applies the Master Institutional Header (Rows 1-5) based on Faculty Consolidated Design:
    - Row 1: Nandha Engineering College Banner (Navy Fill #1B365D, White bold Times New Roman)
    - Left Logo: Official Nandha emblem crest badge with precise top/left offset
    - Right Logo: 25 NEC Anniversary emblem with precise top/right offset
    - Row 2: Autonomous / Accreditation Subtitle
    - Row 3: Department & Cohort Year Context
    - Row 4: Report Title Light Blue Box
    - Row 5: Metadata Strip (Session Date | Department | Year | Total Roster | Generated)
    
    Returns the next available row index (Row 6 or Row 7 after spacer).
    """
    cols = max(4, cols)
    last_col_letter = get_column_letter(cols)
    ws.sheet_view.showGridLines = True

    # 1. Fill Row 1 & Row 2 with Primary Navy across all columns & set unified outer border (no internal gridlines)
    for r in range(1, 3):
        for c in range(1, cols + 1):
            cell = ws.cell(row=r, column=c)
            cell.fill = FILL_NAVY_PRIMARY
            cell.border = Border(
                top=THIN_BLACK_SIDE if r == 1 else None,
                bottom=THIN_BLACK_SIDE if r == 2 else None,
                left=THIN_BLACK_SIDE if c == 1 else None,
                right=THIN_BLACK_SIDE if c == cols else None,
            )

    left_logo, right_logo = get_asset_logo_paths()

    # Row 1: Main Title Banner (Merged across all columns)
    ws.merge_cells(f"A1:{last_col_letter}1")
    ws["A1"] = "NANDHA ENGINEERING COLLEGE, ERODE – 638 052"
    ws["A1"].font = FONT_COLLEGE_TITLE
    ws["A1"].alignment = ALIGN_CENTER
    ws.row_dimensions[1].height = 38

    # Row 2: Subtitle (Merged across all columns)
    ws.merge_cells(f"A2:{last_col_letter}2")
    ws["A2"] = "(AUTONOMOUS) • ESTD 2001 | Approved by AICTE, New Delhi & Affiliated to Anna University, Chennai"
    ws["A2"].font = FONT_SUBTITLE
    ws["A2"].alignment = ALIGN_CENTER
    ws.row_dimensions[2].height = 22

    # Insert Left Emblem Logo (54px height, exact 12.5px left & 6.3px top offset away from edges)
    if left_logo:
        try:
            from openpyxl.drawing.image import Image as OpenPyxlImage
            from openpyxl.drawing.spreadsheet_drawing import OneCellAnchor, AnchorMarker
            from openpyxl.drawing.xdr import XDRPositiveSize2D
            from PIL import Image as PILImage

            with PILImage.open(left_logo) as pil_l:
                orig_w, orig_h = pil_l.size
            target_h = 54
            target_w = int(target_h * (orig_w / orig_h)) if orig_h else 81

            img_left = OpenPyxlImage(left_logo)
            marker_l = AnchorMarker(col=0, colOff=120000, row=0, rowOff=60000)
            size_l = XDRPositiveSize2D(cx=int(target_w * 9525), cy=int(target_h * 9525))
            img_left.anchor = OneCellAnchor(_from=marker_l, ext=size_l)
            ws.add_image(img_left)
        except Exception:
            pass

    # Insert Right 25 NEC Anniversary Logo (54px height, exact 4px right & 6.3px top offset)
    if right_logo:
        try:
            from openpyxl.drawing.image import Image as OpenPyxlImage
            from openpyxl.drawing.spreadsheet_drawing import OneCellAnchor, AnchorMarker
            from openpyxl.drawing.xdr import XDRPositiveSize2D
            from PIL import Image as PILImage

            with PILImage.open(right_logo) as pil_r:
                orig_w, orig_h = pil_r.size
            target_h = 54
            target_w = int(target_h * (orig_w / orig_h)) if orig_h else 54

            img_right = OpenPyxlImage(right_logo)
            marker_r = AnchorMarker(col=cols - 1, colOff=40000, row=0, rowOff=60000)
            size_r = XDRPositiveSize2D(cx=int(target_w * 9525), cy=int(target_h * 9525))
            img_right.anchor = OneCellAnchor(_from=marker_r, ext=size_r)
            ws.add_image(img_right)
        except Exception:
            pass

    # Row 3: Department & Cohort Header (100% Dynamic)
    if not department or str(department).strip().upper() in ("ALL", "ALL DEPARTMENTS", "NONE", ""):
        dept_str = "ALL DEPARTMENTS"
    else:
        dept_str = str(department).strip().upper()

    raw_year = str(year or "").strip().upper()
    if not raw_year or raw_year in ("ALL", "ALL YEARS", "NONE", ""):
        year_str = "ALL YEARS"
        year_bracket = "ALL YEARS"
    else:
        if raw_year in ("1", "I", "1ST"):
            year_str = "I YEAR"
        elif raw_year in ("2", "II", "2ND"):
            year_str = "II YEAR"
        elif raw_year in ("3", "III", "3RD"):
            year_str = "III YEAR"
        elif raw_year in ("4", "IV", "4TH"):
            year_str = "IV YEAR"
        elif "ALL" in raw_year:
            year_str = "ALL YEARS"
        else:
            year_str = f"{raw_year} YEAR" if not raw_year.endswith("YEAR") else raw_year
        year_bracket = year_str

    ws.merge_cells(f"A3:{last_col_letter}3")
    for c in range(1, cols + 1):
        cell = ws.cell(row=3, column=c)
        cell.fill = FILL_LIGHT_BG
        cell.border = BORDER_GRID

    if dept_str == "ALL DEPARTMENTS" and year_str == "ALL YEARS":
        ws["A3"] = "INSTITUTIONAL MASTER REPORT • ALL DEPARTMENTS & COHORTS"
    else:
        ws["A3"] = f"DEPARTMENT OF {dept_str} • COHORT: {year_str}"
    ws["A3"].font = FONT_DEPT_HEADER
    ws["A3"].alignment = ALIGN_CENTER
    ws.row_dimensions[3].height = 22

    # Row 4: Report Title Light Blue Box (100% Dynamic)
    clean_title = str(report_title or "INSTITUTIONAL REPORT").strip().upper()
    if year_bracket in clean_title:
        clean_title_full = clean_title
    elif "REPORT" not in clean_title:
        clean_title_full = f"{clean_title} REPORT ({year_bracket})"
    else:
        clean_title_full = f"{clean_title} ({year_bracket})"

    ws.merge_cells(f"A4:{last_col_letter}4")
    for c in range(1, cols + 1):
        cell = ws.cell(row=4, column=c)
        cell.fill = FILL_LIGHT_BG
        cell.border = BORDER_GRID
    ws["A4"] = clean_title_full
    ws["A4"].font = FONT_REPORT_TITLE
    ws["A4"].alignment = ALIGN_CENTER
    ws.row_dimensions[4].height = 24

    # Row 5: Metadata Strip (100% Dynamic Session Date, Department, Year, Roster, Generated Timestamp in IST)
    now_ist = datetime.datetime.now(IST_TZ)
    date_str = str(session_date or "").strip()
    if not date_str or date_str.upper() in ("LATEST", "NONE", "ALL"):
        date_str = now_ist.strftime("%d.%m.%Y")
    else:
        date_str = date_str.replace("SESSION-", "").replace("session-", "").strip()
        if "-" in date_str and len(date_str.split("-")[0]) == 4:
            parts = date_str.split("-")
            date_str = f"{parts[2]}.{parts[1]}.{parts[0]}"
        elif "-" in date_str:
            date_str = date_str.replace("-", ".")

    gen_time_str = now_ist.strftime("%d %b %Y, %I:%M:%S %p IST")
    meta_text = f"Session Date: {date_str} | Department: {dept_str} | Year: {year_str} | Total Roster: {total_roster} Students | Generated: {gen_time_str}"
    
    ws.merge_cells(f"A5:{last_col_letter}5")
    for c in range(1, cols + 1):
        cell = ws.cell(row=5, column=c)
        cell.fill = FILL_LIGHT_BG
        cell.border = BORDER_GRID
    ws["A5"] = meta_text
    ws["A5"].font = FONT_METADATA
    ws["A5"].alignment = ALIGN_CENTER
    ws.row_dimensions[5].height = 22

    # Spacer Row 6
    ws.row_dimensions[6].height = 8

    return 7


def apply_master_table_headers(
    ws,
    header_row_idx: int,
    headers: List[str],
    primary_hex: str = NAVY_PRIMARY_HEX
) -> int:
    """
    Applies Faculty Consolidated Table Header formatting:
    - Navy Background (#1B365D), Bold White Times New Roman text
    - Thin black border around every cell
    - Auto-calculated column widths
    - Sets freeze panes & autofilter
    """
    fill = PatternFill(start_color=primary_hex, end_color=primary_hex, fill_type="solid")
    ws.row_dimensions[header_row_idx].height = 28

    for col_idx, h_text in enumerate(headers, 1):
        cell = ws.cell(row=header_row_idx, column=col_idx, value=h_text)
        cell.fill = fill
        cell.font = FONT_TABLE_HEADER
        cell.alignment = ALIGN_CENTER
        cell.border = BORDER_GRID

        # Auto column width adjustment
        col_letter = get_column_letter(col_idx)
        clean_h = str(h_text).replace('\n', ' ')
        w = COLUMN_WIDTH_MAP.get(h_text, COLUMN_WIDTH_MAP.get(clean_h, max(14, len(clean_h) + 4)))
        ws.column_dimensions[col_letter].width = w

    return header_row_idx + 1


def apply_master_data_row(
    ws,
    row_idx: int,
    row_values: List[Any],
    headers: List[str],
    is_alt: bool = False
):
    """
    Applies Faculty Consolidated data row formatting:
    - Times New Roman 9.5 font
    - Alternate row fill (F8FAFC)
    - Sharp thin black borders on every cell
    - Standardized alignments: ONLY Student/Faculty Name is LEFT aligned, everything else is CENTER aligned.
    """
    ws.row_dimensions[row_idx].height = 24
    row_fill = FILL_ALT_ROW if is_alt else PatternFill(fill_type=None)

    for col_idx, val in enumerate(row_values, 1):
        cell = ws.cell(row=row_idx, column=col_idx, value=val)
        cell.font = FONT_DATA_BODY
        cell.border = BORDER_GRID
        if is_alt:
            cell.fill = row_fill

        header_name = headers[col_idx - 1] if col_idx - 1 < len(headers) else ""
        header_clean = header_name.replace('\n', ' ').strip()

        # Convert text percentages and numeric strings to native Excel types to eliminate green error triangles!
        if isinstance(val, str):
            val_s = val.strip()
            is_reg = any(k in header_clean.lower() for k in ("reg", "register", "roll"))
            if is_reg:
                cell.number_format = "@"
            elif val_s.endswith("%"):
                try:
                    num_val = float(val_s.rstrip("%").strip())
                    cell.value = num_val / 100.0
                    cell.number_format = '0.00%'
                except ValueError:
                    pass
            elif val_s.replace(".", "", 1).replace("-", "", 1).isdigit():
                try:
                    if "." in val_s:
                        cell.value = float(val_s)
                    else:
                        cell.value = int(val_s)
                except ValueError:
                    pass

        # Strict Alignment Rule: ONLY Student Name / Faculty Name columns are LEFT aligned.
        # ALL OTHER COLUMNS (S.No, Reg No, Dept, Year, Cutoff Band, Stats, Handle, Solved, %, Signal, Evidence, etc.) ARE CENTER ALIGNED.
        # No-wrap is enforced so every data cell value sits cleanly on a single line!
        is_name_column = header_clean in [
            "Student Name", "Name", "Faculty Name", "Faculty / Mentor Name", 
            "Staff / Mentor Name", "Mentor Name", "Staff Name"
        ]
        if is_name_column:
            cell.alignment = ALIGN_LEFT_NOWRAP
        else:
            cell.alignment = ALIGN_CENTER_NOWRAP

        # Auto-expand column width so values (e.g. Evidence Summary, Long Status) fit on a single line without wrapping or clipping
        col_letter = get_column_letter(col_idx)
        val_str = str(cell.value or val or "").strip()
        if val_str:
            max_line_len = max(len(line) for line in val_str.replace('\n', ' ').split('\n'))
            required_w = max_line_len + 5
            current_w = ws.column_dimensions[col_letter].width or 10
            if required_w > current_w:
                ws.column_dimensions[col_letter].width = min(65, required_w)

        # Mentor Signal Colors
        if "Mentor Signal" in header_clean or "Signal" in header_clean:
            val_str = str(val).upper().strip()
            if val_str == "HIGH PERFORMANCE":
                cell.font = Font(name=PRIMARY_FONT, size=9.5, bold=True, color="047857")
            elif val_str == "STRONG":
                cell.font = Font(name=PRIMARY_FONT, size=9.5, bold=True, color="1D4ED8")
            elif val_str == "DEVELOPING":
                cell.font = Font(name=PRIMARY_FONT, size=9.5, bold=True, color="B45309")
            elif val_str in ("FOUNDATION", "NO SOLVE / FOLLOW-UP", "NEEDS MONITORING"):
                cell.font = Font(name=PRIMARY_FONT, size=9.5, bold=True, color="B91C1C")


def apply_master_footer_and_print_setup(
    ws,
    footer_row_idx: int,
    total_cols: int,
    header_row_idx: int = 7,
    total_data_rows: int = 0
):
    """
    Applies Faculty Consolidated footer and A4 page setup:
    - Footer stamp row
    - A4 Landscape/Portrait fit
    - Header row repetition on multi-page printouts
    """
    last_col_letter = get_column_letter(max(1, total_cols))
    
    # Footer Stamp
    ws.row_dimensions[footer_row_idx].height = 18
    ws.merge_cells(f"A{footer_row_idx}:{last_col_letter}{footer_row_idx}")
    f_cell = ws.cell(row=footer_row_idx, column=1, value="v1.0 | Template Rev 3 | Official Nandha LeetCode Intelligence System")
    f_cell.font = FONT_FOOTER
    f_cell.alignment = ALIGN_LEFT

    # Enable AutoFilter across table
    if total_data_rows > 0:
        ws.auto_filter.ref = f"A{header_row_idx}:{last_col_letter}{header_row_idx + total_data_rows}"

    # A4 Print Configuration
    ws.sheet_view.showGridLines = True
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.orientation = ws.ORIENTATION_LANDSCAPE if total_cols > 7 else ws.ORIENTATION_PORTRAIT
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_title_rows = f"1:{header_row_idx}"
