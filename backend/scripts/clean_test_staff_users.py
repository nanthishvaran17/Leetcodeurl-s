"""
clean_test_staff_users.py — Utility to clean test/dummy staff & faculty accounts from DB
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))

from backend.database import SessionLocal
from backend.models import User, FacultyStudentAssignment, StudentAssignmentHistory, StaffFollowUp, StaffAlert

def clean_test_staff_users():
    db = SessionLocal()
    try:
        # Admin accounts to protect strictly from deletion
        admin_emails = {
            'nanthishvaran17@gmail.com',
            'nanthishvaran117@gmail.com',
            'nanthishvaran0106@gmail.com',
            'msanthoshkumar@nandhaengg.org',
            'santhoshkumar@nandhaengg.org',
            'admin.leetcode@nandhaengg.org'
        }
        
        admin_usernames = {'admin', 'administrator', 'nanthishvaran'}

        # Fetch all non-admin staff and faculty accounts
        users_to_delete = db.query(User).filter(
            User.role.in_(["Staff", "staff", "Faculty", "faculty", "HOD", "hod"])
        ).all()

        deleted_count = 0
        unassigned_count = 0

        for u in users_to_delete:
            email_lower = (u.email or "").strip().lower()
            uname_lower = (u.username or "").strip().lower()

            # Protect super admins
            if email_lower in admin_emails or uname_lower in admin_usernames or u.role in ["Admin", "super admin", "Super Admin"]:
                continue

            # Delete associated assignments
            assignments = db.query(FacultyStudentAssignment).filter(FacultyStudentAssignment.faculty_id == u.id).all()
            for a in assignments:
                db.delete(a)
                unassigned_count += 1

            # Delete associated history/notes/alerts
            db.query(StudentAssignmentHistory).filter(
                (StudentAssignmentHistory.previous_faculty_id == u.id) |
                (StudentAssignmentHistory.new_faculty_id == u.id)
            ).delete(synchronize_session=False)

            db.query(StaffFollowUp).filter(StaffFollowUp.staff_id == u.id).delete(synchronize_session=False)
            db.query(StaffAlert).filter(StaffAlert.staff_id == u.id).delete(synchronize_session=False)

            db.delete(u)
            deleted_count += 1

        db.commit()
        print(f"[SUCCESS] Removed {deleted_count} dummy staff/faculty accounts.")
        print(f"[SUCCESS] Unassigned {unassigned_count} student assignments to reset queue.")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Failed to clean test staff users: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    clean_test_staff_users()
