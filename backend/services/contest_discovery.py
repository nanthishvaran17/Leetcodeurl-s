import datetime
import zoneinfo
from typing import Dict, Any

IST_TZ = zoneinfo.ZoneInfo("Asia/Kolkata")

def get_current_ist_datetime() -> datetime.datetime:
    """Returns current datetime in Asia/Kolkata (IST)."""
    return datetime.datetime.now(IST_TZ)

def get_most_recent_sunday_date(target_dt: datetime.datetime = None) -> datetime.date:
    """
    Returns the date of the current/most recent Sunday in IST.
    If today is Sunday, returns today.
    """
    if target_dt is None:
        target_dt = get_current_ist_datetime()
    
    # Python weekday(): Monday=0, ..., Sunday=6
    days_since_sunday = (target_dt.weekday() + 1) % 7
    sunday_dt = target_dt - datetime.timedelta(days=days_since_sunday)
    return sunday_dt.date()

def get_immediately_previous_sunday_date(now_ist: datetime.datetime = None) -> datetime.date:
    """
    Calculates the date of the immediately previous Sunday in IST.
    If today is Tuesday 25-Aug-2026, returns 23-Aug-2026.
    If today is Sunday 23-Aug-2026 before 09:30 AM IST, returns 16-Aug-2026.
    If today is Sunday 23-Aug-2026 after 09:30 AM IST, returns 23-Aug-2026.
    """
    if now_ist is None:
        now_ist = get_current_ist_datetime()
    
    weekday = now_ist.weekday() # Monday=0, ..., Sunday=6
    if weekday == 6: # Sunday
        cutoff = now_ist.replace(hour=9, minute=30, second=0, microsecond=0)
        if now_ist < cutoff:
            return (now_ist - datetime.timedelta(days=7)).date()
        else:
            return now_ist.date()
    else:
        days_since_sunday = (weekday + 1)
        return (now_ist - datetime.timedelta(days=days_since_sunday)).date()

def get_upcoming_sunday_date(target_dt: datetime.datetime = None) -> datetime.date:
    """
    Returns the date of the next upcoming Sunday in IST.
    If today is Sunday and before 09:30 AM IST, returns today.
    Otherwise returns the next Sunday.
    """
    if target_dt is None:
        target_dt = get_current_ist_datetime()
    
    weekday = target_dt.weekday() # Monday=0 ... Sunday=6
    if weekday == 6: # Sunday
        cutoff = target_dt.replace(hour=9, minute=30, second=0, microsecond=0)
        if target_dt <= cutoff:
            return target_dt.date()
        else:
            return (target_dt + datetime.timedelta(days=7)).date()
    else:
        days_until_sunday = (6 - weekday)
        return (target_dt + datetime.timedelta(days=days_until_sunday)).date()

def calculate_contest_number(contest_date: datetime.date) -> int:
    """
    Calculates Weekly Contest number dynamically based on contest date in IST.
    Authoritative reference: Contest 514 on 2026-08-09.
    """
    ref_date = datetime.date(2026, 8, 9)
    ref_contest = 514
    weeks_diff = (contest_date - ref_date).days // 7
    return ref_contest + weeks_diff

def calculate_contest_status(contest_date: datetime.date, current_dt: datetime.datetime = None) -> str:
    """
    Determines contest status dynamically using Asia/Kolkata timezone.
    Contest window: 08:00 AM IST – 09:30 AM IST.
    Rules:
    - Before 08:00 AM IST on contest date -> SCHEDULED
    - 08:00 AM – 09:30 AM IST on contest date -> LIVE
    - After 09:30 AM IST on contest date -> FINALIZED
    """
    if current_dt is None:
        current_dt = get_current_ist_datetime()
    
    # Ensure current_dt is localized in IST
    if current_dt.tzinfo is None:
        current_dt = current_dt.replace(tzinfo=IST_TZ)
    else:
        current_dt = current_dt.astimezone(IST_TZ)

    start_dt = datetime.datetime.combine(
        contest_date, datetime.time(8, 0, 0), tzinfo=IST_TZ
    )
    end_dt = datetime.datetime.combine(
        contest_date, datetime.time(9, 30, 0), tzinfo=IST_TZ
    )

    if current_dt < start_dt:
        return "SCHEDULED"
    elif start_dt <= current_dt <= end_dt:
        return "LIVE"
    else:
        return "FINALIZED"

import time
import urllib.request
import json
from backend.logger import logger

LEETCODE_TOP_CONTESTS_QUERY = """
query topTwoContests {
  topTwoContests {
    title
    titleSlug
    startTime
    duration
  }
}
"""

_top_contests_cache = None
_top_contests_cached_at = 0.0
_CACHE_TTL_SUCCESS = 600.0  # 10 minutes cache on success
_CACHE_TTL_FAILURE = 120.0  # 2 minutes cache on network failure

