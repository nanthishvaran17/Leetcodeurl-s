"""
time_utils.py — Modern ZoneInfo-based Timezone Management for LeetCode Tracker

Guarantees:
- Pure Python zoneinfo (Python 3.9+) without pytz dependency
- UTC storage in database
- Explicit Asia/Kolkata (IST) scheduler and display conversions
- Precise 09:58 AM IST snapshot freeze cutoff and 10:00 AM IST report generation times
"""
from __future__ import annotations

from datetime import datetime, time, date
from zoneinfo import ZoneInfo
from typing import Optional

UTC = ZoneInfo("UTC")
IST = ZoneInfo("Asia/Kolkata")


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensure a datetime object is timezone-aware and converted to UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def ensure_ist(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensure a datetime object is timezone-aware and converted to IST."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(IST)


def get_ist_date(utc_dt: Optional[datetime] = None) -> date:
    """
    Convert UTC datetime to IST date.
    Defaults to current time if utc_dt is not provided.
    """
    if utc_dt is None:
        utc_dt = now_utc()
    elif utc_dt.tzinfo is None:
        utc_dt = utc_dt.replace(tzinfo=UTC)
    return utc_dt.astimezone(IST).date()


def get_report_time_utc(contest_start_utc: datetime) -> datetime:
    """
    Get 10:00 AM IST report time in UTC for the contest date.
    Calculated dynamically from contest start datetime.
    """
    ist_date = get_ist_date(contest_start_utc)
    report_ist = datetime.combine(ist_date, time(10, 0, 0), tzinfo=IST)
    return report_ist.astimezone(UTC)


def get_snapshot_cutoff_utc(contest_start_utc: datetime) -> datetime:
    """
    Get 09:58 AM IST snapshot cutoff in UTC for the contest date.
    Calculated dynamically from contest start datetime.
    """
    ist_date = get_ist_date(contest_start_utc)
    cutoff_ist = datetime.combine(ist_date, time(9, 58, 0), tzinfo=IST)
    return cutoff_ist.astimezone(UTC)


def now_utc() -> datetime:
    """Get current UTC datetime."""
    return datetime.now(UTC)


def now_ist() -> datetime:
    """Get current IST datetime."""
    return datetime.now(IST)


def format_ist(dt: Optional[datetime], fmt: str = "%Y-%m-%d %H:%M:%S IST") -> str:
    """Format datetime in IST for user display."""
    if dt is None:
        return "N/A"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(IST).strftime(fmt)


def parse_iso_to_utc(iso_str: str) -> Optional[datetime]:
    """Parse ISO formatted datetime string and ensure UTC awareness."""
    if not iso_str:
        return None
    try:
        dt = datetime.fromisoformat(iso_str)
        return ensure_utc(dt)
    except Exception:
        return None
