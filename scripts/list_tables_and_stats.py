import sqlite3

db_path = "data/leetcode_tracker.db"
conn = sqlite3.connect(db_path)
c = conn.cursor()

c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = [r[0] for r in c.fetchall()]

print("ALL TABLES IN DATABASE:")
for t in tables:
    c.execute(f"PRAGMA table_info({t})")
    cols = [col[1] for col in c.fetchall()]
    c.execute(f"SELECT COUNT(*) FROM {t}")
    cnt = c.fetchone()[0]
    # Check if table has solve or count or score
    solve_cols = [col for col in cols if any(k in col.lower() for k in ['solve', 'score', 'count', 'stat', 'rating', 'easy', 'medium', 'hard'])]
    if solve_cols:
        print(f"Table: {t:<35} | Rows: {cnt:<6} | Solv/Stat cols: {solve_cols}")
    elif cnt > 0:
        print(f"Table: {t:<35} | Rows: {cnt:<6}")

conn.close()

