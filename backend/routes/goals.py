from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import datetime

from backend.database import get_db
from backend.models import Student, StudentGoal, AuditLog
from backend.routes.auth import get_current_user

router = APIRouter(prefix="/api/goals", tags=["Student Goal Engine"])

class GoalCreate(BaseModel):
    target_solved: int
    target_date: str # YYYY-MM-DD

@router.get("/{student_id}")
def get_student_goal(student_id: int, db: Session = Depends(get_db)):
    """
    Returns current goal and progress percentage for student.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    goal = db.query(StudentGoal).filter(
        StudentGoal.student_id == student_id,
        StudentGoal.status == "IN_PROGRESS"
    ).order_by(StudentGoal.id.desc()).first()

    if not goal:
        return {"has_active_goal": False, "goal": None}

    current_solved = (student.stats.total_solved or 0) if student.stats else 0
    progress_pct = min(100.0, round((current_solved / max(1, goal.target_solved)) * 100.0, 1))

    # Auto-complete check
    if current_solved >= goal.target_solved and goal.status == "IN_PROGRESS":
        goal.status = "COMPLETED"
        goal.completed_at = datetime.datetime.utcnow()
        db.commit()

    return {
        "has_active_goal": True,
        "goal_id": goal.id,
        "target_solved": goal.target_solved,
        "current_solved": current_solved,
        "progress_percentage": progress_pct,
        "target_date": goal.target_date,
        "status": goal.status
    }

@router.post("/{student_id}")
def set_student_goal(
    student_id: int,
    goal_in: GoalCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Creates or updates the active goal target for a student.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    # Archive previous active goals
    db.query(StudentGoal).filter(
        StudentGoal.student_id == student_id,
        StudentGoal.status == "IN_PROGRESS"
    ).update({"status": "ARCHIVED"})

    new_goal = StudentGoal(
        student_id=student_id,
        target_solved=goal_in.target_solved,
        target_date=goal_in.target_date,
        status="IN_PROGRESS",
        created_at=datetime.datetime.utcnow()
    )
    db.add(new_goal)

    audit = AuditLog(
        user_id=current_user.id,
        user_name=current_user.username,
        action="SET_STUDENT_GOAL",
        details=f"Set goal of {goal_in.target_solved} problems by {goal_in.target_date} for student {student.reg_no}"
    )
    db.add(audit)
    db.commit()
    db.refresh(new_goal)

    return {
        "message": f"Successfully set target goal of {goal_in.target_solved} problems.",
        "goal_id": new_goal.id,
        "target_solved": new_goal.target_solved,
        "target_date": new_goal.target_date
    }
