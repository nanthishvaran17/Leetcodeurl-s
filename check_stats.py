import sqlite3
conn = sqlite3.connect(r"E:\Leetcode Web\leetcode_tracker.db")
c = conn.cursor()
c.execute("SELECT participation_status, count(*) FROM weekly_public_results WHERE session_id=18 GROUP BY participation_status")
for row in c.fetchall():
    print(row)
c.execute("SELECT count(*) FROM weekly_public_results WHERE session_id=18")
print("Total:", c.fetchone()[0])
conn.close()
