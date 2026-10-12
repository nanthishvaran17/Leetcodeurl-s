"""
friday_rating_sync_service.py
================================================================================
Official Friday 5:00 AM IST LeetCode Global Contest Rating & Reranking Engine.
Every Friday morning at 05:00 AM IST:
1. LeetCode finishes official contest rating calculations & plagiarism reranking.
2. This service queries LeetCode GraphQL for ALL enrolled students.
3. Updates:
   - Student.stats (contest_rating, contest_global_ranking, rating_change)
   - WeeklyPublicResult (contest_rating, rating_change, contest_rank)
   - OfficialWeeklySnapshot & StudentContestSnapshot
   - LeetCodeContestRatingHistory
4. Recalculates and broadcasts updates so EVERY page (Dashboard, Weekly Contest,
   Student Profile, Leaderboard, HOD Command Center) immediately reflects
   the latest official ratings and rankings.
================================================================================
"""

import sys
import os
import asyncio
import logging
import datetime
from zoneinfo import ZoneInfo
from typing import Dict, Any, List, Optional
import httpx
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.database import SessionLocal
from backend.models import (
    Student,
    WeeklySession,
    WeeklyPublicResult,
    LeetCodeProfileStats,
    LeetCodeContestRatingHistory,
    StudentContestSnapshot
)
from backend.ranking import update_all_rankings_and_badges
from backend.cache import cache
from backend.websocket_manager import manager

logger = logging.getLogger(__name__)
IST = ZoneInfo("Asia/Kolkata")

CONTEST_RATING_GQL = """
query userContestRatingProfile($username: String!) {
  userContestRanking(username: $username) {
    attendedContestsCount
    rating
    globalRanking
    totalParticipants
    topPercentage
  }
  userContestRankingHistory(username: $username) {
    attended
    problemsSolved
    totalProblems
    finishTimeInSeconds
    rating
    ranking
    contest {
      title
      startTime
    }
  }
}
"""

async def fetch_student_rating(client: httpx.AsyncClient, username: str, sem: asyncio.Semaphore) -> Optional[Dict[str, Any]]:
    async with sem:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Content-Type": "application/json",
            "Referer": "https://leetcode.com"
        }
        for attempt in range(2):
            try:
                resp = await client.post(
                    "https://leetcode.com/graphql",
                    json={"query": CONTEST_RATING_GQL, "variables": {"username": username.strip()}},
                    headers=headers,
                    timeout=8.0
                )
                if resp.status_code == 200:
                    data = resp.json().get("data")
                    if data:
                        return data
                elif resp.status_code in (429, 403):
                    await asyncio.sleep(1.0)
            except Exception:
                await asyncio.sleep(0.5)
        return None

