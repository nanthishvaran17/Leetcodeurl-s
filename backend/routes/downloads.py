import os
import time
import secrets
import hashlib
import threading
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, AdminAuditLog
from backend.security import require_security_access, extract_current_user_optional, log_security_access_event
from backend.logger import logger

router = APIRouter(prefix="/api/downloads", tags=["Global Downloads"])

# ── IN-MEMORY SECURE TOKEN STORE ─────────────────────────────────────────────
# Token records stored by token_hash to avoid logging/exposing raw tokens
_TOKEN_LOCK = threading.Lock()
_SECURE_DOWNLOAD_TOKENS: Dict[str, Dict[str, Any]] = {}


def _cleanup_expired_tokens():
    """Purges token hashes expired more than 5 minutes ago."""
    now = time.time()
    with _TOKEN_LOCK:
        expired_keys = [k for k, v in _SECURE_DOWNLOAD_TOKENS.items() if now > (v.get("expires_at", 0) + 300.0)]
        for k in expired_keys:
            _SECURE_DOWNLOAD_TOKENS.pop(k, None)


class PrepareDownloadPayload(BaseModel):
    endpoint: str
    filename: Optional[str] = None
    mime_type: Optional[str] = None
    params: Optional[Dict[str, Any]] = {}
    method: Optional[str] = "GET"


@router.post("/prepare")
def prepare_secure_download(
    payload: PrepareDownloadPayload,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_security_access(resource_name="Prepare Secure Download", dept_scoped=False))
):
    """
    AUTHENTICATED SECURE DOWNLOAD PREPARATION ENDPOINT
    Validates user authentication, role, and institution authorization.
    Creates a cryptographically random, short-lived (60s), one-time download token.
    Returns secure temporary download URL without exposing access tokens.
    """
    _cleanup_expired_tokens()

    if not payload.endpoint:
        raise HTTPException(status_code=400, detail="Target download endpoint is required.")

    # Generate 256-bit cryptographically secure random token
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()

    user_inst = getattr(current_user, "institution_id", None) or "NEC"
    user_role = getattr(current_user, "role", "User")
    suggested_filename = payload.filename or "download_file"

    expires_at = time.time() + 60.0  # 60 seconds TTL

    with _TOKEN_LOCK:
        _SECURE_DOWNLOAD_TOKENS[token_hash] = {
            "user_id": current_user.id,
            "username": current_user.username,
            "user_role": user_role,
            "institution_id": user_inst,
            "endpoint": payload.endpoint,
            "filename": suggested_filename,
            "mime_type": payload.mime_type or "application/octet-stream",
            "params": payload.params or {},
            "method": (payload.method or "GET").upper(),
            "created_at": time.time(),
            "expires_at": expires_at,
            "is_used": False
        }

    secure_url = f"/api/downloads/secure/{raw_token}"
    logger.info(f"[DOWNLOAD PREPARE] Token generated for user_id={current_user.id}, endpoint={payload.endpoint}, filename={suggested_filename}")

    return {
        "download_url": secure_url,
        "filename": suggested_filename,
        "mime_type": payload.mime_type or "application/octet-stream",
        "expires_in": 60,
        "status": "READY"
    }


