import sqlite3

db_path = "data/leetcode_tracker.db"
conn = sqlite3.connect(db_path)
c = conn.cursor()

c.execute("SELECT id, contest_name, session_date, status, pipeline_state FROM weekly_sessions WHERE id IN (17, 18, 19)")
for r in c.fetchall():
    print(r)

c.execute("SELECT count(*), max(total_contest_solved), sum(total_contest_solved) FROM weekly_public_results WHERE session_id = 18")
print("Session 18 weekly_public_results:", c.fetchone())

c.execute("SELECT count(*), max(total_contest_solved), sum(total_contest_solved) FROM weekly_public_results WHERE session_id = 17")
print("Session 17 weekly_public_results:", c.fetchone())

c.execute("SELECT student_id, total_contest_solved, participation_status, contest_score FROM weekly_public_results WHERE session_id = 18 AND total_contest_solved > 0 LIMIT 5")
print("Session 18 solvers:", c.fetchall())

c.execute("SELECT participation_status, count(*) FROM weekly_public_results WHERE session_id = 18 GROUP BY participation_status")
print("Session 18 participation_status breakdown:", c.fetchall())

conn.close()

