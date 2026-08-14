import secrets
import hashlib
import hmac
import datetime
import uuid
from typing import Optional, Tuple
from sqlalchemy.orm import Session

from backend.config import settings
from backend.models import EmailOTPRecord

OTP_EXPIRE_MINUTES = 5
MAX_ATTEMPTS_PER_OTP = 5
MAX_SEND_REQUESTS_5MIN = 3
RESEND_COOLDOWN_SECONDS = 60


def generate_secure_otp() -> str:
    """Generates a 6-digit numeric OTP using Python's secrets module."""
    number = secrets.randbelow(900000) + 100000
    return str(number)


def hash_email(email: str) -> str:
    """Returns SHA-256 digest of normalized email address."""
    clean_email = email.lower().strip()
    return hashlib.sha256(clean_email.encode('utf-8')).hexdigest()


def hash_otp(email: str, otp: str, request_id: str = "") -> str:
    """Returns HMAC-SHA256 digest of OTP bound to normalized email, request_id and server secret."""
    clean_email = email.lower().strip()
    secret = settings.SECRET_KEY.encode('utf-8')
    payload = f"{clean_email}:{otp}:{request_id}".encode('utf-8')
    return hmac.new(secret, payload, hashlib.sha256).hexdigest()


def create_otp_transaction(
    db: Session,
    email: str,
    ip_address: Optional[str] = None
) -> Tuple[str, EmailOTPRecord]:
    """
    Creates a new persistent OTP record with rate limiting & resend cooldown checks.
    Returns (plaintext_otp, otp_record).
    """
    clean_email = email.lower().strip()
    e_hash = hash_email(clean_email)
    now = datetime.datetime.utcnow()

    # Rate limiting: Max 3 send requests per 5 minutes per email/IP
    five_mins_ago = now - datetime.timedelta(minutes=5)
    recent_count = db.query(EmailOTPRecord).filter(
        EmailOTPRecord.email_hash == e_hash,
        EmailOTPRecord.created_at >= five_mins_ago
    ).count()

    if recent_count >= MAX_SEND_REQUESTS_5MIN:
        raise ValueError("Too many OTP requests. Please wait 5 minutes before trying again.")

    # Resend Cooldown: Check if last active OTP was sent < 60s ago
    one_min_ago = now - datetime.timedelta(seconds=RESEND_COOLDOWN_SECONDS)
    last_record = db.query(EmailOTPRecord).filter(
        EmailOTPRecord.email_hash == e_hash
    ).order_by(EmailOTPRecord.id.desc()).first()

    if last_record and last_record.created_at >= one_min_ago and not last_record.used:
        cooldown_remaining = int((last_record.created_at + datetime.timedelta(seconds=RESEND_COOLDOWN_SECONDS) - now).total_seconds())
        raise ValueError(f"Please wait {max(1, cooldown_remaining)} seconds before requesting a new verification code.")

    # Invalidate older active OTP records for this email
    db.query(EmailOTPRecord).filter(
        EmailOTPRecord.email_hash == e_hash,
        EmailOTPRecord.used == False
    ).update({"used": True}, synchronize_session=False)

    # Generate new OTP & Request ID
    plain_otp = generate_secure_otp()
    req_id = f"req_{uuid.uuid4().hex[:16]}"
    o_hash = hash_otp(clean_email, plain_otp, req_id)
    expires = now + datetime.timedelta(minutes=OTP_EXPIRE_MINUTES)

    otp_record = EmailOTPRecord(
        email=clean_email,
        email_hash=e_hash,
        otp_hash=o_hash,
        request_id=req_id,
        attempt_count=0,
        used=False,
        created_at=now,
        expires_at=expires,
        ip_address=ip_address
    )

    db.add(otp_record)
    db.commit()
    db.refresh(otp_record)

    return plain_otp, otp_record


def verify_otp_transaction(
    db: Session,
    email: str,
    raw_otp: str,
    request_id: Optional[str] = None
) -> Tuple[bool, str, Optional[EmailOTPRecord]]:
    """
    Verifies a user-supplied OTP against persistent hashed record.
    Returns (is_valid, message, otp_record).
    """
    clean_email = email.lower().strip()
    clean_otp = raw_otp.strip()
    e_hash = hash_email(clean_email)
    now = datetime.datetime.utcnow()

    # Load latest non-used OTP record for this email
    query = db.query(EmailOTPRecord).filter(
        EmailOTPRecord.email_hash == e_hash,
        EmailOTPRecord.used == False
    )

    if request_id:
        query = query.filter(EmailOTPRecord.request_id == request_id)

    record = query.order_by(EmailOTPRecord.id.desc()).first()

    if not record:
        return False, "No active verification code found for this email. Please request a new code.", None

    # Check Expiration
    if record.expires_at < now:
        record.used = True
        db.commit()
        return False, "This verification code has expired. Please request a new code.", record

    # Check Attempt Count
    if record.attempt_count >= MAX_ATTEMPTS_PER_OTP:
        record.used = True
        db.commit()
        return False, "Too many failed verification attempts. Please request a new verification code.", record

    # Verify Hash with HMAC-SHA256
    expected_hash = hash_otp(clean_email, clean_otp, record.request_id)
    if not secrets.compare_digest(record.otp_hash, expected_hash):
        record.attempt_count += 1
        if record.attempt_count >= MAX_ATTEMPTS_PER_OTP:
            record.used = True
        db.commit()
        return False, "Invalid verification code. Please try again.", record

    # Mark OTP as used immediately (single-use)
    record.used = True
    record.used_at = now
    db.commit()

    return True, "OTP verified successfully", record
