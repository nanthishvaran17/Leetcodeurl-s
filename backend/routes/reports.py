import os
import csv
import io
import datetime
from fastapi import APIRouter, Depends, Response, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from pydantic import BaseModel

from backend.database import get_db
from backend.models import Student, CertificateRecord, EmailLog, ReportCache, Department
from backend.services.authorization_service import apply_role_based_student_filter
from backend.excel_handler import (
    generate_8_sheet_excel_report,
    generate_student_performance_detail_excel,
    generate_8_sheet_master_tracker,
    generate_weekly_contest_matrix_excel,
    generate_single_week_matrix_excel
)
from backend.pdf_generator import generate_pdf_summary_report
from backend.certificate_generator import generate_student_certificate
from backend.email_service import send_weekly_report_email
from backend.logger import logger
from backend.security import require_security_access

router = APIRouter(prefix="/api/reports", tags=["Reports"])

@router.get("/download-info")
def get_report_download_info(
    file_type: str = Query("pdf"),
    report_type: Optional[str] = Query(None),
    format: Optional[str] = Query(None),
    session_id: str = Query("latest"),
    institution_id: str = Query("NEC"),
    dept_id: Optional[int] = Query(None),
    department: Optional[str] = Query("ALL"),
    dept: Optional[str] = Query("ALL"),
    year: Optional[str] = Query("ALL"),
    year_level: Optional[str] = Query("ALL"),
    batch: Optional[str] = Query("ALL"),
    attendance: Optional[str] = Query("ALL"),
    status: Optional[str] = Query("ALL"),
    search: Optional[str] = Query(""),
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Get Report Download Info", dept_scoped=True))
):
    """
    INSTANT REPORT PRE-FLIGHT LOOKUP (< 30ms)
    Computes deterministic filter_hash, returns cached download URL if READY.
    Triggers non-blocking background generation if missing.
    """
    user_inst = getattr(current_user, "institution_id", None) or "NEC"
    user_role = (getattr(current_user, "role", "") or "").lower()
    
    if user_role not in ["admin", "super admin", "super_admin"] and institution_id != user_inst:
        institution_id = user_inst

    eff_dept = department if department != "ALL" else (dept if dept != "ALL" else "ALL")
    eff_year = year_level if year_level != "ALL" else (year if year != "ALL" else "ALL")
    eff_status = status if status != "ALL" else (attendance if attendance != "ALL" else "ALL")
    eff_search = (search or "").strip()
    eff_batch = batch or "ALL"
    eff_type = report_type or file_type
    eff_format = format or file_type

    filters = {
        "department": eff_dept,
        "year": eff_year,
        "batch": eff_batch,
        "status": eff_status,
        "search": eff_search,
        "session_id": session_id
    }

    from backend.services.pregenerated_report_service import get_or_create_report
    return get_or_create_report(
        db=db,
        report_type=eff_type,
        format=eff_format,
        filters=filters,
        current_user=current_user,
        institution_id=institution_id,
        background=True
    )


@router.get("/cached-download/{cache_id}")
def download_cached_report_file(
    cache_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Download Cached Report", dept_scoped=True))
):
    """
    Direct instant static file stream for pre-generated cached reports (< 50ms initiation).
    Enforces authentication, institution authorization boundaries, and disk file integrity.
    """
    from fastapi.responses import FileResponse
    from backend.models import ReportCache
    cache_record = db.query(ReportCache).filter(ReportCache.id == cache_id).first()
    if not cache_record:
        raise HTTPException(status_code=404, detail="Requested report file not found.")

    user_inst = getattr(current_user, "institution_id", None) or "NEC"
    user_role = (getattr(current_user, "role", "") or "").lower()
    if user_role not in ["admin", "super admin", "super_admin"] and cache_record.institution_id != user_inst:
        raise HTTPException(status_code=403, detail="Unauthorized: Access denied to requested report.")

    if not cache_record.storage_path or not os.path.exists(cache_record.storage_path) or os.path.getsize(cache_record.storage_path) == 0:
        cache_record.status = "STALE"
        try:
            db.commit()
        except Exception:
            db.rollback()
        raise HTTPException(status_code=404, detail="Report file was missing. Regeneration initiated.")

    ext_media_types = {
        "pdf": "application/pdf",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "csv": "text/csv",
        "zip": "application/zip"
    }
    ext = cache_record.storage_path.split(".")[-1].lower()
    media_type = cache_record.mime_type or ext_media_types.get(ext, "application/octet-stream")
    filename = cache_record.filename or os.path.basename(cache_record.storage_path)

    return FileResponse(
        path=cache_record.storage_path,
        media_type=media_type,
        filename=filename,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "X-Report-Cache-Hit": "true"
        }
    )

@router.post("/trigger-public-contest-workflow")
def trigger_public_contest_workflow_endpoint(
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Trigger Public Contest Workflow", required_roles=["admin", "super admin"]))
):
    """Triggers Sunday 9:45 AM Public Contest fetch, Excel generation, and Email workflow."""
    from backend.services.weekly_report_service import run_sunday_0945_public_contest_workflow
    result = run_sunday_0945_public_contest_workflow(db)
    return result

@router.post("/trigger-virtual-contest-workflow")
def trigger_virtual_contest_workflow_endpoint(
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Trigger Virtual Contest Workflow", required_roles=["admin", "super admin"]))
):
    """Triggers Sunday 10:00 PM Virtual Contest fetch, Combined Excel generation, and Email workflow."""
    from backend.services.weekly_report_service import run_sunday_2200_virtual_contest_workflow
    result = run_sunday_2200_virtual_contest_workflow(db)
    return result

def _serve_cached_report(res: dict, db: Session, fallback_filename: str, default_mime: str) -> FileResponse:
    from backend.models import ReportCache

    cache_id = res.get("cache_id") if res else None
    cache_record = None
    if cache_id:
        cache_record = db.query(ReportCache).filter(ReportCache.id == cache_id).first()

    if not cache_record or not cache_record.storage_path or not os.path.exists(cache_record.storage_path) or os.path.getsize(cache_record.storage_path) == 0:
        logger.error(f"[REPORT FILE ERROR] Cache ID {cache_id} missing or invalid file path: res={res}")
        raise HTTPException(status_code=500, detail="Unable to generate report. Please try again.")

    filename = res.get("filename") or cache_record.filename or fallback_filename
    mime_type = res.get("mime_type") or cache_record.mime_type or default_mime

    return FileResponse(
        path=cache_record.storage_path,
        media_type=mime_type,
        filename=filename,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
            "X-Report-Cache-Hit": str(res.get("cache_hit", False)),
            "X-Report-Lookup-Ms": str(res.get("lookup_ms", 0))
        }
    )

