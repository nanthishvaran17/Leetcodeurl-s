from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import asyncio
import datetime

from backend.database import get_db
from backend.models import Student, LeetCodeProfileStats, Department, Section, AuditLog, WeeklyStudentProgress
from backend.schemas import StudentOut, StudentCreate, StudentUpdate, ContestResultOut
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

@router.get("/leaderboard-fast")
def get_leaderboard_fast(
    dept_id: Optional[int] = None,
    year_level: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Ultra-fast leaderboard endpoint for the LandingPage.
    Returns slim pre-serialized JSON — ~10x smaller payload and ~10x faster than /students.
    Cache TTL: 120s. Pre-serializes to dict to avoid re-serialization on every call.
    """
    cache_key = f"leaderboard_fast:{dept_id}:{year_level}"
    cached_bytes = cache.get(cache_key)
    if cached_bytes is not None:
        from starlette.responses import Response
        return Response(content=cached_bytes, media_type="application/json")

    from sqlalchemy import text
    from backend.models import (
        WeeklyPublicResult, WeeklyVirtualResult, WeeklySession,
        LeetCodeContestRatingHistory, LeetCodeProfileStats,
        LeetCodeProfile, LeetCodeActivity, WeeklyStudentProgress
    )
    import re

    # --- Step 1: Find target session in ONE query (no N+1 loop) ---
    target_session = (
        db.query(WeeklySession)
        .filter(WeeklySession.status.in_(["FINALIZED", "COMPLETED"]))
        .outerjoin(
            WeeklyPublicResult,
            (WeeklyPublicResult.session_id == WeeklySession.id) &
            (WeeklyPublicResult.participation_status.in_(["PUBLIC", "PUBLIC_ATTENDED", "ATTENDED"]))
        )
        .filter(WeeklyPublicResult.id.isnot(None))
        .order_by(WeeklySession.id.desc())
        .first()
    )
    if not target_session:
        target_session = (
            db.query(WeeklySession)
            .filter(WeeklySession.status.in_(["FINALIZED", "COMPLETED"]))
            .order_by(WeeklySession.id.desc())
            .first()
        )

    target_session_id = target_session.id if target_session else None
    target_contest_name = target_session.contest_name if target_session else "Weekly Contest"
    target_contest_date = str(target_session.session_date) if (target_session and target_session.session_date) else None
    c_num = None
    if target_session and target_session.contest_name:
        m = re.search(r'\d+', target_session.contest_name)
        if m:
            c_num = int(m.group(0))

    # --- Step 2: Load students with a single joined query ---
    query = (
        db.query(Student)
        .outerjoin(Student.stats)
        .options(
            joinedload(Student.department),
            joinedload(Student.stats),
            joinedload(Student.lc_activity),
        )
        .filter((Student.is_active == True) | (Student.is_active.is_(None)))
    )
    if dept_id:
        query = query.filter(Student.department_id == dept_id)
    if year_level and year_level.strip().upper() not in ('ALL', 'ALL YEARS', ''):
        clean_yr = year_level.strip().upper().replace('YEAR', '').strip()
        query = query.filter(func.upper(Student.year_level) == clean_yr)

    # Sort by solved desc for leaderboard
    query = query.order_by(nullslast(desc(LeetCodeProfileStats.total_solved)), Student.name.asc())
    students = query.all()

    if not students:
        empty_bytes = b'[]'
        cache.set(cache_key, empty_bytes, ttl_seconds=60, tags=["students", "leaderboard"])
        from starlette.responses import Response
        return Response(content=empty_bytes, media_type="application/json")

    student_ids = [st.id for st in students]

    # --- Step 3: Batch load all lookup tables in parallel bulk queries ---
    prog_map: dict = {}
    for p in db.query(WeeklyStudentProgress).filter(WeeklyStudentProgress.student_id.in_(student_ids)).all():
        if p.student_id not in prog_map or p.id > prog_map[p.student_id].id:
            prog_map[p.student_id] = p

    pub_map: dict = {}
    vir_map: dict = {}
    hist_map: dict = {}
    if target_session_id:
        for pr in db.query(WeeklyPublicResult).filter(
            WeeklyPublicResult.session_id == target_session_id,
            WeeklyPublicResult.student_id.in_(student_ids)
        ).all():
            pub_map[pr.student_id] = pr

        for vr in db.query(WeeklyVirtualResult).filter(
            WeeklyVirtualResult.session_id == target_session_id,
            WeeklyVirtualResult.student_id.in_(student_ids)
        ).all():
            vir_map[vr.student_id] = vr

    if c_num:
        for hr in db.query(LeetCodeContestRatingHistory).filter(
            LeetCodeContestRatingHistory.contest_name.ilike(f"%{c_num}%"),
            LeetCodeContestRatingHistory.student_id.in_(student_ids)
        ).all():
            hist_map[hr.student_id] = hr

    # --- Step 4: Build slim response dicts (no Pydantic overhead) ---
    results = []
    for st in students:
        s = st.stats
        is_verified = bool(s and s.sync_status in ("success", "verified") and s.status == "verified" and s.total_solved is not None)
        is_invalid = bool(s and (s.sync_status == "invalid_username" or s.status == "INVALID_USERNAME"))
        is_pending = bool(not st.username or not str(st.username).strip() or
                          (s and (s.sync_status == "pending_username" or s.status == "PENDING_USERNAME")))

        sync_state = "SYNCED" if is_verified else ("INVALID_USERNAME" if is_invalid else "PENDING_USERNAME")
        total_solved = s.total_solved if (is_verified and s) else None
        easy_solved = s.easy_solved if (is_verified and s) else None
        medium_solved = s.medium_solved if (is_verified and s) else None
        hard_solved = s.hard_solved if (is_verified and s) else None
        contest_rating = round(s.contest_rating, 1) if (is_verified and s and s.contest_rating) else None

        streak = 0
        if st.lc_activity:
            streak = st.lc_activity.current_streak or 0

        prog = prog_map.get(st.id)
        college_rank = prog.college_rank if (prog and is_verified) else None
        dept_rank = prog.dept_rank if (prog and is_verified) else None
        weekly_progress = prog.weekly_progress if (prog and is_verified) else 0
        if not st.lc_activity and prog:
            streak = prog.streak_count if is_verified else 0

        # Contest status — priority: rating history > public result
        contest_status = "NOT_ATTENDED"
        contest_solved = 0
        contest_score_display = "Not Attended"

        h = hist_map.get(st.id)
        pub = pub_map.get(st.id)
        vir = vir_map.get(st.id)

        if h and h.attended:
            contest_status = "PUBLIC_ATTENDED"
            contest_solved = h.problems_solved or 0
            contest_score_display = f"{contest_solved} / 4"
        elif h and not h.attended and (h.problems_solved or 0) > 0:
            contest_status = "VIRTUAL_ATTENDED"
            contest_solved = h.problems_solved or 0
            contest_score_display = f"{contest_solved} / 4"
        elif pub:
            is_att = pub.participation_status in ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED")
            contest_status = pub.participation_status or "NOT_ATTENDED"
            if is_att:
                contest_solved = pub.total_contest_solved or (pub.q1 + pub.q2 + pub.q3 + pub.q4)
                contest_score_display = f"{contest_solved} / 4"
        elif not st.username or not str(st.username).strip():
            contest_status = "PENDING_USERNAME"
            contest_score_display = "Data Unavailable"

        results.append({
            "id": st.id,
            "name": st.name,
            "reg_no": st.reg_no,
            "username": st.username,
            "year_level": st.year_level,
            "department_id": st.department_id,
            "department": {"id": st.department.id, "name": st.department.name, "code": st.department.code} if st.department else None,
            "sync_state": sync_state,
            "profile_url": f"https://leetcode.com/u/{st.username}/" if (is_verified and st.username) else None,
            "stats": {
                "total_solved": total_solved,
                "easy_solved": easy_solved,
                "medium_solved": medium_solved,
                "hard_solved": hard_solved,
                "contest_rating": contest_rating,
                "sync_status": s.sync_status if s else "pending_username",
                "status": s.status if s else "PENDING_USERNAME",
                "last_verified_at": s.last_verified_at.isoformat() if (s and s.last_verified_at) else None,
            } if s else None,
            "streak_count": streak,
            "college_rank": college_rank,
            "dept_rank": dept_rank,
            "weekly_progress": weekly_progress,
            "contest_status": contest_status,
            "contest_solved": contest_solved,
            "contest_score_display": contest_score_display,
            "contest_name": target_contest_name,
            "contest_number": c_num,
            "has_virtual": vir is not None and vir.participation_status in ("VIRTUAL_ATTENDED", "VIRTUAL"),
        })

    import json
    json_bytes = json.dumps(results, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    cache.set(cache_key, json_bytes, ttl_seconds=120, tags=["students", "leaderboard"])
    from starlette.responses import Response
    return Response(content=json_bytes, media_type="application/json")


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
        joinedload(Student.stats),
        joinedload(Student.lc_profile),
        joinedload(Student.lc_problem_stats),
        joinedload(Student.lc_contest_standing),
        joinedload(Student.lc_activity)
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
    if isinstance(page, int) and isinstance(limit, int) and page >= 1 and limit >= 1:
        offset = (page - 1) * limit
        students = query.offset(offset).limit(limit).all()
    elif isinstance(limit, int) and limit >= 1:
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
    from backend.models import WeeklyPublicResult, WeeklyVirtualResult, WeeklySession, LeetCodeContestRatingHistory
    import re
    
    target_session_id = session_id
    target_session = None
    if not target_session_id:
        # Single JOIN query instead of N+1 loop through sessions
        target_session = (
            db.query(WeeklySession)
            .filter(WeeklySession.status.in_(["FINALIZED", "COMPLETED"]))
            .outerjoin(
                WeeklyPublicResult,
                (WeeklyPublicResult.session_id == WeeklySession.id) &
                (WeeklyPublicResult.participation_status.in_(["PUBLIC", "PUBLIC_ATTENDED", "ATTENDED"]))
            )
            .filter(WeeklyPublicResult.id.isnot(None))
            .order_by(WeeklySession.id.desc())
            .first()
        )
        if not target_session:
            target_session = (
                db.query(WeeklySession)
                .filter(WeeklySession.status.in_(["FINALIZED", "COMPLETED"]))
                .order_by(WeeklySession.id.desc())
                .first()
            )
        if target_session:
            target_session_id = target_session.id
    else:
        target_session = db.query(WeeklySession).filter(WeeklySession.id == target_session_id).first()

    c_num = None
    if target_session and target_session.contest_name:
        m = re.search(r'\d+', target_session.contest_name)
        if m:
            c_num = int(m.group(0))

    pub_map = {}
    vir_map = {}
    hist_map = {}
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

    if c_num:
        hist_rows = db.query(LeetCodeContestRatingHistory).filter(
            LeetCodeContestRatingHistory.contest_name.ilike(f"%{c_num}%"),
            LeetCodeContestRatingHistory.student_id.in_(student_ids)
        ).all()
        for hr in hist_rows:
            hist_map[hr.student_id] = hr

    results = []
    for st in students:
        st_out = StudentOut.from_orm(st)

        # Rule 1 & 2: Canonical accuracy check — zero out fake/guessed data on invalid/pending profiles
        is_verified = bool(st.stats and st.stats.sync_status in ("success", "verified") and st.stats.status == "verified" and st.stats.total_solved is not None)
        is_invalid = bool(st.stats and (st.stats.sync_status == "invalid_username" or st.stats.status == "INVALID_USERNAME"))
        is_pending = bool(not st.username or not str(st.username).strip() or (st.stats and (st.stats.sync_status == "pending_username" or st.stats.status == "PENDING_USERNAME")))

        if is_invalid:
            st_out.leetcode_url = None
            if st_out.stats:
                st_out.stats.total_solved = None
                st_out.stats.easy_solved = None
                st_out.stats.medium_solved = None
                st_out.stats.hard_solved = None
                st_out.stats.contest_rating = None
                st_out.stats.contest_global_ranking = None
                st_out.stats.public_profile_ranking = None
                st_out.stats.status = "INVALID_USERNAME"
                st_out.stats.sync_status = "invalid_username"
                st_out.stats.validation_status = "invalid_username"
        elif is_pending:
            st_out.leetcode_url = None
            if st_out.stats:
                st_out.stats.total_solved = None
                st_out.stats.easy_solved = None
                st_out.stats.medium_solved = None
                st_out.stats.hard_solved = None
                st_out.stats.contest_rating = None
                st_out.stats.contest_global_ranking = None
                st_out.stats.public_profile_ranking = None
                st_out.stats.status = "PENDING_USERNAME"
                st_out.stats.sync_status = "pending_username"
                st_out.stats.validation_status = "pending_username"

        # Canonical fields from normalized tables if available
        if st.lc_profile:
            st_out.canonical_username = st.lc_profile.canonical_username if is_verified else None
            st_out.profile_url = st.lc_profile.profile_url if is_verified else None
            st_out.real_name = st.lc_profile.real_name if is_verified else None
            st_out.avatar_url = st.lc_profile.avatar_url if is_verified else None
            st_out.sync_state = st.lc_profile.sync_state
        else:
            st_out.canonical_username = st.username if is_verified else None
            st_out.profile_url = f"https://leetcode.com/u/{st.username}/" if (is_verified and st.username) else None
            st_out.sync_state = "SYNCED" if is_verified else ("INVALID_USERNAME" if is_invalid else "PENDING_USERNAME")

        if st.lc_activity:
            st_out.streak_count = st.lc_activity.current_streak or 0
            st_out.longest_streak = st.lc_activity.longest_streak or 0
            st_out.total_active_days = st.lc_activity.total_active_days or 0

        latest_prog = prog_map.get(st.id)
        if latest_prog:
            st_out.college_rank = latest_prog.college_rank if is_verified else None
            st_out.dept_rank = latest_prog.dept_rank if is_verified else None
            st_out.year_rank = latest_prog.year_rank if is_verified else None
            st_out.section_rank = latest_prog.section_rank if is_verified else None
            st_out.weekly_progress = latest_prog.weekly_progress if is_verified else 0
            if not st.lc_activity:
                st_out.streak_count = latest_prog.streak_count if is_verified else 0
            st_out.consistency_score = latest_prog.consistency_score if is_verified else 0.0
            st_out.badge_list = latest_prog.badge_list or []

        pub_res = pub_map.get(st.id)
        vir_res = vir_map.get(st.id)
        h_res = hist_map.get(st.id)

        target_contest_name = target_session.contest_name if target_session else "Weekly Contest"
        target_contest_date = target_session.session_date if target_session else None

        if h_res and h_res.attended:
            tot_solved = h_res.problems_solved or 0
            st_out.overall_participation_mode = "PUBLIC"
            st_out.contest_status = "PUBLIC_ATTENDED"
            st_out.public_contest_result = ContestResultOut(
                contest_name=target_contest_name,
                contest_number=c_num,
                contest_date=target_contest_date,
                questions_solved=tot_solved,
                questions_total=4,
                score_display=f"{tot_solved} / 4",
                contest_rank=h_res.contest_rank,
                contest_rating=round(h_res.rating_after, 1) if h_res.rating_after else None,
                top_percentage=None,
                status="PUBLIC_ATTENDED",
                fetched_at=datetime.datetime.utcnow().isoformat()
            )
        elif h_res and not h_res.attended and (h_res.problems_solved or 0) > 0:
            tot_solved = h_res.problems_solved or 0
            st_out.overall_participation_mode = "VIRTUAL"
            st_out.contest_status = "VIRTUAL_ATTENDED"
            st_out.public_contest_result = ContestResultOut(
                contest_name=target_contest_name,
                contest_number=c_num,
                contest_date=target_contest_date,
                questions_solved=tot_solved,
                questions_total=4,
                score_display=f"{tot_solved} / 4",
                contest_rank=None,
                contest_rating=None,
                top_percentage=None,
                status="VIRTUAL_ATTENDED",
                fetched_at=datetime.datetime.utcnow().isoformat()
            )
        elif pub_res:
            tot_solved = pub_res.total_contest_solved or (pub_res.q1 + pub_res.q2 + pub_res.q3 + pub_res.q4)
            is_att = pub_res.participation_status in ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED")
            is_not_att = pub_res.participation_status in ("NOT_ATTENDED", "PUBLIC_NOT_ATTENDED")
            score_disp = f"{tot_solved} / 4" if is_att else ("Not Attended" if is_not_att else "Data Unavailable")
            st_out.overall_participation_mode = "PUBLIC" if is_att else "NONE"
            st_out.contest_status = pub_res.participation_status or "NOT_ATTENDED"
            st_out.public_contest_result = ContestResultOut(
                contest_name=pub_res.session.contest_name if pub_res.session else target_contest_name,
                contest_number=c_num,
                contest_date=pub_res.session.session_date if pub_res.session else target_contest_date,
                questions_solved=tot_solved if is_att else 0,
                questions_total=4,
                score_display=score_disp,
                contest_rank=pub_res.contest_rank,
                contest_rating=pub_res.contest_rating,
                top_percentage=None,
                status=pub_res.participation_status or "NOT_ATTENDED",
                fetched_at=pub_res.last_fetched_at.isoformat() if pub_res.last_fetched_at else None
            )
        else:
            has_uname = bool(st.username and st.username.strip())
            st_out.overall_participation_mode = "NONE"
            st_out.contest_status = "NOT_ATTENDED" if has_uname else "PENDING_USERNAME"
            st_out.public_contest_result = ContestResultOut(
                contest_name=target_contest_name,
                contest_number=c_num,
                contest_date=target_contest_date,
                questions_solved=0,
                questions_total=4,
                score_display="Not Attended" if has_uname else "Data Unavailable",
                contest_rank=None,
                contest_rating=None,
                top_percentage=None,
                status="NOT_ATTENDED" if has_uname else "UNKNOWN",
                fetched_at=None
            )

        if vir_res:
            tot_solved_v = vir_res.total_contest_solved or (vir_res.q1 + vir_res.q2 + vir_res.q3 + vir_res.q4)
            st_out.virtual_contest_result = ContestResultOut(
                contest_name=vir_res.session.contest_name if vir_res.session else "Weekly Contest",
                contest_number=None,
                contest_date=vir_res.session.session_date if vir_res.session else None,
                questions_solved=tot_solved_v,
                questions_total=4,
                score_display=f"{tot_solved_v} / 4" if vir_res.participation_status in ("VIRTUAL_ATTENDED", "VIRTUAL") else "Not Attended",
                contest_rank=getattr(vir_res, 'contest_rank', None),
                contest_rating=getattr(vir_res, 'contest_rating', None),
                top_percentage=getattr(vir_res, 'top_percentage', None),
                status=vir_res.participation_status or "NO_VIRTUAL_RECORD",
                fetched_at=getattr(vir_res, 'completed_at', None).isoformat() if getattr(vir_res, 'completed_at', None) else None
            )
        else:
            st_out.virtual_contest_result = ContestResultOut(
                contest_name="Weekly Contest",
                contest_number=None,
                contest_date=None,
                questions_solved=0,
                questions_total=4,
                score_display="Not Attended",
                contest_rank=None,
                contest_rating=None,
                top_percentage=None,
                status="NO_VIRTUAL_RECORD",
                fetched_at=None
            )

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

    old_username = student.username

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

    # When username changes: align leetcode_url, reset sync_status to pending
    username_changed = bool(student.username and (old_username != student.username))
    if username_changed:
        student.leetcode_url = f"https://leetcode.com/u/{student.username}/"
        if student.stats:
            student.stats.sync_status = "pending"
            student.stats.status = "pending"
            student.stats.validation_status = "pending"

    db.commit()
    db.refresh(student)

    # Trigger immediate sync for the updated handle in background thread
    if username_changed:
        try:
            import threading
            from backend.database import SessionLocal
            from backend.services.live_sync_service import sync_single_student
            threading.Thread(
                target=sync_single_student,
                args=(student.id, SessionLocal()),
                daemon=True
            ).start()
            logger.info(f"[USERNAME_CHANGE] Handled username change for student_id={student.id}: '{old_username}' -> '{student.username}'. Immediate background sync started.")
        except Exception as _sync_start_err:
            logger.warning(f"[USERNAME_CHANGE_SYNC_NOTE] {_sync_start_err}")

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
        details=f"Updated student {student.reg_no} ({student.name})" + (f" username: '{old_username}' -> '{student.username}'" if username_changed else "")
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
@router.post("/sync-all")
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

