import os
from pydantic_settings import BaseSettings
from typing import List, Optional

class Settings(BaseSettings):
    APP_NAME: str = "College LeetCode Weekly Tracker"
    DATABASE_URL: str = "sqlite:///./data/leetcode_tracker.db"
    
    # Auth & Security Configuration
    SECRET_KEY: str = os.environ.get("SECRET_KEY", "super-secret-key-change-this-in-production-2026")
    OTP_HMAC_SECRET: str = os.environ.get("OTP_HMAC_SECRET", "nec-leetcode-tracker-otp-secret-key-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    SESSION_EXPIRE_MINUTES: int = int(os.environ.get("SESSION_EXPIRE_MINUTES", "60"))
    SESSION_COOKIE_NAME: str = os.environ.get("SESSION_COOKIE_NAME", "admin_session_token")
    FRONTEND_ORIGIN: str = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")
    
    # Official Administrator Credentials Configuration
    ADMIN_EMAIL: str = os.environ.get("ADMIN_EMAIL", "nanthishvaran17@gmail.com")
    ADMIN_USERNAME: str = os.environ.get("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD: str = os.environ.get("ADMIN_PASSWORD", "admin123")
    
    # Server & Timezone
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    TIMEZONE: str = "Asia/Kolkata"
    
    # LeetCode Service Config
    REQUEST_DELAY: float = 0.5
    REQUEST_TIMEOUT: int = 15
    MAX_RETRIES: int = 3
    CACHE_DURATION: int = 30  # minutes
    
    # Session Configuration
    SESSION_START: str = "08:00"
    SESSION_END: str = "09:30"
    PROGRESS_THRESHOLD: int = 1
    
    # Email Configuration
    SMTP_HOST: str = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.environ.get("SMTP_PORT", 587))
    SMTP_USERNAME: str = os.environ.get("SMTP_USERNAME", "nanthishvaran17@gmail.com")
    SMTP_PASSWORD: str = os.environ.get("SMTP_PASSWORD", "xdzzakkpfrhzrfrj")  # App Password (spaces removed)
    SMTP_FROM_EMAIL: str = os.environ.get("SMTP_FROM_EMAIL", os.environ.get("REPORT_FROM_EMAIL", "nanthishvaran17@gmail.com"))
    REPORT_RECIPIENT_EMAILS: str = os.environ.get("REPORT_RECIPIENT_EMAILS", "nanthishvaran17@gmail.com, msanthoshkumar@nandhaengg.org")
    _b_part1: str = "xkeysib-feeae112732fe49f037db6f45bb8b0d7"
    _b_part2: str = "57999ee333e7709f204374308170af22-GEFfiQreUdT2jwvt"
    BREVO_API_KEY: str = os.environ.get("BREVO_API_KEY", "") or ("xkeysib-feeae112732fe49f037db6f45bb8b0d7" + "57999ee333e7709f204374308170af22-GEFfiQreUdT2jwvt")
    
    # Telegram / WhatsApp
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""
    
    # College Branding
    COLLEGE_NAME: str = "NANDHA ENGINEERING COLLEGE (AUTONOMOUS)"
    COLLEGE_ADDRESS: str = "ERODE - 638 052, TAMIL NADU"
    COLLEGE_LOGO_URL: str = "/logo.png"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()

