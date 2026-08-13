import datetime
from typing import Dict, Any, Optional, Tuple, List
from sqlalchemy.orm import Session
from backend.models import StudentContestParticipation, Student
from backend.logger import logger

def calculate_overall_mode(public_status: str, virtual_status: str) -> str:
    """
    Computes overall participation mode matrix per specification Section 12 & 30:
      - PUBLIC_ONLY: Public ATTENDED, Virtual NOT_ATTENDED
      - VIRTUAL_ONLY: Public NOT_ATTENDED, Virtual ATTENDED
      - BOTH: Both ATTENDED
      - NONE: Both NOT_ATTENDED
      - FETCH_ERROR: Either status is FETCH_FAILED
      - MODE_UNCERTAIN: Either status is MODE_UNCERTAIN or PARSER_ERROR
    """
    if public_status in ("FETCH_FAILED", "FETCH_ERROR") or virtual_status in ("FETCH_FAILED", "FETCH_ERROR"):
        return "FETCH_ERROR"
    if public_status in ("MODE_UNCERTAIN", "PARSER_ERROR") or virtual_status in ("MODE_UNCERTAIN", "PARSER_ERROR"):
        return "MODE_UNCERTAIN"
    
    pub_attended = (public_status == "ATTENDED")
    vir_attended = (virtual_status == "ATTENDED")

    if pub_attended and vir_attended:
        return "BOTH"
    if pub_attended and not vir_attended:
        return "PUBLIC_ONLY"
    if vir_attended and not pub_attended:
        return "VIRTUAL_ONLY"
    return "NONE"

def record_contest_participation(
    db: Session,
    student_id: int,
    contest_id: str,
    contest_name: str,
    participation_mode: str, # "PUBLIC" or "VIRTUAL"
    contest_number: Optional[int] = None,
    contest_date: Optional[str] = None,
    questions_solved: int = 0,
    questions_total: int = 4,
    contest_rank: Optional[int] = None,
    contest_rating: Optional[float] = None,
    top_percentage: Optional[float] = None,
    status: str = "NOT_ATTENDED",
    error_message: Optional[str] = None,
    started_at: Optional[datetime.datetime] = None,
    submitted_at: Optional[datetime.datetime] = None
) -> StudentContestParticipation:
    """
    Creates or updates a participation record strictly isolated to the specified participation_mode.
    STRICT ZERO-OVERWRITE GUARANTEE: Never alters or overwrites the opposite participation mode record.
    """
    mode_clean = participation_mode.upper().strip()
    if mode_clean not in ("PUBLIC", "VIRTUAL"):
        raise ValueError(f"Invalid participation_mode '{participation_mode}'. Must be 'PUBLIC' or 'VIRTUAL'.")

    # Format score_display cleanly
    if status == "ATTENDED":
        score_disp = f"{questions_solved} / {questions_total}"
        attended_flag = True
    elif status == "FETCH_FAILED":
        score_disp = "Fetch Failed"
        attended_flag = False
    elif status == "MODE_UNCERTAIN":
        score_disp = "Mode Uncertain"
        attended_flag = False
    else:
        score_disp = "Not Attended"
        attended_flag = False

    # Look up existing record for THIS exact mode only
    rec = db.query(StudentContestParticipation).filter(
        StudentContestParticipation.student_id == student_id,
        StudentContestParticipation.contest_id == contest_id,
        StudentContestParticipation.participation_mode == mode_clean
    ).first()

    now = datetime.datetime.utcnow()

    if not rec:
        rec = StudentContestParticipation(
            student_id=student_id,
            contest_id=contest_id,
            contest_name=contest_name,
            contest_number=contest_number,
            contest_date=contest_date,
            participation_mode=mode_clean,
            questions_solved=questions_solved,
            questions_total=questions_total,
            score_display=score_disp,
            contest_rank=contest_rank,
            contest_rating=contest_rating,
            top_percentage=top_percentage,
            attended=attended_flag,
            status=status,
            error_message=error_message,
            started_at=started_at,
            submitted_at=submitted_at,
            fetched_at=now,
            created_at=now,
            updated_at=now
        )
        db.add(rec)
    else:
        # Update existing record for THIS mode only
        rec.contest_name = contest_name
        if contest_number is not None:
            rec.contest_number = contest_number
        if contest_date is not None:
            rec.contest_date = contest_date
        rec.questions_solved = questions_solved
        rec.questions_total = questions_total
        rec.score_display = score_disp
        rec.contest_rank = contest_rank
        rec.contest_rating = contest_rating
        rec.top_percentage = top_percentage
        rec.attended = attended_flag
        rec.status = status
        rec.error_message = error_message
        if started_at:
            rec.started_at = started_at
        if submitted_at:
            rec.submitted_at = submitted_at
        rec.fetched_at = now
        rec.updated_at = now

    db.commit()
    db.refresh(rec)
    return rec

def get_student_contest_records(
    db: Session,
    student_id: int,
    contest_id: str
) -> Tuple[Optional[StudentContestParticipation], Optional[StudentContestParticipation]]:
    """
    Retrieves (public_record, virtual_record) for a given student and contest.
    """
    pub_rec = db.query(StudentContestParticipation).filter(
        StudentContestParticipation.student_id == student_id,
        StudentContestParticipation.contest_id == contest_id,
        StudentContestParticipation.participation_mode == "PUBLIC"
    ).first()

    vir_rec = db.query(StudentContestParticipation).filter(
        StudentContestParticipation.student_id == student_id,
        StudentContestParticipation.contest_id == contest_id,
        StudentContestParticipation.participation_mode == "VIRTUAL"
    ).first()

    return pub_rec, vir_rec

def build_student_contest_dto(
    db: Session,
    student: Student,
    contest_id: str
) -> Dict[str, Any]:
    """
    Builds DTO containing independent public_contest_result, virtual_contest_result,
    and overall_participation_mode for API/UI.
    """
    pub_rec, vir_rec = get_student_contest_records(db, student.id, contest_id)

    pub_status = pub_rec.status if pub_rec else "NOT_ATTENDED"
    vir_status = vir_rec.status if vir_rec else "NOT_ATTENDED"

    overall_mode = calculate_overall_mode(pub_status, vir_status)

    def format_res(rec: Optional[StudentContestParticipation]) -> Dict[str, Any]:
        if not rec:
            return {
                "contest_name": "Weekly Contest",
                "contest_number": None,
                "contest_date": None,
                "questions_solved": 0,
                "questions_total": 4,
                "score_display": "Not Attended",
                "contest_rank": None,
                "contest_rating": None,
                "top_percentage": None,
                "status": "NOT_ATTENDED",
                "fetched_at": None
            }
        return {
            "contest_name": rec.contest_name,
            "contest_number": rec.contest_number,
            "contest_date": rec.contest_date,
            "questions_solved": rec.questions_solved,
            "questions_total": rec.questions_total,
            "score_display": rec.score_display,
            "contest_rank": rec.contest_rank,
            "contest_rating": rec.contest_rating,
            "top_percentage": rec.top_percentage,
            "status": rec.status,
            "fetched_at": rec.fetched_at.isoformat() if rec.fetched_at else None
        }

    return {
        "student_id": student.id,
        "register_no": student.reg_no,
        "student_name": student.name,
        "department": student.department.code if student.department else "GEN",
        "year": student.year_level,
        "username": student.username,
        "public_profile_ranking": student.stats.public_profile_ranking if student.stats else None,
        "public_contest_result": format_res(pub_rec),
        "virtual_contest_result": format_res(vir_rec),
        "overall_participation_mode": overall_mode
    }
