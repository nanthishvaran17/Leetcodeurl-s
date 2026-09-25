"""
backend/services/hist_intel_service.py

Historical Contest Intelligence Report builder.
Aggregates ALL past contest sessions into a per-student history table
showing attendance and solve counts for every recorded week.
"""
import datetime
import uuid
from typing import Any, Dict, List, Optional
from backend.logger import logger
from backend.models import Student, WeeklySession, WeeklyPublicResult, Department
from sqlalchemy.orm import joinedload


def _contest_num(sess: WeeklySession) -> Optional[int]:
    raw = str(sess.contest_id or sess.contest_name or "")
    digits = "".join(filter(str.isdigit, raw))
    return int(digits) if digits else None


def _is_attended(status: str) -> bool:
    s = (status or "").upper()
    return s in ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED", "OFFICIAL", "PUBLIC_LIVE")


def build_hist_intel_report(db, config, current_user=None) -> Dict[str, Any]:
    """Build historical contest intelligence dataset for all sessions."""
    try:
        dept_filter = (config.department or "ALL").upper()
        year_filter = (config.year or "ALL").upper()

        # 1. Load all sessions ordered by contest number
        sessions = db.query(WeeklySession).order_by(WeeklySession.id.asc()).all()
        contest_sessions = []
        for sess in sessions:
            num = _contest_num(sess)
            if num and num >= 500:
                contest_sessions.append((num, sess))
        contest_sessions.sort(key=lambda x: x[0])

        if not contest_sessions:
            return _empty_hist_report("No contest sessions found in database.")

        # 2. Load roster
        all_stus = db.query(Student).options(joinedload(Student.department)).all()
        roster = [
            s for s in all_stus
            if (s.is_active is True or s.is_active is None)
            and s.reg_no
            and not s.reg_no.startswith("CONCUR_")
            and not s.reg_no.startswith("732224TEST")
        ]
        if dept_filter != "ALL":
            dept_map = {d.id: d.code for d in db.query(Department).all()}
            roster = [s for s in roster if dept_map.get(s.department_id, "") == dept_filter]
        if year_filter != "ALL":
            year_int_map = {"I": 1, "II": 2, "III": 3, "IV": 4}
            y_int = year_int_map.get(year_filter, 0)
            if y_int:
                roster = [s for s in roster if s.year == y_int]
        roster.sort(key=lambda s: s.reg_no)

        # 3. Fetch all results for all historical sessions
        target_ids = [sess.id for _, sess in contest_sessions]
        pub_results = db.query(WeeklyPublicResult).filter(
            WeeklyPublicResult.session_id.in_(target_ids)
        ).all()
        pub_map: Dict[tuple, WeeklyPublicResult] = {(pr.student_id, pr.session_id): pr for pr in pub_results}

        # 4. Build session headers list
        session_headers = []
        for c_num, sess in contest_sessions:
            session_headers.append({
                "contestNum": c_num,
                "sessionId": sess.id,
                "date": getattr(sess, "session_date", "N/A"),
                "label": f"Contest {c_num}",
            })

        # 5. Build per-student rows
        rows = []
        for idx, s in enumerate(roster, 1):
            dept_obj = s.department
            dept_code = dept_obj.code if dept_obj else "N/A"
            year_disp = {1: "I", 2: "II", 3: "III", 4: "IV"}.get(s.year, str(s.year or ""))

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
                "username": s.username or "Unlinked",
                "totalAttended": total_attended,
                "totalSolved": total_solved_all,
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

        report_id = f"RPT-HIST-{datetime.datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        return {
            "reportId": report_id,
            "reportType": "HISTORICAL_CONTEST_INTELLIGENCE",
            "report_type": "HISTORICAL_CONTEST_INTELLIGENCE",
            "reportTitle": "Historical Contest Intelligence",
            "collegeName": "NANDHA ENGINEERING COLLEGE",
            "generatedAt": datetime.datetime.now().strftime("%d-%m-%Y %I:%M %p IST"),
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
        "generatedAt": datetime.datetime.now().strftime("%d-%m-%Y %I:%M %p IST"),
        "error": reason,
        "sessionHeaders": [],
        "histSummary": {"totalStudents": 0, "numSessions": 0},
        "allStudents": [],
        "rows": [],
    }
