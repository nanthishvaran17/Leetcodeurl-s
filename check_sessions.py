import sqlite3
conn = sqlite3.connect(r"E:\Leetcode Web\data\leetcode_tracker.db")
c = conn.cursor()

# Check all weekly sessions
c.execute("SELECT id, contest_id, contest_name, session_date FROM weekly_sessions ORDER BY id")
sessions = c.fetchall()
print("=== ALL WEEKLY SESSIONS ===")
for s in sessions:
    print(s)

# Check weekly_public_results per session
print("\n=== PUBLIC RESULTS PER SESSION ===")
c.execute("SELECT session_id, participation_status, count(*) FROM weekly_public_results GROUP BY session_id, participation_status ORDER BY session_id")
for r in c.fetchall():
    print(r)

conn.close()
