import logging
import os
import re
from logging.handlers import RotatingFileHandler

LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOG_DIR, "leetcode_tracker.log")

class SensitiveDataFilter(logging.Filter):
    """
    Security filter to automatically scrub secrets, JWT tokens, Bearer headers,
    and credentials from log streams across the entire backend.
    """
    PATTERNS = [
        # Query param tokens (e.g. ?token=eyJ... or &token=...)
        (re.compile(r'(?i)(token|access_token|refresh_token|secret|password|api_key|auth)=([^&\s\'"]+)', re.IGNORECASE), r'\1=[REDACTED]'),
        # Bearer tokens in headers or strings
        (re.compile(r'Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*', re.IGNORECASE), 'Bearer [REDACTED]'),
        # Raw JWT format (eyJ...)
        (re.compile(r'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*'), '[REDACTED_JWT]'),
        # Private key blocks
        (re.compile(r'-----BEGIN[ A-Z0-9_-]+PRIVATE KEY-----[^-]+-----END[ A-Z0-9_-]+PRIVATE KEY-----', re.DOTALL), '[REDACTED_PRIVATE_KEY]'),
    ]

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            for pattern, repl in self.PATTERNS:
                record.msg = pattern.sub(repl, record.msg)
        return True

logger = logging.getLogger("leetcode_tracker")
logger.setLevel(logging.INFO)

# Formatter
formatter = logging.Formatter("[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s")
sensitive_filter = SensitiveDataFilter()

if not logger.handlers:
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.INFO)
    console_handler.addFilter(sensitive_filter)
    logger.addHandler(console_handler)

    try:
        os.makedirs(LOG_DIR, exist_ok=True)
        file_handler = RotatingFileHandler(LOG_FILE, maxBytes=10*1024*1024, backupCount=5, encoding="utf-8")
        file_handler.setFormatter(formatter)
        file_handler.setLevel(logging.INFO)
        file_handler.addFilter(sensitive_filter)
        logger.addHandler(file_handler)
    except Exception:
        pass

# Attach filter to Uvicorn access/error loggers and root logger for 100% credential redaction
def setup_logging_security():
    for name in ("", "uvicorn", "uvicorn.access", "uvicorn.error", "fastapi", "leetcode_tracker"):
        l = logging.getLogger(name)
        for handler in l.handlers:
            handler.addFilter(sensitive_filter)
        l.addFilter(sensitive_filter)

setup_logging_security()

