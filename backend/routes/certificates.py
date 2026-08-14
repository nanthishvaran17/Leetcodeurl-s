import os
import io
import base64
import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.database import get_db
from backend.models import Student, CertificateRecord, AuthorizedSignature, User
from backend.certificate_generator import generate_student_certificate, resolve_department_name
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
# PUBLIC VERIFICATION ENDPOINT (No authentication required)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/certificates/verify/{verification_id}")
def verify_certificate_public(verification_id: str, db: Session = Depends(get_db)):
    """
    Public verification resolver for QR code scans and certificate validation.
    Route: /verify/{verification_id}
    """
    clean_id = (verification_id or "").strip().upper()
    cert = db.query(CertificateRecord).filter(CertificateRecord.verification_id == clean_id).first()
    
    if not cert:
        return JSONResponse(
            status_code=404,
            content={
                "status": "NOT_VERIFIED",
                "is_valid": False,
                "verification_id": clean_id,
                "message": "Certificate verification ID not found or invalid."
            }
        )

    if cert.status == "REVOKED":
        return JSONResponse(
            status_code=200,
            content={
                "status": "REVOKED",
                "is_valid": False,
                "verification_id": cert.verification_id,
                "student_name": cert.student_name,
                "register_no": cert.register_no,
                "department_name": cert.department_name,
                "revocation_reason": cert.revocation_reason or "Certificate has been officially revoked by the institution.",
                "message": "Certificate Revoked"
            }
        )

    return {
        "status": "VERIFIED",
        "is_valid": True,
        "verification_id": cert.verification_id,
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
            "has_pdf": bool(r.pdf_path and os.path.exists(r.pdf_path)),
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
def download_certificate_pdf(verification_id: str, db: Session = Depends(get_db)):
    """Downloads the print-ready PDF certificate."""
    clean_id = (verification_id or "").strip().upper()
    cert = db.query(CertificateRecord).filter(CertificateRecord.verification_id == clean_id).first()
    
    if not cert or not cert.pdf_path or not os.path.exists(cert.pdf_path):
        raise HTTPException(status_code=404, detail="Certificate PDF not found.")

    filename = f"Nandha_Certificate_{cert.register_no}_{cert.verification_id}.pdf"
    return FileResponse(
        cert.pdf_path,
        media_type="application/pdf",
        filename=filename
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
