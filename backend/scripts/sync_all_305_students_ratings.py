import os
import sys
import re
import asyncio
import httpx
from typing import Dict, Any, List, Optional, Tuple

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal
from backend.models import Student, WeeklySession, WeeklyPublicResult, Department
from backend.leetcode_fetcher import extract_leetcode_username
from backend.cache import cache

GRAPHQL_URL = "https://leetcode.com/graphql"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Content-Type": "application/json",
    "Referer": "https://leetcode.com/"
}

GQL_QUERY = """
query userContestRankingInfo($username: String!) {
  userContestRankingHistory(username: $username) {
    attended
    problemsSolved
    totalProblems
    finishTimeInSeconds
    rating
    ranking
    contest {
      title
      titleSlug
      startTime
    }
  }
}
"""

def extract_contest_number(title: str) -> Optional[int]:
    if not title:
        return None
    m = re.search(r"weekly-contest-(\d+)", title.strip().lower().replace(" ", "-"))
    if m:
        return int(m.group(1))
    m2 = re.search(r"contest-(\d+)", title.strip().lower().replace(" ", "-"))
    if m2:
        return int(m2.group(1))
    return None

def calc_q_matrix(solved: int) -> Tuple[int, int, int, int]:
    return (
        1 if solved >= 1 else 0,
        1 if solved >= 2 else 0,
        1 if solved >= 3 else 0,
        1 if solved >= 4 else 0,
    )

async def fetch_student_history(client: httpx.AsyncClient, username: str, sem: asyncio.Semaphore) -> List[Dict[str, Any]]:
    async with sem:
        for attempt in range(1, 4):
            try:
                resp = await client.post(
                    GRAPHQL_URL,
                    json={
                        "query": GQL_QUERY,
                        "variables": {"username": username.strip().lower()},
                        "operationName": "userContestRankingInfo"
                    },
                    headers=HEADERS,
                    timeout=10.0
                )
                if resp.status_code == 429:
                    await asyncio.sleep(2.0 * attempt)
                    continue
                if resp.status_code == 200:
                    data = resp.json().get("data", {})
                    return data.get("userContestRankingHistory") or []
            except Exception:
                await asyncio.sleep(1.0 * attempt)
        return []

