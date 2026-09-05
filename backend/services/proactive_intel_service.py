"""
proactive_intel_service.py
--------------------------
Read-only service that generates proactive, role-aware intelligence briefing
cards for the NEC AI Copilot widget. No LLM call is made — all cards are
derived from fast indexed DB queries on existing models.

Returned card structure:
  {
    "type":     "SUCCESS" | "WARNING" | "ALERT" | "INFO",
    "icon":     "shield" | "users" | "trophy" | "alert" | "activity" | "zap",
    "title":    str,
    "body":     str,
    "cta_label": str,
    "cta_query": str,
    "metric":   str | None,   e.g. "3 / 45"
    "trend":    "UP" | "DOWN" | "STABLE" | None
  }
"""

import datetime
import logging
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class ProactiveIntelService:
    """
    Generates a personalised list of BriefCards for the AI widget based on
    the role of the currently logged-in user.
    """

    @staticmethod
    def generate_brief(db: Session, user: Optional[Any] = None) -> List[Dict[str, Any]]:
        """
        Entry point.  Returns up to 6 BriefCards appropriate for the
        caller's role.  All failures are silently swallowed so the widget
        never breaks due to an intelligence query error.
        """
        role = ""
        if user:
            role = (getattr(user, "role", "") or "").strip().lower()

        cards: List[Dict[str, Any]] = []

        try:
            if role in ("super admin", "admin"):
                cards = ProactiveIntelService._admin_brief(db, user)
            elif role in ("hod",):
                cards = ProactiveIntelService._hod_brief(db, user)
            elif role in ("faculty", "staff", "cr"):
                cards = ProactiveIntelService._faculty_brief(db, user)
            else:
                # Default / student / viewer → lightweight public stats
                cards = ProactiveIntelService._default_brief(db)
        except Exception as exc:
            logger.warning("[ProactiveIntel] generate_brief error: %s", exc)

        return cards[:6]  # Cap at 6 cards maximum

    # ─────────────────────────────────────────────────────────────────────────
    # Admin Brief
    # ─────────────────────────────────────────────────────────────────────────
    @staticmethod
    def _admin_brief(db: Session, user: Any) -> List[Dict[str, Any]]:
        from backend.models import (
            Student, LeetCodeProfileStats, WeeklySession, WeeklyPublicResult
        )
        from sqlalchemy import func

        cards: List[Dict[str, Any]] = []

        # ── Card 1: Student sync health ──────────────────────────────────────
        try:
            total = db.query(func.count(Student.id)).filter(
                (Student.is_active == True) | (Student.is_active.is_(None))
            ).scalar() or 0

            verified = db.query(func.count(LeetCodeProfileStats.id)).filter(
                LeetCodeProfileStats.sync_status.in_(["success", "verified"])
            ).scalar() or 0

            failed = db.query(func.count(LeetCodeProfileStats.id)).filter(
                LeetCodeProfileStats.sync_status.in_(["failed", "error", "invalid_username"])
            ).scalar() or 0

            pending = total - verified - failed
            pct = round(verified / total * 100) if total else 0

            card_type = "SUCCESS" if pct >= 90 else ("WARNING" if pct >= 70 else "ALERT")
            cards.append({
                "type": card_type,
                "icon": "shield",
                "title": "Profile Sync Health",
                "body": f"{verified} verified · {failed} failed · {pending} pending out of {total} students.",
                "cta_label": "Check sync status",
                "cta_query": "last fetch kaatu",
                "metric": f"{pct}%",
                "trend": "UP" if pct >= 90 else ("STABLE" if pct >= 70 else "DOWN"),
            })
        except Exception as e:
            logger.debug("[ProactiveIntel] admin card 1 error: %s", e)

        # ── Card 2: Contest session status ───────────────────────────────────
        try:
            latest_sess = db.query(WeeklySession).order_by(
                WeeklySession.id.desc()
            ).first()

            if latest_sess:
                attendees = db.query(func.count(WeeklyPublicResult.id)).filter(
                    WeeklyPublicResult.session_id == latest_sess.id,
                    WeeklyPublicResult.participation_status == "PUBLIC_ATTENDED"
                ).scalar() or 0

                card_type = "INFO" if latest_sess.status in ("COMPLETED", "FINALIZED") else "WARNING"
                cards.append({
                    "type": card_type,
                    "icon": "trophy",
                    "title": f"Latest Contest: {latest_sess.contest_name or 'Weekly Contest'}",
                    "body": f"Status: {latest_sess.status} · {attendees} public attendees recorded.",
                    "cta_label": "View contest data",
                    "cta_query": f"Show contest {latest_sess.contest_name or 'latest'} attendance details",
                    "metric": f"{attendees} att.",
                    "trend": None,
                })
        except Exception as e:
            logger.debug("[ProactiveIntel] admin card 2 error: %s", e)

        # ── Card 3: Top performer spotlight ─────────────────────────────────
        try:
            from backend.models import Department
            from sqlalchemy.orm import joinedload
            top = db.query(Student).join(Student.stats).options(
                joinedload(Student.department), joinedload(Student.stats)
            ).filter(
                (Student.is_active == True) | (Student.is_active.is_(None))
            ).order_by(LeetCodeProfileStats.total_solved.desc()).first()

            if top and top.stats:
                dept = top.department.code if top.department else "CSE"
                cards.append({
                    "type": "SUCCESS",
                    "icon": "trophy",
                    "title": "🏆 Top Performer",
                    "body": f"{top.name} ({dept}) leads with {top.stats.total_solved} problems solved.",
                    "cta_label": "View full leaderboard",
                    "cta_query": "Who are the top 10 college solvers overall?",
                    "metric": f"{top.stats.total_solved} solved",
                    "trend": "UP",
                })
        except Exception as e:
            logger.debug("[ProactiveIntel] admin card 3 error: %s", e)

        # ── Card 4: Low solver alert ─────────────────────────────────────────
        try:
            zero_solvers = db.query(func.count(LeetCodeProfileStats.id)).filter(
                LeetCodeProfileStats.total_solved == 0
            ).scalar() or 0

            if zero_solvers > 0:
                cards.append({
                    "type": "ALERT" if zero_solvers > 20 else "WARNING",
                    "icon": "alert",
                    "title": "Zero-Solver Alert",
                    "body": f"{zero_solvers} students have 0 problems solved. Immediate attention recommended.",
                    "cta_label": "Find zero solvers",
                    "cta_query": "Find low solvers with less than 1 problem solved",
                    "metric": f"{zero_solvers} students",
                    "trend": "DOWN",
                })
        except Exception as e:
            logger.debug("[ProactiveIntel] admin card 4 error: %s", e)

        # ── Card 5: System health snapshot ───────────────────────────────────
        try:
            last_sync_row = db.query(LeetCodeProfileStats.last_verified_at).order_by(
                LeetCodeProfileStats.last_verified_at.desc()
            ).first()
            if last_sync_row and last_sync_row[0]:
                dt = last_sync_row[0]
                now_utc = datetime.datetime.utcnow()
                diff_h = (now_utc - dt).total_seconds() / 3600
                ist_dt = dt + datetime.timedelta(hours=5, minutes=30)
                last_str = ist_dt.strftime("%d %b, %I:%M %p IST")
                staleness = "UP" if diff_h < 24 else "DOWN"
                cards.append({
                    "type": "INFO" if diff_h < 24 else "WARNING",
                    "icon": "zap",
                    "title": "Last Data Sync",
                    "body": f"LeetCode profiles last verified at {last_str} ({round(diff_h, 1)}h ago).",
                    "cta_label": "Check sync telemetry",
                    "cta_query": "last fetch kaatu",
                    "metric": f"{round(diff_h, 1)}h ago",
                    "trend": staleness,
                })
        except Exception as e:
            logger.debug("[ProactiveIntel] admin card 5 error: %s", e)

        return cards

    # ─────────────────────────────────────────────────────────────────────────
    # Faculty Brief
    # ─────────────────────────────────────────────────────────────────────────
    @staticmethod
    def _faculty_brief(db: Session, user: Any) -> List[Dict[str, Any]]:
        from backend.models import (
            Student, LeetCodeProfileStats, FacultyStudentAssignment
        )
        from sqlalchemy import func

        cards: List[Dict[str, Any]] = []
        faculty_id = getattr(user, "id", None)

        # ── Card 1: Assigned student overview ────────────────────────────────
        assigned_student_ids: List[int] = []
        try:
            assignments = db.query(FacultyStudentAssignment).filter(
                FacultyStudentAssignment.faculty_id == faculty_id
            ).all()
            assigned_student_ids = [a.student_id for a in assignments if a.student_id]

            total_assigned = len(assigned_student_ids)
            if total_assigned > 0:
                cards.append({
                    "type": "INFO",
                    "icon": "users",
                    "title": "Your Assigned Students",
                    "body": f"You are mentoring {total_assigned} students. Check their LeetCode progress below.",
                    "cta_label": "Check inactive students",
                    "cta_query": "Find low solvers with less than 50 problems",
                    "metric": f"{total_assigned} students",
                    "trend": None,
                })
        except Exception as e:
            logger.debug("[ProactiveIntel] faculty card 1 error: %s", e)

        # ── Card 2: Inactive assigned students (0 or very few solved) ────────
        try:
            if assigned_student_ids:
                inactive = db.query(func.count(LeetCodeProfileStats.id)).filter(
                    LeetCodeProfileStats.student_id.in_(assigned_student_ids),
                    LeetCodeProfileStats.total_solved < 20
                ).scalar() or 0

                if inactive > 0:
                    cards.append({
                        "type": "ALERT" if inactive > 5 else "WARNING",
                        "icon": "alert",
                        "title": "Low Activity Alert",
                        "body": f"{inactive} of your assigned students have solved fewer than 20 problems.",
                        "cta_label": "Find inactive students",
                        "cta_query": "Find low solvers with less than 20 problems",
                        "metric": f"{inactive} inactive",
                        "trend": "DOWN",
                    })
        except Exception as e:
            logger.debug("[ProactiveIntel] faculty card 2 error: %s", e)

        # ── Card 3: Top performer in your group ──────────────────────────────
        try:
            if assigned_student_ids:
                top_row = db.query(Student, LeetCodeProfileStats).join(
                    LeetCodeProfileStats, LeetCodeProfileStats.student_id == Student.id
                ).filter(
                    Student.id.in_(assigned_student_ids)
                ).order_by(LeetCodeProfileStats.total_solved.desc()).first()

                if top_row:
                    top_student, top_stats = top_row
                    cards.append({
                        "type": "SUCCESS",
                        "icon": "trophy",
                        "title": "Top in Your Group",
                        "body": f"{top_student.name} leads your group with {top_stats.total_solved} problems solved.",
                        "cta_label": "View student profile",
                        "cta_query": f"Lookup {top_student.name} profile details",
                        "metric": f"{top_stats.total_solved} solved",
                        "trend": "UP",
                    })
        except Exception as e:
            logger.debug("[ProactiveIntel] faculty card 3 error: %s", e)

        # ── Card 4: Fallback if no assignments ───────────────────────────────
        if not cards:
            try:
                total = db.query(func.count(Student.id)).filter(
                    (Student.is_active == True) | (Student.is_active.is_(None))
                ).scalar() or 0
                cards.append({
                    "type": "INFO",
                    "icon": "users",
                    "title": "Institution Overview",
                    "body": f"{total} active students enrolled. No mentees assigned yet.",
                    "cta_label": "View top solvers",
                    "cta_query": "Who are the top 10 college solvers overall?",
                    "metric": f"{total} students",
                    "trend": None,
                })
            except Exception as e:
                logger.debug("[ProactiveIntel] faculty card 4 error: %s", e)

        return cards

    # ─────────────────────────────────────────────────────────────────────────
    # HOD Brief
    # ─────────────────────────────────────────────────────────────────────────
    @staticmethod
    def _hod_brief(db: Session, user: Any) -> List[Dict[str, Any]]:
        from backend.models import (
            Student, LeetCodeProfileStats, Department, WeeklySession
        )
        from sqlalchemy import func

        cards: List[Dict[str, Any]] = []
        dept_id = getattr(user, "department_id", None)

        # ── Card 1: Department active solver % ───────────────────────────────
        try:
            dept_query = db.query(Student).filter(
                (Student.is_active == True) | (Student.is_active.is_(None))
            )
            if dept_id:
                dept_query = dept_query.filter(Student.department_id == dept_id)

            dept_students = dept_query.all()
            total_dept = len(dept_students)
            if total_dept > 0:
                ids = [s.id for s in dept_students]
                active_count = db.query(func.count(LeetCodeProfileStats.id)).filter(
                    LeetCodeProfileStats.student_id.in_(ids),
                    LeetCodeProfileStats.total_solved > 0
                ).scalar() or 0
                pct = round(active_count / total_dept * 100)
                dept_name = ""
                if dept_id:
                    dept_obj = db.query(Department).filter(Department.id == dept_id).first()
                    dept_name = f" ({dept_obj.code})" if dept_obj else ""

                cards.append({
                    "type": "SUCCESS" if pct >= 70 else "WARNING",
                    "icon": "activity",
                    "title": f"Department{dept_name} Active Solvers",
                    "body": f"{active_count} of {total_dept} students are actively solving problems ({pct}%).",
                    "cta_label": "View HOD report",
                    "cta_query": "Generate HOD weekly summary report",
                    "metric": f"{pct}% active",
                    "trend": "UP" if pct >= 70 else "DOWN",
                })
        except Exception as e:
            logger.debug("[ProactiveIntel] hod card 1 error: %s", e)

        # ── Card 2: Latest contest ───────────────────────────────────────────
        try:
            sess = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()
            if sess:
                cards.append({
                    "type": "INFO",
                    "icon": "trophy",
                    "title": "Latest Weekly Contest",
                    "body": f"{sess.contest_name or 'Weekly Contest'} — Status: {sess.status}. Review participation data.",
                    "cta_label": "View contest report",
                    "cta_query": f"Compare last two contests",
                    "metric": sess.status,
                    "trend": None,
                })
        except Exception as e:
            logger.debug("[ProactiveIntel] hod card 2 error: %s", e)

        # ── Card 3: Low solver alert ─────────────────────────────────────────
        try:
            if dept_id:
                ids_q = [s.id for s in db.query(Student).filter(
                    Student.department_id == dept_id,
                    (Student.is_active == True) | (Student.is_active.is_(None))
                ).all()]
                low = db.query(func.count(LeetCodeProfileStats.id)).filter(
                    LeetCodeProfileStats.student_id.in_(ids_q),
                    LeetCodeProfileStats.total_solved < 50
                ).scalar() or 0
                if low > 0:
                    cards.append({
                        "type": "WARNING",
                        "icon": "alert",
                        "title": "Low Solver Risk",
                        "body": f"{low} students in your department have solved fewer than 50 problems.",
                        "cta_label": "Identify low solvers",
                        "cta_query": "Find low solvers with less than 50 problems",
                        "metric": f"{low} at risk",
                        "trend": "DOWN",
                    })
        except Exception as e:
            logger.debug("[ProactiveIntel] hod card 3 error: %s", e)

        return cards

    # ─────────────────────────────────────────────────────────────────────────
    # Default Brief (Student / Viewer / No Auth)
    # ─────────────────────────────────────────────────────────────────────────
    @staticmethod
    def _default_brief(db: Session) -> List[Dict[str, Any]]:
        from backend.models import Student, LeetCodeProfileStats
        from sqlalchemy import func
        from sqlalchemy.orm import joinedload

        cards: List[Dict[str, Any]] = []

        try:
            total = db.query(func.count(Student.id)).filter(
                (Student.is_active == True) | (Student.is_active.is_(None))
            ).scalar() or 0

            top = db.query(Student).join(Student.stats).options(
                joinedload(Student.stats)
            ).filter(
                (Student.is_active == True) | (Student.is_active.is_(None))
            ).order_by(LeetCodeProfileStats.total_solved.desc()).first()

            cards.append({
                "type": "INFO",
                "icon": "users",
                "title": "NEC LeetCode Platform",
                "body": f"{total} students enrolled. Use this assistant to explore performance data.",
                "cta_label": "View top 10 solvers",
                "cta_query": "Who are the top 10 college solvers overall?",
                "metric": f"{total} students",
                "trend": None,
            })

            if top and top.stats:
                cards.append({
                    "type": "SUCCESS",
                    "icon": "trophy",
                    "title": "College Leader",
                    "body": f"{top.name} is the top solver with {top.stats.total_solved} problems.",
                    "cta_label": "View leaderboard",
                    "cta_query": "Who are the top 10 college solvers overall?",
                    "metric": f"{top.stats.total_solved} solved",
                    "trend": "UP",
                })
        except Exception as e:
            logger.debug("[ProactiveIntel] default brief error: %s", e)

        return cards
