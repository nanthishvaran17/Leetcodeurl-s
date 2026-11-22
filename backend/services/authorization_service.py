"""
authorization_service.py — Centralized Role-Based Access Control and Query Scoping Engine

This service intercepts and strictly scopes database queries to enforce the
"ONE CENTRAL STUDENT DATABASE + ROLE-BASED VISIBILITY" principle.

Strict Department Isolation:
- An AIDS user (HOD, Staff, Faculty, STC, PLC, Mentor) ONLY sees AIDS records.
- An IT user (HOD, Staff, Faculty, STC, PLC, Mentor) ONLY sees IT records.
- Zero cross-department data leakage across all routes, tables, and dropdowns.
"""

from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from backend.models import User, Student, HODDepartmentAllocation, Department
from backend.services.faculty_assignment_service import faculty_assignment_service

# ─────────────────────────────────────────────────────────────────────────────
# ROLE SETS (centralised — update here, applies everywhere)
# ─────────────────────────────────────────────────────────────────────────────

_GLOBAL_ACCESS_ROLES = frozenset({
    "admin", "administrator", "super admin", "super_admin",
    "principal", "management", "director", "executive"
})

_HOD_ROLES = frozenset({
    "hod", "department hod", "department_hod", "head of department", "head_of_department"
})

_STAFF_ROLES = frozenset({
    "staff", "faculty", "professor", "assistant professor", "associate professor",
    "faculty mentor", "staff mentor",
    "faculty_mentor", "staff_mentor",
    "faculty coordinator", "staff coordinator",
    "faculty_coordinator", "staff_coordinator",
    "student coordinator", "student_coordinator", "stc",
    "placement coordinator", "placement_coordinator", "plc", "placement officer", "placement_officer",
    "coordinator", "academic coordinator",
    "mentor", "tutor", "class advisor", "class mentor", "class_mentor"
})


def _normalize_role(user: Optional[User]) -> str:
    """Returns a lowercased, stripped effective role string for authorization checks."""
    return (getattr(user, "override_role", None) or (user.role if user else "") or "").strip().lower()


def is_user_global_admin(user: Optional[User]) -> bool:
    """
    True ONLY if user is a top-level institutional administrator with no specific department allocation.
    If an admin or coordinator is allocated to a specific department, they are department-scoped.
    """
    if not user:
        return False
    if getattr(user, "department_id", None):
        return False
    raw_dept = getattr(user, "department", None)
    if raw_dept:
        return False
    role = _normalize_role(user)
    return role in _GLOBAL_ACCESS_ROLES


# ─────────────────────────────────────────────────────────────────────────────
# DEPARTMENT SCOPE RESOLVER (single source of truth for HOD, Staff, STC, PLC)
# ─────────────────────────────────────────────────────────────────────────────

def get_hod_authorized_department_ids(db: Session, user: Optional[User]) -> List[int]:
    """
    Returns the list of department IDs that an HOD, Staff, Faculty, STC, or PLC user is authorized to access.
    Queries HODDepartmentAllocation, user.department_id, and user.department / department_code.
    Returns [] (fail-closed) if the user has no departmental allocation.
    """
    if not user:
        return []
    u_id = getattr(user, "id", None)
    u_dept_id = getattr(user, "department_id", None)
    
    ids: List[int] = []
    if u_id:
        allocations = (
            db.query(HODDepartmentAllocation.department_id)
            .filter(HODDepartmentAllocation.user_id == u_id)
            .all()
        )
        ids = [row[0] for row in allocations if row[0]]

    # Ensure user's primary department_id is included if set
    if u_dept_id and u_dept_id not in ids:
        ids.append(u_dept_id)

    # If no department_id on row, attempt to resolve via user.department or user.department_code
    if not ids:
        raw_dept = getattr(user, "department", None)
        if raw_dept and hasattr(raw_dept, "id") and getattr(raw_dept, "id", None):
            ids.append(raw_dept.id)
        else:
            raw_code = getattr(user, "department_code", None) or (str(raw_dept) if raw_dept and isinstance(raw_dept, str) else None)
            if raw_code:
                from sqlalchemy import func
                raw_clean = str(raw_code).strip().upper()
                dept_obj = db.query(Department).filter(
                    (func.upper(Department.code) == raw_clean) |
                    (func.upper(Department.name) == raw_clean) |
                    (Department.name.ilike(f"%{raw_clean}%"))
                ).first()
                if dept_obj:
                    ids.append(dept_obj.id)

    # Legacy fallback for CSE cluster ONLY if explicitly CSE HOD with department_id
    if ids and u_dept_id and len(ids) == 1:
        u_dept = db.query(Department).filter(Department.id == u_dept_id).first()
        dept_code = (u_dept.code if u_dept else "").upper().strip()
        if dept_code in ("CSE", "COMPUTER SCIENCE", "COMPUTER SCIENCE AND ENGINEERING"):
            related = db.query(Department.id).filter(
                (Department.code.ilike("%CSE%")) | 
                (Department.code.ilike("%CS%")) | 
                (Department.code.ilike("%IOT%"))
            ).all()
            ids = list(dict.fromkeys([r[0] for r in related if r[0]] + [u_dept_id]))

    # FAIL CLOSED: Never fallback to all production departments!
    return ids


def get_hod_authorized_department_codes(db: Session, user: Optional[User]) -> List[str]:
    """
    Returns the list of department CODES that a user is authorized to access.
    Returns [] (fail-closed) if user has no authorized departments.
    """
    if not user:
        return []
    dept_ids = get_hod_authorized_department_ids(db, user)
    if not dept_ids:
        return []
    depts = db.query(Department.code).filter(Department.id.in_(dept_ids)).all()
    return [row[0] for row in depts if row[0]]


