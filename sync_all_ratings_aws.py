import os
import sys
import asyncio
import datetime
from zoneinfo import ZoneInfo
import httpx
from sqlalchemy.orm import Session

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from backend.database import SessionLocal
from backend.models import (
    Student,
    WeeklySession,
    WeeklyPublicResult,
    LeetCodeProfileStats,
    Department
)
from backend.ranking import update_all_rankings_and_badges
from backend.cache import cache

IST = ZoneInfo("Asia/Kolkata")

CONTEST_RATING_GQL = """
query userContestAndProfile($username: String!) {
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
  matchedUser(username: $username) {
    submitStatsGlobal {
      acSubmissionNum {
        difficulty
        count
      }
    }
  }
}
"""

async def fetch_leetcode_contest_data(client: httpx.AsyncClient, username: str, sem: asyncio.Semaphore):
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
                    timeout=10.0
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

async def sync_all_student_ratings():
    print("\n" + "="*70)
    print("🚀 STARTING REAL-TIME LEETCODE CONTEST RATING & RANK SYNC (ALL STUDENTS)")
    print("="*70)

    db = SessionLocal()
    try:
        students = db.query(Student).filter(
            Student.is_active == True,
            ~Student.reg_no.like("REG_%"),
            ~Student.reg_no.like("TEST%")
        ).all()

        valid_students = [s for s in students if s.username and str(s.username).strip()]
        total = len(valid_students)
        print(f"📊 Found {total} active students with registered LeetCode usernames.")

        # Latest Weekly Session (e.g., Weekly Contest 523)
        recent_sessions = db.query(WeeklySession).order_by(WeeklySession.id.desc()).limit(3).all()

        sem = asyncio.Semaphore(15)
        limits = httpx.Limits(max_connections=30, max_keepalive_connections=15)

        updated_ratings = 0
        batch_size = 25

        async with httpx.AsyncClient(limits=limits, timeout=12.0) as client:
            for b_idx in range(0, total, batch_size):
                chunk = valid_students[b_idx:b_idx + batch_size]
                tasks = [fetch_leetcode_contest_data(client, s.username, sem) for s in chunk]
                results = await asyncio.gather(*tasks)

                for s, data in zip(chunk, results):
                    if not data:
                        continue

                    cr = data.get("userContestRanking") or {}
                    hist = data.get("userContestRankingHistory") or []
                    matched = data.get("matchedUser") or {}
                    ac_subs = (matched.get("submitStatsGlobal") or {}).get("acSubmissionNum") or []

                    official_rating = float(cr.get("rating") or 0.0) if cr.get("rating") else None
                    global_rank = int(cr.get("globalRanking") or 0) if cr.get("globalRanking") else None
                    attended_count = int(cr.get("attendedContestsCount") or 0)

                    # Update Student.stats
                    stats = s.stats
                    if not stats:
                        stats = LeetCodeProfileStats(student_id=s.id)
                        db.add(stats)

                    # Update solved problem metrics if available
                    for ac in ac_subs:
                        diff = (ac.get("difficulty") or "").lower()
                        cnt = int(ac.get("count") or 0)
                        if diff == "all":
                            stats.total_solved = cnt
                        elif diff == "easy":
                            stats.easy_solved = cnt
                        elif diff == "medium":
                            stats.medium_solved = cnt
                        elif diff == "hard":
                            stats.hard_solved = cnt

                    if official_rating and official_rating > 0:
                        stats.contest_rating = round(official_rating, 1)
                        stats.contest_global_ranking = global_rank
                        stats.contest_sync_status = "ok"
                        stats.last_verified_at = datetime.datetime.now(datetime.timezone.utc)
                        updated_ratings += 1
                    else:
                        # Unrated / never attended contests
                        stats.contest_sync_status = "ok"

                    # Update WeeklyPublicResult
                    for session in recent_sessions:
                        import re
                        m = re.search(r"(\d+)", session.contest_id or session.contest_name or "")
                        c_num_str = m.group(1) if m else ""

                        matching_hist = None
                        if c_num_str:
                            for h in hist:
                                h_title = (h.get("contest") or {}).get("title") or ""
                                if c_num_str in h_title:
                                    matching_hist = h
                                    break

                        wpr = db.query(WeeklyPublicResult).filter(
                            WeeklyPublicResult.session_id == session.id,
                            WeeklyPublicResult.student_id == s.id
                        ).first()

                        if wpr:
                            if matching_hist and matching_hist.get("rating"):
                                wpr.contest_rating = round(float(matching_hist["rating"]), 1)
                                if matching_hist.get("ranking"):
                                    wpr.contest_rank = int(matching_hist["ranking"])
                                if matching_hist.get("attended"):
                                    wpr.participation_status = "PUBLIC_ATTENDED"
                            elif official_rating and wpr.participation_status == "PUBLIC_ATTENDED":
                                wpr.contest_rating = round(official_rating, 1)
                                if global_rank:
                                    wpr.contest_rank = global_rank

                db.commit()
                done = min(b_idx + batch_size, total)
                print(f"   ⏳ Processed {done}/{total} students...")

        print("\n🏆 Recalculating College Rank & Department Badges...")
        update_all_rankings_and_badges(db)
        db.commit()

        try:
            cache.clear()
        except Exception:
            pass

        print(f"✅ COMPLETED! Updated real official ratings for {updated_ratings} students.")
        print("="*70 + "\n")

    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(sync_all_student_ratings())
