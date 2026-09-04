"""
Weekly Session Resolver Service
Strict session resolution for weekly report generation.
Never silently falls back to arbitrary contest numbers.
"""
import re
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from backend.models import WeeklySession
from backend.config.report_config import FINALIZED_STATUSES
from backend.logger import logger


def extract_contest_number(session: Any) -> Optional[int]:
    """
    Extracts integer contest number from a WeeklySession instance, contest string, or dict.
    Returns None if no contest number can be determined.
    """
    if session is None:
        return None

    if isinstance(session, int):
        return session

    # Check object attributes
    candidates = []
    if hasattr(session, "contest_name") and session.contest_name:
        candidates.append(str(session.contest_name))
    if hasattr(session, "contest_id") and session.contest_id:
        candidates.append(str(session.contest_id))
    if hasattr(session, "session_code") and session.session_code:
        candidates.append(str(session.session_code))

    # Check dict keys
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
        # Match 'Weekly Contest 514', 'weekly-contest-514', 'Contest 514', or standalone number
        m = re.search(r'(?:weekly[- ]contest[- ]?|contest[- ]?)(\d+)', text, re.IGNORECASE)
        if m:
            return int(m.group(1))
        # Fallback regex for numbers in text
        m_num = re.search(r'\b(\d{1,4})\b', text)
        if m_num:
            return int(m_num.group(1))
        m_any = re.search(r'\d+', text)
        if m_any:
            return int(m_any.group(0))

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
    2. Otherwise query sessions whose status is in FINALIZED_STATUSES ('COMPLETED', 'FINALIZED').
    3. Extract contest number from contest name/id.
    4. Sort by contest number descending:
       - [0] = current_week
       - [1] = last_week
       - If only 1 exists: current = [0], last = None
       - If none exist: both = None
       - Resolution mode: 'db_auto' (if at least 1 session exists) or 'insufficient' (if 0 exist)
    5. Never silently fallback to 513/514.
    """
    all_db_sessions = db.query(WeeklySession).all()

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

    # Case 2: Automatic DB resolution from finalized/completed sessions
    finalized_sessions = [
        s for s in all_db_sessions
        if (s.status or "").upper() in [st.upper() for st in FINALIZED_STATUSES]
    ]

    if not finalized_sessions and all_db_sessions:
        finalized_sessions = all_db_sessions

    if not all_db_sessions:
        return {
            "last_week_session": None,
            "current_week_session": None,
            "last_week_contest": None,
            "current_week_contest": None,
            "resolution_mode": "insufficient",
            "last_week_date": None,
            "current_week_date": None,
        }

    # Map session -> contest number
    valid_sessions = []
    for s in finalized_sessions:
        c_num = extract_contest_number(s)
        if c_num is not None:
            valid_sessions.append((c_num, s))

    # Sort descending by contest number
    valid_sessions.sort(key=lambda item: item[0], reverse=True)

    all_valid_sessions = []
    for s in all_db_sessions:
        c_num = extract_contest_number(s)
        if c_num is not None:
            all_valid_sessions.append((c_num, s))
    all_valid_sessions.sort(key=lambda item: item[0], reverse=True)

    if len(valid_sessions) >= 2:
        curr_num, curr_sess = valid_sessions[0]
        last_num, last_sess = valid_sessions[1]
        mode = "db_auto"
    elif len(all_valid_sessions) >= 2:
        curr_num, curr_sess = all_valid_sessions[0]
        last_num, last_sess = all_valid_sessions[1]
        mode = "db_auto"
    elif len(valid_sessions) == 1:
        curr_num, curr_sess = valid_sessions[0]
        last_sess = _find_session_by_contest_num(curr_num - 1)
        last_num = extract_contest_number(last_sess) if last_sess else None
        mode = "db_auto"
    elif len(all_valid_sessions) == 1:
        curr_num, curr_sess = all_valid_sessions[0]
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
        f"[SESSION_RESOLVER] Mode: {mode}, Current: Contest {curr_num} (Session ID {getattr(curr_sess, 'id', None)}), "
        f"Last: Contest {last_num} (Session ID {getattr(last_sess, 'id', None)})"
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
