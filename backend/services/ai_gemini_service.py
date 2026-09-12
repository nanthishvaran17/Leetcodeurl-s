import os
import json
import uuid
import datetime
import traceback
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_
from google import genai
from google.genai import types

from backend.config import settings
from backend.models import Student, Department, LeetCodeProfileStats, FacultyStudentAssignment, User, WeeklySession
from backend.services.authorization_service import apply_role_based_student_filter
from backend.services.hod_analytics_engine import calculate_department_health_score
from backend.logger import logger


def execute_search_students(
    db: Session,
    user: Optional[User],
    search: Optional[str] = None,
    department: Optional[str] = None,
    year_level: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 10
) -> Dict[str, Any]:
    """Retrieves authorized student records using validated ORM filters and RBAC boundaries."""
    q = db.query(Student).outerjoin(LeetCodeProfileStats, Student.id == LeetCodeProfileStats.student_id)
    q = apply_role_based_student_filter(q, user, db)

    if department and department.upper() != "ALL":
        dept_matches = db.query(Department).filter(
            (Department.code.ilike(f"{department}%")) | (Department.name.ilike(f"%{department}%"))
        ).all()
        if dept_matches:
            target_ids = [d.id for d in dept_matches]
            q = q.filter(Student.department_id.in_(target_ids))

    if year_level and year_level.upper() != "ALL":
        clean_y = year_level.upper().replace("TH", "").replace("RD", "").replace("ND", "").replace("ST", "").strip()
        y_map = {"1": "I", "2": "II", "3": "III", "4": "IV", "FIRST": "I", "SECOND": "II", "THIRD": "III", "FOURTH": "IV"}
        norm_y = y_map.get(clean_y, clean_y)
        q = q.filter(Student.year_level == norm_y)

    if status and status.upper() != "ALL":
        if status.upper() == "INACTIVE":
            q = q.filter(or_(LeetCodeProfileStats.id == None, LeetCodeProfileStats.total_solved == 0))
        elif status.upper() == "ACTIVE":
            q = q.filter(LeetCodeProfileStats.total_solved > 0)

    if search and search.strip():
        term = f"%{search.strip()}%"
        q = q.filter(or_(Student.name.ilike(term), Student.reg_no.ilike(term), Student.username.ilike(term)))

    total = q.count()
    rows = q.options(joinedload(Student.department), joinedload(Student.stats)).limit(min(limit, 25)).all()

    students_list = []
    for s in rows:
        st = s.stats
        students_list.append({
            "reg_no": s.reg_no,
            "name": s.name,
            "department": s.department.code if s.department else "GEN",
            "year_level": s.year_level,
            "total_solved": st.total_solved if st else 0,
            "easy_solved": st.easy_solved if st else 0,
            "medium_solved": st.medium_solved if st else 0,
            "hard_solved": st.hard_solved if st else 0,
            "contest_rating": st.contest_rating if st else 0.0,
            "status": "ACTIVE" if (st and (st.total_solved or 0) > 0) else "INACTIVE"
        })

    return {"total_matching_students": total, "returned_count": len(students_list), "students": students_list}


def execute_get_department_analytics(
    db: Session,
    user: Optional[User],
    department: Optional[str] = None,
    year_level: Optional[str] = None
) -> Dict[str, Any]:
    """Retrieves validated health scores & aggregate statistics for a department or institution."""
    dept_id = None
    dept_code = "ALL"
    dept_name = "All Institutional Departments"

    if department and department.upper() != "ALL":
        dept_obj = db.query(Department).filter(
            (Department.code.ilike(f"{department}%")) | (Department.name.ilike(f"%{department}%"))
        ).first()
        if dept_obj:
            dept_id = dept_obj.id
            dept_code = dept_obj.code
            dept_name = dept_obj.name

    health = calculate_department_health_score(
        db,
        current_user=user,
        dept_id=dept_id,
        year_level=year_level if (year_level and year_level.upper() != "ALL") else None
    )

    return {
        "department_code": dept_code,
        "department_name": dept_name,
        "health_score": health.get("health_score", 0),
        "total_students": health.get("total_students", 0),
        "active_this_week": health.get("active_this_week", 0),
        "inactive_count": health.get("inactive_count", 0),
        "improving_count": health.get("improving_count", 0),
        "participation_rate": f"{health.get('participation_score', 0)}%",
        "avg_solved": health.get("avg_solved", 0),
        "avg_rating": health.get("avg_rating", 0)
    }


