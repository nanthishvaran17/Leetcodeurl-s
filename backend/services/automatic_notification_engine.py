"""
automatic_notification_engine.py — Fully Automatic LeetCode Notification & Intelligence System

Features:
1. Daily Faculty Performance Analysis (10:00 AM IST):
   - Dynamic assigned student lookup (no hardcoded counts).
   - Real-time performance metric calculation (active, inactive, solved, milestones).
   - Automatic multi-channel dispatch (DB, WebSocket, FCM Push, Email).
   - Event deduplication (1 notification per faculty per calendar day).
2. Daily HOD Department Digest (10:05 AM IST):
   - Department-wide student statistics and faculty group tracking.
3. Daily Principal Executive Digest (10:10 AM IST):
   - College-wide performance trends and executive summaries.
4. Sunday Contest Automation Digests (Post-Finalization 9:40 AM IST):
   - Dynamic calculations of assigned, participated, absent (assigned - participated), completed, and follow-up.
   - Role-scoped delivery (Faculty -> assigned students, HOD -> department, Principal -> college).
5. Student Milestone & Inactivity Detection:
   - Configurable milestone rules (50, 100, 200, 300, 500, etc.) with strict single-trigger deduplication.
   - Verified inactivity detection with deduplicated weekly/daily alerts.
6. Admin System & Automation Failures:
   - Real-time alerts for system maintenance, scheduler errors, or delivery issues.
"""

import os
import json
import datetime
from typing import Dict, Any, List, Optional, cast
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_

from backend.time_utils import ensure_utc
from backend.models import (
    User, Student, Department, FacultyStudentAssignment,
    LeetCodeProfileStats, WeeklySession, WeeklyPublicResult,
    ContestParticipationRecord, NotificationRecord, StudentStatSnapshot
)
from backend.services.notification_service import NotificationService
from backend.time_utils import IST
from backend.logger import logger

# Configurable Milestones
MILESTONE_THRESHOLDS = [50, 100, 150, 200, 250, 300, 400, 500, 750, 1000]

def _today_ist_str() -> str:
    """Returns current date string in YYYY-MM-DD under Asia/Kolkata timezone."""
    return datetime.datetime.now(tz=IST).strftime("%Y-%m-%d")


