import sqlite3
conn = sqlite3.connect('data/leetcode_tracker.db')
conn.execute("UPDATE weekly_sessions SET contest_name = 'Weekly Contest 520', contest_id = 'weekly-contest-520', week_number = 520 WHERE contest_id = 'weekly-contest-18' OR contest_name = 'Weekly Contest 18' OR id = 18;")
conn.commit()
print("Updated successfully")