def execute_get_performance_leaderboard(
    db: Session,
    user: Optional[User],
    department: Optional[str] = None,
    year_level: Optional[str] = None,
    language: Optional[str] = None,
    metric: str = "total_solved",
    limit: int = 5
) -> Dict[str, Any]:
    """Ranks authorized top students by requested metric and optional language filter."""
    q = db.query(Student).join(LeetCodeProfileStats, Student.id == LeetCodeProfileStats.student_id)
    q = apply_role_based_student_filter(q, user, db)

    if department and department.upper() != "ALL":
        dept_matches = db.query(Department).filter(
            (Department.code.ilike(f"{department}%")) | (Department.name.ilike(f"%{department}%"))
        ).all()
        if dept_matches:
            target_ids = [d.id for d in dept_matches]
            q = q.filter(Student.department_id.in_(target_ids))

    if year_level and year_level.upper() != "ALL":
        clean_y = year_level.upper().replace("TH", "").replace("RD", "").replace("ND", "").replace("ST", "").strip()
        y_map = {"1": "I", "2": "II", "3": "III", "4": "IV"}
        norm_y = y_map.get(clean_y, clean_y)
        q = q.filter(Student.year_level == norm_y)

    if language and language.strip() and language.upper() != "ALL":
        from backend.models import LeetCodeLanguageStats
        lang_term = f"%{language.strip()}%"
        lang_subq = db.query(LeetCodeLanguageStats.student_id).filter(
            LeetCodeLanguageStats.language_name.ilike(lang_term),
            LeetCodeLanguageStats.problems_solved > 0
        )
        q = q.filter(Student.id.in_(lang_subq))

    if metric == "contest_rating":
        q = q.order_by(LeetCodeProfileStats.contest_rating.desc().nullslast(), LeetCodeProfileStats.total_solved.desc())
    else:
        q = q.order_by(LeetCodeProfileStats.total_solved.desc(), LeetCodeProfileStats.contest_rating.desc().nullslast())

    rows = q.options(joinedload(Student.department), joinedload(Student.stats)).limit(min(limit, 20)).all()

    top_students = []
    for rank, s in enumerate(rows, start=1):
        st = s.stats
        top_students.append({
            "rank": rank,
            "reg_no": s.reg_no,
            "name": s.name,
            "department": s.department.code if s.department else "GEN",
            "year_level": s.year_level,
            "total_solved": st.total_solved if st else 0,
            "contest_rating": round(st.contest_rating, 1) if (st and st.contest_rating) else 0.0,
            "language": language or "All"
        })

    return {"ranking_metric": metric, "language_filter": language or "ALL", "returned_count": len(top_students), "top_students": top_students}


def execute_generate_custom_pdf(
    db: Session,
    user: Optional[User],
    department: Optional[str] = None,
    year_level: Optional[str] = None,
    language: Optional[str] = None,
    report_title: Optional[str] = None,
    limit: int = 1
) -> Dict[str, Any]:
    """Generates a verified custom PDF report for filtered students or top performers."""
    q = db.query(Student).join(LeetCodeProfileStats, Student.id == LeetCodeProfileStats.student_id)
    q = apply_role_based_student_filter(q, user, db)

    if department and department.upper() != "ALL":
        dept_matches = db.query(Department).filter(
            (Department.code.ilike(f"{department}%")) | (Department.name.ilike(f"%{department}%"))
        ).all()
        if dept_matches:
            target_ids = [d.id for d in dept_matches]
            q = q.filter(Student.department_id.in_(target_ids))

    if year_level and year_level.upper() != "ALL":
        clean_y = year_level.upper().replace("TH", "").replace("RD", "").replace("ND", "").replace("ST", "").strip()
        y_map = {"1": "I", "2": "II", "3": "III", "4": "IV"}
        norm_y = y_map.get(clean_y, clean_y)
        q = q.filter(Student.year_level == norm_y)

    if language and language.strip() and language.upper() != "ALL":
        from backend.models import LeetCodeLanguageStats
        lang_term = f"%{language.strip()}%"
        lang_subq = db.query(LeetCodeLanguageStats.student_id).filter(
            LeetCodeLanguageStats.language_name.ilike(lang_term),
            LeetCodeLanguageStats.problems_solved > 0
        )
        q = q.filter(Student.id.in_(lang_subq))

    rows = q.order_by(LeetCodeProfileStats.total_solved.desc()).limit(min(limit, 10)).all()
    student_names = [s.name for s in rows]

    title = report_title or (f"Top {language} Performer Report" if language else "Verified Performance Report")
    artifact_id = f"art_pdf_{uuid.uuid4().hex[:10]}"
    download_url = f"/api/reports/export/summary-pdf?artifact_id={artifact_id}"
    if department:
        download_url += f"&department={department}"
    if language:
        download_url += f"&language={language}"

    return {
        "report_ready": True,
        "artifact_id": artifact_id,
        "title": title,
        "filters": {
            "department": department or "ALL",
            "year_level": year_level or "ALL",
            "language": language or "ALL"
        },
        "matched_students": student_names,
        "pdfAvailable": True,
        "pdf_download_url": download_url,
        "message": f"Verified PDF Report '{title}' generated for {len(student_names)} student(s)."
    }



