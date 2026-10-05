import os
import sys
import asyncio
import httpx

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal
from backend.models import Student, WeeklySession, WeeklyPublicResult, LeetCodeProfileStats

GRAPHQL_URL = "https://leetcode.com/graphql"
QUERY = """
query userContestRankingInfo($username: String!) {
  userContestRanking(username: $username) {
    attendedContestsCount
    rating
    globalRanking
    topPercentage
  }
  userContestRankingHistory(username: $username) {
    attended
    trendDirection
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

async def full_live_sync_all_contests():
    print("Starting 100% Live Sync for all active students (WC 522 & Profile Stats)...")
    db = SessionLocal()
    try:
        session_522 = db.query(WeeklySession).filter(WeeklySession.contest_name.like('%522%')).first()
        if not session_522:
            session_522 = db.query(WeeklySession).filter(WeeklySession.id == 13).first()
        
        session_518 = db.query(WeeklySession).filter(WeeklySession.contest_name.like('%518%')).first()

        print(f"Target Session 522: ID {session_522.id if session_522 else 'None'}")
        print(f"Target Session 518: ID {session_518.id if session_518 else 'None'}")

        students = db.query(Student).filter(Student.is_active == True).all()
        print(f"Loaded {len(students)} active students.")

        wpr_522_map = {}
        if session_522:
            existing_522 = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == session_522.id).all()
            wpr_522_map = {r.student_id: r for r in existing_522}

        wpr_518_map = {}
        if session_518:
            existing_518 = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == session_518.id).all()
            wpr_518_map = {r.student_id: r for r in existing_518}

        stats_map = {s.id: s.stats for s in students if s.stats}

        sem = asyncio.Semaphore(15)
        updated_count = 0

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Content-Type": "application/json",
            "Referer": "https://leetcode.com"
        }

        async with httpx.AsyncClient(headers=headers, timeout=12.0) as client:
            async def process_student(s):
                nonlocal updated_count
                if not s.username or len(s.username.strip()) < 2:
                    return

                username = s.username.strip()
                async with sem:
                    try:
                        resp = await client.post(
                            GRAPHQL_URL,
                            json={"query": QUERY, "variables": {"username": username}}
                        )
                        if resp.status_code == 200:
                            data = resp.json().get("data", {})
                            overall = data.get("userContestRanking")
                            hist = data.get("userContestRankingHistory") or []

                            # Update LeetCodeProfileStats
                            st_stat = stats_map.get(s.id)
                            if not st_stat:
                                st_stat = LeetCodeProfileStats(student_id=s.id)
                                db.add(st_stat)
                                stats_map[s.id] = st_stat

                            if overall:
                                g_rank = overall.get("globalRanking")
                                c_rating = overall.get("rating")
                                if g_rank and g_rank > 0:
                                    st_stat.contest_global_ranking = g_rank
                                if c_rating and c_rating > 0:
                                    st_stat.contest_rating = c_rating

                            # Process Contest 522 history entry
                            c522_entry = None
                            c518_entry = None
                            for h in hist:
                                title = h.get("contest", {}).get("title") or ""
                                if "522" in title:
                                    c522_entry = h
                                if "518" in title:
                                    c518_entry = h

                            # Update WC 522 WeeklyPublicResult
                            if session_522:
                                r522 = wpr_522_map.get(s.id)
                                if not r522:
                                    r522 = WeeklyPublicResult(
                                        session_id=session_522.id,
                                        student_id=s.id,
                                        reg_no=s.reg_no,
                                        name=s.name,
                                        dept=s.department.code if s.department else "CSE",
                                        year=s.year_level or "III"
                                    )
                                    db.add(r522)
                                    wpr_522_map[s.id] = r522

                                if c522_entry and (c522_entry.get("attended") or c522_entry.get("problemsSolved", 0) > 0):
                                    solved = c522_entry.get("problemsSolved", 0)
                                    r522.total_contest_solved = solved
                                    r522.participation_status = "PUBLIC"
                                    r522.fetch_status = "SUCCESS"
                                    r522.q1 = 1 if solved >= 1 else 0
                                    r522.q2 = 1 if solved >= 2 else 0
                                    r522.q3 = 1 if solved >= 3 else 0
                                    r522.q4 = 1 if solved >= 4 else 0
                                    r522.contest_score = (r522.q1 * 3) + (r522.q2 * 4) + (r522.q3 * 5) + (r522.q4 * 6)
                                    
                                    rank = c522_entry.get("ranking")
                                    rating = c522_entry.get("rating")
                                    if rank and rank > 0:
                                        r522.contest_rank = rank
                                    elif st_stat.contest_global_ranking:
                                        r522.contest_rank = st_stat.contest_global_ranking

                                    if rating and rating > 0:
                                        r522.contest_rating = rating
                                    elif st_stat.contest_rating:
                                        r522.contest_rating = st_stat.contest_rating

                            # Update WC 518 WeeklyPublicResult
                            if session_518 and c518_entry:
                                r518 = wpr_518_map.get(s.id)
                                if not r518:
                                    r518 = WeeklyPublicResult(
                                        session_id=session_518.id,
                                        student_id=s.id,
                                        reg_no=s.reg_no,
                                        name=s.name,
                                        dept=s.department.code if s.department else "CSE",
                                        year=s.year_level or "III"
                                    )
                                    db.add(r518)
                                    wpr_518_map[s.id] = r518

                                if c518_entry.get("attended") or c518_entry.get("problemsSolved", 0) > 0:
                                    solved = c518_entry.get("problemsSolved", 0)
                                    r518.total_contest_solved = solved
                                    r518.participation_status = "PUBLIC"
                                    r518.fetch_status = "SUCCESS"
                                    r518.q1 = 1 if solved >= 1 else 0
                                    r518.q2 = 1 if solved >= 2 else 0
                                    r518.q3 = 1 if solved >= 3 else 0
                                    r518.q4 = 1 if solved >= 4 else 0
                                    r518.contest_score = (r518.q1 * 3) + (r518.q2 * 4) + (r518.q3 * 5) + (r518.q4 * 6)
                                    
                                    rank = c518_entry.get("ranking")
                                    rating = c518_entry.get("rating")
                                    if rank and rank > 0:
                                        r518.contest_rank = rank
                                    if rating and rating > 0:
                                        r518.contest_rating = rating

                            updated_count += 1
                            if updated_count % 10 == 0:
                                print(f"Synced {updated_count}/{len(students)} students...")
                    except Exception as err:
                        print(f"Error for {username}: {err}")

            await asyncio.gather(*[process_student(s) for s in students])

        db.commit()
        print(f"\n100% LIVE SYNC COMPLETED SUCCESSFULLY FOR {updated_count} STUDENTS!")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(full_live_sync_all_contests())
