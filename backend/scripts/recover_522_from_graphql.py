import asyncio
import httpx
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend.models import WeeklyPublicResult, Student

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Content-Type': 'application/json',
    'Referer': 'https://leetcode.com'
}

QUERY = """
query userContestAndSubs($username: String!) {
  userContestRankingHistory(username: $username) {
    attended
    problemsSolved
    contest {
      title
    }
  }
  recentAcSubmissionList(username: $username, limit: 30) {
    titleSlug
  }
}
"""

SLUGS = {
    "q1": "find-the-largest-almost-missing-integer",
    "q2": "check-if-two-chessboard-squares-have-the-same-color",
    "q3": "minimum-time-to-break-locks-i",
    "q4": "minimum-time-to-break-locks-ii"
}

async def recover():
    db = SessionLocal()
    # Get the 209 attendees + 69 not attended, maybe just everyone who has a username
    results = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == 20).all()
    
    async with httpx.AsyncClient(headers=HEADERS, timeout=10.0) as client:
        for r in results:
            if not r.student_id: continue
            st = db.query(Student).get(r.student_id)
            if not st or not st.username: continue
            
            # Rate limit artificially
            await asyncio.sleep(0.3)
            
            resp = await client.post('https://leetcode.com/graphql', json={
                'query': QUERY,
                'variables': {'username': st.username}
            })
            
            if resp.status_code != 200:
                print(f"[{st.username}] HTTP {resp.status_code} - skipping")
                continue
                
            data = resp.json().get('data', {})
            hist = data.get('userContestRankingHistory') or []
            
            contest_data = next((h for h in hist if h.get('contest', {}).get('title') == "Weekly Contest 522"), None)
            
            if not contest_data or not contest_data.get('attended'):
                r.total_contest_solved = 0
                r.q1 = 0
                r.q2 = 0
                r.q3 = 0
                r.q4 = 0
                r.participation_status = "NOT_ATTENDED"
                print(f"[{st.username}] Did not attend. Set to 0.")
                continue
                
            problems_solved = contest_data.get('problemsSolved', 0)
            subs = data.get('recentAcSubmissionList') or []
            slugs_found = {s.get('titleSlug') for s in subs}
            
            q1 = 1 if SLUGS["q1"] in slugs_found else 0
            q2 = 1 if SLUGS["q2"] in slugs_found else 0
            q3 = 1 if SLUGS["q3"] in slugs_found else 0
            q4 = 1 if SLUGS["q4"] in slugs_found else 0
            
            actual_solved = q1 + q2 + q3 + q4
            
            if actual_solved == 0 and problems_solved > 0:
                # If they solved > 0 but it's not in recent 30 (maybe they did a lot of practice after),
                # fallback to sequential but print it. We only do this as a safety net if recentAc is pushed out.
                # Actually, Contest 522 was just held, so they should be in recent 30.
                print(f"[{st.username}] WARNING: problemsSolved={problems_solved} but exact slugs found=0")
                
            r.total_contest_solved = actual_solved if actual_solved > 0 else problems_solved
            r.q1 = q1
            r.q2 = q2
            r.q3 = q3
            r.q4 = q4
            r.participation_status = "PUBLIC" if actual_solved > 0 else "PUBLIC" # or PUBLIC_ATTENDED
            
            print(f"[{st.username}] Updated -> Q:({q1},{q2},{q3},{q4}) Solved: {r.total_contest_solved}")
            db.commit()

    db.close()

if __name__ == "__main__":
    asyncio.run(recover())
