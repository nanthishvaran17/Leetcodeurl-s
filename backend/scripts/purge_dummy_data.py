import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "leetcode_tracker.db")
conn = sqlite3.connect(db_path)
conn.execute("PRAGMA foreign_keys = OFF;")
cursor = conn.cursor()

# Find dummy students
cursor.execute("""
    SELECT id, reg_no, name FROM students WHERE 
    name LIKE 'Student %' OR 
    name LIKE '%Test%' OR 
    reg_no LIKE '%TEST%' OR 
    reg_no LIKE '732223CS0145%' OR 
    reg_no LIKE '732223CS0146%' OR
    id >= 1451
""")
dummy_rows = cursor.fetchall()
dummy_ids = [r[0] for r in dummy_rows]
dummy_regs = [r[1] for r in dummy_rows]

print(f"Found {len(dummy_rows)} dummy students to permanently purge:")
for r in dummy_rows:
    print(f"  ID: {r[0]}, Reg: {r[1]}, Name: {r[2]}")

if dummy_ids:
    placeholders = ",".join("?" * len(dummy_ids))
    
    # Clean up from all tables
    tables_to_clean = [
        ("weekly_public_results", "student_id"),
        ("weekly_virtual_results", "student_id"),
        ("weekly_session_snapshots", "student_id"),
        ("weekly_contest_error_logs", "student_id"),
        ("faculty_student_assignments", "student_id"),
        ("faculty_action_audit_logs", "student_id"),
        ("leetcode_profile_stats", "student_id"),
        ("official_weekly_snapshots", "student_id"),
        ("sync_job_items", "student_id"),
        ("students", "id")
    ]
    
    for tbl, col in tables_to_clean:
        try:
            cursor.execute(f"DELETE FROM {tbl} WHERE {col} IN ({placeholders})", dummy_ids)
            print(f"Cleaned {cursor.rowcount} rows from {tbl}")
        except Exception as e:
            print(f"Note on {tbl}: {e}")

    # Delete fake departments
    cursor.execute("DELETE FROM departments WHERE code IN ('CSE_AI_TEST', 'CSE_TEST')")
    print(f"Deleted {cursor.rowcount} test departments")

conn.commit()
conn.execute("PRAGMA foreign_keys = ON;")

cursor.execute("SELECT COUNT(*) FROM students")
total_students = cursor.fetchone()[0]
print(f"\n[SUCCESS] Purge complete! Total genuine active students in DB: {total_students}")

# Update Firestore to delete dummy docs if possible
try:
    from backend.services.firestore_service import get_firestore_db
    fs_db = get_firestore_db()
    if fs_db:
        batch = fs_db.batch()
        deleted_cnt = 0
        for reg in dummy_regs:
            doc1 = fs_db.collection("students").document(str(reg))
            doc2 = fs_db.collection("leetcode_stats").document(str(reg))
            batch.delete(doc1)
            batch.delete(doc2)
            deleted_cnt += 1
            if deleted_cnt % 100 == 0:
                batch.commit()
                batch = fs_db.batch()
        batch.commit()
        print(f"[FIRESTORE] Cleaned {deleted_cnt} dummy documents from Firestore.")
except Exception as fs_err:
    print(f"[FIRESTORE NOTE] {fs_err}")
