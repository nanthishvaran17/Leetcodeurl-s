from typing import Dict, Any, List, Optional
import os
import json
import uuid
import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from backend.database import SessionLocal
from backend.models import (
    Student, User, Department, Section, FacultyStudentAssignment,
    NotificationRecord, FCMDeviceToken
)
from backend.logger import logger

try:
    import firebase_admin
    from firebase_admin import credentials, messaging, firestore
    FIREBASE_ADMIN_AVAILABLE = True
except ImportError:
    firebase_admin = None
    credentials = None
    messaging = None
    firestore = None
    FIREBASE_ADMIN_AVAILABLE = False

def _init_firebase_admin():
    if not (FIREBASE_ADMIN_AVAILABLE and firebase_admin):
        return
    try:
        if not firebase_admin._apps:
            # 1. Environment variable (JSON string)
            env_json = (
                os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON") or 
                os.environ.get("FIREBASE_CREDENTIALS_JSON") or 
                os.environ.get("FIREBASE_CREDENTIALS")
            )
            if env_json and env_json.strip():
                try:
                    cred_dict = json.loads(env_json.strip())
                    cred = credentials.Certificate(cred_dict)
                    firebase_admin.initialize_app(cred)
                    logger.info("[FIREBASE] Admin SDK initialized from environment JSON.")
                    return
                except Exception as _e_json:
                    logger.warning(f"[FIREBASE] Failed parsing env JSON: {_e_json}")

            # 2. Disk file checks
            root_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            possible_paths = [
                os.path.join(root_dir, 'serviceAccountKey.json'),
                os.path.join(root_dir, 'firebase-service-account.json'),
                os.path.join(os.path.dirname(os.path.dirname(__file__)), 'serviceAccountKey.json'),
                os.path.join(os.path.dirname(__file__), 'serviceAccountKey.json'),
            ]
            for p in possible_paths:
                if os.path.exists(p):
                    try:
                        cred = credentials.Certificate(p)
                        firebase_admin.initialize_app(cred)
                        logger.info(f"[FIREBASE] Admin SDK initialized from {os.path.basename(p)}.")
                        return
                    except Exception as _file_err:
                        logger.warning(f"[FIREBASE] Certificate error with {p}: {_file_err}")

            # 3. Application Default Credentials
            try:
                cred = credentials.ApplicationDefault()
                firebase_admin.initialize_app(cred)
                logger.info("[FIREBASE] Admin SDK initialized using ApplicationDefault.")
            except Exception as _adc_err:
                logger.warning(f"[FIREBASE] Push notifications notice: serviceAccountKey.json missing or invalid ({_adc_err}).")
    except Exception as e:
        logger.error(f"[FIREBASE] Error initializing Firebase Admin: {e}")

_init_firebase_admin()


