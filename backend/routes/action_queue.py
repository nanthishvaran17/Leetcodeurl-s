from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from backend.database import get_db
from backend.models import User
from backend.services.authorization_service import require_security_access
from backend.services.faculty_action_engine import FacultyActionEngine

router = APIRouter()

class ActionItemResponse(BaseModel):
    id: int
    type: str
    student_id: int
    student_name: str
    student_reg_no: str
    evidence_summary: str
    status: str
    assigned_reviewer_name: Optional[str] = None
    timestamp: str
    notes: Optional[str] = None

class UpdateActionItemRequest(BaseModel):
    status: str
    notes: Optional[str] = None

@router.get("/", response_model=List[ActionItemResponse])
def get_action_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_security_access(resource_name="View Faculty Action Queue", dept_scoped=True))
):
    """
    Retrieves the Faculty Action Queue for the current user based on RBAC.
    Admin sees all, HOD sees department, Staff sees assigned students.
    """
    items = FacultyActionEngine.get_open_items_for_faculty(db, current_user)
    
    response = []
    for item in items:
        response.append(ActionItemResponse(
            id=item.id,
            type=item.type,
            student_id=item.student_id,
            student_name=item.student.name if item.student else "Unknown",
            student_reg_no=item.student.reg_no if item.student else "Unknown",
            evidence_summary=item.evidence_summary,
            status=item.status,
            assigned_reviewer_name=item.assigned_reviewer.name if item.assigned_reviewer else None,
            timestamp=item.timestamp.isoformat(),
            notes=item.notes
        ))
    return response

@router.put("/{item_id}")
def update_action_item(
    item_id: int,
    request: UpdateActionItemRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_security_access(resource_name="Update Faculty Action Queue", dept_scoped=True))
):
    """
    Updates the status of an action item in the queue.
    """
    updated_item = FacultyActionEngine.update_action_item_status(
        db=db,
        item_id=item_id,
        status=request.status,
        user=current_user,
        notes=request.notes
    )
    return {"message": "Action item updated successfully", "id": updated_item.id, "status": updated_item.status}
