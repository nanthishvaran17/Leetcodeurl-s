from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import asyncio
import datetime

from backend.database import get_db
from backend.models import Student, LeetCodeProfileStats, Department, Section, AuditLog, WeeklyStudentProgress
from backend.schemas import StudentOut, StudentCreate, StudentUpdate
from backend.routes.auth import get_current_user
from backend.security import require_security_access
from backend.leetcode_client import fetch_leetcode_profile, extract_leetcode_username
from backend.excel_handler import validate_excel_import, commit_excel_import
from backend.ranking import update_all_rankings_and_badges
from backend.logger import logger

router = APIRouter(prefix="/api/students", tags=["Students"])

from sqlalchemy import func

from sqlalchemy.orm import joinedload

from backend.cache import cache
from sqlalchemy import desc, asc, nullslast

@router.get("", response_model=List[StudentOut])
def get_students(
    dept_id: Optional[int] = None,
    year_level: Optional[str] = None,
    section_id: Optional[int] = None,
    search: Optional[str] = None,
    session_id: Optional[int] = None,
    sort_by: Optional[str] = Query(None, description="solved_desc, solved_asc, name_asc, name_desc, rating_desc, streak_desc"),
    min_solved: Optional[int] = None,
    max_solved: Optional[int] = None,
    verified_only: Optional[bool] = False,
    page: Optional[int] = Query(None, ge=1),
    limit: Optional[int] = Query(None, ge=1, le=500),
    db: Session = Depends(get_db)
):
    cache_key = f"students_list:{dept_id}:{year_level}:{section_id}:{search}:{session_id}:{sort_by}:{min_solved}:{max_solved}:{verified_only}:{page}:{limit}"
    cached_data = cache.get(cache_key)
    if cached_data is not None:
        return cached_data

    query = db.query(Student).outerjoin(Student.stats).options(
        joinedload(Student.department),
        joinedload(Student.section),
        joinedload(Student.stats)
    ).filter((Student.is_active == True) | (Student.is_active.is_(None)))

    if dept_id:
        query = query.filter(Student.department_id == dept_id)
    if year_level and year_level.strip().upper() not in ['ALL', 'ALL YEARS', '']:
        clean_yr = year_level.strip().upper().replace('YEAR', '').strip()
        query = query.filter(func.upper(Student.year_level) == clean_yr)

    if section_id:
        query = query.filter(Student.section_id == section_id)

    if min_solved is not None:
        query = query.filter(LeetCodeProfileStats.total_solved >= min_solved)
    if max_solved is not None:
        query = query.filter(LeetCodeProfileStats.total_solved <= max_solved)
    if verified_only:
        query = query.filter(LeetCodeProfileStats.sync_status.in_(["success", "OK", "verified"]))

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            (Student.name.ilike(s)) |
            (Student.reg_no.ilike(s)) |
            (Student.username.ilike(s))
        )

    # Server-side sorting
    if sort_by == "solved_desc" or sort_by == "solved":
        query = query.order_by(nullslast(desc(LeetCodeProfileStats.total_solved)), Student.name.asc())
    elif sort_by == "solved_asc":
        query = query.order_by(nullslast(asc(LeetCodeProfileStats.total_solved)), Student.name.asc())
    elif sort_by == "name_desc":
        query = query.order_by(Student.name.desc())
    elif sort_by == "rating_desc" or sort_by == "rating":
        query = query.order_by(nullslast(desc(LeetCodeProfileStats.contest_rating)), Student.name.asc())
    elif sort_by == "streak_desc" or sort_by == "streak":
        query = query.order_by(nullslast(desc(LeetCodeProfileStats.max_streak)), Student.name.asc())
    else:
        query = query.order_by(Student.name.asc())

    # Pagination if page and limit provided
    if page and limit:
        offset = (page - 1) * limit
        students = query.offset(offset).limit(limit).all()
    elif limit:
        students = query.limit(limit).all()
    else:
        students = query.all()
    
    if not students:
        return []

    # Batch fetch all student progress in 1 single query
    student_ids = [st.id for st in students]
    progs = db.query(WeeklyStudentProgress).filter(
        WeeklyStudentProgress.student_id.in_(student_ids)
    ).all()

    prog_map = {}
    for p in progs:
        if p.student_id not in prog_map or p.id > prog_map[p.student_id].id:
            prog_map[p.student_id] = p

    # Determine target session ID
    from backend.models import WeeklyPublicResult, WeeklyVirtualResult, WeeklySession
    from backend.services.weekly_session_manager import get_or_create_current_weekly_session
    
    target_session_id = session_id
    if not target_session_id:
        curr_sess = get_or_create_current_weekly_session(db)
        target_session_id = curr_sess.id if curr_sess else None

    pub_map = {}
    vir_map = {}
    if target_session_id:
        pub_results = db.query(WeeklyPublicResult).filter(
            WeeklyPublicResult.session_id == target_session_id,
            WeeklyPublicResult.student_id.in_(student_ids)
        ).all()
        for pr in pub_results:
            pub_map[pr.student_id] = pr

        vir_results = db.query(WeeklyVirtualResult).filter(
            WeeklyVirtualResult.session_id == target_session_id,
            WeeklyVirtualResult.student_id.in_(student_ids)
        ).all()
        for vr in vir_results:
            vir_map[vr.student_id] = vr

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

        pub_res = pub_map.get(st.id)
        vir_res = vir_map.get(st.id)

        pub_status = pub_res.participation_status if pub_res else ("UNKNOWN" if (not st.username or not st.username.strip()) else "NOT_ATTENDED")
        vir_status = vir_res.participation_status if vir_res else "NO_VIRTUAL_RECORD"

        if pub_status in ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED"):
            st_out.overall_participation_mode = "PUBLIC"
        elif vir_status in ("VIRTUAL", "VIRTUAL_ATTENDED"):
            st_out.overall_participation_mode = "VIRTUAL"
        else:
            st_out.overall_participation_mode = "NONE"

        if pub_res:
            tot_solved = pub_res.total_contest_solved or (pub_res.q1 + pub_res.q2 + pub_res.q3 + pub_res.q4)
            is_att = pub_res.participation_status in ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED")
            is_not_att = pub_res.participation_status == "NOT_ATTENDED"
            score_disp = f"{tot_solved} / 4" if is_att else ("Not Attended" if is_not_att else "Data Unavailable")
            st_out.public_contest_result = {
                "contest_name": pub_res.session.contest_name if pub_res.session else "Weekly Contest",
                "contest_number": None,
                "contest_date": pub_res.session.session_date if pub_res.session else None,
                "questions_solved": tot_solved if is_att else 0,
                "questions_total": 4,
                "score_display": score_disp,
                "contest_rank": pub_res.contest_rank,
                "contest_rating": pub_res.contest_rating,
                "top_percentage": None,
                "status": pub_res.participation_status,
                "fetched_at": pub_res.last_fetched_at.isoformat() if pub_res.last_fetched_at else None
            }
        else:
            has_uname = bool(st.username and st.username.strip())
            st_out.public_contest_result = {
                "contest_name": "Weekly Contest",
                "contest_number": None,
                "contest_date": None,
                "questions_solved": 0,
                "questions_total": 4,
                "score_display": "Not Attended" if has_uname else "Data Unavailable",
                "contest_rank": None,
                "contest_rating": None,
                "top_percentage": None,
                "status": "NOT_ATTENDED" if has_uname else "UNKNOWN",
                "fetched_at": None
            }

        if vir_res:
            tot_solved_v = vir_res.total_contest_solved or (vir_res.q1 + vir_res.q2 + vir_res.q3 + vir_res.q4)
            st_out.virtual_contest_result = {
                "contest_name": vir_res.session.contest_name if vir_res.session else "Weekly Contest",
                "contest_number": None,
                "contest_date": vir_res.session.session_date if vir_res.session else None,
                "questions_solved": tot_solved_v,
                "questions_total": 4,
                "score_display": f"{tot_solved_v} / 4" if vir_res.participation_status in ("VIRTUAL_ATTENDED", "VIRTUAL") else "Not Attended",
                "contest_rank": getattr(vir_res, 'contest_rank', None),
                "contest_rating": getattr(vir_res, 'contest_rating', None),
                "top_percentage": getattr(vir_res, 'top_percentage', None),
                "status": vir_res.participation_status,
                "fetched_at": getattr(vir_res, 'completed_at', None).isoformat() if getattr(vir_res, 'completed_at', None) else None
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
                "status": "NO_VIRTUAL_RECORD",
                "fetched_at": None
            }

        results.append(st_out)

    cache.set(cache_key, results, ttl_seconds=30, tags=["students"])
    return results

