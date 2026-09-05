from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import os
import uuid
import shutil
from typing import Any, Optional
from pydantic import BaseModel

from backend.database import get_db
from backend.routes.auth import get_current_user as get_current_active_user
from backend.services.messaging_service import MessagingService
from backend.models import NotificationFile
from backend.logger import logger

router = APIRouter(prefix="/api/messaging", tags=["Universal Messaging"])

class SendMessageRequest(BaseModel):
    content: str
    receiver_id: str
    attachment_file_id: Optional[str] = None
    reply_to_message_id: Optional[str] = None

class EditMessageRequest(BaseModel):
    content: str

class ReactionRequest(BaseModel):
    emoji: str

class TypingRequest(BaseModel):
    conversation_id: str
    receiver_id: str
    is_typing: bool

def _auto_migrate_and_retry(_db: Session, _fn, *args, **kwargs):
    try:
        return _fn(*args, **kwargs)
    except ValueError:
        raise
    except Exception as e:
        err_str = str(e).lower()
        if "undefinedcolumn" in err_str or "does not exist" in err_str or "no such column" in err_str or "column" in err_str:
            logger.warning(f"[MESSAGING] DB schema out of sync ({e}). Running auto-migration and retrying...")
            _db.rollback()
            try:
                from backend.migrate_db import run_db_migrations
                run_db_migrations()
            except Exception as mig_err:
                logger.error(f"[MESSAGING] Auto-migration error: {mig_err}")
            return _fn(*args, **kwargs)
        raise

