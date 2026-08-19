import pandas as pd
import requests
import json

def inspect_contests():
    df = pd.read_excel('students.xlsx')
    usernames = [str(u).strip() for u in df['LeetCodeUsername'].dropna() if str(u).strip() and str(u) != 'nan']

    query = """
    query userContestRankingInfo($username: String!) {
      userContestRankingHistory(username: $username) {
        attended
        problemsSolved
        finishTimeInSeconds
        ranking
        contest {
          title
          startTime
        }
      }
    }
    """

    for u in usernames:
        res = requests.post(
            "https://leetcode.com/graphql",
            json={"query": query, "variables": {"username": u}},
            headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
        )
        if res.status_code == 200:
            data = res.json()
            history = data.get("data", {}).get("userContestRankingHistory", []) or []
            if len(history) > 0:
                titles = [c.get("contest", {}).get("title") for c in history if c.get("attended")]
                if titles:
                    print(f"Username '{u}' HAS ATTENDED CONTESTS ({len(titles)}): {titles[:10]}")

if __name__ == "__main__":
    inspect_contests()
