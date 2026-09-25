"""
backend/services/wow_intel_service.py

Week-on-Week Intelligence Report builder.
Compares the PREVIOUS contest session vs the CURRENT contest session,
producing a preview dataset + download-ready structure.
"""
import datetime
import uuid
from typing import Any, Dict, List, Optional
from backend.logger import logger
from backend.models import Student, WeeklySession, WeeklyPublicResult, Department
from sqlalchemy.orm import joinedload


def _contest_num(sess: WeeklySession) -> Optional[int]:
    """Extract numeric contest number from session object."""
    raw = str(sess.contest_id or sess.contest_name or "")
    digits = "".join(filter(str.isdigit, raw))
    return int(digits) if digits else None


def _is_attended(status: str) -> bool:
    s = (status or "").upper()
    return s in ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED", "OFFICIAL", "PUBLIC_LIVE")


def build_wow_intel_report(db, config, current_user=None) -> Dict[str, Any]:
    """Build week-on-week comparison dataset for preview and download."""
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

        if len(contest_sessions) < 2:
            return _empty_wow_report("Insufficient sessions (need at least 2 contests with data).")

        prev_num, prev_sess = contest_sessions[-2]
        curr_num, curr_sess = contest_sessions[-1]

        # 2. Load roster (all active students)
        all_stus = db.query(Student).options(joinedload(Student.department)).all()
        roster = [
            s for s in all_stus
            if (s.is_active is True or s.is_active is None)
            and s.reg_no
            and not s.reg_no.startswith("CONCUR_")
            and not s.reg_no.startswith("732224TEST")
        ]
        # Apply filters
        if dept_filter != "ALL":
            dept_map = {d.id: d.code for d in db.query(Department).all()}
            roster = [s for s in roster if dept_map.get(s.department_id, "") == dept_filter]
        if year_filter != "ALL":
            year_int_map = {"I": 1, "II": 2, "III": 3, "IV": 4}
            y_int = year_int_map.get(year_filter, 0)
            if y_int:
                roster = [s for s in roster if s.year == y_int]

        roster.sort(key=lambda s: s.reg_no)

        # 3. Fetch results for both sessions
        target_ids = [prev_sess.id, curr_sess.id]
        pub_results = db.query(WeeklyPublicResult).filter(
            WeeklyPublicResult.session_id.in_(target_ids)
        ).all()
        pub_map: Dict[tuple, WeeklyPublicResult] = {(pr.student_id, pr.session_id): pr for pr in pub_results}

        def _get_data(s: Student, sess: WeeklySession) -> Dict[str, Any]:
            if not sess:
                return {"att": False, "q1": 0, "q2": 0, "q3": 0, "q4": 0, "solved": 0, "score": 0, "rank": None}
            pr = pub_map.get((s.id, sess.id))
            if not pr:
                return {"att": False, "q1": 0, "q2": 0, "q3": 0, "q4": 0, "solved": 0, "score": 0, "rank": None}
            is_att = _is_attended(pr.participation_status or "") or (pr.total_contest_solved or 0) > 0 or pr.contest_rank is not None
            solved = pr.total_contest_solved or 0
            q1 = 1 if (pr.q1 or 0) > 0 else 0
            q2 = 1 if (pr.q2 or 0) > 0 else 0
            q3 = 1 if (pr.q3 or 0) > 0 else 0
            q4 = 1 if (pr.q4 or 0) > 0 else 0
            return {
                "att": is_att,
                "q1": q1 if is_att else 0,
                "q2": q2 if is_att else 0,
                "q3": q3 if is_att else 0,
                "q4": q4 if is_att else 0,
                "solved": max(q1 + q2 + q3 + q4, solved) if is_att else 0,
                "score": (pr.contest_score or 0) if is_att else 0,
                "rank": pr.contest_rank if is_att else None,
            }

        # 4. Build per-student rows with prev vs curr comparison
        rows = []
        for idx, s in enumerate(roster, 1):
            dept_obj = s.department
            dept_code = dept_obj.code if dept_obj else "N/A"
            year_disp = {1: "I", 2: "II", 3: "III", 4: "IV"}.get(s.year, str(s.year or ""))

            prev_d = _get_data(s, prev_sess)
            curr_d = _get_data(s, curr_sess)

            prev_status = "ATTENDED" if prev_d["att"] else "NOT ATTENDED"
            curr_status = "ATTENDED" if curr_d["att"] else "NOT ATTENDED"

            # Trend arrow
            diff = curr_d["solved"] - prev_d["solved"]
            trend = "↑" if diff > 0 else ("↓" if diff < 0 else "→")

            rows.append({
                "s_no": idx,
                "reg_no": s.reg_no,
                "name": s.name or "",
                "dept": dept_code,
                "year": year_disp,
                "username": s.username or "Unlinked",
                # Previous week
                "prev_status": prev_status,
                "prev_q1": prev_d["q1"],
                "prev_q2": prev_d["q2"],
                "prev_q3": prev_d["q3"],
                "prev_q4": prev_d["q4"],
                "prev_solved": prev_d["solved"],
                "prev_score": prev_d["score"],
                # Current week
                "curr_status": curr_status,
                "curr_q1": curr_d["q1"],
                "curr_q2": curr_d["q2"],
                "curr_q3": curr_d["q3"],
                "curr_q4": curr_d["q4"],
                "curr_solved": curr_d["solved"],
                "curr_score": curr_d["score"],
                # Delta
                "solved_delta": diff,
                "trend": trend,
            })

        # 5. Summary metrics
        total = len(roster)
        prev_att_cnt = sum(1 for r in rows if r["prev_status"] == "ATTENDED")
        curr_att_cnt = sum(1 for r in rows if r["curr_status"] == "ATTENDED")
        prev_solves = sum(r["prev_solved"] for r in rows)
        curr_solves = sum(r["curr_solved"] for r in rows)
        improved = sum(1 for r in rows if r["solved_delta"] > 0)
        declined = sum(1 for r in rows if r["solved_delta"] < 0)
        stable = total - improved - declined

        prev_date = getattr(prev_sess, "session_date", "N/A")
        curr_date = getattr(curr_sess, "session_date", "N/A")

        report_id = f"RPT-WOW-{datetime.datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        return {
            "reportId": report_id,
            "reportType": "WEEK_ON_WEEK_INTELLIGENCE",
            "report_type": "WEEK_ON_WEEK_INTELLIGENCE",
            "reportTitle": "Week-on-Week Intelligence",
            "collegeName": "NANDHA ENGINEERING COLLEGE",
            "generatedAt": datetime.datetime.now().strftime("%d-%m-%Y %I:%M %p IST"),
            "prevContest": f"Contest {prev_num}",
            "currContest": f"Contest {curr_num}",
            "prevDate": prev_date,
            "currDate": curr_date,
            "filters": {"department": dept_filter, "year": year_filter},
            "wowSummary": {
                "totalStudents": total,
                "prevAttendance": prev_att_cnt,
                "currAttendance": curr_att_cnt,
                "attendanceDelta": curr_att_cnt - prev_att_cnt,
                "prevTotalSolves": prev_solves,
                "currTotalSolves": curr_solves,
                "solvesDelta": curr_solves - prev_solves,
                "improved": improved,
                "declined": declined,
                "stable": stable,
                "prevContestNum": prev_num,
                "currContestNum": curr_num,
            },
            "allStudents": rows,
            "rows": rows,
        }

    except Exception as e:
        logger.error(f"[WOW_INTEL] Build failed: {e}", exc_info=True)
        return _empty_wow_report(str(e))


def _empty_wow_report(reason: str) -> Dict[str, Any]:
    return {
        "reportId": "RPT-WOW-EMPTY",
        "reportType": "WEEK_ON_WEEK_INTELLIGENCE",
        "report_type": "WEEK_ON_WEEK_INTELLIGENCE",
        "reportTitle": "Week-on-Week Intelligence",
        "collegeName": "NANDHA ENGINEERING COLLEGE",
        "generatedAt": datetime.datetime.now().strftime("%d-%m-%Y %I:%M %p IST"),
        "error": reason,
        "wowSummary": {"totalStudents": 0},
        "allStudents": [],
        "rows": [],
    }
