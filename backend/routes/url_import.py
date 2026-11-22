from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from backend.database import get_db
from backend.services.url_import_service import UrlImportService
from backend.models import User
from backend.routes.auth import get_current_user

router = APIRouter(prefix="/admin/url-import", tags=["Admin URL Import"])

class UrlImportRequest(BaseModel):
    data: List[dict] # Expected: [{"people_id": "P001", "leetcode_url": "https://..."}]

@router.post("/")
def import_urls(
    request: UrlImportRequest, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Bulk imports LeetCode URLs and maps them to People IDs.
    Requires Administrative privileges.
    """
    user_role = (getattr(current_user, "role", "") or "").strip().lower()
    if user_role not in ["admin", "administrator", "super admin", "super_admin", "principal"]:
        raise HTTPException(status_code=403, detail="Access denied: Administrator privileges required.")

    service = UrlImportService(db)
    result = service.import_urls(request.data)
    return result
