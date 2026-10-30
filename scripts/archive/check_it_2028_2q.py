import sqlite3

db_path = "data/leetcode_tracker.db"
conn = sqlite3.connect(db_path)
c = conn.cursor()

c.execute("""
SELECT s.id, s.reg_no, s.name, wpr.total_contest_solved
FROM weekly_public_results wpr
JOIN students s ON wpr.student_id = s.id
WHERE wpr.session_id = 17 AND s.batch = '2024-2028' AND s.department_id = 4 AND wpr.total_contest_solved = 2
""")
rows = c.fetchall()
print(f"Total 2Q solvers in 2024-2028: {len(rows)}")
for r in rows:
    print(r)

conn.close()
