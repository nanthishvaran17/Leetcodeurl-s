"""
Data Version Service
Manages global system data versioning and staleness detection for cached reports.
"""
import hashlib
import time
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.models import Student, LeetCodeProfileStats, WeeklySession, SystemSetting
from backend.logger import logger

_GLOBAL_DATA_VERSION_KEY = "global_data_version_counter"
_CACHED_VERSION = None
_CACHED_VERSION_TIME = 0.0

def get_current_data_version(db: Session) -> str:
    """
    Returns the current data version string for the institution dataset.
    Uses cached version in memory for 2 seconds to keep lookups < 1ms,
    falling back to DB query / setting.
    """
    global _CACHED_VERSION, _CACHED_VERSION_TIME
    now = time.time()
    if _CACHED_VERSION and (now - _CACHED_VERSION_TIME) < 2.0:
        return _CACHED_VERSION

    try:
        # Check explicit SystemSetting counter first
        setting = db.query(SystemSetting).filter(SystemSetting.key == _GLOBAL_DATA_VERSION_KEY).first()
        if setting and setting.value:
            version_str = f"v{setting.value}"
        else:
            # Generate deterministic fallback hash based on student count, max student id, max session id, max solved sum
            student_count = db.query(func.count(Student.id)).scalar() or 0
            max_session_id = db.query(func.max(WeeklySession.id)).scalar() or 0
            total_solved_sum = db.query(func.sum(LeetCodeProfileStats.total_solved)).scalar() or 0
            
            raw_str = f"s:{student_count}_ws:{max_session_id}_sol:{total_solved_sum}"
            v_hash = hashlib.md5(raw_str.encode("utf-8")).hexdigest()[:10]
            version_str = f"v1-{v_hash}"

        _CACHED_VERSION = version_str
        _CACHED_VERSION_TIME = now
        return version_str
    except Exception as e:
        logger.warning(f"[DATA_VERSION_SERVICE] Error resolving version: {e}")
        return "v1-fallback"

def bump_data_version(db: Session) -> str:
    """
    Increments the global data version when sync, contest finish, or roster edit occurs.
    """
    global _CACHED_VERSION, _CACHED_VERSION_TIME
    try:
        setting = db.query(SystemSetting).filter(SystemSetting.key == _GLOBAL_DATA_VERSION_KEY).first()
        if not setting:
            val = "1001"
            setting = SystemSetting(key=_GLOBAL_DATA_VERSION_KEY, value=val)
            db.add(setting)
        else:
            current_val = int(setting.value) if setting.value and setting.value.isdigit() else 1000
            val = str(current_val + 1)
            setting.value = val
        db.commit()
        version_str = f"v{val}"
        _CACHED_VERSION = version_str
        _CACHED_VERSION_TIME = time.time()
        logger.info(f"[DATA_VERSION_SERVICE] Data version bumped to {version_str}")
        return version_str
    except Exception as e:
        db.rollback()
        logger.error(f"[DATA_VERSION_SERVICE] Failed to bump data version: {e}")
        return get_current_data_version(db)
