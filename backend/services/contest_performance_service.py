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
    t = target_dept.strip().upper()
    if t in ("ALL", "ALL DEPARTMENTS", "ALL DEPT", "ALL DEPTS"):
        return None
    return t


def normalize_year_filter(target_year: Optional[str]) -> Optional[str]:
    if not target_year:
        return None
    t = target_year.strip().upper()
    if t in ("ALL", "ALL YEARS", "ALL BATCHES", "ALL BATCH"):
        return None
    return t


def normalize_dept_val(code_raw: Optional[str], name_raw: Optional[str] = "") -> str:
    c = str(code_raw or "").upper().strip()
    n = str(name_raw or "").upper().strip()
    if "IOT" in c or "IOT" in n or "CI" in c:
        return "CSE(IoT)"
    if "CYBER" in c or "CYBER" in n or "CC" in c or ("CS" in c and "IOT" not in c):
        return "CSE(CS)"
    return str(code_raw or "CSE(CS)")


def matches_dept(r_dept_code: str, r_dept_name: str, target_dept: Optional[str]) -> bool:
    norm_target = normalize_department_filter(target_dept)
    if norm_target is None:
        return True
    student_norm = normalize_dept_val(r_dept_code, r_dept_name)
    target_norm = normalize_dept_val(norm_target, norm_target)
    return student_norm == target_norm


def normalize_year_val(year_raw: Optional[str]) -> str:
    y = str(year_raw or "").upper().replace("YEAR", "").replace("🎓", "").strip()
    if "III" in y or "3" in y:
        return "III"
    if "IV" in y or "4" in y:
        return "IV"
    if "II" in y or "2" in y:
        return "II"
    if "I" in y or "1" in y:
        return "I"
    return "III"


def matches_year(r_year: Optional[str], target_year: Optional[str]) -> bool:
    norm_target = normalize_year_filter(target_year)
    if norm_target is None:
        return True
    return normalize_year_val(r_year) == normalize_year_val(norm_target)


def build_contest_performance_report(db: Session, config: ReportConfig) -> Dict[str, Any]:
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
    scope = (config.output_scope or filters.get("output_scope", "COLLEGE")).upper()

    if scope in ("COLLEGE", "COLLEGE-WIDE", "COLLEGE_WIDE"):
        dept_filter = "ALL"
        year_filter = "ALL"
    elif scope in ("DEPARTMENT", "DEPARTMENT-WIDE", "DEPARTMENT_WIDE"):
        dept_filter = raw_dept
        year_filter = "ALL"
    elif scope in ("YEAR", "YEAR-WISE", "YEAR_WISE"):
        dept_filter = "ALL"
        year_filter = raw_year
    else:  # DEPARTMENT_YEAR, DEPT_YEAR, CUSTOM
        dept_filter = raw_dept
        year_filter = raw_year

    # 3. Query all active Master Students
    student_query = db.query(Student).filter(
        (Student.is_active == True) | (Student.is_active.is_(None))
    )
    all_master_students = student_query.order_by(Student.id.asc()).all()

    # Filter students by Department and Year
    filtered_students = [
        s for s in all_master_students
        if matches_dept(
            s.department.code if s.department else "",
            s.department.name if s.department else "",
            dept_filter
        ) and matches_year(s.year_level, year_filter)
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

            if fetch_st in ("USERNAME_NOT_FOUND", "INVALID_USERNAME", "INVALID_PROFILE", "INVALID_LINK"):
                status = ContestStatus.INVALID_USERNAME.value
            elif fetch_st in ("FETCH_FAILED", "FETCH_ERROR", "TIMEOUT", "NETWORK_ERROR", "SERVER_ERROR"):
                status = ContestStatus.FETCH_FAILED.value
            elif part_st in ("PUBLIC", "PUBLIC_ATTENDED", "OFFICIAL", "ATTENDED", "PUBLIC_LIVE"):
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
            elif part_st in ("PENDING", "INITIALIZING", "DATA_PENDING"):
                status = ContestStatus.PENDING_USERNAME.value
            else:
                status = ContestStatus.UNKNOWN.value
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
        if status not in (ContestStatus.PUBLIC_LIVE.value, ContestStatus.VIRTUAL_PRACTICE.value, ContestStatus.PUBLIC_ATTENDED.value, ContestStatus.VIRTUAL_ATTENDED.value):
            q1_val = None
            q2_val = None
            q3_val = None
            q4_val = None
            solved_val = None

        student_rows.append({
            "student_id": s_id,
            "reg_no": reg_no,
            "name": name,
            "dept": dept_norm,
            "year": yr_norm,
            "username": username,
            "status": status,
            "participation_status": status,
            "contest_name": contest_name,
            "contest_date": contest_date,
            "session_date": contest_date,
            "q1": q1_val,
            "q2": q2_val,
            "q3": q3_val,
            "q4": q4_val,
            "contest_solved": solved_val,
            "total_solved": solved_val,
            "rank": rank_val if rank_val is not None else "—",
            "rating": rating_val
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

    # 9. Format Title
    title = f"{contest_name} Performance Report"
    if dept_filter != "ALL":
        title = f"{dept_filter} - {title}"
    if year_filter != "ALL":
        title = f"{title} ({year_filter} Year)"

    report_id = f"RPT-CONTEST-{datetime.datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    dataset: Dict[str, Any] = {
        "reportId": report_id,
        "report_id": report_id,
        "reportType": "CONTEST_PERFORMANCE",
        "report_type": "CONTEST_PERFORMANCE",
        "title": f"NANDHA ENGINEERING COLLEGE (AUTONOMOUS)\n{title.upper()}",
        "contestName": contest_name,
        "contest_name": contest_name,
        "contestDate": contest_date,
        "sessionDate": contest_date,
        "session_date": contest_date,
        "contestId": contest_id,
        "generatedAt": datetime.datetime.utcnow().isoformat(),
        "verifiedAt": datetime.datetime.utcnow().isoformat(),
        "dataStatus": "READY" if total_students > 0 else "PARTIAL",
        "data_status": "READY" if total_students > 0 else "PARTIAL",
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
        "topStudents": [r for r in sorted_rows if r["status"] in (ContestStatus.PUBLIC_LIVE.value, ContestStatus.VIRTUAL_PRACTICE.value, ContestStatus.PUBLIC_ATTENDED.value, ContestStatus.VIRTUAL_ATTENDED.value)][:50]
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
