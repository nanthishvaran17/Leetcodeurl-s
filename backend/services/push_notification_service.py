"""
push_notification_service.py — Production Firebase Admin Push Notification Engine

Handles real-time push notification dispatch across Android, iOS (PWA/Capacitor), and Web/PWA platforms
using the Firebase Admin SDK and FCM (Firebase Cloud Messaging).

Features:
1. Authoritative Firebase Admin SDK credential loading via backend/firebase-key.json.
2. Single device, multicast, topic, user-targeted, and institutional broadcast push capabilities.
3. Multi-platform notification payloads:
   - Android Notification Channels (Urgent Heads-Up, Sound, Vibration, Color, Visibility).
   - WebPush / PWA (Urgency, Icon, Badge, Actions, Deep link routing).
   - Apple Push Notification Service (APNS) payload & sound configuration.
4. Preference validation (respects user opt-outs and channel-level preference toggles).
5. Automatic stale/expired device token deactivation upon FCM Unregistered / Invalid token errors.
6. Audit & History persistence via NotificationRecord database model.
"""

import os
import json
import uuid
import datetime
import logging
from typing import List, Dict, Any, Optional, Union
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from backend.logger import logger
from backend.models import (
    User, Student, NotificationRecord, NotificationPreference, FCMDeviceToken, FCMDevice
)

try:
    import firebase_admin
    from firebase_admin import credentials, messaging
    from firebase_admin.exceptions import FirebaseError
    FIREBASE_AVAILABLE = True
except ImportError:
    firebase_admin = None
    credentials = None
    messaging = None
    FirebaseError = Exception
    FIREBASE_AVAILABLE = False


# Supported Android Notification Channels matching frontend ANDROID_CHANNELS
ANDROID_CHANNELS = {
    "messages_channel": "Messages & Chat",
    "account_security": "Account & Security",
    "contest_updates": "Contest Updates",
    "weekly_reports": "Weekly Performance Reports",
    "performance_updates": "Performance Milestones",
    "academic_announcements": "Academic Announcements",
    "system_status": "System Status",
    "leetcode_intelligence_channel": "LeetCode General Alerts",
}

DEFAULT_CHANNEL_ID = "leetcode_intelligence_channel"


