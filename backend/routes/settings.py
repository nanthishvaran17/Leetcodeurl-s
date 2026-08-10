from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any

from backend.database import get_db
from backend.config import settings
from backend.models import AdminSettingsModel, AuditLog
from backend.routes.auth import get_current_user
from backend.backup_manager import create_db_backup, list_backups

router = APIRouter(prefix="/api/settings", tags=["Settings"])

@router.get("")
def get_admin_settings(db: Session = Depends(get_db)):
    rows = db.query(AdminSettingsModel).all()
    settings_dict = {row.key: row.value for row in rows}
    
    # Default fallbacks
    defaults = {
        "SESSION_START": settings.SESSION_START,
        "SESSION_END": settings.SESSION_END,
        "PROGRESS_THRESHOLD": str(settings.PROGRESS_THRESHOLD),
        "CACHE_DURATION": str(settings.CACHE_DURATION),
        "REQUEST_DELAY": str(settings.REQUEST_DELAY),
        "COLLEGE_NAME": settings.COLLEGE_NAME,
        "REPORT_RECIPIENT_EMAILS": settings.REPORT_RECIPIENT_EMAILS
    }
    defaults.update(settings_dict)
    return defaults

@router.post("")
def update_admin_settings(
    settings_data: Dict[str, str],
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    for key, value in settings_data.items():
        row = db.query(AdminSettingsModel).filter(AdminSettingsModel.key == key).first()
        if not row:
            row = AdminSettingsModel(key=key, value=str(value))
            db.add(row)
        else:
            row.value = str(value)

    audit = AuditLog(user_id=current_user.id, user_name=current_user.username, action="UPDATE_SETTINGS", details=f"Updated settings keys: {', '.join(settings_data.keys())}")
    db.add(audit)
    db.commit()
    return {"message": "Admin settings saved successfully."}

@router.post("/backup")
def trigger_backup(current_user=Depends(get_current_user)):
    res = create_db_backup()
    return res

@router.get("/backups")
def get_backups_list(current_user=Depends(get_current_user)):
    return list_backups()