@router.get("/available-recipients")
def get_available_recipients_endpoint(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Returns a list of users the authenticated user is allowed to message."""
    try:
        recipients = _auto_migrate_and_retry(db, MessagingService.get_available_recipients, db, current_user)
        return {"success": True, "recipients": recipients}
    except Exception as e:
        logger.error(f"Error fetching recipients: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch available recipients.")

@router.get("/conversations")
def get_conversations_endpoint(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Returns all active conversations for the authenticated user."""
    try:
        conversations = _auto_migrate_and_retry(db, MessagingService.get_conversations, db, current_user)
        return {"success": True, "conversations": conversations}
    except Exception as e:
        logger.error(f"Error fetching conversations: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch conversations.")

@router.get("/conversations/{conversation_id}/messages")
def get_messages_endpoint(
    conversation_id: str,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Returns messages for a specific conversation."""
    try:
        messages = _auto_migrate_and_retry(db, MessagingService.get_messages, db, current_user, conversation_id, limit=limit)
        
        # Also mark them as read when fetching
        _auto_migrate_and_retry(db, MessagingService.mark_as_read, db, current_user, conversation_id)
        
        return {"success": True, "messages": messages}
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching messages: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch messages.")

@router.post("/messages")
def send_message_endpoint(
    req: SendMessageRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Sends a new message and creates/updates the conversation."""
    try:
        msg = _auto_migrate_and_retry(
            db,
            MessagingService.send_message,
            db=db,
            current_user=current_user,
            receiver_id=req.receiver_id,
            content=req.content,
            attachment_file_id=req.attachment_file_id,
            reply_to_message_id=req.reply_to_message_id
        )
        msg_dict = MessagingService._format_message_dict(db, msg, MessagingService._get_user_id(current_user))
        return {
            "success": True,
            "message": msg_dict
        }
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error sending message: {e}")
        raise HTTPException(status_code=500, detail="Failed to send message.")

@router.put("/messages/{message_id}")
def edit_message_endpoint(
    message_id: str,
    req: EditMessageRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Edits an existing message owned by the current user."""
    try:
        updated = MessagingService.edit_message(db, current_user, message_id, req.content)
        return {"success": True, "message": updated}
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error editing message: {e}")
        raise HTTPException(status_code=500, detail="Failed to edit message.")

@router.delete("/messages/{message_id}")
def delete_message_endpoint(
    message_id: str,
    mode: str = Query("FOR_ME", regex="^(FOR_ME|FOR_EVERYONE)$"),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Deletes a message either FOR_ME or FOR_EVERYONE."""
    try:
        result = MessagingService.delete_message(db, current_user, message_id, mode)
        return result
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting message: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete message.")

@router.post("/messages/{message_id}/reactions")
def toggle_reaction_endpoint(
    message_id: str,
    req: ReactionRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Adds or toggles an emoji reaction on a message."""
    try:
        result = MessagingService.toggle_reaction(db, current_user, message_id, req.emoji)
        return result
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error toggling reaction: {e}")
        raise HTTPException(status_code=500, detail="Failed to toggle reaction.")

@router.post("/typing")
def report_typing_endpoint(
    req: TypingRequest,
    current_user: Any = Depends(get_current_active_user)
):
    """Broadcasts a typing start/stop event over WebSockets."""
    try:
        sender_id = MessagingService._get_user_id(current_user)
        from backend.websocket_manager import manager
        manager.broadcast_sync({
            "type": "TYPING_STATUS",
            "conversationId": req.conversation_id,
            "senderId": sender_id,
            "receiverId": req.receiver_id,
            "isTyping": req.is_typing
        })
        return {"success": True}
    except Exception as e:
        logger.error(f"Error reporting typing status: {e}")
        raise HTTPException(status_code=500, detail="Failed to send typing status.")

@router.get("/search")
def search_messages_endpoint(
    q: str = Query(..., min_length=2),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Searches messages by keyword within user's conversations."""
    try:
        results = MessagingService.search_messages(db, current_user, q)
        return {"success": True, "results": results}
    except Exception as e:
        logger.error(f"Error searching messages: {e}")
        raise HTTPException(status_code=500, detail="Failed to search messages.")

@router.put("/conversations/{conversation_id}/read")
def mark_conversation_read_endpoint(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Explicitly marks a conversation as read."""
    try:
        MessagingService.mark_as_read(db, current_user, conversation_id)
        return {"success": True}
    except Exception as e:
        logger.error(f"Error marking as read: {e}")
        raise HTTPException(status_code=500, detail="Failed to mark as read.")

@router.get("/profile/{user_id}")
def get_messaging_profile_endpoint(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Returns detailed profile info for a user in the messaging system."""
    try:
        from backend.models import User, Student
        from sqlalchemy import or_
        
        uid_num = int(user_id.replace("STAFF_", "")) if (user_id.isdigit() or ("STAFF_" in user_id and user_id.replace("STAFF_", "").isdigit())) else -1
        staff = db.query(User).filter(
            or_(User.email == user_id, User.username == user_id, User.id == uid_num)
        ).first()
        
        if staff:
            avatar = getattr(staff, 'avatar_url', None) or getattr(staff, 'profile_image_url', None)
            return {
                "success": True, 
                "profile": {
                    "id": user_id,
                    "name": staff.full_name or staff.username,
                    "role": staff.role.upper(),
                    "designation": staff.designation or staff.role,
                    "institutional_id": staff.institutional_id or "",
                    "department": staff.department.name if staff.department else "Administration",
                    "email": staff.email,
                    "phone": staff.phone_number if hasattr(staff, 'phone_number') else getattr(staff, 'phone', None),
                    "avatar_url": avatar,
                    "type": "STAFF",
                    "status": "Active" if staff.is_active else "Inactive",
                    "verified": True
                }
            }
            
        # Try Student
        student = db.query(Student).filter(
            or_(Student.email == user_id, Student.reg_no == user_id, Student.username == user_id)
        ).first()
        
        if student:
            stats_data = {}
            if student.stats:
                stats_data = {
                    "total_solved": getattr(student.stats, 'total_solved', 0) or 0,
                    "easy_solved": getattr(student.stats, 'easy_solved', 0) or 0,
                    "medium_solved": getattr(student.stats, 'medium_solved', 0) or 0,
                    "hard_solved": getattr(student.stats, 'hard_solved', 0) or 0,
                    "contest_rating": getattr(student.stats, 'contest_rating', 0) or 0,
                    "global_rank": getattr(student.stats, 'global_rank', 0) or 0,
                }
            avatar = getattr(student, 'avatar_url', None)
            return {
                "success": True,
                "profile": {
                    "id": user_id,
                    "name": student.name,
                    "reg_no": student.reg_no,
                    "role": "STUDENT",
                    "department": student.department.code if student.department else "",
                    "year": student.year_level,
                    "section": student.section.name if student.section else "",
                    "email": student.email or student.institutional_email,
                    "phone": student.phone_number or getattr(student, 'phone', None),
                    "avatar_url": avatar,
                    "type": "STUDENT",
                    "status": "Active" if student.is_active else "Inactive",
                    "verified": True,
                    "leetcode_url": student.leetcode_url,
                    "leetcode_username": student.username,
                    "stats": stats_data
                }
            }
            
        raise ValueError("Profile not found")
        
    except Exception as e:
        logger.error(f"Error fetching messaging profile: {e}")
        raise HTTPException(status_code=404, detail="Profile not found.")

@router.post("/upload")
async def upload_attachment(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Uploads a file for use as a message attachment."""
    try:
        from backend.main import BASE_DIR
        upload_dir = os.path.join(BASE_DIR, "data", "attachments")
        os.makedirs(upload_dir, exist_ok=True)

        file_ext = os.path.splitext(file.filename)[1] if file.filename else ""
        unique_id = uuid.uuid4().hex
        secure_filename = f"{unique_id}{file_ext}"
        storage_path = os.path.join(upload_dir, secure_filename)

        with open(storage_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        file_size = os.path.getsize(storage_path)

        file_id = f"ATT_{unique_id[:12]}"
        
        uploader_id = MessagingService._get_user_id(current_user)

        new_file = NotificationFile(
            file_id=file_id,
            filename=file.filename or secure_filename,
            file_type=file.content_type or "application/octet-stream",
            file_size=file_size,
            storage_path=storage_path,
            uploaded_by=uploader_id,
            access_scope="MESSAGING"
        )
        db.add(new_file)
        db.commit()

        return {
            "success": True,
            "file_id": file_id,
            "filename": new_file.filename,
            "url": f"/api/messaging/attachments/{file_id}"
        }
    except Exception as e:
        logger.error(f"Error uploading message attachment: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload attachment.")

@router.get("/attachments/{file_id}")
def download_attachment(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Downloads or views a messaging attachment."""
    try:
        file_record = db.query(NotificationFile).filter(NotificationFile.file_id == file_id).first()
        if not file_record:
            raise HTTPException(status_code=404, detail="File not found")
            
        if not os.path.exists(file_record.storage_path):
            raise HTTPException(status_code=404, detail="File missing on disk")
            
        media_type = file_record.file_type or "application/octet-stream"
        
        return FileResponse(
            path=file_record.storage_path, 
            filename=file_record.filename,
            media_type=media_type
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving attachment: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve file.")


# =========================================================================
# INSTITUTIONAL INTELLIGENCE & SMART GROUPS ENDPOINTS (PHASES 7-13)
# =========================================================================

class CreateSmartGroupRequest(BaseModel):
    name: str
    description: Optional[str] = None
    group_type: str = "CUSTOM"
    is_dynamic: bool = False
    rule_type: Optional[str] = None
    rule_criteria: Optional[dict] = None
    initial_member_ids: Optional[list] = None

class AskInstitutionRequest(BaseModel):
    query: str

class AnalyzeActionRequest(BaseModel):
    content: str
    receiver_id: str


@router.get("/smart-groups")
def get_smart_groups_endpoint(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Returns all smart groups accessible to the current user."""
    try:
        from backend.services.institutional_intelligence_service import InstitutionalIntelligenceService
        groups = InstitutionalIntelligenceService.get_user_smart_groups(db, current_user)
        return {"success": True, "groups": groups}
    except Exception as e:
        logger.error(f"Error fetching smart groups: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch smart groups.")


@router.post("/smart-groups")
def create_smart_group_endpoint(
    req: CreateSmartGroupRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Creates a new manual or dynamic smart group."""
    try:
        from backend.services.institutional_intelligence_service import InstitutionalIntelligenceService
        group_details = InstitutionalIntelligenceService.create_smart_group(
            db=db,
            current_user=current_user,
            name=req.name,
            description=req.description,
            group_type=req.group_type,
            is_dynamic=req.is_dynamic,
            rule_type=req.rule_type,
            rule_criteria=req.rule_criteria,
            initial_member_ids=req.initial_member_ids
        )
        return {"success": True, "group": group_details}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating smart group: {e}")
        raise HTTPException(status_code=500, detail="Failed to create smart group.")


@router.get("/smart-groups/{group_id}")
def get_smart_group_details_endpoint(
    group_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Returns detailed smart group info and members."""
    try:
        from backend.services.institutional_intelligence_service import InstitutionalIntelligenceService
        details = InstitutionalIntelligenceService.get_group_details(db, current_user, group_id)
        return {"success": True, "group": details}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching group details: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch group details.")


@router.post("/ask-institution")
def ask_institution_endpoint(
    req: AskInstitutionRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Executes a natural language query against verified institutional DB with RBAC."""
    try:
        from backend.services.institutional_intelligence_service import InstitutionalIntelligenceService
        response = InstitutionalIntelligenceService.ask_institution(db, current_user, req.query)
        return {"success": True, "result": response}
    except Exception as e:
        logger.error(f"Error in ask institution: {e}")
        raise HTTPException(status_code=500, detail="Failed to process query.")


@router.post("/action-proposal")
def analyze_action_proposal_endpoint(
    req: AnalyzeActionRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Analyzes message text for actionable directives (Message -> Action workflow)."""
    try:
        from backend.services.institutional_intelligence_service import InstitutionalIntelligenceService
        proposal = InstitutionalIntelligenceService.analyze_message_for_action(db, current_user, req.content, req.receiver_id)
        return {"success": True, "proposal": proposal}
    except Exception as e:
        logger.error(f"Error analyzing action proposal: {e}")
        raise HTTPException(status_code=500, detail="Failed to analyze proposal.")


@router.get("/why-was-i-flagged")
def why_was_i_flagged_endpoint(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_active_user)
):
    """Provides objective, verified transparency on student standing."""
    try:
        from backend.services.institutional_intelligence_service import InstitutionalIntelligenceService
        transparency = InstitutionalIntelligenceService.get_student_flag_transparency(db, current_user)
        return {"success": True, "transparency": transparency}
    except Exception as e:
        logger.error(f"Error getting transparency info: {e}")
        raise HTTPException(status_code=500, detail="Failed to get transparency status.")

