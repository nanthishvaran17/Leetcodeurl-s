import os
import datetime
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional

from backend.database import get_db
from backend.models import ReportJob
from backend.security import require_security_access
from backend.logger import logger
from backend.forensic_pdf_generator import generate_forensic_audit_pdf
from backend.routes.data_issues import generate_data_issues_excel_bytes, generate_data_issues_csv_bytes

router = APIRouter(prefix="/api/report-jobs", tags=["Report Jobs"])

def generate_report_background_task(job_id: str, payload: dict, institution_id: str):
    from backend.database import SessionLocal
    from backend.services.pregenerated_report_service import get_or_create_report
    
    db = SessionLocal()
    try:
        # Mark as processing
        job = db.query(ReportJob).filter(ReportJob.job_id == job_id).first()
        if job:
            job.status = "PROCESSING"
            job.started_at = datetime.datetime.utcnow()
            db.commit()
            
        report_type = payload.get("report_type")
        format_ext = payload.get("format")
        filters = payload.get("filters", {})
        
        # We need a dummy user for the pregenerated_report_service
        # In a real app we might pass user context, but here we just need generation to run
        class DummyUser:
            def __init__(self, inst_id):
                self.institution_id = inst_id
                self.role = "admin"
        
        # This is where the long synchronous task happens
        if report_type == "FORENSIC_PDF":
            from backend.forensic_pdf_generator import generate_forensic_audit_pdf
            from backend.models import Student
            search = filters.get("search")
            session_id = filters.get("session_id")
            if not search or not session_id:
                raise Exception("Missing search or session_id for FORENSIC_PDF")
            
            clean_search = str(search).strip()
            student = db.query(Student).filter(
                (Student.reg_no.ilike(f"%{clean_search}%")) |
                (Student.username.ilike(f"%{clean_search}%")) |
                (Student.name.ilike(f"%{clean_search}%"))
            ).first()
            if not student:
                raise Exception("Student not found for Forensic PDF")
                
            pdf_bytes = generate_forensic_audit_pdf(db, student.id, int(session_id))
            
            cache_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "reports_cache")
            os.makedirs(cache_dir, exist_ok=True)
            
            filename = f"forensic_{job_id}.pdf"
            file_path = os.path.join(cache_dir, filename)
            with open(file_path, "wb") as f:
                f.write(pdf_bytes)
            
            job = db.query(ReportJob).filter(ReportJob.job_id == job_id).first()
            if job:
                job.status = "COMPLETED"
                job.progress = 100
                job.file_path = file_path
                job.completed_at = datetime.datetime.utcnow()
                db.commit()
            return
        elif report_type == "CERTIFICATE_FORENSIC_PDF":
            target_id = filters.get("student_id") or filters.get("search")
            if not target_id:
                raise ValueError("Missing identifier (student_id or search) for Certificate Forensic PDF")
            if target_id.startswith("CERT-") and target_id.endswith("-FORENSIC"):
                target_id = target_id.replace("CERT-", "").replace("-FORENSIC", "")
                
            pdf_bytes = generate_forensic_audit_pdf(db, student_id=None, identifier=target_id)
            cache_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "reports_cache")
            os.makedirs(cache_dir, exist_ok=True)
            filename = f"cert_forensic_{job_id}.pdf"
            file_path = os.path.join(cache_dir, filename)
            with open(file_path, "wb") as f:
                f.write(pdf_bytes)
            
            job = db.query(ReportJob).filter(ReportJob.job_id == job_id).first()
            if job:
                job.status = "COMPLETED"
                job.progress = 100
                job.file_path = file_path
                job.completed_at = datetime.datetime.utcnow()
                db.commit()
            return

        elif report_type == "DATA_ISSUES_EXCEL":
            department = filters.get("department", "all")
            year_level = filters.get("year_level", "all")
            issue_type = filters.get("issue_type", "all")
            search = filters.get("search", None)
            
            file_bytes = generate_data_issues_excel_bytes(
                db=db, department=department, year_level=year_level, 
                issue_type=issue_type, search=search
            )
            cache_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "reports_cache")
            os.makedirs(cache_dir, exist_ok=True)
            filename = f"data_issues_{job_id}.xlsx"
            file_path = os.path.join(cache_dir, filename)
            with open(file_path, "wb") as f:
                f.write(file_bytes)
            
            job = db.query(ReportJob).filter(ReportJob.job_id == job_id).first()
            if job:
                job.status = "COMPLETED"
                job.progress = 100
                job.file_path = file_path
                job.completed_at = datetime.datetime.utcnow()
                db.commit()
            return
            
        elif report_type == "DATA_ISSUES_CSV":
            department = filters.get("department", "all")
            year_level = filters.get("year_level", "all")
            issue_type = filters.get("issue_type", "all")
            search = filters.get("search", None)
            
            file_bytes = generate_data_issues_csv_bytes(
                db=db, department=department, year_level=year_level, 
                issue_type=issue_type, search=search
            )
            cache_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "reports_cache")
            os.makedirs(cache_dir, exist_ok=True)
            filename = f"data_issues_{job_id}.csv"
            file_path = os.path.join(cache_dir, filename)
            with open(file_path, "wb") as f:
                f.write(file_bytes)
            
            job = db.query(ReportJob).filter(ReportJob.job_id == job_id).first()
            if job:
                job.status = "COMPLETED"
                job.progress = 100
                job.file_path = file_path
                job.completed_at = datetime.datetime.utcnow()
                db.commit()
            return
            
        res = get_or_create_report(
            db=db,
            report_type=report_type,
            format=format_ext,
            filters=filters,
            current_user=DummyUser(institution_id),
            institution_id=institution_id,
            background=False # We are ALREADY in the background thread
        )
        
        cache_id = res.get("cache_id")
        if not cache_id:
            raise Exception("No cache_id returned from get_or_create_report")
            
        from backend.models import ReportCache
        cache_record = db.query(ReportCache).filter(ReportCache.id == cache_id).first()
        
        if not cache_record or not cache_record.storage_path:
            raise Exception("Cache record or storage path missing")
            
        job = db.query(ReportJob).filter(ReportJob.job_id == job_id).first()
        if job:
            job.status = "COMPLETED"
            job.progress = 100
            job.file_path = cache_record.storage_path
            job.completed_at = datetime.datetime.utcnow()
            db.commit()
            
    except Exception as e:
        logger.error(f"[ReportJob Engine] Task {job_id} failed: {e}", exc_info=True)
        job = db.query(ReportJob).filter(ReportJob.job_id == job_id).first()
        if job:
            job.status = "FAILED"
            job.error_message = str(e)
            job.completed_at = datetime.datetime.utcnow()
            db.commit()
    finally:
        db.close()


