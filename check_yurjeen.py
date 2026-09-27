import urllib.request, json
query = """
query {
  userContestRankingHistory(username: "4Nfn0FHIyV") {
    attendedContestsCount
    trendDirection
    history {
      contest {
        titleSlug
      }
      problemsSolved
      totalProblems
      finishTimeInSeconds
      rating
      ranking
    }
  }
}
"""
req = urllib.request.Request(
    'https://leetcode.com/graphql', 
    data=json.dumps({'query': query}).encode('utf-8'), 
    headers={'Content-Type': 'application/json'}
)
res = urllib.request.urlopen(req)
data = json.loads(res.read())
history = data['data']['userContestRankingHistory']
if history:
    for h in history['history']:
        if h['contest']['titleSlug'] == 'weekly-contest-521':
            print("Contest 521 data:", h)
            break
    else:
        print("Did not attend contest 521 according to history.")
else:
    print("No history found.")
