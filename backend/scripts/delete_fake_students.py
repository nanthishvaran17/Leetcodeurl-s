import sqlite3
from backend.database import engine

def delete_fake_students():
    conn = engine.raw_connection()
    cursor = conn.cursor()
    
    try:
        print("=== STARTING FAKE/TEST STUDENT CLEANUP ===")
        cursor.execute("PRAGMA foreign_keys = OFF;")
        
        # Identify fake/test student IDs
        query = """
        SELECT id, reg_no, name FROM students
        WHERE reg_no LIKE 'CONCUR_%'
           OR reg_no LIKE 'NOTIF_%'
           OR reg_no LIKE '%STUBETA%'
           OR reg_no LIKE '%STU_RBAC%'
           OR LOWER(name) LIKE '%test student%'
           OR LOWER(name) LIKE '%concurrent%'
           OR LOWER(name) LIKE '%notification%'
        """
        cursor.execute(query)
        test_student_rows = cursor.fetchall()
        test_s_ids = [r[0] for r in test_student_rows]
        
        print(f"Found {len(test_s_ids)} fake/test student records to remove:")
        for r in test_student_rows:
            print(f"  - ID: {r[0]} | Reg No: {r[1]} | Name: {r[2]}")
            
        if test_s_ids:
            s_placeholders = ",".join("?" for _ in test_s_ids)
            
            tables_with_student_id = [
                "leetcode_profile_stats", "contest_participations", "weekly_session_snapshots",
                "weekly_public_results", "weekly_virtual_results", "virtual_contest_attempts",
                "weekly_contest_live_events", "weekly_contest_error_logs", "weekly_student_progress",
                "faculty_student_assignments", "mentor_notes", "student_assignment_history",
                "staff_follow_ups", "staff_alerts", "student_weekly_targets", "student_stat_snapshots",
                "student_contest_snapshots", "student_goals", "certificate_records", "nlci_profiles",
                "nlci_daily_snapshots", "nlci_language_stats", "nlci_contest_participations", "nlci_student_analytics"
            ]
            
            for tbl in tables_with_student_id:
                try:
                    cursor.execute(f"DELETE FROM {tbl} WHERE student_id IN ({s_placeholders})", test_s_ids)
                except Exception as e:
                    pass
                    
            cursor.execute(f"DELETE FROM students WHERE id IN ({s_placeholders})", test_s_ids)
            print(f"-> Successfully deleted {len(test_s_ids)} fake/test student records.")

        cursor.execute("PRAGMA foreign_keys = ON;")
        conn.commit()
        print("\n=== CLEANUP COMMITTED SUCCESSFULLY ===")
        
        # Verify Genuine Active Student Count
        cursor.execute("SELECT COUNT(*) FROM students WHERE is_active = 1")
        total_active = cursor.fetchone()[0]
        print(f"TOTAL GENUINE ACTIVE STUDENTS REMAINING: {total_active}")
        
        cursor.execute("SELECT d.code, d.name, COUNT(s.id) FROM departments d LEFT JOIN students s ON s.department_id = d.id AND s.is_active = 1 GROUP BY d.id")
        for row in cursor.fetchall():
            print(f"Department {row[0]} ({row[1]}): {row[2]} Active Students")

    except Exception as e:
        conn.rollback()
        print(f"ERROR during fake student deletion: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    delete_fake_students()
