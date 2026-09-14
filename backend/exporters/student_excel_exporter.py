import io
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

FONT_TNR = "Times New Roman"

def export_student_excel_from_dataset(dataset: dict, report_type: str = "STUDENT") -> bytes:
    """
    Creates a single-student specific Excel workbook with multiple sheets.
    Supports STUDENT, SUMMARY, MATRIX.
    """
    wb = openpyxl.Workbook()
    wb.remove(wb.active)  # Remove default sheet
    
    rows = dataset.get("rows", [])
    s = rows[0] if rows else {}
    
    # Common Styles
    title_font = Font(name=FONT_TNR, size=16, bold=True, color="FFFFFF")
    header_font = Font(name=FONT_TNR, size=12, bold=True, color="FFFFFF")
    normal_font = Font(name=FONT_TNR, size=11)
    bold_font = Font(name=FONT_TNR, size=11, bold=True)
    
    header_fill = PatternFill(start_color="1B365D", end_color="1B365D", fill_type="solid")
    alt_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    center_align = Alignment(horizontal="center", vertical="center")
    left_align = Alignment(horizontal="left", vertical="center")
    
    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )
    
    def _create_sheet(title, headers):
        ws = wb.create_sheet(title=title[:31])
        ws.append(headers)
        for col_idx in range(1, len(headers)+1):
            cell = ws.cell(row=1, column=col_idx)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = center_align
            cell.border = thin_border
            ws.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = 25
        return ws
        
    def _add_row(ws, data, alt=False):
        ws.append(data)
        row_idx = ws.max_row
        for col_idx in range(1, len(data)+1):
            cell = ws.cell(row=row_idx, column=col_idx)
            cell.font = normal_font
            cell.alignment = center_align
            cell.border = thin_border
            if alt: cell.fill = alt_fill

    # Sheets generation based on type
    if report_type == "WEEKLY_CONTEST_MATRIX":
        # MATRIX sheets
        ws_over = _create_sheet("01_Contest_Overview", ["Metric", "Value"])
        _add_row(ws_over, ["Student Name", s.get("name")])
        _add_row(ws_over, ["Register No", s.get("reg_no") or s.get("register_number")], True)
        _add_row(ws_over, ["Department", s.get("dept")])
        _add_row(ws_over, ["Contest Rating", s.get("contest_rating") or s.get("rating")], True)
        
        ws_mat = _create_sheet("02_Contest_Matrix", ["Contest", "Q1", "Q2", "Q3", "Q4", "Solved", "Score"])
        c_name = dataset.get("contestName") or dataset.get("title", "Weekly Contest")
        _add_row(ws_mat, [c_name, s.get("q1") or 0, s.get("q2") or 0, s.get("q3") or 0, s.get("q4") or 0, s.get("contest_solved") or 0, s.get("contest_score") or 0])
        
    elif report_type == "OFFICIAL_SUMMARY":
        # SUMMARY sheets
        ws_over = _create_sheet("01_Student_Overview", ["Metric", "Value"])
        _add_row(ws_over, ["Student Name", s.get("name")])
        _add_row(ws_over, ["Register No", s.get("reg_no") or s.get("register_number")], True)
        _add_row(ws_over, ["Total Solved", s.get("total_solved")])
        _add_row(ws_over, ["Easy", s.get("easy")], True)
        _add_row(ws_over, ["Medium", s.get("medium")])
        _add_row(ws_over, ["Hard", s.get("hard")], True)
        
    else:
        # STUDENT Detail sheets (Default)
        ws_prof = _create_sheet("01_Student_Profile", ["Attribute", "Details"])
        _add_row(ws_prof, ["Student Name", s.get("name")])
        _add_row(ws_prof, ["Register No", s.get("reg_no") or s.get("register_number")], True)
        _add_row(ws_prof, ["Department", s.get("dept")])
        _add_row(ws_prof, ["Year", s.get("year")], True)
        _add_row(ws_prof, ["Username", s.get("username")])
        
        ws_perf = _create_sheet("02_Executive_Summary", ["Metric", "Value"])
        _add_row(ws_perf, ["Total Solved", s.get("total_solved")])
        _add_row(ws_perf, ["Rating", s.get("contest_rating") or s.get("rating")], True)
        _add_row(ws_perf, ["College Rank", s.get("college_rank")])
        _add_row(ws_perf, ["Active Streak", s.get("active_streak") or 0], True)
        
        ws_diff = _create_sheet("04_Difficulty_Analysis", ["Difficulty", "Solved"])
        _add_row(ws_diff, ["Easy", s.get("easy")])
        _add_row(ws_diff, ["Medium", s.get("medium")], True)
        _add_row(ws_diff, ["Hard", s.get("hard")])

    if not wb.sheetnames:
        ws = wb.create_sheet("Empty")
        ws.append(["No Data"])

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()
