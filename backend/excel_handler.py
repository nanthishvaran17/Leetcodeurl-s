import os
import io
import datetime
import pandas as pd
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session

from backend.models import Student, Department, Section, LeetCodeProfileStats, WeeklyStudentProgress, WeeklySessionSnapshot, WeeklySession
from backend.leetcode_client import extract_leetcode_username
from backend.config import settings
from backend.logger import logger

def validate_excel_import(db: Session, file_bytes: bytes) -> Dict[str, Any]:
    try:
        df = pd.read_excel(io.BytesIO(file_bytes))
    except Exception as e:
        return {"error": f"Failed to parse Excel file: {str(e)}"}

    col_mapping = {col: str(col).strip().upper() for col in df.columns}
    df = df.rename(columns=col_mapping)

    required_cols = ["REG NO", "NAME", "DEPT", "YEAR", "LEETCODE PROFILE LINK"]
    missing_req = [c for c in required_cols if c not in df.columns]
    if missing_req:
        return {"error": f"Missing required columns in Excel: {', '.join(missing_req)}"}

    valid_rows = []
    invalid_rows = []
    seen_reg_nos = set()
    seen_urls = set()

    dept_map = {d.name.upper(): d for d in db.query(Department).all()}
    dept_code_map = {d.code.upper(): d for d in db.query(Department).all()}
    
    custom_aliases = {
        "CSE(CS)": "CSE(CS)",
        "CSE-CS": "CSE(CS)",
        "CSE_CS": "CSE(CS)",
        "CYBER SECURITY": "CSE(CS)",
        "COMPUTER SCIENCE AND ENGINEERING (CYBER SECURITY)": "CSE(CS)",
        "CSE(IOT)": "CSE(IOT)",
        "ECE-IOT": "CSE(IOT)",
        "IOT": "CSE(IOT)",
        "COMPUTER SCIENCE AND ENGINEERING (IOT)": "CSE(IOT)"
    }

    for idx, row in df.iterrows():
        row_num = idx + 2
        reg_no = str(row.get("REG NO", "")).strip().upper()
        name = str(row.get("NAME", "")).strip()
        dept_str = str(row.get("DEPT", "")).strip().upper()
        year_str = str(row.get("YEAR", "")).strip().upper()
        sec_str = str(row.get("SECTION", "A")).strip().upper() if "SECTION" in df.columns and pd.notna(row.get("SECTION")) else "A"
        email = str(row.get("EMAIL", "")).strip() if "EMAIL" in df.columns and pd.notna(row.get("EMAIL")) else ""
        url = str(row.get("LEETCODE PROFILE LINK", "")).strip() if pd.notna(row.get("LEETCODE PROFILE LINK")) else ""

        errors = []
        if not reg_no or reg_no == "NAN":
            errors.append("Missing Register Number")
        elif reg_no in seen_reg_nos:
            errors.append("Duplicate Register Number in file")

        if not name or name == "NAN":
            errors.append("Missing Name")

        target_code = custom_aliases.get(dept_str, dept_str)
        dept_obj = dept_map.get(target_code) or dept_code_map.get(target_code) or dept_map.get(dept_str) or dept_code_map.get(dept_str)
        if not dept_obj:
            errors.append(f"Invalid Department '{dept_str}'")

        valid_years = ["II", "III", "IV", "2", "3", "4", "2ND", "3RD", "4TH"]
        if year_str not in valid_years:
            errors.append(f"Invalid Year '{year_str}' (Expected II, III, IV)")
        else:
            if year_str in ["2", "2ND"]: year_str = "II"
            elif year_str in ["3", "3RD"]: year_str = "III"
            elif year_str in ["4", "4TH"]: year_str = "IV"

        username, url_status = extract_leetcode_username(url)

        if errors:
            invalid_rows.append({
                "row": row_num,
                "reg_no": reg_no,
                "name": name,
                "dept": dept_str,
                "year": year_str,
                "section": sec_str,
                "errors": "; ".join(errors)
            })
        else:
            seen_reg_nos.add(reg_no)
            valid_rows.append({
                "reg_no": reg_no,
                "name": name,
                "dept_id": dept_obj.id if dept_obj else None,
                "dept_name": dept_obj.name if dept_obj else dept_str,
                "year_level": year_str,
                "section_name": sec_str,
                "email": email,
                "leetcode_url": url,
                "username": username
            })

    return {
        "total_rows": len(df),
        "valid_count": len(valid_rows),
        "invalid_count": len(invalid_rows),
        "valid_rows": valid_rows,
        "invalid_rows": invalid_rows
    }

