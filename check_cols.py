import sqlite3

conn = sqlite3.connect('e:/Leetcode Web/data/leetcode_tracker.db')
cursor = conn.cursor()

try:
    cursor.execute("PRAGMA table_info(weekly_public_results)")
    columns = [row[1] for row in cursor.fetchall()]
    print("weekly_public_results columns:")
    print(", ".join(columns[-15:]))
    
    cursor.execute("PRAGMA table_info(contest_problem_results)")
    columns = [row[1] for row in cursor.fetchall()]
    print("\ncontest_problem_results columns:")
    print(", ".join(columns[-15:]))
except Exception as e:
    print(e)
finally:
    conn.close()
