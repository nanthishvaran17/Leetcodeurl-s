from fastapi import APIRouter, Depends, Request, Query
from sqlalchemy.orm import Session
from typing import Optional

from backend.database import get_db
from backend.models import Student

router = APIRouter(prefix="/api/public", tags=["Public Endpoints"])

@router.get("/leaderboard")
def get_public_leaderboard(
    request: Request,
    limit: int = Query(100, ge=1, le=500),
    page: int = 1,
    paginated: bool = False,
    search: Optional[str] = None,
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
        search=search,
        session_id=None,
        sort_by=sort_by or "solved_desc",
        min_solved=None,
        max_solved=None,
        verified_only=False,
        paginated=paginated,
        page=page,
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
    using single-pass SQL aggregations.
    """
    from sqlalchemy import func, case
    from backend.models import Department
    try:
        stats = db.query(
            func.count(Student.id).label("total"),
            func.count(case((Student.is_active == True, 1))).label("active"),
            func.count(case(((Student.username != None) & (Student.username != ''), 1))).label("with_handle")
        ).first()

        dept_count = db.query(func.count(Department.id)).scalar() or 0

        total = getattr(stats, "total", 0) or 0
        active = getattr(stats, "active", 0) or 0
        with_handle = getattr(stats, "with_handle", 0) or 0

        return {
            "total": total,
            "active": active,
            "inactive": max(0, total - active),
            "verified": with_handle,
            "with_leetcode_handle": with_handle,
            "without_leetcode_handle": max(0, total - with_handle),
            "department_count": dept_count,
        }
    except Exception as e:
        return {"total": 0, "active": 0, "inactive": 0, "verified": 0, "department_count": 0, "error": str(e)}

