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
    students = db.query(Student).filter(
        (Student.is_active == True) | (Student.is_active.is_(None))
    ).all()
    results = []
    for st in students:
        st_out = StudentOut.from_orm(st)
        latest_prog = db.query(WeeklyStudentProgress).filter(WeeklyStudentProgress.student_id == st.id).order_by(WeeklyStudentProgress.id.desc()).first()
        if latest_prog:
            st_out.college_rank = latest_prog.college_rank
            st_out.dept_rank = latest_prog.dept_rank
            st_out.year_rank = latest_prog.year_rank
            st_out.section_rank = latest_prog.section_rank
            st_out.weekly_progress = latest_prog.weekly_progress
            st_out.badge_list = latest_prog.badge_list or []
        results.append(st_out)

    results.sort(
        key=lambda x: (int(x.stats.total_solved) if (x.stats and x.stats.total_solved is not None) else 0),
        reverse=True
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
