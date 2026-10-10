"""
sync_all_historical_contest_ratings.py
================================================================================
Synchronizes real LeetCode historical contest ratings, global ranks, and solve
counts from LeetCode GraphQL userContestRankingHistory across all 13 contest sessions
for all enrolled students.
"""

import sys
import os
import re
import asyncio
import httpx
from typing import Dict, Any, List, Optional

# Ensure project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.database import SessionLocal
from backend.models import Student, WeeklySession, WeeklyPublicResult
from backend.cache import cache

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Content-Type": "application/json",
    "Referer": "https://leetcode.com"
}

QUERY = """
query userContestHistory($username: String!) {
  userContestRankingHistory(username: $username) {
    attended
    rating
    ranking
    problemsSolved
    totalProblems
    contest {
      title
      startTime
    }
  }
}
"""

def extract_contest_number(title_or_slug: str) -> Optional[int]:
    if not title_or_slug:
        return None
    m = re.search(r'(?:weekly|biweekly)?[- ]?contest[- ]?(\d+)', str(title_or_slug), re.IGNORECASE)  # type: ignore
    if m:
        return int(m.group(1))
    m2 = re.search(r'(\d+)', str(title_or_slug))  # type: ignore
    if m2:
        return int(m2.group(1))
    return None

async def fetch_history(client: httpx.AsyncClient, username: str, sem: asyncio.Semaphore) -> Optional[List[Dict[str, Any]]]:
    async with sem:
        try:
            resp = await client.post(
                "https://leetcode.com/graphql",
                json={"query": QUERY, "variables": {"username": username}},
                timeout=5.0
            )
            if resp.status_code == 200:
                data = resp.json().get("data") or {}
                return data.get("userContestRankingHistory") or []
        except Exception:
            pass
        return None

async def run_sync():
    db = SessionLocal()
    try:
        sessions = db.query(WeeklySession).all()
        # Map contest_number -> session_id
        session_contest_map: Dict[int, int] = {}
        for s in sessions:
            c_num = extract_contest_number(s.contest_id or s.contest_name or "")  # type: ignore
            if c_num:
                session_contest_map[c_num] = s.id  # type: ignore

        print("=" * 80, flush=True)
        print("MAPPED CONTEST SESSIONS:", flush=True)
        for c_num, s_id in sorted(session_contest_map.items()):
            print(f"  Contest {c_num} -> Session {s_id}", flush=True)
        print("=" * 80, flush=True)

        students = db.query(Student).filter(Student.is_active == True, Student.username.isnot(None)).all()
        target_students = [s for s in students if s.username and len(s.username.strip()) > 1]
        print(f"Total students to sync historical contest history: {len(target_students)}", flush=True)

        sem = asyncio.Semaphore(25)
        limits = httpx.Limits(max_connections=35, max_keepalive_connections=20)

        total_ratings_synced = 0

        async with httpx.AsyncClient(headers=HEADERS, limits=limits) as client:
            batch_size = 50
            for b_idx in range(0, len(target_students), batch_size):
                chunk = target_students[b_idx : b_idx + batch_size]
                tasks = [fetch_history(client, s.username.strip(), sem) for s in chunk]
                results = await asyncio.gather(*tasks)

                for s, hist_list in zip(chunk, results):
                    if not hist_list:
                        continue

                    for h in hist_list:
                        c_title = (h.get("contest") or {}).get("title") or ""
                        c_num = extract_contest_number(c_title)
                        if not c_num or c_num not in session_contest_map:
                            continue

                        s_id = session_contest_map[c_num]
                        rating = h.get("rating")
                        ranking = h.get("ranking")
                        attended = h.get("attended")
                        solved = h.get("problemsSolved") or 0

                        if rating is not None and float(rating) > 0:
                            # Update WeeklyPublicResult
                            wpr = db.query(WeeklyPublicResult).filter(
                                WeeklyPublicResult.session_id == s_id,
                                WeeklyPublicResult.student_id == s.id
                            ).first()

                            if wpr:
                                wpr.contest_rating = float(rating)  # type: ignore
                                if ranking and int(ranking) > 0:
                                    wpr.contest_rank = int(ranking)  # type: ignore
                                if attended or (solved and int(solved) > 0) or (ranking and int(ranking) > 0):
                                    wpr.participation_status = "PUBLIC_ATTENDED"
                                    wpr.fetch_status = "SUCCESS"
                                if solved is not None:
                                    wpr.total_contest_solved = int(solved)  # type: ignore
                                total_ratings_synced += 1

                try:
                    db.commit()
                except Exception as ex:
                    db.rollback()
                    print(f"Batch commit warning: {ex}")
                processed = min(b_idx + batch_size, len(target_students))
                print(f"Progress: [{processed}/{len(target_students)}] processed | {total_ratings_synced} ratings synced.", flush=True)

        print("\n" + "=" * 80, flush=True)
        print(f"HISTORICAL CONTEST RATING SYNC COMPLETE: {total_ratings_synced} ratings updated across all sessions.", flush=True)
        print("=" * 80, flush=True)

        cache.invalidate_tag("contests")
        cache.invalidate_tag("reports")
        print("Caches invalidated successfully.", flush=True)

    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(run_sync())