class AutomaticNotificationEngine:

    @staticmethod
    def run_daily_faculty_performance_job(db: Session) -> Dict[str, Any]:
        """
        Runs automatically every day at 10:00 AM Asia/Kolkata IST.
        Dynamically calculates current student performance for each Faculty user
        and emits a short, professional, action-oriented digest.
        """
        today_str = _today_ist_str()
        logger.info(f"[AUTO_NOTIF] Starting Daily 10:00 AM IST Faculty Performance Analysis for {today_str}...")

        # 1. Fetch all active Faculty users
        faculty_users = db.query(User).filter(
            or_(User.is_active == True, User.is_active.is_(None)),
            or_(
                User.role.ilike("%faculty%"),
                User.role.ilike("%staff%"),
                User.role.ilike("%instructor%"),
                User.role.ilike("%mentor%"),
                User.role.ilike("%hod%")
            )
        ).all()

        logger.info(f"[DAILY_FACULTY_INTELLIGENCE] faculty_count={len(faculty_users)}")
        dispatched_count = 0
        skipped_count = 0

        for faculty in faculty_users:
            try:
                # 2. Dynamically find assigned active students strictly (no fallback)
                assigned_students = db.query(Student).join(
                    FacultyStudentAssignment, Student.id == FacultyStudentAssignment.student_id
                ).filter(
                    FacultyStudentAssignment.faculty_id == faculty.id,
                    or_(FacultyStudentAssignment.is_active == True, FacultyStudentAssignment.is_active.is_(None)),
                    or_(Student.is_active == True, Student.is_active.is_(None))
                ).all()

                total_assigned = len(assigned_students)
                loaded_students = [s for s in assigned_students if s.username]
                excluded_count = total_assigned - len(loaded_students)

                logger.info(
                    f"[FACULTY_ROSTER] faculty_id={faculty.id} "
                    f"assigned_students={total_assigned} eligible_students={len(loaded_students)} "
                    f"excluded_students={excluded_count} exclusion_reason={'Profiles missing username/data' if excluded_count > 0 else 'None'}"
                )
                logger.info(f"[DAILY_FACULTY_INTELLIGENCE] faculty_id={faculty.id} students={total_assigned}")

                if total_assigned == 0:
                    skipped_count += 1
                    continue

                student_ids = [s.id for s in assigned_students]

                # 3. Calculate dynamic performance metrics from actual LeetCode DB data
                # 3. Calculate dynamic performance metrics & Yesterday vs Today differences from actual LeetCode DB data
                now_utc = datetime.datetime.now(datetime.timezone.utc)
                cutoff_24h = now_utc - datetime.timedelta(hours=24)
                cutoff_48h = now_utc - datetime.timedelta(hours=48)
                cutoff_3d = now_utc - datetime.timedelta(days=3)
                cutoff_4d = now_utc - datetime.timedelta(days=4)

                # Today active (0-24h ago)
                active_today = db.query(LeetCodeProfileStats).filter(
                    LeetCodeProfileStats.student_id.in_(student_ids),
                    LeetCodeProfileStats.last_updated >= cutoff_24h
                ).count()

                # Yesterday active (24-48h ago)
                active_yesterday = db.query(LeetCodeProfileStats).filter(
                    LeetCodeProfileStats.student_id.in_(student_ids),
                    LeetCodeProfileStats.last_updated >= cutoff_48h,
                    LeetCodeProfileStats.last_updated < cutoff_24h
                ).count()
                diff_active = active_today - active_yesterday

                # Attention required (today vs yesterday)
                attention_today = db.query(LeetCodeProfileStats).filter(
                    LeetCodeProfileStats.student_id.in_(student_ids),
                    or_(
                        LeetCodeProfileStats.last_updated < cutoff_3d,
                        LeetCodeProfileStats.total_solved == 0,
                        LeetCodeProfileStats.last_updated.is_(None)
                    )
                ).count()

                attention_yesterday = db.query(LeetCodeProfileStats).filter(
                    LeetCodeProfileStats.student_id.in_(student_ids),
                    or_(
                        LeetCodeProfileStats.last_updated < cutoff_4d,
                        LeetCodeProfileStats.total_solved == 0,
                        LeetCodeProfileStats.last_updated.is_(None)
                    )
                ).count()
                diff_attention = attention_today - attention_yesterday

                # Problems solved today (0-24h)
                new_problems = db.query(
                    func.coalesce(func.sum(LeetCodeProfileStats.easy_solved + LeetCodeProfileStats.medium_solved + LeetCodeProfileStats.hard_solved), 0)
                ).filter(
                    LeetCodeProfileStats.student_id.in_(student_ids),
                    LeetCodeProfileStats.last_updated >= cutoff_24h
                ).scalar() or 0

                # Problems solved yesterday (24-48h)
                problems_yesterday = db.query(
                    func.coalesce(func.sum(LeetCodeProfileStats.easy_solved + LeetCodeProfileStats.medium_solved + LeetCodeProfileStats.hard_solved), 0)
                ).filter(
                    LeetCodeProfileStats.student_id.in_(student_ids),
                    LeetCodeProfileStats.last_updated >= cutoff_48h,
                    LeetCodeProfileStats.last_updated < cutoff_24h
                ).scalar() or 0
                diff_problems = new_problems - problems_yesterday

                new_milestones = 0
                for s in assigned_students:
                    if s.stats and s.stats.total_solved:
                        lu_utc = ensure_utc(s.stats.last_updated)
                        for m in MILESTONE_THRESHOLDS:
                            if s.stats.total_solved >= m and lu_utc and lu_utc >= cutoff_24h:
                                new_milestones += 1
                                break

                def fmt_diff(val: int) -> str:
                    return f"+{val}" if val > 0 else str(val)

                logger.info(f"[DAILY_FACULTY_INTELLIGENCE] intelligence_calculated faculty_id={faculty.id}")

                # 4. Format detailed faculty message with Yesterday vs Today allocation status difference
                title = "Daily Allocation Status & Performance Summary (10:00 AM)"
                body = (
                    f" Daily Allocation Status & Progress Summary (10:00 AM IST)\n\n"
                    f" Total Allocated Mentees: {total_assigned}\n"
                    f" Active Solvers: {active_today} today (vs {active_yesterday} yesterday | Diff: {fmt_diff(diff_active)})\n"
                    f" Problems Solved: {new_problems} today (vs {problems_yesterday} yesterday | Diff: {fmt_diff(diff_problems)})\n"
                    f"️ Requiring Attention: {attention_today} today (vs {attention_yesterday} yesterday | Diff: {fmt_diff(diff_attention)})\n"
                    f" New Milestones: {new_milestones}\n\n"
                    f"View detailed student performance & mentee allocation status."
                )

                idempotency_key = f"faculty_daily_intelligence:{faculty.id}:{today_str}"

                res = NotificationService.emit_event(
                    event_type="DAILY_FACULTY_SUMMARY",
                    title=title,
                    body=body,
                    priority="normal",
                    recipient_scope="USER",
                    recipient_target=str(faculty.id),
                    route="/faculty-actions",
                    event_id=idempotency_key
                )

                # Send Telegram / WhatsApp Bot Notification if available
                try:
                    from backend.services.bot_notification_service import BotNotificationService
                    bot_msg = (
                        f" Daily Allocation Status (10:00 AM IST)\n"
                        f"Faculty: {faculty.username}\n"
                        f"Allocated Mentees: {total_assigned}\n"
                        f"Active Today: {active_today} vs Yesterday: {active_yesterday} ({fmt_diff(diff_active)})\n"
                        f"Solved Today: {new_problems} vs Yesterday: {problems_yesterday} ({fmt_diff(diff_problems)})\n"
                        f"Attention Needed: {attention_today} vs Yesterday: {attention_yesterday} ({fmt_diff(diff_attention)})"
                    )
                    BotNotificationService.send_telegram_message(f"tg_fac_{faculty.id}", bot_msg)
                except Exception as b_err:
                    logger.debug(f"[AUTO_NOTIF] Bot notification dispatch note: {b_err}")

                logger.info(f"[DAILY_FACULTY_INTELLIGENCE] notification_created faculty_id={faculty.id}")

                if res.get("success"):
                    dispatched_count += 1

            except Exception as f_err:
                logger.error(f"[AUTO_NOTIF] Error processing Faculty {faculty.email}: {f_err}", exc_info=True)

        logger.info(f"[DAILY_FACULTY_INTELLIGENCE] job_completed date={today_str} dispatched={dispatched_count} skipped={skipped_count}")
        return {"dispatched": dispatched_count, "skipped": skipped_count, "date": today_str}

    @staticmethod
    def run_daily_hod_performance_job(db: Session) -> Dict[str, Any]:
        """
        Runs daily at 10:05 AM Asia/Kolkata IST for HOD users.
        Dynamically calculates department-level metrics.
        """
        today_str = _today_ist_str()
        hod_users = db.query(User).filter(
            User.is_active == True,
            func.lower(User.role) == "hod"
        ).all()

        dispatched = 0
        for hod in hod_users:
            try:
                dept_id = hod.department_id
                if not dept_id:
                    continue

                dept = db.query(Department).filter_by(id=dept_id).first()
                dept_name = dept.name if dept else "Department"

                # Total active students in department
                dept_students = db.query(Student).filter_by(department_id=dept_id, is_active=True).all()
                total_students = len(dept_students)
                if total_students == 0:
                    continue

                dept_student_ids = [s.id for s in dept_students]

                # Active count (last 24h)
                cutoff_24h = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=24)
                active_count = db.query(LeetCodeProfileStats).filter(
                    LeetCodeProfileStats.student_id.in_(dept_student_ids),
                    LeetCodeProfileStats.last_updated >= cutoff_24h
                ).count()

                active_pct = round((active_count / total_students) * 100, 1)

                # Inactive / attention count
                cutoff_3d = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=3)
                attention_count = db.query(LeetCodeProfileStats).filter(
                    LeetCodeProfileStats.student_id.in_(dept_student_ids),
                    or_(LeetCodeProfileStats.last_updated < cutoff_3d, LeetCodeProfileStats.total_solved == 0)
                ).count()

                title = f"Daily Department Performance Digest — {dept_name}"
                body = (
                    f"Department LeetCode Overview ({dept_name})\n\n"
                    f"Total Department Students: {total_students}\n"
                    f"Active Today: {active_count} ({active_pct}%)\n"
                    f"Students Requiring Attention: {attention_count}\n\n"
                    f"View department command center."
                )

                idempotency_key = f"daily_hod_summary_{hod.id}_{today_str}"

                res = NotificationService.emit_event(
                    event_type="DAILY_HOD_SUMMARY",
                    title=title,
                    body=body,
                    priority="normal",
                    recipient_scope="USER",
                    recipient_target=str(hod.id),
                    route="/department-dashboard",
                    event_id=idempotency_key
                )
                if res.get("success"):
                    dispatched += 1

            except Exception as h_err:
                logger.error(f"[AUTO_NOTIF] Error processing HOD {hod.email}: {h_err}")

        return {"success": True, "dispatched": dispatched, "date": today_str}

    @staticmethod
    def run_daily_principal_executive_job(db: Session) -> Dict[str, Any]:
        """
        Runs daily at 10:10 AM Asia/Kolkata IST for Principal users.
        Dynamically calculates executive college-wide statistics.
        """
        today_str = _today_ist_str()
        principal_users = db.query(User).filter(
            User.is_active == True,
            func.lower(User.role) == "principal"
        ).all()

        dispatched = 0
        for principal in principal_users:
            try:
                total_students = db.query(Student).filter_by(is_active=True).count()
                if total_students == 0:
                    continue

                cutoff_24h = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=24)
                active_count = db.query(LeetCodeProfileStats).filter(
                    LeetCodeProfileStats.last_updated >= cutoff_24h
                ).count()

                active_pct = round((active_count / total_students) * 100, 1)

                title = "Daily Executive LeetCode Performance Summary"
                body = (
                    f"College Executive LeetCode Digest\n\n"
                    f"Total Enrolled Active Students: {total_students}\n"
                    f"College Active Today: {active_count} ({active_pct}%)\n\n"
                    f"View college dashboard."
                )

                idempotency_key = f"daily_principal_summary_{principal.id}_{today_str}"

                res = NotificationService.emit_event(
                    event_type="DAILY_PRINCIPAL_SUMMARY",
                    title=title,
                    body=body,
                    priority="normal",
                    recipient_scope="USER",
                    recipient_target=str(principal.id),
                    route="/dashboard",
                    event_id=idempotency_key
                )
                if res.get("success"):
                    dispatched += 1

            except Exception as p_err:
                logger.error(f"[AUTO_NOTIF] Error processing Principal {principal.email}: {p_err}")

        return {"dispatched": dispatched, "date": today_str}

    @staticmethod
    def emit_sunday_contest_role_summaries(db: Session, session_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Executed after Sunday contest finalization (e.g. 09:40 AM IST).
        Calculates exact contest participation & absence metrics per Faculty, HOD, and Principal.
        """
        logger.info("[AUTO_NOTIF] Generating Sunday Contest Role Summaries...")

        # Determine target session
        if session_id:
            session = db.query(WeeklySession).filter_by(id=session_id).first()
        else:
            session = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()

        if not session:
            logger.warning("[AUTO_NOTIF] No active WeeklySession found for Sunday summary.")
            return {"success": False, "error": "No session found"}

        sess_id = session.id
        contest_name = session.contest_name or "Weekly Contest"

        # 1. FACULTY CONTEST SUMMARIES
        faculty_users = db.query(User).filter(
            User.is_active == True,
            or_(
                func.lower(User.role) == "faculty",
                func.lower(User.role) == "staff",
                func.lower(User.role) == "instructor"
            )
        ).all()

        fac_dispatched = 0
        for faculty in faculty_users:
            try:
                assigned_students = db.query(Student).join(
                    FacultyStudentAssignment, Student.id == FacultyStudentAssignment.student_id
                ).filter(
                    FacultyStudentAssignment.faculty_id == faculty.id,
                    Student.is_active == True
                ).all()

                assigned_count = len(assigned_students)
                if assigned_count == 0:
                    continue

                student_ids = [s.id for s in assigned_students]

                # Fetch contest results for assigned students
                results = db.query(WeeklyPublicResult).filter(
                    WeeklyPublicResult.session_id == sess_id,
                    WeeklyPublicResult.student_id.in_(student_ids)
                ).all()

                participated_students = []
                absent_students = []
                participated_ids = set()
                completed_count = 0
                partial_count = 0

                for r in results:
                    status = (r.participation_status or "").upper()
                    solved = r.total_contest_solved or 0
                    if status in ("OFFICIAL_ATTENDED", "VIRTUAL_ATTENDED", "PUBLIC", "ATTENDED") or solved > 0:
                        participated_ids.add(r.student_id)
                        if solved >= 4:
                            completed_count += 1
                        elif solved >= 1:
                            partial_count += 1

                for s in assigned_students:
                    if s.id in participated_ids:
                        participated_students.append(s)
                    else:
                        absent_students.append(s)

                participated_count = len(participated_students)
                absent_count = len(absent_students)
                follow_up_count = absent_count

                att_list_str = "\n".join([f"  • {s.name} ({s.reg_no})" for s in participated_students[:8]])
                if len(participated_students) > 8:
                    att_list_str += f"\n  ...and {len(participated_students) - 8} more"

                abs_list_str = "\n".join([f"  • {s.name} ({s.reg_no})" for s in absent_students[:10]])
                if len(absent_students) > 10:
                    abs_list_str += f"\n  ...and {len(absent_students) - 10} more"

                title = f"Sunday Contest Attendance Report — {contest_name}"
                fac_name = faculty.full_name or faculty.username or "Faculty"
                body = (
                    f"Dear {fac_name},\n\n"
                    f"Contest Attendance & Absentee Roster for {contest_name}:\n\n"
                    f"• Total Assigned Mentees: {assigned_count}\n"
                    f"• Attended Students: {participated_count}\n"
                    f"• Absent Students (Not Attended): {absent_count}\n"
                    f"• Completed (All Solved): {completed_count}\n"
                    f"• Partial Solvers: {partial_count}\n\n"
                    f"Absent Students (Follow-up Required):\n"
                    f"{abs_list_str or '  None (All attended!)'}\n\n"
                    f"Attended Students:\n"
                    f"{att_list_str or '  None'}\n\n"
                    f"Tap to view the full live contest report and mentor action center."
                )

                idempotency_key = f"sunday_contest_faculty_{faculty.id}_{sess_id}"

                res = NotificationService.emit_event(
                    event_type="SUNDAY_CONTEST_FACULTY_SUMMARY",
                    title=title,
                    body=body,
                    priority="high",
                    recipient_scope="USER",
                    recipient_target=str(faculty.id),
                    route="/weekly-contest",
                    event_id=idempotency_key
                )
                if res.get("success"):
                    fac_dispatched += 1

            except Exception as f_err:
                logger.error(f"[AUTO_NOTIF] Error in Sunday contest summary for Faculty {faculty.email}: {f_err}")

        # 2. HOD CONTEST SUMMARIES
        hod_users = db.query(User).filter(
            User.is_active == True,
            func.lower(User.role) == "hod"
        ).all()

        hod_dispatched = 0
        for hod in hod_users:
            try:
                dept_id = hod.department_id
                if not dept_id:
                    continue

                dept = db.query(Department).filter_by(id=dept_id).first()
                dept_name = dept.name if dept else "Department"

                dept_students = db.query(Student).filter_by(department_id=dept_id, is_active=True).all()
                total_dept = len(dept_students)
                if total_dept == 0:
                    continue

                dept_student_ids = [s.id for s in dept_students]

                results = db.query(WeeklyPublicResult).filter(
                    WeeklyPublicResult.session_id == sess_id,
                    WeeklyPublicResult.student_id.in_(dept_student_ids)
                ).all()

                participated_count = 0
                for r in results:
                    status = (r.participation_status or "").upper()
                    solved = r.total_contest_solved or 0
                    if status in ("OFFICIAL_ATTENDED", "VIRTUAL_ATTENDED", "PUBLIC", "ATTENDED") or solved > 0:
                        participated_count += 1

                absent_count = max(0, total_dept - participated_count)
                part_pct = round((participated_count / total_dept) * 100, 1)

                title = f"Sunday Contest Department Report — {dept_name}"
                hod_name = hod.full_name or hod.username or "HOD"
                body = (
                    f"Dear {hod_name} (HOD - {dept_name}),\n\n"
                    f"Sunday Contest Department Summary ({dept_name}):\n\n"
                    f"Total Department Students: {total_dept}\n"
                    f"Participated: {participated_count} ({part_pct}%)\n"
                    f"Absent: {absent_count}\n\n"
                    f"View department contest breakdown."
                )

                idempotency_key = f"sunday_contest_hod_{hod.id}_{sess_id}"

                res = NotificationService.emit_event(
                    event_type="SUNDAY_CONTEST_HOD_SUMMARY",
                    title=title,
                    body=body,
                    priority="high",
                    recipient_scope="USER",
                    recipient_target=str(hod.id),
                    route="/department-dashboard",
                    event_id=idempotency_key
                )
                if res.get("success"):
                    hod_dispatched += 1

            except Exception as h_err:
                logger.error(f"[AUTO_NOTIF] Error in Sunday contest summary for HOD {hod.email}: {h_err}")

        # 3. PRINCIPAL CONTEST SUMMARY
        principal_users = db.query(User).filter(
            User.is_active == True,
            func.lower(User.role) == "principal"
        ).all()

        prin_dispatched = 0
        for principal in principal_users:
            try:
                total_college = db.query(Student).filter_by(is_active=True).count()
                if total_college == 0:
                    continue

                all_college_results = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == sess_id).all()
                official_cnt = sum(1 for r in all_college_results if (r.participation_status or "").upper() in ("OFFICIAL_ATTENDED", "PUBLIC", "ATTENDED"))
                virtual_cnt = sum(1 for r in all_college_results if (r.participation_status or "").upper() == "VIRTUAL_ATTENDED")
                total_part = sum(1 for r in all_college_results if (r.participation_status or "").upper() in ("OFFICIAL_ATTENDED", "VIRTUAL_ATTENDED", "PUBLIC", "ATTENDED") or (r.total_contest_solved or 0) > 0)
                part_pct = round((total_part / total_college) * 100, 1) if total_college > 0 else 0

                title = f"Sunday Contest Executive Report — {contest_name}"
                p_name = principal.full_name or principal.username or "Principal"
                body = (
                    f"Dear {p_name},\n\n"
                    f"Sunday Contest Executive College Summary:\n\n"
                    f"Total College Enrolled: {total_college}\n"
                    f"Total Participated: {total_part} ({part_pct}%)\n"
                    f"Official Live: {official_cnt} | Virtual: {virtual_cnt}\n\n"
                    f"View executive dashboard."
                )

                idempotency_key = f"sunday_contest_principal_{principal.id}_{sess_id}"

                res = NotificationService.emit_event(
                    event_type="SUNDAY_CONTEST_PRINCIPAL_SUMMARY",
                    title=title,
                    body=body,
                    priority="high",
                    recipient_scope="USER",
                    recipient_target=str(principal.id),
                    route="/dashboard",
                    event_id=idempotency_key
                )
                if res.get("success"):
                    prin_dispatched += 1

            except Exception as p_err:
                logger.error(f"[AUTO_NOTIF] Error in Sunday contest summary for Principal {principal.email}: {p_err}")

        return {
            "faculty_dispatched": fac_dispatched,
            "hod_dispatched": hod_dispatched,
            "principal_dispatched": prin_dispatched,
            "session_id": sess_id
        }

    @staticmethod
    def check_and_emit_student_milestones(db: Session, student_id: int, old_solved: int, new_solved: int) -> List[Dict[str, Any]]:
        """
        Detects milestone transitions (e.g. crossing 50, 100, 200, 500) and emits deduplicated alerts.
        """
        results = []
        student = db.query(Student).filter_by(id=student_id).first()
        if not student:
            return results

        for m_val in MILESTONE_THRESHOLDS:
            if old_solved < m_val and new_solved >= m_val:
                idempotency_key = f"milestone_{student_id}_{m_val}"

                # Find assigned faculty
                assignments = db.query(FacultyStudentAssignment).filter_by(student_id=student_id).all()
                fac_user_ids = [str(a.faculty_id) for a in assignments]

                title = f"Student Milestone Reached: {student.name}"
                body = (
                    f"Student {student.name} ({student.reg_no}) has officially reached "
                    f"the {m_val} LeetCode Problems Solved milestone! (Current total: {new_solved})"
                )

                res = NotificationService.emit_event(
                    event_type="STUDENT_MILESTONE_REACHED",
                    title=title,
                    body=body,
                    priority="high",
                    recipient_scope="USER",
                    recipient_target=str(student_id),
                    entity_type="student",
                    entity_id=str(student_id),
                    route=f"/student/{student_id}",
                    event_id=idempotency_key
                )
                results.append(res)

        return results

    @staticmethod
    def check_and_emit_single_day_surge(
        db: Session,
        student_id: int,
        current_total: int,
        force_check: bool = False,
        simulated_solved_today: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Detects students who have solved a massive number of problems (e.g. 100) in a single day.
        Emits personalized 'Dear Sir/Ma'am' alerts to their assigned mentors, staff role, and the student.
        """
        results = []
        student = db.query(Student).filter_by(id=student_id).first()
        if not student:
            return results

        now_ist = datetime.datetime.now(tz=IST)
        today_ist_str = now_ist.strftime("%d-%b-%Y")
        today_date_key = now_ist.strftime("%Y-%m-%d")
        time_ist_str = now_ist.strftime("%I:%M %p IST")

        solved_today = 0
        if simulated_solved_today is not None:
            solved_today = simulated_solved_today
        else:
            start_of_today_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
            start_of_today_utc = start_of_today_ist.astimezone(datetime.timezone.utc)
            
            cutoff_24h_utc = start_of_today_utc - datetime.timedelta(hours=24)
            baseline_snap = db.query(StudentStatSnapshot).filter(
                StudentStatSnapshot.student_id == student_id,
                StudentStatSnapshot.captured_at >= cutoff_24h_utc,
                StudentStatSnapshot.captured_at <= start_of_today_utc
            ).order_by(StudentStatSnapshot.captured_at.desc()).first()

            if baseline_snap and baseline_snap.total_solved is not None:
                solved_today = max(0, current_total - baseline_snap.total_solved)
            else:
                first_snap_today = db.query(StudentStatSnapshot).filter(
                    StudentStatSnapshot.student_id == student_id,
                    StudentStatSnapshot.captured_at >= start_of_today_utc
                ).order_by(StudentStatSnapshot.captured_at.asc()).first()
                if first_snap_today and first_snap_today.total_solved is not None:
                    solved_today = max(0, current_total - first_snap_today.total_solved)
                else:
                    solved_today = 0

            try:
                from backend.models import LeetCodeActivity
                act = db.query(LeetCodeActivity).filter_by(student_id=student_id).first()
                if act and act.submission_calendar_json:
                    cal_data = json.loads(act.submission_calendar_json) if isinstance(act.submission_calendar_json, str) else act.submission_calendar_json
                    if isinstance(cal_data, dict):
                        midnight_today_utc = int(datetime.datetime.now(datetime.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).timestamp())
                        cal_today = cal_data.get(str(midnight_today_utc)) or cal_data.get(midnight_today_utc) or 0
                        if cal_today > solved_today:
                            solved_today = int(cal_today)
            except Exception:
                pass

        if solved_today < 100 and not (force_check and solved_today > 0):
            return results

        dept_name = student.department.name if student.department else (student.dept or "N/A")

        assignments = db.query(FacultyStudentAssignment).filter_by(student_id=student_id).all()
        fac_targets = []
        for a in assignments:
            if a.faculty_id:
                fac_targets.append(f"STAFF_{a.faculty_id}")
                u = db.query(User).filter_by(id=a.faculty_id).first()
                if u and u.email:
                    fac_targets.append(u.email)

        staff_title = f"100 Solved in a Single Day: {student.name} ({student.reg_no})"
        staff_body = (
            f"Dear Sir/Ma'am,\n\n"
            f"Your student / mentee {student.name} (Roll No: {student.reg_no}) has achieved a remarkable milestone "
            f"of solving {solved_today} LeetCode problems on the same day today ({today_ist_str})!\n\n"
            f"Student Details:\n"
            f"• Student Name: {student.name}\n"
            f"• Roll Number: {student.reg_no}\n"
            f"• Department: {dept_name}\n"
            f"• Problems Solved Today: {solved_today}\n"
            f"• Cumulative Total Solved: {current_total}\n"
            f"• Recorded At: {time_ist_str}\n\n"
            f"This unique dedication demonstrates top problem-solving performance. "
            f"Please appreciate and mentor them to maintain this exceptional momentum!"
        )

        idempotency_key = f"single_day_surge_100_{student_id}_{today_date_key}"

        for ft in fac_targets:
            res_fac = NotificationService.emit_event(
                event_type="STUDENT_DAILY_SURGE_MILESTONE",
                title=staff_title,
                body=staff_body,
                priority="high",
                recipient_scope="USER",
                recipient_target=ft,
                entity_type="student",
                entity_id=str(student_id),
                route=f"/student/{student_id}",
                event_id=f"{idempotency_key}_{ft}"
            )
            results.append(res_fac)

        res_staff = NotificationService.emit_event(
            event_type="STUDENT_DAILY_SURGE_MILESTONE",
            title=staff_title,
            body=staff_body,
            priority="high",
            recipient_scope="ROLE",
            recipient_target="STAFF",
            entity_type="student",
            entity_id=str(student_id),
            route=f"/student/{student_id}",
            event_id=f"{idempotency_key}_staff_role"
        )
        results.append(res_staff)

        student_title = f"100 Problems Solved in One Day! Keep It Up, {student.name}!"
        student_body = (
            f"Outstanding accomplishment, {student.name}!\n\n"
            f"You solved {solved_today} LeetCode problems in a single day today ({today_ist_str})!\n"
            f"Your current total problems solved is now {current_total}.\n"
            f"Your mentor and department faculty have been notified of your brilliant milestone.\n"
            f"Keep up this stellar consistency!"
        )
        res_std = NotificationService.emit_event(
            event_type="STUDENT_DAILY_SURGE_MILESTONE",
            title=student_title,
            body=student_body,
            priority="high",
            recipient_scope="USER",
            recipient_target=str(student_id),
            entity_type="student",
            entity_id=str(student_id),
            route=f"/student/{student_id}",
            event_id=f"{idempotency_key}_student"
        )
        results.append(res_std)

        logger.info(f"[AUTO_NOTIF] Single-day surge 100 solved emitted for student {student.name} ({student.reg_no}): solved_today={solved_today}")
        return results

    @staticmethod
    def check_and_emit_fetch_surge_alert(
        db: Session,
        student_id: int,
        previous_total: int,
        current_total: int,
        previous_timestamp: Optional[datetime.datetime] = None,
        delta_easy: int = 0,
        delta_medium: int = 0,
        delta_hard: int = 0,
        threshold: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Detects when a student's total solved jumps significantly (e.g. >= 50) between sync/fetch cycles.
        Example: Sanjay had 150 at last fetch, now 201 -> delta = 51.
        Emits full telemetry notification with previous count, new count, delta, and exact timestamps.
        """
        results = []
        delta = current_total - previous_total
        if delta < threshold:
            return results

        student = db.query(Student).filter_by(id=student_id).first()
        if not student:
            return results

        now_ist = datetime.datetime.now(tz=IST)
        curr_time_str = now_ist.strftime("%d-%b-%Y %I:%M %p IST")

        if previous_timestamp:
            if previous_timestamp.tzinfo is None:
                prev_utc = previous_timestamp.replace(tzinfo=datetime.timezone.utc)
            else:
                prev_utc = previous_timestamp
            prev_time_str = prev_utc.astimezone(IST).strftime("%d-%b-%Y %I:%M %p IST")
        else:
            prev_time_str = "Previous Sync Cycle"

        dept_name = student.department.name if student.department else (student.dept or "N/A")

        assignments = db.query(FacultyStudentAssignment).filter_by(student_id=student_id).all()
        fac_targets = []
        for a in assignments:
            if a.faculty_id:
                fac_targets.append(f"STAFF_{a.faculty_id}")
                u = db.query(User).filter_by(id=a.faculty_id).first()
                if u and u.email:
                    fac_targets.append(u.email)

        title = f"High Problem Surge Alert: {student.name} (+{delta} Solved)"
        body = (
            f"Dear Sir/Ma'am,\n\n"
            f"Significant problem-solving growth detected for your student {student.name} ({student.reg_no}) between sync cycles!\n\n"
            f"• Student Name: {student.name}\n"
            f"• Roll Number: {student.reg_no}\n"
            f"• Department: {dept_name}\n"
            f"• Previous Solved: {previous_total} (Recorded: {prev_time_str})\n"
            f"• Current Solved: {current_total} (Recorded: {curr_time_str})\n"
            f"• Net Delta Increase: +{delta} problems solved\n"
            f"  [Breakdown: Easy +{delta_easy} | Medium +{delta_medium} | Hard +{delta_hard}]\n\n"
            f"Sync Interval: From {prev_time_str} to {curr_time_str}\n\n"
            f"This substantial surge has been verified and synchronized to the live database."
        )

        idempotency_key = f"fetch_surge_{student_id}_{previous_total}_{current_total}"

        for ft in fac_targets:
            res_fac = NotificationService.emit_event(
                event_type="STUDENT_FETCH_SURGE_DELTA",
                title=title,
                body=body,
                priority="high",
                recipient_scope="USER",
                recipient_target=ft,
                entity_type="student",
                entity_id=str(student_id),
                route=f"/student/{student_id}",
                event_id=f"{idempotency_key}_{ft}"
            )
            results.append(res_fac)

        res_staff = NotificationService.emit_event(
            event_type="STUDENT_FETCH_SURGE_DELTA",
            title=title,
            body=body,
            priority="high",
            recipient_scope="ROLE",
            recipient_target="STAFF",
            entity_type="student",
            entity_id=str(student_id),
            route=f"/student/{student_id}",
            event_id=f"{idempotency_key}_staff_role"
        )
        results.append(res_staff)

        logger.info(f"[AUTO_NOTIF] Fetch surge alert (+{delta}) emitted for student {student.name} ({student.reg_no})")
        return results

    @staticmethod
    def check_and_emit_contest_attendance(
        db: Session,
        student_id: int,
        session_id: int,
        attendance_status: str
    ) -> List[Dict[str, Any]]:
        """
        NOTIFICATION TYPE 4 & 11: CONTEST ATTENDANCE STATUS & TRANSITIONS
        Emits notification when student attendance status is classified (PUBLIC_ATTENDED, VIRTUAL_ATTENDED, NOT_VERIFIED).
        """
        results = []
        student = db.query(Student).filter_by(id=student_id).first()
        if not student:
            return results

        session = db.query(WeeklySession).filter_by(id=session_id).first()
        sess_title = session.contest_name if session else f"Weekly Contest Session {session_id}"

        idempotency_key = f"contest_attendance_{student_id}_{session_id}_{attendance_status}"
        title = f"Contest Attendance: {student.name} ({attendance_status})"
        body = (
            f"Dear Faculty, assigned student {student.name} ({student.reg_no}) contest attendance "
            f"classified as {attendance_status} for {sess_title}."
        )

        assignments = db.query(FacultyStudentAssignment).filter_by(student_id=student_id).all()
        for a in assignments:
            if a.faculty_id:
                u = db.query(User).filter_by(id=a.faculty_id).first()
                target_user = str(u.email) if (u and u.email) else f"STAFF_{a.faculty_id}"
                res = NotificationService.emit_event(
                    event_type="CONTEST_ATTENDANCE_UPDATE",
                    title=title,
                    body=body,
                    priority="normal",
                    recipient_scope="USER",
                    recipient_target=target_user,
                    entity_type="student",
                    entity_id=str(student_id),
                    route=f"/weekly-contest",
                    event_id=f"{idempotency_key}_{target_user}",
                    send_email_notification=False
                )
                if res.get("created_count", 0) > 0 or res.get("success", False):
                    # Filter out duplicate no-op emissions
                    if res.get("created_count", 0) > 0:
                        results.append(res)
        return results

    @staticmethod
    def emit_contest_finalized_sync_broadcast(db: Session, session_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Emitted when weekly contest results are officially published and synchronized.
        Informs Staff & Mentors that leaderboards, ranks, streaks, and attendance records are up-to-date in Web & App.
        """
        if session_id:
            session = db.query(WeeklySession).filter_by(id=session_id).first()
        else:
            session = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()

        if not session:
            return {"success": False, "error": "No session found"}

        sess_id = session.id
        contest_name = session.contest_name or f"Weekly Contest {sess_id}"
        total_students = session.total_students or 0
        official_part = session.official_participants or 0
        virtual_part = session.virtual_participants or 0
        not_part = session.not_participated or 0
        total_attended = official_part + virtual_part

        title = f"Contest Results Published & Web/App Synced — {contest_name}"
        body = (
            f"Dear Faculty & Staff,\n\n"
            f"Official results and attendance datasets for {contest_name} have been finalized and published!\n\n"
            f"Contest Summary:\n"
            f"• Total Students Tracked: {total_students}\n"
            f"• Attended: {total_attended} (Official Live: {official_part} | Virtual: {virtual_part})\n"
            f"• Absent / Not Attended: {not_part}\n\n"
            f"Data Synchronization Status:\n"
            f"• Web Portal & Mobile App: Leaderboards, streaks, ratings, and attendance records are fully synchronized!\n"
            f"• Student Profiles: Individual contest statistics and badges updated.\n\n"
            f"Tap to view the updated leaderboards and download the finalized contest report."
        )

        idempotency_key = f"contest_results_synced_broadcast_{sess_id}"
        return NotificationService.emit_event(
            event_type="CONTEST_RESULTS_SYNCED",
            title=title,
            body=body,
            priority="high",
            recipient_scope="ROLE",
            recipient_target="STAFF",
            route="/weekly-contest",
            event_id=idempotency_key
        )

    @staticmethod
    def emit_admin_system_alert(db: Session, alert_title: str, alert_message: str, error_details: Optional[str] = None) -> Dict[str, Any]:
        """
        Emits system failure or automation alert to Admin users.
        """
        admin_users = db.query(User).filter(
            User.is_active == True,
            or_(func.lower(User.role) == "admin", func.lower(User.role) == "administrator")
        ).all()

        admin_ids = [str(a.id) for a in admin_users] + [a.email for a in admin_users if a.email]
        if not admin_ids:
            return {"success": False, "error": "No admin users found"}

        idempotency_key = f"admin_alert_{hash(alert_title + alert_message)}_{_today_ist_str()}"

        return NotificationService.emit_event(
            event_type="SYSTEM_AUTOMATION_ALERT",
            title=f"System Alert: {alert_title}",
            body=f"{alert_message}\n\nDetails: {error_details or 'None'}",
            priority="critical",
            recipient_scope="ROLE",
            recipient_target="Admin",
            route="/settings",
            event_id=idempotency_key
        )

    @staticmethod
    def check_and_emit_student_growth(
        db: Session,
        student_id: int,
        old_total: int,
        new_total: int,
        old_timestamp: Optional[datetime.datetime] = None,
        delta_easy: int = 0,
        delta_medium: int = 0,
        delta_hard: int = 0
    ) -> List[Dict[str, Any]]:
        """
        NOTIFICATION TYPE 1: STUDENT GROWTH
        Generates notification when a student's verified solved count genuinely increases.
        Example: 150 -> 201 = +51 solved.
        Flags discrepancies if total decreases unexpectedly instead of reporting false growth.
        """
        results = []
        if new_total <= old_total or old_total <= 0:
            if new_total < old_total and old_total > 0:
                AutomaticNotificationEngine.emit_data_verification_issue(
                    db, student_id,
                    f"Unexpected solved count decrease for student (Previous: {old_total}, New: {new_total}). Snapshot flagged for review."
                )
            return results

        student = db.query(Student).filter_by(id=student_id).first()
        if not student:
            return results

        net_increase = new_total - old_total

        if net_increase > 150:
            AutomaticNotificationEngine.emit_large_growth_review(db, student_id, old_total, new_total)

        now_ist = datetime.datetime.now(tz=IST)
        curr_time_str = now_ist.strftime("%d-%b-%Y %I:%M %p IST")

        if old_timestamp:
            prev_utc = old_timestamp.replace(tzinfo=datetime.timezone.utc) if old_timestamp.tzinfo is None else old_timestamp
            prev_time_str = prev_utc.astimezone(IST).strftime("%d-%b-%Y %I:%M %p IST")
        else:
            prev_time_str = "Previous Verified Snapshot"

        profile_url = student.leetcode_url or (f"https://leetcode.com/{student.username}" if student.username else "N/A")

        title = f"Student Growth — +{net_increase} Problems ({student.name})"
        body = (
            f"Dear Sir/Madam, your assigned student {student.name}'s verified LeetCode solved count "
            f"increased from {old_total} to {new_total}, a net increase of {net_increase} problems since the previous verified fetch.\n\n"
            f"Student Details:\n"
            f"• Student Name: {student.name}\n"
            f"• Register Number: {student.reg_no}\n"
            f"• LeetCode Username: {student.username or 'N/A'}\n"
            f"• Profile Link: {profile_url}\n"
            f"• Previous Verified Total: {old_total} (Recorded: {prev_time_str})\n"
            f"• Current Verified Total: {new_total} (Recorded: {curr_time_str})\n"
            f"• Net Increase: +{net_increase} problems\n"
            f"  [Breakdown: Easy +{delta_easy} | Medium +{delta_medium} | Hard +{delta_hard}]\n\n"
            f"Measurement Window: From {prev_time_str} to {curr_time_str}\n\n"
            f"Tap to view student growth & history details."
        )

        idempotency_key = f"student_growth_{student_id}_{old_total}_{new_total}"

        assignments = db.query(FacultyStudentAssignment).filter_by(student_id=student_id).all()
        for a in assignments:
            if a.faculty_id:
                u = db.query(User).filter_by(id=a.faculty_id).first()
                target_user = str(u.email) if (u and u.email) else f"STAFF_{a.faculty_id}"
                res_fac = NotificationService.emit_event(
                    event_type="STUDENT_GROWTH_ALERT",
                    title=title,
                    body=body,
                    priority="normal",
                    recipient_scope="USER",
                    recipient_target=target_user,
                    entity_type="student",
                    entity_id=str(student_id),
                    route=f"/student/{student_id}",
                    event_id=f"{idempotency_key}_{target_user}"
                )
                results.append(res_fac)

        return results

    @staticmethod
    def check_and_emit_contest_attendance(
        db: Session,
        student_id: int,
        session_id: int,
        attendance_status: str
    ) -> List[Dict[str, Any]]:
        """
        Emits contest attendance notification for a student.
        """
        idempotency_key = f"contest_attendance_{student_id}_{session_id}_{attendance_status}"
        res = NotificationService.emit_event(
            event_type="CONTEST_ATTENDANCE_RECORDED",
            title=f"Contest Attendance Recorded — {attendance_status}",
            body=f"Student ID {student_id} attendance status recorded as {attendance_status} for session {session_id}.",
            priority="normal",
            recipient_scope="ROLE",
            recipient_target="STAFF",
            route="/weekly-contest",
            event_id=idempotency_key
        )
        return [res] if res.get("success") and not res.get("duplicate_prevented") else []

    @staticmethod
    def check_and_emit_inactivity_review(
        db: Session,
        student_id: Optional[int] = None,
        inactivity_days: int = 7
    ) -> Dict[str, Any]:
        """
        NOTIFICATION TYPE 8: STUDENT INACTIVITY REVIEW
        Scans assigned students who have shown 0 verified increase over the configured review period.
        Alerts authorized mentors with actionable review guidance.
        """
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        cutoff = now_utc - datetime.timedelta(days=inactivity_days)
        today_str = _today_ist_str()

        q = db.query(Student).filter_by(is_active=True)
        if student_id:
            q = q.filter(Student.id == student_id)
        active_students = q.all()
        dispatched_count = 0

        for student in active_students:
            stats = db.query(LeetCodeProfileStats).filter_by(student_id=student.id).first()
            if not stats or stats.sync_status == "failed":
                continue

            last_upd = ensure_utc(cast(Any, stats.last_updated))
            if last_upd and last_upd < cutoff:
                idempotency_key = f"inactivity_review_{student.id}_{today_str}"
                assignments = db.query(FacultyStudentAssignment).filter_by(student_id=student.id).all()

                title = f"Student Activity Review: {student.name}"
                body = (
                    f"Dear Sir/Madam, {student.name} ({student.reg_no}) has shown no verified increase "
                    f"in the monitored LeetCode statistics during the configured {inactivity_days}-day review period.\n\n"
                    f"Last verified activity: {last_upd.strftime('%d-%b-%Y') if last_upd else 'N/A'}.\n"
                    f"Please review the student's progress and mentor them."
                )

                for a in assignments:
                    if a.faculty_id:
                        u = db.query(User).filter_by(id=a.faculty_id).first()
                        target_user = str(u.email) if (u and u.email) else f"STAFF_{a.faculty_id}"
                        res = NotificationService.emit_event(
                            event_type="STUDENT_INACTIVITY_REVIEW",
                            title=title,
                            body=body,
                            priority="normal",
                            recipient_scope="USER",
                            recipient_target=target_user,
                            entity_type="student",
                            entity_id=str(student.id),
                            route=f"/student/{student.id}",
                            event_id=f"{idempotency_key}_{target_user}"
                        )
                        if res.get("success"):
                            dispatched_count += 1

        return {"dispatched": dispatched_count, "inactivity_days": inactivity_days}

    @staticmethod
    def check_and_emit_rating_improvement(
        db: Session,
        student_id: int,
        old_rating: float,
        new_rating: float
    ) -> List[Dict[str, Any]]:
        """
        NOTIFICATION TYPE 10: CONTEST RATING IMPROVEMENT
        Notifies the student's authorized mentor when contest rating increases between valid comparable contest records.
        """
        results = []
        if new_rating <= old_rating:
            return results

        student = db.query(Student).filter_by(id=student_id).first()
        if not student:
            return results

        rating_delta = round(new_rating - old_rating, 1)
        now_ist = datetime.datetime.now(tz=IST).strftime("%d-%b-%Y %I:%M %p IST")

        title = f"Contest Rating Improvement: {student.name} (+{rating_delta})"
        body = (
            f"Dear Sir/Madam, your assigned student {student.name} ({student.reg_no}) has achieved a contest rating improvement!\n\n"
            f"• Previous Rating: {round(old_rating, 1)}\n"
            f"• New Verified Rating: {round(new_rating, 1)}\n"
            f"• Net Delta Increase: +{rating_delta} points\n"
            f"• Recorded At: {now_ist}\n\n"
            f"Tap to view student profile."
        )

        idempotency_key = f"rating_improvement_{student_id}_{int(old_rating)}_{int(new_rating)}"

        assignments = db.query(FacultyStudentAssignment).filter_by(student_id=student_id).all()
        for a in assignments:
            if a.faculty_id:
                u = db.query(User).filter_by(id=a.faculty_id).first()
                target_user = str(u.email) if (u and u.email) else f"STAFF_{a.faculty_id}"
                res = NotificationService.emit_event(
                    event_type="CONTEST_RATING_IMPROVED",
                    title=title,
                    body=body,
                    priority="high",
                    recipient_scope="USER",
                    recipient_target=target_user,
                    entity_type="student",
                    entity_id=str(student_id),
                    route=f"/student/{student_id}",
                    event_id=f"{idempotency_key}_{target_user}"
                )
                results.append(res)

        return results

    @staticmethod
    def check_and_emit_new_student_added(db: Session, student_id: int) -> Dict[str, Any]:
        """
        NOTIFICATION TYPE 3: NEW STUDENT ADDED
        Notifies Admin and relevant HOD when a genuinely new student is added to the roster.
        """
        student = db.query(Student).filter_by(id=student_id).first()
        if not student:
            return {"success": False, "error": "Student not found"}

        dept_name = student.department.name if student.department else "N/A"
        now_ist = datetime.datetime.now(tz=IST).strftime("%d-%b-%Y %I:%M %p IST")

        title = f"New Student Enrolled: {student.name} ({student.reg_no})"
        body = (
            f"A new student record has been added to the institutional roster:\n\n"
            f"• Name: {student.name}\n"
            f"• Register Number: {student.reg_no}\n"
            f"• Department: {dept_name}\n"
            f"• Academic Year Level: {student.year_level}\n"
            f"• LeetCode Username: {student.username or 'Not Configured'}\n"
            f"• Created At: {now_ist}\n\n"
            f"Tap to review student assignment and allocation."
        )

        idempotency_key = f"new_student_added_{student_id}"

        res_admin = NotificationService.emit_event(
            event_type="NEW_STUDENT_ADDED",
            title=title,
            body=body,
            priority="normal",
            recipient_scope="ROLE",
            recipient_target="Admin",
            entity_type="student",
            entity_id=str(student_id),
            route=f"/student/{student_id}",
            event_id=f"{idempotency_key}_admin"
        )

        if student.department_id:
            hods = db.query(User).filter(
                User.is_active == True,
                func.lower(User.role) == "hod",
                User.department_id == student.department_id
            ).all()
            for h in hods:
                NotificationService.emit_event(
                    event_type="NEW_STUDENT_ADDED",
                    title=title,
                    body=body,
                    priority="normal",
                    recipient_scope="USER",
                    recipient_target=str(h.id),
                    entity_type="student",
                    entity_id=str(student_id),
                    route=f"/student/{student_id}",
                    event_id=f"{idempotency_key}_hod_{h.id}"
                )

        return res_admin

    @staticmethod
    def check_and_emit_sync_completed_summary(db: Session, job_id: str, summary_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        NOTIFICATION TYPE 6: SYNC COMPLETED
        Reports actual metrics after a sync run finishes persistence operations.
        """
        now_ist = datetime.datetime.now(tz=IST).strftime("%d-%b-%Y %I:%M %p IST")
        total_eligible = (
            summary_data.get("total_eligible")
            if summary_data.get("total_eligible") is not None
            else summary_data.get("total_students", 0)
        )
        fetched = (
            summary_data.get("fetched")
            if summary_data.get("fetched") is not None
            else summary_data.get("full_dataset_synced", summary_data.get("profile_verified", 0))
        )
        updated = (
            summary_data.get("updated")
            if summary_data.get("updated") is not None
            else summary_data.get("full_dataset_synced", summary_data.get("profile_verified", 0))
        )
        unchanged = summary_data.get("unchanged", 0)
        failed = (
            summary_data.get("failed")
            if summary_data.get("failed") is not None
            else summary_data.get("fetch_failed", 0)
        )
        skipped = (
            summary_data.get("skipped")
            if summary_data.get("skipped") is not None
            else (
                summary_data.get("pending_username", 0)
                + summary_data.get("invalid_username", 0)
                + summary_data.get("partial_sync", 0)
            )
        )

        title = f"LeetCode Data Sync Run Completed (Job: {job_id})"
        body = (
            f"LeetCode institutional synchronization run completed at {now_ist}:\n\n"
            f"• Job ID: {job_id}\n"
            f"• Total Eligible Roster: {total_eligible}\n"
            f"• Successfully Fetched: {fetched}\n"
            f"• Profiles Updated: {updated}\n"
            f"• Unchanged Statistics: {unchanged}\n"
            f"• Fetch Failures: {failed}\n"
            f"• Skipped Profiles: {skipped}\n\n"
            f"All verified statistics have been committed to the live database."
        )

        idempotency_key = f"sync_completed_summary_{job_id}"
        return NotificationService.emit_event(
            event_type="SYNC_COMPLETED_SUMMARY",
            title=title,
            body=body,
            priority="normal",
            recipient_scope="ROLE",
            recipient_target="STAFF",
            route="/settings",
            event_id=idempotency_key
        )

    @staticmethod
    def check_and_emit_sync_failed_summary(db: Session, job_id: str, error_message: str, affected_count: int = 0) -> Dict[str, Any]:
        """
        NOTIFICATION TYPE 7: SYNC FAILED
        Notifies authorized Admin recipients when a sync run fails or encounters a critical error.
        Preserves previously verified data.
        """
        now_ist = datetime.datetime.now(tz=IST).strftime("%d-%b-%Y %I:%M %p IST")

        title = f"Critical Alert: LeetCode Sync Run Failed (Job: {job_id})"
        body = (
            f"The automatic LeetCode sync job encountered a critical execution failure at {now_ist}:\n\n"
            f"• Job ID: {job_id}\n"
            f"• Failure Reason: {error_message}\n"
            f"• Scope Affected: {affected_count} student records\n"
            f"• Automatic Retry: Scheduled according to resilience policy.\n\n"
            f"Data Safety: Previously verified student data has been preserved intact."
        )

        idempotency_key = f"sync_failed_summary_{job_id}"
        return NotificationService.emit_event(
            event_type="SYNC_FAILED_SUMMARY",
            title=title,
            body=body,
            priority="critical",
            recipient_scope="ROLE",
            recipient_target="Admin",
            route="/settings",
            event_id=idempotency_key
        )

    @staticmethod
    def emit_data_verification_issue(db: Session, student_id: int, issue_description: str) -> Dict[str, Any]:
        """
        ADDITIONAL ALERT A: DATA VERIFICATION ISSUE
        Notifies Admin recipients when student data is missing, inconsistent, or stale after retries.
        """
        student = db.query(Student).filter_by(id=student_id).first()
        s_name = student.name if student else f"Student ID {student_id}"
        s_reg = student.reg_no if student else "N/A"

        title = f"Data Verification Issue: {s_name} ({s_reg})"
        body = (
            f"A data verification issue was flagged for {s_name} ({s_reg}):\n\n"
            f"Details: {issue_description}\n\n"
            f"Previously verified data remains preserved. Please inspect student profile mapping."
        )

        idempotency_key = f"data_verification_issue_{student_id}_{hash(issue_description)}"
        return NotificationService.emit_event(
            event_type="DATA_VERIFICATION_ISSUE",
            title=title,
            body=body,
            priority="high",
            recipient_scope="ROLE",
            recipient_target="Admin",
            route=f"/student/{student_id}",
            event_id=idempotency_key
        )

    @staticmethod
    def emit_account_mapping_issue(db: Session, people_id: str, duplicate_usernames: List[str]) -> Dict[str, Any]:
        """
        ADDITIONAL ALERT B: ACCOUNT MAPPING ISSUE
        Notifies Admin when duplicate or conflicting LeetCode account mappings are detected.
        """
        title = f"Conflicting LeetCode Account Mapping Detected"
        body = (
            f"Duplicate or conflicting student-to-LeetCode-account mappings detected:\n\n"
            f"• Student Identity / People ID: {people_id}\n"
            f"• Conflicting Usernames: {', '.join(duplicate_usernames)}\n\n"
            f"No automatic merge was performed. Please resolve mapping in administrative console."
        )

        idempotency_key = f"account_mapping_issue_{people_id}_{hash(str(duplicate_usernames))}"
        return NotificationService.emit_event(
            event_type="ACCOUNT_MAPPING_ISSUE",
            title=title,
            body=body,
            priority="high",
            recipient_scope="ROLE",
            recipient_target="Admin",
            route="/settings",
            event_id=idempotency_key
        )

    @staticmethod
    def emit_recovery_completed(db: Session, job_id: str, recovered_count: int) -> Dict[str, Any]:
        """
        ADDITIONAL ALERT C: RECOVERY COMPLETED
        Notifies operational recipients when a previously failed sync or data fetch recovers.
        """
        title = f"Sync Recovery Completed (Job: {job_id})"
        body = (
            f"Operational sync recovery completed successfully:\n\n"
            f"• Job ID: {job_id}\n"
            f"• Recovered Student Profiles: {recovered_count}\n"
            f"• Status: Operational"
        )

        idempotency_key = f"recovery_completed_{job_id}"
        return NotificationService.emit_event(
            event_type="RECOVERY_COMPLETED",
            title=title,
            body=body,
            priority="normal",
            recipient_scope="ROLE",
            recipient_target="Admin",
            route="/settings",
            event_id=idempotency_key
        )

    @staticmethod
    def emit_large_growth_review(db: Session, student_id: int, prev_solved: int, curr_solved: int) -> Dict[str, Any]:
        """
        ADDITIONAL ALERT D: LARGE GROWTH REVIEW
        Flags unusually large jumps (>150 problems in 1 fetch without sub-day proof) for manual review.
        """
        student = db.query(Student).filter_by(id=student_id).first()
        s_name = student.name if student else f"Student ID {student_id}"
        delta = curr_solved - prev_solved

        title = f"Large Growth Review Flagged: {s_name} (+{delta})"
        body = (
            f"Unusually large problem-solving increase detected for {s_name}:\n\n"
            f"• Previous Solved: {prev_solved}\n"
            f"• Current Solved: {curr_solved}\n"
            f"• Net Increase: +{delta} problems\n\n"
            f"This growth exceeds typical single-fetch thresholds and has been flagged for staff verification."
        )

        idempotency_key = f"large_growth_review_{student_id}_{prev_solved}_{curr_solved}"
        return NotificationService.emit_event(
            event_type="LARGE_GROWTH_REVIEW",
            title=title,
            body=body,
            priority="high",
            recipient_scope="ROLE",
            recipient_target="STAFF",
            route=f"/student/{student_id}",
            event_id=idempotency_key
        )


automatic_engine = AutomaticNotificationEngine()

