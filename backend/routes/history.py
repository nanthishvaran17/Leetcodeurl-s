"""
history.py
================================================================================
REAL-TIME GROWTH & DELTA ENGINE + TIME MACHINE HISTORY API
================================================================================
Provides high-performance, accurate endpoints for:
- /api/growth/college-delta: Aggregate college/department/year problem solve growth & difficulty velocity.
- /api/growth/improvers: Top growth improvers leaderboard over custom timeframe windows (today, 7d, 30d, all).
- /api/growth/options: Dynamic filter options for departments and academic years.
- /api/history/{student_identifier}: Granular historical stat snapshots and Time Machine progression timeline.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Dict, Any, cast
import datetime
import json
from zoneinfo import ZoneInfo
from collections import defaultdict

from backend.database import get_db
from backend.models import Student, StudentStatSnapshot, Department, User
from backend.schemas import StudentStatSnapshotOut, ImproverOut
from backend.security import get_current_user_optional
from backend.services.authorization_service import apply_role_based_student_filter

router = APIRouter(prefix="/api", tags=["History & Growth Intelligence"])

IST_TZ = ZoneInfo("Asia/Kolkata")
UTC_TZ = datetime.timezone.utc

def _growth_cutoff(period: str) -> datetime.datetime:
    now_ist = datetime.datetime.now(IST_TZ)
    start_of_today_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    
    if period == "today":
        return start_of_today_ist.astimezone(UTC_TZ)
    if period == "7d":
        start_of_7d = start_of_today_ist - datetime.timedelta(days=6)
        return start_of_7d.astimezone(UTC_TZ)
    if period == "30d":
        start_of_30d = start_of_today_ist - datetime.timedelta(days=29)
        return start_of_30d.astimezone(UTC_TZ)
    return datetime.datetime(2020, 1, 1, tzinfo=UTC_TZ)


def _filtered_growth_students(
    db: Session, 
    dept: Optional[str], 
    dept_id: Optional[int], 
    year: Optional[str], 
    year_level: Optional[str],
    current_user: Optional[User] = None
) -> List[Student]:
    query = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None)))
    effective_dept = (dept or "").strip()
    effective_year = (year or year_level or "").strip()
    
    if dept_id:
        query = query.filter(Student.department_id == dept_id)
    elif effective_dept.upper() not in ("", "ALL", "ALL DEPARTMENTS"):
        query = query.join(Student.department).filter(
            func.upper(Department.code) == effective_dept.upper()
        )
    if effective_year.upper() not in ("", "ALL", "ALL YEARS", "ALL ACADEMIC YEARS"):
        clean_y = effective_year.upper().replace(" YEAR", "").strip()
        valid_matches = [clean_y, f"{clean_y} YEAR"]
        if clean_y in ("I", "1", "1ST"):
            valid_matches += ["I", "1", "1ST", "1ST YEAR", "I YEAR"]
        elif clean_y in ("II", "2", "2ND"):
            valid_matches += ["II", "2", "2ND", "2ND YEAR", "II YEAR"]
        elif clean_y in ("III", "3", "3RD"):
            valid_matches += ["III", "3", "3RD", "3RD YEAR", "III YEAR"]
        elif clean_y in ("IV", "4", "4TH"):
            valid_matches += ["IV", "4", "4TH", "4TH YEAR", "IV YEAR"]
        valid_matches = list(set(valid_matches))
        query = query.filter(func.upper(Student.year_level).in_(valid_matches))
        
    if current_user:
        query = apply_role_based_student_filter(query, current_user, db)
        
    return query.all()


MAX_BASELINE_STALENESS = {
    "today": datetime.timedelta(hours=36),
    "7d": datetime.timedelta(hours=48),
    "30d": datetime.timedelta(hours=96)
}

MAX_CURRENT_AGE = datetime.timedelta(hours=48)

def _clean_snaps(snaps: List[StudentStatSnapshot]) -> List[StudentStatSnapshot]:
    """Keep eligible snapshots for growth processing."""
    out = []
    for sn in snaps:
        if getattr(sn, "source", None) in ("on_demand", "unverified"):
            continue
        if getattr(sn, "is_verified", True) is False:
            continue
        out.append(sn)
    return out


def _parse_cal_entries(raw_cal: Any) -> List[tuple]:
    """Parses raw submission_calendar_json into list of (timestamp_int, count_int)."""
    if not raw_cal:
        return []
    if isinstance(raw_cal, str):
        try:
            raw_cal = json.loads(raw_cal)
        except Exception:
            return []
    if not isinstance(raw_cal, dict):
        return []
    
    entries = []
    for ts_str, cnt in raw_cal.items():
        try:
            entries.append((int(ts_str), int(cnt)))
        except Exception:
            pass
    return entries


def _parse_cal_counts(raw_cal: Any) -> Dict[datetime.date, int]:
    """Parses raw submission_calendar_json into a dictionary mapping date -> count."""
    entries = _parse_cal_entries(raw_cal)
    counts: Dict[datetime.date, int] = defaultdict(int)
    for ts_int, cnt in entries:
        try:
            d = datetime.datetime.fromtimestamp(ts_int, tz=UTC_TZ).date()
            counts[d] += cnt
        except Exception:
            pass
    return dict(counts)


def _get_target_dates(period: str, ref_date_ist: datetime.date, ref_date_utc: datetime.date) -> Optional[set]:
    if period == "today":
        return {ref_date_ist, ref_date_utc}
    if period == "7d":
        s = set()
        for i in range(7):
            s.add(ref_date_ist - datetime.timedelta(days=i))
            s.add(ref_date_utc - datetime.timedelta(days=i))
        return s
    if period == "30d":
        s = set()
        for i in range(30):
            s.add(ref_date_ist - datetime.timedelta(days=i))
            s.add(ref_date_utc - datetime.timedelta(days=i))
        return s
    return None  # all


def _sum_cal_delta(cal_entries: List[tuple], target_dates: Optional[set]) -> int:
    if target_dates is None:
        return sum(cnt for _, cnt in cal_entries)
    total = 0
    for ts_int, cnt in cal_entries:
        try:
            d_ist = datetime.datetime.fromtimestamp(ts_int, tz=IST_TZ).date()
            d_utc = datetime.datetime.fromtimestamp(ts_int, tz=UTC_TZ).date()
            if d_ist in target_dates or d_utc in target_dates:
                total += cnt
        except Exception:
            pass
    return total


def _serialize_snap(snap: Optional[StudentStatSnapshot]) -> Optional[Dict[str, Any]]:
    if not snap:
        return None
    snap_any = cast(Any, snap)
    c_at = snap_any.captured_at
    if c_at and c_at.tzinfo is None:
        c_at = c_at.replace(tzinfo=UTC_TZ)
    rat = snap_any.contest_rating
    if rat is not None:
        try:
            r_val = float(rat)
            rat = None if (r_val == 1500.0 or r_val == 0.0) else r_val
        except (ValueError, TypeError):
            rat = None
    return {
        "captured_at": c_at.isoformat() if c_at else None,
        "source": snap_any.source,
        "total_solved": snap_any.total_solved,
        "easy_solved": snap_any.easy_solved,
        "medium_solved": snap_any.medium_solved,
        "hard_solved": snap_any.hard_solved,
        "contest_rating": rat
    }


def _conflict(baseline: Optional[StudentStatSnapshot], current: Optional[StudentStatSnapshot], reason: str) -> Dict[str, Any]:
    return {
        "growth_status": "CONFLICT",
        "current_status": "VERIFIED" if current else "UNKNOWN",
        "total_solved": None,
        "easy_solved": None,
        "medium_solved": None,
        "hard_solved": None,
        "contest_rating": None,
        "delta_total": None, "delta_easy": None, "delta_medium": None, "delta_hard": None, "delta_rating": None,
        "conflict_reason": reason,
        "baseline": _serialize_snap(baseline),
        "current": _serialize_snap(current)
    }


def _derived_growth(
    db: Session,
    students: List[Student],
    cutoff: Optional[datetime.datetime],
    period: str = "7d",
    now_utc: Optional[datetime.datetime] = None
) -> Dict[int, Dict[str, Any]]:
    if not students:
        return {}

    now_ist = datetime.datetime.now(IST_TZ)
    if now_utc is not None:
        effective_now_utc = now_utc
    elif cutoff is not None and period in ("today", "7d", "30d"):
        delta_map = {"today": datetime.timedelta(hours=24), "7d": datetime.timedelta(days=7), "30d": datetime.timedelta(days=30)}
        inferred_now = cutoff + delta_map[period]
        real_now = datetime.datetime.now(UTC_TZ)
        effective_now_utc = inferred_now if abs((real_now - inferred_now).days) > 2 else real_now
    else:
        effective_now_utc = datetime.datetime.now(UTC_TZ)
    if effective_now_utc.tzinfo is None:
        effective_now_utc = effective_now_utc.replace(tzinfo=UTC_TZ)

    student_ids = [getattr(s, "id") for s in students]
    snapshots = db.query(StudentStatSnapshot).filter(
        StudentStatSnapshot.student_id.in_(student_ids),
        (StudentStatSnapshot.source != 'unverified') | (StudentStatSnapshot.source.is_(None))
    ).order_by(StudentStatSnapshot.student_id.asc(), StudentStatSnapshot.captured_at.asc()).all()

    grouped: Dict[int, List[StudentStatSnapshot]] = defaultdict(list)
    for snap in snapshots:
        grouped[getattr(snap, "student_id")].append(snap)

    growth: Dict[int, Dict[str, Any]] = {}

    for s in students:
        s_id = getattr(s, "id")
        snaps = _clean_snaps(grouped.get(s_id, []))
        st = s.stats
        c_snap = snaps[-1] if snaps else None

        if st and st.total_solved is not None:
            st_any = cast(Any, st)
            c_at = st_any.last_verified_at or st_any.last_updated or effective_now_utc
            if c_at and c_at.tzinfo is None:
                c_at = c_at.replace(tzinfo=UTC_TZ)
            cur_ez = int(st_any.easy_solved or 0)
            cur_med = int(st_any.medium_solved or 0)
            cur_hd = int(st_any.hard_solved or 0)
            cur_tot = int(st_any.total_solved)
            cur_rat = float(st_any.contest_rating) if st_any.contest_rating is not None else None

            if c_snap:
                c_snap_any = cast(Any, c_snap)
                cs_at = c_snap_any.captured_at
                if cs_at and cs_at.tzinfo is None:
                    cs_at = cs_at.replace(tzinfo=UTC_TZ)
                cs_tot = int(c_snap_any.total_solved if c_snap_any.total_solved is not None else 0)
                if cs_tot > cur_tot or (cs_at and cs_at > c_at):
                    cur_ez = int(c_snap_any.easy_solved or 0)
                    cur_med = int(c_snap_any.medium_solved or 0)
                    cur_hd = int(c_snap_any.hard_solved or 0)
                    cur_tot = cs_tot
                    if c_snap_any.contest_rating is not None:
                        cur_rat = float(c_snap_any.contest_rating)
                    c_at = max(c_at, cs_at)

            current_dict = {
                "captured_at": c_at.isoformat() if c_at else None,
                "source": st_any.source or "live_stats",
                "total_solved": cur_tot,
                "easy_solved": cur_ez,
                "medium_solved": cur_med,
                "hard_solved": cur_hd,
                "contest_rating": cur_rat
            }
        elif c_snap:
            c_snap_any = cast(Any, c_snap)
            c_at = c_snap_any.captured_at
            if c_at and c_at.tzinfo is None:
                c_at = c_at.replace(tzinfo=UTC_TZ)
            cur_ez = int(c_snap_any.easy_solved or 0)
            cur_med = int(c_snap_any.medium_solved or 0)
            cur_hd = int(c_snap_any.hard_solved or 0)
            cur_tot = int(c_snap_any.total_solved if c_snap_any.total_solved is not None else (cur_ez + cur_med + cur_hd))
            cur_rat = float(c_snap_any.contest_rating) if c_snap_any.contest_rating is not None else None
            current_dict = _serialize_snap(c_snap)
        else:
            growth[s_id] = {
                "growth_status": "UNKNOWN",
                "current_status": "UNKNOWN",
                "total_solved": None,
                "easy_solved": None,
                "medium_solved": None,
                "hard_solved": None,
                "contest_rating": None,
                "delta_total": None, "delta_easy": None, "delta_medium": None, "delta_hard": None, "delta_rating": None,
                "conflict_reason": "NO_SNAPSHOTS",
                "baseline": None,
                "current": None
            }
            continue

        # Check reconciliation on current:
        if cur_ez + cur_med + cur_hd != cur_tot:
            growth[s_id] = _conflict(None, c_snap, "reconciliation:current")
            continue

        # Check current staleness:
        if c_at and (effective_now_utc - c_at) > MAX_CURRENT_AGE:
            growth[s_id] = {
                "period": period,
                "growth_status": "UNKNOWN",
                "current_status": "VERIFIED",
                "total_solved": cur_tot,
                "easy_solved": cur_ez,
                "medium_solved": cur_med,
                "hard_solved": cur_hd,
                "contest_rating": cur_rat,
                "delta_total": None, "delta_easy": None, "delta_medium": None, "delta_hard": None, "delta_rating": None,
                "conflict_reason": "STALE_CURRENT_STATS",
                "baseline": None,
                "current": current_dict
            }
            continue

        if period == "all":
            baseline_snap = snaps[0] if snaps else None
            b_snap_any = cast(Any, baseline_snap) if baseline_snap else None
            b_rat = float(b_snap_any.contest_rating) if (b_snap_any and b_snap_any.contest_rating is not None) else None
            d_rat = None
            if b_rat is not None and cur_rat is not None:
                d_rat = round(cur_rat - b_rat, 1)

            growth[s_id] = {
                "period": period,
                "growth_status": "VERIFIED",
                "current_status": "VERIFIED",
                "total_solved": cur_tot,
                "easy_solved": cur_ez,
                "medium_solved": cur_med,
                "hard_solved": cur_hd,
                "contest_rating": cur_rat,
                "site_rank": getattr(st, "public_profile_ranking", None) if st else None,
                "contest_rank": getattr(st, "contest_global_ranking", None) if st else None,
                "global_rank": getattr(st, "public_profile_ranking", None) if st else None,
                "captured_at": current_dict.get("captured_at") if current_dict else None,
                "source": "all_time",
                "delta_total": cur_tot,
                "delta_easy": cur_ez,
                "delta_medium": cur_med,
                "delta_hard": cur_hd,
                "delta_rating": d_rat,
                "conflict_reason": None,
                "baseline": _serialize_snap(baseline_snap),
                "current": current_dict
            }
            continue

        baseline_snap = None
        if cutoff is not None:
            snaps_before_cutoff = [
                snap for snap in snaps
                if (snap.captured_at.replace(tzinfo=UTC_TZ) if snap.captured_at.tzinfo is None else snap.captured_at) <= cutoff
            ]
            if snaps_before_cutoff:
                baseline_snap = snaps_before_cutoff[-1]

        if baseline_snap is None:
            growth[s_id] = {
                "period": period,
                "growth_status": "UNKNOWN",
                "current_status": "VERIFIED",
                "total_solved": cur_tot,
                "easy_solved": cur_ez,
                "medium_solved": cur_med,
                "hard_solved": cur_hd,
                "contest_rating": cur_rat,
                "delta_total": None, "delta_easy": None, "delta_medium": None, "delta_hard": None, "delta_rating": None,
                "conflict_reason": "NO_VALID_BASELINE",
                "baseline": None,
                "current": current_dict
            }
            continue

        b_snap_any = cast(Any, baseline_snap)
        b_at = b_snap_any.captured_at
        if b_at and b_at.tzinfo is None:
            b_at = b_at.replace(tzinfo=UTC_TZ)

        max_staleness = MAX_BASELINE_STALENESS.get(period)
        if max_staleness and cutoff and (cutoff - b_at) > max_staleness:
            growth[s_id] = {
                "period": period,
                "growth_status": "UNKNOWN",
                "current_status": "VERIFIED",
                "total_solved": cur_tot,
                "easy_solved": cur_ez,
                "medium_solved": cur_med,
                "hard_solved": cur_hd,
                "contest_rating": cur_rat,
                "delta_total": None, "delta_easy": None, "delta_medium": None, "delta_hard": None, "delta_rating": None,
                "conflict_reason": "STALE_BASELINE",
                "baseline": _serialize_snap(baseline_snap),
                "current": current_dict
            }
            continue

        b_ez = int(b_snap_any.easy_solved or 0)
        b_med = int(b_snap_any.medium_solved or 0)
        b_hd = int(b_snap_any.hard_solved or 0)
        b_tot = int(b_snap_any.total_solved if b_snap_any.total_solved is not None else (b_ez + b_med + b_hd))
        b_rat = float(b_snap_any.contest_rating) if b_snap_any.contest_rating is not None else None

        if b_ez + b_med + b_hd != b_tot:
            growth[s_id] = _conflict(baseline_snap, c_snap, "reconciliation:baseline")
            continue

        if cur_hd < b_hd:
            growth[s_id] = _conflict(baseline_snap, c_snap, "negative_delta:hard")
            continue
        if cur_med < b_med:
            growth[s_id] = _conflict(baseline_snap, c_snap, "negative_delta:medium")
            continue
        if cur_ez < b_ez:
            growth[s_id] = _conflict(baseline_snap, c_snap, "negative_delta:easy")
            continue
        if cur_tot < b_tot:
            growth[s_id] = _conflict(baseline_snap, c_snap, "negative_delta:total")
            continue

        snap_d_ez = cur_ez - b_ez
        snap_d_med = cur_med - b_med
        snap_d_hd = cur_hd - b_hd
        snap_d_tot = cur_tot - b_tot

        d_tot = snap_d_tot
        d_ez = snap_d_ez
        d_med = snap_d_med
        d_hd = snap_d_hd

        if d_tot > cur_tot:
            d_tot = cur_tot
            if d_ez + d_med + d_hd > d_tot:
                scale = float(d_tot) / float(d_ez + d_med + d_hd) if (d_ez + d_med + d_hd) > 0 else 1.0
                d_ez = round(d_ez * scale)
                d_hd = round(d_hd * scale)
                d_med = max(0, d_tot - d_ez - d_hd)

        d_rat = None
        if b_rat is not None and cur_rat is not None:
            d_rat = round(cur_rat - b_rat, 1)

        growth[s_id] = {
            "period": period,
            "growth_status": "VERIFIED",
            "current_status": "VERIFIED",
            "total_solved": cur_tot,
            "easy_solved": cur_ez,
            "medium_solved": cur_med,
            "hard_solved": cur_hd,
            "contest_rating": cur_rat,
            "site_rank": getattr(st, "public_profile_ranking", None) if st else None,
            "contest_rank": getattr(st, "contest_global_ranking", None) if st else None,
            "global_rank": getattr(st, "public_profile_ranking", None) if st else None,
            "captured_at": current_dict.get("captured_at") if current_dict else None,
            "source": "snapshot_delta",
            "delta_total": d_tot,
            "delta_easy": d_ez,
            "delta_medium": d_med,
            "delta_hard": d_hd,
            "delta_rating": d_rat,
            "conflict_reason": None,
            "baseline": _serialize_snap(baseline_snap),
            "current": current_dict
        }

    return growth



@router.get("/history/{student_identifier}")
def get_student_history(
    student_identifier: str,
    limit: int = Query(50, ge=1, le=500),
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Returns time-series historical snapshots for a specific student by ID, register number, username, or name.
    """
    student = None
    clean_id = student_identifier.strip()
    
    if clean_id.isdigit():
        student = db.query(Student).filter(Student.id == int(clean_id)).first()
    
    if not student:
        student = db.query(Student).filter(
            (Student.reg_no.ilike(clean_id)) |
            (Student.username.ilike(clean_id)) |
            (Student.name.ilike(f"%{clean_id}%"))
        ).first()

    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{clean_id}' not found.")
    query = db.query(StudentStatSnapshot).filter(
        StudentStatSnapshot.student_id == student.id,
        (StudentStatSnapshot.source != 'unverified') | (StudentStatSnapshot.source.is_(None))
    )

    if from_date:
        try:
            fd = datetime.datetime.fromisoformat(from_date)
            query = query.filter(StudentStatSnapshot.captured_at >= fd)
        except ValueError:
            pass

    if to_date:
        try:
            td = datetime.datetime.fromisoformat(to_date)
            query = query.filter(StudentStatSnapshot.captured_at <= td)
        except ValueError:
            pass

    effective_limit = limit if isinstance(limit, int) else 50
    snapshots = query.order_by(StudentStatSnapshot.captured_at.desc()).limit(effective_limit).all()
    
    ui_snapshots = []
    
    # If no snapshots exist in DB, dynamically create baseline snapshot on-the-fly
    if not snapshots and student.stats:
        st = student.stats
        now = datetime.datetime.now(UTC_TZ)
        snap = StudentStatSnapshot(
            student_id=student.id,
            total_solved=st.total_solved or 0,
            easy_solved=st.easy_solved or 0,
            medium_solved=st.medium_solved or 0,
            hard_solved=st.hard_solved or 0,
            contest_rating=st.contest_rating,
            global_rank=st.public_profile_ranking,
            contest_global_ranking=st.contest_global_ranking,
            delta_total=None,
            delta_easy=None,
            delta_medium=None,
            delta_hard=None,
            delta_rating=None,
            captured_at=now,
            sync_run_id="SYNC-ON-DEMAND",
            source="on_demand",
            is_verified=False
        )
        db.add(snap)
        db.commit()
        db.refresh(snap)
        ui_snapshots = [snap]

    act = getattr(student, "lc_activity", None)
    cal_counts = _parse_cal_counts(act.submission_calendar_json if act else None)

    growth_available = len(snapshots) >= 2
    for i in range(len(snapshots)):
        s_curr = cast(Any, snapshots[i])
        if s_curr.contest_rating is not None and (float(s_curr.contest_rating) == 1500.0 or float(s_curr.contest_rating) == 0):
            s_curr.contest_rating = None

        if i < len(snapshots) - 1:
            s_prev = cast(Any, snapshots[i + 1])
            c_ez = int(s_curr.easy_solved or 0)
            c_med = int(s_curr.medium_solved or 0)
            c_hd = int(s_curr.hard_solved or 0)
            c_tot = int(s_curr.total_solved if s_curr.total_solved is not None else (c_ez + c_med + c_hd))

            p_ez = int(s_prev.easy_solved or 0)
            p_med = int(s_prev.medium_solved or 0)
            p_hd = int(s_prev.hard_solved or 0)
            p_tot = int(s_prev.total_solved if s_prev.total_solved is not None else (p_ez + p_med + p_hd))

            d_ez = max(0, c_ez - p_ez)
            d_med = max(0, c_med - p_med)
            d_hd = max(0, c_hd - p_hd)
            d_tot = max(0, c_tot - p_tot)
            if d_tot == 0 and (d_ez + d_med + d_hd) > 0:
                d_tot = d_ez + d_med + d_hd

            s_curr.delta_easy = d_ez
            s_curr.delta_medium = d_med
            s_curr.delta_hard = d_hd
            s_curr.delta_total = d_tot

            p_rat = s_prev.contest_rating
            if p_rat is not None and (float(p_rat) == 1500.0 or float(p_rat) == 0):
                p_rat = None
            c_rat = s_curr.contest_rating
            if c_rat is not None and p_rat is not None:
                s_curr.delta_rating = round(float(c_rat) - float(p_rat), 1)
            else:
                s_curr.delta_rating = None
        else:
            s_curr.delta_total = None
            s_curr.delta_easy = None
            s_curr.delta_medium = None
            s_curr.delta_hard = None
            s_curr.delta_rating = None

    st_rat = student.stats.contest_rating if student.stats else None
    if st_rat is not None and (float(st_rat) == 1500.0 or float(st_rat) == 0):
        st_rat = None

    # Return enriched response containing student info + snapshots
    return {
        "student": {
            "id": student.id,
            "name": student.name,
            "reg_no": student.reg_no,
            "username": student.username,
            "profile_url": f"https://leetcode.com/u/{student.username}/" if student.username else None,
            "department": student.department.code if student.department else "CSE",
            "year": student.year_level,
            "total_solved": (student.stats.total_solved or 0) if student.stats else 0,
            "easy_solved": (student.stats.easy_solved or 0) if student.stats else 0,
            "medium_solved": (student.stats.medium_solved or 0) if student.stats else 0,
            "hard_solved": (student.stats.hard_solved or 0) if student.stats else 0,
            "contest_rating": st_rat
        },
        "growth_available": growth_available,
        "snapshots": [StudentStatSnapshotOut.model_validate(s) for s in snapshots],
        "ui_snapshots": [StudentStatSnapshotOut.model_validate(s) for s in ui_snapshots]
    }


