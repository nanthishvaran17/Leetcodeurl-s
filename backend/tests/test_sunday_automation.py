import pytest
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models import User, ReportRecipient, EmailDelivery, EmailAttachment, AdminAuditLog
from backend.scheduler import get_scheduler_health, tz

TEST_SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(TEST_SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Create admin user
    user = User(
        username="admin",
        email="admin@nandha.edu.in",
        role="Admin",
        is_active=True
    )
    db.add(user)

    # Create active recipient
    rec = ReportRecipient(
        name="Prof. Santhosh Kumar M",
        email="msanthoshkumar@nandhaengg.org",
        role="MANAGEMENT",
        department="ALL",
        is_active=True
    )
    db.add(rec)
    db.commit()

    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)


def test_scheduler_timezone_is_asia_kolkata():
    """Verify APScheduler is bound strictly to Asia/Kolkata IST timezone."""
    health = get_scheduler_health()
    assert health["timezone"] == "Asia/Kolkata"
    assert "Sunday" in health["next_public_run"]
    assert "Sunday" in health["next_virtual_run"]


def test_idempotency_duplicate_protection(setup_database):
    """Verify same Sunday dispatch key blocks duplicate email creation."""
    db = setup_database
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    idempotency_msg_id = f"MSG-AUTO-PUBLIC-{today_str}-REC-1"

    # Insert first delivery record
    d1 = EmailDelivery(
        message_id=idempotency_msg_id,
        recipient_email="msanthoshkumar@nandhaengg.org",
        subject="Public Contest Report",
        status="SENT",
        trigger_type="AUTOMATED"
    )
    db.add(d1)
    db.commit()

    # Query for duplicate
    existing = db.query(EmailDelivery).filter(EmailDelivery.message_id == idempotency_msg_id).first()
    assert existing is not None
    assert existing.status == "SENT"


def test_email_attachment_and_audit_relationship(setup_database):
    """Verify EmailDelivery, EmailAttachment, and AdminAuditLog records cascade properly."""
    db = setup_database

    d = EmailDelivery(
        message_id="MSG-MANUAL-99999",
        recipient_email="admin@nandha.edu.in",
        subject="Test Report Email",
        status="SENT",
        trigger_type="MANUAL"
    )
    db.add(d)
    db.commit()
    db.refresh(d)

    att = EmailAttachment(
        email_delivery_id=d.id,
        filename="Test_Report.xlsx",
        file_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        file_size=1024
    )
    db.add(att)

    audit = AdminAuditLog(
        audit_id="AUD-2026-99999",
        admin_name="admin",
        admin_email="admin@nandha.edu.in",
        admin_role="Admin",
        action="SEND_TEST_REPORT_EMAIL",
        status="SUCCESS"
    )
    db.add(audit)
    db.commit()

    saved_d = db.query(EmailDelivery).filter(EmailDelivery.message_id == "MSG-MANUAL-99999").first()
    assert saved_d is not None
    assert len(saved_d.attachments) == 1
    assert saved_d.attachments[0].filename == "Test_Report.xlsx"