class PushNotificationService:
    _app = None
    _initialized = False

    @classmethod
    def get_firebase_app(cls):
        """
        Retrieves or initializes the Firebase Admin app using firebase-key.json or centralized init.
        """
        if cls._initialized and cls._app:
            return cls._app

        if not FIREBASE_AVAILABLE:
            logger.warning("[FCM Push] firebase-admin package is not installed.")
            return None

        # 1. Try centralized firebase_init first
        try:
            from backend.services.firebase_init import get_firebase_app
            app = get_firebase_app()
            if app:
                cls._app = app
                cls._initialized = True
                return cls._app
        except Exception as e:
            logger.debug(f"[FCM Push] firebase_init fallback note: {e}")

        # 2. Check if default app is already active in firebase_admin
        try:
            if firebase_admin._apps:
                cls._app = firebase_admin.get_app()
                cls._initialized = True
                return cls._app
        except Exception:
            pass

        # 3. Direct local disk search for firebase-key.json
        possible_key_paths = [
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "firebase-key.json"),
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "firebase-key.json"),
            os.path.join(os.path.dirname(__file__), "firebase-key.json"),
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "serviceAccountKey.json"),
        ]

        cred = None
        for path in possible_key_paths:
            if os.path.exists(path):
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        key_data = json.load(f)
                    cred = credentials.Certificate(key_data)
                    proj_id = key_data.get("project_id", "leetcode-student-data")
                    cls._app = firebase_admin.initialize_app(cred, {"projectId": proj_id})
                    cls._initialized = True
                    logger.info(f"[FCM Push] Initialized Firebase Admin from {os.path.basename(path)} (project={proj_id})")
                    return cls._app
                except Exception as err:
                    logger.warning(f"[FCM Push] Failed to initialize from {path}: {err}")

        logger.warning("[FCM Push] No valid service account credentials found for push notification delivery.")
        return None

    @classmethod
    def is_configured(cls) -> bool:
        """Checks if Firebase Admin is available and properly initialized."""
        return cls.get_firebase_app() is not None

    @classmethod
    def _build_payloads(
        cls,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        channel_id: str = DEFAULT_CHANNEL_ID,
        route: str = "/dashboard",
        priority: str = "high",
        notification_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Constructs platform-specific configurations for Android, WebPush, and APNS."""
        notif_id = notification_id or f"notif_{uuid.uuid4().hex[:12]}"
        channel = channel_id if channel_id in ANDROID_CHANNELS else DEFAULT_CHANNEL_ID

        clean_data = {
            "notificationId": str(notif_id),
            "actionRoute": str(route or "/dashboard"),
            "route": str(route or "/dashboard"),
            "title": str(title),
            "body": str(body),
            "channelId": str(channel),
            "priority": str(priority),
        }
        if data:
            for k, v in data.items():
                if v is not None:
                    clean_data[str(k)] = str(v)

        # Android specific heads-up notification config
        android_config = messaging.AndroidConfig(
            priority="high" if priority in ("high", "critical") else "normal",
            notification=messaging.AndroidNotification(
                title=title,
                body=body,
                icon="ic_stat_notification",
                color="#3b82f6",
                sound="default",
                default_sound=True,
                default_vibrate_timings=True,
                channel_id=channel,
                visibility="public",
                priority="max" if priority == "critical" else "high",
                notification_count=1,
                tag=notif_id,
            ),
        )

        # WebPush / PWA notification config
        webpush_config = messaging.WebpushConfig(
            headers={
                "Urgency": "high" if priority in ("high", "critical") else "normal"
            },
            notification=messaging.WebpushNotification(
                title=title,
                body=body,
                icon="/android-chrome-192x192.png",
                badge="/favicon-32x32.png",
                tag=notif_id,
                require_interaction=(priority in ("high", "critical")),
            ),
            fcm_options=messaging.WebpushFCMOptions(
                link=route or "/"
            ),
        )

        # APNS (iOS) notification config
        apns_config = messaging.APNSConfig(
            headers={
                "apns-priority": "10" if priority in ("high", "critical") else "5"
            },
            payload=messaging.APNSPayload(
                aps=messaging.Aps(
                    alert=messaging.ApsAlert(title=title, body=body),
                    sound="default",
                    badge=1,
                    content_available=True,
                )
            ),
        )

        return {
            "notification": messaging.Notification(title=title, body=body),
            "data": clean_data,
            "android": android_config,
            "webpush": webpush_config,
            "apns": apns_config,
            "notification_id": notif_id,
        }

    # =========================================================================
    # CORE DISPATCH METHODS
    # =========================================================================

    @classmethod
    def send_push_notification(
        cls,
        device_token: str,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        channel_id: str = DEFAULT_CHANNEL_ID,
        route: str = "/dashboard",
        priority: str = "high",
        notification_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Sends a single push notification to a specific device registration token.
        """
        if not device_token or not device_token.strip():
            return {"success": False, "error": "device_token_empty"}

        app = cls.get_firebase_app()
        if not app:
            logger.warning("[FCM Push] Firebase App unavailable. Push aborted.")
            return {"success": False, "error": "firebase_not_configured"}

        payload = cls._build_payloads(
            title=title,
            body=body,
            data=data,
            channel_id=channel_id,
            route=route,
            priority=priority,
            notification_id=notification_id
        )

        try:
            message = messaging.Message(
                token=device_token.strip(),
                notification=payload["notification"],
                data=payload["data"],
                android=payload["android"],
                webpush=payload["webpush"],
                apns=payload["apns"],
            )
            response = messaging.send(message, app=app)
            logger.info(f"[FCM Push] Single push delivered successfully (id={response})")
            return {
                "success": True,
                "message_id": response,
                "notification_id": payload["notification_id"]
            }
        except Exception as err:
            err_str = str(err)
            is_stale = any(flag in err_str.upper() for flag in ["UNREGISTERED", "INVALID_ARGUMENT", "NOT_FOUND", "SENDER_ID_MISMATCH"])
            logger.warning(f"[FCM Push] Failed to deliver push: {err_str}")
            return {
                "success": False,
                "error": err_str,
                "is_stale_token": is_stale,
                "token": device_token
            }

    @classmethod
    def send_multicast(
        cls,
        tokens: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        channel_id: str = DEFAULT_CHANNEL_ID,
        route: str = "/dashboard",
        priority: str = "high",
        notification_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Sends push notification to multiple device tokens, chunking into batches of 500 (FCM limit).
        """
        unique_tokens = list({t.strip() for t in tokens if t and t.strip()})
        if not unique_tokens:
            return {"success": True, "success_count": 0, "failure_count": 0, "failed_tokens": [], "invalid_tokens": []}

        app = cls.get_firebase_app()
        if not app:
            logger.warning("[FCM Push] Firebase App unavailable. Multicast aborted.")
            return {"success": False, "error": "firebase_not_configured"}

        payload = cls._build_payloads(
            title=title,
            body=body,
            data=data,
            channel_id=channel_id,
            route=route,
            priority=priority,
            notification_id=notification_id
        )

        total_success = 0
        total_failure = 0
        failed_tokens = []
        invalid_tokens = []

        batch_size = 500
        for i in range(0, len(unique_tokens), batch_size):
            chunk = unique_tokens[i:i + batch_size]
            multicast_msg = messaging.MulticastMessage(
                tokens=chunk,
                notification=payload["notification"],
                data=payload["data"],
                android=payload["android"],
                webpush=payload["webpush"],
                apns=payload["apns"],
            )
            try:
                batch_response = messaging.send_each_for_multicast(multicast_msg, app=app)
                total_success += batch_response.success_count
                total_failure += batch_response.failure_count

                for idx, resp in enumerate(batch_response.responses):
                    if not resp.success:
                        token_val = chunk[idx]
                        failed_tokens.append(token_val)
                        err_msg = str(resp.exception) if resp.exception else ""
                        if any(flag in err_msg.upper() for flag in ["UNREGISTERED", "INVALID_ARGUMENT", "NOT_FOUND", "SENDER_ID_MISMATCH"]):
                            invalid_tokens.append(token_val)
            except Exception as batch_err:
                logger.error(f"[FCM Push] Multicast batch failed: {batch_err}")
                total_failure += len(chunk)
                failed_tokens.extend(chunk)

        logger.info(f"[FCM Push] Multicast completed: {total_success} succeeded, {total_failure} failed out of {len(unique_tokens)} tokens.")
        return {
            "success": True,
            "total_tokens": len(unique_tokens),
            "success_count": total_success,
            "failure_count": total_failure,
            "failed_tokens": failed_tokens,
            "invalid_tokens": invalid_tokens,
            "notification_id": payload["notification_id"]
        }

    @classmethod
    def send_to_topic(
        cls,
        topic: str,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        channel_id: str = DEFAULT_CHANNEL_ID,
        route: str = "/dashboard",
        priority: str = "high"
    ) -> Dict[str, Any]:
        """
        Sends a push notification to an FCM topic (e.g. 'all', 'announcements', 'contests').
        """
        if not topic or not topic.strip():
            return {"success": False, "error": "topic_empty"}

        app = cls.get_firebase_app()
        if not app:
            return {"success": False, "error": "firebase_not_configured"}

        clean_topic = topic.strip().replace(" ", "_")
        payload = cls._build_payloads(
            title=title,
            body=body,
            data=data,
            channel_id=channel_id,
            route=route,
            priority=priority
        )

        try:
            msg = messaging.Message(
                topic=clean_topic,
                notification=payload["notification"],
                data=payload["data"],
                android=payload["android"],
                webpush=payload["webpush"],
                apns=payload["apns"],
            )
            resp = messaging.send(msg, app=app)
            logger.info(f"[FCM Push] Topic '{clean_topic}' notification sent (id={resp})")
            return {"success": True, "message_id": resp, "topic": clean_topic}
        except Exception as err:
            logger.error(f"[FCM Push] Topic push failed: {err}")
            return {"success": False, "error": str(err), "topic": clean_topic}

    @classmethod
    def subscribe_to_topic(cls, tokens: List[str], topic: str) -> Dict[str, Any]:
        """Subscribes device tokens to an FCM topic."""
        app = cls.get_firebase_app()
        if not app or not tokens:
            return {"success": False, "error": "firebase_not_configured_or_tokens_empty"}

        clean_topic = topic.strip().replace(" ", "_")
        try:
            resp = messaging.subscribe_to_topic(tokens, clean_topic, app=app)
            return {"success": True, "success_count": resp.success_count, "failure_count": resp.failure_count}
        except Exception as err:
            logger.error(f"[FCM Push] Subscribe to topic error: {err}")
            return {"success": False, "error": str(err)}

    @classmethod
    def unsubscribe_from_topic(cls, tokens: List[str], topic: str) -> Dict[str, Any]:
        """Unsubscribes device tokens from an FCM topic."""
        app = cls.get_firebase_app()
        if not app or not tokens:
            return {"success": False, "error": "firebase_not_configured_or_tokens_empty"}

        clean_topic = topic.strip().replace(" ", "_")
        try:
            resp = messaging.unsubscribe_from_topic(tokens, clean_topic, app=app)
            return {"success": True, "success_count": resp.success_count, "failure_count": resp.failure_count}
        except Exception as err:
            logger.error(f"[FCM Push] Unsubscribe from topic error: {err}")
            return {"success": False, "error": str(err)}

    # =========================================================================
    # USER-CENTRIC TARGETING & DATABASE INTEGRATION
    # =========================================================================

    @classmethod
    def get_user_id_variants(cls, user_id: str) -> List[str]:
        """Expands a user identifier into possible database variants."""
        uid = str(user_id).strip()
        variants = {uid, uid.lower(), uid.upper()}
        if uid.startswith("STAFF_"):
            variants.add(uid.replace("STAFF_", ""))
            variants.add(uid.lower())
        elif uid.isdigit():
            variants.add(f"STAFF_{uid}")
            variants.add(f"staff_{uid}")
        return list(variants)

    @classmethod
    def send_to_user(
        cls,
        db: Session,
        user_id: str,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        category: str = "announcements",
        channel_id: Optional[str] = None,
        route: str = "/dashboard",
        priority: str = "high",
        save_record: bool = True
    ) -> Dict[str, Any]:
        """
        Sends push notification to all active devices registered by a specific user.
        Also validates user notification preferences and persists the notification record.
        """
        if not user_id:
            return {"success": False, "error": "user_id_required"}

        variants = cls.get_user_id_variants(user_id)

        # 1. Check user preferences
        pref = db.query(NotificationPreference).filter(
            NotificationPreference.user_id.in_(variants)
        ).first()

        if pref:
            if not pref.push_enabled:
                logger.info(f"[FCM Push] User {user_id} has push notifications disabled.")
                return {"success": True, "dispatched": 0, "status": "user_opted_out"}

            if pref.categories_json and category:
                try:
                    cat_map = json.loads(pref.categories_json) if isinstance(pref.categories_json, str) else pref.categories_json
                    if isinstance(cat_map, dict) and cat_map.get(str(category).lower()) is False:
                        logger.info(f"[FCM Push] User {user_id} opted out of category {category}.")
                        return {"success": True, "dispatched": 0, "status": "category_opted_out"}
                except Exception:
                    pass

        # 2. Query active tokens across FCMDeviceToken and FCMDevice
        token_records = db.query(FCMDeviceToken).filter(
            FCMDeviceToken.user_id.in_(variants),
            FCMDeviceToken.is_active.is_(True)
        ).all()

        device_records = db.query(FCMDevice).filter(
            FCMDevice.user_id.in_(variants),
            FCMDevice.is_active.is_(True)
        ).all()

        tokens = list({r.device_token for r in token_records if r.device_token} | {d.device_token for d in device_records if d.device_token})

        eff_channel = channel_id or DEFAULT_CHANNEL_ID
        notif_id = f"notif_{uuid.uuid4().hex[:12]}"

        # 3. Persist in database if requested
        if save_record:
            try:
                rec = NotificationRecord(
                    notification_id=notif_id,
                    event_id=notif_id,
                    event_type=data.get("type", "PUSH_ALERT") if data else "PUSH_ALERT",
                    category=category,
                    recipient_user_id=str(user_id),
                    title=title,
                    body=body,
                    route=route,
                    priority=priority,
                    is_read=False,
                    delivery_status="SENT" if tokens else "NO_DEVICES",
                    metadata_json=json.dumps(data) if data else None,
                    created_at=datetime.datetime.now(datetime.timezone.utc)
                )
                db.add(rec)
                db.commit()
            except Exception as db_err:
                db.rollback()
                logger.warning(f"[FCM Push] Could not save NotificationRecord: {db_err}")

        if not tokens:
            return {"success": True, "dispatched": 0, "status": "no_active_devices", "notification_id": notif_id}

        # 4. Multicast dispatch
        result = cls.send_multicast(
            tokens=tokens,
            title=title,
            body=body,
            data=data,
            channel_id=eff_channel,
            route=route,
            priority=priority,
            notification_id=notif_id
        )

        # 5. Clean up invalid / unregistered tokens from DB
        invalid = result.get("invalid_tokens", [])
        if invalid:
            cls._deactivate_stale_tokens(db, invalid)

        return {
            "success": True,
            "dispatched": result.get("success_count", 0),
            "failed": result.get("failure_count", 0),
            "notification_id": notif_id
        }

    @classmethod
    def send_to_users(
        cls,
        db: Session,
        user_ids: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        category: str = "announcements",
        channel_id: Optional[str] = None,
        route: str = "/dashboard",
        priority: str = "high"
    ) -> Dict[str, Any]:
        """Dispatches push notifications to a list of users."""
        clean_users = list({str(u).strip() for u in user_ids if u and str(u).strip()})
        if not clean_users:
            return {"success": True, "dispatched": 0, "failed": 0}

        total_dispatched = 0
        total_failed = 0

        for uid in clean_users:
            res = cls.send_to_user(
                db=db,
                user_id=uid,
                title=title,
                body=body,
                data=data,
                category=category,
                channel_id=channel_id,
                route=route,
                priority=priority,
                save_record=True
            )
            total_dispatched += res.get("dispatched", 0)
            total_failed += res.get("failed", 0)

        return {
            "success": True,
            "dispatched": total_dispatched,
            "failed": total_failed,
            "users_count": len(clean_users)
        }

    @classmethod
    def send_broadcast(
        cls,
        db: Session,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        category: str = "announcements",
        route: str = "/dashboard",
        priority: str = "high"
    ) -> Dict[str, Any]:
        """Broadcasts push notification to all active devices registered in the system."""
        tokens_t = db.query(FCMDeviceToken.device_token).filter(FCMDeviceToken.is_active.is_(True)).all()
        tokens_d = db.query(FCMDevice.device_token).filter(FCMDevice.is_active.is_(True)).all()

        all_tokens = list({t[0] for t in tokens_t if t[0]} | {d[0] for d in tokens_d if d[0]})

        if not all_tokens:
            return {"success": True, "dispatched": 0, "status": "no_registered_tokens"}

        result = cls.send_multicast(
            tokens=all_tokens,
            title=title,
            body=body,
            data=data,
            channel_id=DEFAULT_CHANNEL_ID,
            route=route,
            priority=priority
        )

        invalid = result.get("invalid_tokens", [])
        if invalid:
            cls._deactivate_stale_tokens(db, invalid)

        return result

    # =========================================================================
    # TOKEN REGISTRATION & MANAGEMENT
    # =========================================================================

    @classmethod
    def register_device_token(
        cls,
        db: Session,
        user_id: str,
        device_token: str,
        platform: str = "android",
        app_version: Optional[str] = None,
        device_model: Optional[str] = None
    ) -> Dict[str, Any]:
        """Registers or refreshes an FCM device token in the database."""
        if not device_token or not device_token.strip():
            return {"success": False, "error": "Invalid token"}

        token_str = device_token.strip()
        now = datetime.datetime.now(datetime.timezone.utc)

        try:
            # 1. Update/create in FCMDeviceToken
            row = db.query(FCMDeviceToken).filter(FCMDeviceToken.device_token == token_str).first()
            if row:
                row.user_id = user_id
                row.platform = platform
                row.app_version = app_version
                row.device_model = device_model
                row.is_active = True
                row.last_seen = now
            else:
                new_token = FCMDeviceToken(
                    user_id=user_id,
                    device_token=token_str,
                    platform=platform,
                    app_version=app_version,
                    device_model=device_model,
                    is_active=True,
                    last_seen=now,
                    created_at=now
                )
                db.add(new_token)

            # 2. Sync to FCMDevice table as well for backwards compatibility
            dev = db.query(FCMDevice).filter(
                FCMDevice.user_id == user_id,
                FCMDevice.device_token == token_str
            ).first()
            if dev:
                dev.is_active = True
                dev.platform = platform
                dev.app_version = app_version
                dev.device_model = device_model
                dev.last_seen = now
            else:
                new_dev = FCMDevice(
                    user_id=user_id,
                    device_token=token_str,
                    platform=platform,
                    app_version=app_version,
                    device_model=device_model,
                    is_active=True,
                    last_seen=now,
                    created_at=now
                )
                db.add(new_dev)

            db.commit()
            return {"success": True, "message": "Device token registered successfully."}
        except Exception as e:
            db.rollback()
            logger.error(f"[FCM Push] Error registering token: {e}")
            return {"success": False, "error": str(e)}

    @classmethod
    def unregister_device_token(
        cls,
        db: Session,
        device_token: str,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Deactivates an FCM device token."""
        if not device_token:
            return {"success": False, "error": "Token required"}

        token_str = device_token.strip()
        try:
            q_token = db.query(FCMDeviceToken).filter(FCMDeviceToken.device_token == token_str)
            if user_id:
                q_token = q_token.filter(FCMDeviceToken.user_id == user_id)
            q_token.update({"is_active": False}, synchronize_session=False)

            q_dev = db.query(FCMDevice).filter(FCMDevice.device_token == token_str)
            if user_id:
                q_dev = q_dev.filter(FCMDevice.user_id == user_id)
            q_dev.update({"is_active": False}, synchronize_session=False)

            db.commit()
            return {"success": True, "message": "Device token unregistered."}
        except Exception as e:
            db.rollback()
            logger.error(f"[FCM Push] Error unregistering token: {e}")
            return {"success": False, "error": str(e)}

    @classmethod
    def _deactivate_stale_tokens(cls, db: Session, tokens: List[str]):
        """Sets is_active=False on invalid or expired FCM tokens."""
        if not tokens:
            return
        try:
            db.query(FCMDeviceToken).filter(FCMDeviceToken.device_token.in_(tokens)).update(
                {"is_active": False}, synchronize_session=False
            )
            db.query(FCMDevice).filter(FCMDevice.device_token.in_(tokens)).update(
                {"is_active": False}, synchronize_session=False
            )
            db.commit()
            logger.info(f"[FCM Push] Deactivated {len(tokens)} stale FCM tokens.")
        except Exception as err:
            db.rollback()
            logger.warning(f"[FCM Push] Error deactivating stale tokens: {err}")

    # =========================================================================
    # LEETCODE DOMAIN-SPECIFIC CONVENIENCE METHODS
    # =========================================================================

    @classmethod
    def send_contest_alert(
        cls,
        db: Session,
        title: str,
        body: str,
        contest_name: str,
        contest_url: str = "/weekly-contests",
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Convenience method for Weekly/Biweekly contest notifications."""
        data = {
            "type": "CONTEST_ALERT",
            "category": "contests",
            "contest_name": contest_name,
            "actionRoute": contest_url
        }
        if user_id:
            return cls.send_to_user(
                db=db,
                user_id=user_id,
                title=title,
                body=body,
                data=data,
                category="contests",
                channel_id="contest_updates",
                route=contest_url,
                priority="high"
            )
        else:
            return cls.send_broadcast(
                db=db,
                title=title,
                body=body,
                data=data,
                category="contests",
                route=contest_url,
                priority="high"
            )

    @classmethod
    def send_streak_alert(
        cls,
        db: Session,
        user_id: str,
        student_name: str,
        current_streak: int
    ) -> Dict[str, Any]:
        """Alerts student if daily streak is at risk."""
        title = "🔥 Daily Streak Alert!"
        body = f"Hi {student_name}, keep your {current_streak}-day LeetCode streak alive! Solve today's daily challenge before midnight."
        return cls.send_to_user(
            db=db,
            user_id=user_id,
            title=title,
            body=body,
            data={"type": "STREAK_ALERT", "category": "announcements", "actionRoute": "/dashboard"},
            category="announcements",
            channel_id="performance_updates",
            route="/dashboard",
            priority="high"
        )


# Global singleton instance for easy import
push_notification_service = PushNotificationService()
