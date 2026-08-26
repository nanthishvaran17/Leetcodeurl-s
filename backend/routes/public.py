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
