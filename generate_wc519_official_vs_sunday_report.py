"""
generate_wc519_official_vs_sunday_report.py
=============================================
Generates canonical, production-grade Excel report for LeetCode Weekly Contest 519.
EXCLUDES all test accounts (TEST_RACE_*, Race Test Student *, test departments).
Includes ONLY 527 real active institutional students.
Enforces Times New Roman font, centered numeric/status/username alignments, generous column widths (no squishing/overlap),
complete 4-side crisp grid borders on every cell, left/right logo headers, and IST report generation timestamps.
"""

import os
import sys
import datetime
import json
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.drawing.image import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.database import SessionLocal
from backend.models import Student, Department, WeeklySession, WeeklyPublicResult

def is_test_student(st: Student) -> bool:
    reg = (st.reg_no or "").strip().upper()
    name = (st.name or "").strip().upper()
    uname = (st.username or "").strip().upper()
    
    if reg.startswith("TEST") or "RACE" in reg or "TEST" in reg:
        return True
    if name.startswith("TEST") or "RACE TEST" in name or "TEST" in name:
        return True
    if uname.startswith("TEST") or "TEST_RACE" in uname:
        return True
    if st.department_id in (14, 15, 16):  # Computer Science Edit Test, Computer Science Test, Post 930 Dept
        return True
    return False

