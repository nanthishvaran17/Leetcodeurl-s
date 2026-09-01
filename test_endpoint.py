import sqlite3
import json
import urllib.request

req = urllib.request.Request('http://127.0.0.1:8000/api/students/leaderboard-fast')
try:
    response = urllib.request.urlopen(req)
    data = json.loads(response.read())
    print("Leaderboard fast count:", len(data))
except Exception as e:
    print("Error:", e)