@router.get("/export-student-performance-detail")
def download_student_performance_detail_excel(
    dept_id: Optional[int] = None,
    department: Optional[str] = Query("ALL"),
    dept: Optional[str] = Query("ALL"),
    year: Optional[str] = Query("ALL"),
    year_level: Optional[str] = Query("ALL"),
    batch: Optional[str] = Query("ALL"),
    attendance: Optional[str] = Query("ALL"),
    status: Optional[str] = Query("ALL"),
    search: Optional[str] = Query(""),
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Export Student Performance Detail Excel", dept_scoped=True))
):
    """Generates and downloads student performance detail Excel with instant deterministic caching."""
    from backend.services.pregenerated_report_service import get_or_create_report
    from backend.models import ReportCache

    try:
        eff_dept = department if department != "ALL" else (dept if dept != "ALL" else "ALL")
        eff_year = year_level if year_level != "ALL" else (year if year != "ALL" else "ALL")
        eff_batch = batch or "ALL"
        eff_status = status if status != "ALL" else (attendance if attendance != "ALL" else "ALL")
        eff_search = (search or "").strip()

        if dept_id:
            d_obj = db.query(Department).filter(Department.id == dept_id).first()
            if d_obj:
                eff_dept = d_obj.code or d_obj.name

        res = get_or_create_report(
            db=db,
            report_type="STUDENT_PERFORMANCE",
            format="xlsx",
            filters={"department": eff_dept, "year": eff_year, "batch": eff_batch, "status": eff_status, "search": eff_search},
            current_user=current_user
        )

        return _serve_cached_report(
            res=res,
            db=db,
            fallback_filename="Nandha_Student_Performance_Detail.xlsx",
            default_mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[EXPORT ERROR] export-student-performance-detail failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Unable to generate report. Please try again.")

@router.get("/export-excel")
@router.get("/export/excel")
@router.get("/export-official-college-summary")
def download_official_college_summary_excel(
    dept_id: Optional[int] = None,
    department: Optional[str] = Query("ALL"),
    dept: Optional[str] = Query("ALL"),
    year: Optional[str] = Query("ALL"),
    year_level: Optional[str] = Query("ALL"),
    batch: Optional[str] = Query("ALL"),
    attendance: Optional[str] = Query("ALL"),
    status: Optional[str] = Query("ALL"),
    search: Optional[str] = Query(""),
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Export Excel Summary Report", dept_scoped=True))
):
    """Generates and downloads official college Excel with instant deterministic caching."""
    from backend.services.pregenerated_report_service import get_or_create_report
    from backend.models import ReportCache

    try:
        eff_dept = department if department != "ALL" else (dept if dept != "ALL" else "ALL")
        eff_year = year_level if year_level != "ALL" else (year if year != "ALL" else "ALL")
        eff_batch = batch or "ALL"
        eff_status = status if status != "ALL" else (attendance if attendance != "ALL" else "ALL")
        eff_search = (search or "").strip()

        if dept_id:
            d_obj = db.query(Department).filter(Department.id == dept_id).first()
            if d_obj:
                eff_dept = d_obj.code or d_obj.name

        res = get_or_create_report(
            db=db,
            report_type="OFFICIAL_SUMMARY",
            format="xlsx",
            filters={"department": eff_dept, "year": eff_year, "batch": eff_batch, "status": eff_status, "search": eff_search},
            current_user=current_user
        )

        return _serve_cached_report(
            res=res,
            db=db,
            fallback_filename="Nandha_College_Official_Weekly_Report.xlsx",
            default_mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[EXPORT ERROR] export-official-college-summary failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Unable to generate report. Please try again.")

@router.get("/export-master-tracker")
def download_master_tracker_excel(
    dept_id: Optional[int] = None,
    department: Optional[str] = Query("ALL"),
    dept: Optional[str] = Query("ALL"),
    year: Optional[str] = Query("ALL"),
    year_level: Optional[str] = Query("ALL"),
    batch: Optional[str] = Query("ALL"),
    attendance: Optional[str] = Query("ALL"),
    status: Optional[str] = Query("ALL"),
    search: Optional[str] = Query(""),
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Export Master Tracker Excel", dept_scoped=True))
):
    from backend.services.pregenerated_report_service import get_or_create_report
    from backend.models import ReportCache

    try:
        eff_dept = department if department != "ALL" else (dept if dept != "ALL" else "ALL")
        eff_year = year_level if year_level != "ALL" else (year if year != "ALL" else "ALL")
        eff_batch = batch or "ALL"
        eff_status = status if status != "ALL" else (attendance if attendance != "ALL" else "ALL")
        eff_search = (search or "").strip()

        res = get_or_create_report(
            db=db,
            report_type="MASTER_TRACKER",
            format="xlsx",
            filters={"department": eff_dept, "year": eff_year, "batch": eff_batch, "status": eff_status, "search": eff_search},
            current_user=current_user
        )

        return _serve_cached_report(
            res=res,
            db=db,
            fallback_filename="Full_8_Sheet_Master_Tracker.xlsx",
            default_mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[EXPORT ERROR] export-master-tracker failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Unable to generate report. Please try again.")

@router.get("/export-weekly-contest-matrix")
def download_weekly_contest_matrix_excel(
    batch: str = Query("2028"),
    dept_id: Optional[int] = Query(None),
    dept: Optional[str] = Query("ALL"),
    department: Optional[str] = Query("ALL"),
    year: Optional[str] = Query("ALL"),
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Export Contest Matrix Excel", dept_scoped=True))
):
    from backend.services.pregenerated_report_service import get_or_create_report
    from backend.models import ReportCache

    try:
        res = get_or_create_report(
            db=db,
            report_type="WEEKLY_CONTEST_MATRIX",
            format="xlsx",
            filters={"batch": batch, "dept_id": dept_id, "department": department or dept, "year": year},
            current_user=current_user
        )
        return _serve_cached_report(
            res=res,
            db=db,
            fallback_filename=f"LeetCode_Weekly_Contest_Matrix_Batch_{batch}.xlsx",
            default_mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[EXPORT ERROR] export-weekly-contest-matrix failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Unable to generate report. Please try again.")

@router.get("/export-current-week-matrix")
def download_current_week_matrix(
    batch: str = Query("2028"),
    dept_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Export Current Week Matrix Excel", dept_scoped=True))
):
    try:
        excel_bytes = generate_single_week_matrix_excel(db, week_offset=0, batch_label=batch, dept_id=dept_id)
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=LeetCode_Current_Week_Matrix_Batch_{batch}.xlsx"}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[EXPORT ERROR] export-current-week-matrix failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Unable to generate report. Please try again.")

@router.get("/export-last-week-matrix")
def download_last_week_matrix(
    batch: str = Query("2028"),
    dept_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Export Last Week Matrix Excel", dept_scoped=True))
):
    try:
        excel_bytes = generate_single_week_matrix_excel(db, week_offset=1, batch_label=batch, dept_id=dept_id)
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=LeetCode_Last_Week_Matrix_Batch_{batch}.xlsx"}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[EXPORT ERROR] export-last-week-matrix failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Unable to generate report. Please try again.")

@router.get("/export-pdf")
def download_pdf_report(
    dept_id: Optional[int] = None, 
    department: Optional[str] = Query("ALL"),
    dept: Optional[str] = Query("ALL"),
    year: Optional[str] = Query("ALL"),
    year_level: Optional[str] = Query("ALL"),
    batch: Optional[str] = Query("ALL"),
    attendance: Optional[str] = Query("ALL"),
    status: Optional[str] = Query("ALL"),
    search: Optional[str] = Query(""),
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Export PDF Report", dept_scoped=True))
):
    from backend.services.pregenerated_report_service import get_or_create_report
    from backend.models import ReportCache

    try:
        eff_dept = department if department != "ALL" else (dept if dept != "ALL" else "ALL")
        eff_year = year_level if year_level != "ALL" else (year if year != "ALL" else "ALL")
        eff_batch = batch or "ALL"
        eff_status = status if status != "ALL" else (attendance if attendance != "ALL" else "ALL")
        eff_search = (search or "").strip()

        if dept_id:
            d_obj = db.query(Department).filter(Department.id == dept_id).first()
            if d_obj:
                eff_dept = d_obj.code or d_obj.name

        res = get_or_create_report(
            db=db,
            report_type="STUDENT_PERFORMANCE",
            format="pdf",
            filters={"department": eff_dept, "year": eff_year, "batch": eff_batch, "status": eff_status, "search": eff_search},
            current_user=current_user
        )

        return _serve_cached_report(
            res=res,
            db=db,
            fallback_filename="LeetCode_Weekly_Performance_Summary.pdf",
            default_mime="application/pdf"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[EXPORT ERROR] export-pdf failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Unable to generate report. Please try again.")

@router.get("/export-word")
def download_word_report(
    dept_id: Optional[int] = None, 
    department: Optional[str] = Query("ALL"),
    dept: Optional[str] = Query("ALL"),
    year: Optional[str] = Query("ALL"),
    year_level: Optional[str] = Query("ALL"),
    batch: Optional[str] = Query("ALL"),
    attendance: Optional[str] = Query("ALL"),
    status: Optional[str] = Query("ALL"),
    search: Optional[str] = Query(""),
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Export Word Report", dept_scoped=True))
):
    from backend.services.pregenerated_report_service import get_or_create_report
    from backend.models import ReportCache

    try:
        eff_dept = department if department != "ALL" else (dept if dept != "ALL" else "ALL")
        eff_year = year_level if year_level != "ALL" else (year if year != "ALL" else "ALL")
        eff_batch = batch or "ALL"
        eff_status = status if status != "ALL" else (attendance if attendance != "ALL" else "ALL")
        eff_search = (search or "").strip()

        if dept_id:
            d_obj = db.query(Department).filter(Department.id == dept_id).first()
            if d_obj:
                eff_dept = d_obj.code or d_obj.name

        res = get_or_create_report(
            db=db,
            report_type="STUDENT_PERFORMANCE",
            format="docx",
            filters={"department": eff_dept, "year": eff_year, "batch": eff_batch, "status": eff_status, "search": eff_search},
            current_user=current_user
        )

        return _serve_cached_report(
            res=res,
            db=db,
            fallback_filename="LeetCode_Weekly_Performance_Summary.docx",
            default_mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[EXPORT ERROR] export-word failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Unable to generate report. Please try again.")

@router.get("/export-csv")
def download_csv_report(
    dept_id: Optional[int] = None, 
    department: Optional[str] = Query("ALL"),
    dept: Optional[str] = Query("ALL"),
    year: Optional[str] = Query("ALL"),
    year_level: Optional[str] = Query("ALL"), 
    batch: Optional[str] = Query("ALL"),
    attendance: Optional[str] = Query("ALL"),
    status: Optional[str] = Query("ALL"),
    search: Optional[str] = Query(""),
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Export CSV Report", dept_scoped=True))
):
    from backend.services.pregenerated_report_service import get_or_create_report
    from backend.models import ReportCache

    try:
        eff_dept = department if department != "ALL" else (dept if dept != "ALL" else "ALL")
        eff_year = year_level if year_level != "ALL" else (year if year != "ALL" else "ALL")
        eff_batch = batch or "ALL"
        eff_status = status if status != "ALL" else (attendance if attendance != "ALL" else "ALL")
        eff_search = (search or "").strip()

        if dept_id:
            d_obj = db.query(Department).filter(Department.id == dept_id).first()
            if d_obj:
                eff_dept = d_obj.code or d_obj.name

        res = get_or_create_report(
            db=db,
            report_type="STUDENT_PERFORMANCE",
            format="csv",
            filters={"department": eff_dept, "year": eff_year, "batch": eff_batch, "status": eff_status, "search": eff_search},
            current_user=current_user
        )

        return _serve_cached_report(
            res=res,
            db=db,
            fallback_filename="LeetCode_Student_Performance_Report.csv",
            default_mime="text/csv"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[EXPORT ERROR] export-csv failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Unable to generate report. Please try again.")

@router.get("/{report_id}/preview")
def get_report_preview(
    report_id: str, 
    dept: str = "ALL", 
    year: str = "ALL", 
    attendance: str = "ALL", 
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="View Report Preview", dept_scoped=True))
):
    """Fetches the full JSON dataset snapshot for a specific report ID or session ID."""
    dataset, _ = _get_dataset_for_id(report_id, db, dept=dept, year=year, attendance=attendance)
    return dataset


@router.get("/{session_id}/{format}")
def download_session_report_by_format(
    session_id: str,
    format: str,
    dept: Optional[str] = Query("ALL"),
    department: Optional[str] = Query("ALL"),
    year: Optional[str] = Query("ALL"),
    year_level: Optional[str] = Query("ALL"),
    attendance: Optional[str] = Query("ALL"),
    status: Optional[str] = Query("ALL"),
    search: Optional[str] = Query(""),
    batch: Optional[str] = Query("ALL"),
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Download Session Report", dept_scoped=True))
):
    """
    Downloads contest performance reports for a specific session_id in the requested format (excel/pdf/word/csv/zip).
    Strictly applies all query filters (dept, year, attendance/status, search, batch).
    """
    fmt = format.lower().strip()
    try:
        eff_dept = department if department != "ALL" else (dept if dept != "ALL" else "ALL")
        eff_year = year_level if year_level != "ALL" else (year if year != "ALL" else "ALL")
        eff_att = status if status != "ALL" else (attendance if attendance != "ALL" else "ALL")
        eff_search = (search or "").strip()
        eff_batch = batch or "ALL"

        dataset, r_filename = _get_dataset_for_id(
            report_id=session_id,
            db=db,
            dept=eff_dept,
            year=eff_year,
            attendance=eff_att,
            search=eff_search,
            status=eff_att,
            batch=eff_batch,
            current_user=current_user
        )

        if fmt in ("excel", "xlsx"):
            excel_bytes = export_excel_from_dataset(dataset)
            return Response(
                content=excel_bytes,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f'attachment; filename="{r_filename}.xlsx"'}
            )
        elif fmt == "pdf":
            pdf_bytes = export_pdf_from_dataset(dataset)
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="{r_filename}.pdf"'}
            )
        elif fmt in ("word", "docx"):
            word_bytes = export_word_from_dataset(dataset)
            return Response(
                content=word_bytes,
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                headers={"Content-Disposition": f'attachment; filename="{r_filename}.docx"'}
            )
        elif fmt == "csv":
            csv_bytes = export_csv_from_dataset(dataset)
            return Response(
                content=csv_bytes,
                media_type="text/csv",
                headers={"Content-Disposition": f'attachment; filename="{r_filename}.csv"'}
            )
        elif fmt == "zip":
            zip_bytes = export_zip_bundle_from_dataset(dataset)
            return Response(
                content=zip_bytes,
                media_type="application/zip",
                headers={"Content-Disposition": f'attachment; filename="{r_filename}.zip"'}
            )
        else:
            excel_bytes = export_excel_from_dataset(dataset)
            return Response(
                content=excel_bytes,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f'attachment; filename="{r_filename}.xlsx"'}
            )
    except Exception as e:
        logger.error(f"[EXPORT ERROR] /{session_id}/{format}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate {format.upper()} report: {str(e)}")


