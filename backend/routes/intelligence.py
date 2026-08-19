"""
Unified API Router for AI-Powered Institutional LeetCode Coding Intelligence Platform
Exposes endpoints for Risk Prediction, Explainable AI, Faculty Action Queue, Interventions,
Student Coding Profile, DSA Map, Learning Paths, HOD Command Center, What-If Simulator,
Natural Language AI Query, and Alert Center.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import datetime

from backend.database import get_db
from backend.models import Student, User, FacultyIntervention, FacultyActionQueueItem, SystemAlert
from backend.services.student_risk_engine import calculate_student_risk_engine, update_or_create_risk_profile
from backend.services.skill_mapping_engine import calculate_student_skill_map, update_or_create_skill_profile
from backend.services.learning_path_generator import generate_personalized_learning_path, update_or_create_learning_path
from backend.services.contest_readiness_engine import calculate_contest_readiness, calculate_coding_consistency, get_digital_coding_profile
from backend.services.faculty_action_engine import (
    get_what_needs_attention_items, get_faculty_action_queue,
    create_faculty_intervention, update_intervention_status,
    calculate_intervention_effectiveness
)
from backend.services.hod_analytics_engine import (
    calculate_department_health_score, get_institutional_benchmarks,
    get_hod_what_is_happening_summary, simulate_what_if_scenario
)
from backend.services.ai_query_engine import answer_ai_department_query

router = APIRouter(prefix="/api/intelligence", tags=["AI Coding Intelligence Platform"])

# Request Schemas
class CreateInterventionRequest(BaseModel):
    student_id: int
    faculty_id: Optional[int] = None
    title: str
    reason: str
    assigned_topics: List[str]
    priority: str = "High"

class UpdateInterventionRequest(BaseModel):
    status: str # Pending, In Progress, Completed, Monitoring, Resolved
    improvement_notes: Optional[str] = None

class WhatIfRequest(BaseModel):
    current_participation_pct: float = 72.0
    target_participation_pct: float = 87.0
    current_at_risk_count: int = 12

class AIQueryRequest(BaseModel):
    query: str


# ============================================================================
# 1. STUDENT CODING PROFILE & RISK ENGINE
# ============================================================================

@router.get("/student/{student_id}/digital-profile")
def get_student_digital_profile_endpoint(student_id: int, db: Session = Depends(get_db)):
    """
    Returns full Digital Coding Profile, 16 DSA topic skill map, Contest Readiness,
    Consistency metrics, and Risk score for a student.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    profile = get_digital_coding_profile(db, student)
    risk = calculate_student_risk_engine(db, student)
    learning_path = generate_personalized_learning_path(db, student)

    profile["risk_engine"] = risk
    profile["learning_path"] = learning_path
    return profile

@router.get("/student/{student_id}/risk")
def get_student_risk_endpoint(student_id: int, db: Session = Depends(get_db)):
    """
    Returns Explainable AI Risk Score (0-100), Level, Evidence, Explanation & Recommended Action.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    return calculate_student_risk_engine(db, student)

@router.get("/student/{student_id}/learning-path")
def get_student_learning_path_endpoint(student_id: int, db: Session = Depends(get_db)):
    """
    Returns personalized 4-week adaptive learning plan.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    return generate_personalized_learning_path(db, student)


# ============================================================================
# 2. FACULTY ACTION CENTER & INTERVENTIONS
# ============================================================================

@router.get("/faculty/attention")
def get_faculty_attention_endpoint(dept_id: Optional[int] = None, db: Session = Depends(get_db)):
    """
    Returns "What Needs My Attention?" items & counts.
    """
    return get_what_needs_attention_items(db, dept_id=dept_id)

@router.get("/faculty/action-queue")
def get_faculty_action_queue_endpoint(
    faculty_id: Optional[int] = None,
    status: Optional[str] = Query("ALL"),
    db: Session = Depends(get_db)
):
    """
    Returns task-based Faculty Action Queue.
    """
    return get_faculty_action_queue(db, faculty_id=faculty_id, status=status)

@router.post("/faculty/interventions")
def create_intervention_endpoint(req: CreateInterventionRequest, db: Session = Depends(get_db)):
    """
    Creates a new mentoring intervention.
    """
    intervention = create_faculty_intervention(
        db,
        student_id=req.student_id,
        faculty_id=req.faculty_id,
        title=req.title,
        reason=req.reason,
        assigned_topics=req.assigned_topics,
        priority=req.priority
    )
    return {
        "success": True,
        "message": "Intervention created successfully",
        "intervention_id": intervention.id
    }

