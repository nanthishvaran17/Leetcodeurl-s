import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from backend.main import app
from backend.database import Base, get_db
from backend.models import Student, Department, LeetCodeProfileStats

# Setup test in-memory SQLite database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, poolclass=StaticPool, connect_args={"check_same_thread": False})

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Add dummy department & students for testing database health endpoint
    dept = Department(id=1, name="CSE (Cyber Security)", code="CSE(CS)")
    db.add(dept)
    db.commit()

    student = Student(
        id=1,
        reg_no="732224CC031",
        name="NANTHISH S",
        department_id=1,
        year_level="III",
        username="nanthishvaran_07"
    )
    db.add(student)
    db.commit()

    stats = LeetCodeProfileStats(
        id=1,
        student_id=1,
        total_solved=485,
        easy_solved=215,
        medium_solved=205,
        hard_solved=65,
        sync_status="success"
    )
    db.add(stats)
    db.commit()
    db.close()

    yield
    Base.metadata.drop_all(bind=engine)

def test_database_health_endpoint():
    response = client.get("/api/system/database-health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["connection_status"] == "connected"
    assert data["student_count"] == 1
    assert data["stats_count"] == 1
    assert data["verified_count"] == 1

def test_system_status_endpoint():
    response = client.get("/api/system/status")
    assert response.status_code == 200
    data = response.json()
    assert data["system_status"] == "Operational"
