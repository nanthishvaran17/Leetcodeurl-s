import sqlite3

conn = sqlite3.connect('data/leetcode_tracker.db')
c = conn.cursor()
c.execute("SELECT reg_no, name, is_active, username FROM students WHERE (reg_no LIKE '%ITL%' OR reg_no LIKE '%CCL%' OR reg_no LIKE '%CIL%')")
rows = c.fetchall()
print(f"Total Lateral entry students: {len(rows)}")
for r in rows:
    print(r)
conn.close()

