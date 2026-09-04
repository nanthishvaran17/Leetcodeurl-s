import uuid
import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

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
    def get_available_recipients(db: Session, current_user) -> list:
        """
        RBAC-enforced method returning a list of valid message recipients.
        - Admin/Super Admin: All active users and students.
        - HOD: Admins, and all Staff/Students in their department.
        - Staff: Admins, HOD of their department, Staff in their department, and assigned students.
        - Student: Admins, HOD of their department, and their assigned faculty mentor.
        """
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
            # Only assigned students
            assignments = db.query(FacultyStudentAssignment).filter_by(faculty_id=current_user.id, is_active=True).all()
            students = [a.student for a in assignments if a.student and a.student.is_active]
        else:
            # Student logic
            staff_query = db.query(User).filter(User.is_active == True, or_(User.role.ilike("%admin%"), User.role.ilike("%hod%")))
            staff = staff_query.all()
            assignment = db.query(FacultyStudentAssignment).filter_by(student_id=current_user.id, is_active=True).first()
            if assignment and assignment.faculty:
                staff.append(assignment.faculty)
            students = [] # Students cannot message students directly for now.

        # Deduplicate and format
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
    def send_message(db: Session, current_user, receiver_id: str, content: str, attachment_file_id: str = None) -> Message:
        sender_id = MessagingService._get_user_id(current_user)
        
        # 1. Ensure receiver is valid according to RBAC
        allowed = MessagingService.get_available_recipients(db, current_user)
        if not any(r["id"] == receiver_id for r in allowed):
            raise ValueError("You are not authorized to message this user.")
            
        # 2. Get or create conversation
        conv = MessagingService.get_or_create_conversation(db, sender_id, receiver_id)
        
        # 3. Create Message
        msg = Message(
            message_id=f"MSG_{uuid.uuid4().hex[:16]}",
            conversation_id=conv.conversation_id,
            sender_id=sender_id,
            receiver_id=receiver_id,
            content=content,
            status="SENT",
            attachment_file_id=attachment_file_id
        )
        db.add(msg)
        
        # 4. Update Conversation state
        preview_text = content[:100] if content else "Sent an attachment"
        conv.last_message_preview = preview_text
        conv.last_message_at = datetime.datetime.utcnow()
        if conv.participant_1_id == receiver_id:
            conv.unread_count_1 += 1
        else:
            conv.unread_count_2 += 1
            
        db.commit()
        db.refresh(msg)
        
        message_payload = {
            "messageId": msg.message_id,
            "conversationId": msg.conversation_id,
            "senderId": msg.sender_id,
            "receiverId": msg.receiver_id,
            "content": msg.content,
            "status": msg.status,
            "attachmentFileId": msg.attachment_file_id,
            "createdAt": MessagingService._format_utc_iso(msg.created_at)
        }

        # WebSocket Broadcast for real-time delivery
        manager.broadcast_sync({
            "type": "NEW_MESSAGE",
            "message": message_payload
        })
        
        # Check if recipient is actively viewing this specific conversation via WebSocket
        if manager.is_user_in_conversation(receiver_id, conv.conversation_id):
            logger.info(f"[MESSAGING] Recipient {receiver_id} is active in {conv.conversation_id}, skipping OS push notification.")
            return msg
        
        # 5. Emit Notification (Deep linked)
        sender_name = getattr(current_user, "full_name", None) or getattr(current_user, "name", "A user")
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
            send_email_notification=False # Typically false for chat messages to avoid spam
        )
        
        return msg

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
            
            result.append({
                "conversationId": c.conversation_id,
                "otherUser": other_info,
                "lastMessagePreview": c.last_message_preview,
                "lastMessageAt": MessagingService._format_utc_iso(c.last_message_at),
                "unreadCount": unread
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
            
        messages = db.query(Message).filter_by(conversation_id=conversation_id).order_by(desc(Message.created_at)).limit(limit).all()
        
        result = []
        for m in reversed(messages): # Oldest to newest
            result.append({
                "messageId": m.message_id,
                "conversationId": m.conversation_id,
                "senderId": m.sender_id,
                "receiverId": m.receiver_id,
                "content": m.content,
                "status": m.status,
                "attachmentFileId": m.attachment_file_id,
                "readAt": MessagingService._format_utc_iso(m.read_at),
                "createdAt": MessagingService._format_utc_iso(m.created_at)
            })
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
        messages = db.query(Message).filter_by(conversation_id=conversation_id, receiver_id=user_id, status="SENT").all()
        now = datetime.datetime.utcnow()
        for m in messages:
            m.status = "READ"
            m.read_at = now
            
        db.commit()
