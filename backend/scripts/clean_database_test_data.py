import os
from sqlalchemy import text
from backend.database import engine

def clean_database():
    with engine.begin() as conn:
        print("=== STARTING DATABASE CLEANUP ===")
        
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
        
        test_user_rows = conn.execute(
            text("SELECT id, email, full_name FROM users WHERE email IN :emails"),
            {"emails": tuple(test_user_emails)}
        ).fetchall()
        test_u_ids = [r[0] for r in test_user_rows]
        print(f"Found {len(test_u_ids)} test/fake staff/admin user accounts to delete:")
        for r in test_user_rows:
            print(f"  - ID: {r[0]} | Name: {r[2]} | Email: {r[1]}")
            
        if test_u_ids:
            u_tuple = tuple(test_u_ids)
            conn.execute(text("DELETE FROM hod_department_allocations WHERE user_id IN :uids OR created_by IN :uids"), {"uids": u_tuple})
            conn.execute(text("DELETE FROM password_reset_otps WHERE user_id IN :uids"), {"uids": u_tuple})
            conn.execute(text("DELETE FROM faculty_student_assignments WHERE faculty_id IN :uids OR assigned_by_id IN :uids"), {"uids": u_tuple})
            conn.execute(text("DELETE FROM mentor_notes WHERE faculty_id IN :uids"), {"uids": u_tuple})
            conn.execute(text("DELETE FROM student_assignment_history WHERE previous_faculty_id IN :uids OR new_faculty_id IN :uids OR assigned_by_id IN :uids"), {"uids": u_tuple})
            conn.execute(text("DELETE FROM staff_follow_ups WHERE staff_id IN :uids"), {"uids": u_tuple})
            conn.execute(text("DELETE FROM staff_alerts WHERE staff_id IN :uids"), {"uids": u_tuple})
            conn.execute(text("DELETE FROM users WHERE id IN :uids"), {"uids": u_tuple})
            print(f"-> Successfully deleted {len(test_u_ids)} test/fake user accounts and associated records.")

        # 2. Clean Non-Designated / Test Departments (CSE_TEST, CSE, TEST_P930, TEST_DEPT, CSE-EDIT-TEST, CSE_AI_TEST)
        test_dept_codes = ['CSE_TEST', 'CSE', 'TEST_P930', 'TEST_DEPT', 'CSE-EDIT-TEST', 'CSE_AI_TEST']
        dept_rows = conn.execute(
            text("SELECT id, code, name FROM departments WHERE code IN :codes"),
            {"codes": tuple(test_dept_codes)}
        ).fetchall()
        test_dept_ids = [r[0] for r in dept_rows]
        print(f"\nFound {len(test_dept_ids)} non-designated departments to delete:")
        for r in dept_rows:
            print(f"  - ID: {r[0]} | Code: {r[1]} | Name: {r[2]}")
            
        if test_dept_ids:
            dept_id_tuple = tuple(test_dept_ids)
            student_rows = conn.execute(
                text("SELECT id FROM students WHERE department_id IN :dids"),
                {"dids": dept_id_tuple}
            ).fetchall()
            test_s_ids = [r[0] for r in student_rows]
            
            if test_s_ids:
                s_tuple = tuple(test_s_ids)
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
                        conn.execute(text(f"DELETE FROM {tbl} WHERE student_id IN :sids"), {"sids": s_tuple})
                    except Exception as e:
                        print(f"   (Note: clean step for {tbl}: {e})")
                        
                conn.execute(text("DELETE FROM students WHERE id IN :sids"), {"sids": s_tuple})
                print(f"-> Successfully deleted {len(test_s_ids)} test/sample student records.")

            conn.execute(text("DELETE FROM sections WHERE department_id IN :dids"), {"dids": dept_id_tuple})
            conn.execute(text("DELETE FROM hod_department_allocations WHERE department_id IN :dids"), {"dids": dept_id_tuple})
            conn.execute(text("DELETE FROM users WHERE department_id IN :dids"), {"dids": dept_id_tuple})
            conn.execute(text("DELETE FROM departments WHERE id IN :dids"), {"dids": dept_id_tuple})
            print(f"-> Successfully deleted {len(test_dept_ids)} non-designated department records.")

        print("\n=== CLEANUP TRANSACTION COMMITTED SUCCESSFULLY ===")
        
        # Verify Final Remaining Departments & Students
        print("\n=== REMAINING DEPARTMENTS ===")
        remaining_depts = conn.execute(text("SELECT id, name, code FROM departments ORDER BY id")).fetchall()
        for d in remaining_depts:
            cnt = conn.execute(text("SELECT COUNT(*) FROM students WHERE department_id = :did AND is_active = true"), {"did": d[0]}).scalar()
            print(f"ID: {d[0]} | Code: {d[2]} | Name: {d[1]} | Active Genuine Students: {cnt}")
            
        total_gen_students = conn.execute(text("SELECT COUNT(*) FROM students WHERE is_active = true")).scalar()
        print(f"\nTOTAL GENUINE ACTIVE STUDENTS IN SYSTEM: {total_gen_students}")
        
        print("\n=== REMAINING STAFF / ADMIN USERS ===")
        remaining_users = conn.execute(text("SELECT id, full_name, email, role FROM users ORDER BY id")).fetchall()
        for u in remaining_users:
            print(f"ID: {u[0]} | Name: {u[1]} | Email: {u[2]} | Role: {u[3]}")

if __name__ == '__main__':
    clean_database()

