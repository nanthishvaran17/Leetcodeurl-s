import datetime
from zoneinfo import ZoneInfo
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.models import WeeklySession, ContestConfig
from backend.logger import logger

IST = ZoneInfo("Asia/Kolkata")

class ContestDiscoveryService:
    """
    Dynamic Contest Discovery Service.
    Queries the official database for contests conducted within a target reporting week boundary.
    Eliminates all hardcoded contest IDs.
    """

    @staticmethod
    def _parse_datetime_to_ist(dt_val: Any) -> Optional[datetime.datetime]:
        if not dt_val:
            return None
        if isinstance(dt_val, str):
            for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%d-%m-%Y %H:%M:%S"):
                try:
                    parsed = datetime.datetime.strptime(dt_val.split(".")[0], fmt)
                    return parsed.replace(tzinfo=IST)
                except ValueError:
                    continue
            return None
        if isinstance(dt_val, datetime.datetime):
            if dt_val.tzinfo is None:
                return dt_val.replace(tzinfo=IST)
            return dt_val.astimezone(IST)
        if isinstance(dt_val, datetime.date):
            return datetime.datetime.combine(dt_val, datetime.time.min, tzinfo=IST)
        return None

    @classmethod
    def discover_contests_for_period(
        cls,
        db: Session,
        start_dt: datetime.datetime,
        end_dt: datetime.datetime
    ) -> List[Dict[str, Any]]:
        """
        Discovers all contests actually conducted between start_dt and end_dt (Asia/Kolkata).
        Searches both ContestConfig and WeeklySession models dynamically.
        Returns list of contest objects sorted chronologically.
        """
        discovered: Dict[str, Dict[str, Any]] = {}

        # 1. Query ContestConfig model (Production 10/10+ Master Config)
        configs = db.query(ContestConfig).all()
        for cfg in configs:
            c_start = cls._parse_datetime_to_ist(cfg.contest_start_time)
            c_end = cls._parse_datetime_to_ist(cfg.contest_end_time)
            
            # Check if contest falls within week boundaries
            if c_start and (start_dt <= c_start <= end_dt or (c_end and start_dt <= c_end <= end_dt)):
                c_id_str = str(cfg.contest_id).replace("wc-", "").replace("weekly-contest-", "").strip()
                discovered[c_id_str] = {
                    "contest_id": c_id_str,
                    "raw_contest_id": cfg.contest_id,
                    "contest_name": cfg.contest_name,
                    "start_time": c_start,
                    "end_time": c_end,
                    "source": "ContestConfig",
                    "session_id": cfg.id
                }

        # 2. Query WeeklySession model (Historical Canonical Sessions)
        sessions = db.query(WeeklySession).all()
        for sess in sessions:
            s_dt = cls._parse_datetime_to_ist(sess.session_date or sess.created_at)
            
            # Extract number from contest_name e.g. "Weekly Contest 514"
            import re
            m = re.search(r"(\d{3,4})", str(sess.contest_name or ""))
            c_num_str = m.group(1) if m else str(getattr(sess, "session_number", None) or getattr(sess, "contest_number", None) or sess.id)

            if s_dt and start_dt <= s_dt <= end_dt:
                if c_num_str not in discovered:
                    discovered[c_num_str] = {
                        "contest_id": c_num_str,
                        "raw_contest_id": f"wc-{c_num_str}",
                        "contest_name": sess.contest_name or f"Weekly Contest {c_num_str}",
                        "start_time": s_dt,
                        "end_time": s_dt + datetime.timedelta(minutes=90) if s_dt else end_dt,
                        "source": "WeeklySession",
                        "session_id": sess.id
                    }

        # Sort discovered contests chronologically
        result = list(discovered.values())
        result.sort(key=lambda x: x["start_time"] if x["start_time"] else datetime.datetime.min.replace(tzinfo=IST))
        
        logger.info(f"[CONTEST DISCOVERY] Found {len(result)} contests between {start_dt.strftime('%d-%b-%Y')} and {end_dt.strftime('%d-%b-%Y')}: {[c['contest_id'] for c in result]}")
        return result

    @classmethod
    def get_contest_numbers_for_period(
        cls,
        db: Session,
        start_dt: datetime.datetime,
        end_dt: datetime.datetime
    ) -> List[int]:
        """Returns integer contest numbers for period e.g. [513, 514]."""
        contests = cls.discover_contests_for_period(db, start_dt, end_dt)
        nums = []
        for c in contests:
            try:
                nums.append(int(c["contest_id"]))
            except ValueError:
                continue
        return nums

contest_discovery_service = ContestDiscoveryService()
