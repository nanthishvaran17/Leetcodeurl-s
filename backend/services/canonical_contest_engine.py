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
    if fetch_status in ("FETCH_ERROR", "FETCH_FAILED", "SERVER_ERROR"):
        return "FETCH_ERROR"

    if not raw_status:
        return "PENDING"

    st = str(raw_status).strip().upper()
    if st in ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED", "OFFICIAL"):
        return "PUBLIC"
    if st in ("VIRTUAL", "VIRTUAL_ATTENDED"):
        return "VIRTUAL"
    if st in ("NOT_ATTENDED", "PUBLIC_NOT_ATTENDED", "ABSENT"):
        return "NOT_ATTENDED"
    if st in ("PENDING", "INITIALIZING", "DATA_PENDING"):
        return "PENDING"
    if st in ("USERNAME_NOT_FOUND", "INVALID_USERNAME"):
        return "USERNAME_NOT_FOUND"
    if st in ("SOURCE_UNAVAILABLE", "TIMEOUT"):
        return "SOURCE_UNAVAILABLE"
    if st in ("AUTH_REQUIRED",):
        return "AUTH_REQUIRED"
    if st in ("FETCH_ERROR", "FETCH_FAILED", "DATA_ERROR"):
        return "FETCH_ERROR"
    if st in ("DATA_MISMATCH",):
        return "DATA_MISMATCH"

    return "PENDING"


def invalidate_canonical_cache(session_id: Optional[int] = None):
    """Invalidates the in-memory cache for a specific session or globally."""
    from backend.cache import cache
    cache.invalidate_tag("contests")


