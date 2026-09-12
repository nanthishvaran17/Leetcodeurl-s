from typing import List, Any, Optional
from sqlalchemy.orm import Session
from backend.models import Student, Department, Section, ContestParticipation
from backend.services.report_models import StudentRow, ContestRow

def get_problem_category(total_solved: Optional[int], is_verified: bool = True) -> str:
    """
    Centralized problem category classification logic per institutional rules:
      - Above 500 (> 500)
      - 250-500 (250 <= x <= 500)
      - 101-250 (101 <= x <= 249)
      - Less than 100 (1 <= x <= 100)
      - Not Yet Started (x == 0)
      - Data Unavailable (x is None or unverified)
    """
    if not is_verified or total_solved is None:
        return "Data Unavailable"
    if total_solved > 500:
        return "Above 500"
    elif total_solved >= 250:
        return "250-500"
    elif total_solved >= 101:
        return "101-250"
    elif total_solved >= 1:
        return "Less than 100"
    elif total_solved == 0:
        return "Not Yet Started"
    return "Data Unavailable"

def resolve_dept_canonical(dept_str: Optional[str]) -> str:
    if not dept_str or dept_str.upper().strip() in ("ALL", ""):
        return "ALL"
    su = dept_str.upper().strip()
    dept_map = {
        "CSE(CS)":  ["CSE(CS)", "CYBER SECURITY", "CYBER", "CSE(CYBER", "CSE (CYBER", "(CS)"],
        "CSE(IOT)": ["CSE(IOT)", "IOT", "CSE(IOT", "CSE (IOT", "(IOT)"],
        "AIDS":     ["AIDS", "AI&DS", "AI DS", "ARTIFICIAL INTELLIGENCE"],
        "CSE":      ["CSE", "COMPUTER SCIENCE AND ENGINEERING", "COMPUTER SCIENCE & ENGINEERING"],
        "IT":       ["IT", "INFORMATION TECHNOLOGY"],
        "ECE":      ["ECE", "ELECTRONICS AND COMMUNICATION ENGINEERING", "ELECTRONICS & COMMUNICATION ENGINEERING"],
        "EEE":      ["EEE", "ELECTRICAL AND ELECTRONICS ENGINEERING", "ELECTRICAL & ELECTRONICS ENGINEERING"],
        "MECH":     ["MECH", "MECHANICAL ENGINEERING"],
        "CIVIL":    ["CIVIL", "CIVIL ENGINEERING"],
        "AGRI":     ["AGRI", "AGRICULTURAL ENGINEERING", "AGRICULTURE"],
        "BME":      ["BME", "BIOMEDICAL ENGINEERING"],
    }
    for canonical, aliases in dept_map.items():
        if su == canonical:
            return canonical
        for alias in aliases:
            if su == alias or su.startswith(alias):
                return canonical
    return su

