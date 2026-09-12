import sqlite3
import os
from backend.database import engine

def clean_database():
    # Use the connection directly from SQLAlchemy engine
    conn = engine.raw_connection()
    cursor = conn.cursor()
    
    try:
        print("=== STARTING DATABASE CLEANUP ===")
        cursor.execute("PRAGMA foreign_keys = OFF;")
        
        # 1. Clean Fake/Test Staff & Admin Users
        test_user_emails = [
            "hardening_student_user_01@nandhaengg.org",
            "student_hardened@college.edu",
            "inactive_user@nandhaengg.org",
            "test_staff_cap@nandhaengg.org",
            "staff_a@nandha.edu.in",
            "staff_b@nandha.edu.in",
            "hardening_admin_user_01@nandhaengg.org",
            "hardening_inactive_user_01@nandhaengg.org",
            "admin_hardened@college.edu",
            "hub_admin@test.com"
        ]
        
        placeholders = ",".join("?" for _ in test_user_emails)
        cursor.execute(f"SELECT id, email, full_name FROM users WHERE email IN ({placeholders})", test_user_emails)
        test_user_rows = cursor.fetchall()
        test_u_ids = [r[0] for r in test_user_rows]
        print(f"Found {len(test_u_ids)} test/fake staff/admin user accounts to delete:")
        for r in test_user_rows:
            print(f"  - ID: {r[0]} | Name: {r[2]} | Email: {r[1]}")
            
        if test_u_ids:
            u_placeholders = ",".join("?" for _ in test_u_ids)
            cursor.execute(f"DELETE FROM hod_department_allocations WHERE user_id IN ({u_placeholders}) OR created_by IN ({u_placeholders})", test_u_ids + test_u_ids)
            cursor.execute(f"DELETE FROM password_reset_otps WHERE user_id IN ({u_placeholders})", test_u_ids)
            cursor.execute(f"DELETE FROM faculty_student_assignments WHERE faculty_id IN ({u_placeholders}) OR assigned_by_id IN ({u_placeholders})", test_u_ids + test_u_ids)
            cursor.execute(f"DELETE FROM mentor_notes WHERE faculty_id IN ({u_placeholders})", test_u_ids)
            cursor.execute(f"DELETE FROM student_assignment_history WHERE previous_faculty_id IN ({u_placeholders}) OR new_faculty_id IN ({u_placeholders}) OR assigned_by_id IN ({u_placeholders})", test_u_ids + test_u_ids + test_u_ids)
            cursor.execute(f"DELETE FROM staff_follow_ups WHERE staff_id IN ({u_placeholders})", test_u_ids)
            cursor.execute(f"DELETE FROM staff_alerts WHERE staff_id IN ({u_placeholders})", test_u_ids)
            cursor.execute(f"DELETE FROM users WHERE id IN ({u_placeholders})", test_u_ids)
            print(f"-> Successfully deleted {len(test_u_ids)} test/fake user accounts and associated records.")

        # 2. Clean Non-Designated Departments (CSE_TEST, CSE, TEST_P930, TEST_DEPT)
        test_dept_codes = ['CSE_TEST', 'CSE', 'TEST_P930', 'TEST_DEPT']
        d_placeholders = ",".join("?" for _ in test_dept_codes)
        cursor.execute(f"SELECT id, code, name FROM departments WHERE code IN ({d_placeholders})", test_dept_codes)
        dept_rows = cursor.fetchall()
        test_dept_ids = [r[0] for r in dept_rows]
        print(f"\nFound {len(test_dept_ids)} non-designated departments to delete:")
        for r in dept_rows:
            print(f"  - ID: {r[0]} | Code: {r[1]} | Name: {r[2]}")
            
        if test_dept_ids:
            dept_id_placeholders = ",".join("?" for _ in test_dept_ids)
            cursor.execute(f"SELECT id FROM students WHERE department_id IN ({dept_id_placeholders})", test_dept_ids)
            student_rows = cursor.fetchall()
            test_s_ids = [r[0] for r in student_rows]
            
            if test_s_ids:
                s_placeholders = ",".join("?" for _ in test_s_ids)
                print(f"Found {len(test_s_ids)} test/sample students in non-designated departments to remove.")
                
                tables_with_student_id = [
                    "leetcode_profile_stats", "contest_participations", "weekly_session_snapshots",
                    "weekly_public_results", "weekly_virtual_results", "virtual_contest_attempts",
                    "weekly_contest_live_events", "weekly_contest_error_logs", "weekly_student_progress",
                    "faculty_student_assignments", "mentor_notes", "student_assignment_history",
                    "staff_follow_ups", "staff_alerts", "student_weekly_targets", "student_stat_snapshots",
                    "student_contest_snapshots", "student_goals", "certificate_records"
                ]
                
                for tbl in tables_with_student_id:
                    try:
                        cursor.execute(f"DELETE FROM {tbl} WHERE student_id IN ({s_placeholders})", test_s_ids)
                    except Exception as e:
                        print(f"   (Note: clean step for {tbl}: {e})")
                        
                cursor.execute(f"DELETE FROM students WHERE id IN ({s_placeholders})", test_s_ids)
                print(f"-> Successfully deleted {len(test_s_ids)} test/sample student records.")

            cursor.execute(f"DELETE FROM sections WHERE department_id IN ({dept_id_placeholders})", test_dept_ids)
            cursor.execute(f"DELETE FROM hod_department_allocations WHERE department_id IN ({dept_id_placeholders})", test_dept_ids)
            cursor.execute(f"DELETE FROM users WHERE department_id IN ({dept_id_placeholders})", test_dept_ids)
            cursor.execute(f"DELETE FROM departments WHERE id IN ({dept_id_placeholders})", test_dept_ids)
            print(f"-> Successfully deleted {len(test_dept_ids)} non-designated department records.")

        cursor.execute("PRAGMA foreign_keys = ON;")
        conn.commit()
        print("\n=== CLEANUP TRANSACTION COMMITTED SUCCESSFULLY ===")
        
        # Verify Final Remaining Departments & Students
        print("\n=== REMAINING DEPARTMENTS ===")
        cursor.execute("SELECT id, name, code FROM departments")
        for d in cursor.fetchall():
            cursor.execute("SELECT COUNT(*) FROM students WHERE department_id = ? AND is_active = 1", (d[0],))
            cnt = cursor.fetchone()[0]
            print(f"ID: {d[0]} | Code: {d[2]} | Name: {d[1]} | Active Genuine Students: {cnt}")
            
        cursor.execute("SELECT COUNT(*) FROM students WHERE is_active = 1")
        total_gen_students = cursor.fetchone()[0]
        print(f"\nTOTAL GENUINE ACTIVE STUDENTS IN SYSTEM: {total_gen_students}")
        
        print("\n=== REMAINING STAFF / ADMIN USERS ===")
        cursor.execute("SELECT id, full_name, email, role FROM users")
        for u in cursor.fetchall():
            print(f"ID: {u[0]} | Name: {u[1]} | Email: {u[2]} | Role: {u[3]}")

    except Exception as e:
        conn.rollback()
        print(f"ERROR during cleanup: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == '__main__':
    clean_database()
