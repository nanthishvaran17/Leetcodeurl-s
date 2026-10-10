import httpx

resp = httpx.post(
    "https://leetcode.com/graphql",
    json={
        "query": """query userContestRankingInfo($username: String!) {
            userContestRankingHistory(username: $username) {
                attended
                problemsSolved
                contest { title titleSlug startTime }
            }
        }""",
        "variables": {"username": "nanthishvaran_07"}
    },
    headers={"User-Agent": "Mozilla/5.0", "Content-Type": "application/json", "Referer": "https://leetcode.com/"},
    timeout=10.0
)
data = resp.json().get("data", {}).get("userContestRankingHistory", [])
for x in data:
    st = x["contest"]["startTime"]
    if 1786000000 <= st <= 1789000000:
        print(f"Title: {x['contest']['title']} | Slug: {x['contest']['titleSlug']} | StartTime: {st} | Attended: {x['attended']}")
