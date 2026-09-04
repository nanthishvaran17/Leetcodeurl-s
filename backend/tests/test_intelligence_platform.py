import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database import Base
from backend.models import Student, Department, LeetCodeProfileStats
from backend.services.student_risk_engine import calculate_student_risk_engine
from backend.services.skill_mapping_engine import calculate_student_skill_map
from backend.services.learning_path_generator import generate_personalized_learning_path
from backend.services.contest_readiness_engine import get_digital_coding_profile
from backend.services.faculty_action_engine import get_what_needs_attention_items, create_faculty_intervention, calculate_intervention_effectiveness
from backend.services.hod_analytics_engine import calculate_department_health_score, simulate_what_if_scenario
from backend.services.ai_query_engine import answer_ai_department_query

@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    # Create dummy department & student
    dept = Department(name="Cyber Security", code="CSE(CS)")
    db.add(dept)
    db.commit()
    db.refresh(dept)

    student = Student(
        reg_no="731623104001",
        name="Test Student",
        department_id=dept.id,
        year_level="III",
        is_active=True
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    stats = LeetCodeProfileStats(
        student_id=student.id,
        total_solved=145,
        easy_solved=60,
        medium_solved=70,
        hard_solved=15,
        contest_rating=1580.0,
        active_days=24,
        max_streak=14,
        sync_status="success"
    )
    db.add(stats)
    db.commit()

    yield db
    db.close()

def test_risk_engine(test_db):
    student = test_db.query(Student).first()
    res = calculate_student_risk_engine(test_db, student)
    assert "risk_score" in res
    assert "risk_level" in res
    assert "evidence" in res
    assert "explanation" in res

def test_skill_mapping(test_db):
    student = test_db.query(Student).first()
    res = calculate_student_skill_map(test_db, student)
    assert res["overall_score"] > 0
    assert len(res["dsa_topic_scores"]) == 16
    assert "Arrays" in res["dsa_topic_scores"]
    assert "Dynamic Programming" in res["dsa_topic_scores"]

def test_learning_path(test_db):
    student = test_db.query(Student).first()
    res = generate_personalized_learning_path(test_db, student)
    assert len(res["weeks"]) == 4

def test_digital_profile(test_db):
    student = test_db.query(Student).first()
    res = get_digital_coding_profile(test_db, student)
    assert res["name"] == "Test Student"
    assert "contest_readiness" in res

def test_faculty_action_engine(test_db):
    att = get_what_needs_attention_items(test_db)
    assert "total_attention_items" in att

    student = test_db.query(Student).first()
    intervention = create_faculty_intervention(
        test_db,
        student_id=student.id,
        faculty_id=None,
        title="DP Sprint",
        reason="Weak DP accuracy",
        assigned_topics=["Dynamic Programming"]
    )
    assert intervention.id is not None

    eff = calculate_intervention_effectiveness(test_db)
    assert eff["total_interventions"] >= 1

def test_hod_analytics_engine(test_db):
    health = calculate_department_health_score(test_db)
    assert health["health_score"] > 0

    sim = simulate_what_if_scenario(72.0, 87.0, 12)
    assert "estimated_growth_boost_pct" in sim

def test_ai_query_engine(test_db):
    res = answer_ai_department_query(test_db, "Which students need attention?")
    assert "answer" in res
    assert res["data_confidence"] == "HIGH"
