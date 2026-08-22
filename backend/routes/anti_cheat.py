"""
anti_cheat.py — API Endpoints for Anti-Cheat & Plagiarism Detection
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from backend.database import get_db
from backend.models import User
from backend.security import require_role
from backend.services.plagiarism_detection_service import plagiarism_detection_service

router = APIRouter(prefix="/anti-cheat", tags=["Anti-Cheat & Plagiarism Detection"])


class ReviewIncidentRequest(BaseModel):
    incident_id: int
    action: str  # CONFIRMED, DISMISSED, ESCALATED
    notes: str = ""


@router.get("/flags")
def get_plagiarism_flags(
    dept_code: Optional[str] = Query("ALL"),
    severity: Optional[str] = Query("ALL"),
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin", "HOD", "hod", "Faculty", "faculty", dept_scoped=True))
):
    """Returns real-time plagiarism and time-clustering fraud flags."""
    user_role = (current_user.role or "").strip().lower()
    target_dept = current_user.department.code if (user_role in ["hod", "faculty"] and current_user.department) else dept_code
    return plagiarism_detection_service.get_flagged_incidents(dept_code=target_dept, severity=severity)


@router.post("/scan-session")
def scan_session_for_plagiarism(
    session_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin", "HOD", "hod"))
):
    """Triggers instant anti-cheat timing clustering scan across contest submissions."""
    return plagiarism_detection_service.analyze_contest_session(db, session_id)


@router.post("/review")
def review_plagiarism_incident(
    payload: ReviewIncidentRequest,
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin", "HOD", "hod"))
):
    """Records faculty/HOD disposition on a flagged plagiarism incident."""
    res = plagiarism_detection_service.review_incident(
        incident_id=payload.incident_id,
        action=payload.action,
        reviewer_name=current_user.username,
        notes=payload.notes
    )
    if not res["success"]:
        raise HTTPException(status_code=404, detail=res.get("error", "Incident not found"))
    return res
