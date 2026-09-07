import os
import sys
import secrets
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

WEAK_SECRETS = {
    "super-secret-key-change-this-in-production-2026",
    "nec-leetcode-tracker-otp-secret-key-2026",
    "secret",
    "change-me",
    "default-secret",
    "changeme",
    "1234567890"
}

WEAK_PASSWORDS = {
    "admin",
    "admin123",
    "password",
    "123456",
    "12345678",
    "secret",
    "changeme",
    "test"
}

class Settings(BaseSettings):
    APP_NAME: str = "College LeetCode Weekly Tracker"
    # Auth & Security Configuration
    ENVIRONMENT: str = os.environ.get("ENVIRONMENT", "local" if "pytest" in sys.modules or os.environ.get("PYTEST_CURRENT_TEST") else "production")
    
    DATABASE_URL: Optional[str] = os.environ.get("DATABASE_URL")

    PRODUCTION_DOMAIN: str = os.environ.get("PRODUCTION_DOMAIN", "api.nandhaengg.org")
    SECRET_KEY: str = os.environ.get("SECRET_KEY", "")
    OTP_HMAC_SECRET: str = os.environ.get("OTP_HMAC_SECRET", "")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080 # 7 Days
    SESSION_EXPIRE_MINUTES: int = int(os.environ.get("SESSION_EXPIRE_MINUTES", "10080")) # 7 Days
    SESSION_COOKIE_NAME: str = os.environ.get("SESSION_COOKIE_NAME", "admin_session_token")
    FRONTEND_ORIGIN: str = os.environ.get("FRONTEND_ORIGIN", "https://leetcodeurl-s-roan.vercel.app")
    BACKEND_URL: str = os.environ.get("BACKEND_URL", "http://127.0.0.1:8000")
    CORS_ALLOWED_ORIGINS: str = os.environ.get("CORS_ALLOWED_ORIGINS", "")
    
    # Official Administrator Credentials Configuration
    ALLOW_DEFAULT_ADMIN_PASSWORD: bool = False
    ADMIN_EMAIL: str = os.environ.get("ADMIN_EMAIL", "nanthishvaran17@gmail.com")
    ADMIN_USERNAME: str = os.environ.get("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD: str = os.environ.get("ADMIN_PASSWORD", "")

    # Server & Timezone
    HOST: str = "0.0.0.0"
    PORT: int = int(os.environ.get("PORT", 8000))
    TIMEZONE: str = "Asia/Kolkata"
    
    # LeetCode Service Config
    REQUEST_DELAY: float = 0.5
    REQUEST_TIMEOUT: int = 15
    MAX_RETRIES: int = 3
    CACHE_DURATION: int = 30  # minutes
    SYNC_FRESHNESS_HOURS: float = float(os.environ.get("SYNC_FRESHNESS_HOURS", "6.0"))
    CONCURRENCY_WORKERS: int = int(os.environ.get("CONCURRENCY_WORKERS", "8"))
    
    # Production LeetCode Hardening
    LEETCODE_MAX_CONCURRENCY: int = int(os.environ.get("LEETCODE_MAX_CONCURRENCY", "15"))
    LEETCODE_CONNECT_TIMEOUT: float = float(os.environ.get("LEETCODE_CONNECT_TIMEOUT", "10.0"))
    LEETCODE_READ_TIMEOUT: float = float(os.environ.get("LEETCODE_READ_TIMEOUT", "20.0"))
    LEETCODE_MAX_RETRIES: int = int(os.environ.get("LEETCODE_MAX_RETRIES", "3"))
    LEETCODE_CIRCUIT_FAILURE_THRESHOLD: int = int(os.environ.get("LEETCODE_CIRCUIT_FAILURE_THRESHOLD", "15"))
    LEETCODE_CIRCUIT_COOLDOWN: float = float(os.environ.get("LEETCODE_CIRCUIT_COOLDOWN", "60.0"))
    
    # Session Configuration
    SESSION_START: str = "08:00"
    SESSION_END: str = "09:30"
    PROGRESS_THRESHOLD: int = 1
    
    # Email Configuration
    SMTP_HOST: str = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.environ.get("SMTP_PORT", 587))
    SMTP_USERNAME: str = os.environ.get("SMTP_USERNAME", "nanthishvaran17@gmail.com")
    SMTP_PASSWORD: str = os.environ.get("SMTP_PASSWORD", "")
    BREVO_API_KEY: str = os.environ.get("BREVO_API_KEY", "").strip()
    BREVO_API_KEY_2: str = os.environ.get("BREVO_API_KEY_2", "").strip()
    BREVO_API_KEY_3: str = os.environ.get("BREVO_API_KEY_3", "").strip()
    BREVO_API_KEY_4: str = os.environ.get("BREVO_API_KEY_4", "").strip()
    BREVO_SENDER_EMAIL: str = os.environ.get("BREVO_SENDER_EMAIL", "nanthishvaran0106@gmail.com").strip()
    RESEND_API_KEY: str = os.environ.get("RESEND_API_KEY", "").strip()

    # Report recipients — comma-separated email list
    REPORT_RECIPIENT_EMAILS: str = os.environ.get("REPORT_RECIPIENT_EMAILS", "").strip()
    
    # Telegram / WhatsApp
    TELEGRAM_BOT_TOKEN: str = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    TELEGRAM_CHAT_ID: str = os.environ.get("TELEGRAM_CHAT_ID", "")
    
    # AI Engine
    GEMINI_API_KEY: str = os.environ.get("GEMINI_API_KEY", "")
    
    # College Branding
    COLLEGE_NAME: str = "NANDHA ENGINEERING COLLEGE (AUTONOMOUS)"
    COLLEGE_ADDRESS: str = "ERODE - 638 052, TAMIL NADU"
    COLLEGE_LOGO_URL: str = "/nec_25_logo.png"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        env_lower = (self.ENVIRONMENT or "").strip().lower()
        is_prod = env_lower == "production"

        if is_prod:
            # 1. Database URL Rule (PostgreSQL mandatory)
            db_url = (self.DATABASE_URL or "").strip().lower()
            if not db_url or "sqlite" in db_url:
                raise RuntimeError("FATAL: Production deployment requires a valid PostgreSQL DATABASE_URL (Supabase/Render). SQLite is not permitted in production.")
            if not (db_url.startswith("postgresql://") or db_url.startswith("postgres://")):
                raise RuntimeError("FATAL: Production DATABASE_URL must be a valid PostgreSQL connection string.")

            # 2. Secret Validation & Auto-Hardening
            if not self.SECRET_KEY or len(self.SECRET_KEY) < 32 or self.SECRET_KEY in WEAK_SECRETS:
                self.SECRET_KEY = secrets.token_urlsafe(48)

            if not self.OTP_HMAC_SECRET or len(self.OTP_HMAC_SECRET) < 32 or self.OTP_HMAC_SECRET in WEAK_SECRETS:
                self.OTP_HMAC_SECRET = secrets.token_urlsafe(48)

            if not self.ADMIN_PASSWORD or len(self.ADMIN_PASSWORD) < 12 or self.ADMIN_PASSWORD.lower() in WEAK_PASSWORDS:
                self.ADMIN_PASSWORD = secrets.token_urlsafe(16)

            if not self.ADMIN_EMAIL or "@" not in self.ADMIN_EMAIL:
                self.ADMIN_EMAIL = "nanthishvaran17@gmail.com"

            if not self.ADMIN_USERNAME:
                self.ADMIN_USERNAME = "admin"
        else:
            # Ephemeral Cryptographic Secrets in Development/Testing
            if not self.SECRET_KEY or self.SECRET_KEY in WEAK_SECRETS:
                self.SECRET_KEY = secrets.token_urlsafe(32)
            if not self.OTP_HMAC_SECRET or self.OTP_HMAC_SECRET in WEAK_SECRETS:
                self.OTP_HMAC_SECRET = secrets.token_urlsafe(32)
            if not self.ADMIN_PASSWORD or self.ADMIN_PASSWORD.lower() in WEAK_PASSWORDS:
                self.ADMIN_PASSWORD = secrets.token_urlsafe(16)
            if not self.DATABASE_URL:
                self.DATABASE_URL = "sqlite:///./data/leetcode_tracker.db"

        return self

settings = Settings()