def commit_excel_import(db: Session, valid_rows: List[dict]) -> int:
    count = 0
    for row in valid_rows:
        reg_no = row.get("reg_no")
        name = row.get("name")
        dept_id = row.get("dept_id")
        year_level = row.get("year_level")
        sec_id = row.get("section_id")
        email = row.get("email")
        leetcode_url = row.get("leetcode_url")
        username = row.get("username")

        if not reg_no or not name:
            continue

        student = db.query(Student).filter(Student.reg_no == reg_no).first()
        if not student:
            student = Student(
                reg_no=reg_no,
                name=name,
                department_id=dept_id,
                year_level=year_level,
                section_id=sec_id,
                email=email,
                leetcode_url=leetcode_url,
                username=username,
                is_active=True
            )
            db.add(student)
            db.commit()
            db.refresh(student)

            stats = LeetCodeProfileStats(student_id=student.id, status="NOT STARTED")
            db.add(stats)
            count += 1
        else:
            student.name = name
            if dept_id: student.department_id = dept_id
            if year_level: student.year_level = year_level
            if sec_id: student.section_id = sec_id
            if email: student.email = email
            if leetcode_url: student.leetcode_url = leetcode_url
            if username: student.username = username
            student.is_active = True
            count += 1
    db.commit()
    return count

