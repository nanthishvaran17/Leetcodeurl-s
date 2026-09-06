import sqlite3
conn = sqlite3.connect('data/backups/leetcode_tracker_migration_backup.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()
cur.execute("SELECT username, email, hashed_password, role FROM users WHERE role != 'Student' and role != 'student'")
for r in cur.fetchall():
    print(dict(r))
