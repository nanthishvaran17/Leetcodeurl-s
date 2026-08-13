from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
import asyncio
import datetime

from backend.database import get_db
from backend.models import Student, LeetCodeProfileStats, Department, Section, AuditLog, WeeklyStudentProgress
from backend.schemas import StudentOut, StudentCreate, StudentUpdate
from backend.routes.auth import get_current_user
from backend.leetcode_client import fetch_leetcode_profile, extract_leetcode_username
from backend.excel_handler import validate_excel_import, commit_excel_import
from backend.ranking import update_all_rankings_and_badges
from backend.logger import logger

router = APIRouter(prefix="/api/students", tags=["Students"])

from sqlalchemy import func

from sqlalchemy.orm import joinedload

@router.get("", response_model=List[StudentOut])
def get_students(
    dept_id: Optional[int] = None,
    year_level: Optional[str] = None,
    section_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Student).options(
        joinedload(Student.department),
        joinedload(Student.section),
        joinedload(Student.stats)
    ).filter((Student.is_active == True) | (Student.is_active.is_(None)))

    if dept_id:
        query = query.filter(Student.department_id == dept_id)
    if year_level and year_level.strip().upper() not in ['ALL', 'ALL YEARS', '']:
        query = query.filter(func.upper(Student.year_level) == year_level.strip().upper())
    if section_id:
        query = query.filter(Student.section_id == section_id)
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            (Student.name.ilike(s)) |
            (Student.reg_no.ilike(s)) |
            (Student.username.ilike(s))
        )

    students = query.order_by(Student.name.asc()).all()
    
    if not students:
        return []

    # Batch fetch all student progress in 1 single query (Eliminates N+1 query slowdown!)
    student_ids = [st.id for st in students]
    progs = db.query(WeeklyStudentProgress).filter(
        WeeklyStudentProgress.student_id.in_(student_ids)
    ).all()

    prog_map = {}
    for p in progs:
        if p.student_id not in prog_map or p.id > prog_map[p.student_id].id:
            prog_map[p.student_id] = p

    # Batch fetch contest participations
    from backend.models import StudentContestParticipation
    from backend.services.contest_service import calculate_overall_mode
    participations = db.query(StudentContestParticipation).filter(
        StudentContestParticipation.student_id.in_(student_ids)
    ).all()

    part_map = {}
    for pt in participations:
        if pt.student_id not in part_map:
            part_map[pt.student_id] = {}
        part_map[pt.student_id][pt.participation_mode] = pt

    results = []
    for st in students:
        st_out = StudentOut.from_orm(st)
        latest_prog = prog_map.get(st.id)
        if latest_prog:
            st_out.college_rank = latest_prog.college_rank
            st_out.dept_rank = latest_prog.dept_rank
            st_out.year_rank = latest_prog.year_rank
            st_out.section_rank = latest_prog.section_rank
            st_out.weekly_progress = latest_prog.weekly_progress
            st_out.streak_count = latest_prog.streak_count
            st_out.consistency_score = latest_prog.consistency_score
            st_out.badge_list = latest_prog.badge_list or []

        s_parts = part_map.get(st.id, {})
        pub_pt = s_parts.get("PUBLIC")
        vir_pt = s_parts.get("VIRTUAL")

        pub_status = pub_pt.status if pub_pt else "NOT_ATTENDED"
        vir_status = vir_pt.status if vir_pt else "NOT_ATTENDED"

        st_out.overall_participation_mode = calculate_overall_mode(pub_status, vir_status)

        if pub_pt:
            st_out.public_contest_result = {
                "contest_name": pub_pt.contest_name,
                "contest_number": pub_pt.contest_number,
                "contest_date": pub_pt.contest_date,
                "questions_solved": pub_pt.questions_solved,
                "questions_total": pub_pt.questions_total,
                "score_display": pub_pt.score_display,
                "contest_rank": pub_pt.contest_rank,
                "contest_rating": pub_pt.contest_rating,
                "top_percentage": pub_pt.top_percentage,
                "status": pub_pt.status,
                "fetched_at": pub_pt.fetched_at.isoformat() if pub_pt.fetched_at else None
            }
        else:
            st_out.public_contest_result = {
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

        if vir_pt:
            st_out.virtual_contest_result = {
                "contest_name": vir_pt.contest_name,
                "contest_number": vir_pt.contest_number,
                "contest_date": vir_pt.contest_date,
                "questions_solved": vir_pt.questions_solved,
                "questions_total": vir_pt.questions_total,
                "score_display": vir_pt.score_display,
                "contest_rank": vir_pt.contest_rank,
                "contest_rating": vir_pt.contest_rating,
                "top_percentage": vir_pt.top_percentage,
                "status": vir_pt.status,
                "fetched_at": vir_pt.fetched_at.isoformat() if vir_pt.fetched_at else None
            }
        else:
            st_out.virtual_contest_result = {
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

        results.append(st_out)
    return results

    return results

@router.get("/{student_id}", response_model=StudentOut)
def get_student_detail(student_id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    st_out = StudentOut.from_orm(student)
    latest_prog = db.query(WeeklyStudentProgress).filter(WeeklyStudentProgress.student_id == student.id).order_by(WeeklyStudentProgress.id.desc()).first()
    if latest_prog:
        st_out.college_rank = latest_prog.college_rank
        st_out.dept_rank = latest_prog.dept_rank
        st_out.year_rank = latest_prog.year_rank
        st_out.section_rank = latest_prog.section_rank
        st_out.weekly_progress = latest_prog.weekly_progress
        st_out.streak_count = latest_prog.streak_count
        st_out.consistency_score = latest_prog.consistency_score
        st_out.badge_list = latest_prog.badge_list or []
        
    return st_out

@router.post("", response_model=StudentOut)
def create_student(
    student_in: StudentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    existing = db.query(Student).filter(Student.reg_no == student_in.reg_no.upper()).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Student with Register No '{student_in.reg_no}' already exists.")

    username, std_url, url_status = extract_leetcode_username(student_in.leetcode_url)

    student = Student(
        reg_no=student_in.reg_no.upper(),
        name=student_in.name,
        department_id=student_in.department_id,
        year_level=student_in.year_level,
        section_id=student_in.section_id,
        email=student_in.email,
        leetcode_url=student_in.leetcode_url,
        username=username,
        codeforces_username=student_in.codeforces_username,
        hackerrank_username=student_in.hackerrank_username
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    # Init stats
    stats = LeetCodeProfileStats(student_id=student.id, status=url_status)
    db.add(stats)

    audit = AuditLog(user_id=current_user.id, user_name=current_user.username, action="CREATE_STUDENT", details=f"Created student {student.reg_no} ({student.name})")
    db.add(audit)
    db.commit()

    return StudentOut.from_orm(student)

from pydantic import BaseModel

class BulkDeleteRequest(BaseModel):
    student_ids: List[int]

@router.post("/bulk-delete")
def bulk_delete_students(
    req: BulkDeleteRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if not req.student_ids:
        raise HTTPException(status_code=400, detail="No student IDs provided for deletion.")

    count = len(req.student_ids)
    db.query(LeetCodeProfileStats).filter(LeetCodeProfileStats.student_id.in_(req.student_ids)).delete(synchronize_session=False)
    db.query(WeeklyStudentProgress).filter(WeeklyStudentProgress.student_id.in_(req.student_ids)).delete(synchronize_session=False)
    db.query(Student).filter(Student.id.in_(req.student_ids)).delete(synchronize_session=False)

    audit = AuditLog(
        user_id=current_user.id,
        user_name=current_user.username,
        action="BULK_DELETE_STUDENTS",
        details=f"Bulk deleted {count} student records."
    )
    db.add(audit)
    db.commit()

    update_all_rankings_and_badges(db)

    return {"message": f"Successfully deleted {count} student records.", "count": count}

@router.delete("/{student_id}")
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found.")

    reg_no = student.reg_no
    name = student.name

    db.query(LeetCodeProfileStats).filter(LeetCodeProfileStats.student_id == student_id).delete()
    db.query(WeeklyStudentProgress).filter(WeeklyStudentProgress.student_id == student_id).delete()
    db.delete(student)

    audit = AuditLog(
        user_id=current_user.id,
        user_name=current_user.username,
        action="DELETE_STUDENT",
        details=f"Deleted student record {reg_no} ({name})"
    )
    db.add(audit)
    db.commit()

    update_all_rankings_and_badges(db)

    return {"message": f"Successfully deleted student record {reg_no} ({name})"}

@router.post("/import-preview")
async def import_preview(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    report = validate_excel_import(db, content)
    return report

@router.post("/import-commit")
def import_commit(
    valid_rows: List[dict],
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    imported_count = commit_excel_import(db, valid_rows)
    audit = AuditLog(user_id=current_user.id, user_name=current_user.username, action="EXCEL_IMPORT", details=f"Imported {imported_count} students from Excel.")
    db.add(audit)
    db.commit()
    
    # Recalculate ranks
    update_all_rankings_and_badges(db)
    
    return {"message": f"Successfully imported {imported_count} students.", "count": imported_count}

from backend.sync_engine import run_batch_sync, sync_single_student_by_id, sync_tracker

@router.get("/sync-status")
@router.get("/admin/sync/status/{run_id}")
def get_students_sync_status(run_id: Optional[str] = None):
    return sync_tracker.to_dict()

@router.post("/{student_id}/refresh")
async def refresh_single_student(student_id: int):
    """
    Refreshes single student statistics within target 30-second limit.
    """
    try:
        result = await sync_single_student_by_id(student_id, timeout=30.0)
        if result.get("status") == "failed":
            raise HTTPException(status_code=400, detail=result.get("error", "Sync failed"))
        return {
            "message": f"Refreshed stats for {result.get('name')}",
            "status": result.get("status"),
            "last_verified_at": result.get("last_verified_at"),
            "stats": result.get("stats")
        }
    except ValueError as val_err:
        raise HTTPException(status_code=404, detail=str(val_err))
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Sync error: {err}")

@router.post("/refresh-all")
@router.post("/admin/sync/start")
async def refresh_all_students(
    background_tasks: BackgroundTasks,
    limit: Optional[int] = None
):
    """
    Starts async background sync worker for all 273 students without blocking browser.
    Returns immediately with runId. Frontend subscribes to Firestore syncRuns/{runId} for progress.
    """
    if sync_tracker.is_running:
        existing_run_id = sync_tracker.run_id or "current"
        return {
            "runId": existing_run_id,
            "message": "Live stats refresh is already running in background.",
            "status": "busy",
            "progress": sync_tracker.to_dict()
        }

    # Pre-generate a deterministic runId so the frontend can subscribe to Firestore immediately
    run_id = f"sync_{datetime.datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    background_tasks.add_task(run_batch_sync, limit=limit, pre_run_id=run_id)
    return {
        "runId": run_id,
        "status": "started",
        "total": 273,
        "message": "Live stats batch sync started in background! Subscribe to Firestore syncRuns/" + run_id,
        "sync_status_url": f"/api/students/admin/sync/status/{run_id}"
    }
