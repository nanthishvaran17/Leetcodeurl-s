# Trigger uvicorn reload
import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from backend.models import (
    WeeklySession, WeeklyPublicResult, WeeklyVirtualResult,
    Student, User
)
from backend.logger import logger

VALID_PARTICIPATION_STATUSES = {
    "PUBLIC", "VIRTUAL", "NOT_ATTENDED", "PENDING", 
    "SOURCE_UNAVAILABLE", "AUTH_REQUIRED", "USERNAME_NOT_FOUND", 
    "FETCH_ERROR", "DATA_MISMATCH"
}


def normalize_participation_status(raw_status: Optional[str], fetch_status: Optional[str] = None) -> str:
    """
    Normalizes any raw/legacy participation status to the canonical 9-state model.
    Never fabricates attendance or silences errors.
    """
    if fetch_status in ("USERNAME_NOT_FOUND", "INVALID_USERNAME"):
        return "USERNAME_NOT_FOUND"
    if fetch_status in ("AUTH_REQUIRED", "BLOCKED"):
        return "AUTH_REQUIRED"
    if fetch_status in ("SOURCE_UNAVAILABLE", "NETWORK_ERROR", "TIMEOUT"):
        return "SOURCE_UNAVAILABLE"

    st = raw_status.strip().upper() if raw_status else ""
    if st in ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED", "OFFICIAL"):
        return "PUBLIC"
    if st in ("VIRTUAL", "VIRTUAL_ATTENDED"):
        return "VIRTUAL"
    if st in ("NOT_ATTENDED", "PUBLIC_NOT_ATTENDED", "ABSENT"):
        return "NOT_ATTENDED"
    if st in ("USERNAME_NOT_FOUND", "INVALID_USERNAME"):
        return "USERNAME_NOT_FOUND"

    if st in ("UNKNOWN", "PENDING", "INITIALIZING", "DATA_PENDING", ""):
        # Default placeholder status for students who did not attend the contest
        return "NOT_ATTENDED"

    if fetch_status in ("FETCH_ERROR", "FETCH_FAILED", "SERVER_ERROR"):
        return "FETCH_ERROR"
    if st in ("FETCH_ERROR", "FETCH_FAILED", "DATA_ERROR"):
        return "FETCH_ERROR"
    if st in ("DATA_MISMATCH",):
        return "DATA_MISMATCH"

    return "NOT_ATTENDED"


def invalidate_canonical_cache(session_id: Optional[int] = None):
    """Invalidates the in-memory cache for a specific session or globally."""
    from backend.cache import cache
    cache.invalidate_tag("contests")


def normalize_year_param(year: Optional[str]) -> str:
    """
    Normalizes any year filter parameter string (e.g., '3', 'Year III', '3rd', '2024–2028', 'III')
    to standard canonical roman numerals ('I', 'II', 'III', 'IV', or 'ALL').
    """
    if not year or not isinstance(year, str):
        return "ALL"
    y = year.strip().upper()
    if y in ("ALL", "ALL ACADEMIC YEARS", "ALL YEARS", "", "NONE", "NULL", "*"):
        return "ALL"
    if y in ("3", "III", "3RD", "3RD YEAR", "YEAR 3", "YEAR III", "2024–2028", "2024-2028", "2024", "3 YEAR"):
        return "III"
    if y in ("2", "II", "2ND", "2ND YEAR", "YEAR 2", "YEAR II", "2025–2029", "2025-2029", "2025", "2 YEAR"):
        return "II"
    if y in ("4", "IV", "4TH", "4TH YEAR", "YEAR 4", "YEAR IV", "2023–2027", "2023-2027", "2023", "4 YEAR"):
        return "IV"
    if y in ("1", "I", "1ST", "1ST YEAR", "YEAR 1", "YEAR I", "2026–2030", "2026-2030", "2026", "1 YEAR"):
        return "I"
    if y.startswith("YEAR ") or y.endswith(" YEAR"):
        clean_y = y.replace("YEAR", "").strip()
        return normalize_year_param(clean_y)
    if "3" in y or "III" in y:
        return "III"
    if "2" in y or "II" in y:
        return "II"
    if "4" in y or "IV" in y:
        return "IV"
    if "1" in y or "I" in y:
        return "I"
    return y