@router.put("/faculty/interventions/{intervention_id}")
def update_intervention_endpoint(intervention_id: int, req: UpdateInterventionRequest, db: Session = Depends(get_db)):
    """
    Updates intervention status & notes.
    """
    intervention = update_intervention_status(
        db,
        intervention_id=intervention_id,
        status=req.status,
        improvement_notes=req.improvement_notes
    )
    return {
        "success": True,
        "message": f"Intervention status updated to {req.status}",
        "intervention_id": intervention.id
    }

@router.get("/faculty/interventions/effectiveness")
def get_intervention_effectiveness_endpoint(db: Session = Depends(get_db)):
    """
    Returns college-wide intervention effectiveness metrics.
    """
    return calculate_intervention_effectiveness(db)


# ============================================================================
# 3. HOD COMMAND CENTER & BENCHMARKING
# ============================================================================

@router.get("/hod/command-center")
def get_hod_command_center_endpoint(dept_id: Optional[int] = None, db: Session = Depends(get_db)):
    """
    Returns executive metrics for HOD Command Center, Department Health Score & Summary.
    """
    health = calculate_department_health_score(db, dept_id=dept_id)
    summary = get_hod_what_is_happening_summary(db, dept_id=dept_id)

    return {
        "department_health": health,
        "executive_summary": summary
    }

@router.get("/hod/benchmarks")
def get_hod_benchmarks_endpoint(db: Session = Depends(get_db)):
    """
    Returns Department vs Department & Year vs Year Benchmarks.
    """
    return get_institutional_benchmarks(db)

@router.post("/hod/what-if")
def post_what_if_simulator_endpoint(req: WhatIfRequest):
    """
    Simulates outcome of participation/growth changes for HOD.
    """
    return simulate_what_if_scenario(
        current_part_pct=req.current_participation_pct,
        target_part_pct=req.target_participation_pct,
        current_at_risk=req.current_at_risk_count
    )

@router.post("/hod/ai-query")
def post_ai_query_endpoint(req: AIQueryRequest, db: Session = Depends(get_db)):
    """
    Natural Language AI Department Query interface using verified DB analytics.
    """
    return answer_ai_department_query(db, query_text=req.query)


# ============================================================================
# 4. SYSTEM ALERT CENTER
# ============================================================================

@router.get("/alerts")
def get_system_alerts_endpoint(db: Session = Depends(get_db)):
    """
    Returns system alerts (Critical, Warning, Attention, Achievement).
    """
    alerts = db.query(SystemAlert).order_by(SystemAlert.id.desc()).all()
    if not alerts:
        # Seed initial priority alerts if empty
        seed_alerts = [
            SystemAlert(
                alert_type="CRITICAL",
                title="3 Students Dropped Performance >20%",
                message="Recent contest & weekly velocity dropped significantly across II Year section A.",
                action_label="Review Action Queue",
                action_route="/faculty/action-center"
            ),
            SystemAlert(
                alert_type="WARNING",
                title="8 Students Inactive for 14+ Days",
                message="No problem solving recorded over the past two weeks.",
                action_label="View Inactive List",
                action_route="/faculty/action-center"
            ),
            SystemAlert(
                alert_type="ATTENTION",
                title="12 Students Weak in Dynamic Programming",
                message="Topic accuracy below department baseline expectation (27% avg).",
                action_label="Assign Practice",
                action_route="/faculty/action-center"
            ),
            SystemAlert(
                alert_type="ACHIEVEMENT",
                title="7 Students Solved 500+ Problems",
                message="Milestone reached in Cyber Security department.",
                action_label="View Spotlight",
                action_route="/leaderboard"
            )
        ]
        for a in seed_alerts:
            db.add(a)
        db.commit()
        alerts = db.query(SystemAlert).order_by(SystemAlert.id.desc()).all()

    return [
        {
            "id": a.id,
            "alert_type": a.alert_type,
            "title": a.title,
            "message": a.message,
            "action_label": a.action_label,
            "action_route": a.action_route,
            "is_read": a.is_read,
            "is_resolved": a.is_resolved,
            "created_at": a.created_at.isoformat() if a.created_at else ""
        } for a in alerts
    ]

@router.post("/alerts/{alert_id}/read")
def mark_alert_read_endpoint(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(SystemAlert).filter(SystemAlert.id == alert_id).first()
    if alert:
        alert.is_read = True
        db.commit()
    return {"success": True}

@router.post("/alerts/{alert_id}/resolve")
def mark_alert_resolve_endpoint(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(SystemAlert).filter(SystemAlert.id == alert_id).first()
    if alert:
        alert.is_resolved = True
        alert.is_read = True
        db.commit()
    return {"success": True}