EVENT_CATEGORY_MAP = {
    "PROFILE_CREATED": "account", "PROFILE_UPDATED": "account", "PROFILE_APPROVED": "account",
    "PROFILE_REJECTED": "account", "ROLE_CHANGED": "account", "DEPARTMENT_CHANGED": "account",
    "PASSWORD_CHANGED": "account", "PASSWORD_RESET": "account", "EMAIL_CHANGED": "account",
    "PHONE_CHANGED": "account", "ACCOUNT_ACTIVATED": "account", "ACCOUNT_DEACTIVATED": "account",
    
    "ASSIGNMENT_CREATED": "assignments", "ASSIGNMENT_UPDATED": "assignments",
    "ASSIGNMENT_REASSIGNED": "assignments", "ASSIGNMENT_CANCELLED": "assignments",
    "ASSIGNMENT_COMPLETED": "assignments", "ASSIGNMENT_DUE_SOON": "assignments", "ASSIGNMENT_OVERDUE": "assignments",
    
    "ATTENDANCE_ASSIGNED": "attendance", "ATTENDANCE_PENDING": "attendance", "ATTENDANCE_SUBMITTED": "attendance",
    "ATTENDANCE_UPDATED": "attendance", "ATTENDANCE_CORRECTION_REQUIRED": "attendance",
    "ATTENDANCE_DEADLINE": "attendance", "LOW_ATTENDANCE_ALERT": "attendance",
    
    "TIMETABLE_CREATED": "timetable", "TIMETABLE_UPDATED": "timetable", "TIMETABLE_CLASS_CHANGED": "timetable",
    "TIMETABLE_ROOM_CHANGED": "timetable", "TIMETABLE_FACULTY_CHANGED": "timetable",
    "TIMETABLE_CANCELLED": "timetable", "TIMETABLE_REMINDER": "timetable",
    
    "EXAM_SCHEDULED": "exams", "EXAM_UPDATED": "exams", "EXAM_CANCELLED": "exams", "EXAM_REMINDER": "exams",
    "CAT1_SCHEDULED": "exams", "CAT2_SCHEDULED": "exams", "MODEL_EXAM_SCHEDULED": "exams", "INTERNAL_ASSESSMENT_UPDATED": "exams",
    
    "MARKS_PUBLISHED": "marks", "MARKS_UPDATED": "marks", "RESULT_PUBLISHED": "marks",
    "CAT1_RESULT_PUBLISHED": "marks", "CAT2_RESULT_PUBLISHED": "marks",
    "SEMESTER_RESULT_PUBLISHED": "marks", "MARKS_CORRECTION_REQUIRED": "marks",
    
    "LEAVE_APPLIED": "leave", "LEAVE_APPROVED": "leave", "LEAVE_REJECTED": "leave",
    "LEAVE_CANCELLED": "leave", "LEAVE_MODIFIED": "leave", "LEAVE_REMINDER": "leave",
    
    "OD_APPLIED": "leave", "OD_APPROVED": "leave", "OD_REJECTED": "leave",
    "SL_APPLIED": "leave", "SL_APPROVED": "leave", "SL_REJECTED": "leave",
    
    "MEETING_CREATED": "meetings", "MEETING_UPDATED": "meetings", "MEETING_CANCELLED": "meetings",
    "MEETING_REMINDER": "meetings", "MEETING_STARTED": "meetings", "MEETING_RESCHEDULED": "meetings",
    
    "EVENT_CREATED": "events", "EVENT_UPDATED": "events", "EVENT_CANCELLED": "events",
    "EVENT_REMINDER": "events", "EVENT_STARTED": "events", "EVENT_RESCHEDULED": "events",
    
    "DOCUMENT_UPLOADED": "files", "STUDY_MATERIAL_UPLOADED": "files",
    "FILE_UPLOADED": "files", "FILE_UPDATED": "files", "REPORT_GENERATED": "reports",
    "REPORT_PUBLISHED": "reports", "REPORT_UPDATED": "reports", "REPORT_AVAILABLE": "reports",
    
    "ACHIEVEMENT_CREATED": "achievements", "ACHIEVEMENT_APPROVED": "achievements",
    "ACHIEVEMENT_PUBLISHED": "achievements", "CERTIFICATE_AVAILABLE": "achievements",
    
    "CONTEST_CREATED": "contests", "CONTEST_UPDATED": "contests", "CONTEST_STARTED": "contests",
    "CONTEST_REMINDER": "contests", "CONTEST_ENDING": "contests", "CONTEST_RESULT": "contests",
    "RANK_UPDATED": "contests", "ACHIEVEMENT_UNLOCKED": "contests",
    
    "PLACEMENT_DRIVE_CREATED": "placement", "PLACEMENT_DRIVE_UPDATED": "placement",
    "INTERVIEW_SCHEDULED": "placement", "SELECTION_RESULT": "placement",
    
    "ANNOUNCEMENT_CREATED": "announcements", "ANNOUNCEMENT_UPDATED": "announcements",
    "URGENT_ANNOUNCEMENT": "announcements", "DEPARTMENT_ANNOUNCEMENT": "announcements",
    
    "APP_UPDATE_AVAILABLE": "app_updates", "APP_UPDATE_REQUIRED": "app_updates",
    "MAINTENANCE_SCHEDULED": "system", "SYSTEM_ANNOUNCEMENT": "system", "SECURITY_ALERT": "system"
}

EVENT_DESTINATION_MAP = {
    "PROFILE_UPDATED": {"route": "/settings", "priority": "normal", "entity_type": "USER"},
    "REPORT_GENERATED": {"route": "/reports", "priority": "normal", "entity_type": "REPORT"},
    "FILE_UPLOADED": {"route": "/messages", "priority": "normal", "entity_type": "FILE"},
    "DIRECT_MESSAGE": {"route": "/messages", "priority": "high", "entity_type": "MESSAGE"},
    "CONTEST_REMINDER": {"route": "/weekly-contest", "priority": "high", "entity_type": "CONTEST"},
    "MARKS_PUBLISHED": {"route": "/reports", "priority": "high", "entity_type": "MARK"},
    "ASSIGNMENT_CREATED": {"route": "/faculty-action-center", "priority": "normal", "entity_type": "ASSIGNMENT"},
    "ATTENDANCE_UPDATED": {"route": "/students", "priority": "normal", "entity_type": "ATTENDANCE"}
}


