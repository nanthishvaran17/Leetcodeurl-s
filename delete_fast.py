import sqlite3
import os

db_path = r"e:\Leetcode Web\data\leetcode_tracker.db"
if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
    exit(1)

try:
    conn = sqlite3.connect(db_path, timeout=10)
    cursor = conn.cursor()
    
    # Disable foreign keys temporarily for fast delete
    cursor.execute("PRAGMA foreign_keys=OFF;")
    
    print("Deleting students not in CS/IoT...")
    cursor.execute("DELETE FROM students WHERE department_id NOT IN (1, 2);")
    print(f"Deleted {cursor.rowcount} students.")
    
    print("Deleting departments not in CS/IoT...")
    cursor.execute("DELETE FROM departments WHERE id NOT IN (1, 2);")
    print(f"Deleted {cursor.rowcount} departments.")
    
    conn.commit()
    conn.close()
    print("Successfully deleted other departments and students.")
except Exception as e:
    print(f"Error: {e}")
