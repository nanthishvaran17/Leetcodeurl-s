from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any

from backend.database import get_db
from backend.models import NLCICoreProfile, NLCIStudentAnalytic, Student
from backend.dependencies.resolve_scope import resolve_scope

router = APIRouter(prefix="/api/nlci", tags=["NLCI Intelligence"])

@router.get("/kpis")
def get_nlci_kpis(
    allowed_ids: Optional[List[int]] = Depends(resolve_scope),
    db: Session = Depends(get_db)
):
    """
    Returns aggregated KPIs (average performance score, risk distribution)
    scoped to the user's RBAC role.
    """
    if allowed_ids is not None and not allowed_ids:
        return {"error": "No students in scope", "kpis": {}}
        
    query = db.query(NLCIStudentAnalytic)
    if allowed_ids is not None:
        query = query.filter(NLCIStudentAnalytic.student_id.in_(allowed_ids))
        
    analytics = query.all()
    
    if not analytics:
        return {"kpis": {"total_students": 0}}
        
    total = len(analytics)
    avg_score = sum(a.performance_score or 0 for a in analytics) / total
    
    risk_dist = {"Safe": 0, "At Risk": 0, "High Risk": 0}
    for a in analytics:
        r = a.risk_level or "Safe"
        if r in risk_dist:
            risk_dist[r] += 1
            
    return {
        "kpis": {
            "total_students": total,
            "average_performance": round(avg_score, 2),
            "risk_distribution": risk_dist
        }
    }

@router.get("/search")
def search_nlci_candidates(
    q: str = Query("", description="Search term for name/reg_no"),
    allowed_ids: Optional[List[int]] = Depends(resolve_scope),
    db: Session = Depends(get_db)
):
    if not q:
        return []
        
    if allowed_ids is not None and not allowed_ids:
        return []
        
    query = db.query(Student, NLCIStudentAnalytic).outerjoin(
        NLCIStudentAnalytic, Student.id == NLCIStudentAnalytic.student_id
    ).filter(
        (Student.name.ilike(f"%{q}%")) | (Student.reg_no.ilike(f"%{q}%"))
    )
    
    if allowed_ids is not None:
        query = query.filter(Student.id.in_(allowed_ids))
        
    results = query.limit(20).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "reg_no": s.reg_no,
            "score": a.performance_score if a else None,
            "risk": a.risk_level if a else None
        }
        for s, a in results
    ]

@router.get("/candidates")
def get_nlci_candidates(
    skip: int = 0,
    limit: int = 50,
    sort_by: str = Query("performance_score", description="Sort field"),
    order: str = Query("desc", description="Sort order (asc/desc)"),
    allowed_ids: Optional[List[int]] = Depends(resolve_scope),
    db: Session = Depends(get_db)
):
    if allowed_ids is not None and not allowed_ids:
        return {"total": 0, "candidates": []}
        
    query = db.query(Student, NLCIStudentAnalytic).outerjoin(
        NLCIStudentAnalytic, Student.id == NLCIStudentAnalytic.student_id
    )
    
    if allowed_ids is not None:
        query = query.filter(Student.id.in_(allowed_ids))
        
    total = query.count()
    
    # Simple sorting
    if sort_by == "performance_score":
        if order == "desc":
            query = query.order_by(NLCIStudentAnalytic.performance_score.desc().nullslast())
        else:
            query = query.order_by(NLCIStudentAnalytic.performance_score.asc().nullslast())
            
    candidates = query.offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "candidates": [
            {
                "id": s.id,
                "name": s.name,
                "reg_no": s.reg_no,
                "score": a.performance_score if a else None,
                "risk": a.risk_level if a else None,
                "profile_class": a.profile_class if a else None
            }
            for s, a in candidates
        ]
    }
