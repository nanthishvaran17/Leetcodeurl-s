import sqlite3
import pprint

conn = sqlite3.connect('data/leetcode_tracker.db')
cursor = conn.cursor()
cursor.execute("SELECT id, name, username FROM students WHERE username = 'GAgrm4ykwn' OR id = 1075;")
print("Duplicate Username check:")
pprint.pprint(cursor.fetchall())
