from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import datetime

from backend.database import get_db
from backend.models import Student, MentorNote, Department, Section, AuditLog
from backend.insights import calculate_student_risk_profile
from backend.routes.auth import get_current_user

router = APIRouter(prefix="/api/risk", tags=["Risk & Intervention Intelligence"])

class MentorNoteCreate(BaseModel):
    note: str
    escalation_level: str = "NORMAL" # NORMAL, WARNING, CRITICAL

@router.get("/summary")
def get_risk_summary(db: Session = Depends(get_db)):
    """
    Returns college-wide risk breakdown counts across all active students.
    """
    students = db.query(Student).filter(Student.is_active == True).all()

    counts = {
        "EXCELLENT": 0,
        "CONSISTENT": 0,
        "NEEDS_ATTENTION": 0,
        "AT_RISK": 0,
        "CRITICAL": 0,
        "total": len(students)
    }

    for st in students:
        profile = calculate_student_risk_profile(db, st)
        level = profile.get("risk_level", "NEEDS_ATTENTION")
        if level in counts:
            counts[level] += 1

    return counts

@router.get("/students")
def get_at_risk_students(
    risk_level: Optional[str] = Query(None, regex="^(EXCELLENT|CONSISTENT|NEEDS_ATTENTION|AT_RISK|CRITICAL)$"),
    dept_id: Optional[int] = None,
    year_level: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """
    Returns list of students filtered by risk level with recommended staff intervention actions.
    """
    query = db.query(Student).filter(Student.is_active == True)

    if dept_id:
        query = query.filter(Student.department_id == dept_id)
    if year_level and year_level.strip().upper() not in ['ALL', 'ALL YEARS', '']:
        query = query.filter(func.upper(Student.year_level) == year_level.strip().upper())

    students = query.all()
    results = []

    for st in students:
        profile = calculate_student_risk_profile(db, st)
        st_level = profile.get("risk_level", "NEEDS_ATTENTION")

        if risk_level and st_level != risk_level:
            continue

        notes = db.query(MentorNote).filter(MentorNote.student_id == st.id).order_by(MentorNote.created_at.desc()).all()
        notes_out = [
            {
                "id": n.id,
                "note": n.note,
                "escalation_level": n.escalation_level,
                "created_at": n.created_at.isoformat()
            } for n in notes
        ]

        results.append({
            "student_id": st.id,
            "reg_no": st.reg_no,
            "name": st.name,
            "department_code": st.department.code if st.department else "GEN",
            "year_level": st.year_level,
            "section_name": st.section.name if st.section else "A",
            "risk_profile": profile,
            "notes_count": len(notes_out),
            "recent_note": notes_out[0] if notes_out else None
        })

    # Sort results: CRITICAL first, then AT_RISK, NEEDS_ATTENTION, CONSISTENT, EXCELLENT
    priority_order = {"CRITICAL": 0, "AT_RISK": 1, "NEEDS_ATTENTION": 2, "CONSISTENT": 3, "EXCELLENT": 4}
    results.sort(key=lambda x: priority_order.get(x["risk_profile"]["risk_level"], 99))

    return results[:limit]

@router.post("/student/{student_id}/note")
def add_mentor_note(
    student_id: int,
    note_in: MentorNoteCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Allows staff/mentors to add an intervention note to a student's profile.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    note = MentorNote(
        student_id=student.id,
        faculty_id=current_user.id,
        note=note_in.note,
        escalation_level=note_in.escalation_level,
        created_at=datetime.datetime.utcnow()
    )
    db.add(note)

    audit = AuditLog(
        user_id=current_user.id,
        user_name=current_user.username,
        action="ADD_MENTOR_NOTE",
        details=f"Added intervention note for {student.reg_no} ({student.name}) with escalation level {note_in.escalation_level}"
    )
    db.add(audit)
    db.commit()
    db.refresh(note)

    return {
        "message": f"Successfully recorded mentor intervention note for {student.name}",
        "note_id": note.id,
        "escalation_level": note.escalation_level
    }
