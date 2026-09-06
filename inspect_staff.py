import sqlite3
conn = sqlite3.connect('data/leetcode_tracker.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()
cur.execute("SELECT username, email, hashed_password, role, is_active FROM users WHERE role != 'Student' and role != 'student'")
rows = cur.fetchall()
for r in rows:
    print(dict(r))
