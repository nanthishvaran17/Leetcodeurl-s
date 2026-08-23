import httpx
import json

resp = httpx.post(
    'https://leetcode.com/graphql',
    json={
        'query': """
        query getContestInfo($titleSlug: String!) {
          contest(titleSlug: $titleSlug) {
            title
            titleSlug
            startTime
            duration
            originStartTime
            isVirtual
          }
        }
        """,
        'variables': {'titleSlug': 'weekly-contest-516'}
    },
    headers={'User-Agent': 'Mozilla/5.0'},
    timeout=10
)
print('Status:', resp.status_code)
print('Data:', json.dumps(resp.json(), indent=2))
