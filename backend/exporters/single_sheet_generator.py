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
    if not contest_name and target_session and getattr(target_session, "contest_name", None):
        contest_name = str(target_session.contest_name)
    contest_date = str(dataset.get("session_date") or dataset.get("sessionDate") or dataset.get("report_date") or "")
    if not contest_date and target_session and getattr(target_session, "session_date", None):
        contest_date = str(target_session.session_date)
    dept = dataset.get("deptFilter") or dataset.get("department") or "ALL"
    year = dataset.get("yearFilter") or dataset.get("year") or "ALL"
    
    # Resolve Contest Title
    import re
    c_match = re.search(r'(?:Weekly Contest|Biweekly Contest|WC|BW|Contest|\b)\s*(\d{2,4})\b', contest_name, re.IGNORECASE)
    contest_number = c_match.group(1) if c_match else ""
    if not contest_number:
        num_m = re.search(r'\d+', contest_name)
        contest_number = num_m.group(0) if num_m else ""

    if contest_number:
        single_sheet_title = f"STUDENT PERFORMANCE OF WEEKLY CONTEST {contest_number}"
        contest_display = f"Weekly Contest {contest_number}"
    elif contest_name:
        single_sheet_title = f"STUDENT PERFORMANCE OF {contest_name.upper()}"
        contest_display = contest_name
    else:
        single_sheet_title = "STUDENT PERFORMANCE OF WEEKLY CONTEST"
        contest_display = "Weekly Contest"

    # Resolve Full Department Name (no year cohort)
    dept_clean = str(dept or "").strip().upper()
    if "CSE(CS)" in dept_clean or "CSE (CS)" in dept_clean or dept_clean == "CS":
        dept_full_title = "DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING (CYBER SECURITY)"
    elif dept_clean == "CSE":
        dept_full_title = "DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING"
    elif dept_clean == "IT":
        dept_full_title = "DEPARTMENT OF INFORMATION TECHNOLOGY"
    elif dept_clean in ("AIDS", "AI&DS"):
        dept_full_title = "DEPARTMENT OF ARTIFICIAL INTELLIGENCE AND DATA SCIENCE"
    elif dept_clean == "ECE":
        dept_full_title = "DEPARTMENT OF ELECTRONICS AND COMMUNICATION ENGINEERING"
    elif dept_clean == "EEE":
        dept_full_title = "DEPARTMENT OF ELECTRICAL AND ELECTRONICS ENGINEERING"
    elif dept_clean == "MECH":
        dept_full_title = "DEPARTMENT OF MECHANICAL ENGINEERING"
    elif dept_clean in ("ALL", "ALL DEPARTMENTS", "NONE", ""):
        dept_full_title = "INSTITUTIONAL MASTER REPORT • ALL DEPARTMENTS"
    else:
        dept_full_title = f"DEPARTMENT OF {dept_clean}"

    # Apply Master College Identity Header (10 columns, no cohort year, no generated timestamp)
    next_row = apply_master_college_identity(
        ws=ws,
        report_title=single_sheet_title,
        department=dept,
        year=year,
        contest_name=contest_name,
        session_date=contest_date,
        total_roster=len(students),
        cols=10,
        show_cohort=False,
        show_generated_time=False,
        custom_dept_header=dept_full_title,
        exact_report_title=single_sheet_title
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
    
    # 10 Columns: S.No, Reg No, Name, Acc, Cutoff, Q1(Easy), Q2(Medium), Q3(Medium), Q4(Hard), Total Solved
    headers = [
        "S.No", 
        "Reg No", 
        "Name", 
        "Acc",
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
    
    count_q4 = 0
    count_q3 = 0
    count_q2 = 0
    count_q1 = 0
    count_q0 = 0
    count_below_20k = 0
    count_below_5k = 0

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
        
        if "HOSTEL" in raw_acc.upper() or raw_acc.upper() == "H":
            acc_val = "H"
            acc_is_hostel = True
        else:
            acc_val = "D"
            acc_is_hostel = False
            
        # 12th Cutoff determination
        raw_cutoff = None
        if st_obj and st_obj.twelfth_cutoff is not None:
            raw_cutoff = st_obj.twelfth_cutoff
        elif s.get("twelfth_cutoff") is not None:
            raw_cutoff = s.get("twelfth_cutoff")
        elif s.get("cutoff") is not None:
            raw_cutoff = s.get("cutoff")
            
        cutoff_disp: Any = ""
        if raw_cutoff is not None:
            try:
                co_val = float(raw_cutoff)
                if co_val > 0 and co_val == co_val: # check positive and not NaN
                    cutoff_disp = round(co_val, 2)
            except (ValueError, TypeError):
                cutoff_disp = ""
                
        # Aggregate global column counts
        sum_q1 += q1
        sum_q2 += q2
        sum_q3 += q3
        sum_q4 += q4
        sum_total_solved += solved_count
        # Aggregate solve categories
        if solved_count >= 4:
            count_q4 += 1
        elif solved_count == 3:
            count_q3 += 1
        elif solved_count == 2:
            count_q2 += 1
        elif solved_count == 1:
            count_q1 += 1
        else:
            count_q0 += 1

        # Check Global Ranking (< 20000)
        gr_val = s.get("global_rank") or s.get("contest_global_rank") or s.get("profile_rank")
        if not gr_val and st_obj:
            gr_val = getattr(st_obj, "contest_global_ranking", None) or getattr(st_obj, "global_rank", None)
            if not gr_val and hasattr(st_obj, "stats") and st_obj.stats:
                gr_val = getattr(st_obj.stats, "contest_global_ranking", None) or getattr(st_obj.stats, "global_rank", None)
        if gr_val not in (None, "", "—", "Unrated", "-"):
            try:
                gr_int = int(str(gr_val).replace("#", "").replace(",", "").strip())
                if 0 < gr_int < 20000:
                    count_below_20k += 1
            except (ValueError, TypeError):
                pass

        # Check Contest Rank (< 5000)
        cr_val = None
        if pr and pr.contest_rank:
            cr_val = pr.contest_rank
        elif vr and getattr(vr, "contest_rank", None):
            cr_val = vr.contest_rank
        else:
            cr_val = s.get("contest_rank") or s.get("rank")
        if cr_val not in (None, "", "—", "Unrated", "-"):
            try:
                cr_int = int(str(cr_val).replace("#", "").replace(",", "").strip())
                if 0 < cr_int < 5000:
                    count_below_5k += 1
            except (ValueError, TypeError):
                pass

        # Aggregate accommodation statistics
        is_attended = (solved_count > 0)
        target_group = hostel_stats if acc_is_hostel else ds_stats
        target_group["count"] += 1
        if is_attended:
            target_group["attended"] += 1
        target_group["q1"] += q1
        target_group["q2"] += q2
        target_group["q3"] += q3
        target_group["q4"] += q4
        target_group["total_solved"] += solved_count
        
        student_name = str(s.get("name") or s.get("student_name") or "").strip().upper()
        reg_no = str(s.get("reg_no") or s.get("register_no") or "").strip().upper()
        
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
    total_lbl_cell = ws.cell(row=row_idx, column=1, value=f"TOTAL SOLVED COUNT ({len(students)} STUDENTS)")
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
    h_pct_num = (hostel_stats['attended'] / hostel_stats['count']) if hostel_stats['count'] > 0 else 0.0
    h_row = [
        1,
        "Hostel (H)",
        hostel_stats["count"],
        hostel_stats["attended"],
        hostel_stats["q1"],
        hostel_stats["q2"],
        hostel_stats["q3"],
        hostel_stats["q4"],
        hostel_stats["total_solved"],
        h_pct_num
    ]
    ws.row_dimensions[row_idx].height = 20
    for c_idx, val in enumerate(h_row, 1):
        cell = ws.cell(row=row_idx, column=c_idx, value=val)
        cell.font = font_data
        cell.alignment = align_center
        cell.border = grid_border
        if c_idx == 10:
            cell.number_format = '0.0%'
    row_idx += 1
    
    # Row 2: Day Scholar
    ds_pct_num = (ds_stats['attended'] / ds_stats['count']) if ds_stats['count'] > 0 else 0.0
    ds_row = [
        2,
        "Day Scholar (D)",
        ds_stats["count"],
        ds_stats["attended"],
        ds_stats["q1"],
        ds_stats["q2"],
        ds_stats["q3"],
        ds_stats["q4"],
        ds_stats["total_solved"],
        ds_pct_num
    ]
    ws.row_dimensions[row_idx].height = 20
    for c_idx, val in enumerate(ds_row, 1):
        cell = ws.cell(row=row_idx, column=c_idx, value=val)
        cell.font = font_data
        cell.alignment = align_center
        cell.border = grid_border
        if c_idx == 10:
            cell.number_format = '0.0%'
    row_idx += 1
    
    # Row 3: Total Summary
    total_roster_cnt = len(students)
    total_attended_cnt = hostel_stats["attended"] + ds_stats["attended"]
    tot_pct_num = (total_attended_cnt / total_roster_cnt) if total_roster_cnt > 0 else 0.0
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
        tot_pct_num
    ]
    ws.row_dimensions[row_idx].height = 22
    for c_idx, val in enumerate(tot_summary_row, 1):
        cell = ws.cell(row=row_idx, column=c_idx, value=val)
        cell.font = font_bold
        cell.fill = fill_total_row
        cell.alignment = align_center
        cell.border = grid_border
        if c_idx == 10:
            cell.number_format = '0.0%'
    row_idx += 1

    # =========================================================================
    # SECTION: CONTEST PERFORMANCE & RANKING SUMMARY (CLEAN & SPACIOUS)
    # =========================================================================
    row_idx += 2  # 2 blank spacing rows for clean visual breathing room

    ws.row_dimensions[row_idx].height = 24
    ws.merge_cells(start_row=row_idx, start_column=1, end_row=row_idx, end_column=10)
    perf_banner = ws.cell(row=row_idx, column=1, value=f"CONTEST PERFORMANCE & PROBLEM-WISE SOLVE SUMMARY ({contest_display.upper()})")
    perf_banner.font = font_acc_title
    perf_banner.alignment = align_center
    for c in range(1, 11):
        cell_b = ws.cell(row=row_idx, column=c)
        cell_b.fill = fill_header
        cell_b.border = grid_border
    row_idx += 1

    # Header Row 1:
    # Contest Name & Date (Cols 1-2) | Questions Solved (Cols 3-7) | Global Rank (Col 8) | Contest Rank (Cols 9-10)
    ws.row_dimensions[row_idx].height = 26
    ws.merge_cells(start_row=row_idx, start_column=1, end_row=row_idx, end_column=2)
    c1 = ws.cell(row=row_idx, column=1, value=f"{contest_display}\n({contest_date or 'Session'})")
    c1.font = font_header
    c1.fill = fill_acc_subhdr
    c1.alignment = align_center_wrap
    for c in (1, 2):
        ws.cell(row=row_idx, column=c).border = grid_border
        ws.cell(row=row_idx, column=c).fill = fill_acc_subhdr

    ws.merge_cells(start_row=row_idx, start_column=3, end_row=row_idx, end_column=7)
    c2 = ws.cell(row=row_idx, column=3, value=f"Last Contest No of Ques Solved ({contest_display})")
    c2.font = font_header
    c2.fill = fill_acc_subhdr
    c2.alignment = align_center_wrap
    for c in range(3, 8):
        ws.cell(row=row_idx, column=c).border = grid_border
        ws.cell(row=row_idx, column=c).fill = fill_acc_subhdr

    c3 = ws.cell(row=row_idx, column=8, value="Below 20000")
    c3.font = font_header
    c3.fill = fill_acc_subhdr
    c3.alignment = align_center_wrap
    c3.border = grid_border

    ws.merge_cells(start_row=row_idx, start_column=9, end_row=row_idx, end_column=10)
    c4 = ws.cell(row=row_idx, column=9, value="Below 5000")
    c4.font = font_header
    c4.fill = fill_acc_subhdr
    c4.alignment = align_center_wrap
    for c in (9, 10):
        ws.cell(row=row_idx, column=c).border = grid_border
        ws.cell(row=row_idx, column=c).fill = fill_acc_subhdr
    row_idx += 1

    # Header Row 2:
    # Taken Count | 4 Qs | 3 Qs | 2 Qs | 1 Qs | 0 Qs | Global Rank | Contest Rank
    ws.row_dimensions[row_idx].height = 24
    ws.merge_cells(start_row=row_idx, start_column=1, end_row=row_idx, end_column=2)
    s1 = ws.cell(row=row_idx, column=1, value="Taken Count")
    s1.font = font_bold
    s1.fill = fill_total_row
    s1.alignment = align_center
    for c in (1, 2):
        ws.cell(row=row_idx, column=c).border = grid_border
        ws.cell(row=row_idx, column=c).fill = fill_total_row

    for c_i, val in enumerate(["4 Qs", "3 Qs", "2 Qs", "1 Qs", "0 Qs"], 3):
        sc = ws.cell(row=row_idx, column=c_i, value=val)
        sc.font = font_bold
        sc.fill = fill_total_row
        sc.alignment = align_center
        sc.border = grid_border

    s3 = ws.cell(row=row_idx, column=8, value="Global Rank")
    s3.font = font_bold
    s3.fill = fill_total_row
    s3.alignment = align_center
    s3.border = grid_border

    ws.merge_cells(start_row=row_idx, start_column=9, end_row=row_idx, end_column=10)
    s4 = ws.cell(row=row_idx, column=9, value="Contest Rank")
    s4.font = font_bold
    s4.fill = fill_total_row
    s4.alignment = align_center
    for c in (9, 10):
        ws.cell(row=row_idx, column=c).border = grid_border
        ws.cell(row=row_idx, column=c).fill = fill_total_row
    row_idx += 1

    # Data Row
    ws.row_dimensions[row_idx].height = 22
    ws.merge_cells(start_row=row_idx, start_column=1, end_row=row_idx, end_column=2)
    d1 = ws.cell(row=row_idx, column=1, value=total_attended_cnt)
    d1.font = font_bold
    d1.alignment = align_center
    for c in (1, 2):
        ws.cell(row=row_idx, column=c).border = grid_border

    for c_i, val in enumerate([count_q4, count_q3, count_q2, count_q1, count_q0], 3):
        dc = ws.cell(row=row_idx, column=c_i, value=val)
        dc.font = font_bold
        dc.alignment = align_center
        dc.border = grid_border

    d3 = ws.cell(row=row_idx, column=8, value=count_below_20k)
    d3.font = font_bold
    d3.alignment = align_center
    d3.border = grid_border

    ws.merge_cells(start_row=row_idx, start_column=9, end_row=row_idx, end_column=10)
    d4 = ws.cell(row=row_idx, column=9, value=count_below_5k)
    d4.font = font_bold
    d4.alignment = align_center
    for c in (9, 10):
        ws.cell(row=row_idx, column=c).border = grid_border
    row_idx += 1
        
    # Apply compact column widths tailored for 10 columns (Acc width 8, Cutoff width 10, total 14)
    widths = [8, 16, 28, 8, 10, 11, 11, 12, 11, 14]
    for col_idx, width in enumerate(widths, 1):
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = width

    # =========================================================================
    # SHEET 2: DEDICATED CONTEST PERFORMANCE, RANKINGS & TOP SOLVERS SUMMARY
    # =========================================================================
    ws2 = wb.create_sheet(title="Performance Summary")
    
    next_row2 = apply_master_college_identity(
        ws=ws2,
        report_title=f"CONTEST PERFORMANCE & SOLVERS SUMMARY • {contest_display.upper()}",
        department=dept,
        year=year,
        contest_name=contest_name,
        session_date=contest_date,
        total_roster=len(students),
        cols=8,
        show_cohort=False,
        show_generated_time=False,
        custom_dept_header=dept_full_title,
        exact_report_title=f"EXECUTIVE CONTEST PERFORMANCE & LEADERBOARD • {contest_display.upper()}"
    )
    
    r2 = next_row2 + 1
    
    # 1. Executive Summary Table
    ws2.row_dimensions[r2].height = 24
    ws2.merge_cells(start_row=r2, start_column=1, end_row=r2, end_column=8)
    sec1_hdr = ws2.cell(row=r2, column=1, value="1. INSTITUTIONAL CONTEST ENGAGEMENT & OVERALL METRICS")
    sec1_hdr.font = font_acc_title
    sec1_hdr.alignment = align_center
    for c in range(1, 9):
        ws2.cell(row=r2, column=c).fill = fill_header
        ws2.cell(row=r2, column=c).border = grid_border
    r2 += 1
    
    kpi_headers = ["Total Enrolled", "Contest Attended", "Turnout Rate", "4 Qs Solved", "3 Qs Solved", "2 Qs Solved", "Rank < 5,000", "Global < 20,000"]
    ws2.row_dimensions[r2].height = 22
    for c_idx, kh in enumerate(kpi_headers, 1):
        cell_kh = ws2.cell(row=r2, column=c_idx, value=kh)
        cell_kh.font = font_header
        cell_kh.fill = fill_acc_subhdr
        cell_kh.alignment = align_center_wrap
        cell_kh.border = grid_border
    r2 += 1
    
    turnout_pct = round((total_attended_cnt / len(students) * 100), 1) if len(students) > 0 else 0.0
    kpi_vals = [len(students), total_attended_cnt, f"{turnout_pct}%", count_q4, count_q3, count_q2, count_below_5k, count_below_20k]
    ws2.row_dimensions[r2].height = 22
    for c_idx, kv in enumerate(kpi_vals, 1):
        cell_kv = ws2.cell(row=r2, column=c_idx, value=kv)
        cell_kv.font = font_bold
        cell_kv.fill = fill_total_row
        cell_kv.alignment = align_center
        cell_kv.border = grid_border
    r2 += 2
    
    # 2. Problem-Wise Solve Distribution Table
    ws2.row_dimensions[r2].height = 24
    ws2.merge_cells(start_row=r2, start_column=1, end_row=r2, end_column=8)
    sec2_hdr = ws2.cell(row=r2, column=1, value=f"2. PROBLEM-WISE SOLVE BREAKDOWN ({contest_display.upper()})")
    sec2_hdr.font = font_acc_title
    sec2_hdr.alignment = align_center
    for c in range(1, 9):
        ws2.cell(row=r2, column=c).fill = fill_header
        ws2.cell(row=r2, column=c).border = grid_border
    r2 += 1
    
    dist_headers = ["S.No", "Problem Solve Category", "Questions Solved", "Student Count", "% of Cohort", "Participation Share", "Performance Tier", "Target Status"]
    ws2.row_dimensions[r2].height = 22
    for c_idx, dh in enumerate(dist_headers, 1):
        cell_dh = ws2.cell(row=r2, column=c_idx, value=dh)
        cell_dh.font = font_header
        cell_dh.fill = fill_acc_subhdr
        cell_dh.alignment = align_center_wrap
        cell_dh.border = grid_border
    r2 += 1
    
    total_roster_num = max(1, len(students))
    solve_tiers = [
        (1, "4 / 4 Questions Solved", "4 Qs", count_q4, f"{round((count_q4 / total_roster_num) * 100, 1)}%", "Grandmaster", "Top 1% Elite"),
        (2, "3 / 4 Questions Solved", "3 Qs", count_q3, f"{round((count_q3 / total_roster_num) * 100, 1)}%", "Advanced Solver", "High Performer"),
        (3, "2 / 4 Questions Solved", "2 Qs", count_q2, f"{round((count_q2 / total_roster_num) * 100, 1)}%", "Intermediate", "Consistent"),
        (4, "1 / 4 Questions Solved", "1 Q", count_q1, f"{round((count_q1 / total_roster_num) * 100, 1)}%", "Active Participant", "Foundational"),
        (5, "0 Questions / Absent", "0 Qs", count_q0, f"{round((count_q0 / total_roster_num) * 100, 1)}%", "Unattempted", "Needs Attention")
    ]
    
    for s_no, cat_name, q_lbl, cnt_val, pct_str, tier_name, target_st in solve_tiers:
        tier_row = [
            s_no,
            cat_name,
            q_lbl,
            cnt_val,
            pct_str,
            f"{round((cnt_val / max(1, total_attended_cnt)) * 100, 1)}% of Active" if total_attended_cnt > 0 else "0%",
            tier_name,
            target_st
        ]
        ws2.row_dimensions[r2].height = 20
        for c_idx, val in enumerate(tier_row, 1):
            cell = ws2.cell(row=r2, column=c_idx, value=val)
            cell.font = font_name if c_idx == 2 else (font_bold if c_idx in (4, 7) else font_data)
            cell.alignment = align_left if c_idx == 2 else align_center
            cell.border = grid_border
        r2 += 1
    r2 += 2
    
    # 3. Top Solvers & Elite Rankers Leaderboard
    ws2.row_dimensions[r2].height = 24
    ws2.merge_cells(start_row=r2, start_column=1, end_row=r2, end_column=8)
    sec3_hdr = ws2.cell(row=r2, column=1, value=f"3. TOP CONTEST SOLVERS & ELITE RANKERS LEADERBOARD ({contest_display.upper()})")
    sec3_hdr.font = font_acc_title
    sec3_hdr.alignment = align_center
    for c in range(1, 9):
        ws2.cell(row=r2, column=c).fill = fill_header
        ws2.cell(row=r2, column=c).border = grid_border
    r2 += 1
    
    lb_headers = ["Rank", "Register No", "Student Name", "Dept", "Year", "Solved Qs", "Contest Rank", "Contest Rating"]
    ws2.row_dimensions[r2].height = 22
    for c_idx, lh in enumerate(lb_headers, 1):
        cell_lh = ws2.cell(row=r2, column=c_idx, value=lh)
        cell_lh.font = font_header
        cell_lh.fill = fill_acc_subhdr
        cell_lh.alignment = align_center
        cell_lh.border = grid_border
    r2 += 1
    
    # Build list of top performers (sorted by solved_count desc, contest_rank asc)
    ranked_students = []
    for s in students:
        reg_no = str(s.get("reg_no") or s.get("register_no") or "").strip()
        reg_upper = reg_no.upper()
        pr = public_map.get(reg_upper)
        vr = virtual_map.get(reg_upper)
        
        q1_s = 1 if (pr and pr.q1) or (vr and vr.q1) or str(s.get("q1", "")).lower() in ("1", "true") else 0
        q2_s = 1 if (pr and pr.q2) or (vr and vr.q2) or str(s.get("q2", "")).lower() in ("1", "true") else 0
        q3_s = 1 if (pr and pr.q3) or (vr and vr.q3) or str(s.get("q3", "")).lower() in ("1", "true") else 0
        q4_s = 1 if (pr and pr.q4) or (vr and vr.q4) or str(s.get("q4", "")).lower() in ("1", "true") else 0
        
        tot_s = s.get("solved") or s.get("total_solved") or s.get("total_contest_solved") or 0
        try:
            tot_s_int = int(tot_s)
        except Exception:
            tot_s_int = 0
        s_count = max(tot_s_int, q1_s + q2_s + q3_s + q4_s)
        
        cr = None
        if pr and pr.contest_rank:
            cr = pr.contest_rank
        elif vr and getattr(vr, "contest_rank", None):
            cr = vr.contest_rank
        else:
            cr = s.get("contest_rank") or s.get("rank")
        
        try:
            cr_int = int(str(cr).replace("#", "").replace(",", "").strip()) if cr else 999999
        except Exception:
            cr_int = 999999
            
        rate_val = s.get("rating") or s.get("contest_rating") or s.get("current_rating") or ""
        st_obj = student_meta_map.get(reg_upper)
        if not rate_val and st_obj and hasattr(st_obj, "stats") and st_obj.stats:
            rate_val = getattr(st_obj.stats, "contest_rating", None) or ""
            
        rate_str = ""
        if rate_val not in (None, "", "—", "-", "0", 0):
            try:
                rate_str = str(round(float(rate_val), 1))
            except Exception:
                rate_str = str(rate_val)
                
        dept_str = str(s.get("department_code") or s.get("department") or (st_obj.department.code if st_obj and st_obj.department else "")).strip().upper()
        yr_str = str(s.get("year_level") or s.get("year") or (st_obj.year_level if st_obj else "")).strip()
        st_name = str(s.get("name") or s.get("student_name") or (st_obj.name if st_obj else "")).strip()
        
        if s_count > 0 or (cr_int < 999999 and cr_int > 0):
            ranked_students.append({
                "reg_no": reg_no,
                "name": st_name,
                "dept": dept_str,
                "year": yr_str,
                "solved": s_count,
                "rank": cr_int if cr_int < 999999 else "—",
                "rank_sort": cr_int,
                "rating": rate_str or "—"
            })
            
    ranked_students.sort(key=lambda x: (-x["solved"], x["rank_sort"]))
    
    if not ranked_students:
        ws2.merge_cells(start_row=r2, start_column=1, end_row=r2, end_column=8)
        no_data_cell = ws2.cell(row=r2, column=1, value="No active contest solves recorded for this scope.")
        no_data_cell.font = font_data
        no_data_cell.alignment = align_center
        no_data_cell.border = grid_border
        r2 += 1
    else:
        for idx_rank, st in enumerate(ranked_students[:50], 1): # Top 50 solvers
            row_vals = [
                idx_rank,
                st["reg_no"],
                st["name"],
                st["dept"],
                st["year"],
                f"{st['solved']} / 4",
                st["rank"],
                st["rating"]
            ]
            ws2.row_dimensions[r2].height = 20
            for c_idx, val in enumerate(row_vals, 1):
                cell = ws2.cell(row=r2, column=c_idx, value=val)
                cell.font = font_name if c_idx == 3 else (font_bold if c_idx in (1, 6) else font_data)
                cell.alignment = align_left if c_idx == 3 else align_center
                cell.border = grid_border
                if idx_rank <= 3:
                    cell.fill = fill_total_row
            r2 += 1
            
    # Set widths for Sheet 2
    ws2_widths = [8, 18, 30, 14, 10, 14, 16, 16]
    for c_i, w in enumerate(ws2_widths, 1):
        ws2.column_dimensions[get_column_letter(c_i)].width = w

    from io import BytesIO
    out = BytesIO()
    wb.save(out)
    return out.getvalue()
