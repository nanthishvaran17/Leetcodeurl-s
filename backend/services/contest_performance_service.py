"""
contest_performance_service.py
Authoritative, data-driven, filter-aware Contest Performance Report Engine.
Calculates exact contest-level KPIs, solve distribution, and student-level rows
from the resolved latest completed/verified Weekly Contest session.
"""
import uuid
import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from backend.models import (
    Student, WeeklySession, WeeklyPublicResult, WeeklyVirtualResult, 
    ContestParticipation, ReportHistory
)
from backend.services.report_models import ReportConfig
from backend.services.weekly_session_resolver import resolve_weekly_sessions
from backend.services.contest_classifier import ContestStatus
from backend.services.contest_problem_accuracy_engine import ContestProblemAccuracyEngine
from backend.logger import logger


def normalize_department_filter(target_dept: Optional[str]) -> Optional[str]:
    if not target_dept:
        return None
    t = str(target_dept).strip().upper()
    if t in ("ALL", "ALL DEPARTMENTS", "ALL DEPT", "ALL DEPTS", "COLLEGE", "COLLEGE-WIDE", "COLLEGE_WIDE", ""):
        return None
    return t


def normalize_year_filter(target_year: Optional[str]) -> Optional[str]:
    if not target_year:
        return None
    t = str(target_year).strip().upper()
    if t in ("ALL", "ALL YEARS", "ALL BATCHES", "ALL BATCH", "ALL ACADEMIC YEARS", "ALL ACADEMIC YEAR", ""):
        return None
    return t


def normalize_dept_val(code_raw: Optional[str], name_raw: Optional[str] = "") -> str:
    c = str(code_raw or "").upper().strip()
    n = str(name_raw or "").upper().strip()
    if "IOT" in c or "IOT" in n or "CI" in c:
        return "CSE(IoT)"
    if "CYBER" in c or "CYBER" in n or "CC" in c or "CSE(CS)" in c or "CSE (CS)" in c or "(CS)" in c or c == "CS":
        return "CSE(CS)"
    if c in ("CSE", "COMPUTER SCIENCE") or "COMPUTER SCIENCE &" in n or "COMPUTER SCIENCE AND" in n:
        return "CSE"
    return str(code_raw or "CSE")


def matches_dept(r_dept_code: str, r_dept_name: str, target_dept: Optional[str], dept_id: Optional[int] = None) -> bool:
    norm_target = normalize_department_filter(target_dept)
    if norm_target is None:
        return True

    if str(norm_target).isdigit():
        target_id = int(norm_target)
        if dept_id is not None and int(dept_id) == target_id:
            return True
        id_code_map = {
            1: "CSE(CS)", 2: "CSE(IOT)", 7: "IT", 8: "CSE", 
            9: "AGRI", 10: "AIDS", 11: "EEE", 12: "ECE"
        }
        if target_id in id_code_map:
            target_code = id_code_map[target_id]
            student_norm = normalize_dept_val(r_dept_code, r_dept_name)
            target_norm = normalize_dept_val(target_code, target_code)
            return student_norm == target_norm

    student_norm = normalize_dept_val(r_dept_code, r_dept_name)
    target_norm = normalize_dept_val(norm_target, norm_target)
    return student_norm == target_norm


def normalize_year_val(year_raw: Optional[str]) -> str:
    if not year_raw:
        return ""
    y = str(year_raw).upper().strip()
    if "ALL" in y:
        return "ALL"
    if "IV" in y or "4" in y or "2023" in y:
        return "IV"
    if "III" in y or "3" in y or "2024" in y:
        return "III"
    if "II" in y or "2" in y or "2025" in y:
        return "II"
    if "I" in y or "1" in y or "2026" in y:
        return "I"
    return y


def matches_year(r_year: Optional[str], target_year: Optional[str], reg_no: Optional[str] = "") -> bool:
    norm_target = normalize_year_filter(target_year)
    if norm_target is None:
        return True
    
    r_str = str(reg_no or "").strip().upper()
    if r_str.startswith("732225"):
        student_year = "II"
    elif r_str.startswith("732224"):
        student_year = "III"
    elif r_str.startswith("732223"):
        student_year = "IV"
    elif r_str.startswith("732226"):
        student_year = "I"
    else:
        student_year = normalize_year_val(r_year)

    return student_year == normalize_year_val(norm_target)


