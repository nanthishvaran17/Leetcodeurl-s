import json
import os
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from datetime import datetime

from backend.models import NLCICoreProfile, NLCIStudentAnalytic

SCORING_CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config", "nlci_scoring_v1.json")

def load_scoring_config() -> Dict[str, Any]:
    if not os.path.exists(SCORING_CONFIG_PATH):
        # Default fallback
        return {
            "weights": {
                "contest_rating": 0.40,
                "problems_solved_hard": 0.20,
                "problems_solved_medium": 0.15,
                "problems_solved_easy": 0.05,
                "contest_attendance_consistency": 0.20
            },
            "risk_thresholds": {
                "High": 30,
                "Medium": 60,
                "Low": 100
            },
            "profile_classes": [
                {"name": "Elite", "min_score": 85},
                {"name": "Advanced", "min_score": 70},
                {"name": "Intermediate", "min_score": 50},
                {"name": "Beginner", "min_score": 0}
            ]
        }
    with open(SCORING_CONFIG_PATH, "r") as f:
        return json.load(f)

def compute_performance_score(profile: NLCICoreProfile, config: Dict[str, Any]) -> float:
    weights = config["weights"]
    
    # Normalizations (heuristic max values for scaling to 100)
    max_rating = 2500
    max_hard = 200
    max_medium = 500
    max_easy = 500
    max_attendance = 50
    
    rating_score = min((profile.contest_rating or 1500) / max_rating, 1.0) * 100
    hard_score = min((profile.hard_solved or 0) / max_hard, 1.0) * 100
    medium_score = min((profile.medium_solved or 0) / max_medium, 1.0) * 100
    easy_score = min((profile.easy_solved or 0) / max_easy, 1.0) * 100
    attendance_score = min((profile.contests_attended or 0) / max_attendance, 1.0) * 100
    
    final_score = (
        rating_score * weights["contest_rating"] +
        hard_score * weights["problems_solved_hard"] +
        medium_score * weights["problems_solved_medium"] +
        easy_score * weights["problems_solved_easy"] +
        attendance_score * weights["contest_attendance_consistency"]
    )
    
    return round(final_score, 2)

def determine_risk_level(score: float, config: Dict[str, Any]) -> str:
    thresholds = config["risk_thresholds"]
    if score < thresholds["High"]:
        return "High Risk"
    elif score < thresholds["Medium"]:
        return "At Risk"
    else:
        return "Safe"

def determine_profile_class(score: float, config: Dict[str, Any]) -> str:
    classes = sorted(config["profile_classes"], key=lambda x: x["min_score"], reverse=True)
    for cls in classes:
        if score >= cls["min_score"]:
            return cls["name"]
    return "Beginner"

def update_student_analytics(db: Session, student_id: int):
    profile = db.query(NLCICoreProfile).filter(NLCICoreProfile.student_id == student_id).first()
    if not profile:
        return
        
    config = load_scoring_config()
    score = compute_performance_score(profile, config)
    risk = determine_risk_level(score, config)
    profile_class = determine_profile_class(score, config)
    
    # Gate 0 rule: If bugs are not fixed, version is provisional
    score_version = "v1.0-provisional"
    
    analytic = db.query(NLCIStudentAnalytic).filter(NLCIStudentAnalytic.student_id == student_id).first()
    if not analytic:
        analytic = NLCIStudentAnalytic(student_id=student_id)
        db.add(analytic)
        
    analytic.performance_score = score
    analytic.placement_readiness = min(score * 1.1, 100) # Simple heuristic for readiness
    analytic.interview_readiness = min(score * 1.05, 100)
    analytic.risk_level = risk
    analytic.profile_class = profile_class
    analytic.computed_at = datetime.utcnow().isoformat()
    analytic.score_version = score_version
    analytic.trend = "Stable" # TODO: compare with history
    
    db.commit()
