import urllib.request
import json
import time

query = """
query userContestAndSubs($u: String!) {
  matchedUser(username: $u) {
    username
  }
  userContestRankingHistory(username: $u) {
    attended
    problemsSolved
    contest {
      title
    }
  }
  recentAcSubmissionList(username: $u, limit: 15) {
    id
    title
    timestamp
  }
}
""".replace("$u", "$username")

handles = ["Spidy_42", "sakthi0407", "DeepaksriramK", "Magudapathi26", "KIRUTHIKAA_05"]
for h in handles:
    req = urllib.request.Request(
        "https://leetcode.com/graphql",
        data=json.dumps({"query": query, "variables": {"username": h}}).encode("utf-8"),
        headers={"User-Agent": "Mozilla/5.0", "Content-Type": "application/json", "Referer": "https://leetcode.com"}
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            data = json.loads(res.read().decode("utf-8"))
            user_data = data.get("data", {})
            matched = user_data.get("matchedUser")
            subs = user_data.get("recentAcSubmissionList", [])
            print(f"Handle {h}: Matched={matched is not None}, Recent AC Subs Count={len(subs)}")
            if subs:
                for s in subs[:2]:
                    ts = int(s.get("timestamp", 0))
                    print(f"  Sub: {s.get('title')} at {time.ctime(ts)} (ts={ts})")
    except Exception as e:
        print(f"Handle {h} Error: {e}")
