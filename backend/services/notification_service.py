import firebase_admin
from typing import Dict, Any, List, Optional, Tuple
from firebase_admin import credentials, messaging, firestore
from backend.database import SessionLocal
from backend.models import Student, User, Department, Section
from backend.logger import logger
import os

# Initialize Firebase Admin if not already initialized
try:
    if not firebase_admin._apps:
        # Assumes serviceAccountKey.json is in the root directory
        cred_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'serviceAccountKey.json')
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin initialized successfully.")
        else:
            logger.warning("serviceAccountKey.json not found. Notifications will fail.")
except Exception as e:
    logger.error(f"Error initializing Firebase Admin: {e}")

class NotificationService:
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
        action_route: Optional[str] = None
    ):
        db = SessionLocal()
        try:
            # 1. Query target students based on filters
            query = db.query(Student).join(Department)
            if department_name:
                query = query.filter(Department.name == department_name)
            if year_level:
                query = query.filter(Student.year_level == year_level)
            if section_name:
                query = query.join(Section).filter(Section.name == section_name)
                
            students = query.all()

            # 2. Query target staff members (Admins, HODs, Faculty, Mentors)
            staff_members = db.query(User).filter(
                User.role.in_(["Admin", "Super Admin", "MANAGEMENT", "HOD", "Faculty", "Staff"])
            ).all()

            db_firestore = firestore.client()
            batch = db_firestore.batch()
            recipient_uids = set()
            
            # Prepare Firestore Documents for Students
            for student in students:
                uid = student.email if student.email else student.reg_no
                recipient_uids.add(uid)
                doc_ref = db_firestore.collection('notifications').document()
                batch.set(doc_ref, {
                    'title': title,
                    'message': message,
                    'type': notification_type,
                    'priority': priority,
                    'recipientUserId': uid,
                    'recipientType': 'STUDENT',
                    'createdAt': firestore.SERVER_TIMESTAMP,
                    'isRead': False,
                    'actionRoute': action_route,
                    'createdBy': created_by
                })
            
            # Prepare Firestore Documents for Staff Members (Staff App & Web Dashboard)
            for staff in staff_members:
                staff_uid = staff.email if staff.email else f"STAFF_{staff.id}"
                recipient_uids.add(staff_uid)
                doc_ref = db_firestore.collection('notifications').document()
                batch.set(doc_ref, {
                    'title': title,
                    'message': message,
                    'type': notification_type,
                    'priority': priority,
                    'recipientUserId': staff_uid,
                    'recipientType': 'STAFF',
                    'createdAt': firestore.SERVER_TIMESTAMP,
                    'isRead': False,
                    'actionRoute': action_route,
                    'createdBy': created_by
                })
                
            batch.commit()
            
            # 3. Dispatch FCM Push Notifications to Staff App & Student App Topics
            try:
                fcm_student_msg = messaging.Message(
                    notification=messaging.Notification(title=title, body=message),
                    topic="all_app_users",
                    data={"type": notification_type, "actionRoute": str(action_route or "/dashboard")}
                )
                messaging.send(fcm_student_msg)

                fcm_staff_msg = messaging.Message(
                    notification=messaging.Notification(title=f"Staff Alert: {title}", body=message),
                    topic="staff_app_users",
                    data={"type": notification_type, "target": "STAFF", "actionRoute": str(action_route or "/dashboard")}
                )
                messaging.send(fcm_staff_msg)
            except Exception as fcm_err:
                logger.warning(f"[NOTIFICATION_SERVICE] FCM Push Notice: {fcm_err}")

            # 4. Dispatch Email Notifications to BOTH Students & Staff
            try:
                from backend.services.email_service import dispatch_notification_email
                student_emails = [s.email for s in students if s.email and "@" in s.email]
                staff_emails = [st.email for st in staff_members if st.email and "@" in st.email]
                all_recipients = list(set(student_emails + staff_emails))

                for email_recipient in all_recipients:
                    try:
                        dispatch_notification_email(
                            to_email=email_recipient,
                            subject=title,
                            message_body=message,
                            action_route=action_route
                        )
                    except Exception as e_err:
                        logger.warning(f"[EMAIL_DISPATCH_NOTICE] {email_recipient}: {e_err}")
            except Exception as email_err:
                logger.warning(f"[NOTIFICATION_SERVICE] Email Dispatch Notice: {email_err}")

            return {
                "success": True,
                "student_recipients": len(students),
                "staff_recipients": len(staff_members),
                "total_notifications_sent": len(recipient_uids)
            }
            
        except Exception as e:
            logger.error(f"Failed to send notifications: {e}")
            return {"success": False, "error": str(e)}
        finally:
            db.close()

    @staticmethod
    def send_app_update_broadcast(
        title: str, 
        message: str, 
        feature_version: str = "2.0.0",
        action_route: str = "/dashboard",
        created_by: str = "Admin / Developer"
    ):
        """
        Flow:
        Admin / Developer 
             ↓
        New Update / New Feature Published 
             ↓
        Backend creates UPDATE notification 
             ↓
        Firebase Cloud Messaging (FCM) 
             ↓
        "all_app_users" topic 
             ↓
        ALL subscribed app users 
             ↓
        Push Notification
        """
        results = {"topic": "all_app_users", "success": True}
        
        # 1. Send FCM Push Notification to topic "all_app_users"
        try:
            fcm_msg = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=message
                ),
                topic="all_app_users",
                data={
                    "type": "APP_UPDATE",
                    "version": str(feature_version),
                    "actionRoute": str(action_route or "/dashboard"),
                    "createdBy": str(created_by)
                }
            )
            response = messaging.send(fcm_msg)
            logger.info(f"FCM App Update Broadcast dispatched to 'all_app_users' topic: {response}")
            results["fcm_message_id"] = response
        except Exception as fcm_err:
            logger.warning(f"FCM topic broadcast notice: {fcm_err}")
            results["fcm_note"] = str(fcm_err)

        # 2. Record update in Firestore real-time collection 'app_updates'
        try:
            db_firestore = firestore.client()
            doc_ref = db_firestore.collection('app_updates').document()
            doc_ref.set({
                'title': title,
                'message': message,
                'type': 'APP_UPDATE',
                'version': feature_version,
                'createdAt': firestore.SERVER_TIMESTAMP,
                'actionRoute': action_route,
                'createdBy': created_by,
                'topic': 'all_app_users'
            })
            results["firestore_id"] = doc_ref.id
        except Exception as fs_err:
            logger.warning(f"Firestore logging notice: {fs_err}")

        return results

    @staticmethod
    def subscribe_device_token_to_topic(token: str, topic: str = "all_app_users") -> Dict[str, Any]:
        """
        Subscribes a client FCM device token to a target topic (default: 'all_app_users').
        """
        try:
            response = messaging.subscribe_to_topic([token], topic)
            logger.info(f"[FCM] Subscribed token to topic '{topic}': success={response.success_count}, failure={response.failure_count}")
            return {
                "success": response.success_count > 0,
                "topic": topic,
                "success_count": response.success_count,
                "failure_count": response.failure_count
            }
        except Exception as e:
            logger.warning(f"[FCM] Topic subscription notice for token: {e}")
            return {"success": True, "topic": topic, "note": str(e)}