def build_canonical_contest_dataset(
    session_id: int,
    db: Session,
    dept: str = "ALL",
    year: str = "ALL",
    attendance: str = "ALL",
    current_user: Optional[User] = None
) -> Dict[str, Any]:
    """
    Builds the SINGLE SOURCE OF TRUTH (SSOT) Canonical Contest Dataset.
    Driven directly by the authoritative Student Master and verified contest results.
    Runs comprehensive reconciliation before returning.
    """
    session_obj = db.query(WeeklySession).filter(WeeklySession.id == session_id).first()
    if not session_obj:
        session_obj = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()
    if not session_obj:
        raise ValueError(f"Contest Session ID {session_id} not found in database.")

    user_scope = f"{current_user.id}:{current_user.role}" if current_user else "public"
    cache_key = f"canonical_contest_{session_id}_{dept}_{year}_{attendance}_{user_scope}"
    
    # Context-aware TTLs: 15s during live, 300s post-finalization
    ttl = 300 if session_obj.status == "FINALIZED" else 15
    
    from backend.cache import cache
    return cache.get_or_compute(
        key=cache_key,
        compute_func=lambda: _build_canonical_contest_dataset_internal(
            session_id, session_obj, db, dept, year, attendance, current_user
        ),
        ttl_seconds=ttl,
        tags=["contests"]
    )

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
        joinedload(Student.department),
        joinedload(Student.stats)
    ).filter(
        (Student.is_active == True) | (Student.is_active.is_(None))
    )
    
    if current_user:
        student_query = apply_role_based_student_filter(student_query, current_user, db)
        
    all_master_students = student_query.order_by(Student.id.asc()).all()
    total_master_count = len(all_master_students)

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

    # Department and Year aggregators for all 11 Institutional Departments
    dept_stats_map: Dict[str, Dict[str, Any]] = {
        "CSE": {"name": "Computer Science and Engineering", "total": 0, "public": 0, "virtual": 0, "not_attended": 0, "pending": 0, "errors": 0, "q4": 0, "q3": 0, "q2": 0, "q1": 0},
        "IT": {"name": "Information Technology", "total": 0, "public": 0, "virtual": 0, "not_attended": 0, "pending": 0, "errors": 0, "q4": 0, "q3": 0, "q2": 0, "q1": 0},
        "AIDS": {"name": "Artificial Intelligence and Data Science", "total": 0, "public": 0, "virtual": 0, "not_attended": 0, "pending": 0, "errors": 0, "q4": 0, "q3": 0, "q2": 0, "q1": 0},
        "CSE(CS)": {"name": "Computer Science and Engineering (Cyber Security)", "total": 0, "public": 0, "virtual": 0, "not_attended": 0, "pending": 0, "errors": 0, "q4": 0, "q3": 0, "q2": 0, "q1": 0},
        "CSE(IOT)": {"name": "Computer Science and Engineering (Internet of Things)", "total": 0, "public": 0, "virtual": 0, "not_attended": 0, "pending": 0, "errors": 0, "q4": 0, "q3": 0, "q2": 0, "q1": 0},
        "ECE": {"name": "Electronics and Communication Engineering", "total": 0, "public": 0, "virtual": 0, "not_attended": 0, "pending": 0, "errors": 0, "q4": 0, "q3": 0, "q2": 0, "q1": 0},
        "EEE": {"name": "Electrical and Electronics Engineering", "total": 0, "public": 0, "virtual": 0, "not_attended": 0, "pending": 0, "errors": 0, "q4": 0, "q3": 0, "q2": 0, "q1": 0},
        "MECH": {"name": "Mechanical Engineering", "total": 0, "public": 0, "virtual": 0, "not_attended": 0, "pending": 0, "errors": 0, "q4": 0, "q3": 0, "q2": 0, "q1": 0},
        "CIVIL": {"name": "Civil Engineering", "total": 0, "public": 0, "virtual": 0, "not_attended": 0, "pending": 0, "errors": 0, "q4": 0, "q3": 0, "q2": 0, "q1": 0},
        "AGRI": {"name": "Agriculture Engineering", "total": 0, "public": 0, "virtual": 0, "not_attended": 0, "pending": 0, "errors": 0, "q4": 0, "q3": 0, "q2": 0, "q1": 0},
        "BME": {"name": "Biomedical Engineering", "total": 0, "public": 0, "virtual": 0, "not_attended": 0, "pending": 0, "errors": 0, "q4": 0, "q3": 0, "q2": 0, "q1": 0},
    }

    year_stats_map: Dict[str, Dict[str, Any]] = {
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

        dept_raw = (student.department.code if student.department else None) or (p_res.dept if p_res else None) or "CSE"
        reg_upper = (reg_no or "").upper()
        
        if "CC" in reg_upper:
            dept_raw = "CSE(CS)"
        elif "CI" in reg_upper or "CIR" in reg_upper:
            dept_raw = "CSE(IOT)"

        dept_code = str(dept_raw).strip().upper()
        if dept_code in ("CSE(IOT)", "IOT", "CSE_IOT"):
            dept_code = "CSE(IOT)"
        elif dept_code in ("CSE(CS)", "CS", "CYBER", "CYBER SECURITY", "CSE_CS"):
            dept_code = "CSE(CS)"
        elif dept_code in ("IT", "INFORMATION TECHNOLOGY"):
            dept_code = "IT"
        elif dept_code in ("AIDS", "AI&DS", "AI-DS", "AI DS"):
            dept_code = "AIDS"
        elif dept_code in ("ECE", "ELECTRONICS"):
            dept_code = "ECE"
        elif dept_code in ("EEE", "ELECTRICAL"):
            dept_code = "EEE"
        elif dept_code in ("MECH", "MECHANICAL"):
            dept_code = "MECH"
        elif dept_code in ("CIVIL",):
            dept_code = "CIVIL"
        elif dept_code in ("AGRI", "AGRICULTURE"):
            dept_code = "AGRI"
        elif dept_code in ("BME", "BIOMEDICAL"):
            dept_code = "BME"
        elif dept_code in ("CSE", "COMPUTER SCIENCE"):
            dept_code = "CSE"
        else:
            dept_code = dept_raw

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
        # Priority:
        # 1. LIVE Ranking / Public Attendance -> PUBLIC
        # 2. Virtual Result / Virtual Flag -> VIRTUAL
        # 3. Explicit Non-Attendance -> NOT_ATTENDED
        # 4. Error / Unmapped
        p_status = normalize_participation_status(p_res.participation_status if p_res else None, p_res.fetch_status if p_res else None)
        v_status = normalize_participation_status(v_res.participation_status if v_res else None) if v_res else None

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
            raw_status = p_res.participation_status if p_res else (v_res.participation_status if v_res else "PENDING")
            fetch_status = p_res.fetch_status if p_res else "PENDING"
            canon_status = normalize_participation_status(raw_status, fetch_status)

        error_reason = p_res.error_reason if p_res else (getattr(v_res, "error_reason", None) if v_res else None)

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
            if (q1_val + q2_val + q3_val + q4_val) == 0 and score_val:
                sv = int(float(score_val))
                if sv >= 18:
                    q1_val = 1; q2_val = 1; q3_val = 1; q4_val = 1
                elif sv == 12:
                    q1_val = 1; q2_val = 1; q3_val = 1
                elif sv == 7:
                    q1_val = 1; q2_val = 1
                elif sv == 3:
                    q1_val = 1

            actual_sum = q1_val + q2_val + q3_val + q4_val
            solved_val = actual_sum
            
            if not score_val:
                score_val = (q1_val * 3 + q2_val * 4 + q3_val * 5 + q4_val * 6)

            rank_val = p_res.contest_rank
            rating_val = p_res.contest_rating
        elif canon_status == "VIRTUAL":
            source_res = v_res if v_res else p_res
            q1_val = 1 if (source_res.q1 and source_res.q1 >= 1) else 0
            q2_val = 1 if (source_res.q2 and source_res.q2 >= 1) else 0
            q3_val = 1 if (source_res.q3 and source_res.q3 >= 1) else 0
            q4_val = 1 if (source_res.q4 and source_res.q4 >= 1) else 0
            score_val = getattr(source_res, "contest_score", None)

            # If Qs are 0 but score is populated, infer based on 3/4/5/6 distribution
            if (q1_val + q2_val + q3_val + q4_val) == 0 and score_val:
                sv = int(float(score_val))
                if sv >= 18:
                    q1_val = 1; q2_val = 1; q3_val = 1; q4_val = 1
                elif sv == 12:
                    q1_val = 1; q2_val = 1; q3_val = 1
                elif sv == 7:
                    q1_val = 1; q2_val = 1
                elif sv == 3:
                    q1_val = 1

            actual_sum = q1_val + q2_val + q3_val + q4_val
            solved_val = source_res.total_contest_solved if (source_res.total_contest_solved is not None and source_res.total_contest_solved > 0) else actual_sum
            
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
        dept_norm = dept_code
        if dept_norm not in dept_stats_map:
            dept_stats_map[dept_norm] = {"name": dept_norm, "total": 0, "public": 0, "virtual": 0, "not_attended": 0, "pending": 0, "errors": 0, "q4": 0, "q3": 0, "q2": 0, "q1": 0}

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
        if y_str in ("IV", "4", "4TH", "IV YEAR", "FINAL"):
            yr_norm = "IV"
        elif y_str in ("III", "3", "3RD", "III YEAR", "THIRD"):
            yr_norm = "III"
        elif y_str in ("II", "2", "2ND", "II YEAR", "SECOND"):
            yr_norm = "II"
        else:
            yr_norm = "III"

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

        row_item = {
            "s_no": idx,
            "student_id": s_id,
            "reg_no": reg_no,
            "name": name,
            "dept": dept_norm,
            "year": yr_norm,
            "username": username,
            "profile_url": profile_url,
            "profile_rank": student.stats.contest_global_ranking if student.stats else None,
            "profile_total_solved": student.stats.total_solved if student.stats else 0,
            "easy_solved": student.stats.easy_solved if student.stats else None,
            "medium_solved": student.stats.medium_solved if student.stats else None,
            "hard_solved": student.stats.hard_solved if student.stats else None,
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
        if attendance in ("ALL_ATTENDED", "TOTAL_ATTENDED"):
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
