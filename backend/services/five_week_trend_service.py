"""
five_week_trend_service.py
Nandha Engineering College — Five-Week Performance Trend Engine
Calculates 5-contest historical solve trajectories, attendance consistency,
and performance signals (Improving ↑, Stable →, Declining ↓, Follow-Up)
across the latest 5 completed Weekly Contests.
"""

import re
import uuid
import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from backend.models import Student, WeeklySession, WeeklyPublicResult
from backend.services.report_models import ReportConfig
from backend.services.authorization_service import apply_role_based_student_filter
from backend.services.contest_performance_service import matches_dept, matches_year, normalize_dept_val, normalize_year_val
from backend.services.weekly_session_resolver import parse_session_date, extract_contest_number
from backend.logger import logger


def build_five_week_trend_report(
    db: Session,
    config: ReportConfig,
    current_user: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Builds authoritative 5-Week Performance Trend Report.
    Calculates per-student 5-contest solve breakdown, attendance consistency, and trajectory signals.
    """
    # 1. Fetch all weekly sessions (excluding test/mock)
    all_raw_sessions = db.query(WeeklySession).filter(WeeklySession.status != "SCHEDULED").all()
    
    usable_sessions = []
    for s in all_raw_sessions:
        c_name = str(s.contest_name or "")
        if re.search(r'\b(test|mock)\b', c_name, re.IGNORECASE) or c_name.upper().startswith("TEST_"):
            continue
        cnt = db.query(WeeklyPublicResult).filter(
            WeeklyPublicResult.session_id == s.id,
            WeeklyPublicResult.participation_status.in_(["PUBLIC", "PUBLIC_ATTENDED", "ATTENDED", "OFFICIAL", "PUBLIC_LIVE", "ATTENDED_ZERO", "ATTENDED_SOLVED"])
        ).count()
        if cnt > 0:
            usable_sessions.append(s)

    # Sort all usable sessions strictly chronologically by parsed date and contest number ascending (oldest -> newest)
    def _session_chronological_key(s):
        p_date = parse_session_date(s.session_date) or datetime.date.min
        c_num = extract_contest_number(s) or s.id or 0
        return (p_date, c_num, s.id)

    usable_sessions.sort(key=_session_chronological_key)

    # Respect session_id or contest target to generate 5-week trend looking backward from the selected historical Sunday
    override_session_id = (config.filters or {}).get("session_id") or getattr(config, "session_id", None) or (config.filters or {}).get("report_date")
    
    target_idx = None
    if override_session_id and str(override_session_id).lower() not in ("latest", "all", "none", ""):
        # Check by id or by contest number
        if str(override_session_id).isdigit():
            req_id = int(override_session_id)
            for idx, s in enumerate(usable_sessions):
                if s.id == req_id or extract_contest_number(s) == req_id:
                    target_idx = idx
                    break
        if target_idx is None:
            for idx, s in enumerate(usable_sessions):
                if s.session_date == str(override_session_id) or str(s.contest_name or "") == str(override_session_id):
                    target_idx = idx
                    break
        if target_idx is None:
            c_target = extract_contest_number(str(override_session_id))
            if c_target is not None:
                for idx, s in enumerate(usable_sessions):
                    if extract_contest_number(s) == c_target:
                        target_idx = idx
                        break

    if target_idx is not None:
        start_idx = max(0, target_idx - 4)
        five_sessions = usable_sessions[start_idx : target_idx + 1]
    else:
        five_sessions = usable_sessions[-5:] if len(usable_sessions) >= 5 else usable_sessions[:]

    session_ids = [s.id for s in five_sessions]
    session_names = [s.contest_name or f"Weekly Contest {extract_contest_number(s) or s.id}" for s in five_sessions]

    # Pad session_names to exactly 5 headers
    while len(session_names) < 5:
        session_names.insert(0, "Historical N/A")

    # Pre-fetch all public results for these 5 sessions
    public_results = db.query(WeeklyPublicResult).filter(
        WeeklyPublicResult.session_id.in_(session_ids)
    ).all() if session_ids else []

    res_map: Dict[tuple, WeeklyPublicResult] = {}
    for pr in public_results:
        res_map[(pr.student_id, pr.session_id)] = pr

    # Query Active Students matching dept and year filters
    filters = config.filters or {}
    raw_dept = config.department or filters.get("department", "ALL")
    raw_year = config.year or filters.get("year", "ALL")

    student_query = db.query(Student).filter(
        (Student.is_active == True) | (Student.is_active.is_(None))
    )
    student_query = apply_role_based_student_filter(student_query, current_user, db)
    all_students = student_query.distinct().order_by(Student.id.asc()).all()

    filtered_students = [
        s for s in all_students
        if matches_dept(
            s.department.code if s.department else "",
            s.department.name if s.department else "",
            raw_dept,
            getattr(s, "department_id", None)
        ) and matches_year(s.year_level, raw_year)
    ]

    student_rows = []
    improving_cnt = 0
    stable_cnt = 0
    declining_cnt = 0
    followup_cnt = 0
    consistent_att_cnt = 0
    total_5_solves = 0

    for idx, s in enumerate(filtered_students, 1):
        s_id = s.id
        dept_code = s.department.code if s.department else "CSE"
        dept_norm = normalize_dept_val(dept_code, s.department.name if s.department else "")
        yr_norm = normalize_year_val(s.year_level or "III")

        c_solves = []
        c_att_flags = []

        for sess_id in session_ids:
            pr = res_map.get((s_id, sess_id))
            if pr:
                part_st = str(pr.participation_status or "").upper()
                is_att = part_st in ("PUBLIC", "PUBLIC_ATTENDED", "OFFICIAL", "ATTENDED", "PUBLIC_LIVE", "ATTENDED_ZERO", "ATTENDED_SOLVED") or (getattr(pr, "total_contest_solved", 0) or 0) > 0
                q1 = 1 if (pr.q1 and pr.q1 >= 1) else 0
                q2 = 1 if (pr.q2 and pr.q2 >= 1) else 0
                q3 = 1 if (pr.q3 and pr.q3 >= 1) else 0
                q4 = 1 if (pr.q4 and pr.q4 >= 1) else 0
                actual_q_sum = q1 + q2 + q3 + q4
                tot_rec = int(getattr(pr, "total_contest_solved", 0) or 0)
                sol = max(actual_q_sum, tot_rec) if is_att else 0
                c_solves.append(sol)
                c_att_flags.append(1 if is_att else 0)
            else:
                c_solves.append(0)
                c_att_flags.append(0)

        # Pad to 5 if fewer than 5 sessions exist
        while len(c_solves) < 5:
            c_solves.insert(0, 0)
            c_att_flags.insert(0, 0)

        tot_att = sum(c_att_flags)
        tot_sol = sum(c_solves)
        total_5_solves += tot_sol

        if tot_att >= 4:
            consistent_att_cnt += 1

        latest_sol = c_solves[-1]
        prev_avg = sum(c_solves[:-1]) / max(len(c_solves) - 1, 1)

        if latest_sol > prev_avg and latest_sol > 0:
            trajectory = "IMPROVING (↑)"
            improving_cnt += 1
        elif latest_sol < prev_avg and prev_avg > 0:
            trajectory = "DECLINING (↓)"
            declining_cnt += 1
        elif tot_att >= 2 and tot_sol > 0:
            trajectory = "STABLE (→)"
            stable_cnt += 1
        else:
            trajectory = "FOLLOW-UP"
            followup_cnt += 1

        att_pct = f"{(tot_att / max(len(five_sessions), 1) * 100):.0f}%"

        student_rows.append({
            "s_no": idx,
            "student_id": s_id,
            "reg_no": s.reg_no,
            "name": s.name,
            "dept": dept_norm,
            "year": yr_norm,
            "username": s.username or "Unlinked",
            "c1_solved": c_solves[0],
            "c2_solved": c_solves[1],
            "c3_solved": c_solves[2],
            "c4_solved": c_solves[3],
            "c5_solved": c_solves[4],
            "total_solved": tot_sol,
            "solved_5w": tot_sol,
            "w5_solved": tot_sol,
            "contests_attended": tot_att,
            "attendance_rate": att_pct,
            "trajectory": trajectory,
            "accommodation": getattr(s, "accommodation", "") or getattr(s, "accommodation_type", "") or "",
            "twelfth_cutoff": float(s.twelfth_cutoff) if (hasattr(s, "twelfth_cutoff") and s.twelfth_cutoff is not None) else None,
            "cutoff": float(s.twelfth_cutoff) if (hasattr(s, "twelfth_cutoff") and s.twelfth_cutoff is not None) else None,
            "status": "PUBLIC_ATTENDED" if tot_sol > 0 else "NOT_ATTENDED",
            "mentor_signal": trajectory
        })

    top_students = sorted(student_rows, key=lambda x: -x["total_solved"])[:10]

    report_id = f"RPT-TREND-{datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    title = "FIVE-WEEK PERFORMANCE TREND REPORT"
    if raw_dept != "ALL":
        title = f"{title} ({raw_dept})"
    if raw_year != "ALL":
        y_clean = str(raw_year).strip()
        if not y_clean.upper().endswith("YEAR"):
            y_clean = f"{y_clean} Year"
        title = f"{title} ({y_clean})"

    dataset = {
        "reportId": report_id,
        "reportType": "FIVE_WEEK_PERFORMANCE_TREND",
        "title": title,
        "contestName": session_names[-1] if session_names else "Weekly Contest",
        "sessionDate": datetime.date.today().strftime("%d.%m.%Y"),
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "verifiedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "dataStatus": "READY" if len(filtered_students) > 0 else "PARTIAL",
        "config": config.model_dump(),
        "metrics": {
            "totalStudents": len(filtered_students),
            "fiveContestConsistentSolvers": consistent_att_cnt,
            "improvingStudents": improving_cnt,
            "stableStudents": stable_cnt,
            "decliningStudents": declining_cnt,
            "followUpStudents": followup_cnt,
            "total5WeekSolves": total_5_solves,
            "average5WeekSolves": round(total_5_solves / max(len(filtered_students), 1), 2),
            "contestWindow": f"{session_names[0] if session_names else ''} - {session_names[-1] if session_names else ''}"
        },
        "sessionHeaders": session_names,
        "topStudents": top_students,
        "allStudents": student_rows,
        "rows": student_rows
    }

    try:
        from backend.models import ReportHistory
        history_entry = ReportHistory(
            report_id=report_id,
            report_type="FIVE_WEEK_PERFORMANCE_TREND",
            title=title,
            filters=config.model_dump(),
            dataset=dataset,
            status="GENERATED"
        )
        db.add(history_entry)
        db.commit()
    except Exception as e:
        db.rollback()
        try:
            from backend.models import ReportHistory
            history_entry = ReportHistory(
                report_id=report_id,
                report_type="FIVE_WEEK_PERFORMANCE_TREND",
                title=title,
                filters=config.model_dump(),
                dataset=dataset,
                status="GENERATED"
            )
            db.add(history_entry)
            db.commit()
        except Exception as retry_err:
            logger.warning(f"Failed to persist ReportHistory for Five-Week Trend: {retry_err}")

    return dataset
