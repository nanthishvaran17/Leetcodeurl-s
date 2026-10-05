from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.routes.auth import get_current_user
from backend.models import User
from backend.services.staff_analytics_engine import StaffAnalyticsEngine

router = APIRouter(prefix="/api/staff-tools", tags=["Staff Tools"])

@router.post("/generate-alerts")
def trigger_alert_generation(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Manually triggers the AI Engine to scan all students in the Staff's department
    and generate At-Risk and Cheating alerts.
    """
    if current_user.role not in ["Faculty", "Admin", "super admin", "hod"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    dept_id = current_user.department_id
    
    # 1. Scan for At-Risk Students
    new_inactivity_alerts = StaffAnalyticsEngine.generate_at_risk_alerts(db, current_user.id, dept_id)
    
    # 2. Scan for Cheating / Plagiarism
    new_suspicious_alerts = StaffAnalyticsEngine.detect_suspicious_activity(db, current_user.id)
    
    return {
        "status": "success",
        "message": "Student scan complete.",
        "alerts_generated": {
            "at_risk_inactivity": new_inactivity_alerts,
            "suspicious_cheating": new_suspicious_alerts
        }
    }

@router.get("/dashboard-summary")
def get_staff_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns the total number of unread alerts for the staff."""
    return StaffAnalyticsEngine.get_dashboard_summary(db, current_user.id)
