import sys
import os
import asyncio
import httpx

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from backend.database import SessionLocal
from backend.models import Student, WeeklyPublicResult

HEADERS = {'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json', 'Referer': 'https://leetcode.com'}
QUERY = """
query userContestHistory($username: String!) {
  userContestRankingHistory(username: $username) {
    attended
    rating
    ranking
    problemsSolved
    contest {
      title
      startTime
    }
  }
}
"""

async def check():
    db = SessionLocal()
    students = db.query(Student).filter(Student.username.in_(["nanthishvaran_07", "Spidy_42", "Lash1686"])).all()
    async with httpx.AsyncClient(headers=HEADERS) as client:
        for s in students:
            resp = await client.post('https://leetcode.com/graphql', json={'query': QUERY, 'variables': {'username': s.username}})
            data = resp.json().get('data', {})
            hist = data.get('userContestRankingHistory') or []
            print(f"\n--- {s.name} ({s.username}) ---")
            for h in hist:
                if h.get('attended'):
                    print(f"  {h.get('contest', {}).get('title')} -> Rating: {h.get('rating')}, Rank: {h.get('ranking')}, Solved: {h.get('problemsSolved')}")
    db.close()

if __name__ == "__main__":
    asyncio.run(check())
