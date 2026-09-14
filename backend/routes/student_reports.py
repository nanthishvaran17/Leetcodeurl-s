from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from backend.database import get_db
from backend.models import User
from backend.security import get_current_user_optional

router = APIRouter(prefix="/api/student-reports", tags=["Student Reports"])

class StudentReportRequest(BaseModel):
    student_id: int
    report_type: str
    format: str

@router.post("/generate")
def generate_isolated_student_report(
    req: StudentReportRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Completely isolated endpoint for generating student-only reports.
    """
    from backend.services.student_report_service import generate_student_report
    
    # 1. Generate Report
    result = generate_student_report(
        db=db,
        student_id=req.student_id,
        report_type=req.report_type,
        format=req.format,
        current_user=current_user
    )
    
    return {
        "status": "READY",
        "download_url": result["download_url"],
        "filename": result["filename"],
        "mime_type": result["mime_type"],
        "file_size_bytes": result["file_size_bytes"]
    }
