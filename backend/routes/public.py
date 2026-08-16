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
    cert = db.query(CertificateRecord).filter(CertificateRecord.certificate_code == cert_code).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate code not found or invalid.")

    student = cert.student
    return {
        "status": "VALID",
        "certificate_code": cert.certificate_code,
        "certificate_type": cert.certificate_type,
        "issue_date": cert.issue_date,
        "student": {
            "name": student.name,
            "reg_no": student.reg_no,
            "department": student.department.name if student.department else "N/A"
        }
    }
