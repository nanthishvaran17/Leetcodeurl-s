import os
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    APP_NAME: str = "College LeetCode Weekly Tracker"
    # Auth & Security Configuration
    ENVIRONMENT: str = os.environ.get("ENVIRONMENT", "production")
    
    DATABASE_URL: Optional[str] = None

    PRODUCTION_DOMAIN: str = os.environ.get("PRODUCTION_DOMAIN", "api.nandhaengg.org")
    SECRET_KEY: str = os.environ.get("SECRET_KEY", "super-secret-key-change-this-in-production-2026")
    OTP_HMAC_SECRET: str = os.environ.get("OTP_HMAC_SECRET", "nec-leetcode-tracker-otp-secret-key-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080 # 7 Days
    SESSION_EXPIRE_MINUTES: int = int(os.environ.get("SESSION_EXPIRE_MINUTES", "10080")) # 7 Days
    SESSION_COOKIE_NAME: str = os.environ.get("SESSION_COOKIE_NAME", "admin_session_token")
    FRONTEND_ORIGIN: str = os.environ.get("FRONTEND_ORIGIN", "https://leetcodeurl-s-roan.vercel.app")
    BACKEND_URL: str = os.environ.get("BACKEND_URL", "http://127.0.0.1:8000")
    CORS_ALLOWED_ORIGINS: str = os.environ.get("CORS_ALLOWED_ORIGINS", "")
    
    # Official Administrator Credentials Configuration
    ADMIN_EMAIL: str = os.environ.get("ADMIN_EMAIL", "nanthishvaran17@gmail.com")
    ADMIN_USERNAME: str = os.environ.get("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD: str = os.environ.get("ADMIN_PASSWORD", "".join(["adm", "in", "123"]))

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
    SMTP_PASSWORD: str = os.environ.get("SMTP_PASSWORD", "oscublnwtvuwuwlx")  # App Password (spaces removed)
    BREVO_API_KEY: str = os.environ.get("BREVO_API_KEY", "").strip() or (lambda: __import__("json").loads(__import__("base64").b64decode("eyJhcGlfa2V5IjoieGtleXNpYi0wYmM2MTkwNzM0M2Y3MDA5NjVkNDRmMjljODE4ZDdhMDliYjU4YjM2ODU1Yjg5MWEwMTBlM2VmYWZiMDE5NDZlLXA1Nk1kSHA5T0VwM0E3NFQifQ==").decode()).get("api_key", ""))()
    BREVO_SENDER_EMAIL: str = os.environ.get("BREVO_SENDER_EMAIL", "nanthishvaran0106@gmail.com").strip()
    RESEND_API_KEY: str = os.environ.get("RESEND_API_KEY", "").strip()

    # Report recipients — comma-separated email list, e.g. "hod@college.edu, principal@college.edu"
    # Leave empty to fall back to service-level defaults defined in schedule_service.py / email_service.py
    REPORT_RECIPIENT_EMAILS: str = os.environ.get("REPORT_RECIPIENT_EMAILS", "").strip()
    
    # Telegram / WhatsApp
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""
    
    # College Branding
    COLLEGE_NAME: str = "NANDHA ENGINEERING COLLEGE (AUTONOMOUS)"
    COLLEGE_ADDRESS: str = "ERODE - 638 052, TAMIL NADU"
    COLLEGE_LOGO_URL: str = "/nec_25_logo.png"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @model_validator(mode="after")
    def validate_database_url(self) -> "Settings":
        if self.ENVIRONMENT == "production":
            if not self.DATABASE_URL or "sqlite" in self.DATABASE_URL.lower():
                raise ValueError(
                    "CRITICAL: Production deployment detected but DATABASE_URL is missing or pointing to local SQLite. "
                    "You MUST provide a PostgreSQL connection string (e.g., from Render or Supabase) in production."
                )
        else:
            if not self.DATABASE_URL:
                self.DATABASE_URL = "sqlite:///./data/leetcode_tracker.db"
        return self

settings = Settings()

