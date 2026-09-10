from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Dict, Any, List, Optional
import time

from backend.models import (
    NLCICoreProfile,
    NLCIDailySnapshot,
    NLCILanguageStat,
    NLCIContest,
    NLCIContestParticipation,
    NLCISyncLog
)

def log_sync(db: Session, status: str, attempted: int, succeeded: int, failed: int, error_summary: str = "", triggered_by: str = "system") -> int:
    log_entry = NLCISyncLog(
        started_at=datetime.utcnow().isoformat(),
        finished_at=datetime.utcnow().isoformat(),
        status=status,
        students_attempted=attempted,
        students_succeeded=succeeded,
        students_failed=failed,
        error_summary=error_summary,
        triggered_by=triggered_by
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    return log_entry.id

def upsert_nlci_profile(db: Session, student_id: int, data: Dict[str, Any]):
    """Idempotent upsert for NLCICoreProfile."""
    profile = db.query(NLCICoreProfile).filter(NLCICoreProfile.student_id == student_id).first()
    if not profile:
        profile = NLCICoreProfile(student_id=student_id)
        db.add(profile)
        
    profile.leetcode_username = data.get("username")
    profile.ranking = data.get("ranking")
    profile.total_solved = data.get("total_solved")
    profile.easy_solved = data.get("easy_solved")
    profile.medium_solved = data.get("medium_solved")
    profile.hard_solved = data.get("hard_solved")
    profile.total_submissions = data.get("total_submissions")
    profile.total_accepted = data.get("total_accepted")
    profile.acceptance_rate = data.get("acceptance_rate")
    profile.contest_rating = data.get("contest_rating")
    profile.contest_global_rank = data.get("contest_global_rank")
    profile.contests_attended = data.get("contests_attended")
    profile.fetched_at = datetime.utcnow().isoformat()
    profile.is_valid = 1
    
    db.commit()

def upsert_nlci_daily_snapshot(db: Session, student_id: int, data: Dict[str, Any]):
    """Idempotent daily snapshot."""
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    
    snapshot = db.query(NLCIDailySnapshot).filter(
        NLCIDailySnapshot.student_id == student_id,
        NLCIDailySnapshot.snapshot_date == today_str
    ).first()
    
    if not snapshot:
        snapshot = NLCIDailySnapshot(student_id=student_id, snapshot_date=today_str)
        db.add(snapshot)
        
    snapshot.total_solved = data.get("total_solved")
    snapshot.easy_solved = data.get("easy_solved")
    snapshot.medium_solved = data.get("medium_solved")
    snapshot.hard_solved = data.get("hard_solved")
    snapshot.contest_rating = data.get("contest_rating")
    snapshot.acceptance_rate = data.get("acceptance_rate")
    db.commit()

def process_student_sync(db: Session, student_id: int, profile_data: Dict[str, Any]):
    """Main wrapper for processing all data streams for a student."""
    upsert_nlci_profile(db, student_id, profile_data)
    upsert_nlci_daily_snapshot(db, student_id, profile_data)
