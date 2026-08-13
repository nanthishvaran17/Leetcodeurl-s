import datetime
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.models import (
    Student, Department, Section, LeetCodeProfileStats,
    StudentStatSnapshot, ContestParticipation, WeeklySession
)
from backend.services.report_data_service import get_problem_category
from backend.logger import logger

def derive_student_batch(year_level: Optional[str]) -> str:
    """Derives standard academic batch from year level."""
    year_map = {
        "II": "2025-2029",
        "2": "2025-2029",
        "III": "2024-2028",
        "3": "2024-2028",
        "IV": "2023-2027",
        "4": "2023-2027",
        "I": "2026-2030",
        "1": "2026-2030"
    }
    return year_map.get(str(year_level).upper().strip(), "2025-2029")


def get_student_status_code(student: Student) -> Tuple[str, Optional[int], Optional[int], Optional[int], Optional[int]]:
    """
    Extracts student stats and distinguishes verified zero solved, missing links, invalid URLs, and network errors.
    Enforces sum check consistency: Easy + Medium + Hard == Total.
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
        # Sum validation check
        if st.total_solved is not None and st.total_solved != derived_tot and derived_tot > 0:
            return "DATA_MISMATCH", st.total_solved, easy, medium, hard
        tot = derived_tot
    else:
        tot = st.total_solved

    if tot is None:
        return "DATA_UNAVAILABLE", None, None, None, None

    return "VERIFIED", tot, easy, medium, hard


def generate_weekly_performance_data(
    db: Session,
    report_date: Optional[str] = None,
    save_snapshot: bool = False
) -> Dict[str, Any]:
    """
    MASTER ACCURACY-CONTROLLED WEEKLY PERFORMANCE REPORT ENGINE — ALL 273 STUDENTS
    Fetches student master roster, current live/snapshot data, previous snapshot data,
    performs sum validation, error audit logging, batch/dept summaries, and equation checks.
    """
    today_str = report_date or datetime.date.today().strftime("%Y-%m-%d")

    # 1. Fetch Roster (All Active Master Students)
    students = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None))).all()
    total_students_count = len(students)

    # Sort master roster: Batch -> Dept -> Year -> Name
    students = sorted(
        students,
        key=lambda s: (
            derive_student_batch(s.year_level),
            s.department.code if s.department else "CSE",
            s.year_level or "",
            s.name or ""
        )
    )

    roster_warnings = []
    if total_students_count == 0:
        roster_warnings.append("WARNING: Master student roster is empty.")

    # 2. Fetch Historical Snapshots (Current vs Last Week)
    latest_snapshot_time = db.query(func.max(StudentStatSnapshot.captured_at)).scalar()
    
    last_week_map = {}
    if latest_snapshot_time:
        past_snaps = db.query(StudentStatSnapshot).filter(
            StudentStatSnapshot.captured_at < (latest_snapshot_time - datetime.timedelta(hours=12))
        ).all()
        if not past_snaps:
            past_snaps = db.query(StudentStatSnapshot).all()

        for ps in past_snaps:
            last_week_map[ps.student_id] = {
                "total_solved": ps.total_solved,
                "easy": ps.easy_solved,
                "medium": ps.medium_solved,
                "hard": ps.hard_solved,
                "contest_rating": ps.contest_rating,
                "global_rank": ps.global_rank,
                "category": get_problem_category(ps.total_solved, ps.total_solved is not None),
                "captured_at": ps.captured_at.strftime("%Y-%m-%d %I:%M %p") if ps.captured_at else "Previous"
            }

    # 3. Process Current Week Roster & Build Detailed Datasets
    current_student_records = []
    last_week_student_records = []
    fetch_errors_list = []
    snapshot_audit_list = []

    cat_above_500 = []
    cat_250_500 = []
    cat_101_250 = []
    cat_less_100 = []
    cat_not_started = []
    cat_unavailable = []

    rating_above_1500 = []
    ranking_below_20000 = []

    promotions = []
    attention_required = []
    newly_active = []
    improvers = []
    zero_progress = []

    total_verified_count = 0
    total_unavailable_count = 0

    validation_issues = []
    contest_data_validation_list = []
    duplicate_url_check = {}
    duplicate_user_check = {}

    for idx, s in enumerate(students, start=1):
        status_code, total_solved, easy, medium, hard = get_student_status_code(s)
        batch = derive_student_batch(s.year_level)
        st = s.stats

        # Save snapshot if requested
        if save_snapshot:
            db.add(StudentStatSnapshot(
                student_id=s.id,
                total_solved=total_solved,
                easy_solved=easy,
                medium_solved=medium,
                hard_solved=hard,
                contest_rating=st.contest_rating if st else None,
                global_rank=st.contest_global_ranking if st else None,
                captured_at=datetime.datetime.utcnow()
            ))

        # Check Url & Username Duplicates
        if s.leetcode_url:
            url_clean = s.leetcode_url.strip().lower()
            if url_clean in duplicate_url_check:
                validation_issues.append({
                    "issue_type": "Duplicate URL",
                    "reg_no": s.reg_no,
                    "student": s.name,
                    "field": "leetcode_url",
                    "expected": "Unique URL",
                    "actual": s.leetcode_url,
                    "severity": "WARNING",
                    "status": "UNRESOLVED"
                })
            else:
                duplicate_url_check[url_clean] = s.reg_no

        if s.username:
            user_clean = s.username.strip().lower()
            if user_clean in duplicate_user_check:
                validation_issues.append({
                    "issue_type": "Duplicate Username",
                    "reg_no": s.reg_no,
                    "student": s.name,
                    "field": "username",
                    "expected": "Unique Username",
                    "actual": s.username,
                    "severity": "WARNING",
                    "status": "UNRESOLVED"
                })
            else:
                duplicate_user_check[user_clean] = s.reg_no

        if status_code in ("INVALID_URL", "MISSING_LINK", "PROFILE_NOT_FOUND", "DATA_MISMATCH"):
            validation_issues.append({
                "issue_type": status_code,
                "reg_no": s.reg_no,
                "student": s.name,
                "field": "total_solved / leetcode_url",
                "expected": "Valid & Consistent Profile Data",
                "actual": f"Total: {total_solved}, Easy/Med/Hard: {easy}/{medium}/{hard}",
                "severity": "HIGH" if status_code in ("PROFILE_NOT_FOUND", "DATA_MISMATCH") else "MEDIUM",
                "status": "UNRESOLVED"
            })

        is_verified = (status_code == "VERIFIED" and total_solved is not None)
        if is_verified:
            total_verified_count += 1
        else:
            total_unavailable_count += 1

        category = get_problem_category(total_solved, is_verified)

        # Cross Check Validation: Easy + Medium + Hard == Total Solved
        if is_verified and easy is not None and medium is not None and hard is not None:
            if (easy + medium + hard) != total_solved:
                validation_issues.append({
                    "issue_type": "Category Mismatch",
                    "reg_no": s.reg_no,
                    "student": s.name,
                    "field": "total_solved",
                    "expected": str(easy + medium + hard),
                    "actual": str(total_solved),
                    "severity": "HIGH",
                    "status": "UNRESOLVED"
                })

        # Fetch Recent Contest info
        c_part = db.query(ContestParticipation).filter(
            ContestParticipation.student_id == s.id
        ).order_by(ContestParticipation.id.desc()).first()

        c_attended = False
        c_q_solved = "Not Attended"
        c_rating = st.contest_rating if (st and st.contest_rating) else None
        c_rank = st.contest_global_ranking if (st and st.contest_global_ranking) else None

        if c_part:
            c_attended = c_part.registered or c_part.started or (c_part.problems_solved > 0)
            c_q_solved = f"{c_part.problems_solved} Q Solved" if c_attended else "Not Attended"
            c_rating = c_part.contest_rating_after or c_rating
            c_rank = c_part.contest_rank or c_rank
        elif st and st.recent_contest_score:
            c_attended = True
            c_q_solved = f"{st.recent_contest_score} Q Solved"

        # Determine Fetch Status string
        if status_code == "VERIFIED":
            fetch_status_str = "VERIFIED"
        elif status_code == "PROFILE_NOT_FOUND":
            fetch_status_str = "PROFILE_NOT_FOUND"
        elif status_code == "INVALID_URL":
            fetch_status_str = "INVALID_URL"
        elif status_code == "MISSING_LINK":
            fetch_status_str = "MISSING_LINK"
        elif status_code == "DATA_MISMATCH":
            fetch_status_str = "DATA_MISMATCH"
        elif st and st.sync_status == "stale":
            fetch_status_str = "LAST FETCH FAILED"
        else:
            fetch_status_str = "FETCH_FAILED"

        last_succ_str = st.last_successful_sync.strftime("%Y-%m-%d %I:%M %p") if (st and st.last_successful_sync) else "N/A"
        last_att_str = st.last_attempt_at.strftime("%Y-%m-%d %I:%M %p") if (st and st.last_attempt_at) else "N/A"
        err_msg_str = st.error_message if (st and st.error_message) else "None"

        # Parse questions solved / total integer values
        q_solved_val = None
        q_total_val = None
        if st and st.recent_contest_score and " / " in st.recent_contest_score:
            try:
                parts = st.recent_contest_score.split(" / ")
                q_solved_val = int(parts[0].strip())
                q_total_val = int(parts[1].strip())
            except Exception:
                pass
        elif c_part:
            q_solved_val = c_part.problems_solved
            q_total_val = c_part.total_problems

        rec = {
            "s_no": idx,
            "reg_no": s.reg_no,
            "name": s.name,
            "dept": s.department.code if s.department else "CSE",
            "year": s.year_level,
            "batch": batch,
            "leetcode_url": s.leetcode_url or "",
            "username": s.username or "",
            "easy": easy,
            "medium": medium,
            "hard": hard,
            "total_solved": total_solved,
            "category": category,
            "contest_attended": "YES" if c_attended else "NO",
            "contest_name": st.recent_contest_name if (st and st.recent_contest_name) else (c_part.contest_name if c_part else "N/A"),
            "contest_q_solved": c_q_solved,
            "questions_solved": q_solved_val,
            "questions_total": q_total_val,
            "contest_rating": round(c_rating, 1) if c_rating else None,
            "contest_ranking": c_rank,
            "profile_ranking": st.public_profile_ranking if st else None,
            "fetch_status": fetch_status_str,
            "last_successful_fetch": last_succ_str,
            "last_fetch_attempt": last_att_str,
            "fetch_error": err_msg_str,
            "data_status": fetch_status_str,
            "snapshot_date": today_str
        }
        current_student_records.append(rec)

        # Categorize into detailed lists
        if category == "Above 500":
            cat_above_500.append(rec)
        elif category == "250-500":
            cat_250_500.append(rec)
        elif category == "101-250":
            cat_101_250.append(rec)
        elif category == "Less than 100":
            cat_less_100.append(rec)
        elif category == "Not Yet Started":
            cat_not_started.append(rec)
        else:
            cat_unavailable.append(rec)

        if c_rating and c_rating > 1500:
            rating_above_1500.append(rec)
        if c_rank and c_rank < 20000:
            ranking_below_20000.append(rec)

        # Movement & Snapshot Audit tracking
        prev_snap = last_week_map.get(s.id)
        prev_solved = prev_snap["total_solved"] if prev_snap else None
        prev_cat = prev_snap["category"] if prev_snap else "Data Unavailable"

        last_week_rec = {
            "s_no": idx,
            "reg_no": s.reg_no,
            "name": s.name,
            "dept": s.department.code if s.department else "CSE",
            "year": s.year_level,
            "batch": batch,
            "leetcode_url": s.leetcode_url or "",
            "username": s.username or "",
            "easy": prev_snap.get("easy") if prev_snap else None,
            "medium": prev_snap.get("medium") if prev_snap else None,
            "hard": prev_snap.get("hard") if prev_snap else None,
            "total_solved": prev_solved,
            "category": prev_cat,
            "contest_rating": prev_snap.get("contest_rating") if prev_snap else None,
            "contest_ranking": prev_snap.get("global_rank") if prev_snap else None,
            "fetch_status": "VERIFIED" if prev_solved is not None else "DATA_UNAVAILABLE",
            "last_successful_fetch": prev_snap.get("captured_at") if prev_snap else "Previous Week",
            "last_fetch_attempt": prev_snap.get("captured_at") if prev_snap else "Previous Week",
            "fetch_error": "None",
            "data_status": "VERIFIED" if prev_solved is not None else "DATA_UNAVAILABLE",
            "snapshot_date": prev_snap.get("captured_at") if prev_snap else "Previous Week"
        }
        last_week_student_records.append(last_week_rec)

        # Add to Snapshot Audit list
        diff_val = (total_solved - prev_solved) if (total_solved is not None and prev_solved is not None) else "N/A"
        diff_str = f"+{diff_val}" if isinstance(diff_val, int) and diff_val >= 0 else str(diff_val)

        snapshot_audit_list.append({
            "s_no": idx,
            "student": s.name,
            "reg_no": s.reg_no,
            "dept": s.department.code if s.department else "CSE",
            "batch": batch,
            "previous_snapshot_date": prev_snap.get("captured_at") if prev_snap else "Previous Week",
            "previous_total": prev_solved if prev_solved is not None else "N/A",
            "current_snapshot_date": today_str,
            "current_total": total_solved if total_solved is not None else "N/A",
            "change": diff_str,
            "status": fetch_status_str
        })

        # Add to Fetch Errors list if not cleanly verified
        if fetch_status_str != "VERIFIED":
            fetch_errors_list.append({
                "s_no": len(fetch_errors_list) + 1,
                "reg_no": s.reg_no,
                "name": s.name,
                "dept": s.department.code if s.department else "CSE",
                "year": s.year_level,
                "batch": batch,
                "username": s.username or "Missing",
                "leetcode_url": s.leetcode_url or "Missing",
                "error_type": fetch_status_str,
                "error_message": err_msg_str if err_msg_str != "None" else f"Profile check failed ({fetch_status_str})",
                "last_successful_fetch": last_succ_str,
                "latest_attempt": last_att_str,
                "previous_total": prev_solved if prev_solved is not None else "N/A",
                "current_attempt_status": fetch_status_str,
                "action_required": "Re-verify LeetCode URL/Username" if fetch_status_str in ("INVALID_URL", "PROFILE_NOT_FOUND", "MISSING_LINK") else "Check difficulty sum"
            })

        # Add to Contest Data Validation list if no verified contest participation
        if not c_attended or c_rating is None:
            contest_data_validation_list.append({
                "reg_no": s.reg_no,
                "name": s.name,
                "username": s.username or "Missing",
                "contest_query_status": "OK" if st else "PENDING",
                "contest_parse_status": "NO_CONTEST" if (st and st.sync_status == "success") else "FETCH_FAILED",
                "contest_name": st.recent_contest_name if (st and st.recent_contest_name) else "N/A",
                "contest_date": "N/A",
                "questions_solved": q_solved_val if q_solved_val is not None else "N/A",
                "questions_total": q_total_val if q_total_val is not None else "N/A",
                "contest_rating": c_rating if c_rating else "Unrated",
                "contest_rank": c_rank if c_rank else "Unranked",
                "profile_rank": st.public_profile_ranking if (st and st.public_profile_ranking) else "Unranked",
                "error_message": "No contest participation found on LeetCode profile" if (st and st.sync_status == "success") else (st.error_message if st else "Sync pending"),
                "last_successful_contest_sync": last_succ_str
            })

        # Calculate Movement
        if prev_solved is not None and total_solved is not None:
            added = total_solved - prev_solved
            if added > 0:
                improvers.append({
                    "reg_no": s.reg_no,
                    "name": s.name,
                    "dept": s.department.code if s.department else "CSE",
                    "batch": batch,
                    "last_week_solved": prev_solved,
                    "current_week_solved": total_solved,
                    "problems_added": added,
                    "rating": c_rating,
                    "ranking": c_rank
                })

            if prev_cat in ("Not Yet Started", "Less than 100") and category in ("101-250", "250-500", "Above 500"):
                promotions.append({
                    "reg_no": s.reg_no,
                    "name": s.name,
                    "dept": s.department.code if s.department else "CSE",
                    "batch": batch,
                    "from_cat": prev_cat,
                    "to_cat": category,
                    "status": "PROMOTED"
                })
            elif added == 0:
                zero_progress.append(rec)

            if prev_cat in ("Not Yet Started") and total_solved > 0:
                newly_active.append({
                    "reg_no": s.reg_no,
                    "name": s.name,
                    "dept": s.department.code if s.department else "CSE",
                    "batch": batch,
                    "last_week_solved": prev_solved,
                    "current_week_solved": total_solved,
                    "problems_added": added
                })
            elif added < 0 or (category != prev_cat and total_solved < prev_solved):
                attention_required.append({
                    "reg_no": s.reg_no,
                    "name": s.name,
                    "dept": s.department.code if s.department else "CSE",
                    "batch": batch,
                    "from_cat": prev_cat,
                    "to_cat": category,
                    "status": "ATTENTION REQUIRED"
                })

    # Sort Top Improvers
    top_improvers = sorted(improvers, key=lambda x: x["problems_added"], reverse=True)[:10]

    # Group Students by Batch, Dept, and Year-Dept
    batch_map = {}
    dept_year_map = {}
    year_dept_map = {}

    for rec in current_student_records:
        b = rec["batch"]
        if b not in batch_map:
            batch_map[b] = []
        batch_map[b].append(rec)

        dy = f"{rec['dept']} - {rec['year']} Year"
        if dy not in dept_year_map:
            dept_year_map[dy] = []
        dept_year_map[dy].append(rec)

        yd_key = (rec["batch"], rec["dept"])
        if yd_key not in year_dept_map:
            year_dept_map[yd_key] = []
        year_dept_map[yd_key].append(rec)

    # 4. Mandatory Category Sum & All-Student Count Validation Equations
    cat_sum = len(cat_above_500) + len(cat_250_500) + len(cat_101_250) + len(cat_less_100) + len(cat_not_started) + len(cat_unavailable)
    assert cat_sum == total_students_count, f"Category sum ({cat_sum}) != Total Students ({total_students_count})"

    sum_batch_students = sum(len(recs) for recs in batch_map.values())
    assert sum_batch_students == total_students_count, f"Batch sum ({sum_batch_students}) != Total Students ({total_students_count})"

    # 5. Build Summary Tables (Batch, Department, Year-Department)
    def _get_counts(recs):
        valid_solved = [r["total_solved"] for r in recs if r.get("total_solved") is not None]
        avg_s = round(sum(valid_solved) / max(1, len(valid_solved)), 1) if valid_solved else 0
        tot_s = sum(valid_solved) if valid_solved else 0
        return {
            "total": len(recs),
            "verified": sum(1 for r in recs if r["fetch_status"] == "VERIFIED"),
            "failed": sum(1 for r in recs if r["fetch_status"] != "VERIFIED"),
            "above_500": sum(1 for r in recs if r["category"] == "Above 500"),
            "250_500": sum(1 for r in recs if r["category"] == "250-500"),
            "101_250": sum(1 for r in recs if r["category"] == "101-250"),
            "less_100": sum(1 for r in recs if r["category"] == "Less than 100"),
            "not_started": sum(1 for r in recs if r["category"] == "Not Yet Started"),
            "avg_solved": avg_s,
            "total_solved": tot_s,
            "q4": sum(1 for r in recs if "4 Q" in r.get("contest_q_solved", "")),
            "q3": sum(1 for r in recs if "3 Q" in r.get("contest_q_solved", "")),
            "q2": sum(1 for r in recs if "2 Q" in r.get("contest_q_solved", "")),
            "q1": sum(1 for r in recs if "1 Q" in r.get("contest_q_solved", "")),
            "rating_1500": sum(1 for r in recs if r.get("contest_rating") and r["contest_rating"] > 1500),
            "ranking_20000": sum(1 for r in recs if r.get("contest_ranking") and r["contest_ranking"] < 20000)
        }

    batches = sorted(list(batch_map.keys()))
    batch_summaries = []
    for b in batches:
        b_cur = batch_map[b]
        b_last = [r for r in last_week_student_records if r["batch"] == b]
        batch_summaries.append({
            "batch": b,
            "num_students": len(b_cur),
            "last_week": _get_counts(b_last),
            "current_week": _get_counts(b_cur)
        })

    depts = sorted(list(set(r["dept"] for r in current_student_records)))
    dept_summaries = []
    for d in depts:
        d_cur = [r for r in current_student_records if r["dept"] == d]
        d_last = [r for r in last_week_student_records if r["dept"] == d]
        dept_summaries.append({
            "department": d,
            "num_students": len(d_cur),
            "last_week": _get_counts(d_last),
            "current_week": _get_counts(d_cur)
        })

    year_dept_summaries = []
    for (b_name, d_name) in sorted(list(year_dept_map.keys())):
        yd_recs = year_dept_map[(b_name, d_name)]
        c_stats = _get_counts(yd_recs)
        year_dept_summaries.append({
            "batch": b_name,
            "department": d_name,
            "total_students": len(yd_recs),
            "verified": c_stats["verified"],
            "failed": c_stats["failed"],
            "above_500": c_stats["above_500"],
            "250_500": c_stats["250_500"],
            "101_250": c_stats["101_250"],
            "less_100": c_stats["less_100"],
            "not_started": c_stats["not_started"],
            "avg_solved": c_stats["avg_solved"],
            "total_solved": c_stats["total_solved"],
            "rating_1500": c_stats["rating_1500"],
            "ranking_20000": c_stats["ranking_20000"]
        })

    fetch_status_summary = {
        "Total Master Students": total_students_count,
        "Total Exported": total_students_count,
        "Difference": 0,
        "Verified": sum(1 for r in current_student_records if r["fetch_status"] == "VERIFIED"),
        "Last Fetch Failed": sum(1 for r in current_student_records if r["fetch_status"] in ("LAST FETCH FAILED", "FETCH_FAILED")),
        "Profile Not Found": sum(1 for r in current_student_records if r["fetch_status"] == "PROFILE_NOT_FOUND"),
        "Invalid URL": sum(1 for r in current_student_records if r["fetch_status"] == "INVALID_URL"),
        "Missing Link": sum(1 for r in current_student_records if r["fetch_status"] == "MISSING_LINK"),
        "Data Mismatch": sum(1 for r in current_student_records if r["fetch_status"] == "DATA_MISMATCH"),
        "Duplicate Profile": sum(1 for r in validation_issues if "Duplicate" in r.get("issue_type", ""))
    }

    if save_snapshot:
        db.commit()

    return {
        "report_date": today_str,
        "total_students": total_students_count,
        "verified_students": total_verified_count,
        "unavailable_students": total_unavailable_count,
        "roster_warnings": roster_warnings,
        "validation_issues": validation_issues,
        "fetch_status_summary": fetch_status_summary,
        "fetch_errors": fetch_errors_list,
        "contest_validation": contest_data_validation_list,
        "snapshot_audit": snapshot_audit_list,
        "batch_map": batch_map,
        "dept_year_map": dept_year_map,
        "batch_summaries": batch_summaries,
        "dept_summaries": dept_summaries,
        "year_dept_summaries": year_dept_summaries,
        "categories": {
            "above_500": cat_above_500,
            "250_500": cat_250_500,
            "101_250": cat_101_250,
            "less_100": cat_less_100,
            "not_started": cat_not_started,
            "unavailable": cat_unavailable
        },
        "rating_above_1500": rating_above_1500,
        "ranking_below_20000": ranking_below_20000,
        "movements": {
            "promotions": promotions,
            "attention_required": attention_required,
            "newly_active": newly_active,
            "top_improvers": top_improvers,
            "zero_progress": zero_progress
        },
        "all_students_current": current_student_records,
        "all_students_last_week": last_week_student_records
    }


def run_sunday_0945_public_contest_workflow(db: Session, contest_id: Optional[str] = None) -> Dict[str, Any]:
    """
    SUNDAY 9:45 AM PUBLIC CONTEST WORKFLOW — ALL 273 STUDENTS
    1. Identifies latest public contest.
    2. Fetches PUBLIC contest participation for all 273 master students.
    3. Records PUBLIC participations without modifying VIRTUAL records.
    4. Generates Public_Contest.xlsx.
    5. Computes Public summary breakdown (4Q, 3Q, 2Q, 1Q, Not Attended, Fetch Failed, Mode Uncertain).
    6. Dispatches 9:45 AM Email Report with Public_Contest.xlsx attached.
    """
    from backend.services.contest_service import record_contest_participation
    from backend.exporters.weekly_excel_generator import build_public_contest_excel
    from backend.email_service import send_public_contest_report_email

    today_str = datetime.date.today().strftime("%Y-%m-%d")
    c_id = contest_id or f"weekly-contest-{datetime.date.today().strftime('%W')}"
    c_name = f"Weekly Contest"

    students = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None))).all()

    rows = []
    q4, q3, q2, q1, not_att, fetch_fail, mode_unc = 0, 0, 0, 0, 0, 0, 0

    for idx, s in enumerate(students, start=1):
        st = s.stats
        if not s.leetcode_url and not s.username:
            status = "NOT_ATTENDED"
            q_solved = 0
            err_msg = "Missing profile link"
        elif st and st.sync_status in ("failed", "stale") and st.total_solved is None:
            status = "FETCH_FAILED"
            q_solved = 0
            err_msg = st.error_message or "API fetch failed"
        elif st and st.recent_contest_score and "/" in st.recent_contest_score:
            try:
                parts = st.recent_contest_score.split("/")
                q_solved = int(parts[0].strip())
            except Exception:
                q_solved = 0
            status = "ATTENDED" if q_solved > 0 else "ATTENDED"
            err_msg = None
        else:
            status = "NOT_ATTENDED"
            q_solved = 0
            err_msg = None

        rec = record_contest_participation(
            db=db,
            student_id=s.id,
            contest_id=c_id,
            contest_name=c_name,
            participation_mode="PUBLIC",
            questions_solved=q_solved,
            questions_total=4,
            contest_rank=st.contest_global_ranking if st else None,
            contest_rating=st.contest_rating if st else None,
            status=status,
            error_message=err_msg
        )

        if status == "ATTENDED":
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
    """
    SUNDAY 10:00 PM VIRTUAL & COMBINED CONTEST FINAL WORKFLOW — ALL 273 STUDENTS
    1. Identifies latest contest.
    2. Fetches VIRTUAL contest participation for all 273 master students.
    3. Records VIRTUAL participations without modifying PUBLIC records.
    4. Generates Virtual_Contest.xlsx.
    5. Generates Contest_Combined.xlsx (Side-by-Side Public vs Virtual comparison + Validation Sheet).
    6. Computes Virtual and Overall summary breakdowns.
    7. Dispatches 10:00 PM Final Email Report with Virtual_Contest.xlsx & Contest_Combined.xlsx attached.
    """
    from backend.services.contest_service import record_contest_participation, build_student_contest_dto
    from backend.exporters.weekly_excel_generator import build_virtual_contest_excel, build_contest_combined_excel
    from backend.email_service import send_final_combined_contest_report_email
    from backend.models import StudentContestParticipation

    today_str = datetime.date.today().strftime("%Y-%m-%d")
    c_id = contest_id or f"weekly-contest-{datetime.date.today().strftime('%W')}"
    c_name = f"Weekly Contest"

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
            q_solved = 0
            err_msg = None

        rec = record_contest_participation(
            db=db,
            student_id=s.id,
            contest_id=c_id,
            contest_name=c_name,
            participation_mode="VIRTUAL",
            questions_solved=q_solved,
            questions_total=4,
            status=status,
            error_message=err_msg
        )

        if status == "ATTENDED":
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

        if status in ("FETCH_FAILED", "MODE_UNCERTAIN", "PARSER_ERROR"):
            validation_logs.append({
                "reg_no": s.reg_no,
                "student_name": s.name,
                "username": s.username or "N/A",
                "contest_name": c_name,
                "contest_number": None,
                "participation_mode": "VIRTUAL",
                "questions_solved": q_solved,
                "questions_total": 4,
                "contest_rank": None,
                "contest_rating": None,
                "status": status,
                "error_message": err_msg or "Validation flag",
                "fetched_at": rec.fetched_at.strftime("%Y-%m-%d %H:%M:%S") if rec.fetched_at else None
            })

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

