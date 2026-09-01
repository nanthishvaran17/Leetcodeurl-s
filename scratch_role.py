import sqlite3
c = sqlite3.connect('data/leetcode_tracker.db').cursor()
c.execute("SELECT COUNT(*) FROM students WHERE is_active=1 OR is_active IS NULL")
print(c.fetchall())