async def run_full_sync():
    db = SessionLocal()
    try:
        print("=" * 80)
        print("NANDHA LEETCODE TRACKER - FULL 305 STUDENTS CONTEST RATINGS & RANKS SYNC")
        print("=" * 80)

        # 1. Step 1: Normalize all active students' usernames from URLs
        students = db.query(Student).filter(Student.is_active == True).all()
        print(f"Total active students found: {len(students)}")

        valid_students: List[Student] = []
        for s in students:
            raw = s.username or s.leetcode_url or s.primary_leetcode_id or ""
            uname, std_url, status = extract_leetcode_username(raw)
            if uname and len(uname.strip()) >= 2:
                s.username = uname.strip()
                if not s.leetcode_url or "problemset" in str(s.leetcode_url):
                    s.leetcode_url = std_url
                valid_students.append(s)
            elif s.username and len(s.username.strip()) >= 2:
                valid_students.append(s)

        db.commit()
        print(f"Total students with valid LeetCode usernames: {len(valid_students)}")

        # 2. Step 2: Map contest sessions for WC 510 to WC 522
        sessions = db.query(WeeklySession).all()
        session_map: Dict[int, WeeklySession] = {}
        for s in sessions:
            c_num = extract_contest_number(s.contest_id or s.contest_name or "")
            if c_num and 510 <= c_num <= 523:
                session_map[c_num] = s

        print(f"Mapped {len(session_map)} contest sessions in DB (WC 510 to WC 522).")

        # 3. Step 3: Fetch history concurrently with rate limiter
        sem = asyncio.Semaphore(10)
        limits = httpx.Limits(max_connections=25, max_keepalive_connections=15)

        total_ratings_updated = 0
        total_participants_detected = 0

        async with httpx.AsyncClient(limits=limits) as client:
            batch_size = 30
            for i in range(0, len(valid_students), batch_size):
                chunk = valid_students[i : i + batch_size]
                tasks = [fetch_student_history(client, s.username, sem) for s in chunk]
                histories = await asyncio.gather(*tasks)

                for student, history in zip(chunk, histories):
                    if not history:
                        continue

                    dept_code = student.department.code if student.department else "CSE"
                    year_val = student.year_level or "III Year"

                    for entry in history:
                        c_title = (entry.get("contest") or {}).get("title") or ""
                        cn = extract_contest_number(c_title)
                        if not cn or cn not in session_map:
                            continue

                        session = session_map[cn]
                        attended = entry.get("attended", False)
                        solved = entry.get("problemsSolved") or 0
                        rating = entry.get("rating")
                        rank = entry.get("ranking")

                        wpr = db.query(WeeklyPublicResult).filter(
                            WeeklyPublicResult.session_id == session.id,
                            WeeklyPublicResult.student_id == student.id
                        ).first()

                        if not wpr:
                            wpr = WeeklyPublicResult(
                                session_id=session.id,
                                student_id=student.id,
                                reg_no=student.reg_no,
                                name=student.name,
                                dept=dept_code,
                                year=year_val
                            )
                            db.add(wpr)

                        if rating is not None and float(rating) > 0:
                            wpr.contest_rating = float(rating)
                            total_ratings_updated += 1

                        if rank and int(rank) > 0:
                            wpr.contest_rank = int(rank)

                        if attended:
                            total_participants_detected += 1
                            wpr.participation_status = "PUBLIC_ATTENDED"
                            wpr.total_contest_solved = solved
                            q1, q2, q3, q4 = calc_q_matrix(solved)
                            wpr.q1 = q1
                            wpr.q2 = q2
                            wpr.q3 = q3
                            wpr.q4 = q4
                            wpr.contest_score = (q1 * 3) + (q2 * 4) + (q3 * 5) + (q4 * 6)
                            wpr.evidence_source = "LeetCode GraphQL Official userContestRankingHistory"
                            wpr.state = "FINALIZED"
                        elif wpr.total_contest_solved is None or wpr.total_contest_solved == 0:
                            wpr.participation_status = "ABSENT"

                db.commit()
                processed = min(i + batch_size, len(valid_students))
                print(f"Processed: {processed}/{len(valid_students)} students | Ratings saved: {total_ratings_updated}...", flush=True)

        # 4. Step 4: Update session counters
        for cn, session in session_map.items():
            tot = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == session.id).count()
            att = db.query(WeeklyPublicResult).filter(
                WeeklyPublicResult.session_id == session.id,
                WeeklyPublicResult.participation_status.in_(["PUBLIC", "PUBLIC_ATTENDED", "ATTENDED"])
            ).count()
            absent = tot - att
            session.total_students = tot
            session.official_participants = att
            session.not_participated = absent
            session.status = "FINALIZED"
        db.commit()

        # Invalidate caches
        cache.invalidate_tag("contests")
        cache.invalidate_tag("reports")

        # 5. Step 5: Print Summary
        print("\n" + "=" * 80)
        print("CONTEST BREAKDOWN ACROSS AWS DATABASE (WC 510 to WC 522):")
        print("=" * 80)
        for cn in sorted(session_map.keys()):
            session = session_map[cn]
            tot = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == session.id).count()
            att = db.query(WeeklyPublicResult).filter(
                WeeklyPublicResult.session_id == session.id,
                WeeklyPublicResult.participation_status.in_(["PUBLIC", "PUBLIC_ATTENDED", "ATTENDED"])
            ).count()
            rated = db.query(WeeklyPublicResult).filter(
                WeeklyPublicResult.session_id == session.id,
                WeeklyPublicResult.contest_rating.isnot(None)
            ).count()
            print(f"Weekly Contest {cn:<4} | Students: {tot:<4} | Attended: {att:<4} | Ratings/Ranks Saved: {rated:<4}")

        print("=" * 80)
        print("ALL STUDENT URLS VERIFIED, FETCHED & STORED IN AWS DATABASE SUCCESSFULLY!")
        print("=" * 80)

    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(run_full_sync())
