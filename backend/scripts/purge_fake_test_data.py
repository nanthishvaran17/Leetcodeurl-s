import os
import sys
import sqlite3

# Define root path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(root_dir)

from backend.database import engine

def purge_fake_test_data():
    conn = engine.raw_connection()
    cursor = conn.cursor()
    
    try:
        print("==================================================")
        print("  PURGING ALL FAKE & TEST DATA FROM SYSTEM")
        print("==================================================")
        cursor.execute("PRAGMA foreign_keys = OFF;")

        # ----------------------------------------------------
        # 1. PURGE TEST / FAKE USERS (STAFF & ADMIN)
        # ----------------------------------------------------
        # Genuine user emails to KEEP:
        genuine_user_emails = [
            "nanthishvaran17@gmail.com",
            "nanthishvaran0106@gmail.com",
            "nanthishsaravanan17@gmail.com"
        ]
        
        # Get test users (users whose email is not in genuine_user_emails and role != 'Student')
        cursor.execute("""
            SELECT id, username, email, role FROM users 
            WHERE role != 'Student' 
              AND email NOT IN ('nanthishvaran17@gmail.com', 'nanthishvaran0106@gmail.com', 'nanthishsaravanan17@gmail.com')
        """)
        fake_users = cursor.fetchall()
        fake_u_ids = [u[0] for u in fake_users]
        
        print(f"\n[USERS] Found {len(fake_u_ids)} test/fake staff & admin accounts to purge:")
        for u in fake_users:
            print(f"  - ID: {u[0]} | Username: {u[1]} | Email: {u[2]} | Role: {u[3]}")

        if fake_u_ids:
            u_placeholders = ",".join("?" for _ in fake_u_ids)
            
            user_ref_tables = [
                ("hod_department_allocations", "user_id"),
                ("hod_department_allocations", "created_by"),
                ("password_reset_otps", "user_id"),
                ("faculty_student_assignments", "faculty_id"),
                ("faculty_student_assignments", "assigned_by_id"),
                ("mentor_notes", "faculty_id"),
                ("student_assignment_history", "previous_faculty_id"),
                ("student_assignment_history", "new_faculty_id"),
                ("student_assignment_history", "assigned_by_id"),
                ("staff_follow_ups", "staff_id"),
                ("staff_alerts", "staff_id"),
                ("faculty_action_audit_logs", "faculty_id")
            ]
            
            for tbl, col in user_ref_tables:
                try:
                    cursor.execute(f"DELETE FROM {tbl} WHERE {col} IN ({u_placeholders})", fake_u_ids)
                except Exception as e:
                    print(f"  Note on {tbl}.{col}: {e}")
                    
            cursor.execute(f"DELETE FROM users WHERE id IN ({u_placeholders})", fake_u_ids)
            print(f"-> Successfully purged {len(fake_u_ids)} fake staff/admin users.")

        # ----------------------------------------------------
        # 2. PURGE TEST / DUMMY STUDENTS
        # ----------------------------------------------------
        cursor.execute("""
            SELECT id, reg_no, name FROM students WHERE 
            reg_no LIKE '%TEST%' OR 
            reg_no LIKE '%CONCUR%' OR 
            reg_no LIKE '%P930%' OR 
            reg_no LIKE '%NOTIF%' OR 
            reg_no LIKE '%DUMMY%' OR 
            name LIKE '%Test%' OR 
            name LIKE '%Dummy%' OR 
            name LIKE '%Solver%'
        """)
        fake_students = cursor.fetchall()
        fake_s_ids = [s[0] for s in fake_students]
        fake_s_regs = [s[1] for s in fake_students]

        print(f"\n[STUDENTS] Found {len(fake_s_ids)} test/dummy student records to purge:")
        for s in fake_students:
            print(f"  - ID: {s[0]} | Reg No: {s[1]} | Name: {s[2]}")

        if fake_s_ids:
            s_placeholders = ",".join("?" for _ in fake_s_ids)
            
            student_ref_tables = [
                ("leetcode_profile_stats", "student_id"),
                ("contest_participations", "student_id"),
                ("weekly_session_snapshots", "student_id"),
                ("weekly_public_results", "student_id"),
                ("weekly_virtual_results", "student_id"),
                ("virtual_contest_attempts", "student_id"),
                ("weekly_contest_live_events", "student_id"),
                ("weekly_contest_error_logs", "student_id"),
                ("weekly_student_progress", "student_id"),
                ("faculty_student_assignments", "student_id"),
                ("faculty_action_audit_logs", "student_id"),
                ("mentor_notes", "student_id"),
                ("student_assignment_history", "student_id"),
                ("staff_follow_ups", "student_id"),
                ("staff_alerts", "student_id"),
                ("student_weekly_targets", "student_id"),
                ("student_stat_snapshots", "student_id"),
                ("student_contest_snapshots", "student_id"),
                ("student_goals", "student_id"),
                ("certificate_records", "student_id"),
                ("official_weekly_snapshots", "student_id"),
                ("sync_job_items", "student_id")
            ]
            
            for tbl, col in student_ref_tables:
                try:
                    cursor.execute(f"DELETE FROM {tbl} WHERE {col} IN ({s_placeholders})", fake_s_ids)
                except Exception as e:
                    print(f"  Note on {tbl}.{col}: {e}")

            cursor.execute(f"DELETE FROM students WHERE id IN ({s_placeholders})", fake_s_ids)
            print(f"-> Successfully purged {len(fake_s_ids)} test/dummy student records.")

        # ----------------------------------------------------
        # 3. PURGE TEST / NON-DESIGNATED DEPARTMENTS
        # ----------------------------------------------------
        cursor.execute("DELETE FROM departments WHERE code IN ('TEST_DEPT', 'TEST_P930', 'CSE_TEST', 'CSE_AI_TEST')")
        print(f"\n[DEPARTMENTS] Deleted test department entries.")

        cursor.execute("PRAGMA foreign_keys = ON;")
        conn.commit()
        print("\n==================================================")
        print("  PURGE TRANSACTION COMMITTED SUCCESSFULLY!")
        print("==================================================")

        # ----------------------------------------------------
        # 4. FINAL SYSTEM AUDIT
        # ----------------------------------------------------
        cursor.execute("SELECT COUNT(*) FROM students WHERE is_active = 1")
        active_gen_students = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM students")
        total_gen_students = cursor.fetchone()[0]

        print(f"\nTOTAL GENUINE ACTIVE STUDENTS IN SYSTEM: {active_gen_students}")
        print(f"TOTAL GENUINE STUDENTS IN SYSTEM: {total_gen_students}")

        print("\nREMAINING GENUINE STAFF / ADMIN USERS:")
        cursor.execute("SELECT id, username, email, full_name, role FROM users WHERE role != 'Student'")
        remaining_users = cursor.fetchall()
        for u in remaining_users:
            print(f"  - ID: {u[0]} | Username: {u[1]} | Name: {u[3]} | Email: {u[2]} | Role: {u[4]}")
        print(f"TOTAL GENUINE STAFF/ADMIN USERS: {len(remaining_users)}")

        # ----------------------------------------------------
        # 5. FIRESTORE CLEANUP (IF FIRESTORE ACTIVE)
        # ----------------------------------------------------
        try:
            from backend.services.firestore_service import get_firestore_db
            fs_db = get_firestore_db()
            if fs_db:
                print("\n[FIRESTORE] Cleaning dummy documents from Firestore...")
                batch = fs_db.batch()
                deleted_cnt = 0
                for reg in fake_s_regs:
                    doc1 = fs_db.collection("students").document(str(reg))
                    doc2 = fs_db.collection("leetcode_stats").document(str(reg))
                    batch.delete(doc1)
                    batch.delete(doc2)
                    deleted_cnt += 1
                    if deleted_cnt % 100 == 0:
                        batch.commit()
                        batch = fs_db.batch()
                batch.commit()
                print(f"[FIRESTORE] Successfully cleaned {deleted_cnt} dummy documents from Firestore.")
        except Exception as fs_err:
            print(f"[FIRESTORE NOTE] {fs_err}")

    except Exception as e:
        conn.rollback()
        print(f"ERROR during purge: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == '__main__':
    purge_fake_test_data()