def fetch_normalized_students(
    db: Session,
    dept_filter: Optional[str] = "ALL",
    year_filter: Optional[str] = "ALL",
    section_filter: Optional[str] = "ALL",
    batch_filter: Optional[str] = "ALL",
    status_filter: Optional[str] = "ALL",
    search_query: Optional[str] = None,
    performance_range: Optional[str] = "ALL",
    current_user: Optional[Any] = None,
    **kwargs
) -> List[StudentRow]:
    """
    Fetches raw student data from database and normalizes all fields into StudentRow objects.
    Applies exact caller filters: Department, Academic Year, Section, Batch, Verification/Contest Status, Search Query.
    Centralized Total Solved calculation: Total Solved = Easy + Medium + Hard.
    """
    from backend.services.authorization_service import apply_role_based_student_filter
    from backend.models import LeetCodeProfileStats

    # Resolve aliases from kwargs
    if ("department" in kwargs or "dept" in kwargs) and (dept_filter == "ALL" or not dept_filter):
        dept_filter = kwargs.get("department") or kwargs.get("dept")
    if "year" in kwargs and (year_filter == "ALL" or not year_filter):
        year_filter = kwargs.get("year")
    if ("searchQuery" in kwargs or "search" in kwargs) and not search_query:
        search_query = kwargs.get("searchQuery") or kwargs.get("search")
    if ("status" in kwargs or "attendance" in kwargs) and (status_filter == "ALL" or not status_filter):
        status_filter = kwargs.get("status") or kwargs.get("attendance")
    if "batch" in kwargs and (batch_filter == "ALL" or not batch_filter):
        batch_filter = kwargs.get("batch")
    if "section" in kwargs and (section_filter == "ALL" or not section_filter):
        section_filter = kwargs.get("section")

    query = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None)))

    if current_user:
        query = apply_role_based_student_filter(query, current_user, db)

    students = query.distinct().all()
    
    canon_dept = resolve_dept_canonical(dept_filter)
    canon_year = str(year_filter or "ALL").upper().strip()
    canon_sec = str(section_filter or "ALL").upper().strip()
    canon_batch = str(batch_filter or "ALL").upper().strip()
    canon_status = str(status_filter or "ALL").upper().strip()
    canon_search = str(search_query or "").strip().lower()
    canon_range = str(performance_range or "ALL").lower().strip()

    filtered_students = []
    for s in students:
        # 1. Department Filter
        if canon_dept != "ALL":
            s_dept = resolve_dept_canonical(s.department.code if s.department else "")
            if s_dept != canon_dept:
                continue

        # 2. Year Filter
        if canon_year != "ALL":
            s_year = str(s.year_level or "").upper().strip()
            year_match = False
            if canon_year in ("II", "2", "2ND", "II YEAR") and s_year in ("II", "2"): year_match = True
            elif canon_year in ("III", "3", "3RD", "III YEAR") and s_year in ("III", "3"): year_match = True
            elif canon_year in ("IV", "4", "4TH", "IV YEAR") and s_year in ("IV", "4"): year_match = True
            elif canon_year == s_year: year_match = True
            if not year_match:
                continue

        # 3. Section Filter
        if canon_sec != "ALL":
            s_sec = str(s.section.name if s.section else "").upper().strip()
            if s_sec != canon_sec:
                continue

        # 4. Batch Filter
        if canon_batch != "ALL":
            s_batch = str(getattr(s, 'batch', '') or '').upper().strip()
            if canon_batch not in s_batch:
                continue

        # 5. Search Query Filter (Reg No, Name, LeetCode Username, Institutional Email)
        if canon_search:
            name_str = str(s.name or "").lower()
            reg_str = str(s.reg_no or "").lower()
            user_str = str(s.username or "").lower()
            email_str = str(getattr(s, 'institutional_email', '') or '').lower()
            if (canon_search not in name_str and 
                canon_search not in reg_str and 
                canon_search not in user_str and 
                canon_search not in email_str):
                continue

        st = s.stats
        is_verified = bool(st and (st.sync_status in ("success", "OK", "verified", "stale") or st.status == "verified" or st.total_solved is not None))
        
        # Calculate solved
        if st:
            easy = st.easy_solved if st.easy_solved is not None else (0 if is_verified else None)
            medium = st.medium_solved if st.medium_solved is not None else (0 if is_verified else None)
            hard = st.hard_solved if st.hard_solved is not None else (0 if is_verified else None)
            if easy is not None and medium is not None and hard is not None:
                total_solved = easy + medium + hard
            else:
                total_solved = st.total_solved if st.total_solved is not None else (0 if is_verified else None)
        else:
            easy, medium, hard, total_solved = None, None, None, None

        # 6. Status Filter
        if canon_status != "ALL":
            if canon_status in ("VERIFIED", "COMPLETED") and not is_verified:
                continue
            elif canon_status in ("UNVERIFIED", "PENDING") and is_verified:
                continue
            elif canon_status == "MISSING_USERNAME" and (s.username and str(s.username).strip()):
                continue
            elif canon_status == "DATA_ERROR" and is_verified and s.username:
                continue

        # 7. Performance Range Filter
        if canon_range != "all":
            tot = total_solved or 0
            if canon_range == "500_plus" and tot <= 500: continue
            elif canon_range == "251_500" and not (251 <= tot <= 500): continue
            elif canon_range == "101_250" and not (101 <= tot <= 250): continue
            elif canon_range == "1_100" and not (1 <= tot <= 100): continue
            elif canon_range == "not_started" and tot != 0: continue

        filtered_students.append((s, is_verified, easy, medium, hard, total_solved))

    rows: List[StudentRow] = []
    for idx, (s, is_verified, easy, medium, hard, total_solved) in enumerate(filtered_students, start=1):
        st = s.stats
        category = get_problem_category(total_solved, is_verified)

        rows.append(StudentRow(
            s_no=idx,
            reg_no=s.reg_no,
            name=s.name,
            dept=s.department.code if s.department else "",
            department_name=s.department.name if s.department else "",
            year=s.year_level,
            batch=s.batch if hasattr(s, 'batch') and s.batch else "",
            section=s.section.name if s.section else "",
            institutional_email=s.institutional_email if hasattr(s, 'institutional_email') and s.institutional_email else "",
            leetcode_url=s.leetcode_url or "",
            username=s.username or "",
            easy=easy,
            medium=medium,
            hard=hard,
            total_solved=total_solved,
            contest_rating=round(st.contest_rating, 1) if (is_verified and st and st.contest_rating) else None,
            rating=round(st.contest_rating, 1) if (is_verified and st and st.contest_rating) else None,
            global_rank=st.contest_global_ranking if (is_verified and st and st.contest_global_ranking) else None,
            category=category,
            status="VERIFIED" if is_verified else "UNVERIFIED"
        ))

    # Centralized Sorting Logic: Total Solved (DESC) -> Rating (DESC) -> Name (ASC)
    sorted_rows = sorted(
        rows,
        key=lambda r: (
            r.total_solved if r.total_solved is not None else -1,
            r.contest_rating if r.contest_rating is not None else -1,
            r.name or ""
        ),
        reverse=True
    )

    # Re-assign sequential S.No (1..N) based on rank
    for i, r in enumerate(sorted_rows, start=1):
        r.s_no = i

    return sorted_rows

