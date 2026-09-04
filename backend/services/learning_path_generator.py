"""
Personalized AI Learning Path Generator
Generates student-specific 4-week adaptive learning plans based on weak topics,
difficulty progression, contest performance, solved count, and accuracy.
"""

import datetime
from typing import Dict, Any
from sqlalchemy.orm import Session
from backend.models import Student, StudentLearningPath
from backend.services.skill_mapping_engine import calculate_student_skill_map

def generate_personalized_learning_path(db: Session, student: Student) -> Dict[str, Any]:
    """
    Generates a 4-week adaptive DSA & Contest learning plan tailored to the student's
    weakest topics, current difficulty level, and solving velocity.
    """
    skill_map = calculate_student_skill_map(db, student)
    weak_topics = skill_map.get("weak_areas", ["Dynamic Programming", "Graph", "Trees"])
    strong_topics = skill_map.get("strong_areas", ["Arrays", "Strings"])
    current_level = skill_map.get("current_level", "INTERMEDIATE")

    primary_weak = weak_topics[0] if weak_topics else "Dynamic Programming"
    secondary_weak = weak_topics[1] if len(weak_topics) > 1 else "Graph"
    tertiary_weak = weak_topics[2] if len(weak_topics) > 2 else "Trees"

    # Difficulty Distribution based on Current Level
    if current_level == "BEGINNER":
        w1_easy, w1_med, w1_hard = 5, 2, 0
        w2_easy, w2_med, w2_hard = 4, 3, 0
        w3_easy, w3_med, w3_hard = 3, 4, 1
    elif current_level == "INTERMEDIATE":
        w1_easy, w1_med, w1_hard = 3, 4, 0
        w2_easy, w2_med, w2_hard = 2, 5, 1
        w3_easy, w3_med, w3_hard = 1, 5, 2
    else: # ADVANCED / EXPERT
        w1_easy, w1_med, w1_hard = 2, 4, 1
        w2_easy, w2_med, w2_hard = 1, 5, 2
        w3_easy, w3_med, w3_hard = 0, 4, 3

    weeks_plan = [
        {
            "week_number": 1,
            "title": f"Foundation & Targeted Mastery: {primary_weak}",
            "focus_topic": primary_weak,
            "target_problems": {
                "easy": w1_easy,
                "medium": w1_med,
                "hard": w1_hard,
                "total": w1_easy + w1_med + w1_hard
            },
            "recommended_problem_titles": [
                f"Basic {primary_weak} Pattern Recognition (Easy)",
                f"Standard {primary_weak} Traversal / State Transition (Medium)",
                f"Optimized {primary_weak} Space/Time Complexity (Medium)"
            ],
            "goal": f"Build solid concept clarity in {primary_weak} and master top 3 problem patterns.",
            "completed": False
        },
        {
            "week_number": 2,
            "title": f"Intermediate Acceleration: {primary_weak} & {secondary_weak}",
            "focus_topic": f"{primary_weak} + {secondary_weak}",
            "target_problems": {
                "easy": w2_easy,
                "medium": w2_med,
                "hard": w2_hard,
                "total": w2_easy + w2_med + w2_hard
            },
            "recommended_problem_titles": [
                f"Multi-state {primary_weak} Optimization (Medium)",
                f"Core {secondary_weak} Implementation (Medium)",
                f"Combined {secondary_weak} with {strong_topics[0]} (Medium/Hard)"
            ],
            "goal": f"Elevate Medium solving velocity in {secondary_weak} and tackle multi-condition problems.",
            "completed": False
        },
        {
            "week_number": 3,
            "title": f"Contest Simulation & Multi-Topic Speed Sprint: {tertiary_weak}",
            "focus_topic": f"{tertiary_weak} & Contest Speed",
            "target_problems": {
                "easy": w3_easy,
                "medium": w3_med,
                "hard": w3_hard,
                "total": w3_easy + w3_med + w3_hard
            },
            "recommended_problem_titles": [
                f"Timed {tertiary_weak} Contest Problem (Medium)",
                f"LeetCode Sunday Contest Virtual Simulation (3/4 Target)",
                f"Hard {primary_weak} Challenge Problem"
            ],
            "goal": "Simulate real Sunday contest conditions under 90-minute time constraints.",
            "completed": False
        },
        {
            "week_number": 4,
            "title": "Comprehensive Skill Reassessment & Peer Benchmarking",
            "focus_topic": "All Weak Topics & Mock Assessment",
            "target_problems": {
                "easy": 2,
                "medium": 4,
                "hard": 2,
                "total": 8
            },
            "recommended_problem_titles": [
                "Institutional Mock Coding Assessment (4 Problems)",
                "Weak Topic Review Set",
                "Advanced Problem Review"
            ],
            "goal": "Re-evaluate DSA Skill Radar and measure Rating + Solved Count growth.",
            "completed": False
        }
    ]

    return {
        "title": f"Adaptive 4-Week {current_level} DSA Acceleration Plan",
        "status": "ACTIVE",
        "current_week": 1,
        "weeks": weeks_plan
    }

def update_or_create_learning_path(db: Session, student: Student) -> StudentLearningPath:
    """
    Persists learning path to database.
    """
    res = generate_personalized_learning_path(db, student)

    path = db.query(StudentLearningPath).filter(
        StudentLearningPath.student_id == student.id,
        StudentLearningPath.status == "ACTIVE"
    ).first()

    if not path:
        path = StudentLearningPath(student_id=student.id)
        db.add(path)

    path.title = res["title"]
    path.status = res["status"]
    path.current_week = res["current_week"]
    path.weeks_plan_json = res["weeks"]
    path.updated_at = datetime.datetime.utcnow()

    db.commit()
    db.refresh(path)
    return path
