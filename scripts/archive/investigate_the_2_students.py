import sqlite3
import json

db_path = "data/leetcode_tracker.db"
conn = sqlite3.connect(db_path)
c = conn.cursor()

# All IT-2029 students in DB
c.execute("SELECT id, reg_no, name, username FROM students WHERE reg_no LIKE '732225IT%' ORDER BY reg_no")
it_students = c.fetchall()

with open('data/contest_524_authentic_scanned_solvers.json', 'r', encoding='utf-8') as f:
    scanned = json.load(f)

# Find students who are in IT-2029 who have 1Q or 0Q in our system, but had submissions on contest day
print(f"Total IT-2029 in DB: {len(it_students)}")

# Let's inspect submission_log for any IT-2029 student who submitted problems on that day
c.execute("""
SELECT s.reg_no, s.name, s.username, count(sl.id) as sub_count
FROM submission_log sl
JOIN students s ON sl.student_id = s.id
WHERE s.reg_no LIKE '732225IT%'
GROUP BY s.id
HAVING sub_count > 0
ORDER BY s.reg_no
""")
rows = c.fetchall()
print(f"IT-2029 students with submission logs: {len(rows)}")

conn.close()