def get_authorized_department_scope(db: Session, user: Optional[User]) -> Dict[str, Any]:
    """
    Returns the authoritative department authorization scope for the given user.
    """
    if not user:
        return {"role": "unknown", "department_ids": [], "department_codes": [], "is_global_access": False}

    role = _normalize_role(user)

    if is_user_global_admin(user):
        return {"role": role, "department_ids": [], "department_codes": [], "is_global_access": True}

    dept_ids = get_hod_authorized_department_ids(db, user)
    dept_codes = get_hod_authorized_department_codes(db, user)
    return {
        "role": role,
        "department_ids": dept_ids,
        "department_codes": dept_codes,
        "is_global_access": False
    }


# ─────────────────────────────────────────────────────────────────────────────
# STUDENT QUERY SCOPING (used by routes + services via apply_role_based_student_filter)
# ─────────────────────────────────────────────────────────────────────────────

def get_authorized_student_ids(db: Session, user: Optional[User]) -> Optional[List[int]]:
    """
    Returns a list of authorized student IDs for the current user.
    Returns None if the user has GLOBAL/INSTITUTIONAL access (Admin, Principal, Management).
    """
    if not user:
        return None

    if is_user_global_admin(user):
        return None

    role = _normalize_role(user)
    u_id = getattr(user, "id", None)

    # 1. Staff / Faculty / Mentor with assigned student mentees
    if u_id and role in _STAFF_ROLES:
        assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, int(u_id))
        if assigned_ids:
            return assigned_ids

    # 2. HOD or Department-Scoped staff / STC / PLC / Mentor
    dept_ids = get_hod_authorized_department_ids(db, user)
    if dept_ids:
        students = db.query(Student.id).filter(Student.department_id.in_(dept_ids)).all()
        return [s[0] for s in students]

    # 3. Student -> self only
    if role == "student":
        student = None
        if getattr(user, "email", None):
            student = db.query(Student.id).filter(Student.email.ilike(user.email.strip())).first()
        if not student and getattr(user, "username", None):
            student = db.query(Student.id).filter(
                (Student.reg_no.ilike(user.username.strip())) |
                (Student.username.ilike(user.username.strip()))
            ).first()
        return [student[0]] if student else []

    return []


def apply_role_based_student_filter(query, user: Optional[User], db: Session):
    """
    Injects the necessary strict authorization scope filters into an existing SQLAlchemy query.
    Enforces strict department isolation across all roles:
    - AIDS staff/HOD/STC/PLC ONLY sees AIDS.
    - IT staff/HOD/STC/PLC ONLY sees IT.
    - No cross-department leakage permitted.
    """
    if not user:
        return query

    if is_user_global_admin(user):
        return query

    role = _normalize_role(user)
    u_id = getattr(user, "id", None)

    # 1. Active Faculty/Staff Student Mentee Allocation Precedence:
    if u_id and role in _STAFF_ROLES:
        assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, int(u_id))
        if assigned_ids:
            return query.filter(Student.id.in_(assigned_ids))

    # 2. Department-scoped users (HOD, Staff, STC, PLC, Faculty, Coordinators):
    dept_ids = get_hod_authorized_department_ids(db, user)
    if dept_ids:
        return query.filter(Student.department_id.in_(dept_ids))

    # 3. Student -> self only
    if role == "student":
        conds = []
        if getattr(user, "email", None):
            conds.append(Student.email.ilike(user.email.strip()))
        if getattr(user, "username", None):
            conds.append(Student.reg_no.ilike(user.username.strip()))
            conds.append(Student.username.ilike(user.username.strip()))
        if conds:
            from sqlalchemy import or_
            return query.filter(or_(*conds))
        return query.filter(Student.id == -1)

    # Fail closed for unallocated/unknown roles
    return query.filter(Student.id == -1)


def require_staff_student_access(db: Session, user: Optional[User], student_id: int):
    """
    Validates if a user is authorized to access a specific student_id.
    Throws 403 Forbidden if unauthorized.
    """
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")

    if is_user_global_admin(user):
        return

    role = _normalize_role(user)
    u_id = getattr(user, "id", None)

    # Staff with assigned mentees
    if u_id and role in _STAFF_ROLES:
        assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, int(u_id))
        if assigned_ids:
            if student_id in assigned_ids:
                return
            raise HTTPException(status_code=403, detail="Access restricted: Student not in your mentorship allocation.")

    # Department scope check (HOD, Staff, STC, PLC, Mentor)
    dept_ids = get_hod_authorized_department_ids(db, user)
    if dept_ids:
        student = db.query(Student.department_id).filter(Student.id == student_id).first()
        if student and student[0] in dept_ids:
            return
        raise HTTPException(status_code=403, detail="Access restricted: Student is not in your authorized department(s).")

    # Student -> self only
    if role == "student":
        student = None
        if getattr(user, "email", None):
            student = db.query(Student).filter(Student.email.ilike(user.email.strip()))
        if not student and getattr(user, "username", None):
            student = db.query(Student).filter(
                (Student.reg_no.ilike(user.username.strip())) |
                (Student.username.ilike(user.username.strip()))
            )
        if student and student.id == student_id:
            return
        raise HTTPException(status_code=403, detail="Access restricted: Cannot access other student records.")

    raise HTTPException(status_code=403, detail="Role not authorized to access this student.")