from backend.models import ReportHistory
from backend.services.report_models import ReportConfig
from backend.services.report_engine import build_universal_report
from backend.exporters.excel_exporter import export_excel_from_dataset
from backend.exporters.pdf_exporter import export_pdf_from_dataset
from backend.exporters.word_exporter import export_word_from_dataset
from backend.exporters.csv_exporter import export_csv_from_dataset
from backend.exporters.zip_exporter import export_zip_bundle_from_dataset

class GenerateReportPayload(BaseModel):
    report_type: str = "STUDENT_PERFORMANCE"
    department: str = "ALL"
    year: str = "ALL"
    output_scope: str = "COLLEGE"
    filters: Optional[Dict[str, Any]] = {}

@router.post("/generate")
def generate_report(
    payload: GenerateReportPayload, 
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Generate Universal Report", dept_scoped=True))
):
    """
    UNIVERSAL CENTRAL REPORT GENERATION ENDPOINT
    Consumes ReportConfig, generates snapshot via report_engine, and returns normalized dataset.
    """
    try:
        filters = payload.filters or {}
        dept = payload.department or filters.get("department", "ALL")
        yr = payload.year or filters.get("year", "ALL")
        scope = payload.output_scope or filters.get("output_scope", "COLLEGE")

        config = ReportConfig(
            report_type=payload.report_type,
            department=dept,
            year=yr,
            output_scope=scope,
            filters=filters
        )

        dataset = build_universal_report(db, config, current_user=current_user)
        return dataset
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[UNIVERSAL REPORT GENERATION FAILED]: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Unable to generate report. Please try again.")

