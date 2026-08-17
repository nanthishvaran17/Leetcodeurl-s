import datetime
import hashlib
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from backend.models import (
    WeeklySession, WeeklyPublicResult, WeeklyVirtualResult,
    WeeklyContestErrorLog, Student, Department
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


def build_canonical_contest_dataset(
    session_id: int,
    db: Session,
    dept: str = "ALL",
    year: str = "ALL",
    attendance: str = "ALL"
) -> Dict[str, Any]:
    """
    Builds the SINGLE SOURCE OF TRUTH (SSOT) Canonical Contest Dataset.
    Driven directly by the authoritative Student Master and verified contest results.
    Runs comprehensive reconciliation before returning.
    """
    session_obj = db.query(WeeklySession).filter(WeeklySession.id == session_id).first()
    if not session_obj:
        raise ValueError(f"Contest Session ID {session_id} not found in database.")

    # 1. Fetch Authoritative Master Students
    student_query = db.query(Student).filter(
        (Student.is_active == True) | (Student.is_active.is_(None))
    )
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

    # Department and Year aggregators
    dept_stats_map: Dict[str, Dict[str, Any]] = {
        "CSE(CS)": {"name": "Computer Science & Engineering (Cyber Security)", "total": 0, "public": 0, "virtual": 0, "not_attended": 0, "pending": 0, "errors": 0, "q4": 0, "q3": 0, "q2": 0, "q1": 0},
        "CSE(IoT)": {"name": "Computer Science & Engineering (IoT)", "total": 0, "public": 0, "virtual": 0, "not_attended": 0, "pending": 0, "errors": 0, "q4": 0, "q3": 0, "q2": 0, "q1": 0}
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
        dept_code = student.department.code if student.department else "CSE(CS)"
        year_level = student.year_level or "III"
        username = student.username or ""
        profile_url = student.leetcode_url or (f"https://leetcode.com/u/{username}" if username else "")

        p_res = public_res_map.get(s_id)
        v_res = virtual_res_map.get(s_id)

        # Determine authoritative participation status
        raw_status = p_res.participation_status if p_res else (v_res.participation_status if v_res else "PENDING")
        fetch_status = p_res.fetch_status if p_res else "PENDING"
        error_reason = p_res.error_reason if p_res else None

        canon_status = normalize_participation_status(raw_status, fetch_status)

        # Check if student username was missing in master
        if not username or len(username.strip()) < 2:
            canon_status = "USERNAME_NOT_FOUND"
            error_reason = "LeetCode username unlinked or missing in Student Master"

        is_participant = canon_status in ("PUBLIC", "VIRTUAL")

        # Questions & Solved Count
        if is_participant and p_res:
            q1_val = 1 if (p_res.q1 and p_res.q1 >= 1) else 0
            q2_val = 1 if (p_res.q2 and p_res.q2 >= 1) else 0
            q3_val = 1 if (p_res.q3 and p_res.q3 >= 1) else 0
            q4_val = 1 if (p_res.q4 and p_res.q4 >= 1) else 0
            actual_sum = q1_val + q2_val + q3_val + q4_val
            solved_val = p_res.total_contest_solved if p_res.total_contest_solved is not None else actual_sum

            # Mathematical validation: Contest Solved must strictly equal q1 + q2 + q3 + q4
            if solved_val != actual_sum:
                canon_status = "DATA_MISMATCH"
                error_reason = f"Solved count mismatch: total_solved={solved_val} vs sum(q1..q4)={actual_sum}"
                data_quality_issues.append({
                    "reg_no": reg_no,
                    "name": name,
                    "type": "DATA_MISMATCH",
                    "reason": error_reason,
                    "source": "Validation Gatekeeper"
                })

            score_val = p_res.contest_score or (q1_val * 3 + q2_val * 4 + q3_val * 5 + q4_val * 6)
            rank_val = p_res.contest_rank
            rating_val = p_res.contest_rating
        elif is_participant and v_res:
            q1_val = 1 if (v_res.q1 and v_res.q1 >= 1) else 0
            q2_val = 1 if (v_res.q2 and v_res.q2 >= 1) else 0
            q3_val = 1 if (v_res.q3 and v_res.q3 >= 1) else 0
            q4_val = 1 if (v_res.q4 and v_res.q4 >= 1) else 0
            solved_val = q1_val + q2_val + q3_val + q4_val
            score_val = v_res.score or (q1_val * 3 + q2_val * 4 + q3_val * 5 + q4_val * 6)
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

        # Track quality issues for non-standard statuses
        if canon_status in ("SOURCE_UNAVAILABLE", "AUTH_REQUIRED", "USERNAME_NOT_FOUND", "FETCH_ERROR", "DATA_MISMATCH"):
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
        dept_norm = "CSE(CS)" if ("CS" in dept_code.upper() or "CYBER" in dept_code.upper()) else "CSE(IoT)"
        if dept_norm in dept_stats_map:
            dept_stats_map[dept_norm]["total"] += 1
            if canon_status == "PUBLIC": dept_stats_map[dept_norm]["public"] += 1
            elif canon_status == "VIRTUAL": dept_stats_map[dept_norm]["virtual"] += 1
            elif canon_status == "NOT_ATTENDED": dept_stats_map[dept_norm]["not_attended"] += 1
            elif canon_status == "PENDING": dept_stats_map[dept_norm]["pending"] += 1
            else: dept_stats_map[dept_norm]["errors"] += 1

            if is_participant and solved_val:
                if solved_val >= 4: dept_stats_map[dept_norm]["q4"] += 1
                elif solved_val == 3: dept_stats_map[dept_norm]["q3"] += 1
                elif solved_val == 2: dept_stats_map[dept_norm]["q2"] += 1
                elif solved_val == 1: dept_stats_map[dept_norm]["q1"] += 1

        # Year aggregator
        yr_norm = "II" if ("II" in year_level or "2" in year_level) else ("IV" if ("IV" in year_level or "4" in year_level) else "III")
        if yr_norm in year_stats_map:
            year_stats_map[yr_norm]["total"] += 1
            if canon_status == "PUBLIC": year_stats_map[yr_norm]["public"] += 1
            elif canon_status == "VIRTUAL": year_stats_map[yr_norm]["virtual"] += 1
            elif canon_status == "NOT_ATTENDED": year_stats_map[yr_norm]["not_attended"] += 1
            elif canon_status == "PENDING": year_stats_map[yr_norm]["pending"] += 1
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
        filtered_rows = [r for r in filtered_rows if r["dept"] == dept]
    if year and year != "ALL":
        filtered_rows = [r for r in filtered_rows if r["year"] == year]
    if attendance and attendance != "ALL":
        if attendance in ("ATTENDED", "PUBLIC_ATTENDED"):
            filtered_rows = [r for r in filtered_rows if r["status"] in ("PUBLIC", "VIRTUAL")]
        elif attendance in ("NOT_ATTENDED", "PUBLIC_NOT_ATTENDED"):
            filtered_rows = [r for r in filtered_rows if r["status"] == "NOT_ATTENDED"]
        elif attendance in ("UNKNOWN", "DATA_ERROR", "ERROR"):
            filtered_rows = [r for r in filtered_rows if r["status"] not in ("PUBLIC", "VIRTUAL", "NOT_ATTENDED")]
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

    # 5. Global Metrics & Participation Percentage
    public_cnt = status_counts["PUBLIC"]
    virtual_cnt = status_counts["VIRTUAL"]
    not_att_cnt = status_counts["NOT_ATTENDED"]
    pending_cnt = status_counts["PENDING"]
    total_errors_cnt = (
        status_counts["SOURCE_UNAVAILABLE"] + 
        status_counts["AUTH_REQUIRED"] + 
        status_counts["USERNAME_NOT_FOUND"] + 
        status_counts["FETCH_ERROR"] + 
        status_counts["DATA_MISMATCH"]
    )

    part_pct = round(((public_cnt + virtual_cnt) / total_master_count * 100), 2) if total_master_count > 0 else 0.0

    metrics = {
        "totalStudents": total_master_count,
        "totalCount": total_master_count,
        "officialAttended": public_cnt,
        "public": public_cnt,
        "virtualAttended": virtual_cnt,
        "virtual": virtual_cnt,
        "notAttended": not_att_cnt,
        "pending": pending_cnt,
        "errors": total_errors_cnt,
        "totalErrors": total_errors_cnt,
        "participationPercentage": part_pct,
        "participation_pct": part_pct,
        "q4Count": q4_all,
        "q3Count": q3_all,
        "q2Count": q2_all,
        "q1Count": q1_all,
        "reconciliationPassed": reconciliation_passed
    }

    # Department and Year percentages
    for d in dept_stats_map.values():
        d["participation_pct"] = round(((d["public"] + d["virtual"]) / d["total"] * 100), 2) if d["total"] > 0 else 0.0
    for y in year_stats_map.values():
        y["participation_pct"] = round(((y["public"] + y["virtual"]) / y["total"] * 100), 2) if y["total"] > 0 else 0.0

    return {
        "sessionId": session_id,
        "contestId": session_obj.contest_id,
        "contestName": session_obj.contest_name,
        "sessionDate": session_obj.session_date,
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