class NotificationService:
    @staticmethod
    def resolve_category(event_type: str) -> str:
        """Maps event types to user-friendly notification categories."""
        return EVENT_CATEGORY_MAP.get(str(event_type).upper(), "announcements")

    @staticmethod
    def resolve_recipients(
        db: Session,
        recipient_scope: str,
        recipient_target: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Resolves target recipients (User/Student IDs, emails, roles) based on scope.
        Returns list of dicts: [{'user_id': str, 'email': str, 'user_type': 'STUDENT'|'STAFF'}]
        """
        recipients: List[Dict[str, Any]] = []
        scope = (recipient_scope or "ALL").upper().strip()

        if scope in ("INDIVIDUAL", "USER"):
            if recipient_target:
                clean_target = str(recipient_target).strip()
                # Check user table safely without type casting error in Postgres
                user_filters = [User.email == clean_target, User.username == clean_target]
                if clean_target.isdigit():
                    user_filters.append(User.id == int(clean_target))
                elif clean_target.startswith("STAFF_") and clean_target.replace("STAFF_", "").isdigit():
                    user_filters.append(User.id == int(clean_target.replace("STAFF_", "")))
                
                u = db.query(User).filter(or_(*user_filters)).first()
                if u:
                    recipients.append({"user_id": u.email or f"STAFF_{u.id}", "email": u.email, "user_type": "STAFF"})
                
                # Check student table safely
                student_filters = [Student.email == clean_target, Student.reg_no == clean_target, Student.username == clean_target]
                if clean_target.isdigit():
                    student_filters.append(Student.id == int(clean_target))
                    
                s = db.query(Student).filter(or_(*student_filters)).first()
                if s:
                    recipients.append({"user_id": s.email or s.reg_no, "email": s.email, "user_type": "STUDENT"})
                    
                if not recipients:
                    recipients.append({"user_id": clean_target, "email": clean_target, "user_type": "USER"})
                    
        elif scope in ("ROLE", "STAFF"):
            target_role = (recipient_target or "").strip()
            query = db.query(User).filter(User.is_active == True)
            if target_role and target_role.upper() != "ALL":
                query = query.filter(User.role.ilike(f"%{target_role}%"))
            for u in query.all():
                recipients.append({"user_id": u.email or f"STAFF_{u.id}", "email": u.email, "user_type": "STAFF"})

        elif scope == "DEPARTMENT":
            dept_code = (recipient_target or "").strip()
            # Students in department
            s_query = db.query(Student).join(Department).filter(Student.is_active == True)
            if dept_code and dept_code.upper() != "ALL":
                s_query = s_query.filter(or_(Department.code == dept_code, Department.name == dept_code))
            for s in s_query.all():
                recipients.append({"user_id": s.email or s.reg_no, "email": s.email, "user_type": "STUDENT"})
                
            # Staff in department
            u_query = db.query(User).join(Department).filter(User.is_active == True)
            if dept_code and dept_code.upper() != "ALL":
                u_query = u_query.filter(or_(Department.code == dept_code, Department.name == dept_code))
            for u in u_query.all():
                recipients.append({"user_id": u.email or f"STAFF_{u.id}", "email": u.email, "user_type": "STAFF"})

        elif scope in ("SEMESTER", "YEAR"):
            year_lvl = (recipient_target or "").strip()
            s_query = db.query(Student).filter(Student.is_active == True)
            if year_lvl and year_lvl.upper() != "ALL":
                s_query = s_query.filter(Student.year_level == year_lvl)
            for s in s_query.all():
                recipients.append({"user_id": s.email or s.reg_no, "email": s.email, "user_type": "STUDENT"})

        elif scope in ("SECTION", "CLASS"):
            sec_name = (recipient_target or "").strip()
            s_query = db.query(Student).join(Section).filter(Student.is_active == True)
            if sec_name and sec_name.upper() != "ALL":
                s_query = s_query.filter(Section.name == sec_name)
            for s in s_query.all():
                recipients.append({"user_id": s.email or s.reg_no, "email": s.email, "user_type": "STUDENT"})

        elif scope == "MENTOR_GROUP":
            # Target assigned students of a specific faculty
            faculty_id = recipient_target
            assignments = db.query(FacultyStudentAssignment).join(Student).filter(FacultyStudentAssignment.faculty_id == faculty_id).all()
            for a in assignments:
                if a.student and a.student.is_active:
                    recipients.append({"user_id": a.student.email or a.student.reg_no, "email": a.student.email, "user_type": "STUDENT"})

        elif scope in ("ALL", "GLOBAL"):
            # All active users and students
            for s in db.query(Student).filter(Student.is_active == True).all():
                recipients.append({"user_id": s.email or s.reg_no, "email": s.email, "user_type": "STUDENT"})
            for u in db.query(User).filter(User.is_active == True).all():
                recipients.append({"user_id": u.email or f"STAFF_{u.id}", "email": u.email, "user_type": "STAFF"})

        # Deduplicate by user_id
        seen = set()
        deduped = []
        for r in recipients:
            uid = r["user_id"]
            if uid and uid not in seen:
                seen.add(uid)
                deduped.append(r)

        return deduped

    @staticmethod
    def emit_event(
        event_type: str,
        title: str,
        body: str,
        actor_user_id: Optional[str] = None,
        recipient_scope: str = "ALL",
        recipient_target: Optional[str] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        file_id: Optional[str] = None,
        route: Optional[str] = None,
        priority: str = "normal",
        event_id: Optional[str] = None,
        expires_at: Optional[datetime.datetime] = None,
        metadata: Optional[Dict[str, Any]] = None,
        send_email_notification: bool = True
    ) -> Dict[str, Any]:
        """
        MASTER CENTRAL NOTIFICATION ENGINE ENTRY POINT
        Idempotent, multi-device, multi-channel event notification dispatcher.
        """
        db = SessionLocal()
        try:
            logger.info(f"[NOTIF-DEBUG] EVENT_CREATED type={event_type} scope={recipient_scope} target={recipient_target} actor={actor_user_id}")

            # 1. Idempotency Check (Duplicate Prevention)
            eff_event_id = event_id or f"{event_type}_{entity_id or 'GEN'}_{int(datetime.datetime.utcnow().timestamp())}"
            
            # Check for duplicate event_id to prevent multi-device duplication
            if event_id:
                existing = db.query(NotificationRecord).filter_by(event_id=event_id).first()
                if existing:
                    logger.info(f"[NOTIF-DEBUG] DUPLICATE_EVENT_PREVENTED event_id={event_id}")
                    return {"success": True, "duplicate_prevented": True, "event_id": event_id}

            category = NotificationService.resolve_category(event_type)
            recipients = NotificationService.resolve_recipients(db, recipient_scope, recipient_target)
            
            logger.info(f"[NOTIF-DEBUG] RECIPIENTS_RESOLVED count={len(recipients)} targets={[r['user_id'] for r in recipients]}")

            if not recipients:
                logger.info(f"[NOTIF-DEBUG] NO_RECIPIENTS_FOUND scope={recipient_scope}, target={recipient_target}")
                return {"success": True, "created_count": 0, "event_id": eff_event_id}

            # Enrich payload based on Central Destination Resolution Map
            dest_map = EVENT_DESTINATION_MAP.get(event_type.upper(), {})
            eff_route = route or dest_map.get("route", "/dashboard")
            eff_priority = priority if priority != "normal" else dest_map.get("priority", "normal")
            eff_entity_type = entity_type or dest_map.get("entity_type")

            meta_str = json.dumps(metadata) if metadata else None
            notif_records = []
            firestore_batch_items = []
            
            now_utc = datetime.datetime.utcnow()

            for r in recipients:
                uid = r["user_id"]
                n_id = f"NOTIF_{uuid.uuid4().hex[:16]}"
                
                # SQLite Record
                record = NotificationRecord(
                    notification_id=n_id,
                    event_id=eff_event_id,
                    event_type=event_type,
                    category=category,
                    recipient_user_id=uid,
                    actor_user_id=actor_user_id,
                    title=title,
                    body=body,
                    entity_type=eff_entity_type,
                    entity_id=entity_id,
                    file_id=file_id,
                    route=eff_route,
                    priority=eff_priority,
                    is_read=False,
                    expires_at=expires_at,
                    delivery_status="SENT",
                    metadata_json=meta_str,
                    created_at=now_utc
                )
                db.add(record)
                notif_records.append(record)
                
                firestore_batch_items.append({
                    "id": n_id,
                    "eventId": eff_event_id,
                    "title": title,
                    "message": body,
                    "type": category,
                    "priority": eff_priority,
                    "recipientUserId": uid,
                    "recipientType": r["user_type"],
                    "createdAt": firestore.SERVER_TIMESTAMP if (FIREBASE_ADMIN_AVAILABLE and firestore and firebase_admin and firebase_admin._apps) else now_utc.isoformat(),
                    "isRead": False,
                    "actionRoute": eff_route,
                    "createdBy": actor_user_id or "System",
                    "entityType": eff_entity_type,
                    "entityId": entity_id,
                    "fileId": file_id
                })

            db.commit()
            logger.info(f"[NOTIF-DEBUG] DB_SAVED created_count={len(notif_records)} event_id={eff_event_id}")

            # 1.5 Real-Time WebSocket Delivery
            try:
                from backend.websocket_manager import manager
                for item in firestore_batch_items:
                    ws_payload = {
                        "type": "NEW_NOTIFICATION",
                        "notification": {
                            "id": item["id"],
                            "notification_id": item["id"],
                            "event_id": eff_event_id,
                            "recipient_id": item["recipientUserId"],
                            "recipient_user_id": item["recipientUserId"],
                            "category": category,
                            "event_type": event_type,
                            "title": title,
                            "message": body,
                            "body": body,
                            "sender_id": actor_user_id,
                            "sender_name": actor_user_id or "System",
                            "created_at": now_utc.isoformat(),
                            "action_url": eff_route,
                            "action_route": eff_route,
                            "priority": eff_priority,
                            "entity_type": eff_entity_type,
                            "entity_id": entity_id,
                            "file_id": file_id,
                            "is_read": False
                        }
                    }
                    logger.info(f"[NOTIF-DEBUG] WEBSOCKET_DISPATCH_TRIGGERED recipient={item['recipientUserId']} notif_id={item['id']}")
                    if (recipient_scope or "").upper() in ("ALL", "GLOBAL"):
                        manager.broadcast_sync(ws_payload)
                    else:
                        manager.send_to_user_sync(item["recipientUserId"], ws_payload)
            except Exception as _ws_err:
                logger.warning(f"[NOTIF-DEBUG] WEBSOCKET_DISPATCH_ERROR: {_ws_err}")

            # 2. Firestore Real-time Sync
            if FIREBASE_ADMIN_AVAILABLE and firestore and firebase_admin and firebase_admin._apps:
                try:
                    db_fs = firestore.client()
                    batch = db_fs.batch()
                    for item in firestore_batch_items:
                        doc_ref = db_fs.collection('notifications').document(item["id"])
                        batch.set(doc_ref, item)
                    batch.commit()
                except Exception as fs_err:
                    logger.warning(f"[NOTIF_ENGINE] Firestore sync notice: {fs_err}")

            # 3. FCM Multi-Device Push Dispatch & Token Cleanup
            fcm_dispatched = 0
            if FIREBASE_ADMIN_AVAILABLE and messaging and firebase_admin and firebase_admin._apps:
                is_high_priority = eff_priority in ("high", "critical")
                raw_route = str(eff_route or "/dashboard")
                fcm_link = raw_route if raw_route.startswith("http") else f"https://leetcodeurl-s-3mig.onrender.com{raw_route}"
                
                target_uids = set(r["user_id"] for r in recipients if r.get("user_id"))
                for r in recipients:
                    if r.get("email"):
                        target_uids.add(r["email"])

                active_tokens = db.query(FCMDeviceToken).filter(
                    and_(FCMDeviceToken.user_id.in_(list(target_uids)), FCMDeviceToken.is_active == True)
                ).all()

                stale_tokens = []
                for t_obj in active_tokens:
                    try:
                        fcm_msg = messaging.Message(
                            notification=messaging.Notification(title=title, body=body),
                            token=t_obj.device_token,
                            data={
                                "notificationId": eff_event_id,
                                "type": str(event_type),
                                "category": str(category),
                                "actionRoute": raw_route,
                                "entityType": str(entity_type or ""),
                                "entityId": str(entity_id or ""),
                                "fileId": str(file_id or ""),
                                "priority": str(eff_priority)
                            },
                            android=messaging.AndroidConfig(
                                priority="high" if is_high_priority else "normal",
                                notification=messaging.AndroidNotification(
                                    title=title,
                                    body=body,
                                    icon="stock_ticker_update",
                                    color="#3b82f6",
                                    sound="default",
                                    default_sound=True,
                                    default_vibrate_timings=True,
                                    channel_id="leetcode_intelligence_channel",
                                    visibility="public",
                                    notification_count=1
                                )
                            ),
                            webpush=messaging.WebpushConfig(
                                headers={
                                    "Urgency": "high" if is_high_priority else "normal"
                                },
                                notification=messaging.WebpushNotification(
                                    title=title,
                                    body=body,
                                    icon="/logo.png",
                                    badge="/logo.png",
                                    tag=eff_event_id,
                                    require_interaction=is_high_priority
                                ),
                                fcm_options=messaging.WebpushFCMOptions(
                                    link=fcm_link
                                )
                            )
                        )
                        messaging.send(fcm_msg)
                        fcm_dispatched += 1
                    except Exception as fcm_err:
                        err_str = str(fcm_err).upper()
                        if "UNREGISTERED" in err_str or "INVALID_ARGUMENT" in err_str or "NOT_FOUND" in err_str:
                            stale_tokens.append(t_obj)

                # Clean up stale/invalid tokens
                if stale_tokens:
                    for st in stale_tokens:
                        st.is_active = False
                    db.commit()
                    logger.info(f"[NOTIF_ENGINE] Deactivated {len(stale_tokens)} stale FCM tokens.")

                # Also send to FCM global topic 'all_app_users' if priority is high/critical or announcement
                if priority in ("high", "critical") or event_type in ("APP_UPDATE_AVAILABLE", "APP_UPDATE_REQUIRED", "URGENT_ANNOUNCEMENT"):
                    try:
                        topic_msg = messaging.Message(
                            notification=messaging.Notification(title=title, body=body),
                            topic="all_app_users",
                            data={
                                "notificationId": eff_event_id,
                                "type": str(event_type),
                                "category": str(category),
                                "actionRoute": raw_route,
                                "priority": str(eff_priority)
                            },
                            android=messaging.AndroidConfig(
                                priority="high" if is_high_priority else "normal",
                                notification=messaging.AndroidNotification(
                                    title=title,
                                    body=body,
                                    sound="default",
                                    default_sound=True,
                                    default_vibrate_timings=True,
                                    channel_id="leetcode_intelligence_channel",
                                    visibility="public"
                                )
                            ),
                            webpush=messaging.WebpushConfig(
                                headers={
                                    "Urgency": "high" if is_high_priority else "normal"
                                },
                                notification=messaging.WebpushNotification(
                                    title=title,
                                    body=body,
                                    icon="/logo.png",
                                    badge="/logo.png",
                                    tag=eff_event_id,
                                    require_interaction=is_high_priority
                                ),
                                fcm_options=messaging.WebpushFCMOptions(
                                    link=fcm_link
                                )
                            )
                        )
                        messaging.send(topic_msg)
                    except Exception as t_err:
                        logger.warning(f"[NOTIF_ENGINE] FCM topic broadcast notice: {t_err}")

            # 4. Optional Email Dispatch
            if send_email_notification:
                try:
                    from backend.services.email_service import dispatch_notification_email
                    email_targets = list(set([r["email"] for r in recipients if r["email"] and "@" in r["email"]]))
                    for e_mail in email_targets:
                        try:
                            dispatch_notification_email(
                                to_email=e_mail,
                                subject=title,
                                message_body=body,
                                action_route=route
                            )
                        except Exception as e_err:
                            logger.warning(f"[NOTIF_ENGINE] Email notice to {e_mail}: {e_err}")
                except Exception as email_err:
                    logger.warning(f"[NOTIF_ENGINE] Email dispatch notice: {email_err}")

            return {
                "success": True,
                "event_id": eff_event_id,
                "created_count": len(recipients),
                "fcm_dispatched": fcm_dispatched
            }

        except Exception as e:
            logger.error(f"[NOTIF_ENGINE] Error emitting event {event_type}: {e}", exc_info=True)
            db.rollback()
            return {"success": False, "error": str(e)}
        finally:
            db.close()

    @staticmethod
    def register_device_token(
        db: Session,
        user_id: str,
        device_token: str,
        platform: str = "android",
        app_version: Optional[str] = None,
        device_model: Optional[str] = None
    ) -> Dict[str, Any]:
        """Registers client FCM device token for targeted & multi-device push delivery."""
        try:
            tok = db.query(FCMDeviceToken).filter_by(device_token=device_token).first()
            if not tok:
                tok = FCMDeviceToken(
                    user_id=user_id,
                    device_token=device_token,
                    platform=platform,
                    app_version=app_version,
                    device_model=device_model,
                    is_active=True,
                    last_seen=datetime.datetime.utcnow()
                )
                db.add(tok)
            else:
                tok.user_id = user_id
                tok.platform = platform
                if app_version: tok.app_version = app_version
                if device_model: tok.device_model = device_model
                tok.is_active = True
                tok.last_seen = datetime.datetime.utcnow()

            db.commit()

            # Subscribe to FCM topic "all_app_users"
            if FIREBASE_ADMIN_AVAILABLE and messaging:
                try:
                    messaging.subscribe_to_topic([device_token], "all_app_users")
                except Exception as sub_err:
                    logger.warning(f"[FCM] Topic sub notice: {sub_err}")

            return {"success": True, "token_id": tok.id, "user_id": user_id}
        except Exception as e:
            db.rollback()
            logger.error(f"[FCM_REGISTER_ERROR] {e}")
            return {"success": False, "error": str(e)}

    @staticmethod
    def unregister_device_token(db: Session, user_id: str, device_token: str) -> Dict[str, Any]:
        """Deactivates device token on user logout."""
        try:
            tok = db.query(FCMDeviceToken).filter_by(device_token=device_token, user_id=user_id).first()
            if tok:
                tok.is_active = False
                db.commit()
            return {"success": True}
        except Exception as e:
            db.rollback()
            return {"success": False, "error": str(e)}

    @staticmethod
    def send_targeted_notification(
        title: str, 
        message: str, 
        notification_type: str = 'announcement',
        priority: str = 'normal',
        department_name: Optional[str] = None,
        year_level: Optional[str] = None,
        section_name: Optional[str] = None,
        created_by: str = 'Admin',
        action_route: Optional[str] = None,
        staff_app_push_only: bool = True
    ):
        """Backward-compatible targeted notification caller using central engine."""
        scope = "ALL"
        target = None
        if department_name:
            scope = "DEPARTMENT"
            target = department_name
        elif year_level:
            scope = "SEMESTER"
            target = year_level
        elif section_name:
            scope = "SECTION"
            target = section_name

        return NotificationService.emit_event(
            event_type=notification_type.upper(),
            title=title,
            body=message,
            actor_user_id=created_by,
            recipient_scope=scope,
            recipient_target=target,
            route=action_route,
            priority=priority
        )

    @staticmethod
    def send_app_update_broadcast(
        title: str, 
        message: str, 
        feature_version: str = "2.0.0",
        action_route: str = "/dashboard",
        created_by: str = "Admin / Developer"
    ):
        """Broadcasts app update notification to all app users."""
        return NotificationService.emit_event(
            event_type="APP_UPDATE_AVAILABLE",
            title=title,
            body=message,
            actor_user_id=created_by,
            recipient_scope="ALL",
            route=action_route,
            priority="high",
            metadata={"version": feature_version}
        )

    @staticmethod
    def subscribe_device_token_to_topic(token: str, topic: str = "all_app_users") -> Dict[str, Any]:
        if FIREBASE_ADMIN_AVAILABLE and messaging:
            try:
                response = messaging.subscribe_to_topic([token], topic)
                return {"success": response.success_count > 0, "topic": topic}
            except Exception as e:
                return {"success": True, "topic": topic, "note": str(e)}
        return {"success": False, "note": "Firebase Admin SDK not loaded."}

    @staticmethod
    def create_direct_notification(
        title: str,
        message: str,
        recipient_user_ids: List[str],
        notification_type: str = 'announcement',
        priority: str = 'normal',
        action_route: Optional[str] = None,
        created_by: str = 'System'
    ) -> Dict[str, Any]:
        """Direct notification caller for specific recipient list."""
        created_count = 0
        for uid in set(recipient_user_ids):
            if not uid: continue
            res = NotificationService.emit_event(
                event_type=notification_type.upper(),
                title=title,
                body=message,
                actor_user_id=created_by,
                recipient_scope="INDIVIDUAL",
                recipient_target=uid,
                route=action_route,
                priority=priority
            )
            if res.get("success"):
                created_count += 1
        return {"success": True, "created_count": created_count}
