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
    "today": datetime.timedelta(hours=48),
    "7d": datetime.timedelta(hours=72),
    "30d": datetime.timedelta(hours=96)
}

MAX_CURRENT_AGE = datetime.timedelta(hours=72)

def _clean_snaps(snaps: List[StudentStatSnapshot]) -> List[StudentStatSnapshot]:
    """Keep eligible snapshots for growth processing."""
    out = []
    for sn in snaps:
        if getattr(sn, "source", None) in ("on_demand", "unverified"):
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


def _derived_growth(db: Session, students: List[Student], cutoff: Optional[datetime.datetime], period: str = "7d", now_utc: Optional[datetime.datetime] = None) -> Dict[int, Dict[str, Any]]:
    if not students:
        return {}
    
    now_ist = datetime.datetime.now(IST_TZ)
    if now_utc is None:
        now_utc = datetime.datetime.now(UTC_TZ)
    elif now_utc.tzinfo is None:
        now_utc = now_utc.replace(tzinfo=UTC_TZ)
    
    today_date_ist = now_ist.date()
    today_date_utc = now_utc.date()
    target_dates = _get_target_dates(period, today_date_ist, today_date_utc)

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
        
        # Determine Current State from live stats or latest snapshot
        cur_ez = (st.easy_solved or 0) if st else 0
        cur_med = (st.medium_solved or 0) if st else 0
        cur_hd = (st.hard_solved or 0) if st else 0
        cur_tot = max(st.total_solved or 0 if st else 0, cur_ez + cur_med + cur_hd)
        cur_rat = st.contest_rating if st else None
        
        c_snap = snaps[-1] if snaps else None
        if st and st.total_solved is not None:
            c_at = st.last_verified_at or st.last_updated or now_utc
            if c_at and c_at.tzinfo is None:
                c_at = c_at.replace(tzinfo=UTC_TZ)
            current_dict = {
                "captured_at": c_at.isoformat() if c_at else None,
                "source": st.source or "live_stats",
                "total_solved": cur_tot,
                "easy_solved": cur_ez,
                "medium_solved": cur_med,
                "hard_solved": cur_hd,
                "contest_rating": cur_rat
            }
        elif c_snap:
            cur_ez = c_snap.easy_solved or 0
            cur_med = c_snap.medium_solved or 0
            cur_hd = c_snap.hard_solved or 0
            cur_tot = max(c_snap.total_solved or 0, cur_ez + cur_med + cur_hd)
            cur_rat = c_snap.contest_rating
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

        baseline_snap: Optional[StudentStatSnapshot] = None
        has_valid_baseline = False
        if cutoff is not None:
            for snap in snaps:
                s_at = snap.captured_at
                if s_at.tzinfo is None:
                    s_at = s_at.replace(tzinfo=UTC_TZ)
                if s_at <= cutoff:
                    baseline_snap = snap
                    has_valid_baseline = True
                else:
                    break

        if baseline_snap is None and snaps:
            baseline_snap = snaps[0]

        # Check if student has official submission heatmap calendar (LeetCodeActivity)
        act = getattr(s, "lc_activity", None)
        cal_entries = _parse_cal_entries(act.submission_calendar_json if act else None)

        b_ez = (baseline_snap.easy_solved or 0) if baseline_snap else 0
        b_med = (baseline_snap.medium_solved or 0) if baseline_snap else 0
        b_hd = (baseline_snap.hard_solved or 0) if baseline_snap else 0
        b_tot = (baseline_snap.total_solved or (b_ez + b_med + b_hd)) if baseline_snap else 0

        snap_d_ez = max(0, cur_ez - b_ez)
        snap_d_med = max(0, cur_med - b_med)
        snap_d_hd = max(0, cur_hd - b_hd)
        snap_d_tot = snap_d_ez + snap_d_med + snap_d_hd

        if period == "all":
            cal_delta = sum(cnt for _, cnt in cal_entries)
            d_tot = cal_delta if cal_delta > 0 else cur_tot
            d_ez, d_med, d_hd = cur_ez, cur_med, cur_hd
            d_rat = None
            if baseline_snap and baseline_snap.contest_rating is not None and cur_rat is not None:
                d_rat = round(float(cur_rat) - float(baseline_snap.contest_rating), 1)

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
                "delta_total": d_tot,
                "delta_easy": d_ez,
                "delta_medium": d_med,
                "delta_hard": d_hd,
                "delta_rating": d_rat,
                "conflict_reason": None,
                "baseline": _serialize_snap(baseline_snap),
                "current": current_dict
            }
            continue

        # For today, 7d, 30d: Calculate ground-truth calendar delta + live snapshot delta reconciliation
        cal_delta = _sum_cal_delta(cal_entries, target_dates) if cal_entries else 0
        d_tot = max(cal_delta, snap_d_tot) if has_valid_baseline else cal_delta

        if d_tot > 0:
            if snap_d_tot == d_tot:
                d_ez, d_med, d_hd = snap_d_ez, snap_d_med, snap_d_hd
            elif snap_d_tot > 0:
                d_ez = int(round(d_tot * (snap_d_ez / snap_d_tot)))
                d_hd = int(round(d_tot * (snap_d_hd / snap_d_tot)))
                d_med = max(0, d_tot - d_ez - d_hd)
                if d_ez + d_med + d_hd != d_tot:
                    d_ez = d_tot - d_med - d_hd
            elif cur_tot > 0:
                d_ez = int(round(d_tot * (cur_ez / cur_tot)))
                d_hd = int(round(d_tot * (cur_hd / cur_tot)))
                d_med = max(0, d_tot - d_ez - d_hd)
                if d_ez + d_med + d_hd != d_tot:
                    d_ez = d_tot - d_med - d_hd
            else:
                d_ez, d_med, d_hd = d_tot, 0, 0
        else:
            d_ez, d_med, d_hd = 0, 0, 0

        d_rat = None
        if baseline_snap and baseline_snap.contest_rating is not None and cur_rat is not None:
            d_rat = round(float(cur_rat) - float(baseline_snap.contest_rating), 1)

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
            "source": "reconciled_telemetry",
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

    return growth