@router.get("/secure/{token}")
def execute_secure_download(
    token: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    PUBLIC SECURE DOWNLOAD DISPATCHER
    Validates token hash, expiration, and single-use status.
    Executes underlying resource generation/stream in user's authorized context.
    Enforces strict file integrity & header validation before returning binary stream.
    """
    _cleanup_expired_tokens()

    if not token or len(token) < 16:
        raise HTTPException(status_code=404, detail="Invalid download authorization token.")

    token_hash = hashlib.sha256(token.encode('utf-8')).hexdigest()

    with _TOKEN_LOCK:
        token_record = _SECURE_DOWNLOAD_TOKENS.get(token_hash)
        if not token_record:
            raise HTTPException(status_code=404, detail="Download authorization token not found or invalid.")

        now = time.time()
        if now > token_record["expires_at"]:
            _SECURE_DOWNLOAD_TOKENS.pop(token_hash, None)
            raise HTTPException(status_code=410, detail="Download link expired. Please try again.")

        if token_record.get("is_used"):
            raise HTTPException(status_code=410, detail="Download link has already been used.")

        # Mark as used (One-time download protection)
        token_record["is_used"] = True

    # Retrieve user from DB to verify active status & role context
    user_id = token_record["user_id"]
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=403, detail="User account is inactive or unauthorized.")

    endpoint = token_record["endpoint"]
    suggested_filename = token_record["filename"]
    mime_type = token_record["mime_type"]
    params = token_record.get("params", {})

    logger.info(f"[SECURE DOWNLOAD EXECUTE] User={user.username} (ID: {user.id}) requesting {endpoint}")

    # Dispatch to internal handler based on target endpoint path
    try:
        content_bytes, out_mime, out_filename = _dispatch_internal_endpoint(db, user, endpoint, suggested_filename, mime_type, params)
    except HTTPException:
        raise
    except Exception as err:
        logger.error(f"[SECURE DOWNLOAD ERROR] Endpoint execution failed: {err}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Unable to download the file. Please try again.")

    # ── FILE VALIDATION ────────────────────────────────────────────────────────
    if not content_bytes or len(content_bytes) == 0:
        raise HTTPException(status_code=500, detail="Generated download file was 0 bytes.")

    # Check if content returned is JSON error payload
    if content_bytes.strip().startswith(b'{"detail"') or content_bytes.strip().startswith(b'{"error"'):
        raise HTTPException(status_code=500, detail="Download endpoint returned error payload instead of file.")

    effective_mime = out_mime or mime_type or "application/octet-stream"
    effective_filename = out_filename or suggested_filename or "download_file"

    # Audit Logging (Without raw tokens or file contents)
    try:
        audit = AdminAuditLog(
            audit_id=f"DL-{secrets.token_hex(4).upper()}",
            admin_user_id=user.id,
            admin_name=user.username,
            admin_email=user.email,
            admin_role=user.role,
            action="FILE_DOWNLOAD",
            action_type="DOWNLOAD",
            target_type="Resource",
            target_id=endpoint[:100],
            description=f"Downloaded file: {effective_filename} ({len(content_bytes)} bytes)",
            status="SUCCESS"
        )
        db.add(audit)
        db.commit()
    except Exception as _aud_err:
        db.rollback()
        logger.warning(f"Failed to record download audit: {_aud_err}")

    return Response(
        content=content_bytes,
        media_type=effective_mime,
        headers={
            "Content-Disposition": f'attachment; filename="{effective_filename}"',
            "Content-Length": str(len(content_bytes)),
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )


def _dispatch_internal_endpoint(
    db: Session,
    user: User,
    endpoint: str,
    default_filename: str,
    default_mime: str,
    params: dict
) -> tuple[bytes, str, str]:
    """
    Internal authoritative file generator dispatcher.
    Executes core exporters directly using authorized user context.
    """
    clean_endpoint = endpoint.split("?")[0].rstrip("/")

    # 1. Official College Summary Excel
    if clean_endpoint in ("/api/reports/export-official-college-summary", "/api/reports/export-excel", "/api/reports/export/excel"):
        from backend.excel_handler import generate_8_sheet_excel_report
        excel_bytes = generate_8_sheet_excel_report(db, current_user=user)
        return excel_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", default_filename or "Nandha_College_Official_Weekly_Report.xlsx"

    # 2. Student Performance Detail Excel
    elif clean_endpoint == "/api/reports/export-student-performance-detail":
        from backend.excel_handler import generate_student_performance_detail_excel
        excel_bytes = generate_student_performance_detail_excel(db, current_user=user)
        return excel_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", default_filename or "Nandha_Student_Performance_Detail.xlsx"

    # 3. Master Tracker Excel
    elif clean_endpoint == "/api/reports/export-master-tracker":
        from backend.excel_handler import generate_8_sheet_master_tracker
        excel_bytes = generate_8_sheet_master_tracker(db)
        return excel_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", default_filename or "Full_8_Sheet_Master_Tracker.xlsx"

    # 4. Weekly Contest Matrix
    elif clean_endpoint == "/api/reports/export-weekly-contest-matrix":
        from backend.excel_handler import generate_weekly_contest_matrix_excel
        batch = params.get("batch", "2028")
        dept_id = params.get("dept_id")
        excel_bytes = generate_weekly_contest_matrix_excel(db, batch_label=batch, dept_id=dept_id)
        return excel_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", default_filename or f"LeetCode_Weekly_Contest_Matrix_Batch_{batch}.xlsx"

    # 5. Executive PDF Report
    elif clean_endpoint == "/api/reports/export-pdf":
        from backend.pdf_generator import generate_pdf_summary_report
        dept_id = params.get("dept_id")
        pdf_bytes = generate_pdf_summary_report(db, dept_id=dept_id, current_user=user)
        return pdf_bytes, "application/pdf", default_filename or "LeetCode_Weekly_Performance_Summary.pdf"

    # 6. Executive Word Report
    elif clean_endpoint == "/api/reports/export-word":
        from backend.word_generator import generate_word_report
        dept_id = params.get("dept_id")
        word_bytes = generate_word_report(db, dept_id=dept_id, current_user=user)
        return word_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", default_filename or "LeetCode_Weekly_Performance_Summary.docx"

    # 7. Student CSV Export
    elif clean_endpoint == "/api/reports/export-csv":
        from backend.routes.reports import download_csv_report
        resp = download_csv_report(dept_id=params.get("dept_id"), year_level=params.get("year_level"), db=db, current_user=user)
        return resp.body, "text/csv", default_filename or "LeetCode_Student_Performance_Report.csv"

    # 8. Certificate PDF Download
    elif "/certificates/" in clean_endpoint and ("download" in clean_endpoint or "download-pdf" in clean_endpoint):
        from backend.routes.certificates import download_certificate_pdf
        parts = clean_endpoint.split("/")
        cert_id = parts[-1] if parts[-1] not in ("download", "download-pdf") else parts[-2]
        resp = download_certificate_pdf(verification_id=cert_id, reg=params.get("reg"), contest=params.get("contest"), name=params.get("name"), db=db)
        out_fn = default_filename or "Certificate.pdf"
        if resp.headers and "Content-Disposition" in resp.headers:
            disp = resp.headers["Content-Disposition"]
            if 'filename="' in disp:
                out_fn = disp.split('filename="')[1].rstrip('"')
        return resp.body, "application/pdf", out_fn

    # 9. Forensic Audit PDF Download
    elif "/certificates/" in clean_endpoint and "forensic" in clean_endpoint:
        from backend.routes.certificates import download_forensic_contest_pdf
        parts = clean_endpoint.split("/")
        identifier = parts[-1]
        resp = download_forensic_contest_pdf(verification_id=identifier, identifier=identifier, student_id=params.get("student_id"), db=db)
        return resp.body, "application/pdf", default_filename or "Forensic_Audit_Report.pdf"

    # 10. Sample Student Import Excel
    elif clean_endpoint == "/api/students/sample-excel":
        from backend.routes.students import download_sample_student_excel
        resp = download_sample_student_excel()
        return resp.body, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Student_Import_Sample.xlsx"

    # 11. Database Backup File Download
    elif "/api/settings/backups/" in clean_endpoint and clean_endpoint.endswith("/download"):
        from backend.routes.settings import download_backup_api, BACKUP_DIR
        safe_name = os.path.basename(clean_endpoint.split("/backups/")[1].replace("/download", ""))
        f_path = os.path.join(BACKUP_DIR, safe_name)
        if not os.path.exists(f_path):
            raise HTTPException(status_code=404, detail="Backup snapshot file not found.")
        with open(f_path, "rb") as f:
            b_data = f.read()
        return b_data, "application/x-sqlite3", safe_name

    # 12. Post-9:30 AM Solvers Excel Export
    elif clean_endpoint == "/api/weekly-contests/post-930-solvers/export":
        from backend.routes.weekly_contests import get_post_930_solvers
        from backend.exporters.excel_exporter import export_excel_from_dataset
        data = get_post_930_solvers(
            request=None, session_date=params.get("session_date"), dept=params.get("dept"),
            year_level=params.get("year_level"), section=params.get("section"),
            min_post_window_solves=params.get("min_post_window_solves", 1),
            sort_by="latest", search=None, student_id=None, db=db
        )
        excel_bytes = export_excel_from_dataset(data) if isinstance(data, dict) else b""
        return excel_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", default_filename or f"Post_930_Solvers_{params.get('session_date', 'Report')}.xlsx"

    # 13. Cached Report File Download
    elif "/api/reports/cached-download/" in clean_endpoint:
        cache_id = int(clean_endpoint.split("/")[-1])
        from backend.routes.reports import download_cached_report_file
        resp = download_cached_report_file(cache_id=cache_id, db=db, current_user=user)
        with open(resp.path, "rb") as f:
            f_bytes = f.read()
        return f_bytes, resp.media_type, os.path.basename(resp.path)

    # General Fallback: Attempt to generate official 8-sheet report
    else:
        logger.warning(f"[DISPATCH FALLBACK] Using standard 8-sheet Excel generator for {clean_endpoint}")
        from backend.excel_handler import generate_8_sheet_excel_report
        excel_bytes = generate_8_sheet_excel_report(db, current_user=user)
        return excel_bytes, default_mime or "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", default_filename or "LeetCode_Tracker_Export.xlsx"
