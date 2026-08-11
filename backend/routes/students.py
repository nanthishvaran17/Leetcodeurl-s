from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
import asyncio

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
        results.append(st_out)

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

    username, url_status = extract_leetcode_username(student_in.leetcode_url)

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

@router.post("/{student_id}/refresh")
async def refresh_single_student(student_id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    stats_dict = await fetch_leetcode_profile(student.leetcode_url, force_refresh=True)

    if not student.stats:
        student.stats = LeetCodeProfileStats(student_id=student.id)

    student.stats.total_solved = stats_dict["total_solved"]
    student.stats.easy_solved = stats_dict["easy_solved"]
    student.stats.medium_solved = stats_dict["medium_solved"]
    student.stats.hard_solved = stats_dict["hard_solved"]
    student.stats.contest_rating = stats_dict["contest_rating"]
    student.stats.contest_global_ranking = stats_dict["contest_global_ranking"]
    student.stats.public_profile_ranking = stats_dict["public_profile_ranking"]
    student.stats.status = stats_dict["status"]
    student.stats.error_message = stats_dict.get("error_message")

    db.commit()
    update_all_rankings_and_badges(db)

    return {"message": f"Refreshed stats for {student.name}", "stats": stats_dict}

from fastapi import BackgroundTasks
from backend.database import SessionLocal

async def _bg_refresh_all_students():
    db = SessionLocal()
    try:
        students = db.query(Student).filter(Student.is_active == True).all()
        semaphore = asyncio.Semaphore(3)

        async def fetch_one(student):
            if not student.leetcode_url:
                return None
            async with semaphore:
                try:
                    stats_dict = await fetch_leetcode_profile(student.leetcode_url, force_refresh=True)
                    await asyncio.sleep(0.15)
                    return (student.id, stats_dict)
                except Exception as e:
                    return None

        tasks = [fetch_one(s) for s in students]
        results = await asyncio.gather(*tasks)

        student_map = {s.id: s for s in students}
        for res in results:
            if res:
                student_id, stats_dict = res
                student = student_map.get(student_id)
                if student:
                    if not student.stats:
                        student.stats = LeetCodeProfileStats(student_id=student.id)
                        db.add(student.stats)

                    student.stats.total_solved = stats_dict["total_solved"]
                    student.stats.easy_solved = stats_dict["easy_solved"]
                    student.stats.medium_solved = stats_dict["medium_solved"]
                    student.stats.hard_solved = stats_dict["hard_solved"]
                    student.stats.contest_rating = stats_dict["contest_rating"]
                    student.stats.contest_global_ranking = stats_dict["contest_global_ranking"]
                    student.stats.public_profile_ranking = stats_dict["public_profile_ranking"]
                    student.stats.status = stats_dict["status"]
                    student.stats.error_message = stats_dict.get("error_message")

        db.commit()
        update_all_rankings_and_badges(db)
    finally:
        db.close()

@router.post("/refresh-all")
async def refresh_all_students(background_tasks: BackgroundTasks):
    is_vercel = os.environ.get("VERCEL") == "1" or os.environ.get("VERCEL_ENV")
    if is_vercel:
        await _bg_refresh_all_students()
        return {"message": "Live stats refreshed for all active students!", "status": "complete"}
    
    background_tasks.add_task(_bg_refresh_all_students)
    return {"message": "Live stats refresh started in background for all 221 students!", "status": "processing"}
