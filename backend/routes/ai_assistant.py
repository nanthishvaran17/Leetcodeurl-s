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
    context_filters = req.context.dict() if req.context else {}

    # Process query using Unified AIKnowledgeEngine
    response_data = AIKnowledgeEngine.answer_query(
        db=db,
        query_text=clean_msg,
        user=current_user,
        context_page=page_context,
        context_filters=context_filters,
        history=req.history,
        mode=req.mode or "institutional"
    )

    # Save chat entry to SQLite DB
    try:
        from backend.models import AIChatHistory
        chat_log = AIChatHistory(
            session_id=response_data.get("requestId"),
            user_query=clean_msg,
            ai_response=response_data.get("answer", ""),
            mode=req.mode or "institutional",
            data_status=response_data.get("dataStatus", "VERIFIED")
        )
        db.add(chat_log)
        db.commit()
    except Exception:
        pass

    # Security Audit Log for AI Access
    try:
        from backend.services.audit_service import log_admin_action
        user_name = current_user.username if current_user else "GUEST"
        user_role = current_user.role if current_user else "GUEST"
        log_admin_action(
            db=db,
            action="AI_COPILOT_QUERY",
            action_type="AI_ASSISTANT",
            description=f"AI Copilot ({req.mode or 'institutional'}) queried by {user_name} ({user_role}): '{clean_msg[:60]}'",
            current_user=current_user,
            target_type="AIAssistant",
            target_id=response_data.get("requestId", "")
        )
    except Exception:
        pass

    return AIAssistantResponse(
        success=response_data.get("success", True),
        answer=response_data.get("answer", ""),
        why=response_data.get("why"),
        evidence=response_data.get("evidence"),
        confidence=response_data.get("confidence", "VERIFIED"),
        actionLabel=response_data.get("actionLabel"),
        actionTab=response_data.get("actionTab"),
        source=response_data.get("source", "NEC Institutional Intelligence Engine"),
        dataStatus=response_data.get("dataStatus", "VERIFIED"),
        requestId=response_data.get("requestId", f"ai_{uuid.uuid4().hex[:12]}")
    )


@router.get("/history")
def get_ai_chat_history(
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """
    GET /api/ai/history
    Returns recent saved AI chat interactions from SQLite database.
    """
    try:
        from backend.models import AIChatHistory
        history = db.query(AIChatHistory).order_by(AIChatHistory.id.desc()).limit(limit).all()
        return [
            {
                "id": f"db_{h.id}",
                "user_query": h.user_query,
                "ai_response": h.ai_response,
                "mode": h.mode,
                "created_at": h.created_at.strftime("%I:%M %p") if h.created_at else ""
            }
            for h in reversed(history)
        ]
    except Exception:
        return []