def _serialize_snap(snap: Optional[StudentStatSnapshot]) -> Optional[Dict[str, Any]]:
    if not snap:
        return None
    c_at = snap.captured_at
    if c_at and c_at.tzinfo is None:
        c_at = c_at.replace(tzinfo=UTC_TZ)
    rat = snap.contest_rating
    if rat is not None and (float(rat) == 1500.0 or float(rat) == 0):
        rat = None
    return {
        "captured_at": c_at.isoformat() if c_at else None,
        "source": snap.source,
        "total_solved": snap.total_solved,
        "easy_solved": snap.easy_solved,
        "medium_solved": snap.medium_solved,
        "hard_solved": snap.hard_solved,
        "contest_rating": rat
    }

def _conflict(baseline: StudentStatSnapshot, current: StudentStatSnapshot, reason: str) -> Dict[str, Any]:
    return {
        "growth_status": "CONFLICT",
        "delta_total": None, "delta_easy": None, "delta_medium": None, "delta_hard": None, "delta_rating": None,
        "conflict_reason": reason,
        "baseline": _serialize_snap(baseline),
        "current": _serialize_snap(current)
    }

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
    if len(snapshots) == 1:
        # Only one eligible snapshot exists
        s0 = cast(Any, snapshots[0])
        s0.delta_total = None
        s0.delta_easy = None
        s0.delta_medium = None
        s0.delta_hard = None
        s0.delta_rating = None
    elif len(snapshots) >= 2:
        if cal_counts:
            # Reconcile snapshot totals & deltas from ground-truth submission_calendar_json
            st = student.stats
            if st and st.total_solved:
                snapshots[0].total_solved = st.total_solved
                snapshots[0].easy_solved = st.easy_solved or 0
                snapshots[0].medium_solved = st.medium_solved or 0
                snapshots[0].hard_solved = st.hard_solved or 0

            for i in range(len(snapshots) - 1):
                s_curr = cast(Any, snapshots[i])
                s_prev = cast(Any, snapshots[i + 1])

                d_curr = s_curr.captured_at.date() if s_curr.captured_at else datetime.datetime.now(UTC_TZ).date()
                d_prev = s_prev.captured_at.date() if s_prev.captured_at else d_curr

                # Sum official calendar submissions in range (d_prev, d_curr]
                period_cal_sum = sum(cnt for d, cnt in cal_counts.items() if d_prev < d <= d_curr)

                if period_cal_sum > 0:
                    d_tot = period_cal_sum
                    s_curr.delta_total = d_tot

                    # Reconcile previous snapshot total_solved
                    reconciled_prev_tot = max(0, (s_curr.total_solved or 0) - d_tot)
                    s_prev.total_solved = reconciled_prev_tot

                    # Difficulty breakdown deltas
                    c_ez = s_curr.easy_solved or 0
                    c_med = s_curr.medium_solved or 0
                    c_hd = s_curr.hard_solved or 0
                    c_tot = s_curr.total_solved or 1

                    snap_d_ez = c_ez - (s_prev.easy_solved or 0)
                    snap_d_med = c_med - (s_prev.medium_solved or 0)
                    snap_d_hd = c_hd - (s_prev.hard_solved or 0)

                    if snap_d_ez >= 0 and snap_d_med >= 0 and snap_d_hd >= 0 and (snap_d_ez + snap_d_med + snap_d_hd) == d_tot:
                        s_curr.delta_easy = snap_d_ez
                        s_curr.delta_medium = snap_d_med
                        s_curr.delta_hard = snap_d_hd
                    else:
                        d_ez = int(round(d_tot * (c_ez / c_tot)))
                        d_hd = int(round(d_tot * (c_hd / c_tot)))
                        d_med = max(0, d_tot - d_ez - d_hd)
                        if d_ez + d_med + d_hd != d_tot:
                            d_ez = d_tot - d_med - d_hd

                        s_curr.delta_easy = d_ez
                        s_curr.delta_medium = d_med
                        s_curr.delta_hard = d_hd

                        s_prev.easy_solved = max(0, c_ez - d_ez)
                        s_prev.medium_solved = max(0, c_med - d_med)
                        s_prev.hard_solved = max(0, c_hd - d_hd)
                else:
                    s_curr.delta_total = 0
                    s_curr.delta_easy = 0
                    s_curr.delta_medium = 0
                    s_curr.delta_hard = 0
                    s_prev.total_solved = s_curr.total_solved
                    s_prev.easy_solved = s_curr.easy_solved
                    s_prev.medium_solved = s_curr.medium_solved
                    s_prev.hard_solved = s_curr.hard_solved

                if s_curr.contest_rating is not None and (float(s_curr.contest_rating) == 1500.0 or float(s_curr.contest_rating) == 0):
                    s_curr.contest_rating = None
                p_rat = s_prev.contest_rating
                if p_rat is not None and (float(p_rat) == 1500.0 or float(p_rat) == 0):
                    p_rat = None
                c_rat = s_curr.contest_rating
                if c_rat is not None and p_rat is not None:
                    s_curr.delta_rating = round(float(c_rat) - float(p_rat), 1)
                else:
                    s_curr.delta_rating = None

            s_oldest = cast(Any, snapshots[-1])
            s_oldest.delta_total = None
            s_oldest.delta_easy = None
            s_oldest.delta_medium = None
            s_oldest.delta_hard = None
            s_oldest.delta_rating = None
            if s_oldest.contest_rating is not None and (float(s_oldest.contest_rating) == 1500.0 or float(s_oldest.contest_rating) == 0):
                s_oldest.contest_rating = None

            try:
                db.commit()
            except Exception:
                db.rollback()
        else:
            # Fallback to direct snapshot subtraction if no submission calendar exists
            for i in range(len(snapshots)):
                s_curr = cast(Any, snapshots[i])
                if s_curr.contest_rating is not None and (float(s_curr.contest_rating) == 1500.0 or float(s_curr.contest_rating) == 0):
                    s_curr.contest_rating = None

                if i < len(snapshots) - 1:
                    s_prev = cast(Any, snapshots[i + 1])
                    c_ez = s_curr.easy_solved or 0
                    c_med = s_curr.medium_solved or 0
                    c_hd = s_curr.hard_solved or 0
                    c_tot = s_curr.total_solved or 0

                    p_ez = s_prev.easy_solved or 0
                    p_med = s_prev.medium_solved or 0
                    p_hd = s_prev.hard_solved or 0
                    p_tot = s_prev.total_solved or 0

                    d_ez = c_ez - p_ez
                    d_med = c_med - p_med
                    d_hd = c_hd - p_hd
                    d_tot = c_tot - p_tot if (c_tot - p_tot) != 0 else (d_ez + d_med + d_hd)
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
