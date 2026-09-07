import asyncio
import datetime
import httpx
from typing import List, Dict, Any

from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from backend.database import SessionLocal
from backend.models import SubmissionLog, Student
from backend.logger import logger

GRAPHQL_URL = "https://leetcode.com/graphql"

_RECENT_SUB_QUERY = """
query userProfileUserQuestionProgressBySlug($username: String!) {
  recentAcSubmissionList(username: $username, limit: 75) {
    title
    titleSlug
    timestamp
  }
}
"""

def _make_headers(username: str) -> dict:
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Content-Type": "application/json",
        "Accept": "*/*",
        "Origin": "https://leetcode.com",
        "Referer": f"https://leetcode.com/u/{username}/",
    }

async def fetch_submissions_for_user(
    student_id: int, 
    username: str, 
    contest_id: str,
    problem_slugs: List[str],
    client: httpx.AsyncClient, 
    sem: asyncio.Semaphore,
    db: Session
):
    async with sem:
        # Target ~1-2 req/sec across instances via semaphore / delay
        await asyncio.sleep(0.5) 
        
        headers = _make_headers(username)
        payload = {
            "query": _RECENT_SUB_QUERY, 
            "variables": {"username": username}, 
            "operationName": "userProfileUserQuestionProgressBySlug"
        }

        try:
            resp = await client.post(GRAPHQL_URL, json=payload, headers=headers)
            if resp.status_code == 200:
                body = resp.json()
                subs = body.get("data", {}).get("recentAcSubmissionList") or []
                
                if subs:
                    fetched_at = int(datetime.datetime.now(datetime.timezone.utc).timestamp())
                    for sub in subs:
                        title_slug = sub.get("titleSlug")
                        submitted_at = int(sub.get("timestamp", 0))
                        
                        if not title_slug or not submitted_at:
                            continue
                            
                        # ONLY match submissions for the current contest's problem slugs
                        if title_slug not in problem_slugs:
                            continue
                            
                        # Idempotent insert based on new UNIQUE constraint
                        # (student_id, contest_id, title_slug, submitted_at)
                        existing = db.query(SubmissionLog).filter(
                            and_(
                                SubmissionLog.student_id == student_id,
                                SubmissionLog.contest_id == contest_id,
                                SubmissionLog.title_slug == title_slug,
                                SubmissionLog.submitted_at == submitted_at
                            )
                        ).first()
                        
                        if not existing:
                            new_log = SubmissionLog(
                                student_id=student_id,
                                contest_id=contest_id,
                                title_slug=title_slug,
                                submitted_at=submitted_at,
                                fetched_at=fetched_at
                            )
                            db.add(new_log)
                            # Never overwrite an old timestamp with a newer one

                    db.commit()
        except Exception as e:
            logger.error(f"[POLLER] Error fetching submissions for {username}: {e}")
            db.rollback()

async def run_submission_sweep():
    logger.info("[POLLER] Starting submission sweep for all active students.")
    db = SessionLocal()
    try:
        from backend.models import WeeklySession
        active_session = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()
        if not active_session:
            logger.warning("[POLLER] No active session found. Aborting sweep.")
            return

        contest_id = active_session.contest_name.lower().replace(" ", "-") if active_session.contest_name else "weekly-contest-unknown"
        
        # Hardcode fallback for problem_slugs if live_contest_poller not initialized 
        # In a fully refined system, these are fetched explicitly in phase 1.
        problem_slugs = []
        try:
            from backend.services.live_contest_poller import live_contest_poller
            problem_slugs = live_contest_poller.sorted_question_slugs or []
        except Exception:
            pass
            
        if not problem_slugs:
            logger.warning(f"[POLLER] No problem slugs known for {contest_id}. Continuing with empty strict filter, nothing will match.")

        # Get all active students with a leetcode username
        students = db.query(Student).filter(
            Student.is_active == True,
            Student.username != None,
            Student.username != ""
        ).all()
        
        # Concurrency control
        sem = asyncio.Semaphore(5)
        limits = httpx.Limits(max_keepalive_connections=5, max_connections=10)
        
        async with httpx.AsyncClient(limits=limits, timeout=15.0) as client:
            tasks = []
            for s in students:
                tasks.append(
                    fetch_submissions_for_user(s.id, s.username, contest_id, problem_slugs, client, sem, db)
                )
            
            await asyncio.gather(*tasks)
            
    finally:
        db.close()
    
    logger.info("[POLLER] Submission sweep completed.")
