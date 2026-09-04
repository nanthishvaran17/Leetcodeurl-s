"""
accreditation.py — API Endpoints for NAAC & NBA Accreditation Studio
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from backend.database import get_db
from backend.models import User
from backend.security import require_role
from backend.services.accreditation_report_service import accreditation_report_service

router = APIRouter(prefix="/accreditation", tags=["NAAC & NBA Accreditation Studio"])


@router.get("/metrics")
def get_accreditation_metrics(
    dept_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin", "HOD", "hod", dept_scoped=True))
):
    """Returns official NAAC & NBA Criteria quantitative compliance metrics."""
    user_role = (current_user.role or "").strip().lower()
    target_dept_id = current_user.department_id if (user_role in ["hod"] and current_user.department_id) else dept_id
    return accreditation_report_service.generate_accreditation_metrics(db, target_dept_id)
