import datetime
import uuid
import json
import hashlib
import threading
import copy
import logging
import re
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from backend.models import Student, ReportHistory
from backend.services.report_models import ReportConfig
from backend.services.report_data_service import fetch_normalized_students, fetch_normalized_contests, get_problem_category
from backend.services.report_validators import validate_data_quality
from backend.services.contest_performance_service import build_contest_performance_report
from backend.services.report_registry import get_report_definition
from backend.services.data_version_service import get_current_data_version

logger = logging.getLogger(__name__)

_UNIVERSAL_DATASET_CACHE: Dict[str, Dict[str, Any]] = {}
_UNIVERSAL_CACHE_LOCK = threading.Lock()

def clear_universal_dataset_cache():
    with _UNIVERSAL_CACHE_LOCK:
        _UNIVERSAL_DATASET_CACHE.clear()

def to_roman_year(val: Any) -> str:
    if not val:
        return ""
    v = str(val).strip().upper()
    if v in ("1", "1ST", "I", "I YEAR", "1 YEAR"):
        return "I"
    elif v in ("2", "2ND", "II", "II YEAR", "2 YEAR"):
        return "II"
    elif v in ("3", "3RD", "III", "III YEAR", "3 YEAR"):
        return "III"
    elif v in ("4", "4TH", "IV", "IV YEAR", "4 YEAR", "FINAL"):
        return "IV"
    if "III" in v:
        return "III"
    elif "II" in v:
        return "II"
    elif "IV" in v:
        return "IV"
    elif "I" in v:
        return "I"
    return v


def clean_report_title(t_str: str) -> str:
    if not t_str:
        return ""
    t = str(t_str).strip()
    # 1. Strip leading standalone numbers e.g. "2 2 ", "2 ", "3 ", "2-", "2 2"
    t = re.sub(r'^\s*(\d+(?:[\s-]+|$))+', '', t).strip()
    # 2. Strip orphaned standalone numbers before hyphens e.g. " (AUTONOMOUS) 2 - " -> " (AUTONOMOUS) "
    t = re.sub(r'\s+\d+\s*-\s*', ' ', t).strip()
    # 3. Convert (3 Year), (3Yr), (3) to (III Year)
    def repl_yr(m):
        r_y = to_roman_year(m.group(1))
        return f"({r_y} Year)"
    t = re.sub(r'\(\s*(\d+|I+|IV|V|FINAL|1ST|2ND|3RD|4TH)\s*(?:Year|Yr)?\s*\)', repl_yr, t, flags=re.IGNORECASE)
    # 4. Convert standalone "3 Year" / "3rd Year" to "III Year"
    t = re.sub(r'\b(\d+|1ST|2ND|3RD|4TH)\s*(?:Year|Yr)\b', lambda m: f"{to_roman_year(m.group(1))} Year", t, flags=re.IGNORECASE)
    return t.strip()


