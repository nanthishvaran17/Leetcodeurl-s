from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db
from backend.models import Student, CertificateRecord, WeeklyStudentProgress
from backend.schemas import StudentOut

router = APIRouter(prefix="/api/public", tags=["Public Endpoints"])

@router.get("/leaderboard", response_model=List[StudentOut])
def get_public_leaderboard(limit: int = 50, db: Session = Depends(get_db)):
    """
    Public read-only leaderboard route requiring no authentication.
    """
    from backend.routes.students import get_students
    # explicitly pass all kwargs as None to avoid FastAPI Query/Depends objects causing bugs
    results = get_students(
        dept_id=None,
        year_level=None,
        section_id=None,
        search=None,
        session_id=None,
        sort_by="rating_desc",  # properly sort by contest rating or solved for leaderboard
        min_solved=None,
        max_solved=None,
        verified_only=False,
        page=1,
        limit=limit,
        db=db
    )
    return results[:limit]

@router.get("/verify-certificate/{cert_code}")
def verify_certificate(cert_code: str, db: Session = Depends(get_db)):
    """
    Public verification endpoint alias forwarding to the canonical certificate verifier.
    """
    from backend.routes.certificates import verify_certificate_public
    return verify_certificate_public(verification_id=cert_code, db=db)
