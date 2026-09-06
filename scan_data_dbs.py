import sqlite3
import glob

print("Scanning ALL databases in data/ for mohammed.affan.ja...")
for db_file in glob.glob('data/*.db'):
    try:
        conn = sqlite3.connect(db_file)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        
        # Check users table
        try:
            cur.execute("SELECT * FROM users WHERE username LIKE '%mohammed.affan.ja%' OR email LIKE '%mohammed.affan.ja%'")
            users = cur.fetchall()
            if users:
                print(f"\nFound in {db_file} (users table):")
                for u in users: print(dict(u))
        except: pass
            
        # Check students table
        try:
            cur.execute("SELECT * FROM students WHERE username LIKE '%mohammed.affan.ja%' OR email LIKE '%mohammed.affan.ja%'")
            students = cur.fetchall()
            if students:
                print(f"\nFound in {db_file} (students table):")
                for s in students: print(dict(s))
        except: pass
            
        conn.close()
    except Exception as e:
        print(f"Error reading {db_file}: {e}")
