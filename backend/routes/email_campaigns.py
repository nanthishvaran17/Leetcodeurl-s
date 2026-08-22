"""
email_campaigns.py — API Endpoints for Institutional Bulk Email Campaigns & Queue Tracking
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from backend.database import get_db
from backend.models import User, EmailCampaign
from backend.security import require_role
from backend.services.bulk_email_queue import bulk_email_queue_service

router = APIRouter(prefix="/email-campaigns", tags=["Email Campaigns"])


class CreateCampaignRequest(BaseModel):
    campaign_name: str = Field(..., min_length=3, max_length=200)
    subject: str = Field(..., min_length=3, max_length=255)
    body_html: str = Field(..., min_length=10)
    scope_type: str = Field(..., description="ALL_INSTITUTION, ALL_HODS, ALL_FACULTY, ALL_STUDENTS, DEPT_ALL, DEPT_FACULTY, DEPT_STUDENTS, MY_MENTEES, CUSTOM")
    scope_id: Optional[int] = None
    custom_emails: Optional[List[str]] = None


@router.post("/create", status_code=status.HTTP_202_ACCEPTED)
def create_email_campaign(
    payload: CreateCampaignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin", "HOD", "hod", "Faculty", "faculty", "Staff", "staff", dept_scoped=True))
):
    """
    Creates and queues an institutional email campaign.
    Enforces role hierarchy (Super Admin -> Institution, HOD -> Dept, Faculty -> Mentees).
    Returns 202 Accepted immediately.
    """
    user_role = (current_user.role or "").strip().lower()

    # Scope validation
    if user_role in ["hod"]:
        if payload.scope_type not in ["DEPT_ALL", "OWN_DEPT_ALL", "DEPT_FACULTY", "OWN_DEPT_FACULTY", "DEPT_STUDENTS", "OWN_DEPT_STUDENTS"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access restricted: HOD can only dispatch campaigns to their own department."
            )
    elif user_role in ["faculty", "staff"]:
        if payload.scope_type not in ["MY_MENTEES"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access restricted: Faculty can only dispatch campaigns to assigned mentees."
            )

    return bulk_email_queue_service.create_campaign(
        db=db,
        sender=current_user,
        campaign_name=payload.campaign_name,
        subject=payload.subject,
        body_html=payload.body_html,
        scope_type=payload.scope_type,
        scope_id=payload.scope_id or current_user.department_id,
        custom_emails=payload.custom_emails
    )


@router.get("/{campaign_id}/status")
def get_campaign_status(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin", "HOD", "hod", "Faculty", "faculty"))
):
    """Returns real-time progress for an email campaign."""
    res = bulk_email_queue_service.get_campaign_status(db, campaign_id)
    if not res:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    return res


@router.get("/history")
def get_campaign_history(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin", "HOD", "hod"))
):
    """Returns list of recent institutional email campaigns."""
    user_role = (current_user.role or "").strip().lower()
    query = db.query(EmailCampaign)
    if user_role in ["hod"]:
        query = query.filter(EmailCampaign.sender_id == current_user.id)

    campaigns = query.order_by(EmailCampaign.id.desc()).limit(limit).all()
    return [
        {
            "id": c.id,
            "campaign_name": c.campaign_name,
            "subject": c.subject,
            "scope_type": c.scope_type,
            "status": c.status,
            "total_recipients": c.total_recipients,
            "sent": c.sent_count,
            "delivered": c.delivered_count,
            "failed": c.failed_count,
            "created_at": c.created_at.strftime("%Y-%m-%d %H:%M:%S") if c.created_at else None
        }
        for c in campaigns
    ]
