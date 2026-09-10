import pytest
from unittest.mock import MagicMock
from backend.models import User, Student, FacultyStudentAssignment
from backend.dependencies.resolve_scope import resolve_scope

@pytest.fixture
def mock_db():
    return MagicMock()

def test_resolve_scope_global_access(mock_db):
    user = User(role="Admin")
    # Global roles return None
    assert resolve_scope(current_user=user, db=mock_db) is None
    
    user = User(role="HR")
    assert resolve_scope(current_user=user, db=mock_db) is None

def test_resolve_scope_hod_access(mock_db):
    user = User(role="HOD", department_id=1)
    
    # Mock students in department
    mock_student1 = MagicMock(id=101)
    mock_student2 = MagicMock(id=102)
    mock_db.query.return_value.filter.return_value.all.return_value = [mock_student1, mock_student2]
    
    result = resolve_scope(current_user=user, db=mock_db)
    assert result == [101, 102]

def test_resolve_scope_faculty_no_leakage(mock_db):
    # Faculty with ID 5 and assigned to section 2
    user = User(id=5, role="Faculty", section_id=2)
    
    # Explicit assignment for student 201
    mock_assignment = MagicMock(student_id=201)
    
    # Section students: 202, 203
    mock_student2 = MagicMock(id=202)
    mock_student3 = MagicMock(id=203)
    
    # Mocking multiple calls sequentially
    mock_db.query.return_value.filter.return_value.all.side_effect = [
        [mock_assignment], # 1st call for assignments
        [mock_student2, mock_student3] # 2nd call for section
    ]
    
    result = resolve_scope(current_user=user, db=mock_db)
    
    # Verify set union works properly and no other IDs are present
    assert sorted(result) == [201, 202, 203]

def test_resolve_scope_unauthorized_empty(mock_db):
    user = User(role="Viewer_Unknown")
    result = resolve_scope(current_user=user, db=mock_db)
    assert result == []
