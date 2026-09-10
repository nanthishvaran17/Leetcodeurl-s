import os
import re
import uuid
import hashlib
import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel, EmailStr

from backend.database import get_db, engine
from backend.models import StaffVerification, User, Department
from backend.routes.auth import get_current_user
from backend.logger import logger

router = APIRouter(prefix="/api/staff-verification", tags=["Staff Verification"])

# Ensure private document directory exists (not exposed via static router)
PRIVATE_STORAGE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "storage", "private_documents", "staff_verifications"))
os.makedirs(PRIVATE_STORAGE_DIR, exist_ok=True)

# Create table automatically if not exists
try:
    StaffVerification.__table__.create(bind=engine, checkfirst=True)
except Exception as _t_err:
    logger.warning(f"[STAFF VERIFICATION] Table creation check note: {_t_err}")

# Allowed MIME types and extensions for employee ID proof
ALLOWED_MIME_TYPES = {"application/pdf", "image/jpeg", "image/jpg", "image/png"}
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

_REVIEWER_ROLES = {"super admin", "admin", "super_admin", "hod", "department hod", "principal", "management"}

def _is_reviewer(user: User) -> bool:
    if not user:
        return False
    role_norm = (getattr(user, "override_role", None) or user.role or "").strip().lower()
    return role_norm in _REVIEWER_ROLES

def _format_verification_dict(v: StaffVerification) -> dict:
    return {
        "id": v.id,
        "user_id": v.user_id,
        "staff_name": v.user.full_name or v.user.username if v.user else "Unknown Staff",
        "user_username": v.user.username if v.user else "",
        "employee_id": v.employee_id,
        "official_email": v.official_email,
        "department_id": v.department_id,
        "department_name": v.department.name if v.department else "",
        "department_code": v.department.code if v.department else "",
        "designation": v.designation,
        "reporting_to_user_id": v.reporting_to_user_id,
        "reporting_to_name": v.reporting_to_user.full_name or v.reporting_to_user.username if v.reporting_to_user else None,
        "has_document": bool(v.document_storage_key),
        "document_original_name": v.document_original_name,
        "verification_status": v.verification_status,
        "verified_by": v.verified_by,
        "verified_by_name": v.reviewer.full_name or v.reviewer.username if v.reviewer else None,
        "verified_at": v.verified_at.isoformat() if v.verified_at else None,
        "rejection_reason": v.rejection_reason,
        "created_at": v.created_at.isoformat() if v.created_at else None,
        "updated_at": v.updated_at.isoformat() if v.updated_at else None,
    }


class RejectPayload(BaseModel):
    rejection_reason: str


@router.get("/reporters")
def get_reporting_managers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns candidate staff/admin users for 'Reports To' dropdown."""
    users = db.query(User).filter(
        User.is_active == True,
        User.id != current_user.id
    ).order_by(User.full_name.asc(), User.username.asc()).all()
    
    return [
        {
            "id": u.id,
            "name": u.full_name or u.username,
            "designation": u.designation or u.role,
            "department_id": u.department_id
        }
        for u in users
    ]


@router.get("/me")
def get_my_staff_verification(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Gets the logged-in user's Staff Verification status."""
    v = (
        db.query(StaffVerification)
        .options(
            joinedload(StaffVerification.user),
            joinedload(StaffVerification.department),
            joinedload(StaffVerification.reporting_to_user),
            joinedload(StaffVerification.reviewer)
        )
        .filter(StaffVerification.user_id == current_user.id)
        .order_by(StaffVerification.created_at.desc())
        .first()
    )
    if not v:
        return {"has_submission": False, "verification": None}
    return {"has_submission": True, "verification": _format_verification_dict(v)}


