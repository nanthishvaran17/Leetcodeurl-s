import os
from pydantic_settings import BaseSettings
from typing import List, Optional

class Settings(BaseSettings):
    APP_NAME: str = "College LeetCode Weekly Tracker"
    DATABASE_URL: str = "sqlite:///./data/leetcode_tracker.db"
    
    # Auth & Security
    SECRET_KEY: str = "super-secret-key-change-this-in-production-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
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
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    REPORT_RECIPIENT_EMAILS: str = ""
    
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
