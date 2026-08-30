"""
Post-contest finalization script for Weekly Contest 517.
Fetches official ranks/ratings from LeetCode for the 5 PUBLIC participants
and updates the database records.
"""
import requests
import json
import time
from backend.database import SessionLocal
from backend.models import WeeklyPublicResult, Student

db = SessionLocal()

public_res = db.query(WeeklyPublicResult).filter(
    WeeklyPublicResult.session_id == 2,
    WeeklyPublicResult.participation_status == 'PUBLIC'
).all()

contest_slug = 'weekly-contest-517'
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Referer': f'https://leetcode.com/contest/{contest_slug}/',
}

print(f"Fetching official contest ranking data for {len(public_res)} public participants...")
print("=" * 60)

for r in public_res:
    student = db.query(Student).filter(Student.id == r.student_id).first()
    username = student.username if student else None
    if not username:
        print(f"SKIP {r.name}: No username")
        continue

    # Try LeetCode userContestRanking via GraphQL
    gql_url = 'https://leetcode.com/graphql'
    query = {
        "query": """
        query userContestRankingInfo($username: String!) {
          userContestRanking(username: $username) {
            attendedContestsCount
            rating
            globalRanking
            totalParticipants
            topPercentage
            badge { name }
          }
          userContestRankingHistory(username: $username) {
            attended
            trendDirection
            problemsSolved
            totalProblems
            finishTimeInSeconds
            rating
            ranking
            contest { title startTime }
          }
        }
        """,
        "variables": {"username": username}
    }

    try:
        resp = requests.post(gql_url, json=query, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json().get('data', {})
            history = data.get('userContestRankingHistory', [])
            # Find Weekly Contest 517 in history
            contest_entry = None
            for entry in (history or []):
                contest = entry.get('contest', {})
                if '517' in contest.get('title', ''):
                    contest_entry = entry
                    break

            if contest_entry:
                rank = contest_entry.get('ranking')
                problems_solved = contest_entry.get('problemsSolved')
                finish_time = contest_entry.get('finishTimeInSeconds')
                rating_change = contest_entry.get('rating')
                attended = contest_entry.get('attended')
                print(f"FOUND {r.name} ({username}): rank={rank}, solved={problems_solved}, finish={finish_time}s, rating={rating_change}, attended={attended}")

                if rank and attended:
                    r.contest_rank = rank
                    if rating_change:
                        r.contest_rating = rating_change
                    db.commit()
                    print(f"  -> Updated rank={rank} in DB")
                else:
                    print(f"  -> No valid rank found for this contest")
            else:
                print(f"NOTFOUND {r.name} ({username}): Weekly Contest 517 not in history (checked {len(history or [])} entries)")
                # Show last few entries for debugging
                for e in (history or [])[-3:]:
                    c = e.get('contest', {})
                    print(f"   Last contest: {c.get('title')} rank={e.get('ranking')}")
        else:
            print(f"FAILED {r.name} ({username}): HTTP {resp.status_code}")

    except Exception as ex:
        print(f"ERROR {r.name} ({username}): {ex}")

    time.sleep(1)

print("\nDone! Final state:")
db.expire_all()
for r in db.query(WeeklyPublicResult).filter(
    WeeklyPublicResult.session_id == 2,
    WeeklyPublicResult.participation_status == 'PUBLIC'
).all():
    print(f"  {r.name}: rank={r.contest_rank}, rating={r.contest_rating}, solved={r.total_contest_solved}")

db.close()
