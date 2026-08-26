from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from backend.models import Student, Department, Section, ContestParticipation, LeetCodeProfileStats
from backend.services.report_models import StudentRow, CategorySummary, ContestRow, ReportConfig

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

def fetch_normalized_students(
    db: Session,
    dept_filter: Optional[str] = "ALL",
    year_filter: Optional[str] = "ALL",
    section_filter: Optional[str] = "ALL",
    current_user: Optional[Any] = None
) -> List[StudentRow]:
    """
    Fetches raw student data from database and normalizes all fields into StudentRow objects.
    Centralized Total Solved calculation: Total Solved = Easy + Medium + Hard.
    """
    from backend.services.authorization_service import apply_role_based_student_filter
    query = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None)))

    if current_user:
        query = apply_role_based_student_filter(query, current_user, db)

    if dept_filter and dept_filter.upper() != "ALL":
        query = query.join(Department).filter(
            (Department.code == dept_filter) |
            (Department.name == dept_filter) |
            (Department.code.ilike(f"%{dept_filter}%")) |
            (Department.name.ilike(f"%{dept_filter}%"))
        )

    if year_filter and year_filter.upper() != "ALL":
        query = query.filter(Student.year_level == year_filter.upper())

    if section_filter and section_filter.upper() != "ALL":
        query = query.join(Section).filter(Section.name == section_filter)

    students = query.all()
    rows: List[StudentRow] = []

    for idx, s in enumerate(students, start=1):
        st = s.stats
        is_verified = bool(st and (st.sync_status in ("success", "OK", "verified", "stale") or st.status == "verified" or st.total_solved is not None))

        easy = st.easy_solved if (is_verified and st) else None
        medium = st.medium_solved if (is_verified and st) else None
        hard = st.hard_solved if (is_verified and st) else None

        if is_verified and st:
            if easy is not None and medium is not None and hard is not None:
                total_solved = easy + medium + hard
            else:
                total_solved = st.total_solved
        else:
            total_solved = None

        category = get_problem_category(total_solved, is_verified)

        rows.append(StudentRow(
            s_no=idx,
            reg_no=s.reg_no,
            name=s.name,
            dept=s.department.code if s.department else "",
            year=s.year_level,
            section=s.section.name if s.section else "",
            leetcode_url=s.leetcode_url or "",
            username=s.username or "",
            easy=easy,
            medium=medium,
            hard=hard,
            total_solved=total_solved,
            contest_rating=round(st.contest_rating, 1) if (is_verified and st and st.contest_rating) else None,
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
