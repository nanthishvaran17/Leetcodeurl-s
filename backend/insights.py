from typing import Dict, Any, List
from sqlalchemy.orm import Session
from backend.models import Student, LeetCodeProfileStats, WeeklyStudentProgress

def get_student_insights(db: Session, student_id: int) -> Dict[str, Any]:
    """
    Analyzes student stats to recommend weak topic focus areas and rating trajectory.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student or not student.stats:
        return {"focus_areas": [], "trajectory": "STABLE", "recommendation": "Maintain consistent problem solving."}

    easy = student.stats.easy_solved
    med = student.stats.medium_solved
    hard = student.stats.hard_solved
    total = student.stats.total_solved

    focus = []
    if total == 0:
        focus = ["Arrays", "Strings", "Basic Math"]
    elif med < (easy * 0.5):
        focus = ["Medium Array/Hashmap Problems", "Two Pointers", "Sliding Window"]
    elif hard < (med * 0.1):
        focus = ["Dynamic Programming", "Graph Traversal (BFS/DFS)", "Trees & Heaps"]
    else:
        focus = ["System Design Basics", "Advanced DP", "Segment Trees"]

    # Trajectory based on recent weekly progress
    records = db.query(WeeklyStudentProgress).filter(WeeklyStudentProgress.student_id == student_id).order_by(WeeklyStudentProgress.id.desc()).limit(3).all()
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

    return {
        "focus_areas": focus,
        "trajectory": trajectory,
        "recommendation": f"Current distribution: {easy} Easy, {med} Med, {hard} Hard. Focus on {', '.join(focus[:2])} for maximum rating boost."
    }
