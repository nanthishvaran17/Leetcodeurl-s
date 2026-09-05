import pytest
import datetime
from backend.database import SessionLocal
from backend.migrate_db import run_db_migrations
from backend.models import User, Student, Department, SmartGroup, SmartGroupMember, InstitutionalAuditLog, LearningSignal
from backend.services.institutional_intelligence_service import InstitutionalIntelligenceService

@pytest.fixture(scope="session", autouse=True)
def init_db_schema():
    run_db_migrations()

@pytest.fixture
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()

def test_smart_group_creation(db_session):
    # Setup test user
    admin_user = db_session.query(User).filter_by(role="ADMIN").first()
    if not admin_user:
        admin_user = User(
            username="test_hub_admin",
            email="hub_admin@test.com",
            hashed_password="test",
            role="ADMIN",
            full_name="Hub Admin",
            is_active=True
        )
        db_session.add(admin_user)
        db_session.commit()

    group_res = InstitutionalIntelligenceService.create_smart_group(
        db=db_session,
        current_user=admin_user,
        name="Test Inactive Intervention Group",
        description="Dynamic group for student intervention",
        group_type="INTERVENTION",
        is_dynamic=True,
        rule_type="INACTIVE_STUDENTS",
        rule_criteria={"days": 7}
    )

    assert group_res["name"] == "Test Inactive Intervention Group"
    assert group_res["groupType"] == "INTERVENTION"
    assert group_res["isDynamic"] is True
    assert group_res["memberCount"] >= 1

    # Verify audit log recorded
    audit = db_session.query(InstitutionalAuditLog).filter_by(action_type="SMART_GROUP_CREATED").order_by(InstitutionalAuditLog.id.desc()).first()
    assert audit is not None

def test_ask_institution_rbac(db_session):
    admin_user = db_session.query(User).filter_by(role="ADMIN").first()
    if not admin_user:
        admin_user = User(username="test_admin_2", email="admin2@test.com", hashed_password="test", role="ADMIN", full_name="Admin 2", is_active=True)
        db_session.add(admin_user)
        db_session.commit()

    # Query inactive students
    res = InstitutionalIntelligenceService.ask_institution(db_session, admin_user, "Who is inactive this week?")
    assert "answer" in res
    assert "evidence" in res
    assert "actions" in res
    assert res["dataConfidence"] == "HIGH_VERIFIED"
    assert len(res["evidence"]) > 0
    assert len(res["actions"]) > 0

def test_message_action_workflow(db_session):
    faculty_user = db_session.query(User).filter_by(role="FACULTY").first() or db_session.query(User).filter_by(role="ADMIN").first()
    if not faculty_user:
        faculty_user = User(username="test_fac", email="fac@test.com", hashed_password="test", role="FACULTY", full_name="Test Faculty", is_active=True)
        db_session.add(faculty_user)
        db_session.commit()

    msg_content = "Everyone complete 5 Dynamic Programming problems before Friday."
    proposal = InstitutionalIntelligenceService.analyze_message_for_action(db_session, faculty_user, msg_content, "STU_123")
    
    assert proposal is not None
    assert proposal["detected"] is True
    assert proposal["actionType"] == "CREATE_ASSIGNMENT"
    assert proposal["problemCount"] == 5
    assert proposal["topic"] == "Dynamic Programming"
    assert proposal["detected"] is True
    assert proposal["actionType"] == "CREATE_ASSIGNMENT"
    assert proposal["problemCount"] == 5
    assert proposal["topic"] == "Dynamic Programming"

def test_learning_signal_detection(db_session):
    student = db_session.query(Student).first()
    if not student:
        student = Student(name="Signal Student", reg_no="SIG101", is_active=True)
        db_session.add(student)
        db_session.commit()

    student_user = User(email=student.email or "sig101@test.com", role="STUDENT")
    student_user.reg_no = student.reg_no

    signal_res = InstitutionalIntelligenceService.analyze_message_for_learning_signal(
        db=db_session,
        student_user=student_user,
        content="Sir, I am really confused and having a hard time with Dynamic Programming.",
        message_id="MSG_TEST_99"
    )

    assert signal_res is not None
    assert signal_res["topic"] == "Dynamic Programming"

    signal_db = db_session.query(LearningSignal).filter_by(topic="Dynamic Programming").first()
    assert signal_db is not None

def test_why_was_i_flagged_transparency(db_session):
    student = db_session.query(Student).first()
    student_user = User(email=student.email or "stu@test.com", role="STUDENT")
    student_user.reg_no = student.reg_no

    transparency = InstitutionalIntelligenceService.get_student_flag_transparency(db_session, student_user)
    assert "objectiveReasons" in transparency
    assert "note" in transparency
    assert "verified platform data" in transparency["note"]
