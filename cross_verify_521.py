import urllib.request
import json
import sqlite3
import time

# Contest 521 questions
Q_TITLES = {
    "rearrange-array-by-removing-distinct-values": "q1",
    "maximum-equal-adjacent-pairs-after-at-most-one-replacement": "q2",
    "longest-subarray-with-restricted-pair-sums": "q3",
    "maximize-meeting-earnings-with-idle-gaps": "q4"
}

# Contest window timestamps
# 2026-09-27 08:00 AM IST -> 2026-09-27 09:30 AM IST
CONTEST_START = 1790476200  # 2026-09-27 02:30:00 UTC
CONTEST_END = 1790481600    # 2026-09-27 04:00:00 UTC

query = '''
query recentAcSubmissions($username: String!, $limit: Int!) {
  recentAcSubmissionList(username: $username, limit: $limit) {
    titleSlug
    timestamp
  }
}
'''

def fetch_recent_ac(username):
    req = urllib.request.Request(
        'https://leetcode.com/graphql', 
        data=json.dumps({
            'query': query,
            'variables': {'username': username, 'limit': 50}
        }).encode('utf-8'), 
        headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'}
    )
    try:
        res = urllib.request.urlopen(req, timeout=5)
        data = json.loads(res.read().decode('utf-8'))
        return data.get('data', {}).get('recentAcSubmissionList', [])
    except Exception as e:
        print(f"Failed for {username}: {e}")
        return []

conn = sqlite3.connect('data/leetcode_tracker.db')
cursor = conn.cursor()

cursor.execute("SELECT id, username, reg_no, name FROM students WHERE is_active = 1 AND username IS NOT NULL")
students = cursor.fetchall()

print(f"Cross-verifying {len(students)} students...")

updates = 0
for student_id, username, reg_no, name in students:
    submissions = fetch_recent_ac(username)
    if not submissions:
        time.sleep(0.1)
        continue
        
    solved = {"q1": 0, "q2": 0, "q3": 0, "q4": 0}
    for sub in submissions:
        ts = int(sub['timestamp'])
        slug = sub['titleSlug']
        if CONTEST_START <= ts <= CONTEST_END and slug in Q_TITLES:
            solved[Q_TITLES[slug]] = 1
            
    total_solved = sum(solved.values())
    
    # Check DB
    cursor.execute("SELECT problems_solved FROM previous_week_participation_records WHERE session_id = 19 AND student_id = ?", (student_id,))
    row = cursor.fetchone()
    if row:
        db_solved = row[0]
        if db_solved != total_solved:
            print(f"Mismatch for {name} ({username}): DB={db_solved}, Actual={total_solved}")
            cursor.execute(
                "UPDATE previous_week_participation_records SET problems_solved = ?, q1 = ?, q2 = ?, q3 = ?, q4 = ? WHERE session_id = 19 AND student_id = ?",
                (total_solved, solved['q1'], solved['q2'], solved['q3'], solved['q4'], student_id)
            )
            cursor.execute(
                "UPDATE weekly_public_results SET total_contest_solved = ?, q1 = ?, q2 = ?, q3 = ?, q4 = ? WHERE session_id = 19 AND student_id = ?",
                (total_solved, solved['q1'], solved['q2'], solved['q3'], solved['q4'], student_id)
            )
            updates += 1

conn.commit()
print(f"Verification complete. Fixed {updates} records.")
