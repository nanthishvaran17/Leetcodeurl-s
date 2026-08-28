import asyncio
import logging
from typing import Dict, Any, List, Optional
import httpx
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend.models import WeeklySession, Student, WeeklyPublicResult
from backend.leetcode_fetcher import fetch_recent_submissions

logger = logging.getLogger(__name__)

class LiveContestPoller:
    def __init__(self):
        self.contest_questions: Dict[str, Dict[str, Any]] = {}
        self.contest_fetched: bool = False
        self.sorted_question_slugs: List[str] = []
    
    async def fetch_contest_questions(self, contest_name: str) -> bool:
        """
        Fetches the questions for the given contest name (e.g., 'Weekly Contest 517').
        Uses the Global Ranking API which is public during the contest.
        """
        if self.contest_fetched and self.contest_questions:
            return True
            
        slug = contest_name.lower().replace(" ", "-")
        url = f"https://leetcode.com/contest/api/ranking/{slug}/?pagination=1&region=global"
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    questions = data.get("questions", [])
                    if questions:
                        self.contest_questions = {}
                        self.sorted_question_slugs = []
                        for q in questions:
                            tslug = q.get("title_slug")
                            self.contest_questions[tslug] = {
                                "id": q.get("id"),
                                "credit": q.get("credit")
                            }
                            self.sorted_question_slugs.append(tslug)
                        self.contest_fetched = True
                        logger.info(f"[LIVE_POLLER] Fetched {len(self.contest_questions)} questions for {slug}.")
                        return True
        except Exception as e:
            logger.error(f"[LIVE_POLLER] Error fetching contest questions for {slug}: {e}")
            
        return False

live_contest_poller = LiveContestPoller()