@router.post("")
@router.post("/")
def create_report_job(
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Create Report Job", dept_scoped=True))
):
    """
    Creates an asynchronous report generation job and returns the job ID immediately.
    """
    job_id = f"EXP-{uuid.uuid4().hex[:8].upper()}"
    
    report_type = payload.get("report_type", "UNKNOWN")
    user_identifier = getattr(current_user, "email", "unknown")
    institution_id = getattr(current_user, "institution_id", "NEC")
    
    new_job = ReportJob(
        job_id=job_id,
        report_type=report_type,
        requested_by=user_identifier,
        status="QUEUED",
        progress=0,
        created_at=datetime.datetime.utcnow()
    )
    
    db.add(new_job)
    db.commit()
    
    # Schedule the actual heavy work on the background thread
    background_tasks.add_task(generate_report_background_task, job_id, payload, institution_id)
    
    return {"job_id": job_id, "status": "QUEUED"}


@router.get("/{job_id}")
def get_report_job_status(
    job_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Check Report Job", dept_scoped=True))
):
    """
    Polls the status of a report generation job.
    """
    job = db.query(ReportJob).filter(ReportJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    return {
        "job_id": job.job_id,
        "status": job.status,
        "progress": job.progress,
        "error_message": job.error_message,
        "created_at": job.created_at,
        "completed_at": job.completed_at
    }


@router.get("/{job_id}/download")
def download_report_job_file(
    job_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Download Report Job", dept_scoped=True))
):
    """
    Downloads the completed file for a given job.
    """
    job = db.query(ReportJob).filter(ReportJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    if job.status != "COMPLETED":
        raise HTTPException(status_code=400, detail="Job is not completed yet")
        
    if not job.file_path or not os.path.exists(job.file_path):
        raise HTTPException(status_code=404, detail="Report file missing from disk")
        
    filename = os.path.basename(job.file_path)
    ext = filename.split(".")[-1].lower()
    
    ext_media_types = {
        "pdf": "application/pdf",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "csv": "text/csv",
        "zip": "application/zip",
        "png": "image/png"
    }
    media_type = ext_media_types.get(ext, "application/octet-stream")
    
    return FileResponse(
        path=job.file_path,
        media_type=media_type,
        filename=filename,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
        }
    )
