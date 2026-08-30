"""
test_staff_deletion.py — Verify staff deletion and cascading references.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import pytest
from backend.database import SessionLocal
from backend.models import (
    User, Student, FacultyStudentAssignment, StudentAssignmentHistory,
    FacultyActionAuditLog, FacultyIntervention, MentorNote,
    AdminSession, StaffFollowUp, StaffAlert, PasswordResetOTP,
    FacultyActionQueueItem, EmailCampaign
)
from backend.routes.admin import delete_staff_user

def test_delete_staff_cascading():
    db = SessionLocal()
    
    # 1. Create a dummy staff user
    staff = User(
        username="dummy_delete_test_user",
        email="dummy_delete_test_user@nandhaengg.org",
        hashed_password="fake_hash",
        role="Faculty",
        is_active=True
    )
    db.add(staff)
    db.commit()
    db.refresh(staff)
    staff_id = staff.id

    # 2. Create related entries across the tables to test cascading
    session = AdminSession(user_id=staff_id, token="test_token")
    otp = PasswordResetOTP(user_id=staff_id, otp_code="123456", email=staff.email)
    
    # Assignment history
    history1 = StudentAssignmentHistory(student_id=1, previous_faculty_id=staff_id, new_faculty_id=None)
    history2 = StudentAssignmentHistory(student_id=2, previous_faculty_id=None, new_faculty_id=staff_id)
    history3 = StudentAssignmentHistory(student_id=3, previous_faculty_id=None, new_faculty_id=None, assigned_by_id=staff_id)
    
    # Other actions
    audit_log = FacultyActionAuditLog(user_id=staff_id, action="TEST", details="Test")
    intervention = FacultyIntervention(student_id=1, faculty_id=staff_id, title="Test Intervention", reason="Test reason")
    mentor_note = MentorNote(student_id=1, faculty_id=staff_id, note="Test note")
    follow_up = StaffFollowUp(student_id=1, staff_id=staff_id, title="Test Followup", due_date="2026-08-30")
    alert = StaffAlert(student_id=1, staff_id=staff_id, alert_type="INACTIVITY", title="Test Alert", message="Test message")
    
    # Nullifiable relationships
    action_queue = FacultyActionQueueItem(student_id=1, faculty_id=staff_id, reason="Test reason", recommended_action="Test action")
    email_campaign = EmailCampaign(campaign_name="Test Campaign", subject="Test Subject", body_html="<h1>Test</h1>", sender_id=staff_id, scope_type="ALL_FACULTY")
    assignment = FacultyStudentAssignment(student_id=1, faculty_id=2, assigned_by_id=staff_id)  # assigned by this staff
    
    # Direct assignment
    direct_assignment = FacultyStudentAssignment(student_id=2, faculty_id=staff_id)

    db.add_all([
        session, otp, history1, history2, history3, audit_log,
        intervention, mentor_note, follow_up, alert, action_queue,
        email_campaign, assignment, direct_assignment
    ])
    db.commit()

    # 3. Create an admin mock using a simple namespace
    from types import SimpleNamespace
    admin_mock = SimpleNamespace(role="Admin", id=-1)
    
    try:
        res = delete_staff_user(staff_id=staff_id, db=db, current_user=admin_mock)
        assert res["success"] is True

        # Check that user is deleted
        u = db.query(User).filter(User.id == staff_id).first()
        assert u is None

        # Check cascading deletions
        assert db.query(AdminSession).filter(AdminSession.user_id == staff_id).first() is None
        assert db.query(PasswordResetOTP).filter(PasswordResetOTP.user_id == staff_id).first() is None
        
        # Check history deleted
        assert db.query(StudentAssignmentHistory).filter(
            (StudentAssignmentHistory.previous_faculty_id == staff_id) |
            (StudentAssignmentHistory.new_faculty_id == staff_id) |
            (StudentAssignmentHistory.assigned_by_id == staff_id)
        ).first() is None
        
        # Check audit/intervention/notes/follow-up/alert deleted
        assert db.query(FacultyActionAuditLog).filter(FacultyActionAuditLog.user_id == staff_id).first() is None
        assert db.query(FacultyIntervention).filter(FacultyIntervention.faculty_id == staff_id).first() is None
        assert db.query(MentorNote).filter(MentorNote.faculty_id == staff_id).first() is None
        assert db.query(StaffFollowUp).filter(StaffFollowUp.staff_id == staff_id).first() is None
        assert db.query(StaffAlert).filter(StaffAlert.staff_id == staff_id).first() is None
        assert db.query(FacultyStudentAssignment).filter(FacultyStudentAssignment.faculty_id == staff_id).first() is None

        # Check nullified references
        aq = db.query(FacultyActionQueueItem).filter(FacultyActionQueueItem.student_id == 1).first()
        assert aq is not None
        assert aq.faculty_id is None
        assert aq.assigned_faculty_name is None
        
        ec = db.query(EmailCampaign).filter(EmailCampaign.campaign_name == "Test Campaign").first()
        assert ec is not None
        assert ec.sender_id is None

        fsa = db.query(FacultyStudentAssignment).filter(FacultyStudentAssignment.student_id == 1).first()
        assert fsa is not None
        assert fsa.assigned_by_id is None

    finally:
        # Clean up any leftover entries
        db.query(FacultyStudentAssignment).filter(FacultyStudentAssignment.student_id == 1).delete()
        db.query(EmailCampaign).filter(EmailCampaign.campaign_name == "Test Campaign").delete()
        db.query(FacultyActionQueueItem).filter(FacultyActionQueueItem.student_id == 1).delete()
        db.query(User).filter(User.id == staff_id).delete()
        db.commit()
        db.close()
