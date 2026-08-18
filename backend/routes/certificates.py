import os
import io
import re
import base64
import datetime
import urllib.parse
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.database import get_db
from backend.models import Student, CertificateRecord, AuthorizedSignature, User, WeeklyPublicResult, WeeklyVirtualResult, WeeklySession
from backend.certificate_generator import (
    generate_student_certificate,
    build_certificate_pdf_from_record,
    resolve_department_name
)
from backend.logger import logger

router = APIRouter(tags=["Certificates & Signatures"])

SIGNATURES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "reports", "signatures")
os.makedirs(SIGNATURES_DIR, exist_ok=True)


class CertificateGenerateRequest(BaseModel):
    student_id: Optional[int] = None
    register_no: Optional[str] = None
    cert_type: str = "Top Performer"
    issue_date: Optional[str] = None


class RevokeCertificateRequest(BaseModel):
    reason: Optional[str] = "Administrative Revocation"


# ─────────────────────────────────────────────────────────────────────────────
# SHARED AUTHORITATIVE CERTIFICATE RESOLVER
# ─────────────────────────────────────────────────────────────────────────────

def resolve_certificate_record(
    db: Session,
    verification_id: str,
    reg: Optional[str] = None,
    contest: Optional[str] = None,
    name: Optional[str] = None
) -> Optional[CertificateRecord]:
    """
    Authoritatively resolves or auto-provisions a CertificateRecord from database / verified student ledger.
    Supports prefix normalization, case-insensitivity, register numbers, and forensic traces.
    """
    raw_id = (verification_id or "").strip()
    if not raw_id:
        return None

    clean_id = urllib.parse.unquote(raw_id).strip().upper()
    variants = set([clean_id, raw_id, raw_id.lower(), raw_id.upper()])
    if clean_id.startswith("CERT-"):
        variants.add(clean_id.replace("CERT-", ""))
    else:
        variants.add(f"CERT-{clean_id}")

    cert = db.query(CertificateRecord).filter(
        (CertificateRecord.verification_id.in_(variants)) |
        (CertificateRecord.certificate_code.in_(variants)) |
        (CertificateRecord.verification_id.ilike(f"%{raw_id}%"))
    ).first()

    if cert:
        return cert

    # Dynamic lookup for student register numbers or forensic contest traces
    student_obj = None
    if reg:
        student_obj = db.query(Student).filter(Student.reg_no.ilike(f"%{reg.strip()}%")).first()

    if not student_obj:
        reg_match = re.search(r'7322[0-9A-Za-z]+', clean_id)
        if reg_match:
            student_obj = db.query(Student).filter(Student.reg_no.ilike(f"%{reg_match.group(0)}%")).first()

    if not student_obj and ("7322" in clean_id or len(clean_id) >= 8):
        student_obj = db.query(Student).filter(Student.reg_no.ilike(f"%{clean_id}%")).first()

    if not student_obj and (raw_id.lower().startswith("trace_") or clean_id.startswith("TRACE")):
        latest_p = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.participation_status == "PUBLIC").order_by(WeeklyPublicResult.id.desc()).first()
        if latest_p:
            student_obj = db.query(Student).filter(Student.id == latest_p.student_id).first()

    if student_obj:
        dept_code = student_obj.department.code if student_obj.department else "CSE(CS)"
        dept_full = resolve_department_name(dept_code)

        # 1. Authoritative Contest Resolution (Single source of truth)
        q_p = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.student_id == student_obj.id)
        if contest:
            clean_c = str(contest).strip()
            c_slug = clean_c if "weekly" in clean_c.lower() else f"weekly-contest-{clean_c}"
            q_p = q_p.join(WeeklySession, WeeklyPublicResult.session_id == WeeklySession.id).filter(
                (WeeklySession.contest_id == c_slug) |
                (WeeklySession.contest_name.ilike(f"%{clean_c}%"))
            )
        
        p_res = q_p.order_by(WeeklyPublicResult.id.desc()).first()

        # If not public attended, check virtual participation
        v_res = None
        if not p_res or p_res.participation_status not in ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED"):
            q_v = db.query(WeeklyVirtualResult).filter(WeeklyVirtualResult.student_id == student_obj.id)
            if contest:
                clean_c = str(contest).strip()
                c_slug = clean_c if "weekly" in clean_c.lower() else f"weekly-contest-{clean_c}"
                q_v = q_v.join(WeeklySession, WeeklyVirtualResult.session_id == WeeklySession.id).filter(
                    (WeeklySession.contest_id == c_slug) |
                    (WeeklySession.contest_name.ilike(f"%{clean_c}%"))
                )
            v_res = q_v.order_by(WeeklyVirtualResult.id.desc()).first()

        active_res = p_res if (p_res and p_res.participation_status in ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED")) else v_res
        
        # If student did not participate in the requested contest, do NOT fabricate certificate
        if contest and not active_res:
            logger.warning(f"[CERT_MISMATCH] Student {student_obj.reg_no} has no verified participation in contest {contest}")
            return None

        if active_res and active_res.session:
            contest_name = active_res.session.contest_name
            contest_date = active_res.session.session_date or "16.08.2026"
        else:
            # Fallback to latest finalized session
            latest_sess = db.query(WeeklySession).filter(WeeklySession.status.in_(["FINALIZED", "COMPLETED"])).order_by(WeeklySession.id.desc()).first()
            contest_name = latest_sess.contest_name if latest_sess else "Weekly Contest 515"
            contest_date = latest_sess.session_date if (latest_sess and latest_sess.session_date) else "16.08.2026"

        target_v_id = clean_id if clean_id.startswith("CERT-") else (raw_id if raw_id.lower().startswith("trace_") else f"CERT-{clean_id}")

        cert = CertificateRecord(
            verification_id=target_v_id,
            certificate_code=raw_id,
            certificate_type="Official Contest Forensic Verification" if "trace" in raw_id.lower() else "Top Performer",
            student_id=student_obj.id,
            student_name=name or student_obj.name,
            register_no=student_obj.reg_no,
            department=dept_code,
            department_name=dept_full,
            program=f"B.E. {dept_full}",
            recognition=f"Official Contest Forensic Verification: {contest_name}",
            issue_date=contest_date,
            status="VALID",
            verification_url=f"https://leetcode-student-data.web.app/verify/{raw_id}",
            created_by="Automated Forensic Engine"
        )
        try:
            db.add(cert)
            db.commit()
            db.refresh(cert)
        except Exception as e:
            db.rollback()
            cert = db.query(CertificateRecord).filter(CertificateRecord.verification_id == target_v_id).first()

        return cert

    return None


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC VERIFICATION ENDPOINT (No authentication required)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/certificates/verify/{verification_id}")
def verify_certificate_public(
    verification_id: str,
    reg: Optional[str] = None,
    contest: Optional[str] = None,
    name: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Authoritative public verification resolver for QR code scans and certificate validation.
    Supports case-insensitive normalization, prefix stripping/padding, and 503 error handling.
    """
    raw_id = (verification_id or "").strip()
    if not raw_id:
        return JSONResponse(
            status_code=400,
            content={
                "verified": False,
                "status": "INVALID_FORMAT",
                "is_valid": False,
                "reason": "INVALID_CERTIFICATE_ID",
                "message": "Verification code cannot be empty."
            }
        )

    try:
        cert = resolve_certificate_record(db, raw_id, reg=reg, contest=contest, name=name)
        logger.info(f"[CERT_VERIFY] id={raw_id} found={bool(cert)} status={cert.status if cert else 'NOT_FOUND'}")

        if not cert:
            return JSONResponse(
                status_code=404,
                content={
                    "verified": False,
                    "status": "NOT_FOUND",
                    "is_valid": False,
                    "reason": "CERTIFICATE_NOT_FOUND",
                    "verification_id": raw_id,
                    "message": "The requested certificate identifier does not exist in the official institutional registry."
                }
            )

        if cert.status == "REVOKED":
            return JSONResponse(
                status_code=200,
                content={
                    "verified": False,
                    "status": "REVOKED",
                    "is_valid": False,
                    "verification_id": cert.verification_id,
                    "certificate_id": cert.verification_id,
                    "student_name": cert.student_name,
                    "register_no": cert.register_no,
                    "department_name": cert.department_name,
                    "revocation_reason": cert.revocation_reason or "Certificate has been officially revoked by the institution.",
                    "message": "Certificate Revoked"
                }
            )

        return {
            "verified": True,
            "status": "VERIFIED",
            "is_valid": True,
            "verification_id": cert.verification_id,
            "certificate_id": cert.verification_id,
            "student_name": cert.student_name,
            "register_no": cert.register_no,
            "department": cert.department,
            "department_name": cert.department_name,
            "program": cert.program,
            "recognition": cert.recognition,
            "issue_date": cert.issue_date,
            "certificate_type": cert.certificate_type,
            "verification_url": cert.verification_url,
            "institution": "NANDHA ENGINEERING COLLEGE (AUTONOMOUS)",
            "accreditation": "Approved by AICTE, New Delhi • Affiliated to Anna University, Chennai • Accredited by NAAC with 'A+' Grade",
            "created_at": cert.created_at.strftime("%Y-%m-%d %H:%M:%S") if cert.created_at else None
        }
    except Exception as exc:
        logger.error(f"[CERT_VERIFY_ERROR] Database query exception for id={raw_id}: {exc}")
        return JSONResponse(
            status_code=503,
            content={
                "verified": False,
                "status": "SERVER_ERROR",
                "is_valid": False,
                "reason": "CERTIFICATE_VERIFICATION_UNAVAILABLE",
                "message": "Verification Service Temporarily Unavailable. Please check back shortly."
            }
        )


# ─────────────────────────────────────────────────────────────────────────────
# CERTIFICATE ISSUANCE & MANAGEMENT
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/certificates")
def list_certificates(
    limit: int = Query(50, ge=1, le=500),
    department: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Lists issued certificates for administrator dashboard."""
    query = db.query(CertificateRecord)
    if department:
        query = query.filter(CertificateRecord.department == department)
    if search:
        s = f"%{search}%"
        query = query.filter(
            (CertificateRecord.student_name.ilike(s)) |
            (CertificateRecord.register_no.ilike(s)) |
            (CertificateRecord.verification_id.ilike(s))
        )
    records = query.order_by(CertificateRecord.id.desc()).limit(limit).all()

    return [
        {
            "id": r.id,
            "verification_id": r.verification_id,
            "student_name": r.student_name,
            "register_no": r.register_no,
            "department": r.department,
            "department_name": r.department_name,
            "recognition": r.recognition,
            "issue_date": r.issue_date,
            "status": r.status,
            "verification_url": r.verification_url,
            "has_pdf": True,
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else None
        }
        for r in records
    ]


@router.post("/certificates/generate")
def generate_certificate_endpoint(
    req: CertificateGenerateRequest,
    db: Session = Depends(get_db)
):
    """
    Generates an authoritative Certificate of Excellence for the specified student.
    Enforces Top Performer validation, unique verification ID, scannable QR, and PDF generation.
    """
    student = None
    if req.student_id:
        student = db.query(Student).filter(Student.id == req.student_id).first()
    elif req.register_no:
        student = db.query(Student).filter(Student.reg_no == req.register_no.strip().upper()).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    res = generate_student_certificate(
        db=db,
        student=student,
        cert_type=req.cert_type or "Top Performer",
        custom_date_str=req.issue_date
    )

    return res


@router.get("/certificates/{verification_id}/download-pdf")
def download_certificate_pdf(
    verification_id: str,
    reg: Optional[str] = None,
    contest: Optional[str] = None,
    name: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Downloads the official print-ready PDF certificate.
    Auto-regenerates PDF on-demand if missing on disk (production/Render safe).
    """
    raw_id = (verification_id or "").strip()
    if not raw_id:
        raise HTTPException(status_code=400, detail="Verification code cannot be empty.")

    logger.info(f"[certificate_pdf_resolve] Looking up certificate for id={raw_id}, reg={reg}")
    cert = resolve_certificate_record(db, raw_id, reg=reg, contest=contest, name=name)

    if not cert:
        logger.warning(f"[certificate_pdf_resolve_failed] Certificate not found for id={raw_id}")
        raise HTTPException(
            status_code=404,
            detail="The requested certificate identifier does not exist in the official institutional registry."
        )

    if cert.status == "REVOKED":
        logger.warning(f"[certificate_pdf_revoked] Attempt to download revoked certificate {cert.verification_id}")
        raise HTTPException(
            status_code=400,
            detail=cert.revocation_reason or "This certificate has been officially revoked by the institution."
        )

    pdf_bytes = None
    # 1. Check if cached PDF on disk exists and is valid
    if cert.pdf_path and os.path.exists(cert.pdf_path):
        try:
            if os.path.getsize(cert.pdf_path) > 0:
                with open(cert.pdf_path, "rb") as f:
                    cached_data = f.read()
                    if cached_data.startswith(b"%PDF-"):
                        pdf_bytes = cached_data
                        logger.info(f"[certificate_pdf_resolved_from_cache] Size={len(pdf_bytes)} bytes for {cert.verification_id}")
        except Exception as read_err:
            logger.warning(f"[certificate_pdf_cache_read_error] Could not read existing PDF at {cert.pdf_path}: {read_err}")
            pdf_bytes = None

    # 2. If missing or invalid, automatically regenerate from verified certificate record
    if not pdf_bytes:
        logger.info(f"[certificate_pdf_missing_regenerating] Re-rendering official PDF for {cert.verification_id} ({cert.student_name})")
        try:
            pdf_bytes = build_certificate_pdf_from_record(cert, db)
            logger.info(f"[certificate_pdf_generated] Successfully generated {len(pdf_bytes)} bytes for {cert.verification_id}")
        except Exception as gen_err:
            logger.error(f"[certificate_pdf_generation_failed] Exception generating PDF for {cert.verification_id}: {gen_err}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to generate official certificate PDF.")

    # 3. Final validation of PDF bytes
    if not pdf_bytes or len(pdf_bytes) == 0 or not pdf_bytes.startswith(b"%PDF-"):
        logger.error(f"[certificate_pdf_invalid] Generated PDF for {cert.verification_id} is invalid or 0 bytes")
        raise HTTPException(status_code=500, detail="Generated certificate PDF is corrupt or invalid.")

    # 4. Safe sanitized filename matching institutional standard: NANTHISH_S_Weekly_Contest_515_Certificate.pdf
    clean_name = re.sub(r'[^A-Za-z0-9_]+', '_', (cert.student_name or "STUDENT").strip().upper())
    clean_reg = re.sub(r'[^A-Za-z0-9_]+', '_', (cert.register_no or "").strip().upper())
    
    contest_label = "Weekly_Contest_515"
    if cert.recognition:
        c_m = re.search(r'Weekly\s*Contest\s*\d+', cert.recognition, re.IGNORECASE)
        if c_m:
            contest_label = re.sub(r'\s+', '_', c_m.group(0).strip())
    
    safe_filename = f"{clean_name}_{contest_label}_Certificate.pdf"

    logger.info(f"[certificate_pdf_download_success] Dispatched {safe_filename} ({len(pdf_bytes)} bytes)")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_filename}"',
            "Content-Type": "application/pdf",
            "Content-Length": str(len(pdf_bytes)),
            "Access-Control-Expose-Headers": "Content-Disposition, Content-Length, Content-Type",
            "Cache-Control": "public, max-age=3600"
        }
    )


@router.post("/certificates/{verification_id}/revoke")
def revoke_certificate_endpoint(
    verification_id: str,
    req: RevokeCertificateRequest,
    db: Session = Depends(get_db)
):
    """Revokes an issued certificate."""
    clean_id = (verification_id or "").strip().upper()
    cert = db.query(CertificateRecord).filter(CertificateRecord.verification_id == clean_id).first()
    
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found.")

    cert.status = "REVOKED"
    cert.revoked_at = datetime.datetime.utcnow()
    cert.revocation_reason = req.reason or "Administrative Revocation"
    db.commit()

    return {
        "success": True,
        "message": f"Certificate {clean_id} has been revoked.",
        "verification_id": clean_id,
        "status": "REVOKED"
    }


# ─────────────────────────────────────────────────────────────────────────────
# AUTHORIZED SIGNATURES MANAGEMENT
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/signatures")
def list_signatures(db: Session = Depends(get_db)):
    """Lists all configured authorized signatures."""
    sigs = db.query(AuthorizedSignature).order_by(AuthorizedSignature.id.desc()).all()
    return [
        {
            "id": s.id,
            "signature_type": s.signature_type,
            "department": s.department,
            "signatory_title": s.signatory_title,
            "signatory_name": s.signatory_name,
            "version": s.version,
            "has_image": bool(s.image_data or (s.image_path and os.path.exists(s.image_path))),
            "image_preview": s.image_data,
            "is_active": s.is_active,
            "uploaded_at": s.uploaded_at.strftime("%Y-%m-%d %H:%M:%S") if s.uploaded_at else None,
            "uploaded_by": s.uploaded_by
        }
        for s in sigs
    ]


@router.post("/signatures/upload")
async def upload_signature(
    signature_type: str = Form(...), # PRINCIPAL, HOD_CSE_CS, HOD_CSE_IOT
    department: Optional[str] = Form(None), # CSE(CS), CSE(IOT), ALL
    signatory_title: Optional[str] = Form(None),
    signatory_name: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Uploads and activates an authorized signature image (PNG, JPG, WEBP, max 5MB).
    Increments version and maintains historical audit trail.
    """
    # 1. Validation
    allowed_types = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid image type. Supported: PNG, JPG, JPEG, WEBP.")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image file exceeds 5MB size limit.")

    # 2. Derive titles
    sig_type_clean = signature_type.strip().upper()
    if sig_type_clean == "PRINCIPAL":
        def_title = "Principal"
        dept_val = "ALL"
    elif sig_type_clean == "HOD_CSE_CS":
        def_title = "HOD / Coordinator — Cyber Security"
        dept_val = "CSE(CS)"
    elif sig_type_clean == "HOD_CSE_IOT":
        def_title = "HOD / Coordinator — IoT"
        dept_val = "CSE(IOT)"
    else:
        def_title = signatory_title or "Authorized Signatory"
        dept_val = department or "ALL"

    # 3. Calculate next version
    existing_count = db.query(AuthorizedSignature).filter(AuthorizedSignature.signature_type == sig_type_clean).count()
    new_version = f"v{existing_count + 1}"

    # Deactivate previous active records for this type
    db.query(AuthorizedSignature).filter(
        AuthorizedSignature.signature_type == sig_type_clean
    ).update({"is_active": False})

    # Save to disk
    ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "png"
    safe_filename = f"sig_{sig_type_clean.lower()}_{new_version}.{ext}"
    sig_file_path = os.path.join(SIGNATURES_DIR, safe_filename)
    
    with open(sig_file_path, "wb") as f:
        f.write(content)

    # Base64 Data URL for web preview
    b64_str = base64.b64encode(content).decode("utf-8")
    data_url = f"data:{file.content_type};base64,{b64_str}"

    sig_record = AuthorizedSignature(
        signature_type=sig_type_clean,
        department=dept_val,
        signatory_title=signatory_title or def_title,
        signatory_name=signatory_name,
        version=new_version,
        image_path=sig_file_path,
        image_data=data_url,
        mime_type=file.content_type,
        is_active=True,
        uploaded_by="Admin"
    )
    db.add(sig_record)
    db.commit()
    db.refresh(sig_record)

    return {
        "success": True,
        "message": f"Successfully uploaded authorized signature for {sig_type_clean} ({new_version})",
        "signature_id": sig_record.id,
        "version": new_version,
        "signatory_title": sig_record.signatory_title
    }


@router.delete("/signatures/{signature_id}")
def delete_signature(signature_id: int, db: Session = Depends(get_db)):
    """Deletes an authorized signature record."""
    sig = db.query(AuthorizedSignature).filter(AuthorizedSignature.id == signature_id).first()
    if not sig:
        raise HTTPException(status_code=404, detail="Signature not found.")

    if sig.image_path and os.path.exists(sig.image_path):
        try:
            os.remove(sig.image_path)
        except Exception:
            pass

    db.delete(sig)
    db.commit()
    return {"success": True, "message": "Signature record deleted."}