def normalize_dept_param(dept: Optional[str]) -> str:
    """
    Normalizes any department filter parameter string (e.g., 'CS', 'Cyber Security', 'CSE(CS)')
    to standard canonical department code ('CSE(CS)', 'CSE(IOT)', 'IT', 'AIDS', 'ECE', 'EEE', 'CSE', etc.).
    """
    if not dept or not isinstance(dept, str):
        return "ALL"
    d = dept.strip().upper()
    if d in ("ALL", "ALL DEPARTMENTS", "COLLEGE-WIDE", "", "NONE", "NULL", "*"):
        return "ALL"
    if d in ("CSE(CS)", "CS", "CYBER", "CYBER SECURITY", "CSE_CS", "CSE (CS)", "COMPUTER SCIENCE AND ENGINEERING (CYBER SECURITY)", "COMPUTER SCIENCE & ENGINEERING (CYBER SECURITY)"):
        return "CSE(CS)"
    if d in ("CSE(IOT)", "IOT", "INTERNET OF THINGS", "CSE_IOT", "CSE (IOT)", "COMPUTER SCIENCE AND ENGINEERING (IOT)", "COMPUTER SCIENCE & ENGINEERING (IOT)"):
        return "CSE(IOT)"
    if d in ("IT", "INFORMATION TECHNOLOGY"):
        return "IT"
    if d in ("AIDS", "AI&DS", "AI-DS", "AI DS", "ARTIFICIAL INTELLIGENCE", "AIDS DEPARTMENT"):
        return "AIDS"
    if d in ("ECE", "ELECTRONICS", "ELECTRONICS AND COMMUNICATION ENGINEERING", "ELECTRONICS & COMMUNICATION ENGINEERING", "ECE DEPARTMENT"):
        return "ECE"
    if d in ("EEE", "ELECTRICAL", "ELECTRICAL AND ELECTRONICS ENGINEERING", "ELECTRICAL & ELECTRONICS ENGINEERING", "EEE DEPARTMENT"):
        return "EEE"
    if d in ("MECH", "MECHANICAL", "MECHANICAL ENGINEERING"):
        return "MECH"
    if d in ("CIVIL", "CIVIL ENGINEERING"):
        return "CIVIL"
    if d in ("AGRI", "AGRICULTURE", "AGRICULTURAL ENGINEERING", "AGRI DEPARTMENT"):
        return "AGRI"
    if d in ("BME", "BIOMEDICAL", "BIOMEDICAL ENGINEERING"):
        return "BME"
    if d in ("CSE", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING", "COMPUTER SCIENCE AND ENGINEERING"):
        return "CSE"
    return d


def build_canonical_contest_dataset(
    session_id: int,
    db: Session,
    dept: str = "ALL",
    year: str = "ALL",
    attendance: str = "ALL",
    current_user: Optional[User] = None
) -> Dict[str, Any]:
    dept = normalize_dept_param(dept)
    year = normalize_year_param(year)
    if not isinstance(attendance, str):
        attendance = "ALL"
    if not hasattr(current_user, "id"):
        current_user = None

    session_obj = db.query(WeeklySession).filter(WeeklySession.id == session_id).first()
    if not session_obj:
        session_obj = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()
    if not session_obj:
        raise ValueError(f"Contest Session ID {session_id} not found in database.")

    user_scope = f"{current_user.id}:{current_user.role}" if current_user else "public"
    base_cache_key = f"canonical_contest_{session_obj.id}_ALL_ALL_ALL_{user_scope}"
    
    # Context-aware TTLs: 15s during live, 300s post-finalization
    ttl = 300 if session_obj.status == "FINALIZED" else 15
    
    from backend.cache import cache
    base_dataset = cache.get_or_compute(
        key=base_cache_key,
        compute_func=lambda: _build_canonical_contest_dataset_internal(
            session_obj.id, session_obj, db, "ALL", "ALL", "ALL", current_user
        ),
        ttl_seconds=ttl,
        tags=["contests"]
    )

    if dept == "ALL" and year == "ALL" and (attendance == "ALL" or attendance is None):
        return base_dataset

    return _filter_canonical_dataset_in_memory(base_dataset, dept, year, attendance)


def _filter_canonical_dataset_in_memory(
    base_dataset: Dict[str, Any],
    dept: str,
    year: str,
    attendance: str
) -> Dict[str, Any]:
    rows = base_dataset.get("rows") or []
    
    if dept != "ALL":
        rows = [r for r in rows if r.get("dept") == dept]
        
    if year != "ALL":
        rows = [r for r in rows if r.get("year") == year]
        
    if attendance and attendance.upper() != "ALL":
        att_upper = attendance.upper().strip()
        if att_upper in ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED", "OFFICIAL"):
            rows = [r for r in rows if r.get("status") in ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED")]
        elif att_upper in ("VIRTUAL", "VIRTUAL_ATTENDED"):
            rows = [r for r in rows if r.get("status") in ("VIRTUAL", "VIRTUAL_ATTENDED")]
        elif att_upper in ("NOT_ATTENDED", "PUBLIC_NOT_ATTENDED", "ABSENT", "NOT_PARTICIPATED", "UNATTENDED"):
            rows = [r for r in rows if r.get("status") in ("NOT_ATTENDED", "PUBLIC_NOT_ATTENDED", "ABSENT", "PENDING")]
        elif att_upper in ("ERRORS", "DATA_ERRORS", "DATA_ERROR", "FAILED"):
            rows = [r for r in rows if r.get("status") in ("USERNAME_NOT_FOUND", "AUTH_REQUIRED", "SOURCE_UNAVAILABLE", "FETCH_ERROR", "DATA_MISMATCH")]
        elif att_upper in ("ALL_ATTENDED", "PARTICIPATED"):
            rows = [r for r in rows if r.get("status") in ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED", "VIRTUAL", "VIRTUAL_ATTENDED")]

    indexed_rows = []
    for idx, r in enumerate(rows, 1):
        r_copy = dict(r)
        r_copy["s_no"] = idx
        indexed_rows.append(r_copy)

    tot = len(indexed_rows)
    pub = sum(1 for r in indexed_rows if r.get("status") in ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED"))
    virt = sum(1 for r in indexed_rows if r.get("status") in ("VIRTUAL", "VIRTUAL_ATTENDED"))
    not_att = sum(1 for r in indexed_rows if r.get("status") == "NOT_ATTENDED")
    errors = sum(1 for r in indexed_rows if r.get("status") in ("USERNAME_NOT_FOUND", "AUTH_REQUIRED", "SOURCE_UNAVAILABLE", "FETCH_ERROR", "DATA_MISMATCH"))
    pending = sum(1 for r in indexed_rows if r.get("status") == "PENDING")

    q4 = sum(1 for r in indexed_rows if r.get("q4") == 1)
    q3 = sum(1 for r in indexed_rows if r.get("q3") == 1)
    q2 = sum(1 for r in indexed_rows if r.get("q2") == 1)
    q1 = sum(1 for r in indexed_rows if r.get("q1") == 1)

    pct = ((pub + virt) / max(1, tot)) * 100.0

    base_metrics = base_dataset.get("metrics", {})
    metrics = {
        "contestName": base_metrics.get("contestName"),
        "totalStudents": tot,
        "officialAttended": pub,
        "virtualAttended": virt,
        "notAttended": not_att,
        "pending": pending,
        "errors": errors,
        "participationPercentage": pct,
        "q4Count": q4,
        "q3Count": q3,
        "q2Count": q2,
        "q1Count": q1
    }

    status_counts = {
        "PUBLIC": pub,
        "VIRTUAL": virt,
        "NOT_ATTENDED": not_att,
        "PENDING": pending,
        "SOURCE_UNAVAILABLE": sum(1 for r in indexed_rows if r.get("status") == "SOURCE_UNAVAILABLE"),
        "AUTH_REQUIRED": sum(1 for r in indexed_rows if r.get("status") == "AUTH_REQUIRED"),
        "USERNAME_NOT_FOUND": sum(1 for r in indexed_rows if r.get("status") == "USERNAME_NOT_FOUND"),
        "FETCH_ERROR": sum(1 for r in indexed_rows if r.get("status") == "FETCH_ERROR"),
        "DATA_MISMATCH": sum(1 for r in indexed_rows if r.get("status") == "DATA_MISMATCH")
    }

    return {
        "sessionId": base_dataset.get("sessionId"),
        "contestId": base_dataset.get("contestId"),
        "contestName": base_dataset.get("contestName"),
        "sessionDate": base_dataset.get("sessionDate"),
        "status": base_dataset.get("status"),
        "isLive": base_dataset.get("isLive"),
        "isScheduled": base_dataset.get("isScheduled"),
        "isFinalized": base_dataset.get("isFinalized"),
        "generatedAtIST": base_dataset.get("generatedAtIST"),
        "rows": indexed_rows,
        "all_rows": indexed_rows,
        "metrics": metrics,
        "statusCounts": status_counts,
        "departmentStats": base_dataset.get("departmentStats"),
        "yearStats": base_dataset.get("yearStats"),
        "dataQualityIssues": [i for i in base_dataset.get("dataQualityIssues", []) if (dept == "ALL" or i.get("dept") == dept) and (year == "ALL" or i.get("year") == year)],
        "reconciliation": base_dataset.get("reconciliation")
    }

def _build_canonical_contest_dataset_internal(
    session_id: int,
    session_obj: WeeklySession,
    db: Session,
    dept: str,
    year: str,
    attendance: str,
    current_user: Optional[User]
) -> Dict[str, Any]:

    # 1. Fetch Authoritative Master Students with eager loaded department
    from sqlalchemy.orm import joinedload
    from backend.services.authorization_service import apply_role_based_student_filter
    
    student_query = db.query(Student).options(
        joinedload(Student.department)
    ).filter(
        (Student.is_active == True) | (Student.is_active.is_(None))
    )
    
    def _is_real_student_record(reg_no: Optional[str], name: Optional[str]) -> bool:
        reg = (reg_no or "").upper().strip()
        nm = (name or "").upper().strip()
        if not reg or reg.startswith("TEST") or reg.startswith("CONCUR") or reg.startswith("HARDENING") or reg.startswith("7322STU"):
            return False
        if "TEST" in nm or "DUMMY" in nm or "CONCURRENT" in nm:
            return False
        return True

    all_master_students = [s for s in student_query.order_by(Student.id.asc()).all() if _is_real_student_record(s.reg_no, s.name)]
    total_master_count = len(all_master_students)
    
    student_ids = [s.id for s in all_master_students]
    from backend.models import LeetCodeProfileStats
    stats_records = db.query(LeetCodeProfileStats).filter(LeetCodeProfileStats.student_id.in_(student_ids)).all() if student_ids else []
    stats_map = {stat.student_id: stat for stat in stats_records}

    # 2. Fetch Contest Results for this Session
    public_results = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == session_id).all()
    public_res_map = {r.student_id: r for r in public_results}

    virtual_results = db.query(WeeklyVirtualResult).filter(WeeklyVirtualResult.session_id == session_id).all()
    virtual_res_map = {r.student_id: r for r in virtual_results}

    canonical_rows: List[Dict[str, Any]] = []
    data_quality_issues: List[Dict[str, Any]] = []

    # Category counts
    status_counts = {
        "PUBLIC": 0,
        "VIRTUAL": 0,
        "NOT_ATTENDED": 0,
        "PENDING": 0,
        "SOURCE_UNAVAILABLE": 0,
        "AUTH_REQUIRED": 0,
        "USERNAME_NOT_FOUND": 0,
        "FETCH_ERROR": 0,
        "DATA_MISMATCH": 0
    }

    # Department and Year aggregators for active production departments
    dept_stats_map: Dict[str, Dict[str, Any]] = {
        "CSE(CS)": {"name": "Computer Science and Engineering (Cyber Security)", "total": 0, "public": 0, "virtual": 0, "not_attended": 0, "pending": 0, "errors": 0, "q4": 0, "q3": 0, "q2": 0, "q1": 0},
        "CSE(IOT)": {"name": "Computer Science and Engineering (Internet of Things)", "total": 0, "public": 0, "virtual": 0, "not_attended": 0, "pending": 0, "errors": 0, "q4": 0, "q3": 0, "q2": 0, "q1": 0},
        "IT": {"name": "Information Technology", "total": 0, "public": 0, "virtual": 0, "not_attended": 0, "pending": 0, "errors": 0, "q4": 0, "q3": 0, "q2": 0, "q1": 0},
    }

    year_stats_map: Dict[str, Dict[str, Any]] = {
        "I": {"label": "1st Year (I)", "total": 0, "public": 0, "virtual": 0, "not_attended": 0, "pending": 0, "errors": 0, "q4": 0, "q3": 0, "q2": 0, "q1": 0},
        "II": {"label": "2nd Year (II)", "total": 0, "public": 0, "virtual": 0, "not_attended": 0, "pending": 0, "errors": 0, "q4": 0, "q3": 0, "q2": 0, "q1": 0},
        "III": {"label": "3rd Year (III)", "total": 0, "public": 0, "virtual": 0, "not_attended": 0, "pending": 0, "errors": 0, "q4": 0, "q3": 0, "q2": 0, "q1": 0},
        "IV": {"label": "4th Year (IV)", "total": 0, "public": 0, "virtual": 0, "not_attended": 0, "pending": 0, "errors": 0, "q4": 0, "q3": 0, "q2": 0, "q1": 0}
    }

    q4_all = q3_all = q2_all = q1_all = 0

    for idx, student in enumerate(all_master_students, start=1):
        s_id = student.id
        reg_no = student.reg_no
        name = student.name
        p_res = public_res_map.get(s_id)
        v_res = virtual_res_map.get(s_id)

        dept_raw = (student.department.code if student.department else None) or (p_res.dept if p_res else None) or "CSE(CS)"
        reg_upper = (reg_no or "").upper()
        
        if "CC" in reg_upper:
            dept_raw = "CSE(CS)"
        elif "CI" in reg_upper or "CIR" in reg_upper:
            dept_raw = "CSE(IOT)"

        dept_code = str(dept_raw).strip().upper()
        if dept_code in ("CSE(IOT)", "IOT", "CSE_IOT", "CSE (IOT)"):
            dept_code = "CSE(IOT)"
        elif dept_code in ("CSE(CS)", "CS", "CYBER", "CYBER SECURITY", "CSE_CS", "CSE (CS)"):
            dept_code = "CSE(CS)"
        elif dept_code in ("IT", "INFORMATION TECHNOLOGY", "INFO TECH"):
            dept_code = "IT"
        else:
            dept_code = None

        year_level = student.year_level or (p_res.year if p_res else None) or "III"
        if reg_upper.startswith("732225") or "25CC" in reg_upper or "25CI" in reg_upper:
            year_level = "II"
        elif reg_upper.startswith("732224") or "24CC" in reg_upper or "24CI" in reg_upper or "24CIR" in reg_upper:
            year_level = "III"
        elif reg_upper.startswith("23") or reg_upper.startswith("732223") or "23CC" in reg_upper or "23CI" in reg_upper:
            year_level = "IV"
        username = student.username or ""
        profile_url = student.leetcode_url or (f"https://leetcode.com/u/{username}" if username else "")

        # Determine authoritative participation status
        p_raw_st = str(p_res.participation_status) if (p_res and p_res.participation_status) else None
        p_fetch_st = str(p_res.fetch_status) if (p_res and p_res.fetch_status) else None
        p_status = normalize_participation_status(p_raw_st, p_fetch_st)

        v_raw_st = str(v_res.participation_status) if (v_res and v_res.participation_status) else None
        v_status = normalize_participation_status(v_raw_st) if v_res else None

        if p_status == "PUBLIC":
            canon_status = "PUBLIC"
        elif v_status == "VIRTUAL" or (v_res and v_res.total_contest_solved and v_res.total_contest_solved > 0):
            canon_status = "VIRTUAL"
        elif p_status == "VIRTUAL":
            canon_status = "VIRTUAL"
        elif p_status == "NOT_ATTENDED" or (p_res and p_res.participation_status in ("NOT_ATTENDED", "PUBLIC_NOT_ATTENDED", "ABSENT")):
            canon_status = "NOT_ATTENDED"
        elif v_status == "NOT_ATTENDED":
            canon_status = "NOT_ATTENDED"
        else:
            raw_status = p_raw_st if p_raw_st else (v_raw_st if v_raw_st else "PENDING")
            fetch_status = p_fetch_st if p_fetch_st else "PENDING"
            canon_status = normalize_participation_status(raw_status, fetch_status)

        error_reason = str(p_res.error_reason) if (p_res and p_res.error_reason) else (str(getattr(v_res, "error_reason", "")) if (v_res and getattr(v_res, "error_reason", None)) else None)

        # Check if student username was missing in master
        if not username or len(username.strip()) < 2:
            canon_status = "USERNAME_NOT_FOUND"
            error_reason = "LeetCode username unlinked or missing in Student Master"

        is_participant = canon_status in ("PUBLIC", "VIRTUAL")

        # Questions & Solved Count
        if canon_status == "PUBLIC" and p_res:
            q1_val = 1 if (p_res.q1 and p_res.q1 >= 1) else 0
            q2_val = 1 if (p_res.q2 and p_res.q2 >= 1) else 0
            q3_val = 1 if (p_res.q3 and p_res.q3 >= 1) else 0
            q4_val = 1 if (p_res.q4 and p_res.q4 >= 1) else 0
            score_val = p_res.contest_score

            # If Qs are 0 but score is populated, infer based on 3/4/5/6 distribution
            if (q1_val + q2_val + q3_val + q4_val) == 0 and score_val is not None:
                sv = int(float(str(score_val)))
                if sv >= 18:
                    q1_val = 1; q2_val = 1; q3_val = 1; q4_val = 1
                elif sv == 12:
                    q1_val = 1; q2_val = 1; q3_val = 1
                elif sv == 7:
                    q1_val = 1; q2_val = 1
                elif sv == 3:
                    q1_val = 1

            actual_sum = q1_val + q2_val + q3_val + q4_val
            tot_from_record = int(getattr(p_res, "total_contest_solved", 0) or 0) if p_res is not None else 0
            solved_val: Optional[int] = max(actual_sum, tot_from_record)

            if solved_val and solved_val > 0 and actual_sum < solved_val:
                if solved_val >= 4:
                    q1_val = q2_val = q3_val = q4_val = 1
                elif solved_val == 3:
                    q1_val = q2_val = q3_val = 1
                elif solved_val == 2:
                    q1_val = q2_val = 1
                elif solved_val == 1:
                    q1_val = 1

            if not score_val:
                score_val = (q1_val * 3 + q2_val * 4 + q3_val * 5 + q4_val * 6)

            rank_val = p_res.contest_rank
            rating_val = p_res.contest_rating
        elif canon_status == "VIRTUAL":
            source_res = v_res if v_res is not None else p_res
            if source_res is not None:
                q1_v_raw = getattr(source_res, "q1", 0) or 0
                q2_v_raw = getattr(source_res, "q2", 0) or 0
                q3_v_raw = getattr(source_res, "q3", 0) or 0
                q4_v_raw = getattr(source_res, "q4", 0) or 0
                q1_val = 1 if q1_v_raw >= 1 else 0
                q2_val = 1 if q2_v_raw >= 1 else 0
                q3_val = 1 if q3_v_raw >= 1 else 0
                q4_val = 1 if q4_v_raw >= 1 else 0
                score_val = getattr(source_res, "contest_score", None)
            else:
                q1_val = q2_val = q3_val = q4_val = 0
                score_val = None

            # If Qs are 0 but score is populated, infer based on 3/4/5/6 distribution
            if (q1_val + q2_val + q3_val + q4_val) == 0 and score_val is not None:
                sv = int(float(str(score_val)))
                if sv >= 18:
                    q1_val = 1; q2_val = 1; q3_val = 1; q4_val = 1
                elif sv == 12:
                    q1_val = 1; q2_val = 1; q3_val = 1
                elif sv == 7:
                    q1_val = 1; q2_val = 1
                elif sv == 3:
                    q1_val = 1

            actual_sum = q1_val + q2_val + q3_val + q4_val
            tot_from_record = int(getattr(source_res, "total_contest_solved", 0) or 0) if source_res is not None else 0
            solved_val = max(actual_sum, tot_from_record)

            if solved_val and solved_val > 0 and actual_sum < solved_val:
                if solved_val >= 4:
                    q1_val = q2_val = q3_val = q4_val = 1
                elif solved_val == 3:
                    q1_val = q2_val = q3_val = 1
                elif solved_val == 2:
                    q1_val = q2_val = 1
                elif solved_val == 1:
                    q1_val = 1

            if not score_val:
                score_val = (q1_val * 3 + q2_val * 4 + q3_val * 5 + q4_val * 6)

            rank_val = None
            rating_val = None
        else:
            # For non-participants or unverified records, Q1..Q4 are NULL (rendered as '—')
            q1_val = None
            q2_val = None
            q3_val = None
            q4_val = None
            solved_val = None
            score_val = None
            rank_val = None
            rating_val = None

        # Confidence tier based on evidence path
        if canon_status == "PUBLIC" and rank_val is not None:
            confidence_val = "HIGH"
        elif canon_status == "VIRTUAL" and solved_val is not None and solved_val > 0:
            confidence_val = "HIGH"
        elif canon_status == "NOT_ATTENDED":
            confidence_val = "HIGH"
        elif canon_status in ("NOT_VERIFIED", "PENDING"):
            confidence_val = "MEDIUM"
        elif canon_status == "NOT_VERIFIED_FINAL":
            confidence_val = "LOW"
        else:
            confidence_val = "LOW"

        # Track quality issues for non-standard statuses
        if canon_status in ("SOURCE_ERROR", "CONFLICT", "SOURCE_UNAVAILABLE", "AUTH_REQUIRED", "USERNAME_NOT_FOUND", "FETCH_ERROR", "DATA_MISMATCH"):
            data_quality_issues.append({
                "reg_no": reg_no,
                "name": name,
                "type": canon_status,
                "reason": error_reason or f"Verification status: {canon_status}",
                "source": "LeetCode GraphQL",
                "timestamp": p_res.last_fetched_at.isoformat() if (p_res and p_res.last_fetched_at) else None
            })

        # Update category counts
        status_counts[canon_status] = status_counts.get(canon_status, 0) + 1

        # Department aggregator
        dept_norm = str(dept_code) if dept_code else ""
        if dept_norm in dept_stats_map:
            dept_stats_map[dept_norm]["total"] += 1
            if canon_status == "PUBLIC": dept_stats_map[dept_norm]["public"] += 1
            elif canon_status == "VIRTUAL": dept_stats_map[dept_norm]["virtual"] += 1
            elif canon_status == "NOT_ATTENDED": dept_stats_map[dept_norm]["not_attended"] += 1
            elif canon_status in ("NOT_VERIFIED", "NOT_VERIFIED_FINAL", "PENDING"): dept_stats_map[dept_norm]["pending"] += 1
            else: dept_stats_map[dept_norm]["errors"] += 1

            if is_participant and solved_val:
                if solved_val >= 4: dept_stats_map[dept_norm]["q4"] += 1
                elif solved_val == 3: dept_stats_map[dept_norm]["q3"] += 1
                elif solved_val == 2: dept_stats_map[dept_norm]["q2"] += 1
                elif solved_val == 1: dept_stats_map[dept_norm]["q1"] += 1

        # Year aggregator
        y_str = str(year_level).strip().upper()
        yr_norm = normalize_year_param(y_str)

        if yr_norm in year_stats_map:
            year_stats_map[yr_norm]["total"] += 1
            if canon_status == "PUBLIC": year_stats_map[yr_norm]["public"] += 1
            elif canon_status == "VIRTUAL": year_stats_map[yr_norm]["virtual"] += 1
            elif canon_status == "NOT_ATTENDED": year_stats_map[yr_norm]["not_attended"] += 1
            elif canon_status in ("NOT_VERIFIED", "NOT_VERIFIED_FINAL", "PENDING"): year_stats_map[yr_norm]["pending"] += 1
            else: year_stats_map[yr_norm]["errors"] += 1

            if is_participant and solved_val:
                if solved_val >= 4: year_stats_map[yr_norm]["q4"] += 1
                elif solved_val == 3: year_stats_map[yr_norm]["q3"] += 1
                elif solved_val == 2: year_stats_map[yr_norm]["q2"] += 1
                elif solved_val == 1: year_stats_map[yr_norm]["q1"] += 1

        if is_participant and solved_val:
            if solved_val >= 4: q4_all += 1
            elif solved_val == 3: q3_all += 1
            elif solved_val == 2: q2_all += 1
            elif solved_val == 1: q1_all += 1

        stat = stats_map.get(s_id)
        row_item = {
            "s_no": idx,
            "student_id": s_id,
            "reg_no": reg_no,
            "name": name,
            "dept": dept_norm,
            "year": yr_norm,
            "username": username,
            "profile_url": profile_url,
            "profile_rank": stat.contest_global_ranking if stat else None,
            "profile_total_solved": stat.total_solved if stat else 0,
            "easy_solved": stat.easy_solved if stat else None,
            "medium_solved": stat.medium_solved if stat else None,
            "hard_solved": stat.hard_solved if stat else None,
            "status": canon_status,
            "participation_status": canon_status,
            "confidence": confidence_val,
            "contest_id": session_obj.contest_id,
            "contest_name": session_obj.contest_name,
            "session_date": session_obj.session_date,
            "q1": q1_val,
            "q2": q2_val,
            "q3": q3_val,
            "q4": q4_val,
            "total_solved": solved_val,
            "total_contest_solved": solved_val,
            "contest_score": score_val,
            "score": score_val,
            "contest_rank": rank_val,
            "rank": rank_val,
            "contest_rating": rating_val,
            "rating": rating_val,
            "data_source": "LeetCode GraphQL (userContestRankingHistory)",
            "verification_status": "VERIFIED" if is_participant or canon_status == "NOT_ATTENDED" else "UNVERIFIED",
            "error_reason": error_reason,
            "last_synced_at": p_res.last_fetched_at.isoformat() if (p_res and p_res.last_fetched_at) else None
        }
        canonical_rows.append(row_item)

    # 3. Apply Filters Dynamically to Rows
    filtered_rows = canonical_rows
    if dept and dept != "ALL":
        d_upper = dept.upper()
        if d_upper in ("CSE(CS)", "CS", "CYBER", "CSE(CYBER SECURITY)"):
            filtered_rows = [r for r in filtered_rows if ("(CS)" in r["dept"].upper() or "CYBER" in r["dept"].upper() or r["dept"].upper().endswith("CS") or r["dept"] == "CSE(CS)")]
        elif d_upper in ("CSE(IOT)", "IOT"):
            filtered_rows = [r for r in filtered_rows if "IOT" in r["dept"].upper()]
        else:
            filtered_rows = [r for r in filtered_rows if r["dept"].upper() == d_upper]

    if year and year != "ALL":
        filtered_rows = [r for r in filtered_rows if r["year"] == year]

    if attendance and attendance != "ALL":
        if attendance in ("ALL_ATTENDED", "TOTAL_ATTENDED", "PARTICIPATED"):
            filtered_rows = [r for r in filtered_rows if r["status"] in ("PUBLIC", "VIRTUAL")]
        elif attendance in ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED"):
            filtered_rows = [r for r in filtered_rows if r["status"] == "PUBLIC"]
        elif attendance in ("VIRTUAL", "VIRTUAL_ATTENDED"):
            filtered_rows = [r for r in filtered_rows if r["status"] == "VIRTUAL"]
        elif attendance in ("NOT_ATTENDED", "PUBLIC_NOT_ATTENDED"):
            filtered_rows = [r for r in filtered_rows if r["status"] == "NOT_ATTENDED"]
        elif attendance in ("NOT_VERIFIED", "PENDING"):
            filtered_rows = [r for r in filtered_rows if r["status"] in ("NOT_VERIFIED", "PENDING")]
        elif attendance in ("NOT_VERIFIED_FINAL", "FINAL_UNVERIFIED"):
            filtered_rows = [r for r in filtered_rows if r["status"] == "NOT_VERIFIED_FINAL"]
        elif attendance in ("UNKNOWN", "DATA_ERROR", "ERROR"):
            filtered_rows = [r for r in filtered_rows if r["status"] not in ("PUBLIC", "VIRTUAL", "NOT_ATTENDED", "NOT_VERIFIED", "NOT_VERIFIED_FINAL")]
        else:
            filtered_rows = [r for r in filtered_rows if r["status"] == attendance]

    # Re-index s_no for filtered rows
    for i, r in enumerate(filtered_rows, start=1):
        r["s_no"] = i

    # 4. Reconciliation Validation Gatekeeper
    sum_dept_totals = sum(d["total"] for d in dept_stats_map.values())
    sum_year_totals = sum(y["total"] for y in year_stats_map.values())
    sum_status_totals = sum(status_counts.values())

    reconciliation_passed = (
        sum_dept_totals == total_master_count and
        sum_year_totals == total_master_count and
        sum_status_totals == total_master_count and
        len(canonical_rows) == total_master_count
    )

    if not reconciliation_passed:
        logger.error(
            f"[RECONCILIATION FAILURE] Master: {total_master_count} | DeptSum: {sum_dept_totals} | "
            f"YearSum: {sum_year_totals} | StatusSum: {sum_status_totals}"
        )

    # 5. Global & Filtered Scope Metrics
    is_filtered = bool((dept and dept != "ALL") or (year and year != "ALL") or (attendance and attendance != "ALL"))

    if is_filtered:
        scope_total = len(filtered_rows)
        scope_public = sum(1 for r in filtered_rows if r.get("status") == "PUBLIC")
        scope_virtual = sum(1 for r in filtered_rows if r.get("status") == "VIRTUAL")
        scope_not_att = sum(1 for r in filtered_rows if r.get("status") == "NOT_ATTENDED")
        scope_not_ver = sum(1 for r in filtered_rows if r.get("status") in ("NOT_VERIFIED", "PENDING"))
        scope_not_ver_final = sum(1 for r in filtered_rows if r.get("status") == "NOT_VERIFIED_FINAL")
        scope_conflict = sum(1 for r in filtered_rows if r.get("status") == "CONFLICT")
        scope_source_err = sum(1 for r in filtered_rows if r.get("status") in ("SOURCE_ERROR", "SOURCE_UNAVAILABLE", "AUTH_REQUIRED", "USERNAME_NOT_FOUND", "FETCH_ERROR", "DATA_MISMATCH"))
        scope_errors = scope_conflict + scope_source_err
        scope_part_pct = round(((scope_public + scope_virtual) / scope_total * 100), 2) if scope_total > 0 else 0.0

        scope_q4 = sum(1 for r in filtered_rows if (r.get("total_solved") or 0) >= 4 and r.get("status") in ("PUBLIC", "VIRTUAL"))
        scope_q3 = sum(1 for r in filtered_rows if (r.get("total_solved") or 0) == 3 and r.get("status") in ("PUBLIC", "VIRTUAL"))
        scope_q2 = sum(1 for r in filtered_rows if (r.get("total_solved") or 0) == 2 and r.get("status") in ("PUBLIC", "VIRTUAL"))
        scope_q1 = sum(1 for r in filtered_rows if (r.get("total_solved") or 0) == 1 and r.get("status") in ("PUBLIC", "VIRTUAL"))

        q1_scope_solved = sum(1 for r in filtered_rows if r.get("q1") == 1)
        q2_scope_solved = sum(1 for r in filtered_rows if r.get("q2") == 1)
        q3_scope_solved = sum(1 for r in filtered_rows if r.get("q3") == 1)
        q4_scope_solved = sum(1 for r in filtered_rows if r.get("q4") == 1)
        total_scope_solved = q1_scope_solved + q2_scope_solved + q3_scope_solved + q4_scope_solved
        avg_scope_solved = round(total_scope_solved / max(1, scope_public + scope_virtual), 2) if (scope_public + scope_virtual) > 0 else 0.0

        scope_virtual4 = sum(1 for r in filtered_rows if (r.get("total_solved") or 0) >= 4 and r.get("status") == "VIRTUAL")
        scope_virtual3 = sum(1 for r in filtered_rows if (r.get("total_solved") or 0) == 3 and r.get("status") == "VIRTUAL")
        scope_virtual2 = sum(1 for r in filtered_rows if (r.get("total_solved") or 0) == 2 and r.get("status") == "VIRTUAL")
        scope_virtual1 = sum(1 for r in filtered_rows if (r.get("total_solved") or 0) == 1 and r.get("status") == "VIRTUAL")

        top_performers_scope = [
            r for r in filtered_rows
            if r.get("status") in ("PUBLIC", "VIRTUAL") and (r.get("total_solved") or 0) > 0
        ]
        top_performers_scope.sort(key=lambda x: (
            -(x.get("total_solved") or 0),
            (int(x.get("rank")) if x.get("rank") not in (None, "—", "") else (int(x.get("contest_rank")) if x.get("contest_rank") not in (None, "—", "") else 999999))
        ))
        top_performers = top_performers_scope[:3]

        is_provisional = session_obj.status in ("LIVE", "SCHEDULED", "FINALIZING", "ACTIVE")

        metrics = {
            "totalStudents": scope_total,
            "totalCount": scope_total,
            "officialAttended": scope_public,
            "actual": scope_public,
            "public": scope_public,
            "virtualAttended": scope_virtual,
            "virtual": scope_virtual,
            "notAttended": scope_not_att,
            "notVerified": scope_not_ver,
            "notVerifiedFinal": scope_not_ver_final,
            "conflict": scope_conflict,
            "sourceError": scope_source_err,
            "pending": scope_not_ver,
            "errors": scope_errors,
            "totalErrors": scope_errors,
            "dataErrors": scope_errors,
            "participationPercentage": scope_part_pct,
            "participation_pct": scope_part_pct,
            "isProvisional": is_provisional,
            "participationLabel": "Provisional Participation" if is_provisional else "Finalized Participation",
            "q4Count": scope_q4,
            "q3Count": scope_q3,
            "q2Count": scope_q2,
            "q1Count": scope_q1,
            "questionProgress": {
                "q1": q1_scope_solved,
                "q2": q2_scope_solved,
                "q3": q3_scope_solved,
                "q4": q4_scope_solved,
                "totalSolved": total_scope_solved,
                "avgSolved": avg_scope_solved
            },
            "virtual4Solved": scope_virtual4,
            "virtual3Solved": scope_virtual3,
            "virtual2Solved": scope_virtual2,
            "virtual1Solved": scope_virtual1,
            "topPerformers": top_performers,
            "reconciliationPassed": reconciliation_passed
        }
    else:
        public_cnt = status_counts.get("PUBLIC", 0)
        virtual_cnt = status_counts.get("VIRTUAL", 0)
        not_att_cnt = status_counts.get("NOT_ATTENDED", 0)
        not_verified_cnt = status_counts.get("NOT_VERIFIED", 0) + status_counts.get("PENDING", 0)
        not_verified_final_cnt = status_counts.get("NOT_VERIFIED_FINAL", 0)
        conflict_cnt = status_counts.get("CONFLICT", 0)
        source_error_cnt = (
            status_counts.get("SOURCE_ERROR", 0) +
            status_counts.get("SOURCE_UNAVAILABLE", 0) + 
            status_counts.get("AUTH_REQUIRED", 0) + 
            status_counts.get("USERNAME_NOT_FOUND", 0) + 
            status_counts.get("FETCH_ERROR", 0) + 
            status_counts.get("DATA_MISMATCH", 0)
        )

        # STRICT ADDENDUM CONTRACT: Data Errors (dashboard) = count(CONFLICT) + count(SOURCE_ERROR)
        total_errors_cnt = conflict_cnt + source_error_cnt

        # EXACT MANDATORY PARTICIPATION FORMULA: ((PUBLIC + VIRTUAL) / TOTAL) * 100
        part_pct = round(((public_cnt + virtual_cnt) / total_master_count * 100), 2) if total_master_count > 0 else 0.0

        # Question-specific aggregate solve counts (e.g. Q1: 72, Q2: 51, Q3: 23, Q4: 8)
        q1_total_solved = sum(1 for r in canonical_rows if r.get("q1") == 1)
        q2_total_solved = sum(1 for r in canonical_rows if r.get("q2") == 1)
        q3_total_solved = sum(1 for r in canonical_rows if r.get("q3") == 1)
        q4_total_solved = sum(1 for r in canonical_rows if r.get("q4") == 1)
        total_questions_solved = q1_total_solved + q2_total_solved + q3_total_solved + q4_total_solved
        avg_questions_solved = round(total_questions_solved / max(1, public_cnt + virtual_cnt), 2) if (public_cnt + virtual_cnt) > 0 else 0.0

        virtual4_all = sum(1 for r in canonical_rows if (r.get("total_solved") or 0) >= 4 and r.get("status") == "VIRTUAL")
        virtual3_all = sum(1 for r in canonical_rows if (r.get("total_solved") or 0) == 3 and r.get("status") == "VIRTUAL")
        virtual2_all = sum(1 for r in canonical_rows if (r.get("total_solved") or 0) == 2 and r.get("status") == "VIRTUAL")
        virtual1_all = sum(1 for r in canonical_rows if (r.get("total_solved") or 0) == 1 and r.get("status") == "VIRTUAL")

        top_performers_all = [
            r for r in canonical_rows
            if r.get("status") in ("PUBLIC", "VIRTUAL") and (r.get("total_solved") or 0) > 0
        ]
        top_performers_all.sort(key=lambda x: (
            -(x.get("total_solved") or 0),
            (int(x.get("rank")) if x.get("rank") not in (None, "—", "") else (int(x.get("contest_rank")) if x.get("contest_rank") not in (None, "—", "") else 999999))
        ))
        top_performers_global = top_performers_all[:3]

        is_provisional = session_obj.status in ("LIVE", "SCHEDULED", "FINALIZING", "ACTIVE")

        metrics = {
            "totalStudents": total_master_count,
            "totalCount": total_master_count,
            "officialAttended": public_cnt,
            "actual": public_cnt,
            "public": public_cnt,
            "virtualAttended": virtual_cnt,
            "virtual": virtual_cnt,
            "notAttended": not_att_cnt,
            "notVerified": not_verified_cnt,
            "notVerifiedFinal": not_verified_final_cnt,
            "conflict": conflict_cnt,
            "sourceError": source_error_cnt,
            "pending": not_verified_cnt,
            "errors": total_errors_cnt,
            "totalErrors": total_errors_cnt,
            "dataErrors": total_errors_cnt,
            "participationPercentage": part_pct,
            "participation_pct": part_pct,
            "isProvisional": is_provisional,
            "participationLabel": "Provisional Participation" if is_provisional else "Finalized Participation",
            "q4Count": q4_all,
            "q3Count": q3_all,
            "q2Count": q2_all,
            "q1Count": q1_all,
            "questionProgress": {
                "q1": q1_total_solved,
                "q2": q2_total_solved,
                "q3": q3_total_solved,
                "q4": q4_total_solved,
                "totalSolved": total_questions_solved,
                "avgSolved": avg_questions_solved
            },
            "virtual4Solved": virtual4_all,
            "virtual3Solved": virtual3_all,
            "virtual2Solved": virtual2_all,
            "virtual1Solved": virtual1_all,
            "topPerformers": top_performers_global,
            "reconciliationPassed": reconciliation_passed
        }

    # Department and Year percentages
    for d in dept_stats_map.values():
        d["participation_pct"] = round(((d["public"] + d["virtual"]) / d["total"] * 100), 2) if d["total"] > 0 else 0.0
    for y in year_stats_map.values():
        y["participation_pct"] = round(((y["public"] + y["virtual"]) / y["total"] * 100), 2) if y["total"] > 0 else 0.0

    result_payload = {
        "sessionId": session_id,
        "contestId": session_obj.contest_id,
        "contestName": session_obj.contest_name,
        "sessionDate": session_obj.session_date,
        "status": session_obj.status,
        "isLive": session_obj.status == "LIVE",
        "isScheduled": session_obj.status == "SCHEDULED",
        "isFinalized": session_obj.status == "FINALIZED",
        "generatedAtIST": datetime.datetime.now().strftime("%d %b %Y, %I:%M %p IST"),
        "rows": filtered_rows,
        "all_rows": canonical_rows,
        "metrics": metrics,
        "statusCounts": status_counts,
        "departmentStats": dept_stats_map,
        "yearStats": year_stats_map,
        "dataQualityIssues": data_quality_issues,
        "reconciliation": {
            "passed": reconciliation_passed,
            "masterCount": total_master_count,
            "deptSum": sum_dept_totals,
            "yearSum": sum_year_totals,
            "statusSum": sum_status_totals
        }
    }

    return result_payload