def _get_leetcode_top_contests() -> list:
    global _top_contests_cache, _top_contests_cached_at
    now = time.time()
    if _top_contests_cache is not None:
        ttl = _CACHE_TTL_SUCCESS if _top_contests_cache else _CACHE_TTL_FAILURE
        if now - _top_contests_cached_at < ttl:
            return _top_contests_cache

    try:
        req = urllib.request.Request(
            "https://leetcode.com/graphql",
            data=json.dumps({"query": LEETCODE_TOP_CONTESTS_QUERY}).encode('utf-8'),
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Accept": "*/*"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            contests = data.get("data", {}).get("topTwoContests", [])
            _top_contests_cache = contests
            _top_contests_cached_at = now
            return _top_contests_cache
    except Exception as e:
        logger.warning(f"[CONTEST_DISCOVERY] Live LeetCode GraphQL query failed: {e}. Falling back to date arithmetic.")
        _top_contests_cache = []
        _top_contests_cached_at = now
        return []

def fetch_leetcode_live_contest_info(target_contest_num: int = None) -> Dict[str, Any]:
    """
    Attempts to fetch live contest metadata directly from LeetCode GraphQL API.
    Uses global top-contests TTL caching (10 mins) to prevent repetitive network requests.
    Returns metadata dict if successful, or empty dict on failure.
    """
    contests = _get_leetcode_top_contests()
    for c in contests:
        title = c.get("title", "")
        if target_contest_num:
            if f"Weekly Contest {target_contest_num}" in title:
                return c
        elif "Weekly Contest" in title:
            return c
    return {}

def fetch_leetcode_contest_questions(title_slug: str) -> list:
    """
    Fetches real problem titles and scores for a specific contest from Leetcode GraphQL.
    """
    query = """
    query getContest($titleSlug: String!) {
      contest(titleSlug: $titleSlug) {
        questions {
          credit
          title
          titleSlug
        }
      }
    }
    """
    try:
        req = urllib.request.Request(
            "https://leetcode.com/graphql",
            data=json.dumps({"query": query, "variables": {"titleSlug": title_slug}}).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Accept": "*/*"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data.get("data", {}).get("contest", {}).get("questions", [])
    except Exception as e:
        logger.warning(f"[CONTEST_DISCOVERY] Live LeetCode questions fetch failed for {title_slug}: {e}")
        return []

def discover_contest_metadata(target_date: datetime.date = None, override_contest_num: int = None) -> Dict[str, Any]:
    """
    Dynamic LeetCode Weekly Contest Discovery Engine.
    Discovers contest ID, title, date, start time, end time, and dynamic problem list.
    Evaluates real-time contest status (SCHEDULED, LIVE, FINALIZED) dynamically based on Asia/Kolkata IST.
    Supports audit tags: LEETCODE_API_DISCOVERED, CALCULATED_DATE_ARITHMETIC, EXPLICIT_OVERRIDE.
    """
    if target_date is None:
        target_date = get_most_recent_sunday_date()

    date_str = target_date.strftime("%Y-%m-%d")
    formatted_date = target_date.strftime("%d.%m.%Y")
    session_code = f"WEEK-{date_str}"

    start_dt = datetime.datetime.combine(target_date, datetime.time(8, 0, 0), tzinfo=IST_TZ)
    end_dt = datetime.datetime.combine(target_date, datetime.time(9, 30, 0), tzinfo=IST_TZ)

    discovery_source = "CALCULATED_DATE_ARITHMETIC"

    if override_contest_num:
        contest_num = override_contest_num
        discovery_source = "EXPLICIT_OVERRIDE"
    else:
        contest_num = calculate_contest_number(target_date)
        # Attempt live API discovery cross-check
        live_info = fetch_leetcode_live_contest_info(contest_num)
        if live_info:
            discovery_source = "LEETCODE_API_DISCOVERED"
            logger.info(f"[CONTEST_DISCOVERY] Successfully verified contest via LeetCode GraphQL API: {live_info.get('title')}")

    contest_id = f"weekly-contest-{contest_num}"
    contest_name = f"Weekly Contest {contest_num}"
    status = calculate_contest_status(target_date)

    raw_questions = fetch_leetcode_contest_questions(contest_id)
    if raw_questions and len(raw_questions) >= 4:
        problems = [
            {"problem_index": 1, "title": raw_questions[0].get("title", "Q1 (Easy)"), "difficulty": "Easy", "max_score": raw_questions[0].get("credit", 3)},
            {"problem_index": 2, "title": raw_questions[1].get("title", "Q2 (Medium)"), "difficulty": "Medium", "max_score": raw_questions[1].get("credit", 4)},
            {"problem_index": 3, "title": raw_questions[2].get("title", "Q3 (Medium/Hard)"), "difficulty": "Medium", "max_score": raw_questions[2].get("credit", 5)},
            {"problem_index": 4, "title": raw_questions[3].get("title", "Q4 (Hard)"), "difficulty": "Hard", "max_score": raw_questions[3].get("credit", 6)}
        ]
        if discovery_source == "CALCULATED_DATE_ARITHMETIC":
            discovery_source = "CALCULATED_DATE_ARITHMETIC_WITH_LIVE_QUESTIONS"
    else:
        problems = [
            {"problem_index": 1, "title": "Q1 (Easy)", "difficulty": "Easy", "max_score": 3},
            {"problem_index": 2, "title": "Q2 (Medium)", "difficulty": "Medium", "max_score": 4},
            {"problem_index": 3, "title": "Q3 (Medium/Hard)", "difficulty": "Medium", "max_score": 5},
            {"problem_index": 4, "title": "Q4 (Hard)", "difficulty": "Hard", "max_score": 6}
        ]

    return {
        "session_code": session_code,
        "contest_id": contest_id,
        "contest_name": contest_name,
        "contest_number": contest_num,
        "session_date": formatted_date,
        "raw_date": date_str,
        "status": status,
        "discovery_source": discovery_source,
        "start_time_ist": "08:00 AM IST",
        "end_time_ist": "09:30 AM IST",
        "start_iso": start_dt.isoformat(),
        "end_iso": end_dt.isoformat(),
        "start_epoch_ms": int(start_dt.timestamp() * 1000),
        "end_epoch_ms": int(end_dt.timestamp() * 1000),
        "problems": problems
    }

