import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User
from backend.schemas import AIAssistantRequest, AIAssistantResponse
from backend.services.ai_knowledge_service import AIKnowledgeEngine
from backend.security import get_current_user_optional

router = APIRouter(prefix="/ai", tags=["AI Assistant"])

@router.post("/assistant", response_model=AIAssistantResponse)
def handle_ai_assistant_query(
    req: AIAssistantRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    POST /api/ai/assistant
    Production-grade AI Assistant Endpoint.
    Answers platform architecture & verified database queries using server-derived permissions.
    """
    clean_msg = req.message.strip()
    if not clean_msg:
        raise HTTPException(status_code=400, detail="Message prompt cannot be empty.")

    page_context = req.context.page if req.context else None

    # Process query using AIKnowledgeEngine
    response_data = AIKnowledgeEngine.answer_query(
        db=db,
        query_text=clean_msg,
        user=current_user,
        context_page=page_context
    )

    # Security Audit Log for AI Access
    try:
        from backend.services.audit_service import log_admin_action
        user_name = current_user.username if current_user else "GUEST"
        user_role = current_user.role if current_user else "GUEST"
        log_admin_action(
            db=db,
            action="AI_COPILOT_QUERY",
            action_type="AI_ASSISTANT",
            description=f"AI Copilot queried by {user_name} ({user_role}): '{clean_msg[:60]}'",
            current_user=current_user,
            target_type="AIAssistant",
            target_id=response_data.get("requestId", "")
        )
    except Exception:
        pass

    return AIAssistantResponse(
        success=response_data["success"],
        answer=response_data["answer"],
        source=response_data["source"],
        dataStatus=response_data["dataStatus"],
        requestId=response_data["requestId"]
    )