def fetch_normalized_contests(db: Session, dept_filter: Optional[str] = "ALL", year_filter: Optional[str] = "ALL") -> List[ContestRow]:
    """
    Fetches raw contest participation logs and normalizes into ContestRow objects.
    """
    query = db.query(ContestParticipation).filter(ContestParticipation.participation_type == "OFFICIAL")
    if dept_filter and dept_filter.upper() != "ALL":
        query = query.join(Student).join(Department).filter(
            (Department.code == dept_filter) | (Department.name == dept_filter)
        )

    participations = query.all()
    rows: List[ContestRow] = []

    for idx, p in enumerate(participations, start=1):
        s = p.student
        rows.append(ContestRow(
            s_no=idx,
            contest_name=p.contest_name,
            date=p.contest_date,
            reg_no=s.reg_no if s else "",
            student_name=s.name if s else "Unknown",
            dept=s.department.code if (s and s.department) else "",
            year=s.year_level if s else "",
            problems_solved=p.problems_solved,
            total_problems=p.total_problems,
            rank=str(p.contest_rank) if p.contest_rank else "-",
            verified_at=p.verified_at.isoformat() if hasattr(p.verified_at, 'isoformat') else (str(p.verified_at) if p.verified_at else None)
        ))

    # Fallback to profile stats recent contest info if no ContestParticipation table entries exist
    if not rows:
        students = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None))).all()
        for idx, s in enumerate(students, start=1):
            st = s.stats
            if st and st.recent_contest_name:
                sync_time = getattr(st, 'last_successful_sync', None) or getattr(st, 'last_updated', None)
                date_str = sync_time.strftime("%Y-%m-%d") if hasattr(sync_time, 'strftime') else (str(sync_time) if sync_time else "")
                iso_str = sync_time.isoformat() if hasattr(sync_time, 'isoformat') else (str(sync_time) if sync_time else None)
                rows.append(ContestRow(
                    s_no=idx,
                    contest_name=st.recent_contest_name,
                    date=date_str,
                    reg_no=s.reg_no,
                    student_name=s.name,
                    dept=s.department.code if s.department else "",
                    year=s.year_level,
                    problems_solved=int(st.recent_contest_score) if (st.recent_contest_score and str(st.recent_contest_score).isdigit()) else 1,
                    total_problems=4,
                    rank=str(st.contest_global_ranking) if st.contest_global_ranking else "-",
                    verified_at=iso_str
                ))

    return rows
