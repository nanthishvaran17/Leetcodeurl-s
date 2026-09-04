"""
gamification.py — API Endpoints for Gamification & Digital Badges
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Student
from backend.services.gamification_service import gamification_service, BADGE_DEFINITIONS

router = APIRouter(prefix="/gamification", tags=["Gamification & Badges"])


@router.get("/badges")
def get_all_badge_catalog():
    """Returns the full master catalog of all available gamification badges."""
    return BADGE_DEFINITIONS


@router.get("/student/{student_id}")
def get_student_badges(student_id: int, db: Session = Depends(get_db)):
    """Returns unlocked and in-progress badges for a specific student."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    badges = gamification_service.evaluate_student_badges(student)
    unlocked_count = sum(1 for b in badges if b["is_unlocked"])
    return {
        "student_id": student.id,
        "name": student.name,
        "unlocked_count": unlocked_count,
        "total_available": len(badges),
        "badges": badges
    }


@router.get("/leaderboard")
def get_badge_hall_of_fame(limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)):
    """Returns the top badge achievers across the college."""
    return gamification_service.get_hall_of_fame_badges_leaderboard(db, limit)
