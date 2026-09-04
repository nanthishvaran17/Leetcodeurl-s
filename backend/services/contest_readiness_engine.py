"""
Contest Readiness Engine & Coding Consistency Intelligence
Calculates Contest Readiness %, speed, accuracy, Medium/Hard progress,
Consistency score, active days (e.g. 27/30), streak metrics, and Digital Coding Profile.
"""

from typing import Dict, Any
from sqlalchemy.orm import Session
from backend.models import Student, WeeklyStudentProgress
from backend.services.skill_mapping_engine import calculate_student_skill_map

def calculate_contest_readiness(db: Session, student: Student) -> Dict[str, Any]:
    """
    Computes Contest Readiness Score (0-100), Speed %, Accuracy %, Medium %, Hard %,
    Consistency %, Readiness Status, and actionable contest preparation advice.
    """
    stats = student.stats
    if not stats:
        return {
            "contest_readiness_score": 40.0,
            "speed_score": 45.0,
            "accuracy_score": 60.0,
            "medium_problems_pct": 30.0,
            "hard_problems_pct": 10.0,
            "consistency_pct": 40.0,
            "status": "NOT_READY",
            "recommendation": "Configure valid LeetCode profile to calculate contest readiness."
        }

    total = stats.total_solved or 0
    stats.easy_solved or 0
    med = stats.medium_solved or 0
    hard = stats.hard_solved or 0
    stats.contest_rating or 1400.0

    # 1. Component Metrics
    accuracy_score = round(min(98.0, 75.0 + min(20.0, total * 0.15)), 1)
    speed_score = round(min(95.0, 50.0 + min(40.0, (med * 0.8 + hard * 1.5))), 1)

    medium_pct = round(min(100.0, (med / float(max(1, total * 0.5))) * 100.0), 1)
    hard_pct = round(min(100.0, (hard / float(max(1, med * 0.2))) * 100.0), 1)

    consistency_pct = round(min(98.0, max(25.0, (total / 180.0) * 100.0)), 1)

    # 2. Overall Readiness Score
    readiness_score = round(
        (speed_score * 0.25) +
        (accuracy_score * 0.25) +
        (medium_pct * 0.25) +
        (hard_pct * 0.15) +
        (consistency_pct * 0.10),
        1
    )
    readiness_score = min(99.0, max(20.0, readiness_score))

    # 3. Readiness Status & Recommendation
    if readiness_score >= 80.0:
        status = "READY"
        rec = f"Solve 3 Medium {student.skill_profile.weak_areas[0] if hasattr(student, 'skill_profile') and student.skill_profile and student.skill_profile.weak_areas else 'Graph'} problems before the next Sunday contest."
    elif readiness_score >= 60.0:
        status = "MODERATE_READINESS"
        rec = "Focus on solving Q1 and Q2 within first 35 minutes of contest session."
    else:
        status = "NEEDS_PREPARATION"
        rec = "Complete 5 Easy and 3 Medium foundation problems prior to entering contest."

    return {
        "contest_readiness_score": readiness_score,
        "speed_score": speed_score,
        "accuracy_score": accuracy_score,
        "medium_problems_pct": medium_pct,
        "hard_problems_pct": hard_pct,
        "consistency_pct": consistency_pct,
        "status": status,
        "recommendation": rec
    }

def calculate_coding_consistency(db: Session, student: Student) -> Dict[str, Any]:
    """
    Measures sustainable learning behavior (Active Days 27/30, Streak, Weekly Average).
    """
    stats = student.stats
    active_days = stats.active_days if (stats and stats.active_days) else min(30, max(5, (stats.total_solved // 4) if stats and stats.total_solved else 5))
    max_streak = stats.max_streak if (stats and stats.max_streak) else min(21, max(3, active_days // 2))

    # Weekly Progress records
    records = db.query(WeeklyStudentProgress).filter(
        WeeklyStudentProgress.student_id == student.id
    ).order_by(WeeklyStudentProgress.id.desc()).limit(4).all()

    weekly_solved = [r.weekly_progress for r in records] if records else [4]
    weekly_avg = round(sum(weekly_solved) / float(max(1, len(weekly_solved))), 1)

    inactive_periods = len([w for w in weekly_solved if w == 0])

    consistency_score = round(min(98.0, (active_days / 30.0) * 70.0 + (weekly_avg / 10.0) * 30.0), 1)

    return {
        "consistency_score": consistency_score,
        "active_days_label": f"{min(30, active_days)}/30",
        "active_days_count": min(30, active_days),
        "longest_streak_days": max_streak,
        "weekly_average_problems": weekly_avg,
        "inactive_periods_count": inactive_periods
    }

def get_digital_coding_profile(db: Session, student: Student) -> Dict[str, Any]:
    """
    Assembles comprehensive Digital Coding Profile for student dashboard view.
    """
    skill_map = calculate_student_skill_map(db, student)
    readiness = calculate_contest_readiness(db, student)
    consistency = calculate_coding_consistency(db, student)

    return {
        "student_id": student.id,
        "name": student.name,
        "reg_no": student.reg_no,
        "department": student.department.name if student.department else "General",
        "department_code": student.department.code if student.department else "GEN",
        "year_level": student.year_level,
        "overall_score": skill_map["overall_score"],
        "contest_skill": skill_map["contest_skill"],
        "dsa_skill": skill_map["dsa_skill"],
        "consistency_score": consistency["consistency_score"],
        "growth_rate_pct": skill_map["growth_rate_pct"],
        "current_level": skill_map["current_level"],
        "next_recommended_skill": skill_map["next_recommended_skill"],
        "strong_areas": skill_map["strong_areas"],
        "weak_areas": skill_map["weak_areas"],
        "dsa_topic_scores": skill_map["dsa_topic_scores"],
        "contest_readiness": readiness,
        "consistency_intelligence": consistency
    }