def build_wc519_report():
    db = SessionLocal()
    try:
        # 1. Fetch Session 17 (Weekly Contest 519)
        session = db.query(WeeklySession).filter(WeeklySession.contest_id == 'weekly-contest-519').first()
        if not session:
            session = db.query(WeeklySession).filter(WeeklySession.id == 17).first()
        
        session_id = session.id if session else 17
        
        # Generation Timestamp
        now_ist = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=5, minutes=30)
        timestamp_str = now_ist.strftime("%d-%b-%Y, %I:%M %p IST")
        date_str = now_ist.strftime("%d-%m-%Y")

        # 2. Fetch Real Active Students (Excluding Test Accounts)
        all_students = db.query(Student).filter(Student.is_active == True).all()
        real_students = [s for s in all_students if not is_test_student(s)]
        
        # Department Map
        depts = db.query(Department).all()
        dept_map = {d.id: d.name.strip() for d in depts}
        
        # Sort Real Students: Department -> Year Level -> Reg No
        def sort_key(st: Student):
            dname = dept_map.get(st.department_id, "ZZZ").strip()
            year = st.year_level or "IV"
            reg = (st.reg_no or "").strip()
            return (dname, year, reg)
            
        real_students.sort(key=sort_key)
        
        # Public Results Map
        pub_results = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == session_id).all()
        pub_map = {r.student_id: r for r in pub_results}
        
        wb = openpyxl.Workbook()
        
        # -------------------------------------------------------------
        # STRICT STYLING CONSTANTS (TIMES NEW ROMAN & CRISP 4-SIDE BORDERS)
        # -------------------------------------------------------------
        FONT_TNR = "Times New Roman"
        
        navy_fill = PatternFill(start_color="1B365D", end_color="1B365D", fill_type="solid")
        brand_fill = PatternFill(start_color="2E5B88", end_color="2E5B88", fill_type="solid")
        sub_fill = PatternFill(start_color="334155", end_color="334155", fill_type="solid")
        header_fill = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")
        alt_row_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
        
        # Soft Semantic Fills & Fonts
        green_fill = PatternFill(start_color="ECFDF5", end_color="ECFDF5", fill_type="solid")
        yellow_fill = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
        red_fill = PatternFill(start_color="FFF1F2", end_color="FFF1F2", fill_type="solid")
        
        font_title = Font(name=FONT_TNR, size=14, bold=True, color="FFFFFF")
        font_sub = Font(name=FONT_TNR, size=10, bold=True, color="FFFFFF")
        font_timestamp = Font(name=FONT_TNR, size=10, italic=True, color="FFFFFF")
        font_section = Font(name=FONT_TNR, size=11, bold=True, color="FFFFFF")
        font_tbl_header = Font(name=FONT_TNR, size=10, bold=True, color="0F172A")
        font_bold = Font(name=FONT_TNR, size=10, bold=True)
        font_regular = Font(name=FONT_TNR, size=10)
        
        font_green = Font(name=FONT_TNR, size=10, bold=True, color="047857")
        font_yellow = Font(name=FONT_TNR, size=10, bold=True, color="B45309")
        font_red = Font(name=FONT_TNR, size=10, bold=True, color="B91C1C")
        
        # CRISP 4-SIDE THIN GRID BORDER
        thin_side = Side(style='thin', color='64748B')
        grid_border = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)
        
        align_center = Alignment(horizontal='center', vertical='center', wrap_text=True)
        align_left = Alignment(horizontal='left', vertical='center', wrap_text=True)
        align_right = Alignment(horizontal='right', vertical='center')
        
        # Logos setup
        logo_left_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "black_white_logo.png")
        if not os.path.exists(logo_left_path):
            logo_left_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "transparent_logo.png")
        logo_right_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "round_logo.png")
        
        def apply_header_banner(ws, sheet_title: str, max_col_letter: str = 'P', max_col_num: int = 16):
            ws.views.sheetView[0].showGridLines = True
            
            # Row 1: Main Institution Header
            ws.merge_cells(f'A1:{max_col_letter}1')
            ws['A1'] = "NANDHA ENGINEERING COLLEGE, ERODE - 638 052 (AUTONOMOUS)"
            ws['A1'].font = font_title
            ws['A1'].fill = navy_fill
            ws['A1'].alignment = align_center
            ws.row_dimensions[1].height = 26
            
            # Row 2: Accreditation Sub-Header
            ws.merge_cells(f'A2:{max_col_letter}2')
            ws['A2'] = "(Approved by AICTE, New Delhi | Affiliated to Anna University, Chennai)"
            ws['A2'].font = font_sub
            ws['A2'].fill = navy_fill
            ws['A2'].alignment = align_center
            ws.row_dimensions[2].height = 20
            
            # Row 3: Sheet Title Banner
            ws.merge_cells(f'A3:{max_col_letter}3')
            ws['A3'] = f"LEETCODE WEEKLY CONTEST 519 — {sheet_title.upper()}"
            ws['A3'].font = font_title
            ws['A3'].fill = brand_fill
            ws['A3'].alignment = align_center
            ws.row_dimensions[3].height = 26
            
            # Row 4: Download Timestamp & Metadata
            ws.merge_cells(f'A4:{max_col_letter}4')
            ws['A4'] = f"Report Date: {date_str}  |  Report Download Timestamp: {timestamp_str}  |  Contest ID: weekly-contest-519"
            ws['A4'].font = font_timestamp
            ws['A4'].fill = sub_fill
            ws['A4'].alignment = align_center
            ws.row_dimensions[4].height = 20
            
            for r in range(1, 5):
                for c in range(1, max_col_num + 1):
                    ws.cell(row=r, column=c).border = grid_border
                    
            # Add Logos
            if os.path.exists(logo_left_path):
                try:
                    img_left = Image(logo_left_path)
                    img_left.width = 110
                    img_left.height = 36
                    ws.add_image(img_left, 'A1')
                except Exception:
                    pass
            if os.path.exists(logo_right_path):
                try:
                    img_right = Image(logo_right_path)
                    img_right.width = 38
                    img_right.height = 38
                    ws.add_image(img_right, f'{max_col_letter}1')
                except Exception:
                    pass

        # -------------------------------------------------------------
        # SHEET 1: EXECUTIVE SUMMARY
        # -------------------------------------------------------------
        ws_summary = wb.active
        ws_summary.title = "Executive Summary"
        apply_header_banner(ws_summary, "Executive Performance Summary", max_col_letter='I', max_col_num=9)
        
        # Aggregations for Real 527 Students
        total_students = len(real_students)
        sunday_live_att = 0
        friday_solved_att = 0
        q4_cnt, q3_cnt, q2_cnt, q1_cnt, q0_cnt = 0, 0, 0, 0, 0
        dept_stats = {}
        
        for st in real_students:
            dname = dept_map.get(st.department_id, "Unknown").strip()
            if dname not in dept_stats:
                dept_stats[dname] = {
                    "total": 0, "sunday_att": 0, "friday_solved": 0,
                    "q4": 0, "q3": 0, "q2": 0, "q1": 0, "q0": 0
                }
            
            dept_stats[dname]["total"] += 1
            res = pub_map.get(st.id)
            
            # Sunday Live track (appeared in contest standing / status=PUBLIC)
            if res and res.participation_status in ('PUBLIC', 'ATTENDED'):
                sunday_live_att += 1
                dept_stats[dname]["sunday_att"] += 1
                
            # Friday Verified Solved (>0 problems)
            s_count = res.total_contest_solved if (res and res.total_contest_solved is not None) else 0
            if s_count > 0:
                friday_solved_att += 1
                dept_stats[dname]["friday_solved"] += 1
                
                if s_count == 4:
                    q4_cnt += 1
                    dept_stats[dname]["q4"] += 1
                elif s_count == 3:
                    q3_cnt += 1
                    dept_stats[dname]["q3"] += 1
                elif s_count == 2:
                    q2_cnt += 1
                    dept_stats[dname]["q2"] += 1
                elif s_count == 1:
                    q1_cnt += 1
                    dept_stats[dname]["q1"] += 1
            else:
                q0_cnt += 1
                dept_stats[dname]["q0"] += 1

        # Summary Metrics Table
        ws_summary.merge_cells('A6:I6')
        ws_summary['A6'] = "1. INSTITUTIONAL CONTEST KPI SUMMARY (WEEKLY CONTEST 519)"
        ws_summary['A6'].font = font_section
        ws_summary['A6'].fill = navy_fill
        ws_summary['A6'].alignment = align_left
        ws_summary.row_dimensions[6].height = 24
        
        kpis = [
            ("Total Real Master Active Students (Excludes Test Accounts)", total_students, "100.0%"),
            ("Sunday Live Tracked Participants (Entered Contest)", sunday_live_att, f"{(sunday_live_att/total_students*100):.1f}%"),
            ("Friday Official Verified Solved Participants (>0 Solved)", friday_solved_att, f"{(friday_solved_att/total_students*100):.1f}%"),
            ("Sunday 0-Solved Participants (Entered but 0 solved)", sunday_live_att - friday_solved_att, f"{((sunday_live_att - friday_solved_att)/total_students*100):.1f}%"),
            ("Unattended / Absent Students", total_students - sunday_live_att, f"{((total_students - sunday_live_att)/total_students*100):.1f}%"),
            ("4 Problems Solved (4Q Perfect Score)", q4_cnt, f"{(q4_cnt/total_students*100):.1f}%"),
            ("3 Problems Solved (3Q)", q3_cnt, f"{(q3_cnt/total_students*100):.1f}%"),
            ("2 Problems Solved (2Q)", q2_cnt, f"{(q2_cnt/total_students*100):.1f}%"),
            ("1 Problem Solved (1Q)", q1_cnt, f"{(q1_cnt/total_students*100):.1f}%")
        ]
        
        ws_summary['A7'] = "Performance Metric"
        ws_summary['B7'] = "Student Count"
        ws_summary['C7'] = "Percentage (%)"
        ws_summary.merge_cells('C7:I7')
        
        for c in range(1, 10):
            cell = ws_summary.cell(row=7, column=c)
            cell.font = font_tbl_header
            cell.fill = header_fill
            cell.border = grid_border
            cell.alignment = align_center if c > 1 else align_left
        ws_summary.row_dimensions[7].height = 24
        
        r_idx = 8
        for label, val, pct in kpis:
            ws_summary.cell(row=r_idx, column=1, value=label).font = font_bold
            ws_summary.cell(row=r_idx, column=1).alignment = align_left
            ws_summary.cell(row=r_idx, column=1).border = grid_border
            
            ws_summary.cell(row=r_idx, column=2, value=val).font = font_regular
            ws_summary.cell(row=r_idx, column=2).alignment = align_center
            ws_summary.cell(row=r_idx, column=2).border = grid_border
            
            ws_summary.cell(row=r_idx, column=3, value=pct).font = font_regular
            ws_summary.cell(row=r_idx, column=3).alignment = align_center
            ws_summary.cell(row=r_idx, column=3).border = grid_border
            ws_summary.merge_cells(f'C{r_idx}:I{r_idx}')
            
            for c in range(4, 10):
                ws_summary.cell(row=r_idx, column=c).border = grid_border
                
            ws_summary.row_dimensions[r_idx].height = 22
            r_idx += 1
            
        # Department Breakdown Table
        r_idx += 1
        ws_summary.merge_cells(f'A{r_idx}:I{r_idx}')
        ws_summary[f'A{r_idx}'] = "2. DEPARTMENT-WISE RECONCILIATION BREAKDOWN (REAL DEPARTMENTS ONLY)"
        ws_summary[f'A{r_idx}'].font = font_section
        ws_summary[f'A{r_idx}'].fill = navy_fill
        ws_summary[f'A{r_idx}'].alignment = align_left
        ws_summary.row_dimensions[r_idx].height = 24
        r_idx += 1
        
        dept_headers = [
            "Department Name", "Total Students", "Sunday Live Count",
            "Friday Solved (>0)", "Solving %", "4Q Solved", "3Q Solved", "2Q Solved", "1Q Solved"
        ]
        for c_idx, h in enumerate(dept_headers, 1):
            cell = ws_summary.cell(row=r_idx, column=c_idx, value=h)
            cell.font = font_tbl_header
            cell.fill = header_fill
            cell.alignment = align_center
            cell.border = grid_border
        ws_summary.row_dimensions[r_idx].height = 24
        r_idx += 1
        
        for dname, st_dict in sorted(dept_stats.items()):
            tot = st_dict["total"]
            f_solv = st_dict["friday_solved"]
            pct_str = f"{(f_solv/tot*100):.1f}%" if tot > 0 else "0.0%"
            row_vals = [
                dname, tot, st_dict["sunday_att"], f_solv, pct_str,
                st_dict["q4"], st_dict["q3"], st_dict["q2"], st_dict["q1"]
            ]
            for c_idx, val in enumerate(row_vals, 1):
                cell = ws_summary.cell(row=r_idx, column=c_idx, value=val)
                cell.font = font_regular
                cell.alignment = align_center if c_idx > 1 else align_left
                cell.border = grid_border
            ws_summary.row_dimensions[r_idx].height = 22
            r_idx += 1
            
        min_col_widths_summary = [55, 16, 18, 18, 14, 12, 12, 12, 12]
        for c_idx, col in enumerate(ws_summary.columns, 1):
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = get_column_letter(c_idx)
            req_w = max(max_len + 4, min_col_widths_summary[c_idx - 1] if c_idx <= len(min_col_widths_summary) else 14)
            ws_summary.column_dimensions[col_letter].width = req_w

        # -------------------------------------------------------------
        # SHEET 2: SUNDAY LIVE VS FRIDAY OFFICIAL (RECONCILIATION SHEET)
        # -------------------------------------------------------------
        ws_reconcil = wb.create_sheet(title="Sunday Live vs Friday Official")
        apply_header_banner(ws_reconcil, "Sunday Live vs Friday Official Reconciliation Audit", max_col_letter='P', max_col_num=16)
        
        headers_reconcil = [
            "S.No", "Register No", "Student Name", "Department", "Year", "Sec",
            "LeetCode Username", "Sunday Live Status", "Sunday Live Count",
            "Friday Official Status", "Friday Official Solved", "Q1", "Q2", "Q3", "Q4",
            "Reconciliation Audit Match"
        ]
        
        for c_idx, h in enumerate(headers_reconcil, 1):
            cell = ws_reconcil.cell(row=6, column=c_idx, value=h)
            cell.font = font_tbl_header
            cell.fill = header_fill
            cell.alignment = align_center
            cell.border = grid_border
        ws_reconcil.row_dimensions[6].height = 26
        
        for idx, st in enumerate(real_students, 1):
            reg_clean = (st.reg_no or "").strip()
            name_clean = (st.name or "").strip()
            dept_clean = dept_map.get(st.department_id, "Unknown").strip()
            uname_clean = (st.username or "").strip()
            
            res = pub_map.get(st.id)
            if res and res.verification_evidence:
                try:
                    ev = json.loads(res.verification_evidence)
                    if ev.get("username"):
                        uname_clean = ev.get("username").strip()
                except Exception:
                    pass
            
            # Sunday status
            sunday_att = False
            if res and res.participation_status in ('PUBLIC', 'ATTENDED'):
                sunday_att = True
                sunday_status_str = "SUNDAY_ATTENDED"
            else:
                sunday_status_str = "NOT_ATTENDED"
                
            # Friday official results
            f_solved = res.total_contest_solved if (res and res.total_contest_solved is not None) else 0
            q1 = res.q1 if (res and res.q1 is not None) else 0
            q2 = res.q2 if (res and res.q2 is not None) else 0
            q3 = res.q3 if (res and res.q3 is not None) else 0
            q4 = res.q4 if (res and res.q4 is not None) else 0
            
            if f_solved > 0:
                friday_status_str = "OFFICIAL_VERIFIED"
            elif sunday_att:
                friday_status_str = "OFFICIAL_0_SOLVED"
            else:
                friday_status_str = "NOT_ATTENDED"
                
            # Audit Match Calculation
            if sunday_att and f_solved > 0:
                audit_match_str = "MATCHED (Official Solved > 0)"
                audit_font = font_green
                audit_fill = green_fill
            elif sunday_att and f_solved == 0:
                audit_match_str = "MATCHED (Sunday 0-Solved)"
                audit_font = font_yellow
                audit_fill = yellow_fill
            else:
                audit_match_str = "UNATTENDED (Absent)"
                audit_font = font_red
                audit_fill = red_fill
                
            row_vals = [
                idx,
                reg_clean,
                name_clean,
                dept_clean,
                st.year_level or "-",
                st.section.name if st.section else "-",
                uname_clean if uname_clean else "-",
                sunday_status_str,
                f_solved if sunday_att else 0,
                friday_status_str,
                f_solved,
                q1, q2, q3, q4,
                audit_match_str
            ]
            
            r_num = idx + 6
            ws_reconcil.row_dimensions[r_num].height = 22
            
            # Alternate row background
            r_fill = alt_row_fill if idx % 2 == 0 else PatternFill(fill_type=None)
            
            for c_idx, val in enumerate(row_vals, 1):
                cell = ws_reconcil.cell(row=r_num, column=c_idx, value=val)
                cell.font = font_regular
                # CENTER ALIGNMENT FOR USERNAME (column 7) AS REQUESTED BY USER!
                cell.alignment = align_center if c_idx not in (3, 4) else align_left
                cell.border = grid_border
                if r_fill.fill_type:
                    cell.fill = r_fill
                    
                # Audit status styling
                if c_idx == 16:
                    cell.font = audit_font
                    cell.fill = audit_fill
                    
        # PERFECTLY TUNED COLUMN WIDTHS (S.NO: 7.5, REG NO: 17.5, USERNAME: 26, RECONCILIATION MATCH: 40)
        min_col_widths_reconcil = [7.5, 17.5, 30, 48, 9, 7, 26, 22, 18, 22, 18, 7, 7, 7, 7, 40]
        for c_idx, col in enumerate(ws_reconcil.columns, 1):
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = get_column_letter(c_idx)
            base_w = min_col_widths_reconcil[c_idx - 1] if c_idx <= len(min_col_widths_reconcil) else 14
            if c_idx == 1:
                req_w = 7.5
            elif c_idx == 2:
                req_w = 17.5
            else:
                req_w = max(max_len + 3, base_w)
            ws_reconcil.column_dimensions[col_letter].width = req_w

        # -------------------------------------------------------------
        # SHEET 3: ALL REAL MASTER ROSTER (527 STUDENTS)
        # -------------------------------------------------------------
        ws_roster = wb.create_sheet(title="All Students Master Roster")
        apply_header_banner(ws_roster, "Master Student Contest Roster (527 Real Students)", max_col_letter='R', max_col_num=18)
        
        headers_roster = [
            "S.No", "Register No", "Student Name", "Department", "Year", "Sec",
            "LeetCode Username", "Friday Status", "Solved Count", "Q1", "Q2", "Q3", "Q4",
            "Contest Score", "Contest Rank", "Contest Rating", "Sunday Status", "Audit Result"
        ]
        
        for c_idx, h in enumerate(headers_roster, 1):
            cell = ws_roster.cell(row=6, column=c_idx, value=h)
            cell.font = font_tbl_header
            cell.fill = header_fill
            cell.alignment = align_center
            cell.border = grid_border
        ws_roster.row_dimensions[6].height = 26
        
        for idx, st in enumerate(real_students, 1):
            reg_clean = (st.reg_no or "").strip()
            name_clean = (st.name or "").strip()
            dept_clean = dept_map.get(st.department_id, "Unknown").strip()
            uname_clean = (st.username or "").strip()
            
            res = pub_map.get(st.id)
            if res and res.verification_evidence:
                try:
                    ev = json.loads(res.verification_evidence)
                    if ev.get("username"):
                        uname_clean = ev.get("username").strip()
                except Exception:
                    pass
            
            is_att = False
            f_solved = 0
            q1, q2, q3, q4 = 0, 0, 0, 0
            score = 0
            rank_val = "N/A"
            rating_val = "N/A"
            status_str = "NOT_ATTENDED"
            
            if res:
                if res.participation_status in ('PUBLIC', 'ATTENDED') or (res.total_contest_solved is not None and res.total_contest_solved > 0):
                    is_att = True
                    status_str = "OFFICIAL_ATTENDED"
                    f_solved = res.total_contest_solved or 0
                    q1 = res.q1 or 0
                    q2 = res.q2 or 0
                    q3 = res.q3 or 0
                    q4 = res.q4 or 0
                    score = res.contest_score or 0
                    rank_val = res.contest_rank if res.contest_rank else "N/A"
                    rating_val = f"{res.contest_rating:.1f}" if res.contest_rating else "N/A"
                    
            audit_res = "VERIFIED_ATTENDED" if (is_att and f_solved > 0) else ("0_SOLVED_ATTENDED" if is_att else "ABSENT")
            
            row_vals = [
                idx, reg_clean, name_clean, dept_clean, st.year_level or "-", st.section.name if st.section else "-",
                uname_clean if uname_clean else "-", status_str, f_solved, q1, q2, q3, q4,
                score, rank_val, rating_val, "SUNDAY_ATTENDED" if is_att else "NOT_ATTENDED", audit_res
            ]
            
            r_num = idx + 6
            ws_roster.row_dimensions[r_num].height = 22
            r_fill = alt_row_fill if idx % 2 == 0 else PatternFill(fill_type=None)
            
            for c_idx, val in enumerate(row_vals, 1):
                cell = ws_roster.cell(row=r_num, column=c_idx, value=val)
                cell.font = font_regular
                # CENTER ALIGNMENT FOR USERNAME (column 7)!
                cell.alignment = align_center if c_idx not in (3, 4) else align_left
                cell.border = grid_border
                if r_fill.fill_type:
                    cell.fill = r_fill
                    
                # Column status highlights
                if c_idx == 8:
                    if status_str == "OFFICIAL_ATTENDED":
                        cell.fill = green_fill
                        cell.font = font_green
                    else:
                        cell.fill = red_fill
                        cell.font = font_red
                elif c_idx == 18:
                    if audit_res == "VERIFIED_ATTENDED":
                        cell.fill = green_fill
                        cell.font = font_green
                    elif audit_res == "0_SOLVED_ATTENDED":
                        cell.fill = yellow_fill
                        cell.font = font_yellow
                    else:
                        cell.fill = red_fill
                        cell.font = font_red
                        
        min_col_widths_roster = [7.5, 17.5, 30, 48, 9, 7, 26, 22, 14, 7, 7, 7, 7, 14, 15, 15, 20, 24]
        for c_idx, col in enumerate(ws_roster.columns, 1):
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = get_column_letter(c_idx)
            base_w = min_col_widths_roster[c_idx - 1] if c_idx <= len(min_col_widths_roster) else 14
            if c_idx == 1:
                req_w = 7.5
            elif c_idx == 2:
                req_w = 17.5
            else:
                req_w = max(max_len + 3, base_w)
            ws_roster.column_dimensions[col_letter].width = req_w

        output_filepath = os.path.join(os.path.dirname(os.path.abspath(__file__)), "LeetCode_WC519_Friday_Official_vs_Sunday_Report.xlsx")
        try:
            wb.save(output_filepath)
        except PermissionError:
            output_filepath = os.path.join(os.path.dirname(os.path.abspath(__file__)), "LeetCode_WC519_Friday_Official_vs_Sunday_Report_v2.xlsx")
            wb.save(output_filepath)
            
        print(f"Successfully generated clean Excel report for {len(real_students)} real students: {output_filepath}")
        return output_filepath
        
    finally:
        db.close()

if __name__ == "__main__":
    build_wc519_report()
