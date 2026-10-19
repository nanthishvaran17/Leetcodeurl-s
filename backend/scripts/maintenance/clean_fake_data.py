import sqlite3

def clean_fake_data():
    conn = sqlite3.connect('data/leetcode_tracker.db')
    cursor = conn.cursor()
    
    # Check how many fake students we have
    cursor.execute("SELECT COUNT(*) FROM students WHERE reg_no LIKE 'TEST_RACE_%' OR name LIKE 'Race Test Student%'")
    count = cursor.fetchone()[0]
    print(f"Found {count} fake students.")
    
    if count > 0:
        # Delete related data in other tables first due to foreign keys, although ON DELETE CASCADE might be set.
        # But we can just try deleting from students.
        cursor.execute("SELECT id FROM students WHERE reg_no LIKE 'TEST_RACE_%' OR name LIKE 'Race Test Student%'")
        student_ids = [row[0] for row in cursor.fetchall()]
        
        # We can delete them one by one or using IN
        placeholders = ','.join('?' * len(student_ids))
        
        # Tables that might have student_id:
        # contest_participations, lc_profiles, weekly_student_snapshots, monthly_student_snapshots, maybe leetcode_credentials
        
        print("Deleting related records...")
        tables = [
            "contest_participations",
            "lc_profiles",
            "weekly_student_snapshots",
            "monthly_student_snapshots",
            "student_subjects",
            "leetcode_credentials"
        ]
        
        for table in tables:
            try:
                cursor.execute(f"DELETE FROM {table} WHERE student_id IN ({placeholders})", student_ids)
            except sqlite3.OperationalError:
                print(f"Table {table} not found, skipping...")
        
        # Finally delete students
        cursor.execute(f"DELETE FROM students WHERE id IN ({placeholders})", student_ids)
        
        conn.commit()
        print(f"Successfully deleted {count} fake students and their related data.")
    else:
        print("No fake students found.")
        
    conn.close()

if __name__ == "__main__":
    clean_fake_data()