@router.get("/sample-excel")
def download_sample_student_excel():
    """
    Generates and returns Student_Import_Sample.xlsx with exact required columns:
    REG NO | NAME | DEPT | YEAR | LEETCODE PROFILE LINK
    """
    import io
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    wb = Workbook()
    ws = wb.active
    ws.title = "Students"
    ws.sheet_view.showGridLines = True

    headers = ["REG NO", "NAME", "DEPT", "YEAR", "LEETCODE PROFILE LINK"]
    col_widths = [18, 28, 14, 10, 45]

    navy_fill = PatternFill(start_color="1B365D", end_color="1B365D", fill_type="solid")
    font_header = Font(name="Times New Roman", size=11, bold=True, color="FFFFFF")
    center = Alignment(horizontal="center", vertical="center")
    left = Alignment(horizontal="left", vertical="center")

    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    for col_idx, (h_text, w) in enumerate(zip(headers, col_widths), start=1):
        cell = ws.cell(row=1, column=col_idx, value=h_text)
        cell.fill = navy_fill
        cell.font = font_header
        cell.alignment = center
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = w

    ws.row_dimensions[1].height = 26

    sample_rows = [
        ["732224CC001", "AJAY A", "CSE(CS)", "III", "https://leetcode.com/u/example_student/"],
        ["732224CC002", "AMRUTHA M", "CSE(CS)", "III", "https://leetcode.com/u/example_student2/"],
        ["732224CI001", "BHARATH K", "CSE(IOT)", "III", "https://leetcode.com/u/example_student3/"],
    ]

    for row_idx, r_data in enumerate(sample_rows, start=2):
        ws.row_dimensions[row_idx].height = 20
        for col_idx, val in enumerate(r_data, start=1):
            c = ws.cell(row=row_idx, column=col_idx, value=val)
            c.font = Font(name="Times New Roman", size=10)
            c.alignment = center if col_idx in (1, 3, 4) else left
            c.border = thin_border

    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:E{len(sample_rows)+1}"

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    from fastapi.responses import Response
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="Student_Import_Sample.xlsx"'}
    )

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
    current_user=Depends(require_security_access(resource_name="Create Student", required_roles=["admin", "super admin", "hod"]))
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
    current_user=Depends(require_security_access(resource_name="Bulk Delete Students", required_roles=["admin", "super admin"]))
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

