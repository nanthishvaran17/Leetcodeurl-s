"""
placement_eligibility.py — API Endpoints for AI Predictive Placement Eligibility Engine
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any

from backend.database import get_db
from backend.models import User, Student, LeetCodeProfileStats
from backend.security import require_role, get_current_user_optional
from backend.services.placement_predictor_service import placement_predictor_service

router = APIRouter(prefix="/placement-eligibility", tags=["AI Placement Eligibility"])


@router.get("/summary")
def get_placement_summary(
    dept_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Super Admin", "super admin", "HOD", "hod", "Faculty", "faculty", dept_scoped=True))
):
    """Returns college/department placement tier breakdown and leader lists."""
    user_role = (current_user.role or "").strip().lower()
    target_dept_id = current_user.department_id if (user_role in ["hod", "faculty"] and current_user.department_id) else dept_id
    return placement_predictor_service.get_institutional_placement_summary(db, target_dept_id)


@router.get("/student/{student_id}")
def get_student_placement_profile(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Returns detailed placement readiness analysis for a specific student."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    eval_res = placement_predictor_service.evaluate_student_placement_tier(student.stats, student.year_level)
    return {
        "student_id": student.id,
        "reg_no": student.reg_no,
        "name": student.name,
        "department": student.department.code if student.department else "CSE",
        "year_level": student.year_level,
        "stats": {
            "total_solved": student.stats.total_solved if student.stats else 0,
            "easy_solved": student.stats.easy_solved if student.stats else 0,
            "medium_solved": student.stats.medium_solved if student.stats else 0,
            "hard_solved": student.stats.hard_solved if student.stats else 0,
            "contest_rating": student.stats.contest_rating if student.stats else 0.0,
            "max_streak": student.stats.max_streak if student.stats else 0
        },
        "placement_evaluation": eval_res
    }
