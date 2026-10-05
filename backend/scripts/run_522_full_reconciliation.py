import os
import sys
import asyncio
import httpx

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal
from backend.models import Student, WeeklySession, WeeklyPublicResult

GRAPHQL_URL = "https://leetcode.com/graphql"
QUERY = """
query userContestRankingInfo($username: String!) {
  userContestRankingHistory(username: $username) {
    attended
    problemsSolved
    totalProblems
    finishTimeInSeconds
    contest {
      title
    }
  }
}
"""

async def reconcile_contest_522():
    print("Starting 100% Live Reconciliation for Weekly Contest 522...")
    db = SessionLocal()
    try:
        session = db.query(WeeklySession).filter(WeeklySession.contest_name.like('%522%')).first()
        if not session:
            print("Weekly Contest 522 session not found!")
            return
        
        print(f"Target Session: ID {session.id} ({session.contest_name})")
        students = db.query(Student).filter(Student.is_active == True).all()
        print(f"Loaded {len(students)} active students.")

        sem = asyncio.Semaphore(15)
        attended_count = 0
        
        # Get or create WeeklyPublicResult map for session.id
        existing_results = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == session.id).all()
        res_map = {r.student_id: r for r in existing_results}

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Content-Type": "application/json",
            "Referer": "https://leetcode.com"
        }

        async with httpx.AsyncClient(headers=headers, timeout=12.0) as client:
            async def process_student(s):
                nonlocal attended_count
                if not s.username:
                    return

                async with sem:
                    try:
                        resp = await client.post(
                            GRAPHQL_URL,
                            json={"query": QUERY, "variables": {"username": s.username.strip()}}
                        )
                        
                        r = res_map.get(s.id)
                        if not r:
                            r = WeeklyPublicResult(
                                session_id=session.id,
                                student_id=s.id,
                                reg_no=s.reg_no,
                                name=s.name,
                                dept=s.department.code if s.department else "CSE",
                                year=s.year_level or "III"
                            )
                            db.add(r)
                            res_map[s.id] = r

                        if resp.status_code == 200:
                            data = resp.json().get("data", {})
                            hist = data.get("userContestRankingHistory") or []
                            
                            c522_entry = None
                            for h in hist:
                                title = h.get("contest", {}).get("title") or ""
                                if "522" in title:
                                    c522_entry = h
                                    break
                            
                            if c522_entry and (c522_entry.get("attended") or c522_entry.get("problemsSolved", 0) > 0):
                                solved = c522_entry.get("problemsSolved", 0)
                                r.total_contest_solved = solved
                                r.participation_status = "PUBLIC"
                                r.fetch_status = "SUCCESS"
                                
                                # Estimate Q1-Q4 solved breakdown
                                r.q1 = 1 if solved >= 1 else 0
                                r.q2 = 1 if solved >= 2 else 0
                                r.q3 = 1 if solved >= 3 else 0
                                r.q4 = 1 if solved >= 4 else 0
                                r.contest_score = (r.q1 * 3) + (r.q2 * 4) + (r.q3 * 5) + (r.q4 * 6)
                                
                                attended_count += 1
                                print(f"  [ATTENDED] {s.name} ({s.username}): Solved {solved}/4 in Contest 522")
                            else:
                                r.participation_status = "NOT_ATTENDED"
                                r.fetch_status = "SUCCESS"
                                r.total_contest_solved = 0
                                r.q1 = r.q2 = r.q3 = r.q4 = 0
                                r.contest_score = 0
                        else:
                            r.participation_status = "NOT_ATTENDED"
                            r.fetch_status = "FAILED"
                    except Exception as err:
                        print(f"  [ERROR] {s.name}: {err}")

            await asyncio.gather(*[process_student(s) for s in students])

        db.commit()
        print(f"\nRECONCILIATION COMPLETE FOR WEEKLY CONTEST 522!")
        print(f"Total Attended: {attended_count} / {len(students)}")

        # Print CSE(CS) breakdown
        cs_res = [r for r in res_map.values() if r.dept == "CSE(CS)" and r.participation_status in ("PUBLIC", "ATTENDED")]
        print(f"CSE(CS) Total Attended: {len(cs_res)}")

    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(reconcile_contest_522())