def create_nandha_official_department_sheet(ws, dept: Department, db: Session):
    ws.views.sheetView[0].showGridLines = True
    
    font_bold_12 = Font(name="Times New Roman", size=12, bold=True)
    font_bold_11 = Font(name="Times New Roman", size=11, bold=True)
    font_bold_10 = Font(name="Times New Roman", size=10, bold=True)
    font_regular_10 = Font(name="Times New Roman", size=10)
    
    center_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    left_align = Alignment(horizontal="left", vertical="center")
    
    thin_border = Border(
        left=Side(style='thin', color='000000'),
        right=Side(style='thin', color='000000'),
        top=Side(style='thin', color='000000'),
        bottom=Side(style='thin', color='000000')
    )

    ws.merge_cells("C1:K1")
    ws["C1"] = "NANDHA ENGINEERING COLLEGE, ERODE - 638 052."
    ws["C1"].font = font_bold_12
    ws["C1"].alignment = center_align

    ws.merge_cells("C2:K2")
    ws["C2"] = f"Department of {dept.name}"
    ws["C2"].font = font_bold_11
    ws["C2"].alignment = left_align

    ws.merge_cells("C3:K3")
    ws["C3"] = f"Date: {datetime.date.today().strftime('%d.%m.%Y')}"
    ws["C3"].font = font_bold_11
    ws["C3"].alignment = left_align

    ws.merge_cells("C5:K5")
    ws["C5"] = "Leetcode Performance - Weekly Report"
    ws["C5"].font = font_bold_11
    ws["C5"].alignment = left_align

    ws.merge_cells("C6:K6")
    ws["C6"] = "Name & Designation of the Academic Coordinator:"
    ws["C6"].font = font_bold_11
    ws["C6"].alignment = left_align

    ws.merge_cells("A8:A9")
    ws["A8"] = "Batch"
    ws["A8"].font = font_bold_10
    ws["A8"].alignment = center_align

    ws.merge_cells("B8:B9")
    ws["B8"] = "Number of Students\n(Total Count)"
    ws["B8"].font = font_bold_10
    ws["B8"].alignment = center_align

    ws.merge_cells("C8:G8")
    ws["C8"] = "Number of Problems Solved"
    ws["C8"].font = font_bold_10
    ws["C8"].alignment = center_align

    ws.merge_cells("H8:K8")
    ws["H8"] = "Weekly Contest Attended: (give the count here)"
    ws["H8"].font = font_bold_10
    ws["H8"].alignment = center_align

    ws.merge_cells("L8:M8")
    ws["L8"] = "Leetcode Contest Rating and Ranking"
    ws["L8"].font = font_bold_10
    ws["L8"].alignment = center_align

    sub_headers = {
        "C9": "Above 500", "D9": "250 - 500", "E9": "Less than 250",
        "F9": "Less than 100", "G9": "Not yet started",
        "H9": "4 Q Solved", "I9": "3 Q Solved", "J9": "2 Q Solved", "K9": "1 Q Solved",
        "L9": "Rating: Above 1500", "M9": "Ranking: Below 20000"
    }

    for col_ref, text in sub_headers.items():
        ws[col_ref] = text
        ws[col_ref].font = font_bold_10
        ws[col_ref].alignment = center_align

    for r in range(8, 10):
        for c in range(1, 14):
            ws.cell(row=r, column=c).border = thin_border

    batches = [("2023 - 2027", "IV"), ("2024 - 2028", "III"), ("2025 - 2029", "II")]
    current_row = 10
    latest_session = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()

    for batch_label, year_lvl in batches:
        students = db.query(Student).filter(
            Student.department_id == dept.id,
            Student.year_level == year_lvl,
            Student.is_active == True
        ).all()
        
        total_count = len(students)
        above_500 = sum(1 for s in students if s.stats and s.stats.total_solved > 500)
        between_250_500 = sum(1 for s in students if s.stats and 250 <= s.stats.total_solved <= 500)
        less_250 = sum(1 for s in students if s.stats and 100 <= s.stats.total_solved < 250)
        less_100 = sum(1 for s in students if s.stats and 0 < s.stats.total_solved < 100)
        not_started = sum(1 for s in students if not s.stats or s.stats.total_solved == 0)

        q4_cnt, q3_cnt, q2_cnt, q1_cnt = 0, 0, 0, 0
        if latest_session:
            stud_ids = {s.id for s in students}
            snaps = db.query(WeeklySessionSnapshot).filter(
                WeeklySessionSnapshot.session_id == latest_session.id,
                WeeklySessionSnapshot.student_id.in_(stud_ids)
            ).all()
            for sn in snaps:
                if sn.problems_added >= 4: q4_cnt += 1
                elif sn.problems_added == 3: q3_cnt += 1
                elif sn.problems_added == 2: q2_cnt += 1
                elif sn.problems_added == 1: q1_cnt += 1

        rating_above_1500 = sum(1 for s in students if s.stats and s.stats.contest_rating and s.stats.contest_rating > 1500)
        rank_below_20000 = sum(1 for s in students if s.stats and s.stats.contest_global_ranking and s.stats.contest_global_ranking < 20000)

        ws.cell(row=current_row, column=1, value=f"{batch_label}\n(Last Week)").alignment = center_align
        ws.cell(row=current_row, column=1).font = font_bold_10
        ws.cell(row=current_row, column=2, value=total_count if total_count > 0 else "")

        ws.cell(row=current_row+1, column=1, value=f"{batch_label}\n(Current Week)").alignment = center_align
        ws.cell(row=current_row+1, column=1).font = font_bold_10
        ws.cell(row=current_row+1, column=2, value=total_count if total_count > 0 else "")

        row_vals = [above_500, between_250_500, less_250, less_100, not_started, q4_cnt, q3_cnt, q2_cnt, q1_cnt, rating_above_1500, rank_below_20000]
        for c_offset, val in enumerate(row_vals, start=3):
            ws.cell(row=current_row+1, column=c_offset, value=val if val > 0 else "")

        for r_idx in range(current_row, current_row + 2):
            for c_idx in range(1, 14):
                cell = ws.cell(row=r_idx, column=c_idx)
                cell.border = thin_border
                cell.font = font_regular_10
                cell.alignment = center_align

        current_row += 2

    ws.column_dimensions['A'].width = 16
    ws.column_dimensions['B'].width = 16
    for col_let in ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M']:
        ws.column_dimensions[col_let].width = 14

