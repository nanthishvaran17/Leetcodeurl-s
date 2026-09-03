from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from backend.database import get_db
from backend.services.url_import_service import UrlImportService

router = APIRouter(prefix="/admin/url-import", tags=["Admin URL Import"])

class UrlImportRequest(BaseModel):
    data: List[dict] # Expected: [{"people_id": "P001", "leetcode_url": "https://..."}]

@router.post("/")
def import_urls(request: UrlImportRequest, db: Session = Depends(get_db)):
    """
    Bulk imports LeetCode URLs and maps them to People IDs.
    """
    service = UrlImportService(db)
    result = service.import_urls(request.data)
    return result