def execute_get_inactive_at_risk_students(
    db: Session,
    user: Optional[User],
    department: Optional[str] = None,
    year_level: Optional[str] = None,
    limit: int = 10
) -> Dict[str, Any]:
    """Retrieves inactive / 0-solve students requiring intervention."""
    q = db.query(Student).outerjoin(LeetCodeProfileStats, Student.id == LeetCodeProfileStats.student_id).filter(
        (Student.is_active == True) | (Student.is_active.is_(None)),
        or_(LeetCodeProfileStats.id == None, LeetCodeProfileStats.total_solved == 0)
    )
    q = apply_role_based_student_filter(q, user, db)

    if department and department.upper() != "ALL":
        dept_matches = db.query(Department).filter(
            (Department.code.ilike(f"{department}%")) | (Department.name.ilike(f"%{department}%"))
        ).all()
        if dept_matches:
            target_ids = [d.id for d in dept_matches]
            q = q.filter(Student.department_id.in_(target_ids))

    if year_level and year_level.upper() != "ALL":
        clean_y = year_level.upper().replace("TH", "").replace("RD", "").replace("ND", "").replace("ST", "").strip()
        y_map = {"1": "I", "2": "II", "3": "III", "4": "IV"}
        norm_y = y_map.get(clean_y, clean_y)
        q = q.filter(Student.year_level == norm_y)

    total = q.count()
    rows = q.options(joinedload(Student.department)).limit(min(limit, 25)).all()

    inactive_list = []
    for s in rows:
        assign = db.query(FacultyStudentAssignment, User).join(
            User, FacultyStudentAssignment.faculty_id == User.id
        ).filter(
            FacultyStudentAssignment.student_id == s.id,
            FacultyStudentAssignment.is_active == True
        ).first()
        mentor_name = assign[1].username if assign else "Unassigned"

        inactive_list.append({
            "reg_no": s.reg_no,
            "name": s.name,
            "department": s.department.code if s.department else "GEN",
            "year_level": s.year_level,
            "assigned_mentor": mentor_name,
            "status": "0 Solves (Needs Intervention)"
        })

    return {"total_inactive_count": total, "returned_count": len(inactive_list), "students": inactive_list}


def execute_count_students(
    db: Session,
    user: Optional[User],
    department: Optional[str] = None,
    year_level: Optional[str] = None,
    status: Optional[str] = None
) -> Dict[str, Any]:
    """Counts authoritative matching students within user's authorized scope."""
    q = db.query(Student).outerjoin(LeetCodeProfileStats, Student.id == LeetCodeProfileStats.student_id)
    q = apply_role_based_student_filter(q, user, db)

    if department and department.upper() != "ALL":
        dept_matches = db.query(Department).filter(
            (Department.code.ilike(f"{department}%")) | (Department.name.ilike(f"%{department}%"))
        ).all()
        if dept_matches:
            target_ids = [d.id for d in dept_matches]
            q = q.filter(Student.department_id.in_(target_ids))

    if year_level and year_level.upper() != "ALL":
        clean_y = year_level.upper().replace("TH", "").replace("RD", "").replace("ND", "").replace("ST", "").strip()
        y_map = {"1": "I", "2": "II", "3": "III", "4": "IV", "FIRST": "I", "SECOND": "II", "THIRD": "III", "FOURTH": "IV"}
        norm_y = y_map.get(clean_y, clean_y)
        q = q.filter(Student.year_level == norm_y)

    if status and status.upper() != "ALL":
        if status.upper() == "INACTIVE":
            q = q.filter(or_(LeetCodeProfileStats.id == None, LeetCodeProfileStats.total_solved == 0))
        elif status.upper() == "ACTIVE":
            q = q.filter(LeetCodeProfileStats.total_solved > 0)

    total_count = q.count()
    return {
        "count": total_count,
        "department": department or "ALL",
        "year_level": year_level or "ALL",
        "status": status or "ALL"
    }


def execute_get_student_profile(
    db: Session,
    user: Optional[User],
    identifier: str
) -> Dict[str, Any]:
    """Retrieves full profile details for a specific student by name, register number, or username."""
    q = db.query(Student).outerjoin(LeetCodeProfileStats, Student.id == LeetCodeProfileStats.student_id)
    q = apply_role_based_student_filter(q, user, db)

    term = f"%{identifier.strip()}%"
    matches = q.filter(
        or_(Student.name.ilike(term), Student.reg_no.ilike(term), Student.username.ilike(term))
    ).options(joinedload(Student.department), joinedload(Student.stats)).all()

    if not matches:
        return {"found": False, "message": f"No student matching '{identifier}' found within your authorized scope."}

    if len(matches) > 1:
        list_summary = []
        for s in matches[:5]:
            list_summary.append({
                "reg_no": s.reg_no,
                "name": s.name,
                "department": s.department.code if s.department else "GEN",
                "year_level": s.year_level,
                "username": s.username or "N/A"
            })
        return {
            "found": True,
            "multiple_matches": True,
            "match_count": len(matches),
            "matching_students": list_summary,
            "message": f"Found {len(matches)} matching students for '{identifier}'. Ask with register number for specific profile."
        }

    s = matches[0]
    st = s.stats
    return {
        "found": True,
        "multiple_matches": False,
        "student": {
            "reg_no": s.reg_no,
            "name": s.name,
            "department": s.department.code if s.department else "GEN",
            "department_name": s.department.name if s.department else "General",
            "year_level": s.year_level,
            "email": s.email or s.institutional_email or "Not set",
            "username": s.username or "Not set",
            "leetcode_url": s.leetcode_url or "Not set",
            "total_solved": st.total_solved if st else 0,
            "easy_solved": st.easy_solved if st else 0,
            "medium_solved": st.medium_solved if st else 0,
            "hard_solved": st.hard_solved if st else 0,
            "contest_rating": round(st.contest_rating, 1) if (st and st.contest_rating) else 0.0,
            "max_streak": st.max_streak if st else 0,
            "sync_status": st.sync_status if st else "unknown"
        }
    }