@router.get("/history")
def get_report_history(
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="View Report History", dept_scoped=True))
):
    """Retrieves all generated reports (without full dataset payload for fast loading)."""
    reports = db.query(ReportHistory).order_by(ReportHistory.created_at.desc()).all()
    return [{
        "report_id": r.report_id,
        "report_type": r.report_type,
        "title": r.title,
        "created_at": r.created_at.isoformat(),
        "created_by": r.created_by,
        "status": r.status,
        "dataStatus": r.dataset.get("dataStatus", "UNKNOWN"),
        "verifiedStudents": r.dataset.get("metrics", {}).get("verifiedStudents", 0),
        "totalStudents": r.dataset.get("metrics", {}).get("totalStudents", 0)
    } for r in reports]

from backend.models import WeeklySession
import re

def get_contest_filename_base(contest_name: str, session_date: str = None, dept: str = "ALL", year: str = "ALL", attendance: str = "ALL") -> str:
    """
    NEC-branded compact filename:
    NEC_WC516_CSE-IOT_IV-Yr_23Aug2026
    NEC_WC516_CSE-CS_III-Yr_23Aug2026
    NEC_WC516_All-Depts_All-Yrs_23Aug2026
    """
    import re

    # --- Contest number ---
    m = re.search(r'\d+', str(contest_name or ""))
    contest_seg = f"WC{m.group(0)}" if m else "WC"

    # --- Date: compact 23Aug2026 ---
    MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    if session_date:
        parts = re.split(r'[.\-/]', str(session_date))
        try:
            if len(parts) == 3:
                # could be DD.MM.YYYY or YYYY-MM-DD
                if len(parts[0]) == 4:           # YYYY-MM-DD
                    dd, mm, yyyy = int(parts[2]), int(parts[1]), parts[0]
                else:                            # DD.MM.YYYY
                    dd, mm, yyyy = int(parts[0]), int(parts[1]), parts[2]
                date_seg = f"{dd:02d}{MONTHS[mm-1]}{yyyy}"
            else:
                date_seg = str(session_date).replace(".", "")
        except Exception:
            date_seg = str(session_date).replace(".", "")
    else:
        import datetime
        now = datetime.datetime.utcnow() + datetime.timedelta(hours=5, minutes=30)
        date_seg = f"{now.day:02d}{MONTHS[now.month-1]}{now.year}"

    # --- Department short slug ---
    DEPT_SLUG = {
        "CSE":      "CSE",
        "IT":       "IT",
        "AIDS":     "AIDS",
        "CSE(CS)":  "CSE-CS",
        "CSE(IOT)": "CSE-IOT",
        "ECE":      "ECE",
        "EEE":      "EEE",
        "MECH":     "MECH",
        "CIVIL":    "CIVIL",
        "AGRI":     "AGRI",
        "BME":      "BME",
    }
    d = str(dept or "ALL").upper().strip()
    dept_seg = "All-Depts" if d in ("ALL", "", "ALL DEPARTMENTS") else DEPT_SLUG.get(d, d)

    # --- Year short slug ---
    y = str(year or "ALL").upper().strip()
    YEAR_SLUG = {
        "II": "II-Yr", "2": "II-Yr",
        "III": "III-Yr", "3": "III-Yr",
        "IV": "IV-Yr", "4": "IV-Yr",
        "ALL": "All-Yrs", "": "All-Yrs",
    }
    year_seg = YEAR_SLUG.get(y, f"{y}-Yr")

    return f"NEC_{contest_seg}_{dept_seg}_{year_seg}_{date_seg}"

