import sqlite3
conn = sqlite3.connect('data/backups/baseline_production_verified_20260826_055556.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()
cur.execute("SELECT * FROM users WHERE username LIKE '%mohammed.affan.ja%' OR email LIKE '%mohammed.affan.ja%'")
print('OLD Users:')
for r in cur.fetchall():
    print(dict(r))

cur.execute("SELECT * FROM students WHERE username LIKE '%mohammed.affan.ja%' OR email LIKE '%mohammed.affan.ja%'")
print('OLD Students:')
for r in cur.fetchall():
    print(dict(r))