class StudentUpdateSchema(BaseModel):
    name: Optional[str] = None
    department_id: Optional[int] = None
    year_level: Optional[str] = None
    section_id: Optional[int] = None
    email: Optional[str] = None
    leetcode_url: Optional[str] = None
    username: Optional[str] = None
    is_active: Optional[bool] = True


@router.patch("/{student_id}")
@router.put("/{student_id}")
def update_student(
    student_id: int,
    payload: StudentUpdateSchema,
    db: Session = Depends(get_db),
    current_user=Depends(require_security_access(resource_name="Update Student", required_roles=["admin", "super admin", "hod"]))
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found.")

    if payload.name and payload.name.strip():
        student.name = payload.name.strip()
    if payload.department_id is not None:
        student.department_id = payload.department_id
    if payload.year_level and payload.year_level.strip():
        student.year_level = payload.year_level.strip().upper()
    if payload.section_id is not None:
        student.section_id = payload.section_id
    if payload.email is not None:
        student.email = payload.email.strip().lower() if payload.email else None
    if payload.leetcode_url is not None:
        student.leetcode_url = payload.leetcode_url.strip() if payload.leetcode_url else None
        if student.leetcode_url and ("leetcode.com" in student.leetcode_url or "/u/" in student.leetcode_url):
            from backend.leetcode_fetcher import extract_leetcode_username
            parsed_u = extract_leetcode_username(student.leetcode_url)
            if parsed_u:
                student.username = parsed_u
    if payload.username and payload.username.strip():
        student.username = payload.username.strip()
    if payload.is_active is not None:
        student.is_active = payload.is_active

    db.commit()
    db.refresh(student)

    # Sync update to Cloud Firestore
    try:
        from backend.services.firestore_service import update_firestore_doc
        update_firestore_doc("students", student.reg_no, {
            "reg_no": student.reg_no,
            "name": student.name,
            "username": student.username,
            "leetcode_url": student.leetcode_url,
            "year_level": student.year_level,
            "is_active": student.is_active,
            "updated_at": datetime.datetime.utcnow().isoformat() + "Z"
        })
    except Exception as fs_err:
        logger.warning(f"[FIRESTORE UPDATE NOTE] {fs_err}")

    audit = AuditLog(
        user_id=current_user.id,
        user_name=current_user.username,
        action="UPDATE_STUDENT",
        details=f"Updated student {student.reg_no} ({student.name})"
    )
    db.add(audit)
    db.commit()

    update_all_rankings_and_badges(db)

    return StudentOut.from_orm(student)


@router.delete("/{student_id}")
def delete_student(
    student_id: int,
    soft_delete: bool = Query(True),
    db: Session = Depends(get_db),
    current_user=Depends(require_security_access(resource_name="Delete Student", required_roles=["admin", "super admin"]))
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found.")

    reg_no = student.reg_no
    name = student.name

    if soft_delete:
        student.is_active = False
        db.commit()
        logger.info(f"[SOFT_DELETE_STUDENT] Soft-deleted student roster record {reg_no} ({name})")
    else:
        db.query(LeetCodeProfileStats).filter(LeetCodeProfileStats.student_id == student_id).delete()
        db.query(WeeklyStudentProgress).filter(WeeklyStudentProgress.student_id == student_id).delete()
        db.delete(student)
        db.commit()

    # Sync status to Cloud Firestore
    try:
        from backend.services.firestore_service import update_firestore_doc
        update_firestore_doc("students", reg_no, {
            "is_active": False,
            "deactivated_at": datetime.datetime.utcnow().isoformat() + "Z"
        })
    except Exception as fs_err:
        logger.warning(f"[FIRESTORE DELETE NOTE] {fs_err}")

    audit = AuditLog(
        user_id=current_user.id,
        user_name=current_user.username,
        action="SOFT_DELETE_STUDENT" if soft_delete else "DELETE_STUDENT",
        details=f"Deactivated student roster record {reg_no} ({name})"
    )
    db.add(audit)
    db.commit()

    update_all_rankings_and_badges(db)

    return {"message": f"Successfully deactivated student roster record {reg_no} ({name})", "reg_no": reg_no}


@router.post("/import-preview")
async def import_preview(
    file: UploadFile = File(...), 
    db: Session = Depends(get_db),
    current_user=Depends(require_security_access(resource_name="Import Preview", required_roles=["admin", "super admin", "hod"]))
):
    content = await file.read()
    report = validate_excel_import(db, content)
    return report

@router.post("/import-commit")
def import_commit(
    valid_rows: List[dict],
    db: Session = Depends(get_db),
    current_user=Depends(require_security_access(resource_name="Import Commit", required_roles=["admin", "super admin", "hod"]))
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
    db = SessionLocal()
    try:
        active_count = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None))).count()
    except Exception:
        active_count = 300
    finally:
        db.close()

    return {
        "runId": run_id,
        "status": "started",
        "total": active_count,
        "message": f"Live stats batch sync started in background for {active_count} active students!",
        "sync_status_url": f"/api/students/admin/sync/status/{run_id}"
    }

