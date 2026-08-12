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
    """Write the 2-row college header banner across all columns."""
    last_col = get_column_letter(cols)
    ws.merge_cells(f"A1:{last_col}1")
    ws["A1"] = "NANDHA ENGINEERING COLLEGE (AUTONOMOUS)"
    ws["A1"].font = Font(name=font_tnr, size=13, bold=True, color="FFFFFF")
    ws["A1"].alignment = center
    ws["A1"].fill = navy_fill
    ws.row_dimensions[1].height = 24

    ws.merge_cells(f"A2:{last_col}2")
    ws["A2"] = title.upper()
    ws["A2"].font = Font(name=font_tnr, size=10, bold=True, color="FFFFFF")
    ws["A2"].alignment = center
    ws["A2"].fill = header_fill
    ws.row_dimensions[2].height = 18

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

    # ── SHEET 1: COVER SHEET / OVERVIEW ──────────────────────────────────────
    ws_cover = wb.create_sheet(title="Report Overview")
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
    ws_cover["A5"] = dataset.get("title", "INSTITUTIONAL REPORT & ANALYTICS").upper()
    ws_cover["A5"].font = Font(name=font_tnr, size=14, bold=True, color="2E5B88")
    ws_cover["A5"].alignment = center

    gen_at = str(dataset.get('generatedAt') or dataset.get('generated_at') or '')[:10]
    rep_id = str(dataset.get('reportId') or dataset.get('report_id') or '')
    status_str = str(dataset.get('dataStatus') or dataset.get('data_status') or 'READY')
    ws_cover["A7"] = f"Report ID: {rep_id}   |   Status: {status_str}   |   Generated: {gen_at}"
    ws_cover["A7"].font = Font(name=font_tnr, size=10, bold=True, color="0284C7")
    ws_cover["A7"].alignment = center

    # Executive Summary Metrics Block
    metrics = dataset.get("metrics", {})
    r_idx = 10
    if metrics:
        ws_cover.merge_cells(f"B{r_idx}:K{r_idx}")
        ws_cover[f"B{r_idx}"] = "EXECUTIVE SUMMARY METRICS"
        ws_cover[f"B{r_idx}"].font = Font(name=font_tnr, size=11, bold=True, color="FFFFFF")
        ws_cover[f"B{r_idx}"].fill = navy_fill
        ws_cover[f"B{r_idx}"].alignment = center
        ws_cover.row_dimensions[r_idx].height = 22
        r_idx += 1

        for k, v in metrics.items():
            label_text = re.sub(r'([A-Z])', r' \1', str(k)).strip().title()
            ws_cover.cell(row=r_idx, column=2, value=label_text).font = Font(name=font_tnr, size=10, bold=True)
            val_cell = ws_cover.cell(row=r_idx, column=6, value=f"{v:,}" if isinstance(v, (int, float)) and v > 999 else (v if v is not None else "—"))
            val_cell.font = Font(name=font_tnr, size=10, bold=True, color="0284C7")
            val_cell.alignment = right
            ws_cover.merge_cells(f"B{r_idx}:E{r_idx}")
            ws_cover.merge_cells(f"F{r_idx}:K{r_idx}")
            _apply_thin_border(ws_cover.cell(row=r_idx, column=2))
            _apply_thin_border(ws_cover.cell(row=r_idx, column=6))
            ws_cover.row_dimensions[r_idx].height = 19
            r_idx += 1

    r_idx += 2

    # BATCH PERFORMANCE SUMMARY TABLE (Year Breakdown)
    student_records = rows if rows else all_students
    if student_records:
        ws_cover.merge_cells(f"A{r_idx}:L{r_idx}")
        ws_cover[f"A{r_idx}"] = "NUMBER OF PROBLEMS SOLVED — CATEGORY & BATCH SUMMARY"
        ws_cover[f"A{r_idx}"].font = Font(name=font_tnr, size=11, bold=True, color="FFFFFF")
        ws_cover[f"A{r_idx}"].fill = navy_fill
        ws_cover[f"A{r_idx}"].alignment = center
        ws_cover.row_dimensions[r_idx].height = 24
        r_idx += 1

        headers_b = ["Batch / Year", "Total Students", "Above 500", "250 - 500", "101 - 250", "Less than 100", "Not Started", "4 Q Solved", "3 Q Solved", "2 Q Solved", "1 Q Solved", "Rating > 1500"]
        w_b = [20, 14, 12, 12, 12, 14, 12, 12, 12, 12, 12, 14]
        for col_i, (h_text, w_val) in enumerate(zip(headers_b, w_b), start=1):
            c = ws_cover.cell(row=r_idx, column=col_i, value=h_text)
            c.font = Font(name=font_tnr, size=9, bold=True, color="FFFFFF")
            c.fill = header_fill
            c.alignment = center
            _apply_thin_border(c)
            ws_cover.column_dimensions[get_column_letter(col_i)].width = w_val
        ws_cover.row_dimensions[r_idx].height = 22
        r_idx += 1

        # Group stats by Year / Batch
        batch_map = {
            "IV":  "2023 - 2027 (IV Yr)",
            "III": "2024 - 2028 (III Yr)",
            "II":  "2025 - 2029 (II Yr)",
            "I":   "2026 - 2030 (I Yr)"
        }

        # Calculate counts per year
        by_year = {}
        for rec in student_records:
            yr = str(rec.get("year") or "III").strip()
            if yr not in by_year:
                by_year[yr] = {
                    "total": 0, "a500": 0, "b250_500": 0, "b101_250": 0, "l100": 0, "zero": 0,
                    "q4": 0, "q3": 0, "q2": 0, "q1": 0, "r1500": 0
                }
            st = by_year[yr]
            st["total"] += 1

            attended = rec.get("participation_status", "") in ("PUBLIC_ATTENDED", "ATTENDED", "VIRTUAL_ATTENDED")
            q_sum = sum(1 for q_key in ["q1","q2","q3","q4"] if _to_int(rec.get(q_key)) > 0)
            if q_sum == 4: st["q4"] += 1
            elif q_sum == 3: st["q3"] += 1
            elif q_sum == 2: st["q2"] += 1
            elif q_sum == 1: st["q1"] += 1

            tot_solv = _to_int(rec.get("total_solved") or rec.get("score"))
            if tot_solv >= 500: st["a500"] += 1
            elif tot_solv >= 250: st["b250_500"] += 1
            elif tot_solv >= 101: st["b101_250"] += 1
            elif tot_solv > 0: st["l100"] += 1
            else: st["zero"] += 1

            rating = _to_float(rec.get("rating") or rec.get("contest_rating"))
            if rating > 1500: st["r1500"] += 1

        for yr_code in ["IV", "III", "II", "I"]:
            if yr_code in by_year:
                st = by_year[yr_code]
                batch_label = batch_map.get(yr_code, f"Year {yr_code}")
                row_vals = [
                    batch_label, st["total"], st["a500"], st["b250_500"], st["b101_250"],
                    st["l100"], st["zero"], st["q4"], st["q3"], st["q2"], st["q1"], st["r1500"]
                ]
                for col_i, val in enumerate(row_vals, start=1):
                    c = ws_cover.cell(row=r_idx, column=col_i, value=val)
                    c.font = Font(name=font_tnr, size=9.5, bold=(col_i in (1, 2)))
                    c.alignment = center if col_i != 1 else left
                    c.fill = alt_fill if r_idx % 2 == 0 else white_fill
                    _apply_thin_border(c)
                ws_cover.row_dimensions[r_idx].height = 20
                r_idx += 1

    # ── SHEET 2: MASTER CONTEST MATRIX (for Weekly Contest) ──────────────────
    STATUS_LABEL = {
        "PUBLIC_ATTENDED":    "PUBLIC",
        "ATTENDED":           "PUBLIC",
        "VIRTUAL_ATTENDED":   "VIRTUAL",
        "PUBLIC_NOT_ATTENDED":"NOT ATTENDED",
        "NOT_ATTENDED":       "NOT ATTENDED",
        "DATA_ERROR":         "DATA ERROR",
        "PENDING":            "PENDING",
    }

    if is_weekly and rows:
        ws_m = wb.create_sheet(title="Contest Matrix")
        ws_m.sheet_view.showGridLines = True
        _write_college_header(
            ws_m,
            title=dataset.get("title", "Weekly Contest Participation Matrix"),
            cols=12,
            font_tnr=font_tnr,
            navy_fill=navy_fill,
            header_fill=header_fill,
            center=center
        )

        m_headers   = ["S.No", "Register No", "Student Name", "Dept", "Year", "Status", "Q1", "Q2", "Q3", "Q4", "Contest Solved", "Rank"]
        m_col_widths = [6,       16,            28,             12,     8,      18,       6,    6,    6,    6,    14,               10]
        _write_header_row(ws_m, 3, m_headers, m_col_widths, navy_fill, font_tnr, center)

        for idx, r in enumerate(rows, start=1):
            row_num   = 3 + idx
            p_status  = r.get("participation_status") or "PENDING"
            attended  = p_status in ("PUBLIC_ATTENDED", "ATTENDED", "VIRTUAL_ATTENDED")
            is_virtual = p_status == "VIRTUAL_ATTENDED"
            row_fill  = (green_fill if attended else red_fill) if idx % 2 != 0 else (
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
                c = ws_m.cell(row=row_num, column=col_idx, value=val)
                c.fill = row_fill
                c.font = Font(
                    name=font_tnr, size=9,
                    bold=(col_idx in (1, 6, 11)),
                    color=("006400" if (attended and not is_virtual) else ("0051A8" if is_virtual else "8B0000"))
                    if col_idx == 6 else "1E293B"
                )
                c.alignment = center if col_idx not in (3,) else left
                _apply_thin_border(c)
            ws_m.row_dimensions[row_num].height = 18

        ws_m.freeze_panes = "A4"

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


