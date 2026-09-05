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
    context_filters = req.context.model_dump() if req.context else {}

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


@router.post("/assistant/stream")
async def handle_ai_assistant_stream(
    req: AIAssistantRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    POST /api/ai/assistant/stream
    Streaming SSE version of /api/ai/assistant.
    Immediately fires a THINKING event (<10ms) so the UI can show a typing indicator,
    then sends the full computed result as a RESULT event once the DB query completes.
    RBAC enforcement is identical to the non-streaming endpoint.
    """
    import json
    import asyncio
    from fastapi.responses import StreamingResponse

    clean_msg = req.message.strip()
    if not clean_msg:
        raise HTTPException(status_code=400, detail="Message prompt cannot be empty.")

    page_context = req.context.page if req.context else None
    context_filters = req.context.model_dump() if req.context else {}
    req_id = f"ai_{uuid.uuid4().hex[:12]}"

    async def generate():
        # ── T0: Immediately emit THINKING so the UI renders the indicator ──
        thinking_event = json.dumps({"type": "THINKING", "requestId": req_id})
        yield f"data: {thinking_event}\n\n"

        # ── T1: Compute the answer (blocking DB call → run in thread) ──
        loop = asyncio.get_event_loop()
        response_data = await loop.run_in_executor(
            None,
            lambda: AIKnowledgeEngine.answer_query(
                db=db,
                query_text=clean_msg,
                user=current_user,
                context_page=page_context,
                context_filters=context_filters,
                history=req.history,
                mode=req.mode or "institutional"
            )
        )

        # ── T2: Emit the full result ──
        result_payload = {
            "type": "RESULT",
            "requestId": response_data.get("requestId", req_id),
            "success": response_data.get("success", True),
            "answer": response_data.get("answer", ""),
            "why": response_data.get("why"),
            "evidence": response_data.get("evidence"),
            "confidence": response_data.get("confidence", "VERIFIED"),
            "actionLabel": response_data.get("actionLabel"),
            "actionTab": response_data.get("actionTab"),
            "source": response_data.get("source", "NEC Institutional Intelligence Engine"),
            "dataStatus": response_data.get("dataStatus", "VERIFIED"),
        }
        yield f"data: {json.dumps(result_payload)}\n\n"

        # ── Background: persist history + audit (non-blocking, after response) ──
        try:
            from backend.models import AIChatHistory
            chat_log = AIChatHistory(
                session_id=response_data.get("requestId", req_id),
                user_query=clean_msg,
                ai_response=response_data.get("answer", ""),
                mode=req.mode or "institutional",
                data_status=response_data.get("dataStatus", "VERIFIED")
            )
            db.add(chat_log)
            db.commit()
        except Exception:
            pass

        try:
            from backend.services.audit_service import log_admin_action
            user_name = current_user.username if current_user else "GUEST"
            user_role = current_user.role if current_user else "GUEST"
            log_admin_action(
                db=db,
                action="AI_COPILOT_QUERY",
                action_type="AI_ASSISTANT",
                description=f"AI Copilot (stream/{req.mode or 'institutional'}) by {user_name} ({user_role}): '{clean_msg[:60]}'",
                current_user=current_user,
                target_type="AIAssistant",
                target_id=response_data.get("requestId", req_id)
            )
        except Exception:
            pass

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        }
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


@router.post("/clear-history")
def clear_ai_chat_history(
    db: Session = Depends(get_db)
):
    """
    POST /api/ai/clear-history
    Clears saved AI chat interactions from database.
    """
    try:
        from backend.models import AIChatHistory
        db.query(AIChatHistory).delete()
        db.commit()
        return {"success": True, "message": "AI chat history cleared successfully."}
    except Exception as e:
        db.rollback()
        return {"success": False, "message": str(e)}


@router.get("/proactive-brief")
def get_proactive_brief(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    GET /api/ai/proactive-brief
    Returns a role-scoped list of proactive intelligence BriefCards for the
    AI Copilot widget.  All queries are read-only and indexed — target < 200ms.
    No LLM call is made.
    """
    try:
        from backend.services.proactive_intel_service import ProactiveIntelService
        cards = ProactiveIntelService.generate_brief(db, current_user)
        user_role = getattr(current_user, "role", "Guest") if current_user else "Guest"
        user_name = (
            getattr(current_user, "full_name", None)
            or getattr(current_user, "username", None)
            or "there"
        ) if current_user else "there"
        return {
            "success": True,
            "cards": cards,
            "user_role": user_role,
            "user_name": user_name,
        }
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("[proactive-brief] error: %s", exc)
        return {"success": False, "cards": [], "user_role": "Guest", "user_name": "there"}

