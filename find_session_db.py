import sqlite3
import os

for root, dirs, files in os.walk(r"E:\Leetcode Web"):
    for file in files:
        if file.endswith(".db"):
            db_path = os.path.join(root, file)
            try:
                conn = sqlite3.connect(db_path)
                c = conn.cursor()
                c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='weekly_public_results'")
                if c.fetchone():
                    c.execute("SELECT count(*) FROM weekly_public_results WHERE session_id=18")
                    count = c.fetchone()[0]
                    if count > 0:
                        print(f"\n==> FOUND DATA: {db_path}  | session_id=18 rows={count}")
                        c.execute("SELECT participation_status, count(*) FROM weekly_public_results WHERE session_id=18 GROUP BY participation_status")
                        for row in c.fetchall():
                            print("   ", row)
                    else:
                        c.execute("SELECT count(*) FROM weekly_public_results")
                        total = c.fetchone()[0]
                        print(f"   (empty for s18) {db_path} — total rows: {total}")
                conn.close()
            except Exception as e:
                print(f"ERROR: {db_path} — {e}")
