"""
config.py — Environment & config validation.
Loads .env, validates all required keys, exposes typed settings.
"""
import os
import sys
import yaml
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")


# ─── Required env vars ────────────────────────────────────────────────────────
REQUIRED_ENV = [
    "LEETCODE_USERNAME",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASSWORD",
]


def validate_config() -> None:
    """Call this at startup. Exits with a clear message if anything is missing."""
    missing = [k for k in REQUIRED_ENV if not os.getenv(k)]
    if missing:
        print(f"[CONFIG ERROR] Missing required environment variables: {', '.join(missing)}")
        print(f"Copy .env.example → .env and fill in the values.")
        sys.exit(1)


# ─── Accessors ────────────────────────────────────────────────────────────────
def get(key: str, default: str = "") -> str:
    return os.getenv(key, default)


def get_int(key: str, default: int = 0) -> int:
    try:
        return int(os.getenv(key, str(default)))
    except ValueError:
        return default


# ─── YAML settings ────────────────────────────────────────────────────────────
def load_settings() -> dict:
    path = ROOT / "config" / "settings.yaml"
    if not path.exists():
        return {}
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_recipients() -> list[dict]:
    path = ROOT / "config" / "recipients.yaml"
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return data.get("recipients", [])


# Convenience singletons
SETTINGS = load_settings()
LEETCODE_USERNAME: str = get("LEETCODE_USERNAME", "nanthishvaran_07")
SMTP_HOST: str = get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT: int = get_int("SMTP_PORT", 587)
SMTP_USER: str = get("SMTP_USER")
SMTP_PASSWORD: str = get("SMTP_PASSWORD")
SENDER_NAME: str = get("SENDER_NAME", "NEC LeetCode Tracker")

# Rating-settled check config
RATING_SETTLED_RETRIES: int = get_int("RATING_SETTLED_RETRIES", 1)
RATING_SETTLED_WAIT_MINUTES: int = get_int("RATING_SETTLED_WAIT_MINUTES", 20)
