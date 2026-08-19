"""
DSA Skill Mapping Engine & Skill Profile Generator
Calculates topic-level intelligence for 16 core Data Structures & Algorithms topics:
Arrays, Strings, Hashing, Linked List, Stack, Queue, Binary Search, Trees, BST, Heap, Graph, Greedy, Backtracking, Dynamic Programming, Bit Manipulation, Math.
"""

import datetime
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from backend.models import Student, LeetCodeProfileStats, StudentSkillProfile

CORE_DSA_TOPICS = [
    "Arrays", "Strings", "Hashing", "Linked List", "Stack", "Queue",
    "Binary Search", "Trees", "BST", "Heap", "Graph", "Greedy",
    "Backtracking", "Dynamic Programming", "Bit Manipulation", "Math"
]

def calculate_student_skill_map(db: Session, student: Student) -> Dict[str, Any]:
    """
    Computes topic-level DSA proficiency scores (0-100) across 16 core topics,
    determines overall DSA skill, contest skill, consistency score, growth %,
    current level, strong areas, weak areas, and next recommended skill.
    """
    stats = student.stats
    if not stats:
        total = 0
        easy = 0
        med = 0
        hard = 0
        rating = 1400.0
    else:
        total = stats.total_solved or 0
        easy = stats.easy_solved or 0
        med = stats.medium_solved or 0
        hard = stats.hard_solved or 0
        rating = stats.contest_rating or 1450.0

    # Baseline topic score calculations using total/easy/med/hard distributions
    # Base multiplier scales with total solved count
    base_factor = min(1.0, total / 200.0)

    # 1. Topic Accuracies
    topic_scores: Dict[str, float] = {}
    
    # Fundamental Topics (Arrays, Strings, Hashing, Math)
    fund_score = round(min(95.0, (easy * 1.8 + med * 0.8) * base_factor + 30.0), 1)
    if total < 10:
        fund_score = max(15.0, total * 3.0)
    topic_scores["Arrays"] = round(min(98.0, fund_score * 1.05), 1)
    topic_scores["Strings"] = round(min(95.0, fund_score * 0.98), 1)
    topic_scores["Hashing"] = round(min(92.0, fund_score * 0.92), 1)
    topic_scores["Math"] = round(min(90.0, fund_score * 0.88), 1)

    # Linear Data Structures (Linked List, Stack, Queue)
    linear_score = round(min(90.0, (easy * 1.2 + med * 1.5) * base_factor + 20.0), 1)
    topic_scores["Linked List"] = round(min(92.0, linear_score * 1.02), 1)
    topic_scores["Stack"] = round(min(90.0, linear_score * 0.95), 1)
    topic_scores["Queue"] = round(min(88.0, linear_score * 0.90), 1)

    # Searching & Trees (Binary Search, Trees, BST, Heap)
    tree_score = round(min(88.0, (med * 2.2 + hard * 1.5) * base_factor + 15.0), 1)
    topic_scores["Binary Search"] = round(min(90.0, tree_score * 1.05), 1)
    topic_scores["Trees"] = round(min(88.0, tree_score * 0.98), 1)
    topic_scores["BST"] = round(min(85.0, tree_score * 0.92), 1)
    topic_scores["Heap"] = round(min(82.0, tree_score * 0.88), 1)

    # Advanced Topics (Graph, Greedy, Backtracking, Dynamic Programming, Bit Manipulation)
    adv_score = round(min(85.0, (med * 1.5 + hard * 3.5) * base_factor + 10.0), 1)
    topic_scores["Bit Manipulation"] = round(min(82.0, adv_score * 0.95), 1)
    topic_scores["Greedy"] = round(min(80.0, adv_score * 0.90), 1)
    topic_scores["Backtracking"] = round(min(75.0, adv_score * 0.85), 1)
    topic_scores["Graph"] = round(min(72.0, adv_score * 0.80), 1)
    topic_scores["Dynamic Programming"] = round(min(68.0, adv_score * 0.75), 1)

    # Ensure all 16 topics present
    for topic in CORE_DSA_TOPICS:
        if topic not in topic_scores:
            topic_scores[topic] = 50.0

    # 2. Strong & Weak Areas
    sorted_topics = sorted(topic_scores.items(), key=lambda x: x[1], reverse=True)
    strong_areas = [t[0] for t in sorted_topics[:3]]
    weak_areas = [t[0] for t in sorted_topics[-3:]]

    # 3. Overall Skill Metrics
    dsa_skill = round(sum(topic_scores.values()) / float(len(topic_scores)), 1)
    contest_skill = round(min(100.0, max(20.0, ((rating - 1200.0) / 800.0) * 100.0)), 1)
    overall_score = round((dsa_skill * 0.5) + (contest_skill * 0.3) + 15.0, 1)

    # Level classification
    if overall_score >= 80.0:
        level = "EXPERT"
    elif overall_score >= 65.0:
        level = "ADVANCED"
    elif overall_score >= 40.0:
        level = "INTERMEDIATE"
    else:
        level = "BEGINNER"

    next_recommended = weak_areas[0] if weak_areas else "Dynamic Programming"

    return {
        "overall_score": overall_score,
        "contest_skill": contest_skill,
        "dsa_skill": dsa_skill,
        "consistency_score": round(min(100.0, (total / 150.0) * 100.0), 1),
        "growth_rate_pct": round(min(45.0, (total / 50.0) * 12.5), 1),
        "current_level": level,
        "next_recommended_skill": next_recommended,
        "dsa_topic_scores": topic_scores,
        "strong_areas": strong_areas,
        "weak_areas": weak_areas
    }

def update_or_create_skill_profile(db: Session, student: Student) -> StudentSkillProfile:
    """
    Computes skill profile and persists to `student_skill_profiles`.
    """
    res = calculate_student_skill_map(db, student)

    profile = db.query(StudentSkillProfile).filter(StudentSkillProfile.student_id == student.id).first()
    if not profile:
        profile = StudentSkillProfile(student_id=student.id)
        db.add(profile)

    profile.overall_score = res["overall_score"]
    profile.contest_skill = res["contest_skill"]
    profile.dsa_skill = res["dsa_skill"]
    profile.consistency_score = res["consistency_score"]
    profile.growth_rate_pct = res["growth_rate_pct"]
    profile.current_level = res["current_level"]
    profile.next_recommended_skill = res["next_recommended_skill"]
    profile.dsa_topic_scores = res["dsa_topic_scores"]
    profile.strong_areas = res["strong_areas"]
    profile.weak_areas = res["weak_areas"]
    profile.last_calculated_at = datetime.datetime.utcnow()

    db.commit()
    db.refresh(profile)
    return profile
