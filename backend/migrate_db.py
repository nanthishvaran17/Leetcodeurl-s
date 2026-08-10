import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "..", "data", "leetcode_tracker.db")
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE leetcode_profile_stats ADD COLUMN recent_contest_name VARCHAR(150);")
        print("Added recent_contest_name column.")
    except Exception as e:
        print("Column recent_contest_name might already exist:", e)
        
    try:
        cursor.execute("ALTER TABLE leetcode_profile_stats ADD COLUMN recent_contest_score VARCHAR(20);")
        print("Added recent_contest_score column.")
    except Exception as e:
        print("Column recent_contest_score might already exist:", e)
        
    conn.commit()
    conn.close()
    print("Database migration complete.")
else:
    print("data.db not found.")
