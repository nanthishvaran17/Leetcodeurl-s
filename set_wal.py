import sqlite3
import os
import time

db_path = os.path.join(os.getcwd(), 'data', 'leetcode_tracker.db')
print("Connecting to:", db_path)

for attempt in range(5):
    try:
        conn = sqlite3.connect(db_path, timeout=30.0)
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA busy_timeout=60000;")
        conn.execute("PRAGMA wal_checkpoint(TRUNCATE);")
        res = conn.execute("PRAGMA journal_mode;").fetchall()
        print("Journal Mode is now:", res)
        conn.close()
        print("Successfully set WAL!")
        break
    except Exception as e:
        print(f"Attempt {attempt+1} failed: {e}")
        time.sleep(2)