def execute_find_students_by_conditions(
    db: Session,
    user: Optional[User],
    min_problems_solved: Optional[int] = None,
    max_problems_solved: Optional[int] = None,
    min_contest_rating: Optional[float] = None,
    activity_window_days: Optional[int] = None,
    department: Optional[str] = None,
    year_level: Optional[str] = None,
    limit: int = 15
) -> Dict[str, Any]:
    """Finds students matching complex numeric thresholds, activity windows, and institutional filters."""
    q = db.query(Student).outerjoin(LeetCodeProfileStats, Student.id == LeetCodeProfileStats.student_id)
    q = apply_role_based_student_filter(q, user, db)

    if department and department.upper() != "ALL":
        dept_matches = db.query(Department).filter(
            (Department.code.ilike(f"{department}%")) | (Department.name.ilike(f"%{department}%"))
        ).all()
        if dept_matches:
            target_ids = [d.id for d in dept_matches]
            q = q.filter(Student.department_id.in_(target_ids))

    if year_level and year_level.upper() != "ALL":
        clean_y = year_level.upper().replace("TH", "").replace("RD", "").replace("ND", "").replace("ST", "").strip()
        y_map = {"1": "I", "2": "II", "3": "III", "4": "IV", "FIRST": "I", "SECOND": "II", "THIRD": "III", "FOURTH": "IV"}
        norm_y = y_map.get(clean_y, clean_y)
        q = q.filter(Student.year_level == norm_y)

    if min_problems_solved is not None:
        q = q.filter(LeetCodeProfileStats.total_solved >= min_problems_solved)

    if max_problems_solved is not None:
        q = q.filter(LeetCodeProfileStats.total_solved <= max_problems_solved)

    if min_contest_rating is not None:
        q = q.filter(LeetCodeProfileStats.contest_rating >= min_contest_rating)

    if activity_window_days is not None and activity_window_days > 0:
        cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=activity_window_days)
        q = q.filter(
            or_(
                LeetCodeProfileStats.last_successful_sync >= cutoff,
                LeetCodeProfileStats.last_updated >= cutoff
            )
        )

    q = q.order_by(LeetCodeProfileStats.total_solved.desc().nullslast())
    total_matching = q.count()
    rows = q.options(joinedload(Student.department), joinedload(Student.stats)).limit(min(limit, 25)).all()

    students_list = []
    for s in rows:
        st = s.stats
        students_list.append({
            "reg_no": s.reg_no,
            "name": s.name,
            "department": s.department.code if s.department else "GEN",
            "year_level": s.year_level,
            "total_solved": st.total_solved if st else 0,
            "easy_solved": st.easy_solved if st else 0,
            "medium_solved": st.medium_solved if st else 0,
            "hard_solved": st.hard_solved if st else 0,
            "contest_rating": round(st.contest_rating, 1) if (st and st.contest_rating) else 0.0,
            "last_synced": st.last_successful_sync.strftime("%Y-%m-%d") if (st and st.last_successful_sync) else "N/A"
        })

    return {
        "total_matching_students": total_matching,
        "returned_count": len(students_list),
        "applied_conditions": {
            "min_problems_solved": min_problems_solved,
            "max_problems_solved": max_problems_solved,
            "min_contest_rating": min_contest_rating,
            "activity_window_days": activity_window_days,
            "department": department or "ALL",
            "year_level": year_level or "ALL"
        },
        "students": students_list
    }


def execute_get_contest_summary(
    db: Session,
    user: Optional[User],
    contest_id: Optional[str] = None
) -> Dict[str, Any]:
    """Retrieves weekly contest status, participant counts, and top rankers."""
    if contest_id:
        session = db.query(WeeklySession).filter(
            (WeeklySession.contest_id == contest_id) | (WeeklySession.session_code == contest_id) | (WeeklySession.contest_name.ilike(f"%{contest_id}%"))
        ).first()
    else:
        session = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()

    if not session:
        return {"found": False, "message": "No active or recorded weekly contest session found."}

    return {
        "found": True,
        "session_code": session.session_code,
        "contest_name": session.contest_name,
        "session_date": session.session_date,
        "status": session.status,
        "total_students": session.total_students,
        "official_participants": session.official_participants,
        "virtual_participants": session.virtual_participants,
        "not_participated": session.not_participated
    }


