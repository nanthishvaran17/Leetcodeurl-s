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
    result: dict = generate_student_report(
        db=db,
        student_id=req.student_id,
        report_type=req.report_type,
        format=req.format,
        current_user=current_user
    )
    
    return {
        "status": "READY",
        "download_url": result.get("download_url"),
        "filename": result.get("filename"),
        "mime_type": result.get("mime_type"),
        "file_size_bytes": result.get("file_size_bytes")
    }

@router.post("/generate-direct")
def generate_isolated_student_report_direct(
    req: StudentReportRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    from backend.services.student_report_service import generate_student_report
    from fastapi.responses import Response
    
    gen_res = generate_student_report(
        db=db,
        student_id=req.student_id,
        report_type=req.report_type,
        format=req.format,
        current_user=current_user,
        return_bytes=True
    )
    file_bytes, filename, mime_type = gen_res
    
    return Response(
        content=file_bytes,
        media_type=str(mime_type) if mime_type else "application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