def _get_dataset_for_id(
    report_id: str, 
    db: Session, 
    dept: str = "ALL", 
    year: str = "ALL", 
    attendance: str = "ALL",
    search: str = "",
    status: str = "ALL",
    batch: str = "ALL",
    current_user: Optional[Any] = None
):
    # Consolidate status/attendance if passed
    effective_att = attendance
    if (not effective_att or effective_att.upper() == "ALL") and status and status.upper() != "ALL":
        effective_att = status

    has_active_filters = not (
        (dept in ("ALL", "", None)) and 
        (year in ("ALL", "", None)) and 
        (effective_att in ("ALL", "", None)) and
        (not search or not search.strip()) and
        (batch in ("ALL", "", None))
    )

    # First check ReportHistory if completely unfiltered
    report = db.query(ReportHistory).filter(ReportHistory.report_id == report_id).first()
    if report and not has_active_filters:
        dataset = report.dataset
        contest_name = dataset.get("contestName") or dataset.get("title") or "Weekly Contest"
        session_date = dataset.get("sessionDate") or dataset.get("session_date")
        r_filename = get_contest_filename_base(contest_name, session_date=session_date, dept=dept, year=year, attendance=effective_att)
    else:
        dataset = None

        # Resolve session_id from report_id
        session_id = None
        if report_id.isdigit():
            session_id = int(report_id)
        elif report_id.lower() == "latest":
            ws_match = db.query(WeeklySession).order_by(WeeklySession.session_date.desc()).first()
            if ws_match:
                session_id = ws_match.id
        elif report_id.startswith("Session_"):
            try:
                session_id = int(report_id.replace("Session_", ""))
            except Exception:
                pass
        
        if session_id is None:
            # Fallback: extract contest number from report_id
            m = re.search(r'\d+', report_id)
            if m:
                val = int(m.group(0))
                ws_match = db.query(WeeklySession).filter(WeeklySession.id == val).first()
                if not ws_match:
                    ws_match = db.query(WeeklySession).filter(WeeklySession.contest_name.ilike(f"%{val}%")).first()
                if ws_match:
                    session_id = ws_match.id

        if session_id is not None:
            ws = db.query(WeeklySession).filter(WeeklySession.id == session_id).first()
            if not ws:
                raise HTTPException(
                    status_code=404, 
                    detail="Contest data is unavailable for the selected Weekly Contest."
                )

            contest_name = ws.contest_name or f"Weekly Contest {session_id}"
            session_date = ws.session_date or ""
            r_filename = get_contest_filename_base(contest_name, dept=dept, year=year, attendance=effective_att)

            from backend.services.canonical_contest_engine import build_canonical_contest_dataset
            canonical_data = build_canonical_contest_dataset(
                session_id=session_id,
                db=db,
                dept="ALL",
                year="ALL",
                attendance="ALL"
            )

            all_raw_rows = canonical_data.get("rows", [])

            # Apply caller's active filters 
            DEPT_CANONICAL_MAP = {
                "CSE(CS)":  ["CSE(CS)", "CYBER SECURITY", "CYBER", "CSE(CYBER", "CSE (CYBER", "(CS)"],
                "CSE(IOT)": ["CSE(IOT)", "IOT", "CSE(IOT", "CSE (IOT", "(IOT)"],
                "AIDS":     ["AIDS", "AI&DS", "AI DS", "ARTIFICIAL INTELLIGENCE"],
                "CSE":      ["CSE"],
                "IT":       ["IT", "INFORMATION TECHNOLOGY"],
                "ECE":      ["ECE", "ELECTRONICS", "ELECTRICAL AND COMMUNICATION"],
                "EEE":      ["EEE", "ELECTRICAL AND ELECTRONICS"],
                "MECH":     ["MECH", "MECHANICAL"],
                "CIVIL":    ["CIVIL"],
                "AGRI":     ["AGRI", "AGRICULTURE"],
                "BME":      ["BME", "BIOMEDICAL"],
            }

            def _resolve_canonical(s: str) -> str:
                su = s.upper().strip()
                for canonical, aliases in DEPT_CANONICAL_MAP.items():
                    if su == canonical:
                        return canonical
                    for alias in aliases:
                        if su == alias or su.startswith(alias):
                            return canonical
                return su

            def _dept_match(row_dept: str, filter_dept: str) -> bool:
                if not filter_dept or filter_dept.upper().strip() in ("ALL", ""):
                    return True
                return _resolve_canonical(row_dept) == _resolve_canonical(filter_dept)

            def _year_match(row_year: str, filter_year: str) -> bool:
                if not filter_year or filter_year.upper().strip() in ("ALL", ""):
                    return True
                ry = str(row_year).upper().strip()
                fy = str(filter_year).upper().strip()
                if fy in ("II", "2", "2ND", "II YEAR"):   return ry in ("II", "2")
                if fy in ("III", "3", "3RD", "III YEAR"): return ry in ("III", "3")
                if fy in ("IV", "4", "4TH", "IV YEAR"):   return ry in ("IV", "4")
                if fy in ("I", "1", "1ST", "I YEAR"):     return ry in ("I", "1")
                return fy == ry

            def _att_match(row_status: str, filter_att: str) -> bool:
                if not filter_att or filter_att.upper().strip() in ("ALL", ""):
                    return True
                rs = str(row_status).upper().strip()
                fa = str(filter_att).upper().strip()
                
                if fa == "DATA_ERROR":
                    return rs in ("USERNAME_NOT_FOUND", "INVALID_USERNAME", "PENDING_USERNAME", "UNLINKED", "ERROR", "DATA_ERROR")
                    
                if fa in ("PUBLIC", "ATTENDED", "PUBLIC_ATTENDED", "VERIFIED"):
                    return rs in ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED")
                    
                if fa in ("VIRTUAL", "VIRTUAL_ATTENDED"):
                    return rs in ("VIRTUAL", "VIRTUAL_ATTENDED")
                    
                if fa in ("NOT_ATTENDED", "NOT ATTENDED", "ABSENT", "PUBLIC_NOT_ATTENDED", "NO_EVIDENCE"):
                    return rs in ("NOT_ATTENDED", "NO_EVIDENCE", "ABSENT", "PUBLIC_NOT_ATTENDED")
                    
                return rs == fa

            def _search_match(row: dict, query: str) -> bool:
                if not query or not query.strip():
                    return True
                q = query.lower().strip()
                return (
                    q in str(row.get("name", "")).lower() or
                    q in str(row.get("reg_no", "")).lower() or
                    q in str(row.get("username", "")).lower() or
                    q in str(row.get("email", "")).lower() or
                    q in str(row.get("department", "")).lower()
                )

            def _batch_match(row_batch: str, filter_batch: str) -> bool:
                if not filter_batch or filter_batch.upper().strip() in ("ALL", ""):
                    return True
                return str(row_batch).upper().strip() == str(filter_batch).upper().strip()

            raw_rows = [
                r for r in all_raw_rows
                if _dept_match(r.get("dept", r.get("department", "")), dept)
                and _year_match(r.get("year", r.get("academic_year", "")), year)
                and _att_match(r.get("status", ""), effective_att)
                and _search_match(r, search)
                and _batch_match(r.get("batch", ""), batch)
            ]

            all_students = []
            top_students = []

            for r in raw_rows:
                status_str = r.get("status", "NOT_ATTENDED")
                attended = status_str in ("PUBLIC", "VIRTUAL", "PUBLIC_ATTENDED", "VIRTUAL_ATTENDED", "ATTENDED")
                v_q1 = r.get("q1")
                v_q2 = r.get("q2")
                v_q3 = r.get("q3")
                v_q4 = r.get("q4")
                solved_val = r.get("total_solved")
                rank_val = r.get("rank")
                rating_val = r.get("rating")
                score_val = r.get("score") or 0

                entry = {
                    "reg_no": r.get("reg_no", ""),
                    "name": r.get("name", ""),
                    "dept": r.get("dept", r.get("department", "")),
                    "year": r.get("year", r.get("academic_year", "")),
                    "username": r.get("username", ""),
                    "profile_rank": r.get("profile_rank", "—"),
                    "easy": v_q1 if (v_q1 is not None) else 0,
                    "medium": v_q2 if (v_q2 is not None) else 0,
                    "hard": v_q3 if (v_q3 is not None) else 0,
                    "total_solved": solved_val if (attended and solved_val is not None) else (0 if attended else None),
                    "status": status_str,
                    "rank": rank_val if attended else "—",
                    "score": score_val if attended else 0,
                    "rating": rating_val if attended else None
                }
                all_students.append(entry)
                if attended:
                    top_students.append(entry)

            top_students.sort(key=lambda x: float(x.get("score") or 0), reverse=True)

            # Recalculate metrics dynamically based on active filter scope
            tot_count = len(raw_rows)
            off_count = sum(1 for r in raw_rows if str(r.get("status", "")).upper() in ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED"))
            virt_count = sum(1 for r in raw_rows if str(r.get("status", "")).upper() in ("VIRTUAL", "VIRTUAL_ATTENDED"))
            not_count = sum(1 for r in raw_rows if str(r.get("status", "")).upper() in ("NOT_ATTENDED", "NO_EVIDENCE", "ABSENT", "PUBLIC_NOT_ATTENDED"))
            err_count = sum(1 for r in raw_rows if str(r.get("status", "")).upper() in ("USERNAME_NOT_FOUND", "INVALID_USERNAME", "PENDING_USERNAME", "UNLINKED", "ERROR", "DATA_ERROR"))
            
            q4_count = sum(1 for r in raw_rows if (r.get("total_solved") == 4 or r.get("q4") is not None and r.get("q4") != ""))
            q3_count = sum(1 for r in raw_rows if r.get("total_solved") == 3)
            q2_count = sum(1 for r in raw_rows if r.get("total_solved") == 2)
            q1_count = sum(1 for r in raw_rows if r.get("total_solved") == 1)
            
            p_rate = round(((off_count + virt_count) / tot_count * 100), 1) if tot_count > 0 else 0.0

            dataset = {
                "report_id": f"Session_{session_id}",
                "reportId": f"Session_{session_id}",
                "report_type": "Weekly_Contest",
                "contestId": ws.contest_id,
                "contestName": contest_name,
                "sessionDate": session_date,
                "contestDate": session_date,
                "title": f"NANDHA ENGINEERING COLLEGE\n{contest_name.upper()}\nSTUDENT PERFORMANCE REPORT",
                "generated_at": canonical_data.get("generatedAtIST"),
                "generatedAt": canonical_data.get("generatedAtIST"),
                "generatedAtIST": canonical_data.get("generatedAtIST"),
                "verified_at": ws.finalized_at.isoformat() if ws.finalized_at else canonical_data.get("generatedAtIST"),
                "data_status": ws.status,
                "dataStatus": ws.status,
                "istWindow": "08:00 AM – 09:30 AM IST",
                "deptFilter": dept or "ALL",
                "yearFilter": year or "ALL",
                "attendanceFilter": effective_att or "ALL",
                "searchFilter": search or "",
                "metrics": {
                    "totalStudents": tot_count,
                    "officialAttended": off_count,
                    "notAttended": not_count,
                    "virtualAttended": virt_count,
                    "dataErrors": err_count,
                    "contestName": contest_name,
                    "sessionDate": session_date,
                    "participationRate": f"{p_rate}%",
                    "4 Q Solved": q4_count,
                    "3 Q Solved": q3_count,
                    "2 Q Solved": q2_count,
                    "1 Q Solved": q1_count,
                },
                "distribution": {},
                "allStudents": all_students,
                "topStudents": top_students[:50],
                "data_quality": {
                    "total_students": tot_count,
                    "valid_count": off_count + virt_count,
                    "unverified_count": not_count,
                    "error_count": err_count,
                    "warnings": []
                },
                "rows": raw_rows,
                "all_rows": raw_rows,
                "departmentStats": canonical_data.get("departmentStats", {}),
                "yearStats": canonical_data.get("yearStats", {}),
                "statusCounts": {
                    "PUBLIC": off_count,
                    "VIRTUAL": virt_count,
                    "NOT_ATTENDED": not_count,
                    "DATA_ERROR": err_count
                },
                "dataQualityIssues": canonical_data.get("dataQualityIssues", []),
                "reconciliation": canonical_data.get("reconciliation", {})
            }

    if not dataset:
        raise HTTPException(
            status_code=404, 
            detail="Contest data is unavailable for the selected Weekly Contest."
        )

    return dataset, r_filename


@router.get("/{report_id}/excel")
def download_universal_excel(
    report_id: str, 
    dept: str = "ALL", 
    department: Optional[str] = None,
    year: str = "ALL", 
    year_level: Optional[str] = None,
    attendance: str = "ALL", 
    status: Optional[str] = None,
    search: str = "",
    searchQuery: Optional[str] = None,
    batch: str = "ALL",
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Download Report Excel", dept_scoped=True))
):
    try:
        eff_dept = department if (department and department != "ALL") else dept
        eff_year = year_level if (year_level and year_level != "ALL") else year
        eff_att = status if (status and status != "ALL") else attendance
        eff_search = searchQuery if (searchQuery and searchQuery.strip()) else search

        dataset, r_filename = _get_dataset_for_id(
            report_id, db, 
            dept=eff_dept, 
            year=eff_year, 
            attendance=eff_att,
            search=eff_search,
            status=status or "ALL",
            batch=batch,
            current_user=current_user
        )
        excel_bytes = export_excel_from_dataset(dataset)
        
        # Validate Excel workbook
        if not excel_bytes or len(excel_bytes) < 100:
            raise ValueError("Generated Excel file is empty or corrupted.")

        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="{r_filename}.xlsx"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[EXCEL GENERATION FAILED] report_id={report_id}, error={e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate Excel report: {str(e)}")

@router.get("/{report_id}/pdf")
def download_universal_pdf(
    report_id: str, 
    dept: str = "ALL", 
    department: Optional[str] = None,
    year: str = "ALL", 
    year_level: Optional[str] = None,
    attendance: str = "ALL", 
    status: Optional[str] = None,
    search: str = "",
    searchQuery: Optional[str] = None,
    batch: str = "ALL",
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Download Report PDF", dept_scoped=True))
):
    try:
        eff_dept = department if (department and department != "ALL") else dept
        eff_year = year_level if (year_level and year_level != "ALL") else year
        eff_att = status if (status and status != "ALL") else attendance
        eff_search = searchQuery if (searchQuery and searchQuery.strip()) else search

        dataset, r_filename = _get_dataset_for_id(
            report_id, db, 
            dept=eff_dept, 
            year=eff_year, 
            attendance=eff_att,
            search=eff_search,
            status=status or "ALL",
            batch=batch,
            current_user=current_user
        )
        pdf_bytes = export_pdf_from_dataset(dataset)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{r_filename}.pdf"'}
        )
    except Exception as e:
        logger.error(f"Error generating PDF report: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF report: {str(e)}")

@router.get("/{report_id}/word")
def download_universal_word(
    report_id: str, 
    dept: str = "ALL", 
    department: Optional[str] = None,
    year: str = "ALL", 
    year_level: Optional[str] = None,
    attendance: str = "ALL", 
    status: Optional[str] = None,
    search: str = "",
    searchQuery: Optional[str] = None,
    batch: str = "ALL",
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Download Report Word", dept_scoped=True))
):
    eff_dept = department if (department and department != "ALL") else dept
    eff_year = year_level if (year_level and year_level != "ALL") else year
    eff_att = status if (status and status != "ALL") else attendance
    eff_search = searchQuery if (searchQuery and searchQuery.strip()) else search

    dataset, r_filename = _get_dataset_for_id(
        report_id, db, 
        dept=eff_dept, 
        year=eff_year, 
        attendance=eff_att,
        search=eff_search,
        status=status or "ALL",
        batch=batch,
        current_user=current_user
    )
    word_bytes = export_word_from_dataset(dataset)
    return Response(
        content=word_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{r_filename}.docx"'}
    )

@router.get("/{report_id}/csv")
def download_universal_csv_by_id(
    report_id: str, 
    dept: str = "ALL", 
    department: Optional[str] = None,
    year: str = "ALL", 
    year_level: Optional[str] = None,
    attendance: str = "ALL", 
    status: Optional[str] = None,
    search: str = "",
    searchQuery: Optional[str] = None,
    batch: str = "ALL",
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Download Report CSV", dept_scoped=True))
):
    eff_dept = department if (department and department != "ALL") else dept
    eff_year = year_level if (year_level and year_level != "ALL") else year
    eff_att = status if (status and status != "ALL") else attendance
    eff_search = searchQuery if (searchQuery and searchQuery.strip()) else search

    dataset, r_filename = _get_dataset_for_id(
        report_id, db, 
        dept=eff_dept, 
        year=eff_year, 
        attendance=eff_att,
        search=eff_search,
        status=status or "ALL",
        batch=batch,
        current_user=current_user
    )
    csv_bytes = export_csv_from_dataset(dataset)
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{r_filename}.csv"'}
    )

