import logging
import datetime
from typing import Dict, Any, List, Optional
import pytz

logger = logging.getLogger(__name__)

class LiveContestPoller:
    def __init__(self):
        self.contest_questions: Dict[str, Dict[str, Any]] = {}
        self.contest_fetched: bool = False
        self.sorted_question_slugs: List[str] = []
        self.contest_start_time: Optional[int] = None  # unix epoch
        self.contest_duration: Optional[int] = 5400    # seconds (90 min)

    async def fetch_contest_questions(self, contest_name: str) -> bool:
        """
        Since LeetCode APIs (GraphQL/REST) don't expose live contest questions reliably,
        we dynamically determine the contest start time and allow the sync engine
        to discover the question slugs from student submissions in real-time.
        """
        if self.contest_fetched:
            return True

        # Calculate contest start time based on the contest name
        # Weekly contests are Sunday 08:00 AM IST
        # We can just get today's Sunday 08:00 AM IST
        ist = pytz.timezone('Asia/Kolkata')
        now = datetime.datetime.now(ist)
        
        # Find the most recent Sunday
        days_since_sunday = (now.weekday() - 6) % 7
        recent_sunday = now - datetime.timedelta(days=days_since_sunday)
        
        # Set to 08:00 AM IST
        contest_start_dt = recent_sunday.replace(hour=8, minute=0, second=0, microsecond=0)
        self.contest_start_time = int(contest_start_dt.timestamp())
        self.contest_duration = 5400
        
        self.contest_fetched = True
        logger.info(f"[LIVE_POLLER] Bypass API. Contest start time calculated as {contest_start_dt} IST.")
        return True

    def register_discovered_question(self, slug: str):
        if slug not in self.sorted_question_slugs:
            self.sorted_question_slugs.append(slug)
            # Assign credit based on order of discovery (typically 3, 4, 5, 6)
            credit = 3 + len(self.sorted_question_slugs) - 1
            if credit > 6: credit = 6
            self.contest_questions[slug] = {
                "id": None,
                "credit": credit,
                "title": slug,
            }
            logger.info(f"[LIVE_POLLER] Discovered new contest question: {slug}")

    def reset(self):
        self.contest_questions = {}
        self.contest_fetched = False
        self.sorted_question_slugs = []
        self.contest_start_time = None
        self.contest_duration = 5400

live_contest_poller = LiveContestPoller()
