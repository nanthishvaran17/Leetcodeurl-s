import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import datetime
from backend.exporters.nec_master_excel_design import apply_master_college_identity
from backend.models import Student, WeeklyPublicResult, WeeklyVirtualResult
from backend.services.weekly_session_resolver import resolve_target_weekly_session

def generate_single_sheet_contest_excel(
    db: Session,
    dataset: Dict[str, Any],
    session_id: str
) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    if not ws:
        ws = wb.create_sheet()
    ws.title = "Contest Report"
    
    target_session = resolve_target_weekly_session(db, session_id)
    public_map = {}
    virtual_map = {}
    if target_session:
        p_list = db.query(WeeklyPublicResult, Student).join(Student, WeeklyPublicResult.student_id == Student.id).filter(WeeklyPublicResult.session_id == target_session.id).all()
        for pr, st in p_list:
            if st and st.reg_no:
                public_map[str(st.reg_no).strip().upper()] = pr
        v_list = db.query(WeeklyVirtualResult, Student).join(Student, WeeklyVirtualResult.student_id == Student.id).filter(WeeklyVirtualResult.session_id == target_session.id).all()
        for vr, st in v_list:
            if st and st.reg_no:
                virtual_map[str(st.reg_no).strip().upper()] = vr

    # Fast student database lookup for accommodation and 12th cutoff metadata
    db_students = db.query(Student).all()
    student_meta_map: Dict[str, Student] = {}
    for st in db_students:
        if st.reg_no:
            student_meta_map[str(st.reg_no).strip().upper()] = st
        if st.id:
            student_meta_map[str(st.id)] = st

    # Extract student dataset
    students = (
        dataset.get("allStudents") or 
        dataset.get("rows") or 
        dataset.get("all_students_current") or 
        dataset.get("all_students") or 
        dataset.get("all_rows") or 
        dataset.get("students") or 
        []
    )
    
    contest_name = str(dataset.get("contest_name") or dataset.get("contestName") or dataset.get("title") or "")
    contest_date = str(dataset.get("session_date") or dataset.get("sessionDate") or dataset.get("report_date") or "")
    dept = dataset.get("deptFilter") or dataset.get("department") or "ALL"
    year = dataset.get("yearFilter") or dataset.get("year") or "ALL"
    
    # Apply Master College Identity Header (10 columns)
    next_row = apply_master_college_identity(
        ws=ws,
        report_title="Student Contest Performance Single Sheet",
        department=dept,
        year=year,
        contest_name=contest_name,
        session_date=contest_date,
        total_roster=len(students),
        cols=10
    )
    
    # Styles
    font_header = Font(name="Times New Roman", size=10, bold=True, color="FFFFFF")
    fill_header = PatternFill(start_color="1B365D", end_color="1B365D", fill_type="solid")
    fill_total_row = PatternFill(start_color="E6F0FA", end_color="E6F0FA", fill_type="solid")
    fill_acc_subhdr = PatternFill(start_color="2E5B88", end_color="2E5B88", fill_type="solid")
    
    font_data = Font(name="Times New Roman", size=10)
    font_name = Font(name="Times New Roman", size=10, bold=True)
    font_bold = Font(name="Times New Roman", size=10, bold=True)
    font_total_label = Font(name="Times New Roman", size=10, bold=True, color="1B365D")
    font_acc_title = Font(name="Times New Roman", size=11, bold=True, color="FFFFFF")
    
    align_center = Alignment(horizontal="center", vertical="center", wrap_text=False)
    align_center_wrap = Alignment(horizontal="center", vertical="center", wrap_text=True)
    align_left = Alignment(horizontal="left", vertical="center", wrap_text=False)
    
    thin_side = Side(style='thin', color='000000')
    grid_border = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)
    
    # 10 Columns: S.No, Reg No, Name, Accommodation, Cutoff, Q1(Easy), Q2(Medium), Q3(Medium), Q4(Hard), Total Solved
    headers = [
        "S.No", 
        "Reg No", 
        "Name", 
        "Accommodation",
        "Cutoff",
        "Q1\n(Easy)", 
        "Q2\n(Medium)", 
        "Q3\n(Medium)", 
        "Q4\n(Hard)", 
        "Total Solved"
    ]
    
    # Write Table Header
    ws.row_dimensions[next_row].height = 28
    for col_idx, h in enumerate(headers, 1):
        cell = ws.cell(row=next_row, column=col_idx, value=h)
        cell.font = font_header
        cell.fill = fill_header
        cell.alignment = align_center_wrap
        cell.border = grid_border
        
    row_idx = next_row + 1
    
    # Metrics aggregators
    sum_q1 = 0
    sum_q2 = 0
    sum_q3 = 0
    sum_q4 = 0
    sum_total_solved = 0
    
    hostel_stats = {"count": 0, "attended": 0, "q1": 0, "q2": 0, "q3": 0, "q4": 0, "total_solved": 0}
    ds_stats = {"count": 0, "attended": 0, "q1": 0, "q2": 0, "q3": 0, "q4": 0, "total_solved": 0}
    
    for s_idx, s in enumerate(students, 1):
        reg_no = str(s.get("reg_no") or s.get("register_no") or "").strip()
        reg_upper = reg_no.upper()
        
        pr = public_map.get(reg_upper)
        vr = virtual_map.get(reg_upper)

        q1 = q2 = q3 = q4 = 0
        if pr:
            q1 = 1 if pr.q1 else 0
            q2 = 1 if pr.q2 else 0
            q3 = 1 if pr.q3 else 0
            q4 = 1 if pr.q4 else 0
        elif vr:
            q1 = 1 if vr.q1 else 0
            q2 = 1 if vr.q2 else 0
            q3 = 1 if vr.q3 else 0
            q4 = 1 if vr.q4 else 0
        else:
            q1 = 1 if str(s.get("q1", "")).lower() in ("1", "true") else 0
            q2 = 1 if str(s.get("q2", "")).lower() in ("1", "true") else 0
            q3 = 1 if str(s.get("q3", "")).lower() in ("1", "true") else 0
            q4 = 1 if str(s.get("q4", "")).lower() in ("1", "true") else 0
        
        # Calculate total solved for student
        tot = s.get("solved")
        if tot is None:
            tot = s.get("total_solved")
        if tot is None:
            tot = s.get("total_contest_solved")
        
        try:
            tot_int = int(tot) if tot is not None else 0
        except:
            tot_int = 0
        
        solved_count = max(tot_int, q1 + q2 + q3 + q4)
        
        # Lookup Student record for Accommodation and 12th Cutoff
        st_obj = student_meta_map.get(reg_upper) or (
            student_meta_map.get(str(s.get("student_id") or s.get("id"))) if s.get("student_id") or s.get("id") else None
        )
        
        # Accommodation determination
        raw_acc = ""
        if st_obj and st_obj.accommodation:
            raw_acc = str(st_obj.accommodation).strip()
        elif s.get("accommodation"):
            raw_acc = str(s.get("accommodation")).strip()
        elif s.get("hostel_dayscholar"):
            raw_acc = str(s.get("hostel_dayscholar")).strip()
        
        if "HOSTEL" in raw_acc.upper():
            acc_val = "Hostel"
        else:
            acc_val = "Day Scholar"
            
        # 12th Cutoff determination
        raw_cutoff = None
        if st_obj and st_obj.twelfth_cutoff is not None:
            raw_cutoff = st_obj.twelfth_cutoff
        elif s.get("twelfth_cutoff") is not None:
            raw_cutoff = s.get("twelfth_cutoff")
        elif s.get("cutoff") is not None:
            raw_cutoff = s.get("cutoff")
            
        cutoff_disp: Any = "—"
        if raw_cutoff is not None:
            try:
                c_num = float(raw_cutoff)
                if c_num > 0 and c_num == c_num: # check positive and not NaN
                    cutoff_disp = round(c_num, 2)
            except (ValueError, TypeError):
                cutoff_disp = "—"
                
        # Aggregate global column counts
        sum_q1 += q1
        sum_q2 += q2
        sum_q3 += q3
        sum_q4 += q4
        sum_total_solved += solved_count
        
        # Aggregate accommodation statistics
        is_attended = (solved_count > 0)
        target_group = hostel_stats if acc_val == "Hostel" else ds_stats
        target_group["count"] += 1
        if is_attended:
            target_group["attended"] += 1
        target_group["q1"] += q1
        target_group["q2"] += q2
        target_group["q3"] += q3
        target_group["q4"] += q4
        target_group["total_solved"] += solved_count
        
        student_name = str(s.get("name") or s.get("student_name") or "").strip()
        
        vals = [
            s_idx,
            reg_no,
            student_name,
            acc_val,
            cutoff_disp,
            q1,
            q2,
            q3,
            q4,
            solved_count
        ]
        
        for col_idx, val in enumerate(vals, 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.font = font_name if col_idx == 3 else (font_bold if col_idx == 10 else font_data)
            cell.alignment = align_left if col_idx == 3 else align_center
            cell.border = grid_border
            
        ws.row_dimensions[row_idx].height = 20
        row_idx += 1
        
    # =========================================================================
    # ROW: TOTAL SOLVED COUNT UNDER EACH COLUMN
    # =========================================================================
    ws.row_dimensions[row_idx].height = 24
    
    # Merge S.No, Reg No, Name, Accommodation, Cutoff for Total Row Header Label
    ws.merge_cells(start_row=row_idx, start_column=1, end_row=row_idx, end_column=5)
    total_lbl_cell = ws.cell(row=row_idx, column=1, value="TOTAL SOLVED COUNT")
    total_lbl_cell.font = font_total_label
    total_lbl_cell.alignment = align_center
    
    for c in range(1, 6):
        c_cell = ws.cell(row=row_idx, column=c)
        c_cell.fill = fill_total_row
        c_cell.border = grid_border
        
    # Solved Counts under respective Q1, Q2, Q3, Q4, and Total Solved columns
    col_totals = [sum_q1, sum_q2, sum_q3, sum_q4, sum_total_solved]
    for idx_offset, tot_val in enumerate(col_totals, 6):
        t_cell = ws.cell(row=row_idx, column=idx_offset, value=tot_val)
        t_cell.font = font_bold
        t_cell.fill = fill_total_row
        t_cell.alignment = align_center
        t_cell.border = grid_border
        
    row_idx += 1
    
    # =========================================================================
    # SECTION: ACCOMMODATION-WISE CONSOLIDATED PERFORMANCE SUMMARY
    # =========================================================================
    row_idx += 1  # 1 blank spacing row
    
    # Title Banner for Consolidation Section
    ws.row_dimensions[row_idx].height = 24
    ws.merge_cells(start_row=row_idx, start_column=1, end_row=row_idx, end_column=10)
    acc_banner = ws.cell(row=row_idx, column=1, value="ACCOMMODATION-WISE CONSOLIDATED PERFORMANCE SUMMARY (HOSTEL vs DAY SCHOLAR)")
    acc_banner.font = font_acc_title
    acc_banner.alignment = align_center
    for c in range(1, 11):
        cell_b = ws.cell(row=row_idx, column=c)
        cell_b.fill = fill_header
        cell_b.border = grid_border
    row_idx += 1
    
    # Subheaders for Accommodation Table
    acc_headers = [
        "S.No", 
        "Accommodation Category", 
        "Total Students", 
        "Attended (>=1 Solved)", 
        "Q1 (Easy)", 
        "Q2 (Medium)", 
        "Q3 (Medium)", 
        "Q4 (Hard)", 
        "Total Solved", 
        "Participation %"
    ]
    ws.row_dimensions[row_idx].height = 24
    for c_idx, ah in enumerate(acc_headers, 1):
        c_cell = ws.cell(row=row_idx, column=c_idx, value=ah)
        c_cell.font = font_header
        c_cell.fill = fill_acc_subhdr
        c_cell.alignment = align_center_wrap
        c_cell.border = grid_border
    row_idx += 1
    
    # Row 1: Hostel
    h_pct = f"{(hostel_stats['attended'] / hostel_stats['count'] * 100):.1f}%" if hostel_stats['count'] > 0 else "0.0%"
    h_row = [
        1,
        "Hostel",
        hostel_stats["count"],
        hostel_stats["attended"],
        hostel_stats["q1"],
        hostel_stats["q2"],
        hostel_stats["q3"],
        hostel_stats["q4"],
        hostel_stats["total_solved"],
        h_pct
    ]
    ws.row_dimensions[row_idx].height = 20
    for c_idx, val in enumerate(h_row, 1):
        cell = ws.cell(row=row_idx, column=c_idx, value=val)
        cell.font = font_data
        cell.alignment = align_center
        cell.border = grid_border
    row_idx += 1
    
    # Row 2: Day Scholar
    ds_pct = f"{(ds_stats['attended'] / ds_stats['count'] * 100):.1f}%" if ds_stats['count'] > 0 else "0.0%"
    ds_row = [
        2,
        "Day Scholar",
        ds_stats["count"],
        ds_stats["attended"],
        ds_stats["q1"],
        ds_stats["q2"],
        ds_stats["q3"],
        ds_stats["q4"],
        ds_stats["total_solved"],
        ds_pct
    ]
    ws.row_dimensions[row_idx].height = 20
    for c_idx, val in enumerate(ds_row, 1):
        cell = ws.cell(row=row_idx, column=c_idx, value=val)
        cell.font = font_data
        cell.alignment = align_center
        cell.border = grid_border
    row_idx += 1
    
    # Row 3: Total Summary
    total_roster_cnt = len(students)
    total_attended_cnt = hostel_stats["attended"] + ds_stats["attended"]
    tot_pct = f"{(total_attended_cnt / total_roster_cnt * 100):.1f}%" if total_roster_cnt > 0 else "0.0%"
    tot_summary_row = [
        "",
        "TOTAL",
        total_roster_cnt,
        total_attended_cnt,
        sum_q1,
        sum_q2,
        sum_q3,
        sum_q4,
        sum_total_solved,
        tot_pct
    ]
    ws.row_dimensions[row_idx].height = 22
    for c_idx, val in enumerate(tot_summary_row, 1):
        cell = ws.cell(row=row_idx, column=c_idx, value=val)
        cell.font = font_bold
        cell.fill = fill_total_row
        cell.alignment = align_center
        cell.border = grid_border
    row_idx += 1
        
    # Apply column widths tailored for 10 columns
    widths = [8, 16, 30, 16, 12, 12, 13, 13, 12, 14]
    for col_idx, width in enumerate(widths, 1):
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = width
        
    from io import BytesIO
    out = BytesIO()
    wb.save(out)
    return out.getvalue()
