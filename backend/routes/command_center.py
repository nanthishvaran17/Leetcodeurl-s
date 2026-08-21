"""
command_center.py
===========================================================
Real-Time CRUD Engine & Institutional Analytics API.
Endpoints:
  GET  /api/command-center/summary
  GET  /api/command-center/students
  POST /api/command-center/students/add
  PUT  /api/command-center/students/{reg_no}
  DELETE /api/command-center/students/{reg_no}
  GET  /api/command-center/departments
  GET  /api/command-center/year-matrix
  POST /api/command-center/ai-query
"""

import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_
from pydantic import BaseModel, Field

from backend.database import get_db
from backend.models import (
    Student, Department, Section, LeetCodeProfileStats, AdminAuditLog,
    WeeklyPublicResult, WeeklySession
)
from backend.logger import logger

router = APIRouter(prefix="/command-center", tags=["Command Center CRUD & Analytics"])


# ── Pydantic Schemas ──────────────────────────────────────────────────────────

class StudentAddRequest(BaseModel):
    reg_no: str = Field(..., min_length=4, max_length=30)
    name: str = Field(..., min_length=2, max_length=150)
    department_id: int
    year_level: str = Field(..., pattern=r"^(II|III|IV)$")
    leetcode_username: str = Field(..., min_length=2, max_length=80)
    email: Optional[str] = None
    section_id: Optional[int] = None

class StudentUpdateRequest(BaseModel):
    name: Optional[str] = None
    department_id: Optional[int] = None
    year_level: Optional[str] = None
    leetcode_username: Optional[str] = None
    email: Optional[str] = None
    section_id: Optional[int] = None

class AIQueryRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=500)


# ── Helpers ───────────────────────────────────────────────────────────────────

EXCLUDE_DEPT_CODES = {"CSE_TEST", "CSE_AI_TEST", "TEST"}

def _real_dept_ids(db: Session) -> List[int]:
    all_depts = db.query(Department).all()
    return [
        d.id for d in all_depts
        if d.code and "TEST" not in d.code.upper()
    ]


def _log_admin_action(db: Session, action: str, target_id: str, description: str, status: str = "SUCCESS"):
    try:
        audit = AdminAuditLog(
            audit_id=f"CC-{datetime.datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{target_id[:6]}",
            admin_name="Faculty / System",
            admin_email="system@nandhaengg.org",
            admin_role="admin",
            action=action,
            action_type="CRUD",
            target_type="STUDENT",
            target_id=str(target_id),
            description=description,
            status=status,
            created_at=datetime.datetime.utcnow()
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        logger.warning(f"[COMMAND_CENTER] Audit log write failed: {e}")


async def _validate_leetcode_username(username: str) -> bool:
    """Validate LeetCode username via public API (non-blocking)."""
    try:
        import httpx
        url = "https://leetcode.com/graphql"
        query = """query getUserProfile($username: String!) {
          matchedUser(username: $username) { username }
        }"""
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(url, json={"query": query, "variables": {"username": username}},
                                     headers={"Content-Type": "application/json"})
            if resp.status_code == 200:
                data = resp.json()
                matched = data.get("data", {}).get("matchedUser")
                return matched is not None
    except Exception as e:
        logger.warning(f"[COMMAND_CENTER] LeetCode username validation skipped: {e}")
    return True  # Fail open — don't block add if LeetCode API is unreachable


# ── 1. LIVE SUMMARY ANALYTICS ────────────────────────────────────────────────

@router.get("/summary")
def get_command_center_summary(dept_id: Optional[int] = None, db: Session = Depends(get_db)):
    """
    Returns 100% live database-computed Department Coding Health Score,
    KPI counts, 5-dimension breakdown, and executive summary.
    """
    from backend.services.hod_analytics_engine import (
        calculate_department_health_score,
        get_hod_what_is_happening_summary,
        get_institutional_benchmarks,
        calculate_year_matrix
    )
    health  = calculate_department_health_score(db, dept_id=dept_id)
    summary = get_hod_what_is_happening_summary(db, dept_id=dept_id)
    benchmarks = get_institutional_benchmarks(db)

    return {
        "department_health": health,
        "executive_summary": summary,
        "benchmarks":        benchmarks,
        "refreshed_at":      datetime.datetime.utcnow().strftime("%d %b %Y, %H:%M:%S UTC"),
    }


# ── 2. STUDENT LIST (Read / Search) ──────────────────────────────────────────

@router.get("/students")
def get_students(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    dept_id: Optional[int] = None,
    year_level: Optional[str] = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db)
):
    """
    Returns paginated student list with live LeetCode stats.
    Excludes test stubs by default.
    """
    real_ids = _real_dept_ids(db)
    q = db.query(Student).filter(Student.department_id.in_(real_ids))
    if not include_inactive:
        q = q.filter(Student.is_active == True)
    if dept_id:
        q = q.filter(Student.department_id == dept_id)
    if year_level:
        q = q.filter(Student.year_level == year_level)
    if search and search.strip():
        term = f"%{search.strip()}%"
        q = q.filter(or_(
            Student.name.ilike(term),
            Student.reg_no.ilike(term),
            Student.username.ilike(term),
            Student.email.ilike(term),
        ))

    total = q.count()
    students = q.order_by(Student.name).offset((page - 1) * page_size).limit(page_size).all()

    results = []
    for s in students:
        stats = db.query(LeetCodeProfileStats).filter(LeetCodeProfileStats.student_id == s.id).first()
        results.append({
            "id":                s.id,
            "reg_no":            s.reg_no,
            "name":              s.name,
            "year_level":        s.year_level,
            "department_id":     s.department_id,
            "department_name":   s.department.name if s.department else "",
            "department_code":   s.department.code if s.department else "",
            "leetcode_username": s.username or "",
            "email":             s.email or "",
            "is_active":         s.is_active,
            "total_solved":      stats.total_solved if stats else 0,
            "contest_rating":    int(stats.contest_rating) if (stats and stats.contest_rating) else 0,
            "easy_solved":       stats.easy_solved if stats else 0,
            "medium_solved":     stats.medium_solved if stats else 0,
            "hard_solved":       stats.hard_solved if stats else 0,
            "last_updated":      stats.last_updated.strftime("%d %b %Y") if (stats and stats.last_updated) else "—",
        })

    return {
        "total":     total,
        "page":      page,
        "page_size": page_size,
        "students":  results,
    }


