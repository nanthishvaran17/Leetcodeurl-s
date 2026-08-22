"""
deep_tech_intelligence.py — Deep-Tech 5 Enterprise Intelligence Endpoints

Endpoints:
1. POST /api/intelligence/deep-tech/ast-anti-cheat: AST Code Plagiarism & Keystroke Dynamics Analysis
2. GET  /api/intelligence/deep-tech/contest-replay: 90-minute Sunday Contest Time-lapse Replay & Struggle Heatmap
3. GET  /api/intelligence/deep-tech/skill-radar/{student_id}: 6D DSA Weakness Radar & Micro-Skill Graph
4. GET  /api/intelligence/deep-tech/data-lake-integrity: Enterprise Immutable Event Store & Merkle Hash Verification
5. GET  /api/intelligence/deep-tech/voice-escalations: Automated Institutional Voice & Smart Escalations
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Body, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.database import get_db
from backend.models import User
from backend.routes.auth import get_current_user
from backend.security import require_role
from backend.services.ast_anti_cheat_engine import ast_anti_cheat_engine
from backend.services.contest_replay_service import contest_replay_service
from backend.services.skill_graph_service import skill_graph_service
from backend.services.immutable_event_store import immutable_event_store
from backend.services.voice_alert_service import voice_alert_service

router = APIRouter(prefix="/api/intelligence/deep-tech", tags=["Deep-Tech Intelligence Engine"])


class CodePlagiarismRequest(BaseModel):
    code_submission_a: str
    code_submission_b: str
    duration_seconds: float = 45.0
    lines_of_code: int = 35
    paste_events: int = 0


@router.post("/ast-anti-cheat")
def analyze_ast_plagiarism(
    payload: CodePlagiarismRequest,
    current_user: User = Depends(require_role("Super Admin", "Admin", "HOD", "hod", "Faculty", "faculty"))
):
    """
    Analyzes multi-language code for Abstract Syntax Tree (AST) plagiarism and keystroke anomalies.
    """
    ast_result = ast_anti_cheat_engine.calculate_ast_similarity(
        payload.code_submission_a,
        payload.code_submission_b
    )
    keystroke_result = ast_anti_cheat_engine.analyze_keystroke_dynamics(
        lines_of_code=payload.lines_of_code,
        duration_seconds=payload.duration_seconds,
        paste_events=payload.paste_events
    )

    # Record to immutable event store
    immutable_event_store.record_event(
        event_type="AST_PLAGIARISM_SCAN",
        actor=current_user.username,
        payload={"similarity_pct": ast_result["similarity_percentage"], "verdict": ast_result["verdict"]}
    )

    return {
        "ast_analysis": ast_result,
        "keystroke_dynamics": keystroke_result,
        "composite_risk_score": max(ast_result["similarity_percentage"], 90.0 if keystroke_result["is_paste_burst"] else 0.0),
        "status": "ANALYSIS_COMPLETE"
    }


@router.get("/contest-replay")
def get_contest_replay(
    session_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns 90-minute virtual contest timeline replay & problem struggle heatmap.
    """
    return contest_replay_service.get_contest_timeline_replay(db=db, session_id=session_id)


@router.get("/skill-radar/{student_id}")
def get_student_skill_radar(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns 6-dimensional DSA mastery radar graph & personalized remedial curriculum.
    """
    return skill_graph_service.get_student_skill_radar(db=db, student_id=student_id)


@router.get("/data-lake-integrity")
def get_data_lake_integrity(
    current_user: User = Depends(require_role("Super Admin", "Admin", "HOD", "hod"))
):
    """
    Verifies enterprise Merkle hash chain cryptographic integrity.
    """
    return immutable_event_store.verify_chain_integrity()


@router.get("/voice-escalations")
def get_voice_escalations(
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Super Admin", "Admin", "HOD", "hod", "Faculty", "faculty"))
):
    """
    Returns high-priority multi-week inactivity drop-offs and automated voice TTS scripts.
    """
    dept_to_scan = department_id
    if current_user.role in ["HOD", "hod"] and current_user.department_id:
        dept_to_scan = current_user.department_id

    return {
        "escalations": voice_alert_service.scan_inactivity_escalations(db=db, department_id=dept_to_scan),
        "total_flagged": len(voice_alert_service.scan_inactivity_escalations(db=db, department_id=dept_to_scan))
    }