@router.post("")
async def submit_staff_verification(
    employee_id: str = Form(...),
    official_email: str = Form(...),
    department_id: int = Form(...),
    designation: str = Form(...),
    reporting_to_user_id: Optional[int] = Form(None),
    document: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submits institutional staff verification details with optional proof document."""
    # 1. Server-side validation
    emp_id_clean = employee_id.strip()
    if not emp_id_clean:
        raise HTTPException(status_code=400, detail="Employee ID is required.")

    email_clean = official_email.strip().lower()
    if not email_clean:
        raise HTTPException(status_code=400, detail="Official institutional email is required.")
    
    # Strict email format validation
    email_regex = r"^[\w\.-]+@[\w\.-]+\.\w+$"
    if not re.match(email_regex, email_clean):
        raise HTTPException(status_code=400, detail="Invalid institutional email format.")

    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=400, detail="Selected department is invalid or does not exist.")

    desig_clean = designation.strip()
    if not desig_clean:
        raise HTTPException(status_code=400, detail="Designation is required.")

    if reporting_to_user_id:
        rep_user = db.query(User).filter(User.id == reporting_to_user_id, User.is_active == True).first()
        if not rep_user:
            raise HTTPException(status_code=400, detail="Selected reporting manager is invalid.")

    # 2. File Validation & Private Storage
    doc_storage_key = None
    doc_orig_name = None
    doc_hash = None

    if document and document.filename:
        file_bytes = await document.read()
        file_size = len(file_bytes)

        if file_size > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="Document exceeds maximum allowed size of 5 MB.")

        ext = os.path.splitext(document.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS or document.content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=400,
                detail="Unsupported document type. Only PDF, JPG, and PNG documents are allowed."
            )

        doc_orig_name = os.path.basename(document.filename)
        doc_hash = hashlib.sha256(file_bytes).hexdigest()
        filename_unique = f"verif_{current_user.id}_{uuid.uuid4().hex[:10]}{ext}"
        doc_storage_key = os.path.join(PRIVATE_STORAGE_DIR, filename_unique)

        # Write to private storage
        with open(doc_storage_key, "wb") as f:
            f.write(file_bytes)

    # 3. Prevent duplicate active verified records
    existing = db.query(StaffVerification).filter(StaffVerification.user_id == current_user.id).first()
    if existing and existing.verification_status == "VERIFIED":
        raise HTTPException(status_code=400, detail="Your staff verification request has already been verified.")

    if existing:
        existing.employee_id = emp_id_clean
        existing.official_email = email_clean
        existing.department_id = department_id
        existing.designation = desig_clean
        existing.reporting_to_user_id = reporting_to_user_id
        if doc_storage_key:
            existing.document_storage_key = doc_storage_key
            existing.document_original_name = doc_orig_name
            existing.document_hash = doc_hash
        existing.verification_status = "PENDING"
        existing.rejection_reason = None
        existing.updated_at = datetime.datetime.utcnow()
        v_record = existing
    else:
        v_record = StaffVerification(
            user_id=current_user.id,
            employee_id=emp_id_clean,
            official_email=email_clean,
            department_id=department_id,
            designation=desig_clean,
            reporting_to_user_id=reporting_to_user_id,
            document_storage_key=doc_storage_key,
            document_original_name=doc_orig_name,
            document_hash=doc_hash,
            verification_status="PENDING"
        )
        db.add(v_record)

    # Also update user institutional_id & designation if empty for non-regression parity
    if not current_user.institutional_id:
        current_user.institutional_id = emp_id_clean
    if not current_user.designation:
        current_user.designation = desig_clean
    if not current_user.department_id:
        current_user.department_id = department_id
    if reporting_to_user_id and not current_user.reporting_manager_id:
        current_user.reporting_manager_id = reporting_to_user_id

    db.commit()
    db.refresh(v_record)

    return {
        "message": "Staff verification submitted successfully. Status set to PENDING VERIFICATION.",
        "verification": _format_verification_dict(v_record)
    }


@router.get("/all")
def get_all_staff_verifications(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Admin / Reviewer: Retrieves all staff verification submissions."""
    if not _is_reviewer(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Admin or Reviewer role required to access verification records."
        )

    q = (
        db.query(StaffVerification)
        .options(
            joinedload(StaffVerification.user),
            joinedload(StaffVerification.department),
            joinedload(StaffVerification.reporting_to_user),
            joinedload(StaffVerification.reviewer)
        )
    )

    if status_filter and status_filter.upper() != "ALL":
        q = q.filter(StaffVerification.verification_status == status_filter.upper())

    verifications = q.order_by(StaffVerification.created_at.desc()).all()
    return [_format_verification_dict(v) for v in verifications]


@router.get("/{verification_id}")
def get_staff_verification_detail(
    verification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Gets details of a specific staff verification record."""
    v = (
        db.query(StaffVerification)
        .options(
            joinedload(StaffVerification.user),
            joinedload(StaffVerification.department),
            joinedload(StaffVerification.reporting_to_user),
            joinedload(StaffVerification.reviewer)
        )
        .filter(StaffVerification.id == verification_id)
        .first()
    )
    if not v:
        raise HTTPException(status_code=404, detail="Staff verification record not found.")

    if v.user_id != current_user.id and not _is_reviewer(current_user):
        raise HTTPException(status_code=403, detail="Unauthorized to view this verification record.")

    return _format_verification_dict(v)


@router.get("/{verification_id}/document")
def download_verification_document(
    verification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Secure document download/preview. Requires authentication and authorization. Never public."""
    v = db.query(StaffVerification).filter(StaffVerification.id == verification_id).first()
    if not v or not v.document_storage_key:
        raise HTTPException(status_code=404, detail="Verification document not found.")

    if v.user_id != current_user.id and not _is_reviewer(current_user):
        raise HTTPException(status_code=403, detail="Unauthorized to access this verification document.")

    file_path = v.document_storage_key
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Document file does not exist on disk.")

    ext = os.path.splitext(file_path)[1].lower()
    media_type = "application/pdf" if ext == ".pdf" else f"image/{ext.replace('.', '')}"
    filename = v.document_original_name or f"employee_id_proof{ext}"

    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=filename,
        headers={"Cache-Control": "no-store, private"}
    )


@router.post("/{verification_id}/review")
def mark_under_review(
    verification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reviewer action: Marks status as UNDER_REVIEW."""
    if not _is_reviewer(current_user):
        raise HTTPException(status_code=403, detail="Unauthorized review action.")

    v = db.query(StaffVerification).filter(StaffVerification.id == verification_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Staff verification record not found.")

    v.verification_status = "UNDER_REVIEW"
    v.updated_at = datetime.datetime.utcnow()
    db.commit()

    return {"message": "Verification status updated to UNDER_REVIEW.", "status": "UNDER_REVIEW"}


@router.post("/{verification_id}/verify")
def verify_staff(
    verification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reviewer action: Marks status as VERIFIED."""
    if not _is_reviewer(current_user):
        raise HTTPException(status_code=403, detail="Unauthorized verification action.")

    v = db.query(StaffVerification).filter(StaffVerification.id == verification_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Staff verification record not found.")

    v.verification_status = "VERIFIED"
    v.verified_by = current_user.id
    v.verified_at = datetime.datetime.utcnow()
    v.rejection_reason = None
    v.updated_at = datetime.datetime.utcnow()

    db.commit()

    return {"message": "Staff verification approved.", "status": "VERIFIED"}


@router.post("/{verification_id}/reject")
def reject_staff(
    verification_id: int,
    payload: RejectPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reviewer action: Marks status as REJECTED with mandatory rejection_reason."""
    if not _is_reviewer(current_user):
        raise HTTPException(status_code=403, detail="Unauthorized rejection action.")

    reason_clean = payload.rejection_reason.strip()
    if not reason_clean:
        raise HTTPException(status_code=400, detail="Rejection reason is required.")

    v = db.query(StaffVerification).filter(StaffVerification.id == verification_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Staff verification record not found.")

    v.verification_status = "REJECTED"
    v.rejection_reason = reason_clean
    v.verified_by = current_user.id
    v.verified_at = datetime.datetime.utcnow()
    v.updated_at = datetime.datetime.utcnow()

    db.commit()

    return {"message": "Staff verification rejected.", "status": "REJECTED", "rejection_reason": reason_clean}
