import sqlite3

db_path = "data/leetcode_tracker.db"
conn = sqlite3.connect(db_path)
c = conn.cursor()

# Find SUNDARAMURUGAN S and ABISHEK S in students table
c.execute("SELECT id, reg_no, name FROM students WHERE reg_no IN ('732225ITL08', '732225IT002')")
matched = c.fetchall()
print("Matched students:", matched)

# Check their records in weekly_public_results for session 17
for st in matched:
    c.execute("SELECT id, total_contest_solved, participation_status, contest_score FROM weekly_public_results WHERE session_id = 17 AND student_id = ?", (st[0],))
    print(f"Session 17 record for {st[1]}:", c.fetchone())

conn.close()
