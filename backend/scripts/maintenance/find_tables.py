import sqlite3
import glob

for f in glob.glob('*.db'):
    try:
        conn = sqlite3.connect(f)
        tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()
        print(f"{f}: {tables}")
    except Exception as e:
        print(f"{f}: {e}")
