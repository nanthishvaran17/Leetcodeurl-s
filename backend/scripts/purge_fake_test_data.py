import os
import sys

root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(root_dir)

from sqlalchemy import text
from backend.database import SessionLocal
from backend.models import (
    User, Student, FacultyStudentAssignment, MentorNote, StudentAssignmentHistory,
    StaffFollowUp, StaffAlert, HODDepartmentAllocation, PasswordResetOTP, FacultyActionAuditLog
)

def purge_fake_test_data():
    db = SessionLocal()
    
    try:
        print("==================================================")
        print("  PURGING ALL FAKE & TEST DATA FROM SYSTEM")
        print("==================================================")

        # Genuine user emails to KEEP strictly:
        genuine_emails = {
            "nanthishvaran17@gmail.com",
            "nanthishvaran0106@gmail.com",
            "nanthishsaravanan17@gmail.com",
            "nanthishvaran117@gmail.com",
            "msanthoshkumar@nandhaengg.org",
            "santhoshkumar@nandhaengg.org",
            "admin.leetcode@nandhaengg.org"
        }

        # 1. PURGE TEST / FAKE USERS (STAFF & ADMIN)
        fake_users = db.query(User).filter(
            User.role.notin_(["Student", "student"])
        ).all()

        users_to_delete = []
        for u in fake_users:
            email_lower = (u.email or "").strip().lower()
            uname_lower = (u.username or "").strip().lower()
            
            is_genuine = email_lower in genuine_emails
            if not is_genuine and (
                "test" in email_lower or "test" in uname_lower or
                "isolation" in email_lower or "isolation" in uname_lower or
                "hardening" in email_lower or "hardening" in uname_lower or
                "p930" in email_lower or "p930" in uname_lower or
                "notif" in email_lower or "notif" in uname_lower or
                "dummy" in email_lower or "dummy" in uname_lower or
                email_lower.endswith(".test") or email_lower.endswith("@college.edu") or
                uname_lower.startswith("staff_") or uname_lower.startswith("test_")
            ):
                users_to_delete.append(u)

        print(f"\n[USERS] Found {len(users_to_delete)} test/fake staff & admin accounts to purge:")
        for u in users_to_delete:
            print(f"  - ID: {u.id} | Username: {u.username} | Email: {u.email} | Role: {u.role}")

        for u in users_to_delete:
            u_id = u.id
            for raw_sql in [
                "DELETE FROM admin_sessions WHERE user_id = :u_id",
                "DELETE FROM security_activity_logs WHERE user_id = :u_id",
                "DELETE FROM audit_logs WHERE user_id = :u_id"
            ]:
                try:
                    db.execute(text(raw_sql), {"u_id": u_id})
                except Exception:
                    db.rollback()
            
            db.query(FacultyStudentAssignment).filter(
                (FacultyStudentAssignment.faculty_id == u_id) | (FacultyStudentAssignment.assigned_by_id == u_id)
            ).delete(synchronize_session=False)

            db.query(StudentAssignmentHistory).filter(
                (StudentAssignmentHistory.previous_faculty_id == u_id) |
                (StudentAssignmentHistory.new_faculty_id == u_id) |
                (StudentAssignmentHistory.assigned_by_id == u_id)
            ).delete(synchronize_session=False)

            db.query(MentorNote).filter(MentorNote.faculty_id == u_id).delete(synchronize_session=False)
            db.query(StaffFollowUp).filter(StaffFollowUp.staff_id == u_id).delete(synchronize_session=False)
            db.query(StaffAlert).filter(StaffAlert.staff_id == u_id).delete(synchronize_session=False)
            db.query(HODDepartmentAllocation).filter(
                (HODDepartmentAllocation.user_id == u_id) | (HODDepartmentAllocation.created_by == u_id)
            ).delete(synchronize_session=False)
            db.query(PasswordResetOTP).filter(PasswordResetOTP.user_id == u_id).delete(synchronize_session=False)
            db.query(FacultyActionAuditLog).filter(FacultyActionAuditLog.user_id == u_id).delete(synchronize_session=False)
            db.delete(u)

        db.commit()
        print(f"-> Successfully purged {len(users_to_delete)} fake staff/admin users.")

        # 2. PURGE TEST / DUMMY STUDENTS
        fake_students = db.query(Student).filter(
            (Student.reg_no.ilike("%TEST%")) |
            (Student.reg_no.ilike("%CONCUR%")) |
            (Student.reg_no.ilike("%P930%")) |
            (Student.reg_no.ilike("%NOTIF%")) |
            (Student.reg_no.ilike("%DUMMY%")) |
            (Student.name.ilike("%Test%")) |
            (Student.name.ilike("%Dummy%")) |
            (Student.name.ilike("%Solver%"))
        ).all()

        print(f"\n[STUDENTS] Found {len(fake_students)} test/dummy student records to purge:")
        for s in fake_students:
            print(f"  - ID: {s.id} | Reg No: {s.reg_no} | Name: {s.name}")

        for s in fake_students:
            s_id = s.id
            for raw_sql in [
                "DELETE FROM faculty_action_audit_logs WHERE action_id IN (SELECT id FROM faculty_action_queue WHERE student_id = :s_id)",
                "DELETE FROM faculty_action_queue WHERE student_id = :s_id",
                "DELETE FROM faculty_student_assignments WHERE student_id = :s_id",
                "DELETE FROM leetcode_profile_stats WHERE student_id = :s_id",
                "DELETE FROM mentor_notes WHERE student_id = :s_id",
                "DELETE FROM staff_follow_ups WHERE student_id = :s_id",
                "DELETE FROM staff_alerts WHERE student_id = :s_id"
            ]:
                try:
                    db.execute(text(raw_sql), {"s_id": s_id})
                except Exception:
                    db.rollback()
            db.delete(s)

        db.commit()
        print(f"-> Successfully purged {len(fake_students)} test/dummy student records.")

        # 3. AUDIT REMAINING USERS
        remaining_users = db.query(User).filter(User.role.notin_(["Student", "student"])).all()
        print("\nREMAINING GENUINE STAFF / ADMIN USERS:")
        for u in remaining_users:
            print(f"  - ID: {u.id} | Username: {u.username} | Email: {u.email} | Role: {u.role}")
        print(f"TOTAL GENUINE STAFF/ADMIN USERS: {len(remaining_users)}")

    except Exception as e:
        db.rollback()
        print(f"ERROR during purge: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == '__main__':
    purge_fake_test_data()

