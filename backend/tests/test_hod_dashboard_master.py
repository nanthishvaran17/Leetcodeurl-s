import pytest
from backend.database import SessionLocal
from backend.models import User, Department, Student, FacultyStudentAssignment, LeetCodeProfileStats
from backend.services.hod_analytics_engine import (
    calculate_department_kpi_summary,
    get_todays_action_items,
    get_year_section_heatmap,
    get_progress_status
)

def test_progress_status_traffic_light():
    """Verify traffic light status thresholds (GREEN >=80%, AMBER 60-79%, RED <60%)."""
    assert get_progress_status(95.0) == "GREEN"
    assert get_progress_status(80.0) == "GREEN"
    assert get_progress_status(75.0) == "AMBER"
    assert get_progress_status(60.0) == "AMBER"
    assert get_progress_status(45.0) == "RED"
    assert get_progress_status(0.0) == "RED"

def test_calculate_department_kpi_summary():
    """Verify department KPI calculations based on ground-truth DB records."""
    db = SessionLocal()
    try:
        cse_dept = db.query(Department).filter(Department.code == "CSE").first()
        dept_id = cse_dept.id if cse_dept else 1

        summary = calculate_department_kpi_summary(db, dept_id=dept_id)
        assert "total_staff" in summary
        assert "total_students" in summary
        assert "total_allocated" in summary
        assert "completed" in summary
        assert "pending" in summary
        assert "unassigned" in summary
        assert "overall_progress" in summary
        assert "progress_status" in summary
        assert summary["progress_status"] in ["GREEN", "AMBER", "RED", "GOOD", "WATCH", "ACTION"]
    finally:
        db.close()

def test_todays_action_items():
    """Verify data-driven action items list generation."""
    db = SessionLocal()
    try:
        cse_dept = db.query(Department).filter(Department.code == "CSE").first()
        dept_id = cse_dept.id if cse_dept else 1

        actions = get_todays_action_items(db, dept_id=dept_id)
        assert isinstance(actions, list)
        for act in actions:
            assert "id" in act
            assert "severity" in act
            assert act["severity"] in ["URGENT", "ATTENTION"]
            assert "title" in act
            assert "reason" in act
            assert "count" in act
            assert "action_label" in act
    finally:
        db.close()

def test_year_section_heatmap():
    """Verify Year x Section heatmap performance matrix generation."""
    db = SessionLocal()
    try:
        cse_dept = db.query(Department).filter(Department.code == "CSE").first()
        dept_id = cse_dept.id if cse_dept else 1

        heatmap = get_year_section_heatmap(db, dept_id=dept_id)
        assert isinstance(heatmap, list)
        assert len(heatmap) == 4  # I, II, III, IV Years
        for row in heatmap:
            assert "year" in row
            assert "year_level" in row
            assert "sections" in row
            assert len(row["sections"]) >= 1
    finally:
        db.close()

def test_hod_server_side_department_isolation():
    """Verify server-side RBAC enforces HOD department isolation."""
    db = SessionLocal()
    try:
        mock_hod = User(
            id=9999,
            username="test_hod_cse",
            email="hod.cse@nandhaengg.org",
            role="HOD",
            department_id=1,
            is_active=True
        )
        
        summary = calculate_department_kpi_summary(db, current_user=mock_hod, dept_id=2)
        dept1_students = db.query(Student).filter(Student.department_id == 1, Student.is_active == True).count()
        assert summary["total_students"] == dept1_students
    finally:
        db.close()
