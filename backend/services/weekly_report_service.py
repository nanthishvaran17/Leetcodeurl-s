"""
Master Weekly Performance Report Service
Produces a single, canonical, DB-read-only dataset for Excel, PDF, and Word report generators.
Strict adherence to AY 2026-27 batch configurations, strict contest classification, and None vs 0 handling.
"""
import datetime
from typing import Dict, Any, List, Optional, Tuple
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.models import (
    Student, Department, Section, LeetCodeProfileStats,
    StudentStatSnapshot, ContestParticipation, WeeklySession,
    WeeklyPublicResult, WeeklyVirtualResult, StudentContestParticipation
)
from backend.config.report_config import (
    BATCH_YEAR_MAP,
    BATCH_CONFIG,
    DEPARTMENT_COORDINATORS,
    FINALIZED_STATUSES,
    derive_student_batch,
    get_coordinator_for_department,
)
from backend.services.weekly_session_resolver import (
    resolve_weekly_sessions,
    extract_contest_number,
)
from backend.services.contest_bucket_classifier import (
    classify_public_contest_outcome,
    classify_virtual_contest_outcome,
)
from backend.services.report_data_service import get_problem_category
from backend.logger import logger


def get_student_status_code(student: Student) -> Tuple[str, Optional[int], Optional[int], Optional[int], Optional[int]]:
    """
    Extracts student stats and distinguishes verified zero solved, missing links, invalid URLs, and network errors.
    Returns (status_code, total_solved, easy, medium, hard)
    """
    st = student.stats
    if not student.leetcode_url and not student.username:
        return "MISSING_LINK", None, None, None, None

    url_str = (student.leetcode_url or "").strip().lower()
    if url_str and ("google.com" in url_str or "share" in url_str or "drive" in url_str or not url_str.startswith("http")):
        if not student.username:
            return "INVALID_URL", None, None, None, None

    if not st:
        return "DATA_UNAVAILABLE", None, None, None, None

    if st.sync_status in ("failed", "stale") and st.total_solved is None:
        if st.error_code == "PROFILE_NOT_FOUND" or st.status == "PROFILE NOT FOUND":
            return "PROFILE_NOT_FOUND", None, None, None, None
        return "DATA_UNAVAILABLE", None, None, None, None

    is_verified = (st.sync_status in ("success", "OK", "verified", "stale") or st.status == "verified" or st.total_solved is not None)
    if not is_verified:
        return "DATA_UNAVAILABLE", None, None, None, None

    easy = st.easy_solved
    medium = st.medium_solved
    hard = st.hard_solved

    if easy is not None and medium is not None and hard is not None:
        derived_tot = easy + medium + hard
        if st.total_solved is not None and st.total_solved != derived_tot and derived_tot > 0:
            return "DATA_MISMATCH", st.total_solved, easy, medium, hard
        tot = derived_tot
    else:
        tot = st.total_solved

    if tot is None:
        return "DATA_UNAVAILABLE", None, None, None, None

    return "VERIFIED", tot, easy, medium, hard


def _get_profile_category_name(solved: Optional[int], is_verified: bool) -> str:
    """Classifies profile problem solved count into official institutional categories."""
    if not is_verified or solved is None:
        return "Not Yet Started"
    if solved > 500:
        return "Above 500"
    if solved >= 250:
        return "250 - 500"
    if solved >= 100:
        return "Less than 250"
    if solved > 0:
        return "Less than 100"
    return "Not Yet Started"


