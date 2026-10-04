import sqlite3
import json

conn = sqlite3.connect('e:/Leetcode Web/backend/database.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# Find tables related to contest or students
cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [r[0] for r in cur.fetchall()]
print("Tables:", tables)

for t in tables:
    if 'contest' in t.lower() or 'student' in t.lower() or 'session' in t.lower():
        print(f"\\n--- Table {t} ---")
        cur.execute(f"PRAGMA table_info({t});")
        print("Columns:", [c['name'] for c in cur.fetchall()])
        try:
            cur.execute(f"SELECT * FROM {t} LIMIT 1")
            row = cur.fetchone()
            if row:
                print("Sample Row:", dict(row))
        except Exception as e:
            print("Error:", e)
