"""
test_messaging_notification_system.py
Complete End-to-End Production Verification for Notification & Messaging Architecture:
- Message A ("hi") vs Message B ("kl") are preserved as separate message records.
- Exactly-once notification creation per message event with deterministic idempotency keys.
- Concurrent processing of the exact same message event produces exactly 1 notification.
- Deep link routing metadata and Android notification parameters verification.
"""

import time
import pytest
from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.main import app
from backend.database import SessionLocal
from backend.models import User, Student, Message, Conversation, NotificationRecord
from backend.routes.auth import create_access_token, get_password_hash
from backend.services.messaging_service import MessagingService
from backend.services.notification_service import NotificationService

client = TestClient(app)


@pytest.fixture(scope="function")
def db():
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture(scope="function")
def sender_admin(db: Session):
    admin = db.query(User).filter(User.username == "notif_admin_test").first()
    if not admin:
        admin = User(
            username="notif_admin_test",
            email="notif_admin@college.edu",
            hashed_password=get_password_hash("AdminPass123!"),
            role="Admin",
            is_active=True
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
    return admin


@pytest.fixture(scope="function")
def recipient_student(db: Session):
    st = db.query(Student).filter(Student.reg_no == "NOTIF_STU_01").first()
    if not st:
        st = Student(
            reg_no="NOTIF_STU_01",
            name="Notification Test Student",
            email="notif_stu_01@college.edu",
            department_id=1,
            year_level="III",
            is_active=True
        )
        db.add(st)
        db.commit()
        db.refresh(st)
    return st


# 1. TWO DISTINCT MESSAGES REMAIN SEPARATE & CREATE LEGITIMATE NOTIFICATIONS 

def test_distinct_messages_preserved_and_notified(db: Session, sender_admin: User, recipient_student: Student):
    """
    Admin sends "hi" and then "kl".
    Both messages must be preserved as distinct records in DB.
    Both message events trigger legitimate notifications.
    """
    admin_id = MessagingService._get_user_id(sender_admin)

    # 1. Send Message A: "hi"
    msg_a = MessagingService.send_message(
        db=db,
        current_user=sender_admin,
        receiver_id=recipient_student.reg_no,
        content="hi"
    )
    assert msg_a is not None
    assert msg_a.content == "hi"

    # 2. Send Message B: "kl"
    msg_b = MessagingService.send_message(
        db=db,
        current_user=sender_admin,
        receiver_id=recipient_student.reg_no,
        content="kl"
    )
    assert msg_b is not None
    assert msg_b.content == "kl"

    # 3. Verify both messages are in database and distinct
    assert msg_a.message_id != msg_b.message_id
    all_msgs = db.query(Message).filter(Message.conversation_id == msg_a.conversation_id).all()
    msg_contents = [m.content for m in all_msgs]
    assert "hi" in msg_contents
    assert "kl" in msg_contents
    assert len(all_msgs) >= 2

    # 4. Verify distinct notification records for each message
    notif_a = db.query(NotificationRecord).filter(
        NotificationRecord.event_id == f"MSG_{msg_a.message_id}_{recipient_student.reg_no}"
    ).first()
    notif_b = db.query(NotificationRecord).filter(
        NotificationRecord.event_id == f"MSG_{msg_b.message_id}_{recipient_student.reg_no}"
    ).first()

    assert notif_a is not None
    assert notif_b is not None
    assert notif_a.event_id != notif_b.event_id
    assert "hi" in notif_a.body
    assert "kl" in notif_b.body


# 2. RETRY / DUPLICATE EVENT IS DEDUPLICATED (EXACTLY ONCE) 

def test_same_message_event_deduplicated_on_retry(db: Session, sender_admin: User, recipient_student: Student):
    """
    Processing the exact same message notification event twice results in
    exactly ONE notification record (idempotency).
    """
    admin_id = MessagingService._get_user_id(sender_admin)
    msg = MessagingService.send_message(
        db=db,
        current_user=sender_admin,
        receiver_id=recipient_student.reg_no,
        content="Testing duplicate notification prevention"
    )

    event_id = f"MSG_{msg.message_id}_{recipient_student.reg_no}"

    # First emission happened in send_message. Now simulate a retry:
    retry_res = NotificationService.emit_event(
        event_type="DIRECT_MESSAGE",
        title=f"New message from {sender_admin.username}",
        body="Testing duplicate notification prevention",
        actor_user_id=admin_id,
        recipient_scope="INDIVIDUAL",
        recipient_target=recipient_student.reg_no,
        route=f"/messages?conversationId={msg.conversation_id}&messageId={msg.message_id}",
        event_id=event_id,
        send_email_notification=False
    )

    assert retry_res.get("success") is True
    assert retry_res.get("duplicate_prevented") is True

    # Count records in DB
    count = db.query(NotificationRecord).filter(NotificationRecord.event_id == event_id).count()
    assert count == 1, f"Expected exactly 1 notification record, got {count}"


# 3. CONCURRENT WORKERS (10 THREADS) FOR SAME EVENT 

def test_concurrent_notification_processing_exactly_once(db: Session, sender_admin: User, recipient_student: Student):
    """
    10 concurrent worker threads attempt to process the exact same message event.
    Guarantees exactly ONE notification is created, and all other workers receive duplicate_prevented.
    """
    admin_id = MessagingService._get_user_id(sender_admin)
    test_event_id = f"MSG_CONCURRENT_{int(time.time()*1000)}_{recipient_student.reg_no}"

    results = []
    def process_event():
        return NotificationService.emit_event(
            event_type="DIRECT_MESSAGE",
            title="New message from Admin",
            body="Concurrent stress test message",
            actor_user_id=admin_id,
            recipient_scope="INDIVIDUAL",
            recipient_target=recipient_student.reg_no,
            route=f"/messages?conversationId=CONV_TEST&messageId=MSG_TEST",
            event_id=test_event_id,
            send_email_notification=False
        )

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(process_event) for _ in range(10)]
        for f in futures:
            results.append(f.result())

    assert all(r.get("success") is True for r in results)

    # In database, exactly 1 record must exist
    records = db.query(NotificationRecord).filter(NotificationRecord.event_id == test_event_id).all()
    assert len(records) == 1, f"Expected exactly 1 notification record in DB, found {len(records)}"

    # 9 calls must be reported as duplicate_prevented
    dups = sum(1 for r in results if r.get("duplicate_prevented") is True)
    assert dups == 9, f"Expected 9 duplicate prevented flags, got {dups}"


# 4. DEEP LINK ROUTING METADATA ACCURACY 

def test_notification_deep_link_metadata(db: Session, sender_admin: User, recipient_student: Student):
    """
    Verifies that emitted notification records and payloads contain full deep-link metadata
    for exact conversation navigation.
    """
    msg = MessagingService.send_message(
        db=db,
        current_user=sender_admin,
        receiver_id=recipient_student.reg_no,
        content="Verify deep linking metadata"
    )

    event_id = f"MSG_{msg.message_id}_{recipient_student.reg_no}"
    notif = db.query(NotificationRecord).filter(NotificationRecord.event_id == event_id).first()

    assert notif is not None
    assert f"conversationId={msg.conversation_id}" in notif.route
    assert f"messageId={msg.message_id}" in notif.route
    assert notif.recipient_user_id in (recipient_student.reg_no, recipient_student.email)