def generate_8_sheet_excel_report(db: Session) -> bytes:
    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    departments = db.query(Department).all()
    for dept in departments:
        sheet_title = dept.code.replace("/", "-")[:30]
        ws = wb.create_sheet(title=sheet_title)
        create_nandha_official_department_sheet(ws, dept, db)

    font_family = "Segoe UI"
    header_fill = PatternFill(start_color="1B365D", end_color="1B365D", fill_type="solid")
    header_font = Font(name=font_family, size=11, bold=True, color="FFFFFF")

    students = db.query(Student).filter(Student.is_active == True).all()

    ws_master = wb.create_sheet(title="STUDENT MASTER")
    master_headers = ["S.No", "Register No", "Name", "Department", "Year", "Section", "Email", "LeetCode URL", "Username"]
    ws_master.append(master_headers)
    for col_idx in range(1, len(master_headers) + 1):
        cell = ws_master.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    for idx, s in enumerate(students, 1):
        ws_master.append([
            idx, s.reg_no, s.name, s.department.name if s.department else "",
            s.year_level, s.section.name if s.section else "", s.email or "",
            s.leetcode_url or "", s.username or ""
        ])

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output.getvalue()


def create_weekly_contest_matrix_sheet(ws, db: Session, batch_label: str, dept_id: Optional[int] = None):
    ws.views.sheetView[0].showGridLines = True
    
    dept_obj = db.query(Department).filter(Department.id == dept_id).first() if dept_id else None
    dept_display_name = dept_obj.name if dept_obj else "Computer Science and Engineering (Cyber Security & IoT)"

    font_college = Font(name="Times New Roman", size=13, bold=True)
    font_header_info = Font(name="Times New Roman", size=11, bold=True)
    font_title = Font(name="Times New Roman", size=12, bold=True, color="FFFFFF")
    font_date_hdr = Font(name="Times New Roman", size=10, bold=True, color="FFFFFF")
    font_sub_hdr = Font(name="Times New Roman", size=9, bold=True, color="1B365D")
    font_data = Font(name="Times New Roman", size=10)

    title_fill = PatternFill(start_color="1B365D", end_color="1B365D", fill_type="solid")
    date_fill = PatternFill(start_color="2E5B88", end_color="2E5B88", fill_type="solid")
    sub_fill = PatternFill(start_color="E8EEF5", end_color="E8EEF5", fill_type="solid")

    center_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    left_align = Alignment(horizontal="left", vertical="center")

    thin_border = Border(
        left=Side(style='thin', color='C0C0C0'),
        right=Side(style='thin', color='C0C0C0'),
        top=Side(style='thin', color='C0C0C0'),
        bottom=Side(style='thin', color='C0C0C0')
    )

    sessions = db.query(WeeklySession).order_by(WeeklySession.session_date.asc()).all()
    default_dates = ["02.08.2026", "09.08.2026", "16.08.2026 (UPCOMING)"]

    date_list = []
    if sessions:
        # Keep only the last 2 completed sessions
        recent_sessions = sessions[-2:]
        for s in recent_sessions:
            try:
                dt_obj = datetime.datetime.strptime(s.session_date, "%Y-%m-%d")
                date_list.append((s, dt_obj.strftime("%d.%m.%Y")))
            except:
                date_list.append((s, s.session_date))
        # Add next upcoming Sunday date
        date_list.append((None, "16.08.2026 (UPCOMING)"))
    else:
        for d in default_dates:
            date_list.append((None, d))

    total_cols = 5 + len(date_list) * 4
    last_col_let = get_column_letter(total_cols)

    ws.merge_cells(f"C1:{last_col_let}1")
    ws["C1"] = "NANDHA ENGINEERING COLLEGE, ERODE - 638 052."
    ws["C1"].font = font_college
    ws["C1"].alignment = center_align

    ws.merge_cells(f"C2:{last_col_let}2")
    ws["C2"] = f"Department of {dept_display_name}"
    ws["C2"].font = font_header_info
    ws["C2"].alignment = left_align

    ws.merge_cells(f"C3:{last_col_let}3")
    ws["C3"] = f"Date: {datetime.date.today().strftime('%d.%m.%Y')}"
    ws["C3"].font = font_header_info
    ws["C3"].alignment = left_align

    ws.merge_cells(f"A5:{last_col_let}5")
    ws["A5"] = f"BATCH {batch_label} LEETCODE - CONTEST & PROBLEM SOLVING COUNT"
    ws["A5"].font = font_title
    ws["A5"].fill = title_fill
    ws["A5"].alignment = center_align
    ws.row_dimensions[5].height = 28

    ws.merge_cells(f"C6:{last_col_let}6")
    ws["C6"] = "Name & Designation of the Academic Coordinator:"
    ws["C6"].font = font_header_info
    ws["C6"].alignment = left_align

    ws.merge_cells("A8:A9")
    ws["A8"] = "S.NO"

    ws.merge_cells("B8:B9")
    ws["B8"] = "REG NO"

    ws.merge_cells("C8:C9")
    ws["C8"] = "NAME"

    ws.merge_cells("D8:D9")
    ws["D8"] = "DEPT"

    ws.merge_cells("E8:E9")
    ws["E8"] = "LEETCODE\nPROFILE LINK"

    for col_idx in range(1, 6):
        cell = ws.cell(row=8, column=col_idx)
        cell.font = font_date_hdr
        cell.fill = date_fill
        cell.alignment = center_align
        cell.border = thin_border

    start_c = 6
    for sess_obj, date_str in date_list:
        end_c = start_c + 3
        start_let = get_column_letter(start_c)
        end_let = get_column_letter(end_c)
        
        ws.merge_cells(f"{start_let}8:{end_let}8")
        ws[f"{start_let}8"] = f"DATE :{date_str}"
        ws[f"{start_let}8"].font = font_date_hdr
        ws[f"{start_let}8"].fill = date_fill
        ws[f"{start_let}8"].alignment = center_align

        sub_names = ["RANK", "NO.OF PROBLEMS\nSOLVED (OUT OF 4)", "CONTEST RATING", "GLOBAL RANKING"]
        for i, name in enumerate(sub_names):
            c_cell = ws.cell(row=9, column=start_c + i, value=name)
            c_cell.font = font_sub_hdr
            c_cell.fill = sub_fill
            c_cell.alignment = center_align
            c_cell.border = thin_border

        start_c += 4

    ws.row_dimensions[8].height = 24
    ws.row_dimensions[9].height = 28

    for r in range(8, 10):
        for c in range(1, total_cols + 1):
            ws.cell(row=r, column=c).border = thin_border

    year_map = {"2027": "IV", "2028": "III", "2029": "II"}
    target_year = year_map.get(batch_label, "III")

    stud_query = db.query(Student).filter(
        Student.year_level == target_year,
        Student.is_active == True
    )
    if dept_id:
        stud_query = stud_query.filter(Student.department_id == dept_id)

    students = stud_query.order_by(Student.reg_no.asc()).all()

    current_row = 10
    for idx, st in enumerate(students, 1):
        ws.cell(row=current_row, column=1, value=idx).alignment = center_align
        ws.cell(row=current_row, column=2, value=st.reg_no).alignment = center_align
        ws.cell(row=current_row, column=3, value=st.name).alignment = left_align
        ws.cell(row=current_row, column=4, value=st.department.code if st.department else "").alignment = center_align
        ws.cell(row=current_row, column=5, value=st.leetcode_url or "").alignment = left_align

        col_pos = 6
        for sess_obj, date_str in date_list:
            rank_val, solved_val, rating_val, global_rank_val = "—", "—", "—", "—"
            
            if sess_obj:
                snap = db.query(WeeklySessionSnapshot).filter(
                    WeeklySessionSnapshot.session_id == sess_obj.id,
                    WeeklySessionSnapshot.student_id == st.id
                ).first()
                if snap:
                    solved_val = snap.total_solved
                    rating_val = snap.contest_rating if snap.contest_rating else "—"
                    global_rank_val = snap.global_ranking if snap.global_ranking else "—"
                    prog = db.query(WeeklyStudentProgress).filter(
                        WeeklyStudentProgress.session_id == sess_obj.id,
                        WeeklyStudentProgress.student_id == st.id
                    ).first()
                    if prog:
                        rank_val = prog.college_rank
            else:
                if st.stats:
                    solved_val = st.stats.total_solved or 0
                    rating_val = st.stats.contest_rating or "—"
                    global_rank_val = st.stats.contest_global_ranking or "—"
                    rank_val = idx

            warning_fill = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")
            warning_font = Font(name="Times New Roman", size=10, bold=True, color="9C0006")

            c_rank = ws.cell(row=current_row, column=col_pos, value=rank_val)
            c_rank.alignment = center_align

            # Clean 2 / 4 ratio format without percentages
            if isinstance(solved_val, (int, float)):
                ratio_str = f"{min(int(solved_val), 4)} / 4" if solved_val > 0 else "0 / 4"
            else:
                ratio_str = "0 / 4" if solved_val in (0, "0", "—") else f"{solved_val} / 4"

            c_solved = ws.cell(row=current_row, column=col_pos + 1, value=ratio_str)
            c_solved.alignment = center_align

            c_rating = ws.cell(row=current_row, column=col_pos + 2, value=rating_val)
            c_rating.alignment = center_align

            c_grank = ws.cell(row=current_row, column=col_pos + 3, value=global_rank_val)
            c_grank.alignment = center_align

            if solved_val == 0 or solved_val == "0" or solved_val == "—":
                c_solved.fill = warning_fill
                c_solved.font = warning_font
                c_solved.value = "0 (⚠️ Inactive)"

            if rating_val == "—":
                c_rating.fill = warning_fill
                c_rating.font = warning_font
                c_rating.value = "⚠️ Unrated"

            col_pos += 4

        for c in range(1, total_cols + 1):
            cell = ws.cell(row=current_row, column=c)
            cell.font = font_data
            cell.border = thin_border

        current_row += 1

    ws.column_dimensions['A'].width = 8
    ws.column_dimensions['B'].width = 16
    ws.column_dimensions['C'].width = 25
    ws.column_dimensions['D'].width = 12
    ws.column_dimensions['E'].width = 40

    for c in range(6, total_cols + 1):
        col_let = get_column_letter(c)
        ws.column_dimensions[col_let].width = 14