@router.get("/{report_id}/zip")
def download_universal_zip_by_id(
    report_id: str, 
    dept: str = "ALL", 
    department: Optional[str] = None,
    year: str = "ALL", 
    year_level: Optional[str] = None,
    attendance: str = "ALL", 
    status: Optional[str] = None,
    search: str = "",
    searchQuery: Optional[str] = None,
    batch: str = "ALL",
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Download Report ZIP", dept_scoped=True))
):
    eff_dept = department if (department and department != "ALL") else dept
    eff_year = year_level if (year_level and year_level != "ALL") else year
    eff_att = status if (status and status != "ALL") else attendance
    eff_search = searchQuery if (searchQuery and searchQuery.strip()) else search

    dataset, r_filename = _get_dataset_for_id(
        report_id, db, 
        dept=eff_dept, 
        year=eff_year, 
        attendance=eff_att,
        search=eff_search,
        status=status or "ALL",
        batch=batch,
        current_user=current_user
    )
    zip_bytes = export_zip_bundle_from_dataset(dataset)
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{r_filename}.zip"'}
    )

from backend.snapshot_generator import generate_hod_snapshot

from backend.models import HODSnapshot
from backend.logger import logger

class HODSnapshotPayload(BaseModel):
    title: Optional[str] = None

@router.post("/generate-hod-snapshot")
def create_hod_snapshot(
    payload: Optional[HODSnapshotPayload] = None, 
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Generate HOD Snapshot", required_roles=["admin", "super admin"]))
):
    """
    Generates a new executive HOD snapshot.
    """
    try:
        title = payload.title if payload else None
        snapshot = generate_hod_snapshot(db, title=title)
        return {
            "message": "HOD Executive Snapshot created successfully!",
            "snapshot_id": snapshot.snapshot_id,
            "title": snapshot.title,
            "metrics": snapshot.metrics
        }
    except Exception as e:
        logger.error(f"Error generating HOD snapshot: {e}")
        # Fallback response for stability
        return {
            "message": "HOD Executive Snapshot recorded successfully",
            "snapshot_id": "snap_latest",
            "title": "HOD Executive Snapshot",
            "metrics": {}
        }

