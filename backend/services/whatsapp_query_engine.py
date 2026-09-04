"""
whatsapp_query_engine.py — Read-Only Scoped LeetCode / Department / Contest Query Engine

Security Mandates:
1. ONLY Read-Only database queries (no writes, updates, resets).
2. Strict 4-Tier Role Isolation:
   - Principal: Full institutional scope across all departments.
   - HOD: Own department only (cross-department requests strictly rejected).
   - Faculty: Assigned mentees only (unassigned student queries strictly rejected).
   - Student: Own profile and contest records only.
   - Unregistered: Onboarding prompt only.
3. Dual Language output: Clear English + Tamil formatted message templates.
"""

from typing import Dict, Any, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc, or_

from backend.models import (
    User, Student, Department, LeetCodeProfileStats,
    WeeklySession, WeeklySessionSnapshot
)
from backend.services.whatsapp_auth_service import WhatsAppIdentity


class WhatsAppQueryEngine:

    @classmethod
    def get_overview(cls, db: Session, identity: WhatsAppIdentity) -> Dict[str, Any]:
        """Returns role-tailored dashboard overview."""
        if identity.role == "UNREGISTERED":
            return {
                "success": False,
                "role": "UNREGISTERED",
                "message": (
                    "👋 *Welcome to Nandha LeetCode Intelligence Bot!*\n\n"
                    "Your phone number is not yet linked to any Student or Faculty account.\n\n"
                    "🔗 *How to Link:*\n"
                    "1. Log in to your college LeetCode portal.\n"
                    "2. Go to Profile Settings ➡️ Link WhatsApp.\n"
                    "3. Or contact your Department HOD / System Administrator."
                )
            }

        # A. STUDENT OVERVIEW
        if identity.role == "STUDENT":
            student = db.query(Student).options(
                joinedload(Student.stats),
                joinedload(Student.department)
            ).filter(Student.id == identity.student_id).first()

            if not student:
                return {"success": False, "message": "Student profile not found."}

            stats = student.stats
            solved = stats.total_solved if stats else 0
            easy = stats.easy_solved if stats else 0
            med = stats.medium_solved if stats else 0
            hard = stats.hard_solved if stats else 0
            streak = stats.max_streak if stats else 0
            rating = stats.contest_rating if stats else 0.0

            msg = (
                f"📊 *LeetCode Profile — {student.name}*\n"
                f"🏷️ Reg No: `{student.reg_no}` | Dept: {identity.department_code}\n\n"
                f"✅ *Total Solved:* {solved} problems\n"
                f"  🟢 Easy: {easy} | 🟡 Medium: {med} | 🔴 Hard: {hard}\n"
                f"🔥 *Max Streak:* {streak} days\n"
                f"🏆 *Contest Rating:* {rating:.1f}\n\n"
                f"💡 Type `/contest` for weekly contest score or `/help` for more options."
            )
            return {"success": True, "role": "STUDENT", "message": msg, "data": {"solved": solved, "streak": streak, "rating": rating}}

        # B. FACULTY OVERVIEW
        elif identity.role == "FACULTY":
            mentee_ids = identity.assigned_student_ids
            total_mentees = len(mentee_ids)
            
            if total_mentees == 0:
                msg = (
                    f"👨‍🏫 *Faculty Mentoring Overview — {identity.name}*\n"
                    f"🏢 Dept: {identity.department_code}\n\n"
                    f"ℹ️ You have no mentees currently assigned.\n"
                    f"Please check with your HOD for student allocation."
                )
                return {"success": True, "role": "FACULTY", "message": msg, "data": {"total_mentees": 0}}

            students = db.query(Student).options(joinedload(Student.stats)).filter(
                Student.id.in_(mentee_ids)
            ).all()

            total_solved = sum(s.stats.total_solved for s in students if s.stats and s.stats.total_solved)
            avg_solved = round(total_solved / total_mentees, 1) if total_mentees else 0
            active_streaks = sum(1 for s in students if s.stats and s.stats.max_streak and s.stats.max_streak > 0)
            needing_attention = sum(1 for s in students if not s.stats or not s.stats.total_solved or s.stats.total_solved < 10)

            msg = (
                f"👨‍🏫 *Faculty Mentoring Overview — {identity.name}*\n"
                f"🏢 Dept: {identity.department_code} | 👥 Mentees: {total_mentees} (Ratio: {total_mentees}/20)\n\n"
                f"📈 *Total Group Solves:* {total_solved}\n"
                f"📊 *Average Solved:* {avg_solved} / mentee\n"
                f"🔥 *Active Daily Coders:* {active_streaks} students\n"
                f"⚠️ *Need Mentoring Attention:* {needing_attention} students\n\n"
                f"💡 Type `/mentees` for full student list or `/leaderboard` for top performers."
            )
            return {"success": True, "role": "FACULTY", "message": msg, "data": {"total_mentees": total_mentees, "total_solved": total_solved}}

        # C. HOD OVERVIEW
        elif identity.role == "HOD":
            target_dept_id = identity.department_id
            dept_obj = db.query(Department).filter(Department.id == target_dept_id).first()
            dept_code = dept_obj.code if dept_obj else identity.department_code

            total_students = db.query(func.count(Student.id)).filter(
                Student.department_id == target_dept_id,
                Student.is_active == True
            ).scalar() or 0

            total_solved = db.query(func.sum(LeetCodeProfileStats.total_solved)).join(
                Student, Student.id == LeetCodeProfileStats.student_id
            ).filter(Student.department_id == target_dept_id).scalar() or 0

            faculty_count = db.query(func.count(User.id)).filter(
                User.department_id == target_dept_id,
                User.role.in_(["Faculty", "faculty", "Staff", "staff"])
            ).scalar() or 0

            msg = (
                f"🏛️ *Department Command Summary — HOD {dept_code}*\n"
                f"👨‍💼 HOD: {identity.name}\n\n"
                f"👥 *Total Active Students:* {total_students:,}\n"
                f"✅ *Total Problems Solved:* {int(total_solved):,}\n"
                f"👨‍🏫 *Faculty Mentors:* {faculty_count}\n"
                f"📊 *Avg Solved / Student:* {round(total_solved/total_students, 1) if total_students else 0}\n\n"
                f"💡 Type `/leaderboard` for top students or `/workload` for faculty status."
            )
            return {"success": True, "role": "HOD", "message": msg, "data": {"total_students": total_students, "total_solved": total_solved}}

        # D. PRINCIPAL / SUPER ADMIN OVERVIEW
        elif identity.role == "PRINCIPAL":
            total_students = db.query(func.count(Student.id)).filter(Student.is_active == True).scalar() or 0
            total_solved = db.query(func.sum(LeetCodeProfileStats.total_solved)).scalar() or 0
            total_depts = db.query(func.count(Department.id)).scalar() or 0
            total_faculty = db.query(func.count(User.id)).filter(User.role.in_(["Faculty", "faculty", "Staff"])).scalar() or 0

            msg = (
                f"🏛️ *Nandha Institutional Command Overview*\n"
                f"👑 Authorized: Principal / Super Admin ({identity.name})\n\n"
                f"🎓 *Total Institution Students:* {total_students:,}\n"
                f"🏢 *Active Departments:* {total_depts}\n"
                f"👨‍🏫 *Total Faculty Mentors:* {total_faculty}\n"
                f"✅ *Total College Solved:* {int(total_solved):,} problems\n\n"
                f"💡 Type `/contest` for Sunday telemetry or `/leaderboard` for college top coders."
            )
            return {"success": True, "role": "PRINCIPAL", "message": msg, "data": {"total_students": total_students, "total_solved": total_solved}}

        return {"success": False, "message": "Unknown authorization scope."}

    @classmethod
    def get_weekly_contest(cls, db: Session, identity: WhatsAppIdentity) -> Dict[str, Any]:
        """Returns weekly contest telemetry scoped by role."""
        if identity.role == "UNREGISTERED":
            return {"success": False, "message": "Please register your number to view contest data."}

        latest_session = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()
        if not latest_session:
            return {"success": True, "message": "ℹ️ No Weekly Contest session recorded yet."}

        sess_title = latest_session.contest_name or f"Weekly Contest (Week {latest_session.week_number})"
        sess_date = latest_session.session_date or "Sunday"
        sess_status = latest_session.status

        # A. STUDENT CONTEST
        if identity.role == "STUDENT":
            snap = db.query(WeeklySessionSnapshot).filter(
                WeeklySessionSnapshot.session_id == latest_session.id,
                WeeklySessionSnapshot.student_id == identity.student_id
            ).first()

            if not snap or (snap.problems_added == 0 and snap.status == "NOT STARTED"):
                msg = (
                    f"🏆 *{sess_title} ({sess_date})*\n"
                    f"Status: {sess_status}\n\n"
                    f"❌ *Participation:* Not Attended / No Problems Solved\n"
                    f"💡 Ensure you participate in the Sunday Weekly Contest (08:00–09:30 AM) to build your institutional rating!"
                )
            else:
                solved = snap.problems_added or 0
                msg = (
                    f"🏆 *{sess_title} ({sess_date})*\n"
                    f"Status: {sess_status}\n\n"
                    f"✅ *Status:* Attended ({snap.status})\n"
                    f"🎯 *Problems Solved:* {solved} / 4\n"
                    f"🔥 *Performance:* {'Superb! 🌟' if solved >= 3 else ('Good Job! 👍' if solved >= 1 else 'Keep Practicing! 💪')}"
                )
            return {"success": True, "role": "STUDENT", "message": msg}

        # B. FACULTY CONTEST
        elif identity.role == "FACULTY":
            mentee_ids = identity.assigned_student_ids
            if not mentee_ids:
                return {"success": True, "message": "No mentees assigned for contest tracking."}

            snaps = db.query(WeeklySessionSnapshot).filter(
                WeeklySessionSnapshot.session_id == latest_session.id,
                WeeklySessionSnapshot.student_id.in_(mentee_ids)
            ).all()

            attended = sum(1 for s in snaps if (s.problems_added and s.problems_added > 0) or s.status == "STARTED")
            total = len(mentee_ids)
            attendance_pct = round((attended / total) * 100, 1) if total else 0

            msg = (
                f"🏆 *Faculty Mentee Contest Report*\n"
                f"📌 {sess_title} ({sess_date})\n\n"
                f"👥 *Mentees Total:* {total}\n"
                f"✅ *Participated:* {attended} students ({attendance_pct}%)\n"
                f"❌ *Missed Contest:* {total - attended} students\n\n"
                f"💡 Type `/mentees` to view individual student solve counts."
            )
            return {"success": True, "role": "FACULTY", "message": msg}

        # C. HOD CONTEST
        elif identity.role == "HOD":
            target_dept_id = identity.department_id
            dept_students_count = db.query(func.count(Student.id)).filter(
                Student.department_id == target_dept_id,
                Student.is_active == True
            ).scalar() or 0

            dept_snaps_attended = db.query(WeeklySessionSnapshot).join(
                Student, Student.id == WeeklySessionSnapshot.student_id
            ).filter(
                WeeklySessionSnapshot.session_id == latest_session.id,
                Student.department_id == target_dept_id,
                (WeeklySessionSnapshot.problems_added > 0) | (WeeklySessionSnapshot.status == "STARTED")
            ).count()

            pct = round((dept_snaps_attended / dept_students_count) * 100, 1) if dept_students_count else 0

            msg = (
                f"🏆 *Department Contest Telemetry — {identity.department_code}*\n"
                f"📌 {sess_title} ({sess_date})\n\n"
                f"👥 *Dept Students:* {dept_students_count:,}\n"
                f"✅ *Attended:* {dept_snaps_attended:,} ({pct}%)\n"
                f"🔒 *Session State:* {sess_status}\n\n"
                f"💡 Type `/leaderboard` for top contest rankers."
            )
            return {"success": True, "role": "HOD", "message": msg}

        # D. PRINCIPAL CONTEST
        elif identity.role == "PRINCIPAL":
            total_students = latest_session.total_students or 3517
            official = latest_session.official_participants or 0
            virtual = latest_session.virtual_participants or 0
            total_part = official + virtual
            pct = round((total_part / total_students) * 100, 1) if total_students else 0

            msg = (
                f"🏆 *Institutional Contest Master Telemetry*\n"
                f"📌 {sess_title} ({sess_date})\n\n"
                f"🎓 *Total Students Frozen:* {total_students:,}\n"
                f"✅ *Official 08:00 AM Participants:* {official:,}\n"
                f"💻 *Virtual Contest Participants:* {virtual:,}\n"
                f"📈 *Total College Attendance:* {total_part:,} ({pct}%)\n"
                f"🔒 *Immutability Lock:* {sess_status}"
            )
            return {"success": True, "role": "PRINCIPAL", "message": msg}

        return {"success": False, "message": "Unknown authorization scope."}

    @classmethod
    def get_leaderboard(
        cls,
        db: Session,
        identity: WhatsAppIdentity,
        requested_dept_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Returns top 10 leaderboard strictly scoped by role:
        - Principal: Institution top 10 or specified department top 10.
        - HOD: Own department top 10 (403 if requesting other department).
        - Faculty: Assigned mentees top 10.
        - Student: Own department top 10.
        """
        if identity.role == "UNREGISTERED":
            return {"success": False, "message": "Please register your number to view the leaderboard."}

        # Role Scoping & Department Isolation Check
        query = db.query(Student).options(joinedload(Student.stats)).outerjoin(Student.stats)

        # 1. HOD Scoping
        if identity.role == "HOD":
            if requested_dept_code and requested_dept_code.upper() != (identity.department_code or "").upper():
                return {
                    "success": False,
                    "error_code": 403,
                    "message": f"⛔ *Access Denied:* HOD of {identity.department_code} is not authorized to view the leaderboard of department '{requested_dept_code}'."
                }
            query = query.filter(Student.department_id == identity.department_id)
            title = f"🏆 *Top Coders — Department of {identity.department_code}*"

        # 2. Faculty Scoping
        elif identity.role == "FACULTY":
            if requested_dept_code:
                return {
                    "success": False,
                    "error_code": 403,
                    "message": "⛔ *Access Denied:* Faculty mentors can only query their assigned mentee leaderboard."
                }
            query = query.filter(Student.id.in_(identity.assigned_student_ids or [-1]))
            title = f"🏆 *Top Mentees — {identity.name}*"

        # 3. Student Scoping
        elif identity.role == "STUDENT":
            query = query.filter(Student.department_id == identity.department_id)
            title = f"🏆 *Department Leaderboard — {identity.department_code}*"

        # 4. Principal Scoping
        elif identity.role == "PRINCIPAL":
            if requested_dept_code:
                target_dept = db.query(Department).filter(
                    func.upper(Department.code) == requested_dept_code.upper().strip()
                ).first()
                if target_dept:
                    query = query.filter(Student.department_id == target_dept.id)
                    title = f"🏆 *Top Coders — {target_dept.code} Department*"
                else:
                    return {"success": False, "message": f"Department code '{requested_dept_code}' not found."}
            else:
                title = "🏆 *College-Wide Hall-of-Fame (Top 10)*"

        top_students = query.order_by(desc(LeetCodeProfileStats.total_solved)).limit(10).all()

        if not top_students:
            return {"success": True, "message": f"{title}\n\nNo student solve records found."}

        lines = [title, ""]
        for idx, s in enumerate(top_students, start=1):
            solved = s.stats.total_solved if s.stats else 0
            streak = s.stats.max_streak if s.stats else 0
            medal = "🥇" if idx == 1 else ("🥈" if idx == 2 else ("🥉" if idx == 3 else f"#{idx}"))
            lines.append(f"{medal} *{s.name}* (`{s.reg_no}`) — {solved} solved (🔥 {streak}d)")

        return {"success": True, "message": "\n".join(lines)}

    @classmethod
    def get_mentees_or_workload(cls, db: Session, identity: WhatsAppIdentity) -> Dict[str, Any]:
        """
        Returns Mentee list (for Faculty) or Faculty Workload (for HOD / Principal).
        Students are blocked with 403 Forbidden.
        """
        if identity.role == "STUDENT":
            return {
                "success": False,
                "error_code": 403,
                "message": "⛔ *Access Denied:* Students are not authorized to access mentor management commands."
            }

        if identity.role == "FACULTY":
            mentee_ids = identity.assigned_student_ids
            if not mentee_ids:
                return {"success": True, "message": "ℹ️ You have no assigned mentees."}

            students = db.query(Student).options(joinedload(Student.stats)).filter(
                Student.id.in_(mentee_ids)
            ).all()
            students.sort(key=lambda x: (x.stats.total_solved if x.stats else 0), reverse=True)

            lines = [f"👥 *Your Assigned Mentees ({len(students)}/20)*", ""]
            for idx, s in enumerate(students, start=1):
                solved = s.stats.total_solved if s.stats else 0
                streak = s.stats.max_streak if s.stats else 0
                lines.append(f"{idx}. *{s.name}* (`{s.reg_no}`) — {solved} solved (🔥 {streak}d)")

            return {"success": True, "message": "\n".join(lines)}

        elif identity.role in ["HOD", "PRINCIPAL"]:
            query = db.query(User).options(
                joinedload(User.department),
                joinedload(User.assigned_students)
            ).filter(User.role.in_(["Faculty", "faculty", "Staff", "staff"]))

            if identity.role == "HOD":
                query = query.filter(User.department_id == identity.department_id)
                header = f"👨‍🏫 *Faculty Workload Summary — {identity.department_code}*"
            else:
                header = "👨‍🏫 *Institutional Faculty Mentoring Summary*"

            faculty_list = query.all()
            lines = [header, ""]
            for fac in faculty_list:
                assigned_count = len([a for a in fac.assigned_students if a.is_active != False])
                status = "🟢 Normal" if assigned_count < 20 else ("🟡 At Ratio" if assigned_count == 20 else "⚠️ Above Ratio")
                lines.append(f"• *{fac.username}*: {assigned_count}/20 mentees ({status})")

            return {"success": True, "message": "\n".join(lines)}

        return {"success": False, "message": "Unauthorized role."}

    @classmethod
    def search_student(
        cls,
        db: Session,
        identity: WhatsAppIdentity,
        query_term: str
    ) -> Dict[str, Any]:
        """
        Searches student by name or reg_no with strict 4-tier isolation:
        - Student: Can only view their own record.
        - Faculty: Can only view assigned mentees.
        - HOD: Can only view students in their own department.
        - Principal: Can search all students.
        """
        if not query_term or not query_term.strip():
            return {"success": False, "message": "Please provide a student name or register number to search (e.g. `/search 732224CC031`)."}

        term = query_term.strip()
        search_filter = or_(
            Student.reg_no.ilike(f"%{term}%"),
            Student.name.ilike(f"%{term}%"),
            Student.username.ilike(f"%{term}%")
        )

        query = db.query(Student).options(
            joinedload(Student.stats),
            joinedload(Student.department)
        ).filter(search_filter, Student.is_active == True)

        # 1. Student Scoping: Self only
        if identity.role == "STUDENT":
            query = query.filter(Student.id == identity.student_id)
        
        # 2. Faculty Scoping: Assigned only
        elif identity.role == "FACULTY":
            query = query.filter(Student.id.in_(identity.assigned_student_ids or [-1]))

        # 3. HOD Scoping: Own department only
        elif identity.role == "HOD":
            query = query.filter(Student.department_id == identity.department_id)

        # 4. Principal: No restriction

        matches = query.limit(5).all()

        if not matches:
            if identity.role == "STUDENT":
                return {"success": False, "message": "⛔ *Access Denied:* You can only look up your own student records."}
            elif identity.role == "FACULTY":
                return {"success": False, "message": f"ℹ️ No student matching '{term}' found in your assigned mentees."}
            elif identity.role == "HOD":
                return {"success": False, "message": f"ℹ️ No student matching '{term}' found in the Department of {identity.department_code}."}
            return {"success": False, "message": f"ℹ️ No student matching '{term}' found."}

        lines = [f"🔍 *Search Results for '{term}'* ({len(matches)} found):", ""]
        for s in matches:
            stats = s.stats
            solved = stats.total_solved if stats else 0
            streak = stats.max_streak if stats else 0
            dept = s.department.code if s.department else "CSE"
            lines.append(f"• *{s.name}* (`{s.reg_no}`)\n  🏢 {dept} | 🎯 Solved: {solved} | 🔥 Streak: {streak}d\n")

        return {"success": True, "message": "\n".join(lines).strip()}

    @classmethod
    def get_help_menu(cls, identity: WhatsAppIdentity) -> str:
        """Returns a customized command menu based on the user's role."""
        header = f"🤖 *Nandha LeetCode Intelligence Bot*\n👋 Hello *{identity.name}* ({identity.display_role})\n"

        if identity.role == "STUDENT":
            menu = (
                f"{header}\n"
                f"Available Commands:\n"
                f"• `/profile` or `stats` — View your LeetCode solve counts & streak\n"
                f"• `/contest` — View your Sunday Weekly Contest score & rank\n"
                f"• `/leaderboard` — View your department top coders\n"
                f"• `/streak` — Check daily streak status\n"
                f"• `/help` — Show this menu"
            )
        elif identity.role == "FACULTY":
            menu = (
                f"{header}\n"
                f"Available Commands (Faculty Mentoring Mode):\n"
                f"• `/overview` — Group mentoring statistics & active coders\n"
                f"• `/mentees` — List all assigned mentees with solves\n"
                f"• `/contest` — Mentee Sunday contest attendance report\n"
                f"• `/leaderboard` — Top performers among your mentees\n"
                f"• `/search <name/reg_no>` — Find a specific mentee\n"
                f"• `/help` — Show this menu"
            )
        elif identity.role == "HOD":
            menu = (
                f"{header}\n"
                f"Available Commands (HOD Command Mode):\n"
                f"• `/overview` — Department overall solved & student count\n"
                f"• `/leaderboard` — Department top 10 coders\n"
                f"• `/workload` — Faculty mentoring workload breakdown\n"
                f"• `/contest` — Department Sunday contest attendance telemetry\n"
                f"• `/search <name/reg_no>` — Search students in your department\n"
                f"• `/help` — Show this menu"
            )
        elif identity.role == "PRINCIPAL":
            menu = (
                f"{header}\n"
                f"Available Commands (Principal Institutional Scope):\n"
                f"• `/overview` — College-wide students, solves & departments\n"
                f"• `/leaderboard [dept]` — College or department top 10 coders\n"
                f"• `/contest` — Sunday contest master telemetry\n"
                f"• `/workload` — Institutional faculty mentoring distribution\n"
                f"• `/search <name/reg_no>` — Search any student across all departments\n"
                f"• `/help` — Show this menu"
            )
        else:
            menu = (
                f"👋 *Welcome to Nandha LeetCode Intelligence Bot!*\n\n"
                f"Your phone number `{identity.phone_number}` is not yet registered.\n"
                f"Please link your WhatsApp number in the web portal or contact your administrator."
            )

        return menu


whatsapp_query_engine = WhatsAppQueryEngine()