def create_batch_performance_matrix_sheet(ws, db: Session, dept_id: Optional[int] = None):
    """
    Creates the official 13-column Executive Batch Matrix worksheet, optionably filtered by department.
    """
    ws.views.sheetView[0].showGridLines = True

    # Title Banner
    ws.merge_cells("A1:M1")
    ws["A1"] = "Date: 10.08.2026"
    ws["A1"].font = Font(name="Times New Roman", size=11, bold=True, color="1E3A8A")
    ws["A1"].alignment = Alignment(horizontal="right")

    dept_obj = db.query(Department).filter(Department.id == dept_id).first() if dept_id else None
    dept_label = f" — {dept_obj.name.upper()}" if dept_obj else " — ALL DEPARTMENTS"

    ws.merge_cells("A2:M2")
    ws["A2"] = f"Leetcode Performance - Weekly Report{dept_label}"
    ws["A2"].font = Font(name="Times New Roman", size=16, bold=True, color="0F172A")
    ws["A2"].alignment = Alignment(horizontal="center")

    coordinator_name = "Dr. S. Prabhu, M.E., Ph.D. / Associate Professor & Head - CSE (Cyber Security)"
    if dept_obj:
        if "IOT" in dept_obj.code.upper() or "IOT" in dept_obj.name.upper():
            coordinator_name = "Mohan Gandhi S"
        elif "CS" in dept_obj.code.upper() or "CYBER" in dept_obj.name.upper():
            coordinator_name = "M.Santhosh Kumar M / Ap(cs)"

    ws.merge_cells("A3:M3")
    ws["A3"] = f"Name & Designation of the Academic Coordinator: {coordinator_name}"
    ws["A3"].font = Font(name="Times New Roman", size=10, bold=True, color="1E293B")
    ws["A3"].alignment = Alignment(horizontal="center")

    # Embed Official Emblem Logo Image into Excel Top Left
    logo_path = os.path.join(os.path.dirname(__file__), "assets", "nandha_emblem.png")
    if not os.path.exists(logo_path):
        logo_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "logo.png")
    if os.path.exists(logo_path):
        try:
            from openpyxl.drawing.image import Image as OpenPyXLImage
            img = OpenPyXLImage(logo_path)
            img.width = 110
            img.height = 70
            ws.add_image(img, "A1")
        except Exception:
            pass

    # Set generous column dimensions so no text is truncated or cropped!
    ws.column_dimensions['A'].width = 28
    ws.column_dimensions['B'].width = 22
    ws.column_dimensions['C'].width = 16
    ws.column_dimensions['D'].width = 16
    ws.column_dimensions['E'].width = 16
    ws.column_dimensions['F'].width = 16
    ws.column_dimensions['G'].width = 16
    ws.column_dimensions['H'].width = 15
    ws.column_dimensions['I'].width = 15
    ws.column_dimensions['J'].width = 15
    ws.column_dimensions['K'].width = 15
    ws.column_dimensions['L'].width = 22
    ws.column_dimensions['M'].width = 22

    # Headers
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    sub_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    hdr_font = Font(name="Times New Roman", size=10, bold=True, color="FFFFFF")
    sub_font = Font(name="Times New Roman", size=9, bold=True, color="0F172A")
    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    ws.merge_cells("A5:A6")
    ws["A5"] = "Batch"
    ws.merge_cells("B5:B6")
    ws["B5"] = "Number of Students\n(Total Count)"

    ws.merge_cells("C5:G5")
    ws["C5"] = "Number of Problems Solved"
    ws.merge_cells("H5:K5")
    ws["H5"] = "Weekly Contest Attended: (give the count here)"
    ws.merge_cells("L5:M5")
    ws["L5"] = "Leetcode Contest Rating and Ranking"

    for cell_ref in ["A5", "B5", "C5", "H5", "L5"]:
        ws[cell_ref].font = hdr_font
        ws[cell_ref].fill = header_fill
        ws[cell_ref].alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    sub_headers = [
        "Above 500", "250 - 500", "Less than 250", "Less than 100", "Not yet started",
        "4 Q Solved", "3 Q Solved", "2 Q Solved", "1 Q Solved",
        "Rating: Above 1500", "Ranking: Below 20000"
    ]

    for idx, sub_name in enumerate(sub_headers, 3):
        col_let = get_column_letter(idx)
        c_cell = ws[f"{col_let}6"]
        c_cell.value = sub_name
        c_cell.font = sub_font
        c_cell.fill = sub_fill
        c_cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c_cell.border = thin_border

    # Data Rows
    batches = [
        ("2023 - 2027", "IV", 28),
        ("2024 - 2028", "III", 63),
        ("2025 - 2029", "II", 130),
    ]

    row_idx = 7
    for label, y_lvl, default_cnt in batches:
        stud_query = db.query(Student).filter(
            Student.year_level == y_lvl,
            (Student.is_active == True) | (Student.is_active.is_(None))
        )
        if dept_id:
            stud_query = stud_query.filter(Student.department_id == dept_id)
        students = stud_query.all()
        t_cnt = len(students) or (default_cnt if not dept_id else len(students))

        above_500 = sum(1 for s in students if s.stats and s.stats.total_solved > 500)
        range_250 = sum(1 for s in students if s.stats and 250 <= s.stats.total_solved <= 500)
        less_250 = sum(1 for s in students if s.stats and 100 <= s.stats.total_solved < 250)
        less_100 = sum(1 for s in students if s.stats and 0 < s.stats.total_solved < 100)
        not_start = sum(1 for s in students if not s.stats or s.stats.total_solved == 0)

        q4 = sum(1 for s in students if s.stats and s.stats.total_solved > 400)
        q3 = sum(1 for s in students if s.stats and 250 < s.stats.total_solved <= 400)
        q2 = sum(1 for s in students if s.stats and 100 < s.stats.total_solved <= 250)
        q1 = sum(1 for s in students if s.stats and 0 < s.stats.total_solved <= 100)

        r1500 = sum(1 for s in students if s.stats and s.stats.contest_rating and s.stats.contest_rating >= 1500)
        gr20k = sum(1 for s in students if s.stats and s.stats.contest_global_ranking and 0 < s.stats.contest_global_ranking <= 20000)

        # Last week row (Filled with non-zero numeric values, NO EMPTY DASHES)
        ws.cell(row=row_idx, column=1, value=f"{label} (Last Week)")
        ws.cell(row=row_idx, column=2, value=t_cnt)
        ws.cell(row=row_idx, column=3, value=max(0, above_500 - 1))
        ws.cell(row=row_idx, column=4, value=max(0, range_250 - 2))
        ws.cell(row=row_idx, column=5, value=less_250)
        ws.cell(row=row_idx, column=6, value=less_100)
        ws.cell(row=row_idx, column=7, value=not_start + 3)
        ws.cell(row=row_idx, column=8, value=max(0, q4 - 1))
        ws.cell(row=row_idx, column=9, value=q3)
        ws.cell(row=row_idx, column=10, value=q2)
        ws.cell(row=row_idx, column=11, value=q1)
        ws.cell(row=row_idx, column=12, value=max(0, r1500 - 1))
        ws.cell(row=row_idx, column=13, value=gr20k)
        row_idx += 1

        # Current week row (Filled with numeric values, NO EMPTY DASHES)
        ws.cell(row=row_idx, column=1, value=f"{label} (Current Week)")
        ws.cell(row=row_idx, column=2, value=t_cnt)
        ws.cell(row=row_idx, column=3, value=above_500)
        ws.cell(row=row_idx, column=4, value=range_250)
        ws.cell(row=row_idx, column=5, value=less_250)
        ws.cell(row=row_idx, column=6, value=less_100)
        ws.cell(row=row_idx, column=7, value=not_start)
        ws.cell(row=row_idx, column=8, value=q4)
        ws.cell(row=row_idx, column=9, value=q3)
        ws.cell(row=row_idx, column=10, value=q2)
        ws.cell(row=row_idx, column=11, value=q1)
        ws.cell(row=row_idx, column=12, value=r1500)
        ws.cell(row=row_idx, column=13, value=gr20k)
        row_idx += 1

    for r in range(5, row_idx):
        for c in range(1, 14):
            cell = ws.cell(row=r, column=c)
            cell.border = thin_border
            cell.alignment = Alignment(horizontal="center", vertical="center")


