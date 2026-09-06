"""
Weekly Session Resolver Service
Strict session resolution for weekly report generation.
Never silently falls back to arbitrary contest numbers.
"""
import re
import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from backend.models import WeeklySession
from backend.config.report_config import FINALIZED_STATUSES
from backend.services.contest_discovery import get_current_ist_datetime
from backend.logger import logger


def parse_session_date(d_str: Any) -> Optional[datetime.date]:
    """Parses DD.MM.YYYY or YYYY-MM-DD string into a datetime.date object."""
    if not d_str or not isinstance(d_str, str):
        return None
    d_str = d_str.strip()
    try:
        if "." in d_str:
            parts = d_str.split(".")
            if len(parts) == 3:
                return datetime.date(int(parts[2]), int(parts[1]), int(parts[0]))
        elif "-" in d_str:
            parts = d_str.split("-")
            if len(parts) == 3:
                if len(parts[0]) == 4:
                    return datetime.date(int(parts[0]), int(parts[1]), int(parts[2]))
                else:
                    return datetime.date(int(parts[2]), int(parts[1]), int(parts[0]))
    except Exception:
        pass
    return None


def extract_contest_number(session: Any) -> Optional[int]:
    """
    Extracts integer contest number from a WeeklySession instance, contest string, or dict.
    Returns None if no contest number can be determined.
    """
    if session is None:
        return None

    if isinstance(session, int):
        return session

    candidates = []
    if hasattr(session, "contest_name") and session.contest_name:
        candidates.append(str(session.contest_name))
    if hasattr(session, "contest_id") and session.contest_id:
        candidates.append(str(session.contest_id))

    if isinstance(session, dict):
        if session.get("contest_name"):
            candidates.append(str(session["contest_name"]))
        if session.get("contest_id"):
            candidates.append(str(session["contest_id"]))
        if session.get("contest_number"):
            try:
                return int(session["contest_number"])
            except (ValueError, TypeError):
                pass

    if isinstance(session, str):
        candidates.append(session)

    for text in candidates:
        if re.search(r'\b(test|mock)\b', text, re.IGNORECASE):
            continue
        m = re.search(r'(?:weekly[- ]contest[- ]?|contest[- ]?)(\d+)', text, re.IGNORECASE)
        if m:
            return int(m.group(1))
        m_num = re.search(r'\b(4\d{2}|5\d{2}|6\d{2})\b', text)
        if m_num:
            return int(m_num.group(1))

    return None


def resolve_weekly_sessions(
    db: Session,
    last_week: Optional[int] = None,
    current_week: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Resolves current week and last week WeeklySession objects according to strict rules:
    
    1. If BOTH CLI overrides are supplied, resolve those exact contest numbers from DB.
       - Resolution mode: 'cli_override'
    2. Otherwise filter sessions by date (session_date <= today_ist) and valid contest number.
    3. Sort descending by parsed date & contest number:
       - [0] = current_week (today / latest Sunday)
       - [1] = last_week (previous Sunday)
    """
    all_db_sessions = db.query(WeeklySession).all()
    today_ist = get_current_ist_datetime().date()

    def _find_session_by_contest_num(c_num: Optional[int]) -> Optional[WeeklySession]:
        if c_num is None:
            return None
        for sess in all_db_sessions:
            extracted = extract_contest_number(sess)
            if extracted == int(c_num):
                return sess
        return None

    # Case 1: CLI Overrides supplied
    if last_week is not None or current_week is not None:
        curr_sess = _find_session_by_contest_num(current_week) if current_week is not None else None
        last_sess = _find_session_by_contest_num(last_week) if last_week is not None else None

        curr_num = extract_contest_number(curr_sess) if curr_sess else current_week
        last_num = extract_contest_number(last_sess) if last_sess else last_week

        last_date = getattr(last_sess, "session_date", None) if last_sess else None
        curr_date = getattr(curr_sess, "session_date", None) if curr_sess else None

        return {
            "last_week_session": last_sess,
            "current_week_session": curr_sess,
            "last_week_contest": last_num,
            "current_week_contest": curr_num,
            "resolution_mode": "cli_override",
            "last_week_date": str(last_date) if last_date else None,
            "current_week_date": str(curr_date) if curr_date else None,
        }

    # Filter out test sessions and future sessions (e.g. 13.09.2026 when today is 06.09.2026)
    valid_past_or_today = []
    for s in all_db_sessions:
        if not s or re.search(r'\b(test|mock)\b', str(s.contest_name or ""), re.IGNORECASE):
            continue
        p_date = parse_session_date(s.session_date)
        c_num = extract_contest_number(s)
        if p_date and p_date <= today_ist and c_num is not None:
            valid_past_or_today.append((p_date, c_num, s))

    # Sort descending by date and contest number
    valid_past_or_today.sort(key=lambda item: (item[0], item[1]), reverse=True)

    if len(valid_past_or_today) >= 2:
        curr_pdate, curr_num, curr_sess = valid_past_or_today[0]
        last_pdate, last_num, last_sess = valid_past_or_today[1]
        mode = "db_auto"
    elif len(valid_past_or_today) == 1:
        curr_pdate, curr_num, curr_sess = valid_past_or_today[0]
        last_sess = _find_session_by_contest_num(curr_num - 1)
        last_num = extract_contest_number(last_sess) if last_sess else None
        mode = "db_auto"
    else:
        curr_sess = None
        last_sess = None
        curr_num = None
        last_num = None
        mode = "insufficient"

    last_date = getattr(last_sess, "session_date", None) if last_sess else None
    curr_date = getattr(curr_sess, "session_date", None) if curr_sess else None

    logger.info(
        f"[SESSION_RESOLVER] Mode: {mode}, Current: Contest {curr_num} ({curr_date}, Session ID {getattr(curr_sess, 'id', None)}), "
        f"Last: Contest {last_num} ({last_date}, Session ID {getattr(last_sess, 'id', None)})"
    )

    return {
        "last_week_session": last_sess,
        "current_week_session": curr_sess,
        "last_week_contest": last_num,
        "current_week_contest": curr_num,
        "resolution_mode": mode,
        "last_week_date": str(last_date) if last_date else None,
        "current_week_date": str(curr_date) if curr_date else None,
    }