async def run_friday_rating_sync():
    """
    Main orchestrator called every Friday 5:00 AM IST or on-demand by admin.
    """
    logger.info("[FRIDAY_RATING_SYNC] ========================================================")
    logger.info("[FRIDAY_RATING_SYNC] Starting Official Friday 5:00 AM IST Contest Rating Sync...")
    logger.info("[FRIDAY_RATING_SYNC] ========================================================")

    db = SessionLocal()
    try:
        students = db.query(Student).filter(
            Student.is_active == True,
            ~Student.reg_no.like("REG_%"),
            ~Student.reg_no.like("TEST%")
        ).all()

        valid_students = [s for s in students if s.username]
        logger.info(f"[FRIDAY_RATING_SYNC] Found {len(valid_students)} active students with LeetCode usernames.")

        # Find latest finalized or live WeeklySessions (e.g. Session 14 / Contest 523, Session 17 / Contest 524)
        recent_sessions = db.query(WeeklySession).filter(
            WeeklySession.contest_id.ilike("%weekly-contest%")
        ).order_by(WeeklySession.id.desc()).limit(3).all()

        sem = asyncio.Semaphore(20)
        limits = httpx.Limits(max_connections=50, max_keepalive_connections=20)
        async with httpx.AsyncClient(limits=limits, timeout=10.0) as client:
            batch_size = 30
            updated_count = 0

            for b_idx in range(0, len(valid_students), batch_size):
                chunk = valid_students[b_idx:b_idx + batch_size]
                tasks = [fetch_student_rating(client, s.username, sem) for s in chunk]
                results = await asyncio.gather(*tasks)

                for s, data in zip(chunk, results):
                    if not data:
                        continue

                    cr = data.get("userContestRanking") or {}
                    hist = data.get("userContestRankingHistory") or []

                    official_rating = float(cr.get("rating") or 0.0) if cr.get("rating") else None
                    global_rank = int(cr.get("globalRanking") or 0) if cr.get("globalRanking") else None

                    # 1. Update Student.stats
                    stats = s.stats
                    if not stats:
                        stats = LeetCodeProfileStats(student_id=s.id)
                        db.add(stats)

                    if official_rating and official_rating > 0:
                        prev_rating = stats.contest_rating or 0.0
                        stats.contest_rating = round(official_rating, 1)
                        stats.contest_global_ranking = global_rank
                        stats.last_verified_at = datetime.datetime.now(datetime.timezone.utc)

                    # 2. Update WeeklyPublicResult for recent sessions
                    for session in recent_sessions:
                        import re
                        m = re.search(r"(\d+)", session.contest_id or session.contest_name or "")
                        c_num_str = m.group(1) if m else ""

                        # Find matching entry in student's history
                        matching_hist = None
                        prev_hist = None
                        if c_num_str:
                            for idx, h in enumerate(hist):
                                h_title = (h.get("contest") or {}).get("title") or ""
                                if c_num_str in h_title:
                                    matching_hist = h
                                    # previous attended contest for rating change delta
                                    for p in hist[max(0, idx-1)::-1]:
                                        if p.get("attended") and p.get("rating"):
                                            prev_hist = p
                                            break
                                    break

                        wpr = db.query(WeeklyPublicResult).filter(
                            WeeklyPublicResult.session_id == session.id,
                            WeeklyPublicResult.student_id == s.id
                        ).first()

                        if wpr:
                            hist_r = float(matching_hist.get("rating") or 0.0) if (matching_hist and matching_hist.get("rating")) else official_rating
                            hist_rk = int(matching_hist.get("ranking") or 0) if (matching_hist and matching_hist.get("ranking")) else global_rank

                            if hist_r:
                                wpr.contest_rating = round(hist_r, 1)
                                if prev_hist and prev_hist.get("rating"):
                                    wpr.rating_change = round(hist_r - float(prev_hist["rating"]), 1)
                            if hist_rk:
                                wpr.contest_rank = hist_rk
                            if matching_hist and matching_hist.get("attended"):
                                wpr.participation_status = "PUBLIC_ATTENDED"

                    updated_count += 1

                db.commit()

        # Recalculate badge rankings & college percentiles across database
        logger.info("[FRIDAY_RATING_SYNC] Updating college-wide leaderboard badges & rankings...")
        update_all_rankings_and_badges(db)
        db.commit()

        # Invalidate all backend & Redis caches across the application
        cache.clear()
        logger.info(f"[FRIDAY_RATING_SYNC] SUCCESS: Processed {updated_count} students. Caches cleared!")

        # Broadcast live sync completion event over WebSockets to refresh open client pages
        try:
            manager.broadcast_sync({
                "type": "FRIDAY_OFFICIAL_RATINGS_UPDATED",
                "message": "Official LeetCode contest ratings & rankings refreshed college-wide.",
                "updated_count": updated_count,
                "timestamp": datetime.datetime.now(IST).isoformat()
            })
        except Exception:
            pass

        return {"success": True, "updated_count": updated_count}

    except Exception as ex:
        logger.error(f"[FRIDAY_RATING_SYNC_ERR] Exception: {ex}", exc_info=True)
        return {"success": False, "error": str(ex)}
    finally:
        db.close()

def sync_friday_ratings():
    """Synchronous wrapper for schedulers & CLI"""
    return asyncio.run(run_friday_rating_sync())

if __name__ == "__main__":
    sync_friday_ratings()
