import os
import uuid
import datetime
from sqlalchemy.orm import Session
from backend.models import (
    Student, Department, StudentStatSnapshot, StudentContestSnapshot,
    StudentContestParticipation
)

import threading
from fastapi import HTTPException

# Global Semaphore to prevent OOM on Render. Allows max 2 concurrent report generation jobs.
REPORT_GENERATION_SEMAPHORE = threading.Semaphore(2)

def generate_student_report(
    db: Session,
    student_id: int,
    report_type: str,
    format: str,
    current_user=None
):
    """
    Isolated entrypoint for generating Student Reports.
    100% bypasses institutional reporting logic.
    """
    if not REPORT_GENERATION_SEMAPHORE.acquire(blocking=False):
        raise HTTPException(
            status_code=429, 
            detail="Report engine is currently at maximum capacity. Please try again in a few seconds."
        )
    
    try:
    
        # 1. Strict Ownership Fetching
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            raise ValueError(f"Student with ID {student_id} not found.")
        
        stats = db.query(StudentStatSnapshot).filter(StudentStatSnapshot.student_id == student_id).first()
        contest_stats = db.query(StudentContestSnapshot).filter(StudentContestSnapshot.student_id == student_id).first()
    
        dept_name = student.department.name if student.department else "ALL"
    
        # 2. Build Unified StudentReportData 
        # Ensures only data owned by the student is included
        student_report_data = {
            "student_id": student.id,
            "name": student.name,
            "reg_no": student.reg_no,
            "dept": dept_name,
            "year": student.year_level,
            "username": student.username,
            "total_solved": stats.total_solved if stats else 0,
            "easy": stats.easy_solved if stats else 0,
            "medium": stats.medium_solved if stats else 0,
            "hard": stats.hard_solved if stats else 0,
            "contest_rating": stats.contest_rating if stats else 0,
            "active_streak": student.stats.max_streak if student.stats and student.stats.max_streak else 0,
            "college_rank": getattr(student, "college_rank", "N/A"),
            "contest_solved": contest_stats.questions_solved if contest_stats else 0,
            "contest_score": f"{contest_stats.questions_solved} / {contest_stats.questions_total}" if contest_stats else "N/A",
            "last_contest_name": contest_stats.contest_name if contest_stats else "N/A",
            "generatedAt": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    
        fmt = format.lower()
        rpt = report_type.upper()
    
        file_bytes = None
        ext = "pdf"
        mime = "application/pdf"
    
        if fmt == "pdf":
            from backend.exporters.student_pdf_exporter import export_student_pdf_from_dataset
            file_bytes = export_student_pdf_from_dataset({"rows": [student_report_data], **student_report_data}, rpt)
            ext = "pdf"
        elif fmt in ("excel", "xlsx"):
            from backend.exporters.student_excel_exporter import export_student_excel_from_dataset
            file_bytes = export_student_excel_from_dataset({"rows": [student_report_data], **student_report_data}, rpt)
            ext = "xlsx"
            mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        elif fmt == "both":
            from backend.exporters.zip_exporter import export_student_zip_bundle_from_dataset
            file_bytes = export_student_zip_bundle_from_dataset(
                {"rows": [student_report_data], **student_report_data}, 
                student_report_data["name"], 
                student_report_data["reg_no"],
                rpt
            )
            ext = "zip"
            mime = "application/zip"
        else:
            raise ValueError(f"Unsupported format: {format}")
        
        # File naming
        safe_name = student.name.replace(" ", "_").replace("/", "_")
        safe_reg = student.reg_no.replace(" ", "_")
    
        prefix = 'Student_Report'
        if rpt == 'OFFICIAL_SUMMARY' or rpt == 'SUMMARY': prefix = 'Student_Summary'
        if rpt == 'WEEKLY_CONTEST_MATRIX' or rpt == 'MATRIX': prefix = 'Student_Contest_Matrix'
    
        filename = f"Nandha_{prefix}_{safe_name}_{safe_reg}.{ext}"
    
        # Save to disk securely
        storage_dir = os.path.join(os.getcwd(), "cache", "reports")
        os.makedirs(storage_dir, exist_ok=True)
        storage_path = os.path.join(storage_dir, f"{uuid.uuid4().hex[:8]}_{filename}")
    
        with open(storage_path, "wb") as f:
            f.write(file_bytes)
        
        file_size = len(file_bytes)
    
        from backend.models import ReportCache
        
        # Fix: Check for existing entry to prevent UNIQUE constraint failures
        existing_record = db.query(ReportCache).filter(
            ReportCache.institution_id == "NEC",
            ReportCache.week_id == "student_isolated",
            ReportCache.file_type == f"student_{rpt}_{fmt}_{student_id}",
            ReportCache.data_version == "1.0"
        ).first()

        if existing_record:
            existing_record.filename = filename
            existing_record.mime_type = mime
            existing_record.storage_path = storage_path
            existing_record.file_size_bytes = file_size
            existing_record.status = "READY"
            existing_record.generated_at = datetime.datetime.utcnow()
            cache_record = existing_record
        else:
            cache_record = ReportCache(
                institution_id="NEC",
                week_id="student_isolated",
                file_type=f"student_{rpt}_{fmt}_{student_id}",
                filter_hash=f"std_{student_id}_{uuid.uuid4().hex[:4]}",
                report_type=rpt,
                format=fmt,
                filters_json=f'{{"student_id": {student_id}}}',
                user_scope="STUDENT",
                filename=filename,
                mime_type=mime,
                storage_path=storage_path,
                file_size_bytes=file_size,
                data_version="1.0",
                status="READY"
            )
            db.add(cache_record)
        
        db.commit()
        db.refresh(cache_record)
    
        return {
            "status": "READY",
            "download_url": f"/api/downloads/reports/{filename}",
            "filename": filename,
            "mime_type": mime,
            "file_size_bytes": file_size,
            "report_type": rpt,
            "format": fmt,
            "target": "student_isolated"
        }
    finally:
        REPORT_GENERATION_SEMAPHORE.release()