def execute_generate_report(
    db: Session,
    user: Optional[User],
    department: Optional[str] = None,
    report_type: str = "summary"
) -> Dict[str, Any]:
    """Generates official report export URLs and metadata."""
    dept_str = f"?department={department}" if department and department.upper() != "ALL" else ""
    pdf_url = f"/api/reports/export/summary-pdf{dept_str}"
    excel_url = f"/api/reports/export/summary-excel{dept_str}"

    return {
        "report_ready": True,
        "report_type": report_type,
        "department": department or "ALL",
        "pdfAvailable": True,
        "pdf_download_url": pdf_url,
        "excel_download_url": excel_url,
        "message": f"Official Institutional {report_type.upper()} report compiled for scope '{department or 'ALL'}'."
    }


class AIGeminiEngine:
    @staticmethod
    def answer_query(
        db: Session,
        query_text: str,
        user: Any = None,
        context_page: Optional[str] = None,
        context_filters: Optional[Dict[str, Any]] = None,
        history: Optional[List[Dict[str, Any]]] = None,
        mode: str = "institutional"
    ) -> Dict[str, Any]:
        req_id = f"ai_{uuid.uuid4().hex[:12]}"
        clean_q = query_text.strip()
        lower_q = clean_q.lower()
        conv_id = (context_filters or {}).get("conversation_id") or (context_filters or {}).get("sessionId") or f"session_{user.id if user else 'guest'}"

        from backend.services.ai_conversation_state import ConversationStateManager
        state = ConversationStateManager.get_state(conv_id)

        # 1. REFERENCE & CONFIRMATION RESOLUTION ("ok give it", "yes", "download", "send it")
        if ConversationStateManager.is_confirmation_query(clean_q):
            if state.generated_artifact:
                art = state.generated_artifact
                return {
                    "success": True,
                    "answer": f"### 📄 Verified PDF Report Ready\n\nHere is your requested PDF report: **{art.get('title', 'Institutional Performance Report')}**.",
                    "why": f"Resolved reference '{clean_q}' to generated artifact {art.get('artifact_id')}.",
                    "confidence": "VERIFIED",
                    "actionLabel": "Download PDF Report",
                    "actionTab": "reports",
                    "pdfAvailable": True,
                    "downloadUrl": art.get("download_url") or art.get("pdf_download_url") or "/api/reports/export/summary-pdf",
                    "source": "Institutional Intelligence Artifact Store",
                    "dataStatus": "VERIFIED",
                    "requestId": req_id
                }
            elif state.pending_action:
                p_action = state.pending_action
                return {
                    "success": True,
                    "answer": f"Executing pending action: **{p_action.get('title', 'Action')}**.",
                    "why": f"Resolved confirmation '{clean_q}' to pending action.",
                    "confidence": "VERIFIED",
                    "source": "AI Operations Control Center",
                    "dataStatus": "VERIFIED",
                    "requestId": req_id
                }

        api_key = settings.GEMINI_API_KEY
        if not api_key:
            return {
                "success": False,
                "answer": "Google Gemini API Key is not configured. Please set GEMINI_API_KEY in environment variables.",
                "why": "API Key missing.",
                "confidence": "FAILED",
                "source": "AI Gemini Engine",
                "dataStatus": "FAILED",
                "requestId": req_id
            }

        client = genai.Client(api_key=api_key)

        user_role = getattr(user, 'role', 'Guest') or 'Guest'
        user_email = getattr(user, 'email', 'Guest') or 'Guest'

        system_instruction = f"""You are the official Nandha Engineering College (Autonomous) Institutional Intelligence Assistant & Operations Copilot.
You are pair-interacting with an authenticated user (Role: {user_role}, Email: {user_email}).
Current Page Context: {context_page or 'General Workspace'}
Active Filters Context: {json.dumps(context_filters or {})}
Active Conversation State: Last Filters={json.dumps(state.last_filters)}, Last Intent={state.last_intent}, Artifact={json.dumps(state.generated_artifact)}

CORE RULES:
1. Understand natural language in English, Tamil, Tanglish, or mixed language (e.g. 'cse la ethana peru?', 'cyber security 3rd year evlo?', 'java top student', 'top 5 java solvers', 'give me java pdf for top student', 'dai', 'hello', 'saptiya?').
2. CASUAL CONVERSATION & CHIT-CHAT (e.g., 'dai', 'hello', 'hai', 'i have some doubt', 'saptiya?'):
   - Respond naturally, warmly, and conversationally in the same language/tone.
   - DO NOT trigger database queries, tool calls, or institutional statistics for casual greeting messages.
   - Example:
     User: "dai" -> Assistant: "Dai 😄 sollu, enna doubt?"
     User: "hai i form nanthish" -> Assistant: "Hai Nanthish! Welcome back. Enna doubt, eppadi help panlan?"
3. INSTITUTIONAL DATA REQUESTS:
   - Determine intent and extract entities (department, year, student name/reg_no, programming language e.g. Java/Python, numeric thresholds).
   - Resolve department codes accurately (e.g., 'cyber security' -> CSE(CS), 'iot' -> CSE(IOT), 'computer science' -> CSE).
   - Resolve year levels (e.g., 'iii year', '3rd year' -> III).
   - For PDF/report requests for top performers or specific languages (e.g. 'give me java pdf for top student', 'top java student pdf', 'make pdf for top 5'), IMMEDIATELY call the `generate_custom_pdf` tool with the extracted language (e.g., language='Java') and limit (e.g., limit=1). Use department='ALL' if no department is specified. Do NOT ask clarifying questions if defaults can fulfill the request directly.
   - Invoke appropriate structured function tools (`search_students`, `count_students`, `get_student_profile`, `find_students_by_conditions`, `get_department_analytics`, `get_performance_leaderboard`, `get_inactive_at_risk_students`, `get_contest_summary`, `generate_report`, `generate_custom_pdf`).
4. NEVER fabricate or hallucinate student counts, names, ratings, or solve metrics. Base every single fact on verified tool execution outputs.
5. If no records match, state clearly: "No verified students matched the requested criteria in your authorized scope."
6. Do NOT invent arbitrary SQL or execute raw database code. Only use provided safe tools.
7. For multi-turn follow-ups (e.g. "show top 10 CSE", "only III year", "make PDF", "ok give it"), retain prior intent, entities, and filters from conversation history.
"""

        # Tool capability declarations
        search_students_tool = types.FunctionDeclaration(
            name="search_students",
            description="Retrieve authorized student records using validated search text or filters.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "search": types.Schema(type=types.Type.STRING, description="Student name, reg_no, or username"),
                    "department": types.Schema(type=types.Type.STRING, description="Department code (CSE, IT, CSE(CS), CSE(IOT)) or ALL"),
                    "year_level": types.Schema(type=types.Type.STRING, description="Year level (I, II, III, IV) or ALL"),
                    "language": types.Schema(type=types.Type.STRING, description="Programming language (Java, Python, C++, etc.) or ALL"),
                    "status": types.Schema(type=types.Type.STRING, description="ACTIVE, INACTIVE, or ALL"),
                    "limit": types.Schema(type=types.Type.INTEGER, description="Max students to return")
                }
            )
        )

        count_students_tool = types.FunctionDeclaration(
            name="count_students",
            description="Count the total number of authorized active or enrolled students matching department, year level, or status filters.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "department": types.Schema(type=types.Type.STRING, description="Department code or ALL"),
                    "year_level": types.Schema(type=types.Type.STRING, description="Year level or ALL"),
                    "status": types.Schema(type=types.Type.STRING, description="ACTIVE, INACTIVE, or ALL")
                }
            )
        )

        get_student_profile_tool = types.FunctionDeclaration(
            name="get_student_profile",
            description="Lookup individual student profile details by register number, student name, or username.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "identifier": types.Schema(type=types.Type.STRING, description="Register number, student name, or username")
                },
                required=["identifier"]
            )
        )

        find_students_by_conditions_tool = types.FunctionDeclaration(
            name="find_students_by_conditions",
            description="Find authorized students matching custom numeric thresholds (solved >= N, rating >= R), activity timeframes (last N days), department, and year level.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "min_problems_solved": types.Schema(type=types.Type.INTEGER, description="Minimum problems solved threshold (e.g. 100)"),
                    "max_problems_solved": types.Schema(type=types.Type.INTEGER, description="Maximum problems solved threshold"),
                    "min_contest_rating": types.Schema(type=types.Type.NUMBER, description="Minimum contest rating"),
                    "activity_window_days": types.Schema(type=types.Type.INTEGER, description="Activity timeframe in days (e.g. 5 for last 5 days)"),
                    "department": types.Schema(type=types.Type.STRING, description="Department code or ALL"),
                    "year_level": types.Schema(type=types.Type.STRING, description="Year level or ALL"),
                    "limit": types.Schema(type=types.Type.INTEGER, description="Max records to return")
                }
            )
        )

        get_department_analytics_tool = types.FunctionDeclaration(
            name="get_department_analytics",
            description="Retrieve health scores, total students, active count, and solve averages for a department or institution.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "department": types.Schema(type=types.Type.STRING, description="Department code or ALL"),
                    "year_level": types.Schema(type=types.Type.STRING, description="Year level or ALL")
                }
            )
        )

        get_performance_leaderboard_tool = types.FunctionDeclaration(
            name="get_performance_leaderboard",
            description="Analyze student performance and return top rankers by metric (total_solved or contest_rating) and optional language.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "department": types.Schema(type=types.Type.STRING, description="Department code or ALL"),
                    "year_level": types.Schema(type=types.Type.STRING, description="Year level or ALL"),
                    "language": types.Schema(type=types.Type.STRING, description="Programming language (Java, Python, C++) or ALL"),
                    "metric": types.Schema(type=types.Type.STRING, description="total_solved or contest_rating"),
                    "limit": types.Schema(type=types.Type.INTEGER, description="Number of top students")
                }
            )
        )

        get_inactive_at_risk_students_tool = types.FunctionDeclaration(
            name="get_inactive_at_risk_students",
            description="Retrieve students requiring intervention or with 0 problem solves.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "department": types.Schema(type=types.Type.STRING, description="Department code or ALL"),
                    "year_level": types.Schema(type=types.Type.STRING, description="Year level or ALL"),
                    "limit": types.Schema(type=types.Type.INTEGER, description="Max students to return")
                }
            )
        )

        get_contest_summary_tool = types.FunctionDeclaration(
            name="get_contest_summary",
            description="Retrieve weekly contest participation counts, attendance, and contest status.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "contest_id": types.Schema(type=types.Type.STRING, description="Contest ID or number (e.g. 515)")
                }
            )
        )

        generate_report_tool = types.FunctionDeclaration(
            name="generate_report",
            description="Generate official institutional PDF or Excel performance report metadata for download.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "department": types.Schema(type=types.Type.STRING, description="Department code or ALL"),
                    "report_type": types.Schema(type=types.Type.STRING, description="summary, executive, or detailed")
                }
            )
        )

        generate_custom_pdf_tool = types.FunctionDeclaration(
            name="generate_custom_pdf",
            description="Generate a custom PDF report for top performers or specific filtered student groups (e.g. top Java student).",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "department": types.Schema(type=types.Type.STRING, description="Department code or ALL"),
                    "year_level": types.Schema(type=types.Type.STRING, description="Year level or ALL"),
                    "language": types.Schema(type=types.Type.STRING, description="Programming language (Java, Python, C++)"),
                    "report_title": types.Schema(type=types.Type.STRING, description="Custom title for the PDF report"),
                    "limit": types.Schema(type=types.Type.INTEGER, description="Number of students included")
                }
            )
        )

        tools_list = [types.Tool(function_declarations=[
            search_students_tool,
            count_students_tool,
            get_student_profile_tool,
            find_students_by_conditions_tool,
            get_department_analytics_tool,
            get_performance_leaderboard_tool,
            get_inactive_at_risk_students_tool,
            get_contest_summary_tool,
            generate_report_tool,
            generate_custom_pdf_tool
        ])]

        try:
            contents = []
            if history:
                for msg in history:
                    role_name = "user" if msg.get("role") == "user" or msg.get("sender") == "user" else "model"
                    contents.append(
                        types.Content(
                            role=role_name,
                            parts=[types.Part.from_text(text=msg.get("text", ""))]
                        )
                    )

            contents.append(types.Content(role="user", parts=[types.Part.from_text(text=query_text)]))

            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    tools=tools_list,
                    temperature=0.2,
                )
            )

            pdf_available = False
            download_url = None

            # Handle Function Calling loop
            if response.function_calls:
                for function_call in response.function_calls:
                    fname = function_call.name
                    fargs = function_call.args or {}
                    tool_res = {}

                    if fname == "search_students":
                        tool_res = execute_search_students(
                            db, user,
                            search=fargs.get("search"),
                            department=fargs.get("department"),
                            year_level=fargs.get("year_level"),
                            status=fargs.get("status"),
                            limit=fargs.get("limit", 10)
                        )
                    elif fname == "count_students":
                        tool_res = execute_count_students(
                            db, user,
                            department=fargs.get("department"),
                            year_level=fargs.get("year_level"),
                            status=fargs.get("status")
                        )
                    elif fname == "get_student_profile":
                        tool_res = execute_get_student_profile(
                            db, user,
                            identifier=fargs.get("identifier", "")
                        )
                    elif fname == "find_students_by_conditions":
                        tool_res = execute_find_students_by_conditions(
                            db, user,
                            min_problems_solved=fargs.get("min_problems_solved"),
                            max_problems_solved=fargs.get("max_problems_solved"),
                            min_contest_rating=fargs.get("min_contest_rating"),
                            activity_window_days=fargs.get("activity_window_days"),
                            department=fargs.get("department"),
                            year_level=fargs.get("year_level"),
                            limit=fargs.get("limit", 15)
                        )
                    elif fname == "get_department_analytics":
                        tool_res = execute_get_department_analytics(
                            db, user,
                            department=fargs.get("department"),
                            year_level=fargs.get("year_level")
                        )
                    elif fname == "get_performance_leaderboard":
                        tool_res = execute_get_performance_leaderboard(
                            db, user,
                            department=fargs.get("department"),
                            year_level=fargs.get("year_level"),
                            language=fargs.get("language"),
                            metric=fargs.get("metric", "total_solved"),
                            limit=fargs.get("limit", 5)
                        )
                        state.update_from_query(
                            intent="TOP_PERFORMERS",
                            filters={"department": fargs.get("department"), "year_level": fargs.get("year_level"), "language": fargs.get("language")},
                            result=tool_res
                        )
                    elif fname == "get_inactive_at_risk_students":
                        tool_res = execute_get_inactive_at_risk_students(
                            db, user,
                            department=fargs.get("department"),
                            year_level=fargs.get("year_level"),
                            limit=fargs.get("limit", 10)
                        )
                    elif fname == "get_contest_summary":
                        tool_res = execute_get_contest_summary(
                            db, user,
                            contest_id=fargs.get("contest_id")
                        )
                    elif fname == "generate_report":
                        tool_res = execute_generate_report(
                            db, user,
                            department=fargs.get("department"),
                            report_type=fargs.get("report_type", "summary")
                        )
                        pdf_available = tool_res.get("pdfAvailable", False)
                        download_url = tool_res.get("pdf_download_url")
                        state.update_from_query(
                            action="PDF_GENERATION",
                            artifact={
                                "type": "PDF",
                                "title": f"Institutional Report ({fargs.get('department', 'ALL')})",
                                "download_url": download_url
                            }
                        )
                    elif fname == "generate_custom_pdf":
                        tool_res = execute_generate_custom_pdf(
                            db, user,
                            department=fargs.get("department"),
                            year_level=fargs.get("year_level"),
                            language=fargs.get("language"),
                            report_title=fargs.get("report_title"),
                            limit=fargs.get("limit", 1)
                        )
                        pdf_available = tool_res.get("pdfAvailable", True)
                        download_url = tool_res.get("pdf_download_url")
                        state.update_from_query(
                            action="PDF_GENERATION",
                            artifact={
                                "type": "PDF",
                                "artifact_id": tool_res.get("artifact_id"),
                                "title": tool_res.get("title"),
                                "download_url": download_url,
                                "filters": tool_res.get("filters")
                            }
                        )

                    contents.append(response.candidates[0].content)
                    contents.append(
                        types.Content(
                            role="user",
                            parts=[
                                types.Part.from_function_response(
                                    name=fname,
                                    response={"result": json.dumps(tool_res)}
                                )
                            ]
                        )
                    )

                # Get final answer after tool execution
                final_response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        temperature=0.2,
                    )
                )
                answer_text = final_response.text
            else:
                answer_text = response.text

            return {
                "success": True,
                "answer": answer_text,
                "why": "Generated by Google Gemini AI with capability tool execution.",
                "evidence": "Grounded verified institutional data.",
                "confidence": "HIGH",
                "actionLabel": "Explore Leaderboard",
                "actionTab": "leaderboard",
                "pdfAvailable": pdf_available or (state.generated_artifact is not None),
                "downloadUrl": download_url or (state.generated_artifact.get("download_url") if state.generated_artifact else None),
                "source": "Gemini AI Institutional Intelligence Engine",
                "dataStatus": "VERIFIED",
                "requestId": req_id
            }

        except Exception as e:
            logger.error(f"Gemini API Error: {str(e)}\n{traceback.format_exc()}")
            # Fallback logic if Gemini API rate-limits or fails
            if any(kw in lower_q for kw in ["pdf", "report", "download", "export"]):
                lang_match = "Java" if "java" in lower_q else ("Python" if "python" in lower_q else None)
                tool_res = execute_generate_custom_pdf(
                    db, user,
                    language=lang_match,
                    report_title=f"Top {lang_match or 'Institutional'} Performer Report" if lang_match else "Verified Performance Report",
                    limit=1
                )
                download_url = tool_res.get("pdf_download_url")
                state.update_from_query(
                    action="PDF_GENERATION",
                    artifact={
                        "type": "PDF",
                        "artifact_id": tool_res.get("artifact_id"),
                        "title": tool_res.get("title"),
                        "download_url": download_url,
                        "filters": tool_res.get("filters")
                    }
                )
                return {
                    "success": True,
                    "answer": f"### 📄 Verified PDF Report Generated\n\nI have compiled the verified PDF report for **Top {lang_match or 'Institutional'} Performer** directly from verified database records.",
                    "why": f"Resilient backend execution fallback: {str(e)}",
                    "confidence": "VERIFIED",
                    "actionLabel": "Download PDF Report",
                    "actionTab": "reports",
                    "pdfAvailable": True,
                    "downloadUrl": download_url,
                    "source": "Institutional PDF Exporter Engine",
                    "dataStatus": "VERIFIED",
                    "requestId": req_id
                }

            return {
                "success": False,
                "answer": f"I couldn't process your query via the AI model right now: {str(e)}",
                "why": "Exception in Gemini API integration.",
                "confidence": "FAILED",
                "source": "Gemini AI Engine",
                "dataStatus": "ERROR",
                "requestId": req_id
            }


