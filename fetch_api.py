import json
import urllib.request

try:
    req = urllib.request.Request('http://127.0.0.1:8000/contests/18/summary')
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        
        # find kiruthikaa
        for row in data.get('leaderboard', []):
            if row.get('student_name', '').upper() == 'KIRUTHIKAA P T':
                print(json.dumps(row, indent=2))
                break
except Exception as e:
    print(e)
