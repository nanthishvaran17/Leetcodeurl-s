import sys
import os
import asyncio
import httpx

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from backend.database import SessionLocal
from backend.models import Student, WeeklySession, WeeklyPublicResult

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Content-Type': 'application/json',
    'Referer': 'https://leetcode.com'
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

async def check():
    db = SessionLocal()
    st = db.query(Student).filter(Student.username == 'nanthishvaran_07').first()
    
    async with httpx.AsyncClient(headers=HEADERS, timeout=20.0) as client:
        resp = await client.post('https://leetcode.com/graphql', json={'query': QUERY, 'variables': {'username': 'nanthishvaran_07'}})
        data = resp.json().get('data', {})
        hist = data.get('userContestRankingHistory') or []
        
    print("=" * 125)
    print("LEETCODE OFFICIAL PROFILE vs DATABASE AUDIT (Weekly Contest 510 to 522)")
    print(f"Student: {st.name} ({st.reg_no}) | Handle: @nanthishvaran_07")
    print("=" * 125)
    print(f"{'Contest Title':<20} | {'LC Attended':<11} | {'LC Solved':<9} | {'LC Rating':<10} | {'LC Rank':<8} | {'DB Solved':<9} | {'DB Rating':<10} | {'DB Rank':<8} | {'Status'}")
    print("-" * 125)
    
    lc_map = {}
    for h in hist:
        title = (h.get('contest', {}).get('title') or '').strip()
        lc_map[title] = h

    for c_num in range(510, 523):
        c_title = f"Weekly Contest {c_num}"
        lc_data = lc_map.get(c_title)
        
        sess = db.query(WeeklySession).filter(
            (WeeklySession.week_number == c_num) | 
            (WeeklySession.contest_id == f"weekly-contest-{c_num}") |
            (WeeklySession.contest_name == c_title)
        ).first()
        
        wpr = db.query(WeeklyPublicResult).filter(
            WeeklyPublicResult.session_id == (sess.id if sess else -1),
            WeeklyPublicResult.student_id == st.id
        ).first() if sess else None

        is_lc_att = lc_data.get('attended', False) if lc_data else False
        lc_att_str = "YES" if is_lc_att else "NO"
        lc_sol_str = str(lc_data.get('problemsSolved', 0)) if is_lc_att else "—"
        lc_rat_str = f"{lc_data.get('rating', 0):.1f}" if is_lc_att else "—"
        lc_rnk_str = f"#{lc_data.get('ranking')}" if is_lc_att else "—"
        
        db_sol_str = str(wpr.total_contest_solved) if (wpr and wpr.total_contest_solved is not None and wpr.total_contest_solved > 0) else ("0" if wpr else "—")
        db_rat_str = f"{wpr.contest_rating:.1f}" if (wpr and wpr.contest_rating) else "—"
        db_rnk_str = f"#{wpr.contest_rank}" if (wpr and wpr.contest_rank) else "—"
        
        if not is_lc_att:
            status = "MATCH (Not Attended)" if db_sol_str in ("0", "—") else "SYNC NEEDED"
        else:
            rat_match = abs(float(lc_data.get('rating', 0)) - float(wpr.contest_rating or 0)) < 0.2 if (wpr and wpr.contest_rating) else False
            rnk_match = (lc_data.get('ranking') == wpr.contest_rank) if wpr else False
            sol_match = (lc_data.get('problemsSolved') == wpr.total_contest_solved) if wpr else False
            if rat_match and rnk_match and sol_match:
                status = "EXACT MATCH (100%)"
            elif rat_match and rnk_match:
                status = "RATING & RANK MATCH"
            else:
                status = "MISMATCH"
            
        print(f"{c_title:<20} | {lc_att_str:<11} | {lc_sol_str:<9} | {lc_rat_str:<10} | {lc_rnk_str:<8} | {db_sol_str:<9} | {db_rat_str:<10} | {db_rnk_str:<8} | {status}")
        
    print("=" * 125)
    db.close()

if __name__ == "__main__":
    asyncio.run(check())