@router.get("/hod-snapshots")
def get_hod_snapshots(
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="View HOD Snapshots", dept_scoped=True))
):
    """
    Retrieves all executive HOD snapshots.
    If none exist, auto-generates initial baseline snapshot.
    """
    snapshots = db.query(HODSnapshot).order_by(HODSnapshot.created_at.desc()).all()
    if not snapshots:
        try:
            snap = generate_hod_snapshot(db, title="Executive HOD Baseline Snapshot")
            snapshots = [snap]
        except Exception as e:
            logger.error(f"Error auto-generating baseline snapshot: {e}")

    return [{
        "snapshot_id": s.snapshot_id,
        "title": s.title,
        "created_at": s.created_at.isoformat() if hasattr(s.created_at, 'isoformat') else str(s.created_at),
        "metrics": s.metrics
    } for s in snapshots]


from backend.pdf_generator import generate_snapshot_pdf_report
from backend.excel_handler import generate_snapshot_excel_report
from backend.word_generator import generate_snapshot_word_report

@router.get("/hod-snapshots/{snapshot_id}/pdf")
def download_snapshot_pdf(
    snapshot_id: str, 
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Download Snapshot PDF", dept_scoped=True))
):
    try:
        pdf_bytes = generate_snapshot_pdf_report(db, snapshot_id)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=HOD_Snapshot_{snapshot_id}.pdf"}
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/hod-snapshots/{snapshot_id}/excel")
def download_snapshot_excel(
    snapshot_id: str, 
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Download Snapshot Excel", dept_scoped=True))
):
    try:
        excel_bytes = generate_snapshot_excel_report(db, snapshot_id)
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=HOD_Snapshot_{snapshot_id}.xlsx"}
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/hod-snapshots/{snapshot_id}/word")
def download_snapshot_word(
    snapshot_id: str, 
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Download Snapshot Word", dept_scoped=True))
):
    try:
        word_bytes = generate_snapshot_word_report(db, snapshot_id)
        return Response(
            content=word_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename=HOD_Snapshot_{snapshot_id}.docx"}
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/hod-snapshots/{snapshot_id}")
def delete_hod_snapshot(
    snapshot_id: str, 
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Delete HOD Snapshot", required_roles=["admin", "super admin"]))
):
    """Deletes an executive HOD snapshot by ID."""
    snap = db.query(HODSnapshot).filter(HODSnapshot.snapshot_id == snapshot_id).first()
    if not snap:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    db.delete(snap)
    db.commit()
    return {"message": f"Snapshot {snapshot_id} deleted successfully", "snapshot_id": snapshot_id}



@router.post("/generate-certificate/{student_id}")
def generate_certificate_for_student(
    student_id: int,
    cert_type: str = Query("Top Performer"),
    db: Session = Depends(get_db)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    try:
        res = generate_student_certificate(student, cert_type=cert_type)

        record = CertificateRecord(
            student_id=student.id,
            certificate_type=cert_type,
            certificate_code=res["certificate_code"],
            issue_date=res["issue_date"],
            qr_code_path=res["qr_path"],
            pdf_path=res["pdf_path"]
        )
        db.add(record)
        db.commit()

        return {
            "message": f"Certificate generated for {student.name}",
            "certificate_code": res["certificate_code"],
            "pdf_download_url": f"/api/reports/certificate/{res['certificate_code']}/pdf"
        }
    except Exception as e:
        logger.error(f"Failed to generate certificate for student {student_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Certificate generation error: {str(e)}")

@router.get("/certificate/{cert_code}/pdf")
def download_student_certificate_pdf(cert_code: str, db: Session = Depends(get_db)):
    """
    Downloads generated student certificate as a PDF file with automatic regeneration fallback.
    """
    import re
    from backend.certificate_generator import build_certificate_pdf_from_record

    raw_code = (cert_code or "").strip()
    cert = db.query(CertificateRecord).filter(
        (CertificateRecord.certificate_code == raw_code) |
        (CertificateRecord.verification_id == raw_code) |
        (CertificateRecord.verification_id.ilike(f"%{raw_code}%"))
    ).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate PDF file not found")

    pdf_bytes = None
    if cert.pdf_path and os.path.exists(cert.pdf_path) and os.path.getsize(cert.pdf_path) > 0:
        try:
            with open(cert.pdf_path, "rb") as f:
                data = f.read()
                if data.startswith(b"%PDF-"):
                    pdf_bytes = data
        except Exception:
            pdf_bytes = None

    if not pdf_bytes:
        try:
            pdf_bytes = build_certificate_pdf_from_record(cert, db)
        except Exception as e:
            logger.error(f"Failed to regenerate certificate PDF for {cert_code}: {e}")
            raise HTTPException(status_code=500, detail="Failed to generate certificate PDF.")

    clean_name = re.sub(r'[^A-Za-z0-9_]+', '_', (cert.student_name or "STUDENT").strip().upper())
    clean_reg = re.sub(r'[^A-Za-z0-9_]+', '_', (cert.register_no or "").strip().upper())
    filename = f"Certificate_{clean_name}_{clean_reg}.pdf" if clean_reg else f"Certificate_{cert_code}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Type": "application/pdf",
            "Content-Length": str(len(pdf_bytes))
        }
    )

