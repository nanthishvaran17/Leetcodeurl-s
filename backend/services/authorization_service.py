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

def get_authorized_student_ids(db: Session, user: Optional[User]) -> Optional[List[int]]:
    """
    Returns a list of authorized student IDs for the current user.
    Returns None if the user has GLOBAL/INSTITUTIONAL access (Admin, Principal).
    """
    if not user:
        return []
        
    role_clean = (getattr(user, "override_role", None) or user.role or "").strip().lower()
    
    # 1. Admin / Super Admin / Principal / Administrator -> Global Scope
    if role_clean in ("admin", "administrator", "super admin", "super_admin", "principal", "placement coordinator"):
        return None  # None indicates no restriction
        
    # 2. HOD / Department HOD -> Department Scope
    if role_clean in ("hod", "department hod", "department_hod"):
        if not user.department_id:
            return []
        students = db.query(Student.id).filter(Student.department_id == user.department_id).all()
        return [s[0] for s in students]
        
    # 3. Staff / Faculty / Mentors -> Assigned Scope (or Dept Fallback)
    if role_clean in ("staff", "faculty", "professor", "faculty mentor", "staff mentor", "faculty_mentor", "staff_mentor"):
        assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, user.id)
        if assigned_ids:
            return assigned_ids
        if user.department_id:
            students = db.query(Student.id).filter(Student.department_id == user.department_id).all()
            return [s[0] for s in students]
        return None  # Fallback to all students if no department lock
        
    # 4. Student -> Self Scope
    if role_clean == "student":
        student = None
        if user.email:
            student = db.query(Student.id).filter(Student.email.ilike(user.email.strip())).first()
        if not student and user.username:
            student = db.query(Student.id).filter(
                (Student.reg_no.ilike(user.username.strip())) |
                (Student.username.ilike(user.username.strip()))
            ).first()
        return [student[0]] if student else []

    return []


def apply_role_based_student_filter(query, user: Optional[User], db: Session):
    """
    Injects the necessary strict authorization scope filters into an existing SQLAlchemy query.
    This guarantees NO N+1 queries and NO unauthorized data leaks.
    """
    if not user:
        # Unauthenticated users shouldn't see any active private data, but we fail closed.
        return query.filter(Student.id == -1)

    role_clean = (getattr(user, "override_role", None) or user.role or "").strip().lower()
    
    if role_clean in ("admin", "administrator", "super admin", "super_admin", "principal", "placement coordinator"):
        # Global Access, return unmodified query
        return query

    if role_clean in ("hod", "department hod", "department_hod"):
        if not user.department_id or user.department_id == 0:
            return query
        return query.filter(Student.department_id == user.department_id)

    if role_clean in ("staff", "faculty", "professor", "faculty mentor", "staff mentor", "faculty_mentor", "staff_mentor"):
        assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, user.id)
        if assigned_ids:
            return query.filter(Student.id.in_(assigned_ids))
        # Fallback if no specific students assigned yet: view department students or all students
        if user.department_id and user.department_id != 0:
            return query.filter(Student.department_id == user.department_id)
        return query

    if role_clean == "student":
        conds = []
        if user.email:
            conds.append(Student.email.ilike(user.email.strip()))
        if user.username:
            conds.append(Student.reg_no.ilike(user.username.strip()))
            conds.append(Student.username.ilike(user.username.strip()))
        if conds:
            from sqlalchemy import or_
            return query.filter(or_(*conds))
        return query.filter(Student.id == -1)

    # Fail closed for unknown roles
    return query.filter(Student.id == -1)


def require_staff_student_access(db: Session, user: Optional[User], student_id: int):
    """
    Validates if a user is authorized to access a specific student_id.
    Throws 403 Forbidden if unauthorized.
    """
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")
        
    role_clean = (getattr(user, "override_role", None) or user.role or "").strip().lower()
    
    if role_clean in ("admin", "administrator", "super admin", "super_admin", "principal", "placement coordinator"):
        return
        
    if role_clean in ("hod", "department hod", "department_hod"):
        if not user.department_id or user.department_id == 0:
            return
        student = db.query(Student.department_id).filter(Student.id == student_id).first()
        if not student or student[0] != user.department_id:
            raise HTTPException(status_code=403, detail="Student is not in your department.")
        return
        
    if role_clean in ("staff", "faculty", "professor", "faculty mentor", "staff mentor", "faculty_mentor", "staff_mentor"):
        assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, user.id)
        if assigned_ids and student_id not in assigned_ids:
            if user.department_id and user.department_id != 0:
                student = db.query(Student.department_id).filter(Student.id == student_id).first()
                if student and student[0] == user.department_id:
                    return
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Access restricted: This student is not assigned to your mentorship allocation."
            )
        return

    if role_clean == "student":
        student = None
        if user.email:
            student = db.query(Student).filter(Student.email.ilike(user.email.strip())).first()
        if not student and user.username:
            student = db.query(Student).filter(
                (Student.reg_no.ilike(user.username.strip())) |
                (Student.username.ilike(user.username.strip()))
            ).first()
        if not student or student.id != student_id:
            raise HTTPException(status_code=403, detail="Access restricted: Cannot access other student records.")
        return

    raise HTTPException(status_code=403, detail="Role not authorized.")
