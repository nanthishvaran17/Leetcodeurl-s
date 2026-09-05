import datetime
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.main import app
from backend.database import Base, get_db
from backend.models import User, Department, Student, FacultyStudentAssignment, LeetCodeProfileStats
from backend.routes.auth import create_access_token, get_password_hash
from backend.services.faculty_assignment_service import FacultyAssignmentService

# Setup in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # 1. Departments
    dept_cse = Department(id=1, name="Computer Science and Engineering", code="CSE")
    dept_ece = Department(id=2, name="Electronics and Communication", code="ECE")
    db.add_all([dept_cse, dept_ece])
    
    # 2. Staff Members
    staff_21 = User(id=10, username="staff_21", email="staff21@nandha.edu.in", hashed_password=get_password_hash("pass"), role="Staff", department_id=1, is_active=True)
    staff_35 = User(id=11, username="staff_35", email="staff35@nandha.edu.in", hashed_password=get_password_hash("pass"), role="Staff", department_id=1, is_active=True)
    staff_8 = User(id=12, username="staff_8", email="staff8@nandha.edu.in", hashed_password=get_password_hash("pass"), role="Staff", department_id=1, is_active=True)
    staff_0 = User(id=13, username="staff_0", email="staff0@nandha.edu.in", hashed_password=get_password_hash("pass"), role="Staff", department_id=1, is_active=True)
    db.add_all([staff_21, staff_35, staff_8, staff_0])
    
    # 3. Create Students & Assign
    # Staff 10: 21 students (IDs 101 to 121)
    for i in range(101, 122):
        st = Student(id=i, name=f"Student {i}", reg_no=f"21CS{i}", username=f"user_{i}", department_id=1, year_level="III", is_active=True)
        fsa = FacultyStudentAssignment(faculty_id=10, student_id=i, is_active=True)
        stats = LeetCodeProfileStats(student_id=i, total_solved=i * 2)
        db.add_all([st, fsa, stats])
        
    # Staff 11: 35 students (IDs 201 to 235)
    for i in range(201, 236):
        st = Student(id=i, name=f"Student {i}", reg_no=f"21CS{i}", username=f"user_{i}", department_id=1, year_level="III", is_active=True)
        fsa = FacultyStudentAssignment(faculty_id=11, student_id=i, is_active=True)
        stats = LeetCodeProfileStats(student_id=i, total_solved=i * 2)
        db.add_all([st, fsa, stats])

    # Staff 12: 8 students (IDs 301 to 308)
    for i in range(301, 308 + 1):
        st = Student(id=i, name=f"Student {i}", reg_no=f"21CS{i}", username=f"user_{i}", department_id=1, year_level="III", is_active=True)
        fsa = FacultyStudentAssignment(faculty_id=12, student_id=i, is_active=True)
        stats = LeetCodeProfileStats(student_id=i, total_solved=i * 2)
        db.add_all([st, fsa, stats])
        
    # Unassigned student in Dept 2 (ECE)
    st_ece = Student(id=999, name="Unassigned ECE Student", reg_no="21EC999", username="user_ece", department_id=2, year_level="III", is_active=True)
    db.add(st_ece)

    db.commit()
    yield
    db.close()
    Base.metadata.drop_all(bind=engine)

def get_auth_header(username: str, role: str, user_id: int):
    token = create_access_token(data={"sub": username, "role": role, "user_id": user_id})
    return {"Authorization": f"Bearer {token}"}

# --- ASSIGNMENT COUNT TESTS ---

def test_1_staff_21_assigned_count():
    headers = get_auth_header("staff_21", "Staff", 10)
    res = client.get("/api/faculty-assignments/my-students", headers=headers)
    assert res.status_code == 200
    assert res.json()["total_assigned"] == 21
    assert len(res.json()["students"]) == 21

def test_2_staff_35_assigned_count():
    headers = get_auth_header("staff_35", "Staff", 11)
    res = client.get("/api/faculty-assignments/my-students", headers=headers)
    assert res.status_code == 200
    assert res.json()["total_assigned"] == 35

def test_3_staff_8_assigned_count():
    headers = get_auth_header("staff_8", "Staff", 12)
    res = client.get("/api/faculty-assignments/my-students", headers=headers)
    assert res.status_code == 200
    assert res.json()["total_assigned"] == 8

def test_4_staff_0_assigned_count():
    headers = get_auth_header("staff_0", "Staff", 13)
    res = client.get("/api/faculty-assignments/my-students", headers=headers)
    assert res.status_code == 200
    assert res.json()["total_assigned"] == 0
    assert res.json()["students"] == []

# --- AUTHORIZATION & IDOR TESTS ---

def test_5_assigned_student_access_allowed():
    headers = get_auth_header("staff_21", "Staff", 10)
    res = client.get("/api/students/101", headers=headers)
    assert res.status_code == 200

def test_6_unassigned_student_access_denied():
    headers = get_auth_header("staff_21", "Staff", 10)
    res = client.get("/api/students/999", headers=headers)
    assert res.status_code == 403

def test_7_another_staff_student_access_denied():
    headers = get_auth_header("staff_21", "Staff", 10)
    # Student 201 belongs to staff 11
    res = client.get("/api/students/201", headers=headers)
    assert res.status_code == 403

def test_8_another_department_student_access_denied():
    headers = get_auth_header("staff_21", "Staff", 10)
    # Student 999 is in ECE department
    res = client.get("/api/students/999", headers=headers)
    assert res.status_code == 403

# --- API SCOPE ISOLATION TESTS ---

def test_18_search_cannot_discover_unassigned_students():
    headers = get_auth_header("staff_21", "Staff", 10)
    res = client.get("/api/students?search=Unassigned", headers=headers)
    assert res.status_code == 200
    data = res.json()
    items = data.get("students", data) if isinstance(data, dict) else data
    assert len(items) == 0

def test_19_pagination_cannot_leak_unassigned_students():
    headers = get_auth_header("staff_21", "Staff", 10)
    res = client.get("/api/students?page=1&limit=50&paginated=true", headers=headers)
    assert res.status_code == 200
    data = res.json()
    # Should only return Staff 10's 21 students, not the other 35+8+1=44 students
    assert data["total"] == 21
    assert len(data["items"]) == 21

def test_21_filter_cannot_expand_authorization_scope():
    headers = get_auth_header("staff_21", "Staff", 10)
    # Attempt to expand scope by passing dept_id=2 (ECE)
    res = client.get("/api/students?dept_id=2", headers=headers)
    assert res.status_code == 200
    data = res.json()
    items = data.get("students", data) if isinstance(data, dict) else data
    assert len(items) == 0

def test_22_ask_institution_ai_scoped_to_assigned_students():
    headers = get_auth_header("staff_21", "Staff", 10)
    res = client.post("/api/messaging/ask-institution", json={"query": "List all my students"}, headers=headers)
    assert res.status_code == 200
    result = res.json().get("result", {})
    # Verify AI context contains 21 assigned students
    assert result.get("total_in_scope") == 21
