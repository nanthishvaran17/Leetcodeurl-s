"""
backend/services/hist_intel_service.py

Historical Contest Intelligence Report builder.
Aggregates ALL past contest sessions into a per-student history table
showing attendance and solve counts for every recorded week.
"""
import datetime
import uuid
import re
from typing import Any, Dict, List, Optional
from backend.logger import logger
from backend.models import Student, WeeklySession, WeeklyPublicResult, Department
from backend.time_utils import format_ist, now_utc
from sqlalchemy.orm import joinedload


def _contest_num(sess: WeeklySession) -> Optional[int]:
    raw = str(sess.contest_id or sess.contest_name or "")
    digits = "".join(filter(str.isdigit, raw))
    return int(digits) if digits else None


def _is_attended(status: Any) -> bool:
    s = str(status or "").upper()
    return s in ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED", "OFFICIAL", "PUBLIC_LIVE", "ATTENDED_ZERO", "ATTENDED_SOLVED")


def build_hist_intel_report(db, config, current_user=None) -> Dict[str, Any]:
    """Build historical contest intelligence dataset for all sessions."""
    try:
        dept_filter = (config.department or "ALL").upper()
        year_filter = (config.year or "ALL").upper()

        filters = config.filters or {}
        report_date_str = filters.get("session_id") or filters.get("report_date") or getattr(config, "report_date", None)
        limit_date = datetime.date.today()
        if report_date_str and str(report_date_str).lower() not in ("latest", "all", "none", ""):
            if str(report_date_str).isdigit():
                try:
                    session_obj = db.query(WeeklySession).filter(WeeklySession.id == int(report_date_str)).first()
                    if session_obj and session_obj.session_date:
                        report_date_str = session_obj.session_date
                except Exception:
                    pass
            try:
                if "." in str(report_date_str):
                    limit_date = datetime.datetime.strptime(str(report_date_str), "%d.%m.%Y").date()
                else:
                    limit_date = datetime.datetime.strptime(str(report_date_str), "%Y-%m-%d").date()
            except Exception:
                pass

        # 1. Load all sessions ordered by contest number, excluding future scheduled ones
        raw_sessions = db.query(WeeklySession).filter(WeeklySession.status != "SCHEDULED").all()
        
        valid_sessions = []
        for s in raw_sessions:
            if not s.session_date:
                continue
            name = (s.contest_name or "").strip()
            if re.search(r"\b(test|mock)\b", name, re.IGNORECASE) or name.upper().startswith("TEST_"):
                continue
            try:
                if "." in s.session_date:
                    d_obj = datetime.datetime.strptime(s.session_date, "%d.%m.%Y").date()
                else:
                    d_obj = datetime.datetime.strptime(s.session_date, "%Y-%m-%d").date()
                if d_obj <= limit_date:
                    valid_sessions.append(s)
            except Exception:
                pass
                
        valid_sessions.sort(key=lambda x: x.id)
        
        contest_sessions = []
        for sess in valid_sessions:
            num = _contest_num(sess)
            if num is not None:
                contest_sessions.append((num, sess))
            else:
                contest_sessions.append((sess.id, sess))
        contest_sessions.sort(key=lambda x: x[0])

        if not contest_sessions:
            return _empty_hist_report("No contest sessions found in database.")

        from backend.services.contest_performance_service import matches_dept, matches_year, is_official_student
        all_stus = db.query(Student).options(joinedload(Student.department)).all()
        roster = [
            s for s in all_stus
            if (s.is_active is True or s.is_active is None)
            and is_official_student(s.reg_no)
        ]
        print(f"DEBUG: Initial roster length: {len(roster)}")
        from backend.services.contest_performance_service import matches_dept, matches_year
        if dept_filter != "ALL":
            roster = [
                s for s in roster
                if matches_dept(
                    s.department.code if s.department else "",
                    s.department.name if s.department else "",
                    dept_filter,
                    s.department_id
                )
            ]
        if year_filter != "ALL":
            roster = [
                s for s in roster
                if matches_year(s.year_level, year_filter, s.reg_no)
            ]
        roster.sort(key=lambda s: s.reg_no)

        # 3. Fetch all results for all historical sessions
        target_ids = [sess.id for _, sess in contest_sessions]
        pub_results = db.query(WeeklyPublicResult).filter(
            WeeklyPublicResult.session_id.in_(target_ids)
        ).all()
        pub_map: Dict[tuple, WeeklyPublicResult] = {(pr.student_id, pr.session_id): pr for pr in pub_results}

        # Do not filter out contests with 0 valid attendances to avoid gaps
        # (user explicitly requested 516 to 521 to be shown even if no data)
        # We just keep all contest_sessions intact.
        pass

        # 4. Build session headers list
        session_headers = []
        for c_num, sess in contest_sessions:
            session_headers.append({
                "contestNum": c_num,
                "sessionId": sess.id,
                "date": getattr(sess, "session_date", "N/A"),
                "label": f"Contest {c_num}",
            })

        from backend.services.contest_performance_service import normalize_year_val
        # 5. Build per-student rows
        rows = []
        for idx, s in enumerate(roster, 1):
            dept_obj = s.department
            dept_code = dept_obj.code if dept_obj else "N/A"
            year_disp = normalize_year_val(s.year_level, s.reg_no) or "N/A"

            weekly_data = []
            total_attended = 0
            total_solved_all = 0

            for c_num, sess in contest_sessions:
                pr = pub_map.get((s.id, sess.id))
                if not pr:
                    weekly_data.append({"contestNum": c_num, "att": False, "solved": 0, "score": 0})
                    continue
                is_att = _is_attended(pr.participation_status or "") or (pr.total_contest_solved or 0) > 0 or pr.contest_rank is not None
                solved = pr.total_contest_solved or 0
                q1 = 1 if (pr.q1 or 0) > 0 else 0
                q2 = 1 if (pr.q2 or 0) > 0 else 0
                q3 = 1 if (pr.q3 or 0) > 0 else 0
                q4 = 1 if (pr.q4 or 0) > 0 else 0
                actual_solved = max(q1 + q2 + q3 + q4, solved) if is_att else 0
                weekly_data.append({
                    "contestNum": c_num,
                    "att": is_att,
                    "solved": actual_solved,
                    "score": (pr.contest_score or 0) if is_att else 0,
                })
                if is_att:
                    total_attended += 1
                    total_solved_all += actual_solved

            # Consistency score: % of sessions attended
            consistency_pct = round((total_attended / max(len(contest_sessions), 1)) * 100, 1)

            rows.append({
                "s_no": idx,
                "reg_no": s.reg_no,
                "name": s.name or "",
                "dept": dept_code,
                "year": year_disp,
                "accommodation": getattr(s, "accommodation", None) or "Day Scholar",
                "twelfth_cutoff": getattr(s, "twelfth_cutoff", None),
                "cutoff": getattr(s, "twelfth_cutoff", None),
                "username": s.username or "Unlinked",
                "totalAttended": total_attended,
                "total_attended": total_attended,
                "contests_attended": total_attended,
                "totalSolved": total_solved_all,
                "total_solved": total_solved_all,
                "contest_solved": total_solved_all,
                "consistencyPct": consistency_pct,
                "weeklyData": weekly_data,
            })

        # 6. Overall summary
        total = len(roster)
        num_sessions = len(contest_sessions)

        # Participation per session
        session_participation = []
        for c_num, sess in contest_sessions:
            att_cnt = sum(
                1 for s in roster
                if pub_map.get((s.id, sess.id)) is not None
                and (
                    _is_attended(pub_map[(s.id, sess.id)].participation_status or "")
                    or (pub_map[(s.id, sess.id)].total_contest_solved or 0) > 0
                    or pub_map[(s.id, sess.id)].contest_rank is not None
                )
            )
            session_participation.append({
                "contestNum": c_num,
                "date": getattr(sess, "session_date", "N/A"),
                "attended": att_cnt,
                "total": total,
                "rate": f"{round(att_cnt / max(total, 1) * 100, 1)}%",
            })

        latest_date = getattr(contest_sessions[-1][1], "session_date", "N/A") if contest_sessions else "N/A"
        latest_name = getattr(contest_sessions[-1][1], "contest_name", "Historical Contests") if contest_sessions else "Historical Contests"
        report_id = f"RPT-HIST-{datetime.datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        dataset = {
            "reportId": report_id,
            "reportType": "HISTORICAL_CONTEST_INTELLIGENCE",
            "report_type": "HISTORICAL_CONTEST_INTELLIGENCE",
            "reportTitle": "Historical Contest Intelligence",
            "collegeName": "NANDHA ENGINEERING COLLEGE",
            "generatedAt": format_ist(now_utc(), "%d-%m-%Y %I:%M %p IST"),
            "sessionDate": latest_date,
            "session_date": latest_date,
            "contestName": latest_name,
            "deptFilter": dept_filter,
            "yearFilter": year_filter,
            "filters": {"department": dept_filter, "year": year_filter},
            "sessionHeaders": session_headers,
            "histSummary": {
                "totalStudents": total,
                "numSessions": num_sessions,
                "sessionParticipation": session_participation,
            },
            "allStudents": rows,
            "rows": rows,
        }

        from backend.routes.reports import _enrich_dataset_ranks_and_ratings
        dataset = _enrich_dataset_ranks_and_ratings(dataset, db)
        return dataset

    except Exception as e:
        logger.error(f"[HIST_INTEL] Build failed: {e}", exc_info=True)
        return _empty_hist_report(str(e))


def _empty_hist_report(reason: str) -> Dict[str, Any]:
    return {
        "reportId": "RPT-HIST-EMPTY",
        "reportType": "HISTORICAL_CONTEST_INTELLIGENCE",
        "report_type": "HISTORICAL_CONTEST_INTELLIGENCE",
        "reportTitle": "Historical Contest Intelligence",
        "collegeName": "NANDHA ENGINEERING COLLEGE",
        "generatedAt": format_ist(now_utc(), "%d-%m-%Y %I:%M %p IST"),
        "error": reason,
        "sessionHeaders": [],
        "histSummary": {"totalStudents": 0, "numSessions": 0},
        "allStudents": [],
        "rows": [],
    }
