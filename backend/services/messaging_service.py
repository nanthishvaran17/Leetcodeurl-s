import uuid
import json
import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc

from backend.models import (
    User, Student, Conversation, Message, FacultyStudentAssignment
)
from backend.services.notification_service import NotificationService
from backend.websocket_manager import manager
from backend.logger import logger

class MessagingService:
    @staticmethod
    def _format_utc_iso(dt) -> str:
        if not dt:
            return None
        iso = dt.isoformat()
        if not iso.endswith("Z") and "+" not in iso and "-" not in iso[10:]:
            return iso + "Z"
        return iso

    @staticmethod
    def _get_user_id(user_obj) -> str:
        """Helper to extract a consistent ID for messaging. Uses email, reg_no, or STAFF_{id}."""
        if hasattr(user_obj, "email") and user_obj.email:
            return user_obj.email
        if hasattr(user_obj, "reg_no") and user_obj.reg_no:
            return user_obj.reg_no
        return f"STAFF_{user_obj.id}" if hasattr(user_obj, "role") else str(user_obj.id)

    @staticmethod
    def _is_user_online(db: Session, user_id_str: str) -> bool:
        """Robust helper checking if a user ID, email, username, or STAFF_ID has an active WebSocket connection."""
        if not user_id_str:
            return False

        target_clean = str(user_id_str).strip().lower()
        targets = {target_clean}

        if target_clean.startswith("staff_"):
            targets.add(target_clean.replace("staff_", ""))

        num_id = int(target_clean.replace("staff_", "")) if (target_clean.isdigit() or ("staff_" in target_clean and target_clean.replace("staff_", "").isdigit())) else -1
        u = db.query(User).filter(
            or_(User.email == user_id_str, User.username == user_id_str, User.id == num_id)
        ).first()
        if u:
            if u.email: targets.add(u.email.strip().lower())
            if u.username: targets.add(u.username.strip().lower())
            if u.id: targets.add(str(u.id).strip().lower())

        s = db.query(Student).filter(
            or_(Student.email == user_id_str, Student.reg_no == user_id_str, Student.username == user_id_str)
        ).first()
        if s:
            if s.email: targets.add(s.email.strip().lower())
            if s.username: targets.add(s.username.strip().lower())
            if s.reg_no: targets.add(s.reg_no.strip().lower())
            if s.id: targets.add(str(s.id).strip().lower())

        for ctx in manager._ws_user.values():
            if not ctx:
                continue
            ws_u = str(ctx.get("user_id") or "").strip().lower()
            ws_email = str(ctx.get("email") or "").strip().lower()
            ws_sub = str(ctx.get("sub") or "").strip().lower()

            if ws_u in targets or ws_email in targets or ws_sub in targets:
                return True

        return False

    @staticmethod
    def _get_user_display(db: Session, user_id: str) -> dict:
        """Returns minimal display info for a user ID."""
        # Try Staff
        uid_num = int(user_id.replace("STAFF_", "")) if (user_id.isdigit() or ("STAFF_" in user_id and user_id.replace("STAFF_", "").isdigit())) else -1
        u = db.query(User).filter(
            or_(User.email == user_id, User.username == user_id, User.id == uid_num)
        ).first()
        if u:
            dept = u.department.name if u.department else "Admin"
            return {"id": MessagingService._get_user_id(u), "name": u.full_name or u.username, "role": u.role, "department": dept, "type": "STAFF"}
        
        # Try Student
        s = db.query(Student).filter(
            or_(Student.email == user_id, Student.reg_no == user_id, Student.username == user_id)
        ).first()
        if s:
            dept = s.department.code if s.department else ""
            return {"id": MessagingService._get_user_id(s), "name": s.name, "role": "Student", "department": f"{dept} • {s.year_level} Year", "type": "STUDENT"}
        
        return {"id": user_id, "name": "Unknown User", "role": "Unknown", "department": "", "type": "UNKNOWN"}

    @staticmethod
    def _format_message_dict(db: Session, m: Message, current_user_id: str = None) -> dict:
        """Formats a Message database model into a full JSON payload."""
        # Check delete for me list
        deleted_by = []
        if m.deleted_by_users:
            try:
                deleted_by = json.loads(m.deleted_by_users)
            except Exception:
                deleted_by = []

        if current_user_id and current_user_id in deleted_by:
            return None # Hidden for this user

        # Reactions map
        reactions_dict = {}
        if m.reactions:
            try:
                reactions_dict = json.loads(m.reactions)
            except Exception:
                reactions_dict = {}

        # Content override if deleted for everyone
        content_text = "This message was deleted" if m.is_deleted_everyone else m.content

        # Parent reply object if present
        reply_to_data = None
        if m.reply_to_message_id and not m.is_deleted_everyone:
            parent_msg = db.query(Message).filter_by(message_id=m.reply_to_message_id).first()
            if parent_msg:
                reply_to_data = {
                    "messageId": parent_msg.message_id,
                    "senderId": parent_msg.sender_id,
                    "content": "This message was deleted" if parent_msg.is_deleted_everyone else parent_msg.content[:80],
                    "attachmentFileId": parent_msg.attachment_file_id
                }

        return {
            "messageId": m.message_id,
            "conversationId": m.conversation_id,
            "senderId": m.sender_id,
            "receiverId": m.receiver_id,
            "content": content_text,
            "status": m.status, # SENT, DELIVERED, READ
            "deliveredAt": MessagingService._format_utc_iso(m.delivered_at),
            "readAt": MessagingService._format_utc_iso(m.read_at),
            "editedAt": MessagingService._format_utc_iso(m.edited_at),
            "isEdited": bool(m.is_edited),
            "isDeletedEveryone": bool(m.is_deleted_everyone),
            "deletedByUsers": json.loads(m.deleted_by_users) if m.deleted_by_users else [],
            "replyToMessageId": m.reply_to_message_id,
            "replyToMessage": reply_to_data,
            "clientMessageId": m.client_message_id,
            "reactions": reactions_dict,
            "attachmentFileId": m.attachment_file_id if not m.is_deleted_everyone else None,
            "createdAt": MessagingService._format_utc_iso(m.created_at)
        }

    @staticmethod
    def get_available_recipients(db: Session, current_user) -> list:
        """RBAC-enforced method returning a list of valid message recipients."""
        role = str(getattr(current_user, "role", "Student")).upper()
        dept_id = getattr(current_user, "department_id", None)
        current_id = MessagingService._get_user_id(current_user)
        
        if "ADMIN" in role:
            staff = db.query(User).filter(User.is_active == True, User.id != current_user.id).all()
            students = db.query(Student).filter(Student.is_active == True).all()
        elif "HOD" in role:
            staff = db.query(User).filter(
                User.is_active == True, User.id != current_user.id,
                or_(User.department_id == dept_id, User.role.ilike("%admin%"))
            ).all()
            students = db.query(Student).filter(Student.is_active == True, Student.department_id == dept_id).all()
        elif "FACULTY" in role or "STAFF" in role:
            staff = db.query(User).filter(
                User.is_active == True, User.id != current_user.id,
                or_(User.department_id == dept_id, User.role.ilike("%admin%"))
            ).all()
            assignments = db.query(FacultyStudentAssignment).filter_by(faculty_id=current_user.id, is_active=True).all()
            students = [a.student for a in assignments if a.student and a.student.is_active]
        else:
            staff_query = db.query(User).filter(User.is_active == True, or_(User.role.ilike("%admin%"), User.role.ilike("%hod%")))
            staff = staff_query.all()
            assignment = db.query(FacultyStudentAssignment).filter_by(student_id=current_user.id, is_active=True).first()
            if assignment and assignment.faculty:
                staff.append(assignment.faculty)
            students = []

        seen = set([current_id])
        result = []
        for u in staff:
            uid = MessagingService._get_user_id(u)
            if uid not in seen:
                seen.add(uid)
                dept = u.department.name if u.department else "Administration"
                result.append({"id": uid, "name": u.full_name or u.username, "role": u.role or "Staff", "department": dept, "type": "STAFF"})
        
        for s in students:
            uid = MessagingService._get_user_id(s)
            if uid not in seen:
                seen.add(uid)
                dept = s.department.code if s.department else ""
                result.append({"id": uid, "name": s.name, "role": "Student", "department": f"{dept} • {s.year_level} Year", "type": "STUDENT"})
                
        return sorted(result, key=lambda x: x["name"])

    @staticmethod
    def get_or_create_conversation(db: Session, user1_id: str, user2_id: str) -> Conversation:
        p1, p2 = sorted([user1_id, user2_id])
        conv = db.query(Conversation).filter_by(participant_1_id=p1, participant_2_id=p2).first()
        if not conv:
            conv = Conversation(
                conversation_id=f"CONV_{uuid.uuid4().hex[:16]}",
                participant_1_id=p1,
                participant_2_id=p2,
                last_message_preview=None
            )
            db.add(conv)
            db.commit()
            db.refresh(conv)
        return conv

    @staticmethod
    def send_message(
        db: Session, 
        current_user, 
        receiver_id: str, 
        content: str, 
        attachment_file_id: str = None,
        reply_to_message_id: str = None,
        client_message_id: str = None,
        t0_client_send: int = None
    ) -> Message:
        import time
        t1_server_receive = int(time.time() * 1000)
        sender_id = MessagingService._get_user_id(current_user)
        
        # 1. Ensure receiver is valid or conversation already exists
        conv_exists = db.query(Conversation).filter(
            or_(
                and_(Conversation.participant_1_id == sender_id, Conversation.participant_2_id == receiver_id),
                and_(Conversation.participant_1_id == receiver_id, Conversation.participant_2_id == sender_id)
            )
        ).first()

        if not conv_exists:
            allowed = MessagingService.get_available_recipients(db, current_user)
            if not any(str(r["id"]).lower() == str(receiver_id).lower() for r in allowed):
                user_or_student = MessagingService._get_user_display(db, receiver_id)
                if user_or_student.get("type") == "UNKNOWN":
                    raise ValueError("You are not authorized to message this user.")
            
        # 2. Get or create conversation
        conv = MessagingService.get_or_create_conversation(db, sender_id, receiver_id)
        
        # Determine initial status (Check if recipient is online / connected via WebSocket)
        initial_status = "SENT"
        delivered_at_val = None
        is_recipient_connected = MessagingService._is_user_online(db, receiver_id)
        if is_recipient_connected:
            initial_status = "DELIVERED"
            delivered_at_val = datetime.datetime.utcnow()

        # 3. Create Message
        msg = Message(
            message_id=f"MSG_{uuid.uuid4().hex[:16]}",
            conversation_id=conv.conversation_id,
            sender_id=sender_id,
            receiver_id=receiver_id,
            content=content,
            status=initial_status,
            delivered_at=delivered_at_val,
            attachment_file_id=attachment_file_id,
            reply_to_message_id=reply_to_message_id,
            client_message_id=client_message_id,
            t0_client_send=t0_client_send,
            t1_server_receive=t1_server_receive
        )
        db.add(msg)
        
        # 4. Update Conversation state
        preview_text = content[:100] if content else "Sent an attachment"
        conv.last_message_preview = preview_text
        conv.last_message_at = datetime.datetime.utcnow()
        if conv.participant_1_id == receiver_id:
            conv.unread_count_1 = (conv.unread_count_1 or 0) + 1
        else:
            conv.unread_count_2 = (conv.unread_count_2 or 0) + 1
            
        db.commit()
        t2_auth_persist = int(time.time() * 1000)
        
        # We manually update these after commit to avoid another full DB flush if not strict,
        # but for telemetry it's better to update and commit again or just flush. 
        # Actually, let's just update and commit.
        msg.t2_auth_persist = t2_auth_persist
        
        db.refresh(msg)
        
        message_payload = MessagingService._format_message_dict(db, msg, sender_id)
        # Pass telemetry data down to the payload
        message_payload["t0_client_send"] = msg.t0_client_send
        message_payload["t1_server_receive"] = msg.t1_server_receive
        message_payload["t2_auth_persist"] = msg.t2_auth_persist

        msg.t3_fanout = int(time.time() * 1000)
        message_payload["t3_fanout"] = msg.t3_fanout
        db.commit()

        # WebSocket Broadcast for real-time delivery
        manager.broadcast_sync({
            "type": "NEW_MESSAGE",
            "message": message_payload
        })
        
        # Check if recipient is actively viewing this specific conversation via WebSocket
        if manager.is_user_in_conversation(receiver_id, conv.conversation_id):
            logger.info(f"[MESSAGING] Recipient {receiver_id} is active in {conv.conversation_id}, marking READ instantly.")
            MessagingService.mark_as_read(db, current_user, conv.conversation_id)
            return msg
        
        # 5. Emit Notification (Deep linked to exact conversation)
        sender_name = (
            getattr(current_user, "full_name", None) or 
            getattr(current_user, "name", None) or 
            getattr(current_user, "username", None) or 
            getattr(current_user, "email", None) or 
            "User"
        )
        NotificationService.emit_event(
            event_type="DIRECT_MESSAGE",
            title=f"New message from {sender_name}",
            body=content[:50] + ("..." if len(content) > 50 else ""),
            actor_user_id=sender_id,
            recipient_scope="INDIVIDUAL",
            recipient_target=receiver_id,
            route=f"/messages/{conv.conversation_id}",
            priority="high",
            metadata={"conversation_id": conv.conversation_id, "message_id": msg.message_id},
            send_email_notification=False
        )
        
        return msg

    @staticmethod
    def edit_message(db: Session, current_user, message_id: str, new_content: str) -> dict:
        user_id = MessagingService._get_user_id(current_user)
        msg = db.query(Message).filter_by(message_id=message_id).first()
        if not msg:
            raise ValueError("Message not found")
        if msg.sender_id != user_id:
            raise ValueError("Unauthorized: You can only edit your own messages.")
        if msg.is_deleted_everyone:
            raise ValueError("Cannot edit a deleted message.")

        msg.content = new_content
        msg.is_edited = True
        msg.edited_at = datetime.datetime.utcnow()
        db.commit()

        updated_payload = MessagingService._format_message_dict(db, msg, user_id)
        manager.broadcast_sync({
            "type": "MESSAGE_EDITED",
            "message": updated_payload
        })
        return updated_payload

    @staticmethod
    def delete_message(db: Session, current_user, message_id: str, mode: str) -> dict:
        """
        mode: 'FOR_ME' or 'FOR_EVERYONE'
        """
        user_id = MessagingService._get_user_id(current_user)
        msg = db.query(Message).filter_by(message_id=message_id).first()
        if not msg:
            raise ValueError("Message not found")

        if mode == "FOR_EVERYONE":
            role = str(getattr(current_user, "role", "")).upper()
            if msg.sender_id != user_id and "ADMIN" not in role:
                raise ValueError("Unauthorized: You can only delete your own messages for everyone.")
            
            msg.is_deleted_everyone = True
            msg.content = "This message was deleted"
            db.commit()

            updated_payload = MessagingService._format_message_dict(db, msg, user_id)
            manager.broadcast_sync({
                "type": "MESSAGE_DELETED",
                "messageId": message_id,
                "conversationId": msg.conversation_id,
                "mode": "FOR_EVERYONE",
                "message": updated_payload
            })
            return {"success": True, "mode": "FOR_EVERYONE", "message": updated_payload}
        else:
            # DELETE FOR ME
            deleted_by = []
            if msg.deleted_by_users:
                try:
                    deleted_by = json.loads(msg.deleted_by_users)
                except Exception:
                    deleted_by = []
            if user_id not in deleted_by:
                deleted_by.append(user_id)
                msg.deleted_by_users = json.dumps(deleted_by)
                db.commit()

            return {"success": True, "mode": "FOR_ME", "messageId": message_id}

    @staticmethod
    def delete_conversation(db: Session, current_user, conversation_id: str) -> dict:
        user_id = MessagingService._get_user_id(current_user)
        conv = db.query(Conversation).filter_by(conversation_id=conversation_id).first()
        if not conv:
            raise ValueError("Conversation not found")
            
        if user_id not in (conv.participant_1_id, conv.participant_2_id):
            raise ValueError("Unauthorized access to delete conversation")
            
        db.delete(conv)
        db.commit()
        
        manager.broadcast_sync({
            "type": "CONVERSATION_DELETED",
            "conversationId": conversation_id
        })
        return {"success": True, "conversationId": conversation_id}

    @staticmethod
    def toggle_pin(db: Session, current_user, conversation_id: str) -> dict:
        user_id = MessagingService._get_user_id(current_user)
        conv = db.query(Conversation).filter_by(conversation_id=conversation_id).first()
        if not conv or user_id not in (conv.participant_1_id, conv.participant_2_id):
            raise ValueError("Conversation not found or unauthorized")
        
        pinned_by = []
        if conv.pinned_by_users:
            try:
                pinned_by = json.loads(conv.pinned_by_users)
            except Exception:
                pinned_by = []
        is_pinned = user_id in pinned_by
        if is_pinned:
            pinned_by.remove(user_id)
        else:
            pinned_by.append(user_id)
            
        conv.pinned_by_users = json.dumps(pinned_by)
        db.commit()
        return {"success": True, "is_pinned": not is_pinned}

    @staticmethod
    def toggle_archive(db: Session, current_user, conversation_id: str) -> dict:
        user_id = MessagingService._get_user_id(current_user)
        conv = db.query(Conversation).filter_by(conversation_id=conversation_id).first()
        if not conv or user_id not in (conv.participant_1_id, conv.participant_2_id):
            raise ValueError("Conversation not found or unauthorized")
        
        archived_by = []
        if conv.archived_by_users:
            try:
                archived_by = json.loads(conv.archived_by_users)
            except Exception:
                archived_by = []
        is_archived = user_id in archived_by
        if is_archived:
            archived_by.remove(user_id)
        else:
            archived_by.append(user_id)
            
        conv.archived_by_users = json.dumps(archived_by)
        db.commit()
        return {"success": True, "is_archived": not is_archived}

    @staticmethod
    def clear_chat(db: Session, current_user, conversation_id: str) -> dict:
        user_id = MessagingService._get_user_id(current_user)
        conv = db.query(Conversation).filter_by(conversation_id=conversation_id).first()
        if not conv or user_id not in (conv.participant_1_id, conv.participant_2_id):
            raise ValueError("Conversation not found or unauthorized")
        
        messages = db.query(Message).filter_by(conversation_id=conversation_id).all()
        for msg in messages:
            deleted_by = []
            if msg.deleted_by_users:
                try:
                    deleted_by = json.loads(msg.deleted_by_users)
                except Exception:
                    deleted_by = []
            
            if user_id not in deleted_by:
                deleted_by.append(user_id)
                msg.deleted_by_users = json.dumps(deleted_by)
        
        # Adjust last_message_preview if clearing? For simplicity just clear messages
        db.commit()
        return {"success": True, "conversationId": conversation_id}

    @staticmethod
    def toggle_block_user(db: Session, current_user, target_user_id: str) -> dict:
        user_id = MessagingService._get_user_id(current_user)
        from backend.models import BlockedUser
        
        block_record = db.query(BlockedUser).filter_by(blocker_id=user_id, blocked_id=target_user_id).first()
        is_blocked = False
        if block_record:
            db.delete(block_record)
        else:
            block_record = BlockedUser(blocker_id=user_id, blocked_id=target_user_id)
            db.add(block_record)
            is_blocked = True
            
        db.commit()
        return {"success": True, "is_blocked": is_blocked}

    @staticmethod
    def toggle_reaction(db: Session, current_user, message_id: str, emoji: str) -> dict:
        user_id = MessagingService._get_user_id(current_user)
        msg = db.query(Message).filter_by(message_id=message_id).first()
        if not msg:
            raise ValueError("Message not found")

        reactions_dict = {}
        if msg.reactions:
            try:
                reactions_dict = json.loads(msg.reactions)
            except Exception:
                reactions_dict = {}

        # Toggle: if already reacted with same emoji, remove it; else set/replace
        if reactions_dict.get(user_id) == emoji:
            del reactions_dict[user_id]
        else:
            reactions_dict[user_id] = emoji

        msg.reactions = json.dumps(reactions_dict)
        db.commit()

        updated_payload = MessagingService._format_message_dict(db, msg, user_id)
        manager.broadcast_sync({
            "type": "MESSAGE_REACTION",
            "messageId": message_id,
            "conversationId": msg.conversation_id,
            "reactions": reactions_dict
        })
        return {"success": True, "reactions": reactions_dict}

    @staticmethod
    def get_conversations(db: Session, current_user) -> list:
        user_id = MessagingService._get_user_id(current_user)
        conversations = db.query(Conversation).filter(
            or_(Conversation.participant_1_id == user_id, Conversation.participant_2_id == user_id)
        ).order_by(desc(Conversation.last_message_at)).all()
        
        result = []
        for c in conversations:
            other_id = c.participant_2_id if c.participant_1_id == user_id else c.participant_1_id
            unread = c.unread_count_1 if c.participant_1_id == user_id else c.unread_count_2
            other_info = MessagingService._get_user_display(db, other_id)
            
            # Check online status of other_user via manager connections
            is_online = MessagingService._is_user_online(db, other_id)
            other_info["isOnline"] = is_online
            
            pinned_by = []
            if c.pinned_by_users:
                try:
                    pinned_by = json.loads(c.pinned_by_users)
                except Exception:
                    pinned_by = []
            
            archived_by = []
            if c.archived_by_users:
                try:
                    archived_by = json.loads(c.archived_by_users)
                except Exception:
                    archived_by = []

            result.append({
                "conversationId": c.conversation_id,
                "otherUser": other_info,
                "lastMessagePreview": c.last_message_preview,
                "lastMessageAt": MessagingService._format_utc_iso(c.last_message_at),
                "unreadCount": unread,
                "isPinned": user_id in pinned_by,
                "isArchived": user_id in archived_by
            })
        return result

    @staticmethod
    def get_messages(db: Session, current_user, conversation_id: str, limit: int = 50) -> list:
        user_id = MessagingService._get_user_id(current_user)
        conv = db.query(Conversation).filter_by(conversation_id=conversation_id).first()
        if not conv:
            raise ValueError("Conversation not found")
            
        if user_id not in (conv.participant_1_id, conv.participant_2_id):
            raise ValueError("Unauthorized access to conversation")
            
        # Automatically mark pending received SENT messages as DELIVERED upon retrieval
        pending_sent = db.query(Message).filter_by(conversation_id=conversation_id, receiver_id=user_id, status="SENT").all()
        if pending_sent:
            now = datetime.datetime.utcnow()
            for m in pending_sent:
                m.status = "DELIVERED"
                m.delivered_at = now
            db.commit()

        messages = db.query(Message).filter_by(conversation_id=conversation_id).order_by(desc(Message.created_at)).limit(limit).all()
        
        result = []
        for m in reversed(messages): # Oldest to newest
            formatted = MessagingService._format_message_dict(db, m, user_id)
            if formatted:
                result.append(formatted)
        return result

    @staticmethod
    def mark_as_read(db: Session, current_user, conversation_id: str):
        user_id = MessagingService._get_user_id(current_user)
        conv = db.query(Conversation).filter_by(conversation_id=conversation_id).first()
        if not conv or user_id not in (conv.participant_1_id, conv.participant_2_id):
            return
            
        # Reset unread count
        if conv.participant_1_id == user_id:
            conv.unread_count_1 = 0
        else:
            conv.unread_count_2 = 0
            
        # Mark messages as read
        messages = db.query(Message).filter(
            Message.conversation_id == conversation_id,
            Message.receiver_id == user_id,
            Message.status.in_(["SENT", "DELIVERED"])
        ).all()
        
        now = datetime.datetime.utcnow()
        updated_ids = []
        for m in messages:
            m.status = "READ"
            m.read_at = now
            if not m.delivered_at:
                m.delivered_at = now
            updated_ids.append(m.message_id)
            
        db.commit()

        if updated_ids:
            manager.broadcast_sync({
                "type": "MESSAGE_STATUS_UPDATE",
                "conversationId": conversation_id,
                "status": "READ",
                "messageIds": updated_ids,
                "readAt": MessagingService._format_utc_iso(now)
            })

    @staticmethod
    def search_messages(db: Session, current_user, query: str) -> list:
        user_id = MessagingService._get_user_id(current_user)
        if not query or len(query.trim()) < 2:
            return []

        clean_q = f"%{query.strip()}%"
        # Find conversations belonging to current user
        convs = db.query(Conversation.conversation_id).filter(
            or_(Conversation.participant_1_id == user_id, Conversation.participant_2_id == user_id)
        ).subquery()

        msgs = db.query(Message).filter(
            Message.conversation_id.in_(convs),
            Message.content.ilike(clean_q),
            Message.is_deleted_everyone == False
        ).order_by(desc(Message.created_at)).limit(30).all()

        results = []
        for m in msgs:
            formatted = MessagingService._format_message_dict(db, m, user_id)
            if formatted:
                results.append(formatted)
        return results

