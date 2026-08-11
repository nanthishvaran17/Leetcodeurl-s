from typing import Dict, Any, List
import datetime
from sqlalchemy.orm import Session
from backend.models import Student, LeetCodeProfileStats, WeeklyStudentProgress, StudentStatSnapshot

def calculate_student_risk_profile(db: Session, student: Student) -> Dict[str, Any]:
    """
    Calculates dynamic risk level, engagement score (0-100), and intervention recommendation for a student.
    Risk Levels:
      - 'EXCELLENT'  : High problem output, high streak, active
      - 'CONSISTENT' : Meeting weekly targets consistently
      - 'NEEDS_ATTENTION': Low progress in past 2 weeks
      - 'AT_RISK'    : Zero progress in past 3 weeks or < 10 total solved
      - 'CRITICAL'   : Profile unlinked, missing, or persistent 0 progress for > 4 weeks
    """
    stats = student.stats
    if not stats or stats.sync_status != "success":
        status_upper = (stats.status if stats else "").upper()
        if "MISSING" in status_upper or "INVALID" in status_upper or "NOT FOUND" in status_upper:
            return {
                "risk_level": "CRITICAL",
                "engagement_score": 0.0,
                "reason": f"Invalid/missing LeetCode profile URL ({stats.status if stats else 'UNCONFIGURED'}).",
                "recommended_action": "Require student to submit verified LeetCode profile link immediately."
            }
        return {
            "risk_level": "NEEDS_ATTENTION",
            "engagement_score": 20.0,
            "reason": "Profile fetch pending or stats unavailable.",
            "recommended_action": "Trigger manual profile refresh to verify active status."
        }

    total = stats.total_solved or 0
    easy = stats.easy_solved or 0
    med = stats.medium_solved or 0
    hard = stats.hard_solved or 0

    # Fetch recent progress records
    progress_records = db.query(WeeklyStudentProgress).filter(
        WeeklyStudentProgress.student_id == student.id
    ).order_by(WeeklyStudentProgress.id.desc()).limit(4).all()

    weekly_progresses = [p.weekly_progress for p in progress_records] if progress_records else [0]
    avg_recent_progress = sum(weekly_progresses) / max(1, len(weekly_progresses))
    recent_streak = progress_records[0].streak_count if progress_records else 0

    # Compute Engagement Score (0 to 100)
    total_score = min(40.0, (total / 250.0) * 40.0)
    velocity_score = min(30.0, (avg_recent_progress / 10.0) * 30.0)
    streak_score = min(20.0, (recent_streak / 10.0) * 20.0)
    diff_score = 10.0 if (med + hard) > 0 else (5.0 if easy > 0 else 0.0)

    engagement_score = round(total_score + velocity_score + streak_score + diff_score, 1)

    # Classify Risk Level
    if total < 10 or (len(weekly_progresses) >= 3 and sum(weekly_progresses[:3]) == 0):
        risk_level = "CRITICAL"
        reason = "Severe inactivity (< 10 total problems or zero progress over past 3 weeks)."
        action = "Schedule 1-on-1 mentor intervention session; assign mandatory DSA foundation modules."
    elif avg_recent_progress < 2.0 or engagement_score < 40.0:
        risk_level = "AT_RISK"
        reason = "Low problem-solving velocity (< 2 problems/week avg)."
        action = "Issue weekly target reminder and review daily practice habits."
    elif avg_recent_progress < 5.0 or engagement_score < 65.0:
        risk_level = "NEEDS_ATTENTION"
        reason = "Moderate engagement; steady but needs acceleration towards medium/hard problems."
        action = "Encourage participation in Sunday contests and medium-level problem sets."
    elif engagement_score >= 85.0:
        risk_level = "EXCELLENT"
        reason = "Outstanding consistency and high problem-solving output."
        action = "Nominate for Top Solver Spotlight and peer mentor leadership."
    else:
        risk_level = "CONSISTENT"
        reason = "Consistent problem-solving trajectory meeting college baseline expectations."
        action = "Maintain regular practice and track contest rating improvement."

    return {
        "risk_level": risk_level,
        "engagement_score": engagement_score,
        "reason": reason,
        "recommended_action": action,
        "avg_recent_progress": round(avg_recent_progress, 1),
        "total_solved": total,
        "streak_count": recent_streak
    }

def get_student_insights(db: Session, student_id: int) -> Dict[str, Any]:
    """
    Analyzes student stats to recommend weak topic focus areas and rating trajectory.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student or not student.stats:
        return {
            "focus_areas": ["Arrays", "Strings"],
            "trajectory": "STABLE",
            "recommendation": "Maintain consistent problem solving.",
            "risk_profile": {
                "risk_level": "NEEDS_ATTENTION",
                "engagement_score": 0.0,
                "reason": "No profile stats.",
                "recommended_action": "Verify profile URL."
            }
        }

    easy = student.stats.easy_solved or 0
    med = student.stats.medium_solved or 0
    hard = student.stats.hard_solved or 0
    total = student.stats.total_solved or 0

    focus = []
    if total == 0:
        focus = ["Arrays", "Strings", "Basic Math"]
    elif med < (easy * 0.5):
        focus = ["Medium Array/Hashmap Problems", "Two Pointers", "Sliding Window"]
    elif hard < (med * 0.1):
        focus = ["Dynamic Programming", "Graph Traversal (BFS/DFS)", "Trees & Heaps"]
    else:
        focus = ["System Design Basics", "Advanced DP", "Segment Trees"]

    records = db.query(WeeklyStudentProgress).filter(
        WeeklyStudentProgress.student_id == student_id
    ).order_by(WeeklyStudentProgress.id.desc()).limit(3).all()

    if records:
        recent_prog = [r.weekly_progress for r in records]
        avg_prog = sum(recent_prog) / len(recent_prog)
        if avg_prog >= 5:
            trajectory = "ACCELERATING"
        elif avg_prog > 0:
            trajectory = "STABLE"
        else:
            trajectory = "SLACKING"
    else:
        trajectory = "STABLE"

    risk_profile = calculate_student_risk_profile(db, student)

    return {
        "focus_areas": focus,
        "trajectory": trajectory,
        "recommendation": f"Current distribution: {easy} Easy, {med} Med, {hard} Hard. Focus on {', '.join(focus[:2])} for maximum rating boost.",
        "risk_profile": risk_profile
    }