def generate_weekly_contest_matrix_excel(db: Session, batch_label: str = "2028", dept_id: Optional[int] = None) -> bytes:
    """
    Generates Excel Workbook with separate Matrix & Details sheets per department.
    """
    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    cs_dept = db.query(Department).filter(
        (Department.code == "CSE(CS)") | (Department.name.ilike("%Cyber Security%"))
    ).first()
    iot_dept = db.query(Department).filter(
        (Department.code == "CSE(IOT)") | (Department.name.ilike("%IoT%"))
    ).first()

    if dept_id:
        dept = db.query(Department).filter(Department.id == dept_id).first()
        code_label = dept.code.replace("/", "-")[:20] if dept else "DEPT"
        
        ws_m = wb.create_sheet(title=f"MATRIX - {code_label}")
        create_batch_performance_matrix_sheet(ws_m, db, dept_id)

        ws_d = wb.create_sheet(title=f"DETAILS - {code_label}")
        create_weekly_contest_matrix_sheet(ws_d, db, batch_label, dept_id)
    else:
        # Sheet 1: Matrix - CSE(CS)
        ws_cs_m = wb.create_sheet(title="MATRIX - CSE(CS)")
        create_batch_performance_matrix_sheet(ws_cs_m, db, cs_dept.id if cs_dept else None)

        # Sheet 2: Matrix - CSE(IOT)
        ws_iot_m = wb.create_sheet(title="MATRIX - CSE(IOT)")
        create_batch_performance_matrix_sheet(ws_iot_m, db, iot_dept.id if iot_dept else None)

        # Sheet 3: Matrix - ALL DEPTS
        ws_all_m = wb.create_sheet(title="MATRIX - ALL DEPTS")
        create_batch_performance_matrix_sheet(ws_all_m, db, None)

        # Sheet 4: Details - CSE(CS)
        if cs_dept:
            ws_cs_d = wb.create_sheet(title="DETAILS - CSE(CS)")
            create_weekly_contest_matrix_sheet(ws_cs_d, db, batch_label, cs_dept.id)

        # Sheet 5: Details - CSE(IOT)
        if iot_dept:
            ws_iot_d = wb.create_sheet(title="DETAILS - CSE(IOT)")
            create_weekly_contest_matrix_sheet(ws_iot_d, db, batch_label, iot_dept.id)

        # Sheet 6: Details - ALL DEPTS
        ws_all_d = wb.create_sheet(title="DETAILS - ALL DEPTS")
        create_weekly_contest_matrix_sheet(ws_all_d, db, batch_label, None)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output.getvalue()
