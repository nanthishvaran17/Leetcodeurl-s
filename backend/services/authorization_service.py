"""
authorization_service.py — Centralized Role-Based Access Control and Query Scoping Engine

This service intercepts and strictly scopes database queries to enforce the 
"ONE CENTRAL STUDENT DATABASE + ROLE-BASED VISIBILITY" principle.
"""

from typing import Optional, List
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from backend.models import User, Student
from backend.services.faculty_assignment_service import faculty_assignment_service
from backend.logger import logger

def get_authorized_student_ids(db: Session, user: Optional[User]) -> Optional[List[int]]:
    """
    Returns a list of authorized student IDs for the current user.
    Returns None if the user has GLOBAL/INSTITUTIONAL access (Admin, Principal).
    """
    if not user:
        return []
        
    role_clean = (user.role or "").strip().lower()
    
    # 1. Admin / Super Admin / Principal -> Global Scope
    if role_clean in ("admin", "super admin", "super_admin", "principal"):
        return None  # None indicates no restriction
        
    # 2. HOD -> Department Scope
    if role_clean == "hod":
        if not user.department_id:
            return []
        students = db.query(Student.id).filter(Student.department_id == user.department_id).all()
        return [s[0] for s in students]
        
    # 3. Staff / Faculty -> Assigned Scope
    if role_clean in ("staff", "faculty"):
        return faculty_assignment_service.get_faculty_assigned_student_ids(db, user.id)
        
    # 4. Student -> Self Scope
    if role_clean == "student":
        student = db.query(Student.id).filter(Student.email.ilike(user.email)).first()
        return [student[0]] if student else []
        
    # 5. Placement Coordinator -> Placement Scope (Assuming global for now, or could restrict)
    if role_clean == "placement coordinator":
        return None

    return []


def apply_role_based_student_filter(query, user: Optional[User], db: Session):
    """
    Injects the necessary strict authorization scope filters into an existing SQLAlchemy query.
    This guarantees NO N+1 queries and NO unauthorized data leaks.
    """
    if not user:
        # Unauthenticated users shouldn't see any active private data, but we fail closed.
        return query.filter(Student.id == -1)

    role_clean = (user.role or "").strip().lower()
    
    if role_clean in ("admin", "super admin", "super_admin", "principal", "placement coordinator"):
        # Global Access, return unmodified query
        return query

    if role_clean == "hod":
        if not user.department_id:
            return query.filter(Student.id == -1)
        return query.filter(Student.department_id == user.department_id)

    if role_clean in ("staff", "faculty"):
        assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, user.id)
        if not assigned_ids:
            return query.filter(Student.id == -1)
        return query.filter(Student.id.in_(assigned_ids))

    if role_clean == "student":
        return query.filter(Student.email.ilike(user.email))

    # Fail closed for unknown roles
    return query.filter(Student.id == -1)


def require_staff_student_access(db: Session, user: Optional[User], student_id: int):
    """
    Validates if a user is authorized to access a specific student_id.
    Throws 403 Forbidden if unauthorized.
    """
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")
        
    role_clean = (user.role or "").strip().lower()
    
    if role_clean in ("admin", "super admin", "super_admin", "principal", "placement coordinator"):
        return
        
    if role_clean == "hod":
        if not user.department_id:
            raise HTTPException(status_code=403, detail="HOD Department not assigned.")
        student = db.query(Student.department_id).filter(Student.id == student_id).first()
        if not student or student[0] != user.department_id:
            raise HTTPException(status_code=403, detail="Student is not in your department.")
        return
        
    if role_clean in ("staff", "faculty"):
        assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, user.id)
        if student_id not in assigned_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Access restricted: This student is not assigned to your mentorship allocation (Max 20 students)."
            )
        return

    if role_clean == "student":
        student = db.query(Student).filter(Student.email.ilike(user.email)).first()
        if not student or student.id != student_id:
            raise HTTPException(status_code=403, detail="Access restricted: Cannot access other student records.")
        return

    raise HTTPException(status_code=403, detail="Role not authorized.")
