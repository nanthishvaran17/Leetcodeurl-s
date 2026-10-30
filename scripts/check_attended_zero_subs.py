import sqlite3

db_path = "data/leetcode_tracker.db"
conn = sqlite3.connect(db_path)
c = conn.cursor()

c.execute("""
SELECT s.reg_no, s.name, sl.title_slug, sl.submitted_at
FROM submission_log sl
JOIN students s ON sl.student_id = s.id
WHERE s.reg_no IN ('732225IT002', '732225IT037', '732225IT063', '732225IT076', '732225IT086', '732225ITL07', '732225ITL08')
ORDER BY s.reg_no, sl.submitted_at
""")
rows = c.fetchall()
print(f"Submissions found: {len(rows)}")
for r in rows:
    print(r)

conn.close()