def build_contest_performance_report(db: Session, config: ReportConfig, current_user: Optional[Any] = None) -> Dict[str, Any]:
    """
    Authoritatively builds the Contest Performance Report for the resolved latest Weekly Contest.
    Strictly filter-aware (Department, Year, Output Scope) and fully reconciled.
    """
    # 1. Resolve the Latest Usable Contest Session dynamically
    resolved_info = resolve_weekly_sessions(db)
    session_obj: Optional[WeeklySession] = resolved_info.get("current_week_session")
    
    # Fallback if no finalized sessions found by resolver
    if not session_obj:
        override_session_id = (config.filters or {}).get("session_id")
        if override_session_id:
            session_obj = db.query(WeeklySession).filter(WeeklySession.id == int(override_session_id)).first()
        if not session_obj:
            session_obj = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()

    if session_obj:
        session_id = session_obj.id
        contest_name = session_obj.contest_name or f"Weekly Contest {session_obj.id}"
        contest_date = session_obj.session_date or datetime.date.today().strftime("%d.%m.%Y")
        contest_id = session_obj.contest_id or f"weekly-contest-{session_id}"
    else:
        session_id = None
        contest_name = "Weekly Contest"
        contest_date = datetime.date.today().strftime("%d.%m.%Y")
        contest_id = "weekly-contest"

    # 2. Parse & apply Output Scope + Filter logic
    filters = config.filters or {}
    raw_dept = config.department or filters.get("department", "ALL")
    raw_year = config.year or filters.get("year", "ALL")

    dept_filter = raw_dept
    year_filter = raw_year

    # 3. Query all active Master Students
    student_query = db.query(Student).filter(
        (Student.is_active == True) | (Student.is_active.is_(None))
    )
    
    from backend.services.authorization_service import apply_role_based_student_filter
    student_query = apply_role_based_student_filter(student_query, current_user, db)
    
    all_master_students = student_query.distinct().order_by(Student.id.asc()).all()

    # Filter students by Department and Year
    filtered_students = [
        s for s in all_master_students
        if matches_dept(
            s.department.code if s.department else "",
            s.department.name if s.department else "",
            dept_filter,
            getattr(s, "department_id", None)
        ) and matches_year(s.year_level, year_filter, s.reg_no)
    ]

    # 4. Fetch contest participation results for this session
    public_map: Dict[int, WeeklyPublicResult] = {}
    virtual_map: Dict[int, WeeklyVirtualResult] = {}
    part_map: Dict[int, ContestParticipation] = {}

    if session_id is not None:
        p_list = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == session_id).all()
        for p in p_list:
            public_map[p.student_id] = p

        v_list = db.query(WeeklyVirtualResult).filter(WeeklyVirtualResult.session_id == session_id).all()
        for v in v_list:
            virtual_map[v.student_id] = v

    if contest_name:
        parts = db.query(ContestParticipation).filter(
            (ContestParticipation.contest_name == contest_name) |
            (ContestParticipation.contest_name.ilike(f"%{contest_name}%"))
        ).all()
        for pt in parts:
            part_map[pt.student_id] = pt

    # 5. Build authoritative student-level contest rows
    student_rows: List[Dict[str, Any]] = []

    for s in filtered_students:
        s_id = s.id
        reg_no = s.reg_no
        name = s.name
        dept_code = s.department.code if s.department else "CSE"
        dept_norm = normalize_dept_val(dept_code, s.department.name if s.department else "")
        year_level = s.year_level or "III"
        yr_norm = normalize_year_val(year_level)
        username = (s.username or "").strip()

        p_res = public_map.get(s_id)
        v_res = virtual_map.get(s_id)
        part_res = part_map.get(s_id)

        # Determine Authoritative Status
        status = ContestStatus.NOT_ATTENDED.value
        q1_val: Optional[int] = None
        q2_val: Optional[int] = None
        q3_val: Optional[int] = None
        q4_val: Optional[int] = None
        solved_val: Optional[int] = None
        rank_val: Optional[Any] = None
        rating_val: Optional[float] = None

        if not username or len(username) < 2:
            status = ContestStatus.PENDING_USERNAME.value
        elif p_res is not None:
            fetch_st = str(p_res.fetch_status or p_res.data_fetch_status or "").upper()
            part_st = str(p_res.participation_status or "").upper()

            if part_st in ("PUBLIC", "PUBLIC_ATTENDED", "OFFICIAL", "ATTENDED", "PUBLIC_LIVE"):
                status = ContestStatus.PUBLIC_LIVE.value
                q1_val = 1 if (p_res.q1 and p_res.q1 >= 1) else 0
                q2_val = 1 if (p_res.q2 and p_res.q2 >= 1) else 0
                q3_val = 1 if (p_res.q3 and p_res.q3 >= 1) else 0
                q4_val = 1 if (p_res.q4 and p_res.q4 >= 1) else 0
                solved_val = q1_val + q2_val + q3_val + q4_val
                rank_val = p_res.contest_rank
                rating_val = p_res.contest_rating
            elif part_st in ("VIRTUAL", "VIRTUAL_ATTENDED", "VIRTUAL_PRACTICE"):
                status = ContestStatus.VIRTUAL_PRACTICE.value
                q1_val = 1 if (p_res.q1 and p_res.q1 >= 1) else 0
                q2_val = 1 if (p_res.q2 and p_res.q2 >= 1) else 0
                q3_val = 1 if (p_res.q3 and p_res.q3 >= 1) else 0
                q4_val = 1 if (p_res.q4 and p_res.q4 >= 1) else 0
                solved_val = q1_val + q2_val + q3_val + q4_val
                rank_val = p_res.contest_rank
                rating_val = p_res.contest_rating
            elif part_st in ("NOT_ATTENDED", "PUBLIC_NOT_ATTENDED", "ABSENT", "NO_PARTICIPATION"):
                status = ContestStatus.NOT_ATTENDED.value
            elif fetch_st in ("USERNAME_NOT_FOUND", "INVALID_USERNAME", "INVALID_PROFILE", "INVALID_LINK"):
                status = ContestStatus.INVALID_USERNAME.value
            elif fetch_st in ("FETCH_FAILED", "FETCH_ERROR", "TIMEOUT", "NETWORK_ERROR", "SERVER_ERROR"):
                status = ContestStatus.FETCH_FAILED.value
            elif part_st in ("PENDING", "INITIALIZING", "DATA_PENDING"):
                status = ContestStatus.PENDING_USERNAME.value
            else:
                status = ContestStatus.NOT_ATTENDED.value
        elif v_res is not None:
            status = ContestStatus.VIRTUAL_PRACTICE.value
            q1_val = 1 if (v_res.q1 and v_res.q1 >= 1) else 0
            q2_val = 1 if (v_res.q2 and v_res.q2 >= 1) else 0
            q3_val = 1 if (v_res.q3 and v_res.q3 >= 1) else 0
            q4_val = 1 if (v_res.q4 and v_res.q4 >= 1) else 0
            solved_val = q1_val + q2_val + q3_val + q4_val
        elif part_res is not None:
            p_type = str(part_res.participation_type or "").upper()
            if p_type in ("OFFICIAL", "PUBLIC"):
                status = ContestStatus.PUBLIC_LIVE.value
                rank_val = part_res.contest_rank
                rating_val = part_res.contest_rating_after
                q1_val = getattr(part_res, "q1", None)
                q2_val = getattr(part_res, "q2", None)
                q3_val = getattr(part_res, "q3", None)
                q4_val = getattr(part_res, "q4", None)
                if q1_val is not None and q2_val is not None:
                    solved_val = int(q1_val) + int(q2_val) + int(q3_val or 0) + int(q4_val or 0)
                else:
                    solved_val = part_res.problems_solved or 0
            elif p_type in ("VIRTUAL",):
                status = ContestStatus.VIRTUAL_PRACTICE.value
                rank_val = part_res.contest_rank
                rating_val = part_res.contest_rating_after
                q1_val = getattr(part_res, "q1", None)
                q2_val = getattr(part_res, "q2", None)
                q3_val = getattr(part_res, "q3", None)
                q4_val = getattr(part_res, "q4", None)
                if q1_val is not None and q2_val is not None:
                    solved_val = int(q1_val) + int(q2_val) + int(q3_val or 0) + int(q4_val or 0)
                else:
                    solved_val = part_res.problems_solved or 0
            else:
                status = ContestStatus.NOT_ATTENDED.value
        else:
            status = ContestStatus.NOT_ATTENDED.value

        # Consistency Rule: NOT_ATTENDED students MUST have Q1-Q4 = None and contest_solved = None
        valid_attended_statuses = (
            ContestStatus.PUBLIC_LIVE.value,
            ContestStatus.VIRTUAL_PRACTICE.value,
            ContestStatus.PUBLIC_ATTENDED.value,
            ContestStatus.VIRTUAL_ATTENDED.value,
            ContestStatus.PUBLIC_LIVE_VERIFIED.value,
            ContestStatus.VIRTUAL_PRACTICE_VERIFIED.value,
            ContestStatus.PUBLIC_LIVE_UNVERIFIED.value,
            ContestStatus.VIRTUAL_PRACTICE_UNVERIFIED.value,
        )
        if status not in valid_attended_statuses:
            q1_val = None
            q2_val = None
            q3_val = None
            q4_val = None
            solved_val = None

        is_att = status in valid_attended_statuses

        q1_time = getattr(p_res, "q1_time", None) if p_res else None
        q2_time = getattr(p_res, "q2_time", None) if p_res else None
        q3_time = getattr(p_res, "q3_time", None) if p_res else None
        q4_time = getattr(p_res, "q4_time", None) if p_res else None
        tot_time = (getattr(p_res, "total_time_min", None) or getattr(p_res, "total_time", None) or getattr(p_res, "finish_time", None)) if p_res else None

        def format_q_cell(q_val: Optional[int], q_t: Any, attended: bool) -> str:
            if not attended or q_val is None:
                return "—"
            if q_val == 1:
                if q_t is not None and float(q_t) > 0:
                    t_val = float(q_t)
                    t_str = str(int(t_val)) if t_val.is_integer() else str(t_val)
                    return f"1 ({t_str} min)"
                return "1 (Not Available)"
            return "0 (—)"

        q1_disp = format_q_cell(q1_val, q1_time, is_att)
        q2_disp = format_q_cell(q2_val, q2_time, is_att)
        q3_disp = format_q_cell(q3_val, q3_time, is_att)
        q4_disp = format_q_cell(q4_val, q4_time, is_att)

        if is_att:
            if tot_time is not None and float(tot_time) > 0:
                t_val = float(tot_time)
                t_str = str(int(t_val)) if t_val.is_integer() else str(t_val)
                tot_time_disp = f"{t_str} min"
            else:
                tot_time_disp = "Not Available"
        else:
            tot_time_disp = "—"

        student_rows.append({
            "student_id": s_id,
            "reg_no": reg_no,
            "name": name,
            "student_name": name,
            "dept": dept_norm,
            "year": yr_norm,
            "username": username,
            "leetcode_handle": username if (username and len(username) >= 2) else "Not Available",
            "status": status,
            "participation_status": status,
            "contest_name": contest_name,
            "contest_date": contest_date,
            "session_date": contest_date,
            "q1": q1_val if is_att else None,
            "q2": q2_val if is_att else None,
            "q3": q3_val if is_att else None,
            "q4": q4_val if is_att else None,
            "q1_display": q1_disp,
            "q2_display": q2_disp,
            "q3_display": q3_disp,
            "q4_display": q4_disp,
            "total_time_display": tot_time_disp,
            "contest_solved": solved_val,
            "total_solved": solved_val,
            "score": (solved_val * 3) if (is_att and solved_val is not None) else "Not Available",
            "rank": rank_val if (is_att and rank_val is not None) else "Not Available",
            "global_rank": rank_val if (is_att and rank_val is not None) else "Not Available",
            "rating": rating_val if (is_att and rating_val is not None) else "Not Available",
            "contest_rating": rating_val
        })

    # 6. Reconcile Summary & Solve Distribution
    total_students = len(student_rows)

    public_attended = sum(1 for r in student_rows if r["status"] in (ContestStatus.PUBLIC_LIVE.value, ContestStatus.PUBLIC_ATTENDED.value))
    virtual_attended = sum(1 for r in student_rows if r["status"] in (ContestStatus.VIRTUAL_PRACTICE.value, ContestStatus.VIRTUAL_ATTENDED.value))
    not_attended = sum(1 for r in student_rows if r["status"] == ContestStatus.NOT_ATTENDED.value)
    pending_username = sum(1 for r in student_rows if r["status"] == ContestStatus.PENDING_USERNAME.value)
    fetch_failed = sum(1 for r in student_rows if r["status"] == ContestStatus.FETCH_FAILED.value)
    invalid_username = sum(1 for r in student_rows if r["status"] == ContestStatus.INVALID_USERNAME.value)
    unknown = sum(1 for r in student_rows if r["status"] == ContestStatus.UNKNOWN.value)

    total_participants = public_attended + virtual_attended

    # Solve Distribution among participating students
    participants_list = [
        r for r in student_rows
        if r["status"] in (ContestStatus.PUBLIC_LIVE.value, ContestStatus.VIRTUAL_PRACTICE.value, ContestStatus.PUBLIC_ATTENDED.value, ContestStatus.VIRTUAL_ATTENDED.value)
    ]

    solved_4 = sum(1 for r in participants_list if r["contest_solved"] == 4)
    solved_3 = sum(1 for r in participants_list if r["contest_solved"] == 3)
    solved_2 = sum(1 for r in participants_list if r["contest_solved"] == 2)
    solved_1 = sum(1 for r in participants_list if r["contest_solved"] == 1)
    solved_0 = sum(1 for r in participants_list if r["contest_solved"] == 0)

    at_least_1_solved = solved_4 + solved_3 + solved_2 + solved_1
    zero_solved_participated = solved_0
    not_participated = not_attended

    total_contest_solved = sum((r["contest_solved"] or 0) for r in participants_list)

    average_problems_solved = round(total_contest_solved / max(total_students, 1), 2)
    average_solved_among_participants = round(total_contest_solved / max(total_participants, 1), 2)

    participation_rate = round((total_participants / max(total_students, 1)) * 100, 1)
    public_attendance_rate = round((public_attended / max(total_students, 1)) * 100, 1)
    virtual_attendance_rate = round((virtual_attended / max(total_students, 1)) * 100, 1)

    accuracy_audit = ContestProblemAccuracyEngine.calculate_distribution_and_reconcile(
        participants_list, total_expected_population=total_participants
    )

    # 7. Internal Reconciliation Verification
    roster_sum = (
        public_attended + virtual_attended + not_attended + 
        pending_username + fetch_failed + invalid_username + unknown
    )
    solve_sum = solved_4 + solved_3 + solved_2 + solved_1 + solved_0

    if roster_sum != total_students:
        logger.error(
            f"[RECONCILIATION_ERROR] Roster mismatch: total={total_students}, sum_statuses={roster_sum}"
        )
    if solve_sum != total_participants:
        logger.error(
            f"[RECONCILIATION_ERROR] Solve distribution mismatch: participants={total_participants}, sum_distribution={solve_sum}"
        )

    # 8. Sort student rows: participants first (by solved DESC, name ASC), then non-participants (name ASC)
    def row_sort_key(r: Dict[str, Any]):
        is_part = 0 if r["status"] in (ContestStatus.PUBLIC_LIVE.value, ContestStatus.VIRTUAL_PRACTICE.value, ContestStatus.PUBLIC_ATTENDED.value, ContestStatus.VIRTUAL_ATTENDED.value) else 1
        s_count = -(r["contest_solved"] if r["contest_solved"] is not None else -1)
        return (is_part, s_count, (r["name"] or ""))

    sorted_rows = sorted(student_rows, key=row_sort_key)
    for idx, r in enumerate(sorted_rows, start=1):
        r["s_no"] = idx

    # 8b. Question-Wise Official Result & Solve Distribution
    q1_solves = sum(1 for r in participants_list if (r.get("q1") or 0) >= 1)
    q2_solves = sum(1 for r in participants_list if (r.get("q2") or 0) >= 1)
    q3_solves = sum(1 for r in participants_list if (r.get("q3") or 0) >= 1)
    q4_solves = sum(1 for r in participants_list if (r.get("q4") or 0) >= 1)

    denom_part = max(total_participants, 1)
    question_wise_result = [
        {"question": "Q1", "solved": q1_solves, "not_solved": max(0, total_participants - q1_solves), "solve_rate": f"{round((q1_solves / denom_part) * 100, 1)}%"},
        {"question": "Q2", "solved": q2_solves, "not_solved": max(0, total_participants - q2_solves), "solve_rate": f"{round((q2_solves / denom_part) * 100, 1)}%"},
        {"question": "Q3", "solved": q3_solves, "not_solved": max(0, total_participants - q3_solves), "solve_rate": f"{round((q3_solves / denom_part) * 100, 1)}%"},
        {"question": "Q4", "solved": q4_solves, "not_solved": max(0, total_participants - q4_solves), "solve_rate": f"{round((q4_solves / denom_part) * 100, 1)}%"},
    ]

    solve_distribution_list = [
        {"category": "4/4 Solved", "count": solved_4, "percentage": f"{round((solved_4 / denom_part) * 100, 1)}%"},
        {"category": "3/4 Solved", "count": solved_3, "percentage": f"{round((solved_3 / denom_part) * 100, 1)}%"},
        {"category": "2/4 Solved", "count": solved_2, "percentage": f"{round((solved_2 / denom_part) * 100, 1)}%"},
        {"category": "1/4 Solved", "count": solved_1, "percentage": f"{round((solved_1 / denom_part) * 100, 1)}%"},
        {"category": "0/4 Solved", "count": solved_0, "percentage": f"{round((solved_0 / denom_part) * 100, 1)}%"},
    ]

    # 8c. Official Leaderboard & Top Performers
    def leaderboard_sort_key(r: Dict[str, Any]):
        sc = r.get("score") if r.get("score") is not None else ((r.get("contest_solved") or 0) * 3)
        sol = r.get("contest_solved") or 0
        return (-sc, -sol)

    leaderboard_candidates = sorted(participants_list, key=leaderboard_sort_key)
    official_leaderboard: List[Dict[str, Any]] = []
    for idx, r in enumerate(leaderboard_candidates, start=1):
        official_leaderboard.append({
            "rank": idx,
            "student_name": r["name"],
            "reg_no": r["reg_no"],
            "dept": r["dept"],
            "year": r["year"],
            "q1": r["q1"] if r["q1"] is not None else "Not Available",
            "q2": r["q2"] if r["q2"] is not None else "Not Available",
            "q3": r["q3"] if r["q3"] is not None else "Not Available",
            "q4": r["q4"] if r["q4"] is not None else "Not Available",
            "solved": r["contest_solved"] if r["contest_solved"] is not None else "Not Available",
            "score": r.get("score") if r.get("score") is not None else (r["contest_solved"] * 3 if r["contest_solved"] is not None else "Not Available")
        })

    top_performers = [
        {
            "rank": item["rank"],
            "student": item["student_name"],
            "student_name": item["student_name"],
            "reg_no": item["reg_no"],
            "dept": item["dept"],
            "year": item["year"],
            "solved": item["solved"],
            "score": item["score"]
        }
        for item in official_leaderboard[:25]
    ]

    # 8d. Department-Wise Official Result
    dept_groups: Dict[str, List[Dict[str, Any]]] = {}
    for r in sorted_rows:
        d = r["dept"] or "Not Available"
        dept_groups.setdefault(d, []).append(r)

    department_results: List[Dict[str, Any]] = []
    for d_code, d_rows in dept_groups.items():
        tot_d = len(d_rows)
        d_parts = [dr for dr in d_rows if dr["status"] in (ContestStatus.PUBLIC_LIVE.value, ContestStatus.VIRTUAL_PRACTICE.value, ContestStatus.PUBLIC_ATTENDED.value, ContestStatus.VIRTUAL_ATTENDED.value)]
        part_cnt = len(d_parts)
        part_pct = round((part_cnt / max(tot_d, 1)) * 100, 1)
        s4 = sum(1 for dr in d_parts if dr["contest_solved"] == 4)
        s3 = sum(1 for dr in d_parts if dr["contest_solved"] == 3)
        s2 = sum(1 for dr in d_parts if dr["contest_solved"] == 2)
        s1 = sum(1 for dr in d_parts if dr["contest_solved"] == 1)
        s0 = sum(1 for dr in d_parts if dr["contest_solved"] == 0)
        tot_solves = sum((dr["contest_solved"] or 0) for dr in d_parts)
        avg_solves = round(tot_solves / max(tot_d, 1), 2)
        department_results.append({
            "department": d_code,
            "total_students": tot_d,
            "participants": part_cnt,
            "participation_pct": f"{part_pct}%",
            "solved_4": s4,
            "solved_3": s3,
            "solved_2": s2,
            "solved_1": s1,
            "solved_0": s0,
            "total_solves": tot_solves,
            "average_solved": avg_solves
        })

    # 8e. Data Validation Check
    reg_no_counts = {}
    has_dup = False
    for r in student_rows:
        rg = r.get("reg_no")
        if rg:
            reg_no_counts[rg] = reg_no_counts.get(rg, 0) + 1
            if reg_no_counts[rg] > 1:
                has_dup = True
                break

    is_valid_data = not has_dup
    validation_error = None if is_valid_data else "Official result generation blocked because validated source data contains critical errors."

    # 9. Format Title
    CONTEST_REPORT_TITLES = {
        "FRIDAY_OFFICIAL_CONTEST": "Friday Official Contest Result",
        "OFFICIAL_CONTEST": "Friday Official Contest Result",
        "WEEKLY_CONTEST_INTELLIGENCE": "Weekly Contest Intelligence Report",
        "SUNDAY_LIVE_CONTEST": "Sunday Live Contest Report",
        "CONTEST_ATTENDANCE_PARTICIPATION": "Contest Attendance & Participation Report",
        "CONTEST_PERFORMANCE_RANKING": "Contest Performance & Ranking Report",
    }
    rpt_key = config.report_type or "FRIDAY_OFFICIAL_CONTEST"
    base_title = CONTEST_REPORT_TITLES.get(rpt_key, f"{contest_name} Official Contest Result")
    title = base_title
    if dept_filter != "ALL":
        title = f"{dept_filter} - {title}"
    if year_filter != "ALL":
        title = f"{title} ({year_filter} Year)"

    report_id = f"RPT-FRIDAY-{datetime.datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    version_str = f"v1.0.0 | Template Rev 3.0 | Contest {contest_id} | Generated {datetime.datetime.utcnow().strftime('%d-%m-%Y')}"

    dataset: Dict[str, Any] = {
        "reportId": report_id,
        "report_id": report_id,
        "reportType": rpt_key,
        "report_type": rpt_key,
        "collegeName": "NANDHA ENGINEERING COLLEGE",
        "reportTitle": "Friday Official Contest Result",
        "title": f"NANDHA ENGINEERING COLLEGE (AUTONOMOUS)\n{title.upper()}",
        "contestName": contest_name,
        "contest_name": contest_name,
        "contestDate": contest_date,
        "sessionDate": contest_date,
        "session_date": contest_date,
        "contestId": contest_id,
        "academicYear": "Academic Year 2026–2027",
        "contestWindow": "08:00 AM – 09:30 AM IST",
        "version": "v1.0.0",
        "templateRevision": "Rev 3.0",
        "versionString": version_str,
        "isValidated": is_valid_data,
        "validationError": validation_error,
        "generatedAt": datetime.datetime.utcnow().strftime("%d-%m-%Y %I:%M %p IST"),
        "verifiedAt": datetime.datetime.utcnow().isoformat(),
        "dataStatus": "READY" if (total_students > 0 and is_valid_data) else ("BLOCKED" if not is_valid_data else "PARTIAL"),
        "data_status": "READY" if (total_students > 0 and is_valid_data) else ("BLOCKED" if not is_valid_data else "PARTIAL"),
        "config": config.model_dump(),
        "contestSummary": {
            "latestContest": contest_name,
            "contestDate": contest_date,
            "totalStudents": total_students,
            "publicAttended": public_attended,
            "virtualAttended": virtual_attended,
            "notAttended": not_attended,
            "pendingUsername": pending_username,
            "fetchFailed": fetch_failed,
            "invalidUsername": invalid_username,
            "unknown": unknown,
            "totalParticipants": total_participants,
            "totalContestSolved": total_contest_solved,
            "averageProblemsSolved": average_problems_solved,
            "averageSolvedAmongParticipants": average_solved_among_participants,
            "participationRate": participation_rate,
            "publicAttendanceRate": public_attendance_rate,
            "virtualAttendanceRate": virtual_attendance_rate
        },
        "solveDistribution": {
            "solved4": solved_4,
            "solved3": solved_3,
            "solved2": solved_2,
            "solved1": solved_1,
            "solved0": solved_0,
            "atLeast1Solved": at_least_1_solved,
            "zeroSolvedParticipated": zero_solved_participated,
            "notParticipated": not_participated
        },
        "questionWiseResult": question_wise_result,
        "solveDistributionList": solve_distribution_list,
        "officialLeaderboard": official_leaderboard,
        "topPerformers": top_performers,
        "departmentResults": department_results,
        "performanceTable": accuracy_audit["performance_table"],
        "performance_table": accuracy_audit["performance_table"],
        "metrics": {
            "totalStudents": total_students,
            "publicAttended": public_attended,
            "virtualAttended": virtual_attended,
            "notAttended": not_attended,
            "pendingUsername": pending_username,
            "fetchFailed": fetch_failed,
            "invalidUsername": invalid_username,
            "unknown": unknown,
            "totalParticipants": total_participants,
            "totalContestSolved": total_contest_solved,
            "averageProblemsSolved": average_problems_solved,
            "averageSolvedAmongParticipants": average_solved_among_participants,
            "participationRate": f"{participation_rate}%",
            "publicAttendanceRate": f"{public_attendance_rate}%",
            "virtualAttendanceRate": f"{virtual_attendance_rate}%",
            "4 Q Solved": solved_4,
            "3 Q Solved": solved_3,
            "2 Q Solved": solved_2,
            "1 Q Solved": solved_1,
            "0 Q Solved": solved_0
        },
        "distribution": {
            "4 Problems Solved": solved_4,
            "3 Problems Solved": solved_3,
            "2 Problems Solved": solved_2,
            "1 Problem Solved": solved_1,
            "0 Problems Solved": solved_0,
            "Not Attended": not_attended
        },
        "reconciliation": {
            "isReconciled": roster_sum == total_students and solve_sum == total_participants and accuracy_audit["is_population_reconciled"],
            "totalRoster": total_students,
            "sumStatuses": roster_sum,
            "totalParticipants": total_participants,
            "sumSolveDistribution": solve_sum,
            "formula": accuracy_audit["math_formula"],
            "departmentReconciliation": accuracy_audit["department_reconciliation"],
            "yearReconciliation": accuracy_audit["year_reconciliation"]
        },
        "allStudents": sorted_rows,
        "rows": sorted_rows,
        "topStudents": top_performers
    }

    # Persist in ReportHistory for auditability and fast exports
    history_entry = ReportHistory(
        report_id=report_id,
        report_type="CONTEST_PERFORMANCE",
        title=title,
        filters=config.model_dump(),
        dataset=dataset,
        status="GENERATED"
    )
    db.add(history_entry)
    db.commit()

    return dataset
