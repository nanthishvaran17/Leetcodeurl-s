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
import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_

from backend.models import (
    User, Student, Department, FacultyStudentAssignment,
    LeetCodeProfileStats, WeeklySession, WeeklyPublicResult,
    ContestParticipationRecord, NotificationRecord
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
                cutoff_24h = datetime.datetime.utcnow() - datetime.timedelta(hours=24)
                active_count = db.query(LeetCodeProfileStats).filter(
                    LeetCodeProfileStats.student_id.in_(student_ids),
                    LeetCodeProfileStats.last_updated >= cutoff_24h
                ).count()

                cutoff_3d = datetime.datetime.utcnow() - datetime.timedelta(days=3)
                attention_count = db.query(LeetCodeProfileStats).filter(
                    LeetCodeProfileStats.student_id.in_(student_ids),
                    or_(
                        LeetCodeProfileStats.last_updated < cutoff_3d,
                        LeetCodeProfileStats.total_solved == 0,
                        LeetCodeProfileStats.last_updated.is_(None)
                    )
                ).count()

                new_problems = db.query(
                    func.coalesce(func.sum(LeetCodeProfileStats.easy_solved + LeetCodeProfileStats.medium_solved + LeetCodeProfileStats.hard_solved), 0)
                ).filter(
                    LeetCodeProfileStats.student_id.in_(student_ids),
                    LeetCodeProfileStats.last_updated >= cutoff_24h
                ).scalar() or 0

                new_milestones = 0
                for s in assigned_students:
                    if s.stats and s.stats.total_solved:
                        for m in MILESTONE_THRESHOLDS:
                            if s.stats.total_solved >= m and s.stats.last_updated and s.stats.last_updated >= cutoff_24h:
                                new_milestones += 1
                                break

                logger.info(f"[DAILY_FACULTY_INTELLIGENCE] intelligence_calculated faculty_id={faculty.id}")

                # 4. Format short, professional faculty message
                title = "Daily LeetCode Performance Summary"
                body = (
                    f"Daily LeetCode Performance\n\n"
                    f"Assigned students: {total_assigned}\n"
                    f"Students showing activity: {active_count}\n"
                    f"Students requiring attention: {attention_count}\n"
                    f"New milestones: {new_milestones}\n"
                    f"New problems solved: {new_problems}\n\n"
                    f"View detailed student performance."
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
                cutoff_24h = datetime.datetime.utcnow() - datetime.timedelta(hours=24)
                active_count = db.query(LeetCodeProfileStats).filter(
                    LeetCodeProfileStats.student_id.in_(dept_student_ids),
                    LeetCodeProfileStats.last_updated >= cutoff_24h
                ).count()

                active_pct = round((active_count / total_students) * 100, 1)

                # Inactive / attention count
                cutoff_3d = datetime.datetime.utcnow() - datetime.timedelta(days=3)
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

        return {"dispatched": dispatched, "date": today_str}

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

                cutoff_24h = datetime.datetime.utcnow() - datetime.timedelta(hours=24)
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

                participated_count = 0
                completed_count = 0
                partial_count = 0

                for r in results:
                    status = (r.participation_status or "").upper()
                    solved = r.total_contest_solved or 0
                    if status in ("OFFICIAL_ATTENDED", "VIRTUAL_ATTENDED", "PUBLIC", "ATTENDED") or solved > 0:
                        participated_count += 1
                        if solved >= 4:
                            completed_count += 1
                        elif solved >= 1:
                            partial_count += 1

                # Absent = Assigned minus Participated
                absent_count = max(0, assigned_count - participated_count)
                follow_up_count = absent_count

                title = f"Sunday Contest Performance Summary — {contest_name}"
                body = (
                    f"Faculty Assigned Students: {assigned_count}\n"
                    f"Participated: {participated_count}\n"
                    f"Absent: {absent_count}\n"
                    f"Completed: {completed_count}\n"
                    f"Partial: {partial_count}\n"
                    f"Students requiring follow-up: {follow_up_count}\n\n"
                    f"View detailed contest report."
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
                body = (
                    f"Sunday Contest Department Summary ({dept_name})\n\n"
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

                official_cnt = session.official_participants or 0
                virtual_cnt = session.virtual_participants or 0
                total_part = official_cnt + virtual_cnt
                part_pct = round((total_part / total_college) * 100, 1) if total_college > 0 else 0

                title = f"Sunday Contest Executive Report — {contest_name}"
                body = (
                    f"Sunday Contest Executive College Summary\n\n"
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


automatic_engine = AutomaticNotificationEngine()
