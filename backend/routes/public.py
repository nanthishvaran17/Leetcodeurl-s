from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.database import get_db
from backend.models import Student, CertificateRecord, WeeklyStudentProgress
from backend.schemas import StudentOut

router = APIRouter(prefix="/api/public", tags=["Public Endpoints"])

@router.get("/leaderboard")
def get_public_leaderboard(
    request: Request,
    limit: int = 3000,
    sort_by: Optional[str] = "solved_desc",
    dept_id: Optional[int] = None,
    year_level: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Public read-only leaderboard route requiring no authentication.
    """
    from backend.routes.students import get_students
    return get_students(
        request=request,
        dept_id=dept_id,
        year_level=year_level,
        section_id=None,
        search=None,
        session_id=None,
        sort_by=sort_by or "solved_desc",
        min_solved=None,
        max_solved=None,
        verified_only=False,
        page=1,
        limit=limit,
        db=db
    )

@router.get("/verify-certificate/{cert_code}")
def verify_certificate(cert_code: str, db: Session = Depends(get_db)):
    """
    Public verification endpoint alias forwarding to the canonical certificate verifier.
    """
    from backend.routes.certificates import verify_certificate_public
    return verify_certificate_public(verification_id=cert_code, db=db)

@router.get("/stats")
def get_public_stats(db: Session = Depends(get_db)):
    """
    Lightweight endpoint to fetch total and verified student counts for public displays
    without downloading the entire roster.
    Canonical LeetCode field: Student.username (Column String(100), index=True, nullable=True).
    There is NO Student.leetcode_username field on the model.
    """
    from sqlalchemy import func
    from backend.models import Department

    total = db.query(Student).count()
    active = db.query(Student).filter(Student.is_active == True).count()
    inactive = db.query(Student).filter(Student.is_active == False).count()

    # Count students with a non-null, non-empty LeetCode username (canonical field: Student.username)
    with_handle = db.query(Student).filter(
        Student.username != None,
        Student.username != ''
    ).count()
    without_handle = total - with_handle

    dept_count = db.query(func.count(Department.id.distinct())).scalar()

    return {
        "total": total,
        "active": active,
        "inactive": inactive,
        "verified": with_handle,           # backward-compat alias
        "with_leetcode_handle": with_handle,
        "without_leetcode_handle": without_handle,
        "department_count": dept_count,
    }