# ── 3. ADD STUDENT ────────────────────────────────────────────────────────────

@router.post("/students/add")
async def add_student(req: StudentAddRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Adds a new student to the tracking roster.
    - Validates: reg_no uniqueness, department existence, LeetCode username
    - Inserts into students table and creates blank stats row
    """
    # Validate department
    dept = db.query(Department).filter(Department.id == req.department_id).first()
    if not dept:
        raise HTTPException(status_code=400, detail=f"Department ID {req.department_id} not found.")

    # Check duplicate reg_no
    existing = db.query(Student).filter(Student.reg_no == req.reg_no.strip()).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Student with reg_no '{req.reg_no}' already exists.")

    # Check duplicate username
    existing_user = db.query(Student).filter(Student.username == req.leetcode_username.strip()).first()
    if existing_user:
        raise HTTPException(status_code=409, detail=f"LeetCode username '{req.leetcode_username}' is already tracked.")

    # Validate LeetCode username (async, non-blocking)
    is_valid = await _validate_leetcode_username(req.leetcode_username.strip())
    if not is_valid:
        raise HTTPException(status_code=422, detail=f"LeetCode username '{req.leetcode_username}' not found on LeetCode.com.")

    # Insert student
    now = datetime.datetime.utcnow()
    student = Student(
        reg_no=req.reg_no.strip().upper(),
        name=req.name.strip().title(),
        department_id=req.department_id,
        year_level=req.year_level,
        section_id=req.section_id,
        email=req.email.strip() if req.email else None,
        username=req.leetcode_username.strip().lower(),
        leetcode_url=f"https://leetcode.com/{req.leetcode_username.strip().lower()}/",
        is_active=True,
        created_at=now,
        joining_date=now.date().isoformat() if hasattr(now, 'date') else None,
    )
    db.add(student)
    db.flush()  # Get student.id

    # Create blank stats row
    blank_stats = LeetCodeProfileStats(
        student_id=student.id,
        total_solved=0,
        easy_solved=0,
        medium_solved=0,
        hard_solved=0,
        contest_rating=0.0,
        sync_status="PENDING",
        last_updated=now,
    )
    db.add(blank_stats)
    db.commit()

    _log_admin_action(db, "ADD_STUDENT", req.reg_no, f"Added student {req.name} ({req.reg_no}) to {dept.name} {req.year_level}.")

    logger.info(f"[COMMAND_CENTER] Student added: {req.name} ({req.reg_no}) → {dept.code} {req.year_level}")

    return {
        "success":    True,
        "student_id": student.id,
        "reg_no":     student.reg_no,
        "message":    f"Student '{student.name}' added successfully. LeetCode sync will run in the next scheduled job.",
    }


# ── 4. UPDATE STUDENT ─────────────────────────────────────────────────────────

@router.put("/students/{reg_no}")
def update_student(reg_no: str, req: StudentUpdateRequest, db: Session = Depends(get_db)):
    """
    Updates student metadata. Supports partial updates.
    If leetcode_username changes, marks stats for re-sync.
    """
    student = db.query(Student).filter(Student.reg_no == reg_no.strip().upper()).first()
    if not student:
        student = db.query(Student).filter(Student.reg_no == reg_no.strip()).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{reg_no}' not found.")

    changed_fields = []

    if req.name and req.name.strip() != student.name:
        student.name = req.name.strip().title()
        changed_fields.append("name")

    if req.department_id and req.department_id != student.department_id:
        dept = db.query(Department).filter(Department.id == req.department_id).first()
        if not dept:
            raise HTTPException(status_code=400, detail=f"Department ID {req.department_id} not found.")
        student.department_id = req.department_id
        changed_fields.append("department")

    if req.year_level and req.year_level != student.year_level:
        student.year_level = req.year_level
        changed_fields.append("year_level")

    if req.email is not None:
        student.email = req.email.strip() if req.email else None
        changed_fields.append("email")

    if req.section_id is not None:
        student.section_id = req.section_id
        changed_fields.append("section_id")

    username_changed = False
    if req.leetcode_username and req.leetcode_username.strip().lower() != (student.username or ""):
        # Check duplicate
        existing = db.query(Student).filter(
            Student.username == req.leetcode_username.strip().lower(),
            Student.id != student.id
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail=f"LeetCode username '{req.leetcode_username}' is already tracked by another student.")
        student.username = req.leetcode_username.strip().lower()
        student.leetcode_url = f"https://leetcode.com/{student.username}/"
        changed_fields.append("leetcode_username")
        username_changed = True

    if not changed_fields:
        return {"success": True, "message": "No changes detected.", "changed_fields": []}

    db.commit()

    if username_changed:
        # Reset stats for re-sync
        stats = db.query(LeetCodeProfileStats).filter(LeetCodeProfileStats.student_id == student.id).first()
        if stats:
            stats.sync_status = "PENDING"
            stats.last_updated = datetime.datetime.utcnow()
            db.commit()

    _log_admin_action(db, "UPDATE_STUDENT", student.reg_no,
                      f"Updated student {student.name} ({student.reg_no}): {', '.join(changed_fields)}")

    logger.info(f"[COMMAND_CENTER] Student updated: {student.reg_no} → {changed_fields}")
    return {
        "success":        True,
        "reg_no":         student.reg_no,
        "message":        f"Student updated successfully.",
        "changed_fields": changed_fields,
        "resync_pending": username_changed,
    }


# ── 5. SOFT-DELETE STUDENT ────────────────────────────────────────────────────

@router.delete("/students/{reg_no}")
def delete_student(reg_no: str, db: Session = Depends(get_db)):
    """
    Soft-deletes a student by setting is_active=False.
    Historical contest evidence is preserved. Audit log is created.
    """
    student = db.query(Student).filter(Student.reg_no == reg_no.strip().upper()).first()
    if not student:
        student = db.query(Student).filter(Student.reg_no == reg_no.strip()).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{reg_no}' not found.")

    if not student.is_active:
        return {"success": True, "message": f"Student '{student.name}' was already deactivated."}

    student.is_active = False
    db.commit()

    _log_admin_action(db, "DEACTIVATE_STUDENT", student.reg_no,
                      f"Soft-deleted student {student.name} ({student.reg_no}). Historical data preserved.")

    logger.info(f"[COMMAND_CENTER] Student deactivated: {student.reg_no} ({student.name})")
    return {
        "success": True,
        "reg_no":  student.reg_no,
        "name":    student.name,
        "message": f"Student '{student.name}' deactivated. Historical contest data is preserved.",
    }


# ── 6. REACTIVATE STUDENT ────────────────────────────────────────────────────

@router.post("/students/{reg_no}/reactivate")
def reactivate_student(reg_no: str, db: Session = Depends(get_db)):
    """Re-activates a previously soft-deleted student."""
    student = db.query(Student).filter(
        or_(Student.reg_no == reg_no.strip().upper(), Student.reg_no == reg_no.strip())
    ).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{reg_no}' not found.")

    student.is_active = True
    db.commit()
    _log_admin_action(db, "REACTIVATE_STUDENT", student.reg_no,
                      f"Reactivated student {student.name} ({student.reg_no}).")
    return {"success": True, "reg_no": student.reg_no, "message": f"Student '{student.name}' reactivated."}


# ── 7. DEPARTMENTS LIST ───────────────────────────────────────────────────────

@router.get("/departments")
def get_departments(db: Session = Depends(get_db)):
    """Returns all departments with live student counts (excludes test stubs)."""
    depts = db.query(Department).all()
    result = []
    for d in depts:
        if d.code and "TEST" in d.code.upper():
            continue
        count = db.query(Student).filter(Student.department_id == d.id, Student.is_active == True).count()
        result.append({
            "id":    d.id,
            "name":  d.name,
            "code":  d.code,
            "student_count": count,
        })
    result.sort(key=lambda x: x["student_count"], reverse=True)
    return result


# ── 8. YEAR MATRIX ───────────────────────────────────────────────────────────

@router.get("/year-matrix")
def get_year_matrix(db: Session = Depends(get_db)):
    """Returns real GROUP BY year_level performance benchmarking from DB."""
    from backend.services.hod_analytics_engine import calculate_year_matrix
    return calculate_year_matrix(db)


# ── 9. AI NATURAL-LANGUAGE QUERY ─────────────────────────────────────────────

@router.post("/ai-query")
def post_ai_query(req: AIQueryRequest, db: Session = Depends(get_db)):
    """
    Zero-hallucination AI query engine.
    Executes deterministic SQL over the DB, injects results into LLM context.
    """
    from backend.services.ai_query_engine import answer_ai_department_query
    return answer_ai_department_query(db, query_text=req.query)
