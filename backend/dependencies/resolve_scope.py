from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.database import get_db
from backend.routes.auth import get_current_user
from backend.models import User, Student, FacultyStudentAssignment

def resolve_scope(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Optional[List[int]]:
    """
    Evaluates the user's role and returns a list of allowed student_ids.
    Returns None if the user has global/unrestricted access.
    Returns an empty list if the user has no access.
    """
    role = current_user.role.lower() if current_user.role else ""
    
    # Global Access Roles
    if role in ["super admin", "admin", "hr", "placement officer", "viewer"]:
        return None
        
    # Department Head Access
    if role in ["hod", "department head", "dept head"]:
        if not current_user.department_id:
            return []
        students = db.query(Student.id).filter(Student.department_id == current_user.department_id).all()
        return [s.id for s in students]
        
    # Faculty / Mentor Access
    if role in ["faculty", "staff", "mentor"]:
        allowed_ids = set()
        
        # 1. Explicitly assigned students
        assigned = db.query(FacultyStudentAssignment.student_id).filter(
            FacultyStudentAssignment.faculty_id == current_user.id,
            FacultyStudentAssignment.is_active == True
        ).all()
        allowed_ids.update(a.student_id for a in assigned)
        
        # 2. Implicit access via Section assignment
        if current_user.section_id:
            section_students = db.query(Student.id).filter(
                Student.section_id == current_user.section_id
            ).all()
            allowed_ids.update(s.id for s in section_students)
            
        return list(allowed_ids)
        
    # Student Access (if they login via User model)
    if role == "student":
        student = db.query(Student.id).filter(Student.email == current_user.email).first()
        if student:
            return [student.id]
        return []
        
    # Fallback: No access
    return []
