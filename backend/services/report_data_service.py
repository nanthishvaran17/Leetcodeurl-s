from typing import List, Any, Optional, Dict
from sqlalchemy.orm import Session, joinedload
from backend.models import Student, Department, Section, ContestParticipation
from backend.services.report_models import StudentRow, ContestRow
from backend.config.report_config import normalize_year_roman


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
    if su.isdigit():
        id_code_map = {
            "1": "CSE(CS)", "2": "CSE(IOT)", "7": "IT", "8": "CSE",
            "9": "AGRI", "10": "AIDS", "11": "EEE", "12": "ECE"
        }
        if su in id_code_map:
            return id_code_map[su]
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

import threading
from backend.services.data_version_service import get_current_data_version

_ROSTER_CACHE: Dict[str, List[Any]] = {}
_ROSTER_CACHE_LOCK = threading.Lock()

_STUDENT_ROWS_CACHE: Dict[str, List[StudentRow]] = {}
_ROWS_CACHE_LOCK = threading.Lock()

def clear_roster_cache():
    with _ROSTER_CACHE_LOCK:
        _ROSTER_CACHE.clear()
    with _ROWS_CACHE_LOCK:
        _STUDENT_ROWS_CACHE.clear()

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
    from backend.services.contest_performance_service import matches_dept, matches_year

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
    
    session_id = kwargs.get("session_id")

    canon_dept = resolve_dept_canonical(dept_filter)
    canon_year = (year_filter or "ALL").upper().strip()
    canon_sec = (section_filter or "ALL").upper().strip()
    canon_batch = (batch_filter or "ALL").upper().strip()
    canon_status = (status_filter or "ALL").upper().strip()
    canon_search = (search_query or "").strip().lower()
    canon_range = (performance_range or "ALL").lower().strip()

    data_ver = get_current_data_version(db)
    u_role = (getattr(current_user, "role", "") or "").lower()
    u_dept = str(getattr(current_user, "department_id", "") or "")
    rows_key = f"st_rows:{data_ver}:{u_role}:{u_dept}:{canon_dept}:{canon_year}:{canon_sec}:{canon_batch}:{canon_status}:{canon_search}:{canon_range}:{session_id}"

    # Cache disabled to prevent DetachedInstanceError with ORM objects
    # with _ROWS_CACHE_LOCK:
    #     if rows_key in _STUDENT_ROWS_CACHE:
    #         return _STUDENT_ROWS_CACHE[rows_key]

    cache_key = f"roster:{data_ver}:{u_role}:{u_dept}"

    raw_students = None
    # with _ROSTER_CACHE_LOCK:
    #     raw_students = _ROSTER_CACHE.get(cache_key)

    if raw_students is None:
        from sqlalchemy.orm import joinedload, selectinload
        query = db.query(Student).options(
            selectinload(Student.stats),
            joinedload(Student.department),
            joinedload(Student.section)
        ).filter((Student.is_active == True) | (Student.is_active.is_(None)))

        if current_user:
            query = apply_role_based_student_filter(query, current_user, db)

        raw_students = query.all()
        # Exclude synthetic/test/hardening accounts from all reports
        def _get_reg(st_obj):
            return getattr(st_obj, "reg_no", None) or getattr(st_obj, "register_number", None) or ""

        raw_students = [
            s for s in raw_students
            if _get_reg(s) and not (
                _get_reg(s).startswith("7322STU") or
                _get_reg(s).startswith("TEST") or
                _get_reg(s).startswith("7322P930") or
                _get_reg(s).startswith("CONCUR") or
                _get_reg(s).startswith("HARDENING")
            )
        ]
        # with _ROSTER_CACHE_LOCK:
        #     _ROSTER_CACHE[cache_key] = raw_students
    
    canon_dept = resolve_dept_canonical(dept_filter)
    canon_year = (year_filter or "ALL").upper().strip()
    canon_sec = (section_filter or "ALL").upper().strip()
    canon_batch = (batch_filter or "ALL").upper().strip()
    canon_status = (status_filter or "ALL").upper().strip()
    canon_search = (search_query or "").strip().lower()
    canon_range = (performance_range or "ALL").lower().strip()

    # Precompute student attendance counts from WeeklyPublicResult
    pub_att_map = {}
    try:
        from sqlalchemy import func, case
        from backend.models import WeeklyPublicResult
        is_pub_att = (
            (WeeklyPublicResult.participation_status.in_(["PUBLIC_ATTENDED", "ATTENDED", "SOLVED", "PARTICIPATED"])) |
            (WeeklyPublicResult.total_contest_solved > 0) |
            (WeeklyPublicResult.q1 == 1) | (WeeklyPublicResult.q2 == 1) | (WeeklyPublicResult.q3 == 1) | (WeeklyPublicResult.q4 == 1)
        )
        att_recs = db.query(
            WeeklyPublicResult.student_id,
            func.sum(case((is_pub_att, 1), else_=0))
        ).group_by(WeeklyPublicResult.student_id).all()
        for s_id, cnt in att_recs:
            pub_att_map[s_id] = int(cnt or 0)
    except Exception as ex:
        logger.warning(f"[PUB_ATT_NOTE] {ex}")

    # Precompute session-specific results if a historical session_id is provided
    session_result_map = {}
    historical_rating_map = {}
    if session_id and str(session_id).lower() not in ("all", "none", "latest"):
        try:
            from backend.services.weekly_session_resolver import resolve_target_weekly_session
            target_ws = resolve_target_weekly_session(db, session_id)
            sess_id_int = target_ws.id if target_ws else (int(session_id) if str(session_id).isdigit() else None)
            if sess_id_int:
                from backend.models import WeeklyPublicResult, WeeklyVirtualResult
                pub_recs = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == sess_id_int).all()
                for pr in pub_recs:
                    session_result_map[pr.student_id] = pr
                virt_recs = db.query(WeeklyVirtualResult).filter(WeeklyVirtualResult.session_id == sess_id_int).all()
                for vr in virt_recs:
                    if vr.student_id not in session_result_map:
                        session_result_map[vr.student_id] = vr
            
            if target_ws and target_ws.contest_name:
                from backend.models import LeetCodeContestRatingHistory
                h_rows = db.query(LeetCodeContestRatingHistory).filter(
                    LeetCodeContestRatingHistory.contest_name == target_ws.contest_name
                ).all()
                for r in h_rows:
                    historical_rating_map[r.student_id] = r
        except Exception as ex:
            logger.warning(f"[SESSION_RESULT_MAP_ERR] {ex}")

    filtered_students = []
    for s in raw_students:
        dept_obj = s.department
        sec_obj = s.section
        st = s.stats
        # 1. Department Filter
        if canon_dept != "ALL":
            s_code = dept_obj.code if dept_obj else ""
            s_name = dept_obj.name if dept_obj else ""
            if not matches_dept(s_code, s_name, dept_filter, getattr(s, "department_id", None)):
                continue

        # 2. Year Filter
        if canon_year != "ALL":
            if not matches_year(getattr(s, "year_level", None), year_filter, getattr(s, "reg_no", None)):
                continue

        # 3. Section Filter
        if canon_sec != "ALL":
            s_sec = str(sec_obj.name if sec_obj else "").upper().strip()
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

        is_verified = bool(
            (st and (st.sync_status in ("success", "OK", "verified", "stale") or st.status == "verified" or st.total_solved is not None))
            or bool(s.username and str(s.username).strip())
        )
        
        # Calculate cumulative profile solved counts
        easy = st.easy_solved if (st and st.easy_solved is not None) else (0 if is_verified else 0)
        medium = st.medium_solved if (st and st.medium_solved is not None) else (0 if is_verified else 0)
        hard = st.hard_solved if (st and st.hard_solved is not None) else (0 if is_verified else 0)
        lifetime_total = (easy or 0) + (medium or 0) + (hard or 0)
        if st and st.total_solved is not None and st.total_solved > lifetime_total:
            lifetime_total = st.total_solved
        
        total_solved = lifetime_total

        # Session-specific historical contest rating & rank resolution
        sess_rec = session_result_map.get(s.id) if session_result_map else None
        effective_rating = None
        g_rank = None

        if session_id and str(session_id).lower() not in ("all", "none", "latest"):
            h_row = historical_rating_map.get(s.id)
            if h_row:
                if h_row.rating_after is not None:
                    effective_rating = round(float(h_row.rating_after), 1)
                if h_row.contest_rank is not None:
                    g_rank = int(h_row.contest_rank)

        if effective_rating is None and sess_rec and getattr(sess_rec, "contest_rating", None) is not None and float(getattr(sess_rec, "contest_rating", 0) or 0) > 0:
            effective_rating = float(sess_rec.contest_rating)
        if g_rank is None and sess_rec and getattr(sess_rec, "contest_rank", None) is not None and int(getattr(sess_rec, "contest_rank", 0) or 0) > 0:
            g_rank = int(sess_rec.contest_rank)

        # Fallback to current live profile stats ONLY if no specific past session was requested
        if not session_id or str(session_id).lower() in ("all", "none", "latest"):
            if effective_rating is None and st and st.contest_rating is not None and st.contest_rating != 1500:
                effective_rating = st.contest_rating
            if g_rank is None and is_verified and st and st.contest_global_ranking and st.contest_global_ranking != 5000001:
                g_rank = st.contest_global_ranking

        att_count = pub_att_map.get(s.id) or (getattr(st, 'attended_contests_count', None) if st else 0) or getattr(s, 'contests_attended', 0) or 0

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

        filtered_students.append((s, st, dept_obj, sec_obj, is_verified, easy, medium, hard, total_solved, effective_rating, g_rank, att_count, sess_rec, lifetime_total))

    rows: List[StudentRow] = []
    for idx, (s, st, dept_obj, sec_obj, is_verified, easy, medium, hard, total_solved, effective_rating, g_rank, att_count, sess_rec, lifetime_total) in enumerate(filtered_students, start=1):
        category = get_problem_category(lifetime_total, is_verified)

        sec_id = str(getattr(s, "secondary_leetcode_id", "") or "").strip()
        sec_url = f"https://leetcode.com/u/{sec_id}/" if sec_id else ""
        prim_id = str(getattr(s, "primary_leetcode_id", "") or s.username or "").strip()

        # Session-specific difficulty breakdown vs lifetime fallback
        if sess_rec:
            c_easy = 1 if (getattr(sess_rec, 'q1', False) or str(getattr(sess_rec, 'q1_display', '')).startswith('1')) else 0
            c_med = (1 if (getattr(sess_rec, 'q2', False) or str(getattr(sess_rec, 'q2_display', '')).startswith('1')) else 0) + (1 if (getattr(sess_rec, 'q3', False) or str(getattr(sess_rec, 'q3_display', '')).startswith('1')) else 0)
            c_hard = 1 if (getattr(sess_rec, 'q4', False) or str(getattr(sess_rec, 'q4_display', '')).startswith('1')) else 0
            c_solved = getattr(sess_rec, 'questions_solved', None)
            if c_solved is None:
                c_solved = c_easy + c_med + c_hard
        elif session_id and str(session_id).lower() not in ("all", "none", "latest"):
            c_easy = 0
            c_med = 0
            c_hard = 0
            c_solved = 0
        else:
            from backend.routes.reports import compute_contest_difficulty_breakdown
            c_brk = compute_contest_difficulty_breakdown(contest_solved=total_solved)
            c_easy = c_brk["contest_easy"]
            c_med = c_brk["contest_medium"]
            c_hard = c_brk["contest_hard"]
            c_solved = total_solved

        if session_id and str(session_id).lower() not in ("all", "none", "latest"):
            easy = c_easy
            medium = c_med
            hard = c_hard
            total_solved = c_solved

        rows.append(StudentRow(
            s_no=idx,
            reg_no=s.reg_no,
            name=s.name,
            dept=dept_obj.code if dept_obj else "",
            department_name=dept_obj.name if dept_obj else "",
            year=normalize_year_roman(s.year_level, s.reg_no),
            batch=s.batch if hasattr(s, 'batch') and s.batch else "",
            section=sec_obj.name if sec_obj else "",
            institutional_email=s.institutional_email if hasattr(s, 'institutional_email') and s.institutional_email else "",
            leetcode_url=s.leetcode_url or "",
            username=s.username or "",
            primary_leetcode_id=prim_id,
            secondary_leetcode_id=sec_id,
            secondary_leetcode_url=sec_url,
            easy=easy,
            medium=medium,
            hard=hard,
            total_solved=total_solved,
            contest_easy=c_easy,
            contest_medium=c_med,
            contest_hard=c_hard,
            contest_rating=round(effective_rating, 1) if (is_verified and effective_rating is not None) else None,
            rating=round(effective_rating, 1) if (is_verified and effective_rating is not None) else None,
            global_rank=g_rank,
            category=category,
            status="VERIFIED" if is_verified else "UNVERIFIED",
            accommodation=getattr(s, 'accommodation', '') or '',
            twelfth_cutoff=float(s.twelfth_cutoff) if (hasattr(s, 'twelfth_cutoff') and s.twelfth_cutoff is not None) else None,
            cutoff=float(s.twelfth_cutoff) if (hasattr(s, 'twelfth_cutoff') and s.twelfth_cutoff is not None) else None,
            contests_attended=att_count,
            total_attended=att_count
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

    with _ROWS_CACHE_LOCK:
        _STUDENT_ROWS_CACHE[rows_key] = sorted_rows

    return sorted_rows

def fetch_normalized_contests(db: Session, dept_filter: Optional[str] = "ALL", year_filter: Optional[str] = "ALL") -> List[ContestRow]:
    """
    Fetches raw contest participation logs and normalizes into ContestRow objects.
    """
    query = db.query(ContestParticipation).options(
        joinedload(ContestParticipation.student).joinedload(Student.department)
    ).filter(ContestParticipation.participation_type == "OFFICIAL")
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
            contest_name=getattr(p, "contest_name", ""),
            date=getattr(p, "contest_date", ""),
            reg_no=s.reg_no if s else "",
            student_name=s.name if s else "Unknown",
            dept=s.department.code if (s and s.department) else "",
            year=s.year_level if s else "",
            problems_solved=getattr(p, "problems_solved", 0),
            rank=f"#{p.contest_rank:,}" if (p.contest_rank and str(p.contest_rank).isdigit() and int(p.contest_rank) > 0) else "-",
        ))

    # Fallback to profile stats recent contest info if no ContestParticipation table entries exist
    if not rows:
        students = db.query(Student).options(
            joinedload(Student.stats),
            joinedload(Student.department)
        ).filter((Student.is_active == True) | (Student.is_active.is_(None))).all()
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
                    reg_no=getattr(s, "reg_no", ""),
                    student_name=getattr(s, "name", ""),
                    dept=s.department.code if s.department else "",
                    year=getattr(s, "year_level", ""),
                    problems_solved=int(st.recent_contest_score) if (st.recent_contest_score and str(st.recent_contest_score).isdigit()) else 1,
                    total_problems=4,
                    rank=f"#{st.contest_global_ranking:,}" if (st.contest_global_ranking and str(st.contest_global_ranking).isdigit() and int(st.contest_global_ranking) > 0) else "-",
                    verified_at=iso_str
                ))

    return rows
