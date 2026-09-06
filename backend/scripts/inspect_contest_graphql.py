import asyncio
import httpx
import json

GRAPHQL_URL = 'https://leetcode.com/graphql'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Content-Type': 'application/json',
    'Referer': 'https://leetcode.com'
}

QUERY = """
query userContestAndSubs($username: String!) {
  matchedUser(username: $username) {
    username
    profile {
      ranking
      realName
    }
    submitStatsGlobal {
      acSubmissionNum {
        difficulty
        count
      }
    }
  }
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
    rating
    ranking
    trendDirection
    finishTimeInSeconds
    contest {
      title
      startTime
    }
  }
  recentAcSubmissionList(username: $username, limit: 50) {
    id
    title
    titleSlug
    timestamp
  }
}
"""

async def inspect_students():
    usernames = ['hamsha07', 'Spidy_42', 'Sakthisaravanan666', 'Magudapathi2007', 'KIRUTHIKAA_05', 'Sharmila___07', 'Poomitha_23', 'Jananii_26', 'Jiyasowmiya', 'Keertheesh', 'Prabha_1503', 'vignesh_2397', 'poomitha_236']
    async with httpx.AsyncClient(headers=HEADERS, timeout=12.0) as client:
        for u in usernames:
            try:
                resp = await client.post(GRAPHQL_URL, json={'query': QUERY, 'variables': {'username': u}})
                if resp.status_code == 200:
                    data = resp.json().get('data', {})
                    matched = data.get('matchedUser')
                    if not matched:
                        print(f'[{u}] -> matchedUser is NULL (Profile 404)')
                        continue
                    history = data.get('userContestRankingHistory') or []
                    recent_c = [h for h in history if '51' in str(h.get('contest', {}).get('title', '')) or 'Weekly' in str(h.get('contest', {}).get('title', ''))]
                    subs = data.get('recentAcSubmissionList') or []
                    att_count = data.get("userContestRanking", {}).get("attendedContestsCount") if data.get("userContestRanking") else 0
                    print(f'[{u}] -> Exists! AttendedCount={att_count}, TotalContestHistory={len(history)}, RecentSubs={len(subs)}')
                    if recent_c:
                        for rc in recent_c[-5:]:
                            print(f'   Contest: {rc.get("contest", {}).get("title")}, attended={rc.get("attended")}, solved={rc.get("problemsSolved")}, rank={rc.get("ranking")}')
                    if subs:
                        print(f'   Latest sub: {subs[0].get("title")} at ts={subs[0].get("timestamp")}')
                else:
                    print(f'[{u}] -> HTTP {resp.status_code}')
            except Exception as e:
                print(f'[{u}] -> Exception: {e}')

if __name__ == '__main__':
    asyncio.run(inspect_students())
