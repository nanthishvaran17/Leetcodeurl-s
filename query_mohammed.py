import sqlite3
conn = sqlite3.connect('data/leetcode_tracker.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()
cur.execute("SELECT * FROM users WHERE username LIKE '%mohammed.affan.ja%' OR email LIKE '%mohammed.affan.ja%'")
print('Users:')
for r in cur.fetchall():
    print(dict(r))

cur.execute("SELECT * FROM students WHERE username LIKE '%mohammed.affan.ja%' OR email LIKE '%mohammed.affan.ja%'")
print('Students:')
for r in cur.fetchall():
    print(dict(r))
