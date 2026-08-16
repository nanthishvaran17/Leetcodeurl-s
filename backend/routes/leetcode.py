from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional

from backend.database import get_db
from backend.models import Student, WeeklyVirtualResult, ContestParticipation, WeeklyPublicResult
from backend.leetcode_fetcher import fetch_leetcode_profile_sync

router = APIRouter(prefix="/leetcode", tags=["LeetCode Data"])

@router.get("/stats", response_model=Dict[str, Any])
def get_live_leetcode_stats(username: str, db: Session = Depends(get_db)):
    """
    Live fetch LeetCode statistics for a given username and reconcile institutional 
    virtual contest participation metrics.
    Returns status ('ATTENDED' or 'NOT_ATTENDED') and virtual contest attended count.
    """
    if not username or not username.strip():
        raise HTTPException(status_code=400, detail="Username is required.")
        
    cleaned_user = username.strip().lower()
    stats = fetch_leetcode_profile_sync(cleaned_user, force_refresh=True)
    
    if stats.get("sync_status") == "failed" or stats.get("total_solved") is None:
        raise HTTPException(status_code=404, detail=stats.get("error_message") or stats.get("error") or "Failed to fetch profile")

    # Reconcile virtual contest attendance from institutional database
    virtual_attended_count = 0
    virtual_problems_solved = 0

    student = db.query(Student).filter(Student.username.ilike(cleaned_user)).first()
    if student:
        # Check WeeklyVirtualResult records
        v_results = db.query(WeeklyVirtualResult).filter(
            WeeklyVirtualResult.student_id == student.id,
            WeeklyVirtualResult.participation_status.in_(["VIRTUAL_ATTENDED", "ATTENDED"])
        ).all()
        
        # Check ContestParticipation records
        c_parts = db.query(ContestParticipation).filter(
            ContestParticipation.student_id == student.id,
            ContestParticipation.participation_type == "VIRTUAL",
            (ContestParticipation.submitted == True) | (ContestParticipation.problems_solved > 0)
        ).all()

        # Check WeeklyPublicResult records marked VIRTUAL_ATTENDED
        p_virt = db.query(WeeklyPublicResult).filter(
            WeeklyPublicResult.student_id == student.id,
            WeeklyPublicResult.participation_status == "VIRTUAL_ATTENDED"
        ).all()

        virtual_attended_count = max(len(v_results), len(c_parts), len(p_virt))
        if v_results:
            virtual_problems_solved = sum(r.total_contest_solved or 0 for r in v_results)
        elif c_parts:
            virtual_problems_solved = sum(p.problems_solved or 0 for p in c_parts)

    virtual_status = "ATTENDED" if virtual_attended_count > 0 else "NOT_ATTENDED"

    return {
        "username": stats.get("username") or cleaned_user,
        "total_solved": stats.get("total_solved", 0),
        "easy_solved": stats.get("easy_solved", 0),
        "medium_solved": stats.get("medium_solved", 0),
        "hard_solved": stats.get("hard_solved", 0),
        "official_contests": stats.get("contest_participations") and len(stats.get("contest_participations")) or 0,
        "contest_rating": stats.get("contest_rating"),
        "virtual_contest_status": virtual_status,
        "virtual_contests": virtual_attended_count,
        "virtual_problems_solved": virtual_problems_solved
    }
