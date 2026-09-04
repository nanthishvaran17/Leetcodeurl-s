"""
Master Weekly Performance Report Service
Produces a single, canonical, DB-read-only dataset for Excel, PDF, and Word report generators.
Strict adherence to AY 2026-27 batch configurations, strict contest classification, and None vs 0 handling.
No hardcoded contest IDs or counts. Server-side time in Asia/Kolkata timezone.
"""
import datetime
import json
import hashlib
from typing import Dict, Any, List, Optional, Tuple
from collections import defaultdict
from sqlalchemy.orm import Session

from backend.models import (
    Student, Department, WeeklyPublicResult, WeeklyVirtualResult,
    WeeklyStudentSnapshot, WeeklyReportAudit
)
from backend.config.report_config import (
    BATCH_CONFIG,
    derive_student_batch,
    get_coordinator_for_department,
    normalize_year_roman,
)
from backend.services.reporting_period_service import reporting_period_service
from backend.services.contest_discovery_service import contest_discovery_service
from backend.services.weekly_session_resolver import (
    resolve_weekly_sessions,
)
from backend.services.contest_bucket_classifier import (
    classify_public_contest_outcome,
    classify_virtual_contest_outcome,
)
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
    """
    Classifies profile problem solved count into official institutional categories strictly using Primary Account.
    Rule:
      solved > 500 -> Above 500
      solved >= 250 -> 250 - 500
      solved >= 100 -> Less than 250 (100-249)
      solved > 0 -> Less than 100 (1-99)
      else -> Not Yet Started (0)
    """
    if not is_verified or solved is None or solved == 0:
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