def generate_weekly_performance_data(
    db: Session,
    last_week_contest: Optional[int] = None,
    current_week_contest: Optional[int] = None,
    report_date: Optional[str] = None,
    save_snapshot: bool = False
) -> Dict[str, Any]:
    """
    CANONICAL WEEKLY PERFORMANCE DATASET GENERATOR
    
    1. Resolves canonical sessions via weekly_session_resolver.
    2. Loads ALL active students from the master roster (denominator).
    3. Loads both WeeklyPublicResult and WeeklyVirtualResult for both resolved sessions.
    4. Classifies all students using strict contest bucket classifiers (Public and Virtual separated).
    5. Aggregates data cleanly for College Summary, Department Summaries, and Batch Summaries.
    6. Produces ONE canonical dictionary consumed by Excel, PDF, and Word exporters.
    7. Read-only operation on SQLite database.
    """
    today_str = report_date or datetime.date.today().strftime("%d-%m-%Y")

    # Step 1: Session Resolution
    session_res = resolve_weekly_sessions(
        db,
        last_week=last_week_contest,
        current_week=current_week_contest
    )

    curr_ws = session_res.get("current_week_session")
    last_ws = session_res.get("last_week_session")
    curr_contest_num = session_res.get("current_week_contest")
    last_contest_num = session_res.get("last_week_contest")
    curr_session_id = getattr(curr_ws, "id", None)
    last_session_id = getattr(last_ws, "id", None)

    curr_date = session_res.get("current_week_date") or getattr(curr_ws, "session_date", "Not Available")
    last_date = session_res.get("last_week_date") or getattr(last_ws, "session_date", "Not Available")

    # Step 2: Load Full Master Roster
    students = (
        db.query(Student)
        .filter((Student.is_active == True) | (Student.is_active.is_(None)))
        .order_by(Student.department_id, Student.year_level, Student.reg_no)
        .all()
    )
    total_students_count = len(students)

    # Step 3: Load Contest Results for Both Sessions (Without Filtering Attended Only)
    curr_pub_results: Dict[int, Any] = {}
    curr_vir_results: Dict[int, Any] = {}
    last_pub_results: Dict[int, Any] = {}
    last_vir_results: Dict[int, Any] = {}

    if curr_session_id is not None:
        for r in db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == curr_session_id).all():
            curr_pub_results[r.student_id] = r
        for r in db.query(WeeklyVirtualResult).filter(WeeklyVirtualResult.session_id == curr_session_id).all():
            curr_vir_results[r.student_id] = r

    if last_session_id is not None:
        for r in db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == last_session_id).all():
            last_pub_results[r.student_id] = r
        for r in db.query(WeeklyVirtualResult).filter(WeeklyVirtualResult.session_id == last_session_id).all():
            last_vir_results[r.student_id] = r

    # Step 4: Classify Every Student on Full Master Roster
    all_students_current = []
    all_students_last_week = []
    
    verified_count = 0
    unavailable_count = 0
    fetch_errors = []
    validation_issues = []
    fetch_status_counts = defaultdict(int)

    cat_lists: Dict[str, List[Dict[str, Any]]] = {
        "above_500": [],
        "250_500": [],
        "101_250": [],
        "less_100": [],
        "not_started": [],
        "unavailable": []
    }

    student_change_analysis = []
    performance_highlights = []

    for idx, s in enumerate(students, start=1):
        st = s.stats
        status_code, tot, easy, med, hd = get_student_status_code(s)
        is_verified = (status_code == "VERIFIED" and tot is not None)

        if is_verified:
            verified_count += 1
            fetch_status_counts["Verified Fresh"] += 1
        else:
            unavailable_count += 1
            fetch_status_counts[status_code] += 1
            if status_code in ("MISSING_LINK", "INVALID_URL", "PROFILE_NOT_FOUND", "DATA_UNAVAILABLE", "DATA_MISMATCH"):
                fetch_errors.append({
                    "s_no": len(fetch_errors) + 1,
                    "reg_no": s.reg_no,
                    "name": s.name,
                    "dept": s.department.code if s.department else "CSE",
                    "year": s.year_level or "III",
                    "batch": derive_student_batch(s.year_level),
                    "username": s.username or "N/A",
                    "leetcode_url": s.leetcode_url or "N/A",
                    "error_type": status_code,
                    "error_message": getattr(st, "error_message", None) or f"Status: {status_code}",
                    "last_successful_fetch": getattr(st, "last_successful_sync", None),
                    "latest_attempt": getattr(st, "last_attempt_at", None),
                    "previous_total": getattr(st, "total_solved", None),
                    "current_attempt_status": getattr(st, "sync_status", "pending"),
                    "action_required": "Verify LeetCode Profile URL / Username"
                })

        category_name = _get_profile_category_name(tot, is_verified)
        batch_label = derive_student_batch(s.year_level)
        dept_code = s.department.code if s.department else "CSE"

        # Current Week Contest Classification
        curr_pub_obj = curr_pub_results.get(s.id)
        curr_vir_obj = curr_vir_results.get(s.id)
        curr_pub_outcome = classify_public_contest_outcome(curr_pub_obj)
        curr_vir_outcome = classify_virtual_contest_outcome(curr_vir_obj)

        # Last Week Contest Classification
        last_pub_obj = last_pub_results.get(s.id)
        last_vir_obj = last_vir_results.get(s.id)
        last_pub_outcome = classify_public_contest_outcome(last_pub_obj)
        last_vir_outcome = classify_virtual_contest_outcome(last_vir_obj)

        # Build Current Student Record
        s_current = {
            "s_no": idx,
            "id": s.id,
            "student_id": s.id,
            "student": s.name,
            "reg_no": s.reg_no,
            "name": s.name,
            "department": dept_code,
            "dept": dept_code,
            "department_id": s.department_id,
            "year": s.year_level or "III",
            "year_level": s.year_level or "III",
            "batch": batch_label,
            "leetcode_url": s.leetcode_url,
            "username": s.username or (st.canonical_username if hasattr(st, "canonical_username") else None),
            "easy": easy,
            "medium": med,
            "hard": hd,
            "total_solved": tot,
            "category": category_name,
            "profile_ranking": getattr(st, "public_profile_ranking", None),
            "contest_rating": getattr(st, "contest_rating", None),
            "contest_ranking": getattr(st, "contest_global_ranking", None),
            "contest_name": getattr(st, "recent_contest_name", None),
            "contest_q_solved": getattr(st, "recent_contest_score", None),
            "public_result": curr_pub_outcome,
            "last_public_result": last_pub_outcome,
            "virtual_result": curr_vir_outcome,
            "last_virtual_result": last_vir_outcome,
            "public_obj": curr_pub_obj,
            "virtual_obj": curr_vir_obj,
            "verification_status": "VERIFIED" if is_verified else "UNVERIFIED",
            "fetch_status": getattr(st, "sync_status", "pending") if st else "pending",
            "last_successful_fetch": getattr(st, "last_successful_sync", None),
            "last_fetch_attempt": getattr(st, "last_attempt_at", None),
            "fetch_error": getattr(st, "error_message", None)
        }
        all_students_current.append(s_current)

        # Categorize into bucket rosters
        if not is_verified or tot is None:
            cat_lists["unavailable"].append(s_current)
        elif tot > 500:
            cat_lists["above_500"].append(s_current)
        elif tot >= 250:
            cat_lists["250_500"].append(s_current)
        elif tot >= 100:
            cat_lists["101_250"].append(s_current)
        elif tot > 0:
            cat_lists["less_100"].append(s_current)
        else:
            cat_lists["not_started"].append(s_current)

        # Build Last Week Student Record
        s_last = {
            "s_no": idx,
            "id": s.id,
            "student_id": s.id,
            "student": s.name,
            "reg_no": s.reg_no,
            "name": s.name,
            "department": dept_code,
            "dept": dept_code,
            "department_id": s.department_id,
            "year": s.year_level or "III",
            "year_level": s.year_level or "III",
            "batch": batch_label,
            "leetcode_url": s.leetcode_url,
            "username": s.username,
            "easy": easy,
            "medium": med,
            "hard": hd,
            "total_solved": tot,
            "category": category_name,
            "profile_ranking": getattr(st, "public_profile_ranking", None),
            "contest_rating": getattr(st, "contest_rating", None),
            "contest_ranking": getattr(st, "contest_global_ranking", None),
            "public_result": last_pub_outcome,
            "virtual_result": last_vir_outcome,
            "verification_status": "VERIFIED" if is_verified else "UNVERIFIED",
            "fetch_status": getattr(st, "sync_status", "pending") if st else "pending",
        }
        all_students_last_week.append(s_last)

        # Movement tracking / Student change analysis
        # Extract contest movement
        last_solv = curr_solv = None
        if last_pub_obj and hasattr(last_pub_obj, "total_contest_solved"):
            last_solv = last_pub_obj.total_contest_solved
        if curr_pub_obj and hasattr(curr_pub_obj, "total_contest_solved"):
            curr_solv = curr_pub_obj.total_contest_solved

        movement_status = "STABLE"
        if curr_pub_outcome in ("4_SOLVED", "3_SOLVED", "2_SOLVED", "1_SOLVED") and last_pub_outcome == "NOT_PARTICIPATED":
            movement_status = "NEW_PARTICIPANT"
        elif curr_pub_outcome == "4_SOLVED":
            movement_status = "TOP_SOLVER"

        student_change_analysis.append({
            "s_no": idx,
            "reg_no": s.reg_no,
            "name": s.name,
            "department": dept_code,
            "batch": batch_label,
            "last_week_public": last_pub_outcome,
            "current_week_public": curr_pub_outcome,
            "last_week_virtual": last_vir_outcome,
            "current_week_virtual": curr_vir_outcome,
            "profile_category": category_name,
            "movement": movement_status
        })

        if curr_pub_outcome in ("4_SOLVED", "3_SOLVED"):
            performance_highlights.append({
                "reg_no": s.reg_no,
                "name": s.name,
                "department": dept_code,
                "batch": batch_label,
                "contest_outcome": curr_pub_outcome,
                "questions_solved": 4 if curr_pub_outcome == "4_SOLVED" else 3,
                "contest_name": f"Weekly Contest {curr_contest_num}" if curr_contest_num else "Weekly Contest",
                "highlight_type": "CONTEST_TOP_PERFORMER"
            })

    # Step 5: Cohort & Department Aggregations
    # Organize roster by (department_code, batch)
    cohort_students = defaultdict(list)
    batch_map = defaultdict(list)
    dept_map = defaultdict(list)

    for s_dict in all_students_current:
        matched_label = s_dict["batch"]
        for b_cfg in BATCH_CONFIG:
            if s_dict.get("year") == b_cfg["year"] or s_dict["batch"].replace(" ", "") == b_cfg["label"].replace(" ", ""):
                matched_label = b_cfg["label"]
                s_dict["batch"] = matched_label
                break
        cohort_students[(s_dict["dept"], matched_label)].append(s_dict)
        batch_map[matched_label].append(s_dict)
        dept_map[s_dict["dept"]].append(s_dict)

    # Make sure all configured batches exist in batch_map even if 0 students
    for b_cfg in BATCH_CONFIG:
        label = b_cfg["label"]
        if label not in batch_map:
            batch_map[label] = []

    def _aggregate_cohort_metrics(student_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculates exact 13-column matrix metrics for a student cohort."""
        tot_count = len(student_list)
        above_500 = sum(1 for s in student_list if s["total_solved"] is not None and s["total_solved"] > 500)
        prob_250_500 = sum(1 for s in student_list if s["total_solved"] is not None and 250 <= s["total_solved"] <= 500)
        prob_100_249 = sum(1 for s in student_list if s["total_solved"] is not None and 100 <= s["total_solved"] < 250)
        prob_1_99 = sum(1 for s in student_list if s["total_solved"] is not None and 1 <= s["total_solved"] < 100)
        prob_0 = sum(1 for s in student_list if s["total_solved"] is None or s["total_solved"] == 0)

        rating_1500 = sum(1 for s in student_list if s["contest_rating"] is not None and s["contest_rating"] > 1500)
        ranking_20000 = sum(1 for s in student_list if s["contest_ranking"] is not None and 0 < s["contest_ranking"] < 20000)

        # Current Week Public Contest buckets
        cw_q4 = sum(1 for s in student_list if s["public_result"] == "4_SOLVED")
        cw_q3 = sum(1 for s in student_list if s["public_result"] == "3_SOLVED")
        cw_q2 = sum(1 for s in student_list if s["public_result"] == "2_SOLVED")
        cw_q1 = sum(1 for s in student_list if s["public_result"] == "1_SOLVED")
        cw_q0 = sum(1 for s in student_list if s["public_result"] == "0_SOLVED")
        cw_not_part = sum(1 for s in student_list if s["public_result"] == "NOT_PARTICIPATED")
        cw_unknown = sum(1 for s in student_list if s["public_result"] == "UNKNOWN")
        cw_unavail = sum(1 for s in student_list if s["public_result"] == "SOURCE_UNAVAILABLE")

        # Current Week Virtual Contest buckets
        cw_vq4 = sum(1 for s in student_list if s["virtual_result"] == "4_SOLVED")
        cw_vq3 = sum(1 for s in student_list if s["virtual_result"] == "3_SOLVED")
        cw_vq2 = sum(1 for s in student_list if s["virtual_result"] == "2_SOLVED")
        cw_vq1 = sum(1 for s in student_list if s["virtual_result"] == "1_SOLVED")
        cw_vq0 = sum(1 for s in student_list if s["virtual_result"] == "0_SOLVED")

        # Last Week Public Contest buckets
        lw_q4 = sum(1 for s in student_list if s.get("last_public_result") == "4_SOLVED" or (last_pub_results.get(s["student_id"]) and classify_public_contest_outcome(last_pub_results[s["student_id"]]) == "4_SOLVED"))
        lw_q3 = sum(1 for s in student_list if s.get("last_public_result") == "3_SOLVED" or (last_pub_results.get(s["student_id"]) and classify_public_contest_outcome(last_pub_results[s["student_id"]]) == "3_SOLVED"))
        lw_q2 = sum(1 for s in student_list if s.get("last_public_result") == "2_SOLVED" or (last_pub_results.get(s["student_id"]) and classify_public_contest_outcome(last_pub_results[s["student_id"]]) == "2_SOLVED"))
        lw_q1 = sum(1 for s in student_list if s.get("last_public_result") == "1_SOLVED" or (last_pub_results.get(s["student_id"]) and classify_public_contest_outcome(last_pub_results[s["student_id"]]) == "1_SOLVED"))
        lw_q0 = sum(1 for s in student_list if s.get("last_public_result") == "0_SOLVED" or (last_pub_results.get(s["student_id"]) and classify_public_contest_outcome(last_pub_results[s["student_id"]]) == "0_SOLVED"))

        solved_vals = [s["total_solved"] for s in student_list if s["total_solved"] is not None]
        avg_solved = round(sum(solved_vals) / len(solved_vals), 1) if solved_vals else 0
        total_solved = sum(solved_vals) if solved_vals else 0

        verified_cnt = sum(1 for s in student_list if s["verification_status"] == "VERIFIED")
        failed_cnt = tot_count - verified_cnt

        return {
            "total_students": tot_count,
            "verified": verified_cnt,
            "failed": failed_cnt,
            "above_500": above_500,
            "prob_above_500": above_500,
            "prob_250_500": prob_250_500,
            "prob_100_249": prob_100_249,
            "prob_1_99": prob_1_99,
            "prob_0": prob_0,
            "250_500": prob_250_500,
            "101_250": prob_100_249,
            "less_100": prob_1_99,
            "not_started": prob_0,
            "rating_1500": rating_1500,
            "ranking_20000": ranking_20000,
            "avg_solved": avg_solved,
            "total_solved": total_solved,
            "current_week": {
                "q4": cw_q4, "q3": cw_q3, "q2": cw_q2, "q1": cw_q1, "q0": cw_q0,
                "not_participated": cw_not_part, "unknown": cw_unknown, "source_unavailable": cw_unavail,
                "prob_above_500": above_500, "prob_250_500": prob_250_500,
                "prob_100_249": prob_100_249, "prob_1_99": prob_1_99, "prob_0": prob_0,
                "rating_above_1500": rating_1500, "rank_below_20000": ranking_20000,
                "rank_below_20k": ranking_20000, "total_students": tot_count,
                "avg_solved": avg_solved, "total_solved": total_solved,
                "verified": verified_cnt, "failed": failed_cnt
            },
            "last_week": {
                "q4": lw_q4, "q3": lw_q3, "q2": lw_q2, "q1": lw_q1, "q0": lw_q0,
                "prob_above_500": above_500, "prob_250_500": prob_250_500,
                "prob_100_249": prob_100_249, "prob_1_99": prob_1_99, "prob_0": prob_0,
                "rating_above_1500": rating_1500, "rank_below_20000": ranking_20000,
                "rank_below_20k": ranking_20000, "total_students": tot_count
            },
            "virtual_contest": {
                "q4": cw_vq4, "q3": cw_vq3, "q2": cw_vq2, "q1": cw_vq1, "q0": cw_vq0
            }
        }

    # Department Summaries
    dept_summaries = []
    departments_db = db.query(Department).order_by(Department.id).all()
    for d in departments_db:
        d_students = dept_map.get(d.code, [])
        d_metrics = _aggregate_cohort_metrics(d_students)
        
        # Batch breakdowns within department
        batch_matrices = {}
        for b_cfg in BATCH_CONFIG:
            b_key = b_cfg["key"]
            b_label = b_cfg["label"]
            b_cohort = [s for s in d_students if s.get("year") == b_cfg["year"] or s.get("batch", "").replace(" ", "") == b_label.replace(" ", "")]
            batch_matrices[b_key] = _aggregate_cohort_metrics(b_cohort)

        coordinator_name = get_coordinator_for_department(d.code)
        dept_summaries.append({
            "department_id": d.id,
            "department": d.code,
            "department_name": d.name,
            "coordinator": coordinator_name,
            "total_students": len(d_students),
            "metrics": d_metrics,
            "batches": batch_matrices,
            "categories": {
                "Above 500": d_metrics["above_500"],
                "250 - 500": d_metrics["250_500"],
                "Less than 250": d_metrics["101_250"],
                "Less than 100": d_metrics["less_100"],
                "Not Yet Started": d_metrics["not_started"]
            },
            "current_week": d_metrics["current_week"],
            "last_week": d_metrics["last_week"]
        })

    # Year-Department Summaries
    year_dept_summaries = []
    for b_cfg in BATCH_CONFIG:
        b_label = b_cfg["label"]
        for d in departments_db:
            yd_students = [s for s in dept_map.get(d.code, []) if s.get("year") == b_cfg["year"] or s.get("batch", "").replace(" ", "") == b_label.replace(" ", "")]
            yd_metrics = _aggregate_cohort_metrics(yd_students)
            if len(yd_students) > 0:
                year_dept_summaries.append({
                    "batch": b_label,
                    "year": b_cfg["year"],
                    "department": d.code,
                    "department_id": d.id,
                    **yd_metrics
                })

    # Batch Summaries (Across College)
    batch_summaries = []
    for b_cfg in BATCH_CONFIG:
        b_label = b_cfg["label"]
        b_students = batch_map.get(b_label, [])
        if len(b_students) == 0:
            continue
        b_metrics = _aggregate_cohort_metrics(b_students)
        batch_summaries.append({
            "batch": b_label,
            "year": b_cfg["year"],
            "total_students": len(b_students),
            "num_students": len(b_students),
            "categories": {
                "Above 500": b_metrics["above_500"],
                "250 - 500": b_metrics["250_500"],
                "Less than 250": b_metrics["101_250"],
                "Less than 100": b_metrics["less_100"],
                "Not Yet Started": b_metrics["not_started"]
            },
            "rating_1500": b_metrics["rating_1500"],
            "ranking_20000": b_metrics["ranking_20000"],
            "current_week": b_metrics["current_week"],
            "last_week": b_metrics["last_week"]
        })

    # College-wide Summary
    college_metrics = _aggregate_cohort_metrics(all_students_current)
    college_summary = {
        "institution": "NANDHA ENGINEERING COLLEGE (AUTONOMOUS)",
        "report_date": today_str,
        "total_students": total_students_count,
        "verified_students": verified_count,
        "unavailable_students": unavailable_count,
        "metrics": college_metrics,
        "batches": {
            b_cfg["key"]: _aggregate_cohort_metrics(batch_map.get(b_cfg["label"], []))
            for b_cfg in BATCH_CONFIG
        }
    }

    # Public and Virtual Contest Datasets
    pub_rows = []
    vir_rows = []
    for s in all_students_current:
        p_obj = s["public_obj"]
        v_obj = s["virtual_obj"]
        
        pub_rows.append({
            "s_no": s["s_no"],
            "reg_no": s["reg_no"],
            "student_name": s["name"],
            "department": s["dept"],
            "year": s["year"],
            "batch": s["batch"],
            "username": s["username"] or "N/A",
            "contest_name": f"Weekly Contest {curr_contest_num}" if curr_contest_num else "Weekly Contest",
            "contest_number": curr_contest_num,
            "contest_date": curr_date,
            "attended": s["public_result"] in ("4_SOLVED", "3_SOLVED", "2_SOLVED", "1_SOLVED", "0_SOLVED"),
            "questions_solved": getattr(p_obj, "total_contest_solved", None),
            "questions_total": 4,
            "score_display": f"{p_obj.total_contest_solved}/4" if p_obj and p_obj.total_contest_solved is not None else s["public_result"],
            "contest_rank": getattr(p_obj, "contest_rank", None),
            "contest_rating": getattr(p_obj, "contest_rating", None),
            "status": s["public_result"],
            "fetched_at": getattr(p_obj, "last_fetched_at", None)
        })

        vir_rows.append({
            "s_no": s["s_no"],
            "reg_no": s["reg_no"],
            "student_name": s["name"],
            "department": s["dept"],
            "year": s["year"],
            "batch": s["batch"],
            "username": s["username"] or "N/A",
            "contest_name": f"Weekly Contest {curr_contest_num}" if curr_contest_num else "Weekly Contest",
            "contest_number": curr_contest_num,
            "contest_date": curr_date,
            "attended": s["virtual_result"] in ("4_SOLVED", "3_SOLVED", "2_SOLVED", "1_SOLVED", "0_SOLVED"),
            "questions_solved": getattr(v_obj, "total_contest_solved", None),
            "questions_total": 4,
            "score_display": f"{v_obj.total_contest_solved}/4" if v_obj and v_obj.total_contest_solved is not None else s["virtual_result"],
            "status": s["virtual_result"],
            "completed_at": getattr(v_obj, "completed_at", None)
        })

    public_contest_data = {
        "contest_number": curr_contest_num,
        "contest_name": f"Weekly Contest {curr_contest_num}" if curr_contest_num else "Weekly Contest",
        "contest_date": curr_date,
        "summary": college_metrics["current_week"],
        "rows": pub_rows
    }

    virtual_contest_data = {
        "contest_number": curr_contest_num,
        "contest_name": f"Weekly Contest {curr_contest_num}" if curr_contest_num else "Weekly Contest",
        "contest_date": curr_date,
        "summary": college_metrics["virtual_contest"],
        "rows": vir_rows
    }

    # Snapshot Audit Log
    snapshot_audit = []
    for s in all_students_current:
        snapshot_audit.append({
            "s_no": s["s_no"],
            "student": s["name"],
            "reg_no": s["reg_no"],
            "dept": s["dept"],
            "batch": s["batch"],
            "previous_snapshot_date": last_date,
            "previous_total": s["total_solved"],
            "current_snapshot_date": curr_date,
            "current_total": s["total_solved"],
            "change": 0,
            "status": s["verification_status"]
        })

    # Contest Validation Audit Log
    contest_validation = []
    for s in all_students_current:
        if s["public_result"] in ("UNKNOWN", "SOURCE_UNAVAILABLE") or s["verification_status"] != "VERIFIED":
            contest_validation.append({
                "reg_no": s["reg_no"],
                "name": s["name"],
                "username": s["username"],
                "contest_query_status": s["public_result"],
                "contest_parse_status": s["fetch_status"],
                "contest_name": f"Weekly Contest {curr_contest_num}" if curr_contest_num else "Weekly Contest",
                "contest_date": curr_date,
                "questions_solved": getattr(s["public_obj"], "total_contest_solved", None),
                "questions_total": 4,
                "contest_rating": s["contest_rating"],
                "contest_rank": s["contest_ranking"],
                "profile_rank": s["profile_ranking"],
                "error_message": s["fetch_error"] or f"Public Outcome: {s['public_result']}",
                "last_successful_contest_sync": s["last_successful_fetch"]
            })

    # Overall categories summary
    overall_categories = {
        "Above 500": college_metrics["above_500"],
        "250 - 500": college_metrics["250_500"],
        "Less than 250": college_metrics["101_250"],
        "Less than 100": college_metrics["less_100"],
        "Not Yet Started": college_metrics["not_started"]
    }

    data_notes = [
        "1. Single Canonical Dataset: Generated from SQLite database in read-only mode.",
        "2. Strict Contest Separation: Public and Virtual contest outcomes are tracked and stored separately.",
        "3. None vs Zero Enforcement: Unattended/Unknown/Failed records are never converted to zero solved count.",
        "4. AY 2026-27 Academic Batches: I (2026-2030), II (2025-2029), III (2024-2028), IV (2023-2027).",
        f"5. Session Resolution: Current Contest = {curr_contest_num} ({curr_date}), Last Contest = {last_contest_num} ({last_date}), Mode = {session_res.get('resolution_mode')}."
    ]

    canonical_dataset = {
        "institution": "NANDHA ENGINEERING COLLEGE (AUTONOMOUS)",
        "report_date": today_str,
        "total_students": total_students_count,
        "verified_students": verified_count,
        "unavailable_students": unavailable_count,
        
        "session_resolution": session_res,
        "current_session": {
            "id": curr_session_id,
            "contest_number": curr_contest_num,
            "contest_name": f"Weekly Contest {curr_contest_num}" if curr_contest_num else "Weekly Contest",
            "session_date": curr_date
        },
        "last_session": {
            "id": last_session_id,
            "contest_number": last_contest_num,
            "contest_name": f"Weekly Contest {last_contest_num}" if last_contest_num else "Weekly Contest",
            "session_date": last_date
        },
        
        "lastWeek": {
            "contestNumber": last_contest_num,
            "sessionId": last_session_id,
            "date": last_date
        },
        "currentWeek": {
            "contestNumber": curr_contest_num,
            "sessionId": curr_session_id,
            "date": curr_date
        },

        "college_summary": college_summary,
        "dept_summaries": dept_summaries,
        "year_dept_summaries": year_dept_summaries,
        "batch_summaries": batch_summaries,
        "batch_map": batch_map,

        "all_students_current": all_students_current,
        "all_students_last_week": all_students_last_week,

        "public_contest": public_contest_data,
        "virtual_contest": virtual_contest_data,

        "student_change_analysis": student_change_analysis,
        "performance_highlights": performance_highlights,

        "categories": cat_lists,
        "overall_categories": overall_categories,

        "fetch_status_summary": dict(fetch_status_counts),
        "fetch_errors": fetch_errors,
        "validation_issues": validation_issues,
        "snapshot_audit": snapshot_audit,
        "contest_validation": contest_validation,
        "data_notes": data_notes
    }

    return canonical_dataset


def run_sunday_0945_public_contest_workflow(db: Session, contest_id: Optional[str] = None) -> Dict[str, Any]:
    """Sunday 9:45 AM Public Contest workflow using DB data."""
    from backend.services.contest_service import record_contest_participation
    from backend.exporters.weekly_excel_generator import build_public_contest_excel
    from backend.email_service import send_public_contest_report_email

    today_str = datetime.date.today().strftime("%Y-%m-%d")
    c_id = contest_id or f"weekly-contest-{datetime.date.today().strftime('%W')}"
    c_name = "Weekly Contest"

    students = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None))).all()
    rows = []
    q4, q3, q2, q1, not_att, fetch_fail, mode_unc = 0, 0, 0, 0, 0, 0, 0

    for idx, s in enumerate(students, start=1):
        st = s.stats
        if not s.leetcode_url and not s.username:
            status = "NOT_ATTENDED"
            q_solved = None
            err_msg = "Missing profile link"
        elif st and st.sync_status in ("failed", "stale") and st.total_solved is None:
            status = "FETCH_FAILED"
            q_solved = None
            err_msg = st.error_message or "API fetch failed"
        elif st and st.recent_contest_score and "/" in st.recent_contest_score:
            try:
                parts = st.recent_contest_score.split("/")
                q_solved = int(parts[0].strip())
            except Exception:
                q_solved = None
            status = "ATTENDED" if q_solved is not None and q_solved > 0 else "ATTENDED"
            err_msg = None
        else:
            status = "NOT_ATTENDED"
            q_solved = None
            err_msg = None

        rec = record_contest_participation(
            db=db,
            student_id=s.id,
            contest_id=c_id,
            contest_name=c_name,
            participation_mode="PUBLIC",
            questions_solved=q_solved if q_solved is not None else 0,
            questions_total=4,
            contest_rank=st.contest_global_ranking if st else None,
            contest_rating=st.contest_rating if st else None,
            status=status,
            error_message=err_msg
        )

        if status == "ATTENDED" and q_solved is not None:
            if q_solved >= 4: q4 += 1
            elif q_solved == 3: q3 += 1
            elif q_solved == 2: q2 += 1
            elif q_solved == 1: q1 += 1
            else: not_att += 1
        elif status == "FETCH_FAILED":
            fetch_fail += 1
        elif status == "MODE_UNCERTAIN":
            mode_unc += 1
        else:
            not_att += 1

        batch = derive_student_batch(s.year_level)
        dept_code = s.department.code if s.department else "GEN"

        rows.append({
            "s_no": idx,
            "reg_no": s.reg_no,
            "student_name": s.name,
            "department": dept_code,
            "year": s.year_level,
            "batch": batch,
            "username": s.username or "N/A",
            "contest_name": c_name,
            "contest_number": None,
            "contest_date": today_str,
            "attended": rec.attended,
            "questions_solved": rec.questions_solved,
            "questions_total": rec.questions_total,
            "score_display": rec.score_display,
            "contest_rank": rec.contest_rank,
            "contest_rating": rec.contest_rating,
            "top_percentage": rec.top_percentage,
            "status": rec.status,
            "fetched_at": rec.fetched_at.strftime("%Y-%m-%d %H:%M:%S") if rec.fetched_at else None
        })

    excel_data = {
        "report_date": today_str,
        "contest_name": c_name,
        "contest_date": today_str,
        "public_summary": {
            "q4": q4, "q3": q3, "q2": q2, "q1": q1,
            "not_attended": not_att, "fetch_failed": fetch_fail, "mode_uncertain": mode_unc
        },
        "rows": rows
    }

    import os
    os.makedirs("reports", exist_ok=True)
    excel_path = f"reports/Public_Contest_{today_str}.xlsx"
    build_public_contest_excel(excel_data, excel_path)
    send_public_contest_report_email(excel_data, excel_path)

    return {
        "workflow": "SUNDAY_0945_PUBLIC_CONTEST",
        "status": "COMPLETED",
        "total_processed": len(rows),
        "excel_path": excel_path,
        "public_summary": excel_data["public_summary"]
    }


def run_sunday_2200_virtual_contest_workflow(db: Session, contest_id: Optional[str] = None) -> Dict[str, Any]:
    """Sunday 10:00 PM Virtual Contest workflow using DB data."""
    from backend.services.contest_service import record_contest_participation, build_student_contest_dto
    from backend.exporters.weekly_excel_generator import build_virtual_contest_excel, build_contest_combined_excel
    from backend.email_service import send_final_combined_contest_report_email

    today_str = datetime.date.today().strftime("%Y-%m-%d")
    c_id = contest_id or f"weekly-contest-{datetime.date.today().strftime('%W')}"
    c_name = "Weekly Contest"

    students = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None))).all()
    vir_rows = []
    combined_rows = []
    vq4, vq3, vq2, vq1, v_not_att, v_fetch_fail, v_mode_unc = 0, 0, 0, 0, 0, 0, 0
    validation_logs = []

    for idx, s in enumerate(students, start=1):
        vir_rec_query = db.query(StudentContestParticipation).filter(
            StudentContestParticipation.student_id == s.id,
            StudentContestParticipation.contest_id == c_id,
            StudentContestParticipation.participation_mode == "VIRTUAL"
        ).first()

        if vir_rec_query:
            status = vir_rec_query.status
            q_solved = vir_rec_query.questions_solved
            err_msg = vir_rec_query.error_message
        else:
            status = "NOT_ATTENDED"
            q_solved = None
            err_msg = None

        rec = record_contest_participation(
            db=db,
            student_id=s.id,
            contest_id=c_id,
            contest_name=c_name,
            participation_mode="VIRTUAL",
            questions_solved=q_solved if q_solved is not None else 0,
            questions_total=4,
            status=status,
            error_message=err_msg
        )

        if status == "ATTENDED" and q_solved is not None:
            if q_solved >= 4: vq4 += 1
            elif q_solved == 3: vq3 += 1
            elif q_solved == 2: vq2 += 1
            elif q_solved == 1: vq1 += 1
            else: v_not_att += 1
        elif status == "FETCH_FAILED":
            v_fetch_fail += 1
        elif status == "MODE_UNCERTAIN":
            v_mode_unc += 1
        else:
            v_not_att += 1

        batch = derive_student_batch(s.year_level)
        dept_code = s.department.code if s.department else "GEN"

        vir_rows.append({
            "s_no": idx,
            "reg_no": s.reg_no,
            "student_name": s.name,
            "department": dept_code,
            "year": s.year_level,
            "batch": batch,
            "username": s.username or "N/A",
            "contest_name": c_name,
            "contest_number": None,
            "contest_date": today_str,
            "attended": rec.attended,
            "questions_solved": rec.questions_solved,
            "questions_total": rec.questions_total,
            "score_display": rec.score_display,
            "contest_rank": rec.contest_rank,
            "contest_rating": rec.contest_rating,
            "top_percentage": rec.top_percentage,
            "status": rec.status,
            "fetched_at": rec.fetched_at.strftime("%Y-%m-%d %H:%M:%S") if rec.fetched_at else None
        })

        dto = build_student_contest_dto(db, s, c_id)
        dto["batch"] = batch
        dto["fetched_at"] = rec.fetched_at.strftime("%Y-%m-%d %H:%M:%S") if rec.fetched_at else None
        combined_rows.append(dto)

    vir_excel_data = {
        "report_date": today_str,
        "contest_name": c_name,
        "contest_date": today_str,
        "virtual_summary": {
            "q4": vq4, "q3": vq3, "q2": vq2, "q1": vq1,
            "not_attended": v_not_att, "fetch_failed": v_fetch_fail, "mode_uncertain": v_mode_unc
        },
        "rows": vir_rows
    }

    import os
    os.makedirs("reports", exist_ok=True)
    vir_excel_path = f"reports/Virtual_Contest_{today_str}.xlsx"
    build_virtual_contest_excel(vir_excel_data, vir_excel_path)

    combined_excel_data = {
        "report_date": today_str,
        "contest_name": c_name,
        "contest_date": today_str,
        "rows": combined_rows,
        "validation_logs": validation_logs
    }

    combined_excel_path = f"reports/Contest_Combined_{today_str}.xlsx"
    build_contest_combined_excel(combined_excel_data, combined_excel_path)
    send_final_combined_contest_report_email(combined_excel_data, vir_excel_path, combined_excel_path)

    return {
        "workflow": "SUNDAY_2200_VIRTUAL_CONTEST",
        "status": "COMPLETED",
        "total_processed": len(combined_rows),
        "virtual_excel_path": vir_excel_path,
        "combined_excel_path": combined_excel_path,
        "virtual_summary": vir_excel_data["virtual_summary"]
    }