@router.get("/growth/improvers", response_model=List[ImproverOut])
def get_top_improvers(
    period: str = Query("7d", pattern="^(today|7d|30d|all)$"),
    dept: Optional[str] = None,
    dept_id: Optional[int] = None,
    year: Optional[str] = None,
    year_level: Optional[str] = None,
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Returns top problem solving improvers (biggest delta) over specified period.
    Supports filtering by department code/id and academic year.
    """
    cutoff = _growth_cutoff(period)
    students = _filtered_growth_students(db, dept, dept_id, year, year_level, current_user=current_user)
    growth = _derived_growth(db, students, cutoff, period=period)
    
    results = []
    for student in students:
        values = growth.get(getattr(student, "id"), {"growth_status": "UNKNOWN", "total": None, "easy": None, "medium": None, "hard": None, "rating": None})
        if values.get("growth_status") != "VERIFIED":
            continue
        # In specific time windows ('today', '7d', '30d'), only students with active problem solve growth are displayed
        if period in ("today", "7d", "30d") and (values.get("delta_total") or 0) <= 0:
            continue
        results.append((student, values))

    def _safe_neg(val):
        return -val if val is not None else float('inf')
        
    results.sort(key=lambda item: (
        _safe_neg(item[1].get("delta_total")),
        _safe_neg(item[1].get("delta_hard")),
        _safe_neg(item[1].get("delta_medium")),
        _safe_neg(item[1].get("delta_easy")),
        _safe_neg(item[1].get("delta_rating")),
        -((item[0].stats.total_solved or 0) if item[0].stats else 0),
        item[0].name.lower(),
        item[0].id
    ))
    results = results[:limit]

    improvers = []
    for st, values in results:
        dept_code = st.department.code if st.department else "CSE"
        sec_name = st.section.name if st.section else "A"
        cur_solved = values.get("total_solved") or (
            ((st.stats.easy_solved or 0) + (st.stats.medium_solved or 0) + (st.stats.hard_solved or 0)) if st.stats else 0
        )
        cur_rating = st.stats.contest_rating if st.stats else None
        username = st.username
        profile_url = f"https://leetcode.com/u/{username}/" if username else None

        improvers.append(ImproverOut(
            student_id=st.id,
            reg_no=st.reg_no,
            name=st.name,
            department_code=dept_code,
            year_level=st.year_level,
            section_name=sec_name,
            username=username,
            profile_url=profile_url,
            total_solved=cur_solved,
            easy_solved=st.stats.easy_solved or 0 if st.stats else 0,
            medium_solved=st.stats.medium_solved or 0 if st.stats else 0,
            hard_solved=st.stats.hard_solved or 0 if st.stats else 0,
            delta_solved=values.get("delta_total") if period != "all" else cur_solved,
            delta_easy=values.get("delta_easy") if period != "all" else (st.stats.easy_solved or 0 if st.stats else 0),
            delta_medium=values.get("delta_medium") if period != "all" else (st.stats.medium_solved or 0 if st.stats else 0),
            delta_hard=values.get("delta_hard") if period != "all" else (st.stats.hard_solved or 0 if st.stats else 0),
            delta_rating=values.get("delta_rating") if period != "all" else None,
            growth_status=values.get("growth_status") if period != "all" else None,
            current_status=values.get("current_status"),
            conflict_reason=values.get("conflict_reason"),
            baseline=values.get("baseline"),
            current=values.get("current"),
            current_contest_rating=cur_rating
        ))

    return improvers


@router.get("/growth/options")
def get_growth_options(db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user_optional)):
    """Return filter values from the active student records."""
    departments_query = db.query(Department.id, Department.code, Department.name).join(
        Student, Student.department_id == Department.id
    ).filter(
        (Student.is_active == True) | (Student.is_active.is_(None))
    )
    
    from backend.services.authorization_service import _STAFF_ROLES, _HOD_ROLES, _normalize_role
    role_clean = _normalize_role(current_user)
    if current_user and role_clean in _STAFF_ROLES:
        from backend.services.faculty_assignment_service import FacultyAssignmentService
        assigned_ids = FacultyAssignmentService.get_faculty_assigned_student_ids(db, int(cast(Any, current_user).id))
        if assigned_ids:
            departments_query = departments_query.filter(Student.id.in_(assigned_ids))
        else:
            departments_query = departments_query.filter(Student.id == -1)
    elif current_user and role_clean in _HOD_ROLES:
        from backend.services.authorization_service import get_hod_authorized_department_ids
        dept_ids = get_hod_authorized_department_ids(db, current_user)
        if dept_ids:
            departments_query = departments_query.filter(Department.id.in_(dept_ids))
        elif current_user.department_id:
            departments_query = departments_query.filter(Department.id == current_user.department_id)
        
    departments = departments_query.distinct().order_by(Department.name.asc()).all()
    
    valid_depts = [
        {"id": department_id, "code": code, "name": name}
        for department_id, code, name in departments
        if not (
            (code or "").upper().strip() == "CSE" or
            (code or "").upper().startswith("TEST") or 
            "_TEST" in (code or "").upper() or 
            "-TEST" in (code or "").upper() or
            "TEST" in (name or "").upper() or
            "DEMO" in (code or "").upper()
        )
    ]
    
    return {
        "departments": valid_depts,
        "years": ["I", "II", "III", "IV"]
    }


@router.get("/growth/college-delta")
def get_college_delta(
    period: str = Query("7d", pattern="^(today|7d|30d|all)$"),
    dept: Optional[str] = None,
    dept_id: Optional[int] = None,
    year: Optional[str] = None,
    year_level: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Returns aggregate college problem solved growth and difficulty breakdown over period,
    with support for department and academic year filters.
    """
    cutoff = _growth_cutoff(period)
    student_rows = _filtered_growth_students(db, dept, dept_id, year, year_level, current_user=current_user)
    growth = _derived_growth(db, student_rows, cutoff, period=period)
    
    verified_growth = [values for values in growth.values() if values.get("growth_status") == "VERIFIED"]
    
    period_totals = {
        key: sum((values.get(f"delta_{key}") or 0) for values in verified_growth)
        for key in ("total", "easy", "medium", "hard")
    }
    
    if period in ("today", "7d", "30d"):
        active_period_students = sum(1 for v in verified_growth if (v.get("delta_total") or 0) > 0)
    else:
        active_period_students = sum(1 for v in verified_growth if (v.get("total_solved") or 0) > 0)

    current_total = sum(
        ((student.stats.easy_solved or 0) + (student.stats.medium_solved or 0) + (student.stats.hard_solved or 0))
        if student.stats else 0
        for student in student_rows
    )
    current_easy = sum((student.stats.easy_solved or 0) for student in student_rows if student.stats)
    current_medium = sum((student.stats.medium_solved or 0) for student in student_rows if student.stats)
    current_hard = sum((student.stats.hard_solved or 0) for student in student_rows if student.stats)
    
    if period == "all":
        selected_total = current_total
        selected_easy = current_easy
        selected_medium = current_medium
        selected_hard = current_hard
        delta_total = current_total
        delta_easy = current_easy
        delta_medium = current_medium
        delta_hard = current_hard
    else:
        selected_total = period_totals["total"]
        selected_easy = period_totals["easy"]
        selected_medium = period_totals["medium"]
        selected_hard = period_totals["hard"]
        delta_total = period_totals["total"]
        delta_easy = period_totals["easy"]
        delta_medium = period_totals["medium"]
        delta_hard = period_totals["hard"]

    return {
        "period": period,
        "delta_total": delta_total,
        "delta_easy": delta_easy,
        "delta_medium": delta_medium,
        "delta_hard": delta_hard,
        "total_students": len(student_rows),
        "verified_students": len(verified_growth),
        "unknown_students": sum(1 for v in growth.values() if v.get("growth_status") == "UNKNOWN"),
        "conflict_students": sum(1 for v in growth.values() if v.get("growth_status") == "CONFLICT"),
        "active_students": active_period_students,
        "active_solvers": active_period_students,
        "total_solved": selected_total,
        "easy_solved": selected_easy,
        "medium_solved": selected_medium,
        "hard_solved": selected_hard,
        "growth": delta_total
    }
