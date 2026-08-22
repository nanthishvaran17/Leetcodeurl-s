"""
faculty_assignments.py — API Routes for Faculty-Student Allocation & Workload Tracking

Provides endpoints for managing 1:20 faculty-to-student assignments, workload distribution,
and faculty-scoped student lists.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from backend.database import get_db
from backend.models import User, Student, FacultyStudentAssignment, Department, LeetCodeProfileStats
from backend.security import require_security_access, require_role
from backend.services.faculty_assignment_service import faculty_assignment_service, MAX_STUDENTS_PER_FACULTY
from backend.schemas import StudentOut
from backend.logger import logger

router = APIRouter(prefix="/faculty-assignments", tags=["Faculty Assignments"])


class AssignStudentsRequest(BaseModel):
    faculty_id: int
    student_ids: List[int] = Field(..., min_length=1)


class UnassignStudentsRequest(BaseModel):
    faculty_id: int
    student_ids: List[int] = Field(..., min_length=1)


class AutoDistributeRequest(BaseModel):
    department_id: int


@router.get("/my-students")
def get_my_assigned_students(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Faculty", "faculty", "Staff", "staff", "HOD", "hod", "Admin", "Super Admin"))
):
    """
    Returns the full list of students strictly assigned to the authenticated faculty member.
    No limit on count (20 is recommended mentoring ratio).
    """
    assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, current_user.id)
    
    if not assigned_ids:
        return {
            "faculty_id": current_user.id,
            "faculty_name": current_user.username,
            "total_assigned": 0,
            "recommended_ratio": 20,
            "workload_status": "NORMAL",
            "students": []
        }

    students = db.query(Student).outerjoin(Student.stats).options(
        joinedload(Student.department),
        joinedload(Student.section),
        joinedload(Student.stats)
    ).filter(Student.id.in_(assigned_ids)).all()

    student_list = []
    for s in students:
        st_out = {
            "id": s.id,
            "reg_no": s.reg_no,
            "name": s.name,
            "department": s.department.code if s.department else "CSE",
            "year_level": s.year_level,
            "section": s.section.name if s.section else "A",
            "username": s.username,
            "leetcode_url": s.leetcode_url,
            "total_solved": s.stats.total_solved if s.stats else 0,
            "easy_solved": s.stats.easy_solved if s.stats else 0,
            "medium_solved": s.stats.medium_solved if s.stats else 0,
            "hard_solved": s.stats.hard_solved if s.stats else 0,
            "contest_rating": s.stats.contest_rating if s.stats else 0.0,
            "max_streak": s.stats.max_streak if s.stats else 0,
            "sync_status": s.stats.sync_status if s.stats else "not_started"
        }
        student_list.append(st_out)

    count = len(student_list)
    workload_status = "NORMAL" if count < 20 else ("AT_RATIO" if count == 20 else ("ABOVE_RATIO" if count <= 30 else "HIGH_WORKLOAD"))

    return {
        "faculty_id": current_user.id,
        "faculty_name": current_user.username,
        "total_assigned": count,
        "recommended_ratio": 20,
        "workload_status": workload_status,
        "workload_warning": f"Above recommended ratio ({count}/20)" if count > 20 else None,
        "students": student_list
    }


@router.get("/faculty/{faculty_id}")
def get_faculty_assignments(
    faculty_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin", "HOD", "hod", dept_scoped=True))
):
    """
    HOD/Admin: Retrieves assigned students for a specific faculty member.
    HOD can only view faculty in their department.
    """
    faculty = db.query(User).filter(User.id == faculty_id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty member not found.")

    # HOD department check
    user_role = (current_user.role or "").strip().lower()
    if user_role in ["hod"] and current_user.department_id != faculty.department_id:
        raise HTTPException(
            status_code=403,
            detail="Access restricted: You can only view faculty within your own department."
        )

    assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, faculty_id)
    students = db.query(Student).filter(Student.id.in_(assigned_ids)).all() if assigned_ids else []

    return {
        "faculty_id": faculty.id,
        "faculty_name": faculty.username,
        "department_id": faculty.department_id,
        "total_assigned": len(students),
        "max_allowed": MAX_STUDENTS_PER_FACULTY,
        "slots_remaining": max(0, MAX_STUDENTS_PER_FACULTY - len(students)),
        "students": [
            {
                "id": s.id,
                "reg_no": s.reg_no,
                "name": s.name,
                "department": s.department.code if s.department else "CSE",
                "year_level": s.year_level,
                "username": s.username,
                "total_solved": s.stats.total_solved if s.stats else 0
            }
            for s in students
        ]
    }


@router.post("/assign")
def assign_students(
    payload: AssignStudentsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin", "HOD", "hod", dept_scoped=True))
):
    """
    Assigns students to a faculty member.
    STRICTLY ENFORCES 1 Faculty -> Max 20 Students.
    """
    faculty = db.query(User).filter(User.id == payload.faculty_id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Target faculty member not found.")

    user_role = (current_user.role or "").strip().lower()
    if user_role in ["hod"] and current_user.department_id != faculty.department_id:
        raise HTTPException(
            status_code=403,
            detail="Access restricted: HOD can only assign students to faculty in their own department."
        )

    return faculty_assignment_service.assign_students_to_faculty(
        db=db,
        faculty_id=payload.faculty_id,
        student_ids=payload.student_ids,
        assigned_by_id=current_user.id
    )


@router.post("/unassign")
def unassign_students(
    payload: UnassignStudentsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin", "HOD", "hod", dept_scoped=True))
):
    """Removes student assignments from a faculty member."""
    return faculty_assignment_service.unassign_students(
        db=db,
        faculty_id=payload.faculty_id,
        student_ids=payload.student_ids
    )


@router.post("/auto-distribute")
def auto_distribute_students(
    payload: AutoDistributeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin", "HOD", "hod", dept_scoped=True))
):
    """
    Auto-allocates unassigned department students to active department faculty
    up to 20 students per faculty member in round-robin fashion.
    """
    user_role = (current_user.role or "").strip().lower()
    if user_role in ["hod"] and current_user.department_id != payload.department_id:
        raise HTTPException(
            status_code=403,
            detail="Access restricted: HOD can only auto-distribute students in their own department."
        )

    return faculty_assignment_service.auto_distribute_department(
        db=db,
        department_id=payload.department_id,
        assigned_by_id=current_user.id
    )


@router.get("/workload-summary")
def get_faculty_workload_summary(
    dept_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin", "HOD", "hod", dept_scoped=True))
):
    """
    Returns faculty workload distribution (e.g. 18/20, 20/20) across a department.
    """
    user_role = (current_user.role or "").strip().lower()
    target_dept_id = current_user.department_id if user_role in ["hod"] else dept_id

    query = db.query(User).options(joinedload(User.department)).filter(
        User.is_active == True,
        User.role.in_(["Faculty", "faculty", "Staff", "staff", "HOD", "hod"])
    )
    if target_dept_id:
        query = query.filter(User.department_id == target_dept_id)

    faculty_list = query.all()

    # Efficient single grouped query for all active faculty student counts
    fac_ids = [f.id for f in faculty_list]
    count_rows = db.query(
        FacultyStudentAssignment.faculty_id,
        func.count(FacultyStudentAssignment.id)
    ).filter(
        FacultyStudentAssignment.faculty_id.in_(fac_ids),
        FacultyStudentAssignment.is_active == True
    ).group_by(FacultyStudentAssignment.faculty_id).all() if fac_ids else []

    assigned_counts = {r[0]: r[1] for r in count_rows}
    workload = []

    for fac in faculty_list:
        count = assigned_counts.get(fac.id, 0)
        status_code = "NORMAL" if count < 20 else ("AT_RATIO" if count == 20 else ("ABOVE_RATIO" if count <= 30 else "HIGH_WORKLOAD"))
        status_label = "Normal" if count < 20 else ("At Ratio" if count == 20 else ("Above Ratio" if count <= 30 else "High Workload"))
        workload.append({
            "faculty_id": fac.id,
            "faculty_name": fac.username,
            "email": fac.email,
            "role": fac.role,
            "department_id": fac.department_id,
            "department_name": fac.department.name if fac.department else "General",
            "assigned_students": count,
            "recommended_ratio": 20,
            "workload_status": status_code,
            "workload_label": status_label,
            "is_above_ratio": count > 20
        })

    return {
        "total_faculty": len(faculty_list),
        "target_department_id": target_dept_id,
        "recommended_ratio_per_faculty": 20,
        "faculty_workload": workload
    }
