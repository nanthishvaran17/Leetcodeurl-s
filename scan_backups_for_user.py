import sqlite3
import glob

print("Scanning all backups for mohammed.affan.ja...")
for db_file in glob.glob('data/backups/*.db'):
    try:
        conn = sqlite3.connect(db_file)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        
        # Check users table
        cur.execute("SELECT * FROM users WHERE username LIKE '%mohammed.affan.ja%' OR email LIKE '%mohammed.affan.ja%'")
        users = cur.fetchall()
        if users:
            print(f"\nFound in {db_file} (users table):")
            for u in users: print(dict(u))
            
        # Check students table
        cur.execute("SELECT * FROM students WHERE username LIKE '%mohammed.affan.ja%' OR email LIKE '%mohammed.affan.ja%'")
        students = cur.fetchall()
        if students:
            print(f"\nFound in {db_file} (students table):")
            for s in students: print(dict(s))
            
        conn.close()
    except Exception as e:
        print(f"Error reading {db_file}: {e}")

# Check main DB just in case
print("\nScanning main DB...")
conn = sqlite3.connect('data/leetcode_tracker.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()
cur.execute("SELECT * FROM users WHERE username LIKE '%mohammed.affan.ja%' OR email LIKE '%mohammed.affan.ja%'")
users = cur.fetchall()
if users:
    print(f"\nFound in main DB (users table):")
    for u in users: print(dict(u))
    
cur.execute("SELECT * FROM students WHERE username LIKE '%mohammed.affan.ja%' OR email LIKE '%mohammed.affan.ja%'")
students = cur.fetchall()
if students:
    print(f"\nFound in main DB (students table):")
    for s in students: print(dict(s))
    
conn.close()
