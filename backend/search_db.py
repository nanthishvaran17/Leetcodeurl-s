import sqlite3

conn = sqlite3.connect('data/leetcode_tracker.db')
cursor = conn.cursor()
tables = cursor.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()
found = False

for table in tables:
    t = table[0]
    rows = cursor.execute(f"PRAGMA table_info({t})").fetchall()
    for col in rows:
        c = col[1]
        try:
            res = cursor.execute(f"SELECT count(*) FROM {t} WHERE CAST({c} AS TEXT) LIKE '%Ajay_a1277%'").fetchone()
            if res and res[0] > 0:
                print(f"Found in {t}.{c}")
                found = True
        except Exception as e:
            pass

print("Done" if found else "Not found in any table")