def build_universal_report(db: Session, config: ReportConfig, current_user: Optional[Any] = None) -> Dict[str, Any]:
    """
    UNIVERSAL REPORT ENGINE
    Single Source of Truth generator that creates normalized datasets for all report types.
    Enforces strict report code validation via report_registry.
    Sub-millisecond dataset caching powered by global data versioning.
    """
    # 1. Validate Report Registry Specification and resolve canonical code
    rpt_def = get_report_definition(config.report_type)
    canon_report_code = rpt_def["code"]

    # 0. Check in-memory dataset cache for sub-millisecond responses (< 5ms)
    user_role = (getattr(current_user, "role", "") or "").lower()
    user_dept = str(getattr(current_user, "department_id", "") or "")
    data_ver = get_current_data_version(db)

    raw_key = json.dumps({
        "type": canon_report_code,
        "dept": (config.department or "").upper(),
        "year": (config.year or "").upper(),
        "scope": (config.output_scope or "").upper(),
        "filters": config.filters or {},
        "role": user_role,
        "u_dept": user_dept,
        "ver": data_ver
    }, sort_keys=True)
    cache_key = hashlib.md5(raw_key.encode("utf-8")).hexdigest()

    with _UNIVERSAL_CACHE_LOCK:
        if cache_key in _UNIVERSAL_DATASET_CACHE:
            return copy.deepcopy(_UNIVERSAL_DATASET_CACHE[cache_key])

    WOW_INTEL_TYPES = (
        "WEEK_ON_WEEK_INTELLIGENCE", "WEEK_ON_WEEK",
        "WOW_INTEL", "WOW", "WOW_INTELLIGENCE", "WEEK_ON_WEEK_COMPARISON"
    )
    HIST_INTEL_TYPES = (
        "HISTORICAL_CONTEST_INTELLIGENCE", "HISTORICAL_CONTEST_INTEL"
    )
    CONTEST_REPORT_TYPES = (
        "FRIDAY_OFFICIAL_CONTEST", "FRIDAY_OFFICIAL", "FRIDAY_OFFICIAL_RESULT",
        "CONTEST_PERFORMANCE", "OFFICIAL_CONTEST", "WEEKLY_CONTEST",
        "SUNDAY_LIVE_CONTEST", "WEEKLY_CONTEST_INTELLIGENCE",
        "CONTEST_ATTENDANCE_PARTICIPATION", "CONTEST_PERFORMANCE_RANKING",
        "SUNDAY_CONTEST",
    )

    rtype_upper = (config.report_type or "").upper()

    REPORT_TYPE_TITLES = {
        "WEEKLY_CONTEST_INTELLIGENCE": "Weekly Contest Intelligence Report",
        "SUNDAY_LIVE_CONTEST": "Sunday Live Contest Report",
        "CONTEST_ATTENDANCE_PARTICIPATION": "Contest Attendance & Participation Report",
        "CONTEST_PERFORMANCE_RANKING": "Contest Performance & Ranking Report",
        "WEEKLY_STUDENT_PERFORMANCE": "Weekly Student Performance Report",
        "WEEKLY_PERFORMANCE": "Coordinator Weekly Performance Report",
        "FIVE_WEEK_PERFORMANCE_TREND": "Five-Week Performance Trend Report",
        "PROBLEM_DIFFICULTY_INTELLIGENCE": "Problem Difficulty Intelligence Report",
        "FACULTY_CONSOLIDATED": "Faculty Consolidated Performance Report",
        "FACULTY_COORDINATOR_CONSOLIDATED": "Faculty Coordinator Consolidated Report",
        "HOD_DEPARTMENT_INTELLIGENCE": "HOD Department Intelligence Report",
        "PRINCIPAL_EXECUTIVE": "Principal Executive Intelligence Report",
        "MANAGEMENT_EXECUTIVE_SUMMARY": "Management Executive Summary Report",
        "12TH_TNEA_CUTOFF_ANALYSIS": "12TH TNEA CUTOFF",
    }

    rpt_key = rtype_upper or "REPORT"
    base_title = REPORT_TYPE_TITLES.get(rpt_key, rpt_key.replace('_', ' ').title())
    title = base_title
    if config.department and config.department != "ALL":
        title = f"{config.department} - {title}"
    if config.year and config.year != "ALL":
        roman_yr = to_roman_year(config.year)
        title = f"{title} ({roman_yr} Year)"
    title = clean_report_title(title)

    report_id = f"RPT-{datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    def _save_and_return(res_data):
        unique_rid = f"RPT-{datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
        final_rid = res_data.get("reportId") or res_data.get("report_id") or unique_rid
        res_data["reportId"] = final_rid
        res_data["report_id"] = final_rid
        res_data["department"] = config.department or "ALL"
        res_data["deptFilter"] = config.department or "ALL"
        res_data["year"] = config.year or "ALL"
        res_data["yearFilter"] = config.year or "ALL"
        try:
            existing = db.query(ReportHistory).filter(ReportHistory.report_id == final_rid).first()
            if existing:
                existing.dataset = res_data
                existing.status = "GENERATED"
                existing.title = res_data.get("title") or res_data.get("reportTitle") or title
                existing.filters = config.model_dump()
            else:
                history_entry = ReportHistory(
                    report_id=final_rid,
                    report_type=config.report_type,
                    title=res_data.get("title") or res_data.get("reportTitle") or title,
                    filters=config.model_dump(),
                    dataset=res_data,
                    status="GENERATED"
                )
                db.add(history_entry)
            db.commit()
        except Exception as ex:
            db.rollback()
            logger.warning(f"[REPORT_HISTORY_NOTE] {ex}")
        with _UNIVERSAL_CACHE_LOCK:
            _UNIVERSAL_DATASET_CACHE[cache_key] = copy.deepcopy(res_data)
        return res_data

    if rtype_upper in WOW_INTEL_TYPES:
        from backend.services.wow_intel_service import build_wow_intel_report
        res = build_wow_intel_report(db, config, current_user=current_user)
        return _save_and_return(res)

    if rtype_upper in HIST_INTEL_TYPES:
        from backend.services.hist_intel_service import build_hist_intel_report
        res = build_hist_intel_report(db, config, current_user=current_user)
        return _save_and_return(res)

    if config.report_type and rtype_upper in CONTEST_REPORT_TYPES:
        res = build_contest_performance_report(db, config, current_user=current_user)
        return _save_and_return(res)

    if config.report_type and config.report_type.upper() in ("FIVE_WEEK_PERFORMANCE_TREND", "BATCH_PERFORMANCE"):
        from backend.services.five_week_trend_service import build_five_week_trend_report
        res = build_five_week_trend_report(db, config, current_user=current_user)
        return _save_and_return(res)

    WEEKLY_PERFORMANCE_TYPES = (
        "WEEKLY_STUDENT_PERFORMANCE", "WEEKLY_PERFORMANCE",
    )
    if rtype_upper in WEEKLY_PERFORMANCE_TYPES:
        from backend.services.weekly_report_service import generate_weekly_performance_data
        cfg_flt = config.filters or {}
        raw = generate_weekly_performance_data(
            db,
            current_user=current_user,
            dept_filter=config.department,
            year_filter=config.year,
            batch_filter=cfg_flt.get("batch") or cfg_flt.get("batch_filter"),
            session_id=cfg_flt.get("session_id")
        )
        # Sanitize non-serializable objects (WeeklySession ORM instances in session_resolution)
        sr = raw.get("session_resolution", {})
        sanitized_sr = {}
        for k, v in sr.items():
            if hasattr(v, "__dict__") and hasattr(v, "__tablename__"):
                # ORM object → extract safe attrs
                sanitized_sr[k] = str(v) if v else None
            else:
                sanitized_sr[k] = v
        raw["session_resolution"] = sanitized_sr
        # Strip non-serializable public_obj / virtual_obj from student rows
        for stu in raw.get("all_students_current", []):
            stu.pop("public_obj", None)
            stu.pop("virtual_obj", None)
        for stu in raw.get("rosters", {}).get("all_current", []):
            stu.pop("public_obj", None)
            stu.pop("virtual_obj", None)
        # Wrap with standard report envelope keys the frontend expects
        raw["reportType"] = config.report_type
        raw["reportId"] = raw.get("report_id", report_id)
        raw["title"] = title
        raw["dataStatus"] = "READY" if raw.get("total_students", 0) > 0 else "PARTIAL"
        raw["generatedAt"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        if not raw.get("rows"):
            raw["rows"] = raw.get("all_students_current", [])
        if not raw.get("allStudents"):
            raw["allStudents"] = raw.get("all_students_current", [])
        return _save_and_return(raw)

    cfg_filters = config.filters or {}
    students = fetch_normalized_students(
        db,
        dept_filter=config.department,
        year_filter=config.year,
        section_filter=cfg_filters.get("section", "ALL"),
        batch_filter=cfg_filters.get("batch", "ALL"),
        status_filter=cfg_filters.get("status") or cfg_filters.get("attendanceStatus") or "ALL",
        search_query=cfg_filters.get("search") or cfg_filters.get("searchQuery") or cfg_filters.get("query"),
        performance_range=cfg_filters.get("performanceRange") or cfg_filters.get("range") or "ALL",
        current_user=current_user,
        session_id=cfg_filters.get("session_id")
    )
    data_quality = validate_data_quality(students)

    if cfg_filters.get("student_id"):
        target_id = int(cfg_filters.get("student_id"))
        # We need to find the reg_no for this student_id first to filter the normalized StudentRow objects
        student_obj = db.query(Student).filter(Student.id == target_id).first()
        if student_obj:
            st_reg = getattr(student_obj, "reg_no", None) or getattr(student_obj, "register_number", None)
            students = [s for s in students if getattr(s, "reg_no", None) == st_reg]

    if config.report_type == "LEADERBOARD":
        students = sorted(
            students,
            key=lambda s: (
                getattr(s, "college_rank", None) if (getattr(s, "college_rank", None) is not None and (getattr(s, "college_rank", 0) or 0) > 0) else 999999,
                -(getattr(s, "total_solved", 0) or 0)
            )
        )

    total_students = len(students)
    verified_students = sum(1 for s in students if s.status == "VERIFIED")
    unverified_students = total_students - verified_students

    if cfg_filters.get("session_id") and str(cfg_filters.get("session_id")).lower() != "latest":
        total_solved = sum((s.total_solved or 0) for s in students if s.status == "VERIFIED")
        easy_solved = sum(1 for s in students if s.status == "VERIFIED" and (s.total_solved or 0) >= 1)
        medium_solved = sum(
            (1 if (s.total_solved or 0) >= 2 else 0) + (1 if (s.total_solved or 0) >= 3 else 0)
            for s in students if s.status == "VERIFIED"
        )
        hard_solved = sum(1 for s in students if s.status == "VERIFIED" and (s.total_solved or 0) >= 4)
    else:
        total_solved = sum((s.total_solved or 0) for s in students if s.status == "VERIFIED")
        easy_solved = sum((s.easy or 0) for s in students if s.status == "VERIFIED")
        medium_solved = sum((s.medium or 0) for s in students if s.status == "VERIFIED")
        hard_solved = sum((s.hard or 0) for s in students if s.status == "VERIFIED")

    active_solvers = sum(1 for s in students if (s.total_solved or 0) > 0)
    average_solved = round(total_solved / max(verified_students, 1), 2)

    ratings = [s.contest_rating for s in students if s.contest_rating is not None]
    average_rating = round(sum(ratings) / max(len(ratings), 1), 1) if ratings else None
    highest_rating = round(max(ratings), 1) if ratings else None
    highest_solved = max([(s.total_solved or 0) for s in students], default=0)

    # Centralized Category Distribution
    distribution = {
        "Above 500": 0,
        "250-500": 0,
        "100-249": 0,
        "50-99": 0,
        "25-49": 0,
        "1-24": 0,
        "0 Solved": 0
    }

    for s in students:
        cat = get_problem_category(s.total_solved)
        if cat in distribution:
            distribution[cat] += 1
        else:
            distribution[cat] = 1

    # Top Solvers
    top_students = [s.model_dump() for s in students if s.status == "VERIFIED"][:10]
    all_students_dict = [s.model_dump() for s in students]

    # Department Breakdown
    dept_breakdown = {}
    for s in students:
        d = s.dept or "CSE"
        if d not in dept_breakdown:
            dept_breakdown[d] = {
                "department": d,
                "total": 0,
                "verified": 0,
                "active_solvers": 0,
                "total_solved": 0,
                "solvers_4": 0
            }
        dept_breakdown[d]["total"] += 1
        if s.status == "VERIFIED" or (s.total_solved or 0) > 0:
            dept_breakdown[d]["verified"] += 1
        t_sol = s.total_solved or 0
        dept_breakdown[d]["total_solved"] += t_sol
        if t_sol > 0:
            dept_breakdown[d]["active_solvers"] += 1
        if t_sol >= 4:
            dept_breakdown[d]["solvers_4"] += 1

    dept_summary_list = []
    for d_code, d_info in sorted(dept_breakdown.items()):
        tot = d_info["total"]
        act = d_info["active_solvers"]
        sol = d_info["total_solved"]
        d_info["avg_solved"] = round(sol / max(act, 1), 2)
        d_info["attendance_pct"] = round((act / max(tot, 1)) * 100, 2)
        dept_summary_list.append(d_info)

    # ── Year-wise Breakdown (per-year aggregation across all filtered students) ──
    YEAR_ORDER = ["I Year", "II Year", "III Year", "IV Year"]
    year_breakdown: Dict[str, Any] = {}
    for s in students:
        yr_roman = to_roman_year(s.year) or "III"
        yr_label = f"{yr_roman} Year" if not yr_roman.endswith("Year") else yr_roman
        yr_key = yr_label
        if yr_key not in year_breakdown:
            year_breakdown[yr_key] = {
                "year": yr_label,
                "total": 0, "verified": 0, "active_solvers": 0,
                "total_solved": 0, "solvers_4": 0, "_sort_key": YEAR_ORDER.index(yr_label) if yr_label in YEAR_ORDER else 99
            }
        year_breakdown[yr_key]["total"] += 1
        if s.status == "VERIFIED" or (s.total_solved or 0) > 0:
            year_breakdown[yr_key]["verified"] += 1
        t_sol = s.total_solved or 0
        year_breakdown[yr_key]["total_solved"] += t_sol
        if t_sol > 0:
            year_breakdown[yr_key]["active_solvers"] += 1
        if t_sol >= 4:
            year_breakdown[yr_key]["solvers_4"] += 1

    year_summary_list = []
    for yr_key, yr_info in sorted(year_breakdown.items(), key=lambda x: x[1]["_sort_key"]):
        tot = yr_info["total"]
        act = yr_info["active_solvers"]
        sol = yr_info["total_solved"]
        yr_info["avg_solved"] = round(sol / max(act, 1), 2)
        yr_info["attendance_pct"] = round((act / max(tot, 1)) * 100, 2)
        yr_info.pop("_sort_key", None)
        year_summary_list.append(yr_info)

    # ── Cutoff Band Breakdown (based on 12th std cutoff marks) ──
    CUTOFF_BANDS = [
        {"label": "190–200",       "min": 190.0, "max": 200.0},
        {"label": "180–189",       "min": 180.0, "max": 189.99},
        {"label": "170–179",       "min": 170.0, "max": 179.99},
        {"label": "160–169",       "min": 160.0, "max": 169.99},
        {"label": "150–159",       "min": 150.0, "max": 159.99},
        {"label": "140–149",       "min": 140.0, "max": 149.99},
        {"label": "130–139",       "min": 130.0, "max": 139.99},
        {"label": "120–129",       "min": 120.0, "max": 129.99},
        {"label": "110–119",       "min": 110.0, "max": 119.99},
        {"label": "100–109",       "min": 100.0, "max": 109.99},
        {"label": "90–99",         "min": 90.0,  "max": 99.99},
        {"label": "80–89",         "min": 80.0,  "max": 89.99},
        {"label": "70–79",         "min": 70.0,  "max": 79.99},
        {"label": "Below 70",      "min": 0.0,   "max": 69.99},
        {"label": "Not Recorded",  "min": None,  "max": None},
    ]
    cutoff_band_breakdown: list = []
    for band in CUTOFF_BANDS:
        band_students = []
        for s in students:
            co = s.twelfth_cutoff
            if band["min"] is None:
                if co is None:
                    band_students.append(s)
            else:
                if co is not None and band["min"] <= co <= band["max"]:
                    band_students.append(s)
        
        b_total = len(band_students)
        b_active = sum(1 for s in band_students if (s.total_solved or 0) > 0)
        b_not_active = b_total - b_active
        b_solved = sum((s.total_solved or 0) for s in band_students)
        b_4sol  = sum(1 for s in band_students if (s.total_solved or 0) >= 4)
        
        cutoff_band_breakdown.append({
            "band": band["label"],
            "total": b_total,
            "active_solvers": b_active,
            "not_active": b_not_active,
            "total_solved": b_solved,
            "solvers_4": b_4sol,
            "avg_solved": round(b_solved / max(b_active, 1), 2) if b_active > 0 else 0,
            "attendance_pct": round((b_active / max(b_total, 1)) * 100, 2) if b_total > 0 else 0,
        })


    # Faculty / Mentor Breakdown
    faculty_breakdown = {}
    for s in students:
        staff_name = getattr(s, "mentor_name", None) or getattr(s, "staff_name", None) or "Unassigned Faculty"
        d = s.dept or "CSE"
        key = (staff_name, d)
        if key not in faculty_breakdown:
            faculty_breakdown[key] = {
                "staff_name": staff_name,
                "department": d,
                "total_assigned": 0,
                "active_solvers": 0,
                "total_solved": 0,
                "solvers_4": 0
            }
        faculty_breakdown[key]["total_assigned"] += 1
        t_sol = s.total_solved or 0
        faculty_breakdown[key]["total_solved"] += t_sol
        if t_sol > 0:
            faculty_breakdown[key]["active_solvers"] += 1
        if t_sol >= 4:
            faculty_breakdown[key]["solvers_4"] += 1

    faculty_summary_list = []
    for (staff_name, d_code), f_info in sorted(faculty_breakdown.items(), key=lambda x: (-x[1]["total_solved"], x[0][0])):
        tot = f_info["total_assigned"]
        sol = f_info["total_solved"]
        f_info["avg_solved"] = round(sol / max(tot, 1), 2)
        f_info["active_pct"] = round((f_info["active_solvers"] / max(tot, 1)) * 100, 2)
        faculty_summary_list.append(f_info)

    # Contest Data if requested
    participations_dict = []
    if config.report_type in ("CONTEST_PERFORMANCE", "OFFICIAL_CONTEST"):
        contests = fetch_normalized_contests(db, dept_filter=config.department, year_filter=config.year)
        participations_dict = [c.model_dump() for c in contests]


    from backend.services.weekly_session_resolver import resolve_weekly_sessions
    resolved_info = resolve_weekly_sessions(db)
    curr_sess = resolved_info.get("current_week_session")
    resolved_cname = curr_sess.contest_name if curr_sess else None
    resolved_cdate = curr_sess.session_date if curr_sess else None

    metrics_dict = {
        "totalStudents": total_students,
        "verifiedStudents": verified_students,
        "unverifiedStudents": unverified_students,
        "activeSolvers": active_solvers,
        "totalSolved": total_solved,
        "averageSolved": average_solved,
        "easySolved": easy_solved,
        "mediumSolved": medium_solved,
        "hardSolved": hard_solved,
        "highestSolved": highest_solved,
        "averageRating": average_rating,
        "highestRating": highest_rating
    }

    if config.report_type in ("CONTEST_PERFORMANCE", "OFFICIAL_CONTEST"):
        metrics_dict["totalParticipations"] = len(participations_dict)
        metrics_dict["contestName"] = resolved_cname
        metrics_dict["sessionDate"] = resolved_cdate

    dataset = {
        "reportId": report_id,
        "reportType": config.report_type,
        "title": title,
        "contestName": resolved_cname,
        "sessionDate": resolved_cdate,
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "verifiedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "dataStatus": "READY" if total_students > 0 else "PARTIAL",
        "message": None,
        "config": config.model_dump(),
        "metrics": metrics_dict,
        "distribution": distribution,
        "departmentSummary": dept_summary_list,
        "yearSummary": year_summary_list,
        "cutoffBandSummary": cutoff_band_breakdown,
        "facultySummary": faculty_summary_list,
        "dataQuality": data_quality.model_dump(),
        "topStudents": top_students,
        "allStudents": all_students_dict,
        "rows": all_students_dict,
        "participations": participations_dict
    }

    # Persist in DB ReportHistory for auditability (safely catch and proceed)
    try:
        history_entry = ReportHistory(
            report_id=report_id,
            report_type=config.report_type,
            title=title,
            filters=config.model_dump(),
            dataset=dataset,
            status="GENERATED"
        )
        db.add(history_entry)
        db.commit()
    except Exception as ex:
        db.rollback()
        logger.warning(f"[REPORT_HISTORY_NOTE] {ex}")

    with _UNIVERSAL_CACHE_LOCK:
        _UNIVERSAL_DATASET_CACHE[cache_key] = copy.deepcopy(dataset)

    return dataset

# Maintain backwards compatibility aliases
def build_college_overview(db: Session, filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    config = ReportConfig(report_type="COLLEGE_EXECUTIVE", department="ALL", year="ALL")
    return build_universal_report(db, config)

def build_department_report(db: Session, dept_name: str, year: Optional[str] = None, section: Optional[str] = None) -> Dict[str, Any]:
    config = ReportConfig(report_type="DEPARTMENT_PERFORMANCE", department=dept_name or "ALL", year=year or "ALL")
    return build_universal_report(db, config)

def build_all_students_report(db: Session) -> Dict[str, Any]:
    config = ReportConfig(report_type="STUDENT_MASTER", department="ALL", year="ALL")
    return build_universal_report(db, config)

def build_official_contest_report(db: Session) -> Dict[str, Any]:
    config = ReportConfig(report_type="CONTEST_PERFORMANCE", department="ALL", year="ALL")
    return build_universal_report(db, config)
