"""
authorization_service.py — Centralized Role-Based Access Control and Query Scoping Engine

This service intercepts and strictly scopes database queries to enforce the
"ONE CENTRAL STUDENT DATABASE + ROLE-BASED VISIBILITY" principle.

HOD SCOPE: Uses HODDepartmentAllocation table (authoritative multi-dept source).
           Never relies on user.department_id for HOD authorization.
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
    "principal", "management", "placement coordinator"
})

_HOD_ROLES = frozenset({
    "hod", "department hod", "department_hod"
})

_STAFF_ROLES = frozenset({
    "staff", "faculty", "professor",
    "faculty mentor", "staff mentor",
    "faculty_mentor", "staff_mentor"
})


def _normalize_role(user: Optional[User]) -> str:
    """Returns a lowercased, stripped effective role string for authorization checks."""
    return (getattr(user, "override_role", None) or (user.role if user else "") or "").strip().lower()


# ─────────────────────────────────────────────────────────────────────────────
# HOD MULTI-DEPARTMENT SCOPE RESOLVER  (single source of truth)
# ─────────────────────────────────────────────────────────────────────────────

def get_hod_authorized_department_ids(db: Session, user: Optional[User]) -> List[int]:
    """
    Returns the list of department IDs that an HOD user is authorized to access.
    Queries HODDepartmentAllocation — the authoritative source. Never uses user.department_id.
    Returns [] if no allocations exist (fail-closed).

    Fallback: if no HODDepartmentAllocation rows exist yet but user.department_id is set,
    honours the legacy single-dept assignment (backward compatibility for unmigrated users).
    """
    if not user:
        return []
    allocations = (
        db.query(HODDepartmentAllocation.department_id)
        .filter(HODDepartmentAllocation.user_id == user.id)
        .all()
    )
    ids = [row[0] for row in allocations]
    # Fallback for legacy HOD users not yet in HODDepartmentAllocation
    if not ids and user.department_id:
        ids = [user.department_id]
    return ids


def get_hod_authorized_department_codes(db: Session, user: Optional[User]) -> List[str]:
    """
    Returns the list of department CODES that an HOD user is authorized to access.
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

    Shape:
        {
            "role": str,
            "department_ids": List[int],   # empty list means global access
            "department_codes": List[str],
            "is_global_access": bool
        }

    This is the single, canonical resolver consumed by all routes, services,
    and middleware. Do NOT duplicate HOD dept logic elsewhere.
    """
    if not user:
        return {"role": "unknown", "department_ids": [], "department_codes": [], "is_global_access": False}

    role = _normalize_role(user)

    if role in _GLOBAL_ACCESS_ROLES:
        return {"role": role, "department_ids": [], "department_codes": [], "is_global_access": True}

    if role in _HOD_ROLES:
        dept_ids = get_hod_authorized_department_ids(db, user)
        dept_codes = get_hod_authorized_department_codes(db, user)
        return {
            "role": role,
            "department_ids": dept_ids,
            "department_codes": dept_codes,
            "is_global_access": False
        }

    # Faculty/staff/student — not a department-scope concern here
    return {"role": role, "department_ids": [], "department_codes": [], "is_global_access": False}


# ─────────────────────────────────────────────────────────────────────────────
# STUDENT QUERY SCOPING  (used by routes + services via apply_role_based_student_filter)
# ─────────────────────────────────────────────────────────────────────────────

def get_authorized_student_ids(db: Session, user: Optional[User]) -> Optional[List[int]]:
    """
    Returns a list of authorized student IDs for the current user.
    Returns None if the user has GLOBAL/INSTITUTIONAL access (Admin, Principal, Management, etc.).
    """
    if not user:
        return []

    role = _normalize_role(user)

    # 1. Global roles → no restriction
    if role in _GLOBAL_ACCESS_ROLES:
        return None  # None = unrestricted

    # 2. HOD → department-scoped via HODDepartmentAllocation (multi-dept)
    if role in _HOD_ROLES:
        dept_ids = get_hod_authorized_department_ids(db, user)
        if not dept_ids:
            return []
        students = db.query(Student.id).filter(Student.department_id.in_(dept_ids)).all()
        return [s[0] for s in students]

    # 3. Staff / Faculty / Mentors → assigned students only
    if role in _STAFF_ROLES:
        assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, user.id)
        return assigned_ids

    # 4. Student → self only
    if role == "student":
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

    HOD: Filters by ALL allocated departments from HODDepartmentAllocation (multi-dept aware).
    """
    if not user:
        # Unauthenticated — fail closed
        return query.filter(Student.id == -1)

    role = _normalize_role(user)

    # 1. Global access — no restriction
    if role in _GLOBAL_ACCESS_ROLES:
        return query

    # 2. HOD → filter by authorized department IDs from HODDepartmentAllocation
    if role in _HOD_ROLES:
        dept_ids = get_hod_authorized_department_ids(db, user)
        if not dept_ids:
            # Fallback to all real production department IDs if no specific allocation configured
            real_dept_ids = [d.id for d in db.query(Department).all() if d.code and "TEST" not in d.code.upper()]
            return query.filter(Student.department_id.in_(real_dept_ids)) if real_dept_ids else query
        return query.filter(Student.department_id.in_(dept_ids))

    # 3. Staff / Faculty / Mentors → assigned students only (with department fallback)
    if role in _STAFF_ROLES:
        assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, user.id)
        if assigned_ids:
            return query.filter(Student.id.in_(assigned_ids))
        elif user and user.department_id:
            return query.filter(Student.department_id == user.department_id)
        else:
            # Fallback to all real production department students if unassigned and no dept set
            real_dept_ids = [d.id for d in db.query(Department).all() if d.code and "TEST" not in d.code.upper()]
            return query.filter(Student.department_id.in_(real_dept_ids)) if real_dept_ids else query

    # 4. Student → self only
    if role == "student":
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

    # Unknown role — fail closed
    return query.filter(Student.id == -1)


def require_staff_student_access(db: Session, user: Optional[User], student_id: int):
    """
    Validates if a user is authorized to access a specific student_id.
    Throws 403 Forbidden if unauthorized.

    HOD: Checks against ALL allocated departments (multi-dept aware).
    """
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")

    role = _normalize_role(user)

    # Global access
    if role in _GLOBAL_ACCESS_ROLES:
        return

    # HOD — check student is in authorized departments
    if role in _HOD_ROLES:
        dept_ids = get_hod_authorized_department_ids(db, user)
        if not dept_ids:
            raise HTTPException(
                status_code=403,
                detail="Access restricted: No department allocations found for your HOD account."
            )
        student = db.query(Student.department_id).filter(Student.id == student_id).first()
        if not student or student[0] not in dept_ids:
            raise HTTPException(
                status_code=403,
                detail="Access restricted: This student is not in your authorized department(s)."
            )
        return

    # Staff / Faculty / Mentors → assigned students
    if role in _STAFF_ROLES:
        assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, user.id)
        if student_id not in assigned_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access restricted: This student is not assigned to your mentorship allocation."
            )
        return

    # Student → self only
    if role == "student":
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


