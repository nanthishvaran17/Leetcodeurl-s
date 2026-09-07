import pytest
import os
import secrets
import jwt
from backend.config import Settings, WEAK_SECRETS, WEAK_PASSWORDS

def test_production_missing_database_url_fails():
    with pytest.raises(RuntimeError) as exc:
        Settings(
            ENVIRONMENT="production",
            DATABASE_URL="",
            SECRET_KEY=secrets.token_urlsafe(32),
            OTP_HMAC_SECRET=secrets.token_urlsafe(32),
            ADMIN_EMAIL="admin@college.edu",
            ADMIN_USERNAME="admin",
            ADMIN_PASSWORD=secrets.token_urlsafe(16)
        )
    assert "PostgreSQL" in str(exc.value)

def test_production_sqlite_database_url_fails():
    with pytest.raises(RuntimeError) as exc:
        Settings(
            ENVIRONMENT="production",
            DATABASE_URL="sqlite:///./data/leetcode_tracker.db",
            SECRET_KEY=secrets.token_urlsafe(32),
            OTP_HMAC_SECRET=secrets.token_urlsafe(32),
            ADMIN_EMAIL="admin@college.edu",
            ADMIN_USERNAME="admin",
            ADMIN_PASSWORD=secrets.token_urlsafe(16)
        )
    assert "SQLite is not permitted in production" in str(exc.value)

def test_production_weak_secret_key_auto_hardens():
    s = Settings(
        ENVIRONMENT="production",
        DATABASE_URL="postgresql://user:pass@localhost:5432/dbname",
        SECRET_KEY="short",
        OTP_HMAC_SECRET=secrets.token_urlsafe(32),
        ADMIN_EMAIL="admin@college.edu",
        ADMIN_USERNAME="admin",
        ADMIN_PASSWORD=secrets.token_urlsafe(16)
    )
    assert len(s.SECRET_KEY) >= 32
    assert s.SECRET_KEY != "short"

def test_production_weak_otp_hmac_secret_auto_hardens():
    s = Settings(
        ENVIRONMENT="production",
        DATABASE_URL="postgresql://user:pass@localhost:5432/dbname",
        SECRET_KEY=secrets.token_urlsafe(32),
        OTP_HMAC_SECRET="nec-leetcode-tracker-otp-secret-key-2026",
        ADMIN_EMAIL="admin@college.edu",
        ADMIN_USERNAME="admin",
        ADMIN_PASSWORD=secrets.token_urlsafe(16)
    )
    assert len(s.OTP_HMAC_SECRET) >= 32
    assert s.OTP_HMAC_SECRET != "nec-leetcode-tracker-otp-secret-key-2026"

def test_production_weak_admin_password_auto_hardens():
    s = Settings(
        ENVIRONMENT="production",
        DATABASE_URL="postgresql://user:pass@localhost:5432/dbname",
        SECRET_KEY=secrets.token_urlsafe(32),
        OTP_HMAC_SECRET=secrets.token_urlsafe(32),
        ADMIN_EMAIL="admin@college.edu",
        ADMIN_USERNAME="admin",
        ADMIN_PASSWORD="admin123"
    )
    assert len(s.ADMIN_PASSWORD) >= 12
    assert s.ADMIN_PASSWORD != "admin123"

def test_production_valid_postgresql_config_succeeds():
    sec_key = secrets.token_urlsafe(32)
    otp_key = secrets.token_urlsafe(32)
    pwd = secrets.token_urlsafe(16)
    s = Settings(
        ENVIRONMENT="production",
        DATABASE_URL="postgresql://supabase_user:securepass@db.supabase.co:5432/postgres",
        SECRET_KEY=sec_key,
        OTP_HMAC_SECRET=otp_key,
        ADMIN_EMAIL="nanthishvaran17@gmail.com",
        ADMIN_USERNAME="admin",
        ADMIN_PASSWORD=pwd
    )
    assert s.ENVIRONMENT == "production"
    assert s.SECRET_KEY == sec_key

def test_development_ephemeral_secrets_generated():
    s = Settings(
        ENVIRONMENT="local",
        DATABASE_URL="",
        SECRET_KEY="",
        OTP_HMAC_SECRET="",
        ADMIN_PASSWORD=""
    )
    assert len(s.SECRET_KEY) >= 32
    assert len(s.OTP_HMAC_SECRET) >= 32
    assert len(s.ADMIN_PASSWORD) >= 12
    assert s.DATABASE_URL == "sqlite:///./data/leetcode_tracker.db"

def test_jwt_none_alg_rejected():
    fake_payload = {"sub": "attacker", "role": "SuperAdmin", "exp": 9999999999}
    # Unsigned token with alg: none
    none_token = jwt.encode(fake_payload, key="", algorithm="none")
    with pytest.raises(jwt.InvalidTokenError):
        jwt.decode(none_token, "real_secret_key", algorithms=["HS256"])
