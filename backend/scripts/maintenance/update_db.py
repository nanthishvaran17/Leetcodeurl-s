import os
import sys
import sqlite3

# Set root
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, root_dir)

from backend.leetcode_fetcher import extract_leetcode_username

db_path = os.path.join(root_dir, 'data', 'leetcode_tracker.db')
conn = sqlite3.connect(db_path)
c = conn.cursor()

# 1. Update 732224CC024
c.execute("UPDATE students SET leetcode_url='https://leetcode.com/u/MADAN_2007/', username='MADAN_2007' WHERE reg_no='732224CC024'")

# 2. Update 732224CI001
c.execute("UPDATE students SET leetcode_url='https://leetcode.com/u/Aadhish_sb/', username='Aadhish_sb' WHERE reg_no='732224CI001'")

# 3. Update 732224CI028
c.execute("UPDATE students SET leetcode_url='https://leetcode.com/u/Aesath_2028/', username='Aesath_2028' WHERE reg_no='732224CI028'")

# 4. Mark 732224CI042 as inactive (Discontinued)
c.execute("UPDATE students SET is_active=0 WHERE reg_no='732224CI042'")

# 5. Clean up usernames for all valid urls
c.execute("SELECT id, leetcode_url FROM students WHERE leetcode_url IS NOT NULL AND leetcode_url != ''")
for sid, url in c.fetchall():
    u, std_url, status = extract_leetcode_username(url)
    if status == "OK" and u:
        c.execute("UPDATE students SET username=?, leetcode_url=? WHERE id=?", (u, std_url, sid))
    else:
        c.execute("UPDATE students SET username=NULL WHERE id=?", (sid,))

conn.commit()
print("Database student records updated successfully!")
conn.close()