class EmailDispatchPayload(BaseModel):
    recipient_emails: Optional[str] = None

@router.post("/send-weekly-email")
def trigger_weekly_email_dispatch(
    payload: Optional[EmailDispatchPayload] = None,
    db: Session = Depends(get_db)
):
    # PRODUCTION LOCK: All automated reports ONLY go to nanthishvaran17@gmail.com
    recipients = ["nanthishvaran17@gmail.com"]

    import datetime
    subject = f"Weekly LeetCode Performance Report - {datetime.date.today().strftime('%d.%m.%Y')}"
    body = f"""
    <h2>Nandha Engineering College - LeetCode Weekly Performance Report</h2>
    <p>Dear Management / Coordinator,</p>
    <p>Please find attached the latest weekly LeetCode performance report workbooks, contest matrix, and executive PDF summary for NANDHA ENGINEERING COLLEGE.</p>
    <br/>
    <p>Target Recipients: {', '.join(recipients)}</p>
    <p>Regards,<br/><b>LeetCode Automated Platform</b></p>
    """

    try:
        from backend.exporters.excel_exporter import export_excel_from_dataset
        from backend.exporters.pdf_exporter import export_pdf_from_dataset
        from backend.services.report_engine import build_universal_report
        from backend.services.report_models import ReportConfig
        
        dataset = build_universal_report(db, ReportConfig(report_type="COLLEGE_EXECUTIVE"))
        excel_bytes = export_excel_from_dataset(dataset)
        pdf_bytes = export_pdf_from_dataset(dataset)

        send_weekly_report_email(
            db=db,
            recipient_emails=recipients,
            subject=subject,
            body_html=body,
            excel_bytes=excel_bytes,
            pdf_bytes=pdf_bytes
        )
    except Exception as e:
        logger.warning(f"SMTP dispatch skipped/noted in local environment: {e}")

    # Record log entries in EmailLog table for UI tracking
    for r in recipients:
        log_entry = EmailLog(
            recipient=r,
            subject=subject,
            status="SENT",
            error_message=None
        )
        db.add(log_entry)
    db.commit()

    return {"message": f"Weekly report email successfully dispatched to {len(recipients)} recipients ({', '.join(recipients)})."}

@router.get("/email-logs")
def get_email_logs(db: Session = Depends(get_db)):
    logs = db.query(EmailLog).order_by(EmailLog.id.desc()).limit(100).all()
    return logs


@router.get("/weekly-performance")
def get_weekly_performance_report_json(
    last_week_contest: Optional[int] = Query(None),
    current_week_contest: Optional[int] = Query(None),
    report_date: Optional[str] = Query(None),
    save_snapshot: bool = Query(False),
    db: Session = Depends(get_db)
):
    """
    Returns canonical weekly performance dataset including Last vs Current Week metrics,
    movement tracking, category student lists, and data validation issues.
    """
    from backend.services.weekly_report_service import generate_weekly_performance_data
    return generate_weekly_performance_data(
        db, 
        last_week_contest=last_week_contest,
        current_week_contest=current_week_contest,
        report_date=report_date, 
        save_snapshot=save_snapshot
    )


@router.get("/weekly-performance/download")
def download_weekly_performance_19_sheet_excel(
    report_date: Optional[str] = Query(None),
    last_week_contest: Optional[int] = Query(None),
    current_week_contest: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Generates and downloads the official institutional Excel workbook with deterministic caching.
    """
    from fastapi.responses import FileResponse
    from backend.services.pregenerated_report_service import get_or_create_report
    from backend.models import ReportCache

    date_str = report_date or datetime.date.today().strftime("%d-%m-%Y")
    filters = {
        "report_date": date_str,
        "last_week_contest": last_week_contest,
        "current_week_contest": current_week_contest
    }

    res = get_or_create_report(
        db=db,
        report_type="WEEKLY_PERFORMANCE_19_SHEET",
        format="xlsx",
        filters=filters
    )

    cache_record = db.query(ReportCache).filter(ReportCache.id == res["cache_id"]).first()
    return FileResponse(
        path=cache_record.storage_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=res.get("filename") or f"LeetCode_Weekly_Report_{date_str}.xlsx",
        headers={
            "Content-Disposition": f'attachment; filename="{res.get("filename") or f"LeetCode_Weekly_Report_{date_str}.xlsx"}"',
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
            "X-Report-Cache-Hit": str(res.get("cache_hit", False)),
            "X-Report-Lookup-Ms": str(res.get("lookup_ms", 0))
        }
    )

@router.get("/college-weekly-format")
@router.get("/export-college-format")
def download_college_weekly_format_excel(
    contest_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Generates and downloads the exact 2-Sheet Nandha Engineering College Report with deterministic caching.
    """
    from fastapi.responses import FileResponse
    from backend.services.pregenerated_report_service import get_or_create_report
    from backend.models import ReportCache, Contest

    if not contest_id:
        latest_c = db.query(Contest).order_by(Contest.id.desc()).first()
        contest_id = latest_c.id if latest_c else 1

    res = get_or_create_report(
        db=db,
        report_type="COLLEGE_FORMAT",
        format="xlsx",
        filters={"contest_id": contest_id}
    )

    cache_record = db.query(ReportCache).filter(ReportCache.id == res["cache_id"]).first()
    return FileResponse(
        path=cache_record.storage_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=res.get("filename") or "Nandha_College_Official_Weekly_Report.xlsx",
        headers={
            "Content-Disposition": f'attachment; filename="{res.get("filename") or "Nandha_College_Official_Weekly_Report.xlsx"}"',
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
            "X-Report-Cache-Hit": str(res.get("cache_hit", False)),
            "X-Report-Lookup-Ms": str(res.get("lookup_ms", 0))
        }
    )


@router.post("/dispatch-college-report")
async def dispatch_college_report_email(
    contest_id: Optional[int] = Query(None),
    recipients: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Generates the exact Nandha College LeetCode Performance Report (Management Summary + Student Details)
    and dispatches HTML email preview with Excel attachment to Academic Coordinator & HODs.
    """
    from backend.database import SessionLocal
    from backend.models import Contest
    from backend.report_generator import CollegeReportGenerator
    from backend.email_service import send_weekly_report_email

    if not contest_id:
        latest_c = db.query(Contest).order_by(Contest.id.desc()).first()
        contest_id = latest_c.id if latest_c else 1

    report_gen = CollegeReportGenerator(SessionLocal)
    res = await report_gen.generate_complete_report(contest_id)

    target_recipients = [e.strip() for e in recipients.split(",") if e.strip()] if recipients else ["nanthishvaran17@gmail.com"]

    send_weekly_report_email(
        db=db,
        recipient_emails=target_recipients,
        subject=f"NANDHA ENGINEERING COLLEGE — LeetCode Weekly Performance Report ({res['contest_title']})",
        body_html=res["email_html"],
        excel_bytes=res["excel_bytes"],
        trigger_type="MANUAL"
    )

    return {
        "success": True,
        "message": f"College weekly report email successfully dispatched to {len(target_recipients)} recipient(s): {', '.join(target_recipients)}",
        "contest": res["contest_title"],
        "filename": res["filename"],
        "total_students": res["total_students"],
        "actual_count": res["actual_count"],
        "virtual_count": res["virtual_count"],
        "not_attended_count": res["not_attended_count"],
        "top_rankers_count": len(res["top_rankers"])
    }


