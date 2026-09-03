import datetime
from zoneinfo import ZoneInfo
from typing import Dict, Any, Optional

IST = ZoneInfo("Asia/Kolkata")

class ReportingPeriodService:
    """
    Centralized Reporting Period Service for Academic LeetCode Reports.
    Calculates exact reporting week boundaries using server-side Asia/Kolkata timezone.
    Academic reporting week: Monday 00:00:00 IST through Sunday 23:59:59 IST.
    """

    @staticmethod
    def get_server_now() -> datetime.datetime:
        """Returns current server time in Asia/Kolkata timezone."""
        return datetime.datetime.now(IST)

    @classmethod
    def get_reporting_period(cls, target_date: Optional[Any] = None) -> Dict[str, Any]:
        """
        Calculates current and previous reporting week boundaries based on target_date (or current server time).
        
        Returns dictionary containing:
        - report_date_str: "DD-MM-YYYY" string in IST
        - report_datetime: datetime in IST
        - current_week_start: Monday 00:00:00 IST
        - current_week_end: Sunday 23:59:59 IST
        - previous_week_start: Previous Monday 00:00:00 IST
        - previous_week_end: Previous Sunday 23:59:59 IST
        - reporting_period_id: Standardized string e.g. "2026-W35"
        - previous_period_id: Standardized string e.g. "2026-W34"
        """
        if target_date is None:
            ref_dt = cls.get_server_now()
        elif isinstance(target_date, datetime.datetime):
            if target_date.tzinfo is None:
                ref_dt = target_date.replace(tzinfo=IST)
            else:
                ref_dt = target_date.astimezone(IST)
        elif isinstance(target_date, datetime.date):
            ref_dt = datetime.datetime.combine(target_date, datetime.time.min, tzinfo=IST)
        elif isinstance(target_date, str):
            clean_str = target_date.strip()
            parsed = None
            for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d", "%d/%m/%Y"):
                try:
                    parsed = datetime.datetime.strptime(clean_str, fmt)
                    break
                except ValueError:
                    continue
            if parsed is None:
                ref_dt = cls.get_server_now()
            else:
                ref_dt = parsed.replace(tzinfo=IST)
        else:
            ref_dt = cls.get_server_now()

        # Determine Monday 00:00:00 for current week
        weekday = ref_dt.weekday() # 0 = Monday, 6 = Sunday
        curr_monday_date = ref_dt.date() - datetime.timedelta(days=weekday)
        
        current_week_start = datetime.datetime.combine(curr_monday_date, datetime.time.min, tzinfo=IST)
        curr_sunday_date = curr_monday_date + datetime.timedelta(days=6)
        current_week_end = datetime.datetime.combine(curr_sunday_date, datetime.time.max, tzinfo=IST)

        prev_monday_date = curr_monday_date - datetime.timedelta(days=7)
        previous_week_start = datetime.datetime.combine(prev_monday_date, datetime.time.min, tzinfo=IST)
        prev_sunday_date = prev_monday_date + datetime.timedelta(days=6)
        previous_week_end = datetime.datetime.combine(prev_sunday_date, datetime.time.max, tzinfo=IST)

        iso_year, iso_week, _ = curr_monday_date.isocalendar()
        prev_year, prev_week, _ = prev_monday_date.isocalendar()

        reporting_period_id = f"{iso_year}-W{iso_week:02d}"
        previous_period_id = f"{prev_year}-W{prev_week:02d}"

        return {
            "report_date_str": ref_dt.strftime("%d-%m-%Y"),
            "report_datetime": ref_dt,
            "current_week_start": current_week_start,
            "current_week_end": current_week_end,
            "current_week_start_str": current_week_start.strftime("%d-%b-%Y"),
            "current_week_end_str": current_week_end.strftime("%d-%b-%Y"),
            "previous_week_start": previous_week_start,
            "previous_week_end": previous_week_end,
            "previous_week_start_str": previous_week_start.strftime("%d-%b-%Y"),
            "previous_week_end_str": previous_week_end.strftime("%d-%b-%Y"),
            "reporting_period_id": reporting_period_id,
            "previous_period_id": previous_period_id,
            "timezone": "Asia/Kolkata"
        }

reporting_period_service = ReportingPeriodService()