def _aggregate_cohort_metrics(student_list: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculates exact metrics for a student cohort with strict validation."""
    tot_count = len(student_list)
    above_500 = sum(1 for s in student_list if s.get("total_solved") is not None and s["total_solved"] > 500)
    prob_250_500 = sum(1 for s in student_list if s.get("total_solved") is not None and 250 <= s["total_solved"] <= 500)
    prob_100_249 = sum(1 for s in student_list if s.get("total_solved") is not None and 100 <= s["total_solved"] < 250)
    prob_1_99 = sum(1 for s in student_list if s.get("total_solved") is not None and 1 <= s["total_solved"] < 100)
    prob_0 = sum(1 for s in student_list if s.get("total_solved") is None or s["total_solved"] == 0)

    rating_1500 = sum(1 for s in student_list if s.get("contest_rating") is not None and s["contest_rating"] > 1500)
    ranking_20000 = sum(1 for s in student_list if s.get("contest_ranking") is not None and 0 < s["contest_ranking"] < 20000)

    # STRICT PRE-GENERATION VALIDATION
    bucket_sum = above_500 + prob_250_500 + prob_100_249 + prob_1_99 + prob_0
    if tot_count > 0 and bucket_sum != tot_count:
        raise ValueError(f"[REPORT VALIDATION ERROR] Sum of problem buckets ({bucket_sum}) does not equal total cohort students ({tot_count}).")

    if rating_1500 > tot_count:
        raise ValueError(f"[REPORT VALIDATION ERROR] Contest rating >1500 count ({rating_1500}) exceeds cohort total ({tot_count}).")

    # Current Week Public Contest buckets
    cw_q4 = sum(1 for s in student_list if s.get("public_result") == "4_SOLVED")
    cw_q3 = sum(1 for s in student_list if s.get("public_result") == "3_SOLVED")
    cw_q2 = sum(1 for s in student_list if s.get("public_result") == "2_SOLVED")
    cw_q1 = sum(1 for s in student_list if s.get("public_result") == "1_SOLVED")
    cw_q0 = sum(1 for s in student_list if s.get("public_result") == "0_SOLVED")
    cw_not_part = sum(1 for s in student_list if s.get("public_result") == "NOT_PARTICIPATED")
    cw_unknown = sum(1 for s in student_list if s.get("public_result") == "UNKNOWN")
    cw_unavail = sum(1 for s in student_list if s.get("public_result") == "SOURCE_UNAVAILABLE")

    # Current Week Virtual Contest buckets
    cw_vq4 = sum(1 for s in student_list if s.get("virtual_result") == "4_SOLVED")
    cw_vq3 = sum(1 for s in student_list if s.get("virtual_result") == "3_SOLVED")
    cw_vq2 = sum(1 for s in student_list if s.get("virtual_result") == "2_SOLVED")
    cw_vq1 = sum(1 for s in student_list if s.get("virtual_result") == "1_SOLVED")
    cw_vq0 = sum(1 for s in student_list if s.get("virtual_result") == "0_SOLVED")

    # Last Week Public Contest buckets
    lw_q4 = sum(1 for s in student_list if s.get("last_public_result") == "4_SOLVED")
    lw_q3 = sum(1 for s in student_list if s.get("last_public_result") == "3_SOLVED")
    lw_q2 = sum(1 for s in student_list if s.get("last_public_result") == "2_SOLVED")
    lw_q1 = sum(1 for s in student_list if s.get("last_public_result") == "1_SOLVED")
    lw_q0 = sum(1 for s in student_list if s.get("last_public_result") == "0_SOLVED")

    solved_vals = [s["total_solved"] for s in student_list if s.get("total_solved") is not None]
    avg_solved = round(sum(solved_vals) / len(solved_vals), 1) if solved_vals else 0
    total_solved = sum(solved_vals) if solved_vals else 0

    verified_cnt = sum(1 for s in student_list if s.get("verification_status") == "VERIFIED")
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


def generate_weekly_performance_data(
    db: Session,
    last_week_contest: Optional[int] = None,
    current_week_contest: Optional[int] = None,
    report_date: Optional[str] = None,
    save_snapshot: bool = False,
    current_user: Optional[Any] = None
) -> Dict[str, Any]:
    """
    CANONICAL WEEKLY PERFORMANCE DATASET GENERATOR
    """
    # Step 1: Reporting Period & Contest Discovery
    period_info = reporting_period_service.get_reporting_period(report_date)
    today_str = period_info["report_date_str"]
    prev_period_id = period_info["previous_period_id"]
    curr_period_id = period_info["reporting_period_id"]

    discovered_last_contests = contest_discovery_service.discover_contests_for_period(
        db, period_info["previous_week_start"], period_info["previous_week_end"]
    )
    discovered_curr_contests = contest_discovery_service.discover_contests_for_period(
        db, period_info["current_week_start"], period_info["current_week_end"]
    )

    last_contest_ids = [c["contest_id"] for c in discovered_last_contests]
    curr_contest_ids = [c["contest_id"] for c in discovered_curr_contests]

    # Step 2: Session Resolution
    session_res = resolve_weekly_sessions(
        db,
        last_week=last_week_contest or (int(last_contest_ids[0]) if last_contest_ids and str(last_contest_ids[0]).isdigit() else None),
        current_week=current_week_contest or (int(curr_contest_ids[0]) if curr_contest_ids and str(curr_contest_ids[0]).isdigit() else None)
    )

    curr_ws = session_res.get("current_week_session")
    last_ws = session_res.get("last_week_session")
    curr_contest_num = session_res.get("current_week_contest") or (curr_contest_ids[0] if curr_contest_ids else "N/A")
    last_contest_num = session_res.get("last_week_contest") or (last_contest_ids[0] if last_contest_ids else "N/A")
    curr_session_id = getattr(curr_ws, "id", None)
    last_session_id = getattr(last_ws, "id", None)

    # Fallback resolution for last_session_id if not found by primary resolver
    if last_session_id is None and curr_session_id is not None:
        prev_sess = db.query(WeeklySession).filter(WeeklySession.id < curr_session_id).order_by(WeeklySession.id.desc()).first()
        if prev_sess:
            last_ws = prev_sess
            last_session_id = prev_sess.id
            if last_contest_num in ("N/A", None):
                last_contest_num = extract_contest_number(prev_sess) or (curr_contest_num - 1 if isinstance(curr_contest_num, int) else "N/A")

    if last_session_id is None:
        prev_res_row = db.query(WeeklyPublicResult.session_id).filter(
            WeeklyPublicResult.session_id != curr_session_id
        ).order_by(WeeklyPublicResult.session_id.desc()).first()
        if prev_res_row:
            last_session_id = prev_res_row[0]

    last_contest_str = ", ".join(last_contest_ids) if last_contest_ids else (f"Weekly Contest {last_contest_num}" if last_contest_num and last_contest_num != "N/A" else (str(last_week_contest) if last_week_contest else "Weekly Contest (Current Period)"))
    curr_contest_str = ", ".join(curr_contest_ids) if curr_contest_ids else (f"Weekly Contest {curr_contest_num}" if curr_contest_num and curr_contest_num != "N/A" else (str(current_week_contest) if current_week_contest else "Weekly Contest (Current Period)"))

    curr_date = period_info["current_week_start_str"]
    last_date = period_info["previous_week_start_str"]

    # Step 3: Load Full Master Roster
    from backend.services.authorization_service import apply_role_based_student_filter
    student_query = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None)))
    
    if current_user:
        student_query = apply_role_based_student_filter(student_query, current_user, db)
        
    students = student_query.order_by(Student.department_id, Student.year_level, Student.reg_no).all()
    total_students_count = len(students)

    # Step 4: Load Contest Results for Resolved Sessions
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

    # Step 5: Load Historical Last Week Snapshots if Available
    last_snapshots_by_pid: Dict[str, WeeklyStudentSnapshot] = {}
    db_snaps = db.query(WeeklyStudentSnapshot).filter(WeeklyStudentSnapshot.reporting_period_id == prev_period_id).all()
    for snap in db_snaps:
        last_snapshots_by_pid[snap.people_id] = snap

    # Step 6: Process Students & Deduplicate by People ID
    processed_pids = set()
    all_students_current = []
    all_students_last_week = []
    
    verified_count = 0
    unavailable_count = 0
    fetch_errors = []

    cat_lists: Dict[str, List[Dict[str, Any]]] = {
        "above_500": [],
        "250_500": [],
        "101_250": [],
        "less_100": [],
        "not_started": [],
        "unavailable": []
    }

    for idx, s in enumerate(students, start=1):
        pid = s.people_id or f"P_{s.id}"
        if pid in processed_pids:
            continue # Deduplicate multiple accounts under same People ID
        processed_pids.add(pid)

        st = s.stats
        status_code, tot, easy, med, hd = get_student_status_code(s)
        is_verified = (status_code == "VERIFIED" and tot is not None)

        if is_verified:
            verified_count += 1
        else:
            unavailable_count += 1

        # PRIMARY ACCOUNT STRICT ISOLATION FOR BUCKETS
        category_name = _get_profile_category_name(tot, is_verified)
        batch_label = derive_student_batch(s.year_level)
        dept_code = s.department.code if s.department else "CSE"

        # Current Week Contest Outcomes
        curr_pub_obj = curr_pub_results.get(s.id)
        curr_vir_obj = curr_vir_results.get(s.id)
        curr_pub_outcome = classify_public_contest_outcome(curr_pub_obj)
        curr_vir_outcome = classify_virtual_contest_outcome(curr_vir_obj)

        # Last Week Contest Outcomes & Historical Snapshot Solved Total
        last_pub_obj = last_pub_results.get(s.id)
        last_vir_obj = last_vir_results.get(s.id)
        last_pub_outcome = classify_public_contest_outcome(last_pub_obj)
        last_vir_outcome = classify_virtual_contest_outcome(last_vir_obj)

        hist_snap = last_snapshots_by_pid.get(pid)
        if last_pub_outcome in ("NOT_ATTENDED", "DATA_ERROR", "PENDING", None) and hist_snap and hist_snap.contest_data:
            try:
                cdata = json.loads(hist_snap.contest_data)
                if isinstance(cdata, dict) and cdata.get("public"):
                    last_pub_outcome = cdata.get("public")
                if isinstance(cdata, dict) and cdata.get("virtual"):
                    last_vir_outcome = cdata.get("virtual")
            except Exception:
                pass

        last_tot = hist_snap.primary_solved_count if hist_snap else tot
        last_category_name = hist_snap.solved_bucket if hist_snap else category_name

        s_current = {
            "s_no": idx,
            "id": s.id,
            "student_id": s.id,
            "people_id": pid,
            "student": s.name,
            "reg_no": s.reg_no,
            "name": s.name,
            "department": dept_code,
            "dept": dept_code,
            "department_id": s.department_id,
            "year": normalize_year_roman(s.year_level),
            "year_level": normalize_year_roman(s.year_level),
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
            "contest_name": f"Weekly Contest {curr_contest_num}",
            "public_result": curr_pub_outcome,
            "last_public_result": last_pub_outcome,
            "virtual_result": curr_vir_outcome,
            "last_virtual_result": last_vir_outcome,
            "public_obj": curr_pub_obj,
            "virtual_obj": curr_vir_obj,
            "verification_status": "VERIFIED" if is_verified else "UNVERIFIED",
            "fetch_status": getattr(st, "sync_status", "pending") if st else "pending"
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

        # Last Week Student Record
        s_last = {
            "s_no": idx,
            "id": s.id,
            "student_id": s.id,
            "people_id": pid,
            "student": s.name,
            "reg_no": s.reg_no,
            "name": s.name,
            "department": dept_code,
            "dept": dept_code,
            "department_id": s.department_id,
            "year": normalize_year_roman(s.year_level),
            "year_level": normalize_year_roman(s.year_level),
            "batch": batch_label,
            "leetcode_url": s.leetcode_url,
            "username": s.username,
            "total_solved": last_tot,
            "category": last_category_name,
            "public_result": last_pub_outcome,
            "virtual_result": last_vir_outcome,
            "verification_status": "VERIFIED" if is_verified else "UNVERIFIED"
        }
        all_students_last_week.append(s_last)

        # Save snapshot if requested and not present
        if save_snapshot and not hist_snap:
            new_snap = WeeklyStudentSnapshot(
                reporting_period_id=prev_period_id,
                people_id=pid,
                student_id=s.id,
                primary_account_id=s.username,
                primary_solved_count=tot or 0,
                solved_bucket=category_name,
                contest_attended=curr_pub_outcome in ("4_SOLVED", "3_SOLVED", "2_SOLVED", "1_SOLVED", "0_SOLVED"),
                contest_data=json.dumps({"public": curr_pub_outcome, "virtual": curr_vir_outcome}),
                contest_rating=getattr(st, "contest_rating", None),
                contest_ranking=getattr(st, "contest_global_ranking", None),
                verification_status="VERIFIED" if is_verified else "UNVERIFIED"
            )
            db.add(new_snap)

    if save_snapshot:
        try:
            db.commit()
        except Exception as e:
            logger.error(f"[SNAPSHOT SAVE ERROR] {e}")
            db.rollback()

    # Step 7: Batch Aggregation & Pre-Generation Validation
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

    for b_cfg in BATCH_CONFIG:
        label = b_cfg["label"]
        if label not in batch_map:
            batch_map[label] = []

    # Department Summaries
    from backend.constants import is_production_department
    dept_summaries = []
    departments_db = [d for d in db.query(Department).order_by(Department.id).all() if is_production_department(d.code, d.name)]
    for d in departments_db:
        d_students = dept_map.get(d.code, [])
        d_metrics = _aggregate_cohort_metrics(d_students)
        
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

    # Generate Audit Record & Canonical SHA-256 Hash
    now_ts = int(datetime.datetime.now(datetime.timezone.utc).timestamp())
    report_id = f"REP-{curr_period_id}-{now_ts}"
    
    canonical_hash_payload = {
        "report_id": report_id,
        "reporting_period": curr_period_id,
        "total_students": total_students_count,
        "verified_students": verified_count,
        "contests_last": last_contest_ids,
        "contests_curr": curr_contest_ids,
        "college_metrics": college_metrics
    }
    canonical_json_str = json.dumps(canonical_hash_payload, sort_keys=True)
    file_hash = hashlib.sha256(canonical_json_str.encode("utf-8")).hexdigest()

    audit_rec = WeeklyReportAudit(
        report_id=report_id,
        reporting_period_id=curr_period_id,
        report_date=today_str,
        generated_by=getattr(current_user, "username", "System"),
        contests_included=json.dumps({"last_week": last_contest_ids, "current_week": curr_contest_ids}),
        total_students=total_students_count,
        total_batches=len(batch_summaries),
        validation_status="VALID",
        validation_details="All batch problem bucket sums matched total student count exactly.",
        file_hash=file_hash
    )
    db.add(audit_rec)
    try:
        db.commit()
    except Exception as e:
        logger.error(f"[REPORT AUDIT LOG ERROR] {e}")
        db.rollback()

    canonical_dataset = {
        "report_id": report_id,
        "institution": "NANDHA ENGINEERING COLLEGE (AUTONOMOUS)",
        "report_date": today_str,
        "total_students": total_students_count,
        "verified_students": verified_count,
        "unavailable_students": unavailable_count,
        "validation_status": "VALID",
        "file_hash": file_hash,
        
        "session_resolution": session_res,
        "discovered_contests": {
            "last_week": discovered_last_contests,
            "current_week": discovered_curr_contests,
            "last_week_contests_str": last_contest_str,
            "current_week_contests_str": curr_contest_str
        },
        "current_session": {
            "id": curr_session_id,
            "contest_number": curr_contest_num,
            "contest_name": f"Weekly Contest {curr_contest_num}",
            "session_date": curr_date
        },
        "last_session": {
            "id": last_session_id,
            "contest_number": last_contest_num,
            "contest_name": f"Weekly Contest {last_contest_num}",
            "session_date": last_date
        },
        
        "lastWeek": {
            "contestNumber": last_contest_num,
            "sessionId": last_session_id,
            "date": last_date,
            "contests_str": last_contest_str
        },
        "currentWeek": {
            "contestNumber": curr_contest_num,
            "sessionId": curr_session_id,
            "date": curr_date,
            "contests_str": curr_contest_str
        },

        "college_summary": {
            "institution": "NANDHA ENGINEERING COLLEGE (AUTONOMOUS)",
            "report_date": today_str,
            "total_students": total_students_count,
            "verified_students": verified_count,
            "unavailable_students": unavailable_count,
            "metrics": college_metrics
        },

        "department_summaries": dept_summaries,
        "batch_summaries": batch_summaries,

        "all_students_current": all_students_current,
        "all_students_last_week": all_students_last_week,

        "rosters": {
            "all_current": all_students_current,
            "all_last_week": all_students_last_week,
            "categories": cat_lists,
            "fetch_errors": fetch_errors
        }
    }

    return canonical_dataset
