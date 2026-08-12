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

def export_excel_from_dataset(dataset: dict) -> bytes:
    """
    EXCEL EXPORTER
    Generates Excel directly from normalized ReportDataset.
    """
    wb = openpyxl.Workbook()
    wb.remove(wb.active) # Remove default sheet

    font_tnr = "Times New Roman"
    navy_fill = PatternFill(start_color="1B365D", end_color="1B365D", fill_type="solid")
    header_fill = PatternFill(start_color="2E5B88", end_color="2E5B88", fill_type="solid")
    alt_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    white_fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")

    center = Alignment(horizontal="center", vertical="center", wrap_text=True)
    left = Alignment(horizontal="left", vertical="center", wrap_text=True)
    right = Alignment(horizontal="right", vertical="center")

    # --- SHEET 1: COVER SHEET ---
    ws_cover = wb.create_sheet(title="Report Overview")

    ws_cover.merge_cells("A2:L2")
    ws_cover["A2"] = "NANDHA ENGINEERING COLLEGE (AUTONOMOUS)"
    ws_cover["A2"].font = Font(name=font_tnr, size=16, bold=True, color="1B365D")
    ws_cover["A2"].alignment = center

    ws_cover.merge_cells("A3:L3")
    ws_cover["A3"] = "Approved by AICTE, New Delhi | Affiliated to Anna University, Chennai | Erode - 638 052"
    ws_cover["A3"].font = Font(name=font_tnr, size=10, italic=True)
    ws_cover["A3"].alignment = center

    ws_cover.merge_cells("A5:L5")
    ws_cover["A5"] = dataset.get("title", "INSTITUTIONAL REPORT & ANALYTICS").upper()
    ws_cover["A5"].font = Font(name=font_tnr, size=14, bold=True, color="2E5B88")
    ws_cover["A5"].alignment = center

    ws_cover.merge_cells("A11:L11")
    ws_cover["A11"] = f"Report ID: {dataset.get('reportId', '')}   |   Status: {dataset.get('dataStatus', 'READY')}"
    ws_cover["A11"].font = Font(name=font_tnr, size=11, bold=True, color="0284C7")
    ws_cover["A11"].alignment = center

    # Cover Summary Metrics Block
    metrics = dataset.get("metrics", {})
    if metrics:
        ws_cover.merge_cells("C15:J15")
        ws_cover["C15"] = "EXECUTIVE SUMMARY METRICS"
        ws_cover["C15"].font = Font(name=font_tnr, size=11, bold=True, color="FFFFFF")
        ws_cover["C15"].fill = navy_fill
        ws_cover["C15"].alignment = center

        r_idx = 16
        for k, v in metrics.items():
            label_text = re.sub(r'([A-Z])', r' \1', str(k)).strip().title()
            ws_cover.cell(row=r_idx, column=3, value=label_text).font = Font(name=font_tnr, size=10, bold=True)
            val_cell = ws_cover.cell(row=r_idx, column=6, value=f"{v:,}" if isinstance(v, (int, float)) and v > 999 else (v if v is not None else "—"))
            val_cell.font = Font(name=font_tnr, size=10, bold=True, color="0284C7")
            val_cell.alignment = right
            ws_cover.merge_cells(f"C{r_idx}:E{r_idx}")
            ws_cover.merge_cells(f"F{r_idx}:J{r_idx}")
            _apply_thin_border(ws_cover.cell(row=r_idx, column=3))
            _apply_thin_border(ws_cover.cell(row=r_idx, column=6))
            r_idx += 1

    # --- SHEET 2: MASTER ROSTER / DETAILED DATA SHEET ---
    all_students = dataset.get("allStudents") or dataset.get("topStudents") or []
    if all_students:
        # Group students by Dept + Year to dynamically create per-dept/year sheets if scope requires
        dept_year_groups = {}
        for s in all_students:
            dy_key = f"{s.get('dept', 'CSE')}-{s.get('year', 'ALL')}Yr"[:31]
            if dy_key not in dept_year_groups:
                dept_year_groups[dy_key] = []
            dept_year_groups[dy_key].append(s)

        # Create dynamically grouped sheets if multiple exist, otherwise single main sheet
        for sheet_name, s_list in dept_year_groups.items():
            ws = wb.create_sheet(title=sheet_name)
            ws.sheet_view.showGridLines = True

            ws.merge_cells("A1:K1")
            ws["A1"] = "NANDHA ENGINEERING COLLEGE (AUTONOMOUS)"
            ws["A1"].font = Font(name=font_tnr, size=13, bold=True, color="FFFFFF")
            ws["A1"].alignment = center
            ws["A1"].fill = navy_fill

            ws.merge_cells("A2:K2")
            ws["A2"] = f"{dataset.get('title', 'Student Performance Report')} — {sheet_name}".upper()
            ws["A2"].font = Font(name=font_tnr, size=10, bold=True, color="FFFFFF")
            ws["A2"].alignment = center
            ws["A2"].fill = header_fill

            ws.row_dimensions[1].height = 26
            ws.row_dimensions[2].height = 20

            headers = ["S.No", "Register No", "Student Name", "Department", "Year", "LeetCode URL", "Username", "Easy", "Medium", "Hard", "Total Solved"]
            col_widths = [6, 16, 28, 12, 8, 36, 18, 10, 10, 10, 12]

            for col_idx, (hdr, width) in enumerate(zip(headers, col_widths), start=1):
                c = ws.cell(row=3, column=col_idx, value=hdr)
                c.font = Font(name=font_tnr, size=10, bold=True, color="FFFFFF")
                c.fill = navy_fill
                c.alignment = center
                _apply_thin_border(c)
                ws.column_dimensions[get_column_letter(col_idx)].width = width

            ws.row_dimensions[3].height = 28

            for idx, student in enumerate(s_list, start=1):
                r = 3 + idx
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
                    student.get("total_solved") if student.get("total_solved") is not None else "—"
                ]

                for col_idx, val in enumerate(r_data, start=1):
                    c = ws.cell(row=r, column=col_idx, value=val)
                    c.fill = r_fill
                    c.font = Font(name=font_tnr, size=10)
                    c.alignment = center if col_idx not in (3, 6, 7) else left
                    _apply_thin_border(c)

                if lc_url:
                    link_c = ws.cell(row=r, column=6)
                    link_c.hyperlink = lc_url
                    link_c.font = Font(name=font_tnr, size=10, color="0563C1", underline="single")

                ws.row_dimensions[r].height = 20

    # --- SHEET 3: OFFICIAL CONTEST PARTICIPATIONS (if present) ---
    participations = dataset.get("participations")
    if participations:
        ws_p = wb.create_sheet(title="OFFICIAL CONTESTS")
        ws_p.sheet_view.showGridLines = True
        ws_p.merge_cells("A1:I1")
        ws_p["A1"] = "OFFICIAL CONTEST PARTICIPATION LOG"
        ws_p["A1"].font = Font(name=font_tnr, size=13, bold=True, color="FFFFFF")
        ws_p["A1"].fill = navy_fill
        ws_p["A1"].alignment = center

        p_headers = ["S.No", "Contest Name", "Date", "Register No", "Student Name", "Department", "Year", "Problems Solved", "Contest Rank"]
        for col_idx, h in enumerate(p_headers, start=1):
            c = ws_p.cell(row=2, column=col_idx, value=h)
            c.font = Font(name=font_tnr, size=10, bold=True, color="FFFFFF")
            c.fill = header_fill
            c.alignment = center
            _apply_thin_border(c)

        for idx, p_item in enumerate(participations, start=1):
            r = 2 + idx
            p_vals = [
                idx,
                p_item.get("contest_name", ""),
                p_item.get("date", ""),
                p_item.get("reg_no", ""),
                p_item.get("student_name", ""),
                p_item.get("dept", ""),
                p_item.get("year", ""),
                f"{p_item.get('problems_solved', 0)} / {p_item.get('total_problems', 4)}",
                str(p_item.get("rank", "-"))
            ]
            for col_idx, val in enumerate(p_vals, start=1):
                c = ws_p.cell(row=r, column=col_idx, value=val)
                c.font = Font(name=font_tnr, size=10)
                c.alignment = center if col_idx not in (2, 5) else left
                _apply_thin_border(c)

        for col in ws_p.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            ws_p.column_dimensions[get_column_letter(col[0].column)].width = max(max_len + 3, 14)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output.getvalue()
