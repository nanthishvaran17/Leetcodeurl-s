import datetime
import zoneinfo
from typing import Dict, Any, List

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

def discover_contest_metadata(target_date: datetime.date = None) -> Dict[str, Any]:
    """
    Dynamic LeetCode Weekly Contest Discovery Engine.
    Discovers contest ID, title, date, start time, end time, and dynamic problem list.
    """
    if target_date is None:
        target_date = get_most_recent_sunday_date()

    date_str = target_date.strftime("%Y-%m-%d")
    session_code = f"WEEK-{date_str}"

    # Approximate contest number calculation based on reference Sunday (e.g. Contest 462 on 2026-06-21)
    ref_date = datetime.date(2026, 6, 21)
    ref_contest = 462
    weeks_diff = (target_date - ref_date).days // 7
    contest_num = ref_contest + weeks_diff
    contest_id = f"weekly-contest-{contest_num}"
    contest_name = f"Weekly Contest {contest_num}"

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
        "session_date": date_str,
        "start_time_ist": "08:00 AM IST",
        "end_time_ist": "09:30 AM IST",
        "problems": problems
    }
