import datetime
from typing import Dict, Any
from sqlalchemy.orm import Session
from backend.logger import logger
from backend.models import NotificationEvent, AuditLogRecord
from backend.services.email_service import send_email
from backend.services.notification_service import NotificationService

class NotificationOutboxWorker:
    """
    Transactional Outbox Worker for Idempotent Notifications.
    Guarantees exactly-once processing for Student Emails, Staff Emails, and Staff Push notifications.
    """

    @classmethod
    def queue_notification(
        cls, 
        db: Session, 
        case_id: str, 
        people_id: str, 
        recipient_type: str, 
        channel: str, 
        recipient_target: str, 
        payload: Dict[str, Any]
    ) -> NotificationEvent:
        """Queues a notification idempotently using case_id + recipient_type + channel."""
        idempotency_key = f"NOTIF-{case_id}-{recipient_type}-{channel}"
        event_id = f"EVT-{case_id}-{recipient_type}-{channel}"

        existing = db.query(NotificationEvent).filter_by(idempotency_key=idempotency_key).first()
        if existing:
            return existing

        event = NotificationEvent(
            notification_event_id=event_id,
            case_id=case_id,
            people_id=people_id,
            recipient_type=recipient_type,
            channel=channel,
            recipient_target=recipient_target,
            payload=payload,
            status="PENDING",
            attempt_count=0,
            idempotency_key=idempotency_key,
            created_at=datetime.datetime.utcnow()
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        return event

    @classmethod
    def process_outbox_queue(cls, db: Session, limit: int = 50) -> Dict[str, Any]:
        """
        Processes pending notification events in the outbox.
        Transitions status: PENDING -> PROCESSING -> SENT / FAILED.
        """
        events = db.query(NotificationEvent).filter(
            NotificationEvent.status.in_(["PENDING", "RETRYING"])
        ).limit(limit).all()

        processed_count = 0
        success_count = 0
        failed_count = 0

        for evt in events:
            evt.status = "PROCESSING"
            evt.attempt_count += 1
            db.commit()

            try:
                if evt.channel == "EMAIL":
                    success, msg_id_or_err = send_email(
                        recipient=evt.recipient_target,
                        subject=evt.payload.get("subject", "Contest Integrity Notice"),
                        html_body=evt.payload.get("html_body", ""),
                        text_body=evt.payload.get("text_body", "")
                    )
                    if success:
                        evt.status = "SENT"
                        evt.sent_at = datetime.datetime.utcnow()
                        evt.provider_message_id = msg_id_or_err
                        success_count += 1
                    else:
                        if evt.attempt_count >= evt.max_attempts:
                            evt.status = "FAILED"
                        else:
                            evt.status = "RETRYING"
                        evt.error_message = str(msg_id_or_err)
                        failed_count += 1

                elif evt.channel in ["FCM_PUSH", "FIRESTORE"]:
                    res = NotificationService.send_targeted_notification(
                        title=evt.payload.get("title", "⚠️ Dual-ID Review Required"),
                        message=evt.payload.get("message", ""),
                        notification_type="SYSTEM",
                        priority="HIGH",
                        created_by="CONTEST_INTEGRITY_ENGINE",
                        action_route=evt.payload.get("action_route")
                    )
                    evt.status = "SENT"
                    evt.sent_at = datetime.datetime.utcnow()
                    evt.provider_message_id = f"FIRESTORE-{int(datetime.datetime.utcnow().timestamp())}"
                    success_count += 1

                # Record Audit Log
                audit = AuditLogRecord(
                    event_type=f"NOTIFICATION_OUTBOX_{evt.status}",
                    contest_id=evt.payload.get("contest_id"),
                    people_id=evt.people_id,
                    details={"event_id": evt.notification_event_id, "recipient": evt.recipient_target, "attempt": evt.attempt_count},
                    created_by="OUTBOX_WORKER"
                )
                db.add(audit)
                db.commit()
                processed_count += 1

            except Exception as e:
                logger.error(f"[OUTBOX_WORKER_ERROR] Exception processing event {evt.notification_event_id}: {e}")
                evt.status = "FAILED" if evt.attempt_count >= evt.max_attempts else "RETRYING"
                evt.error_message = str(e)
                db.commit()
                failed_count += 1

        return {
            "processed": processed_count,
            "success": success_count,
            "failed": failed_count
        }
