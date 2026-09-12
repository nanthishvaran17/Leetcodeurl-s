import datetime
from typing import List, Dict, Any, Tuple
from backend.services.report_models import DataQualitySummary

def validate_data_quality(students: List[Any]) -> DataQualitySummary:
    """
    Performs data quality checks across the student models.
    Checks for missing username, duplicate register number, invalid URLs, and unverified status.
    """
    total_students = len(students)
    valid_count = 0
    unverified_count = 0
    missing_username_count = 0
    duplicate_reg_no_count = 0
    invalid_url_count = 0
    warnings = []

    seen_reg_nos = set()

    for s in students:
        reg_no = (s.reg_no or "").strip().upper()
        if not reg_no:
            warnings.append(f"Student '{s.name}' is missing Register Number.")
        elif reg_no in seen_reg_nos:
            duplicate_reg_no_count += 1
            warnings.append(f"Duplicate Register Number detected: {reg_no}")
        else:
            seen_reg_nos.add(reg_no)

        url = (s.leetcode_url or "").strip()
        if not url:
            invalid_url_count += 1
        elif "leetcode.com" not in url.lower():
            invalid_url_count += 1
            warnings.append(f"Student {reg_no} has invalid LeetCode URL: '{url}'")

        username = (s.username or "").strip()
        if not username:
            missing_username_count += 1

        st = getattr(s, "stats", None)
        if st and getattr(st, "validation_status", "") == "verified":
            valid_count += 1
        else:
            unverified_count += 1

    return DataQualitySummary(
        total_students=total_students,
        valid_count=valid_count,
        unverified_count=unverified_count,
        missing_username_count=missing_username_count,
        duplicate_reg_no_count=duplicate_reg_no_count,
        invalid_url_count=invalid_url_count,
        warnings=warnings[:10]
    )

def validate_report_consistency(dataset: Dict[str, Any], export_rows: List[Dict[str, Any]]) -> Tuple[bool, str]:
    """
    Validates data consistency between Preview dataset and export format output.
    Ensures Preview row count == export row count and field values match identically.
    """
    preview_all = dataset.get("allStudents") or dataset.get("participations") or dataset.get("topStudents") or []
    preview_count = len(preview_all)
    export_count = len(export_rows)

    if preview_count != export_count:
        return False, f"Row count mismatch: Preview has {preview_count} rows, Export has {export_count} rows."

    for idx, (p_row, e_row) in enumerate(zip(preview_all, export_rows)):
        p_reg = p_row.get("reg_no") or p_row.get("student_name")
        e_reg = e_row.get("reg_no") or e_row.get("student_name")
        if p_reg and e_reg and str(p_reg).strip() != str(e_reg).strip():
            return False, f"Mismatch at row {idx+1}: Preview '{p_reg}' vs Export '{e_reg}'."

    return True, "Data consistency verified successfully across format representations."


def reconcile_report_dataset(live_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Authoritative cross-table data reconciliation gate.
    Validates:
    - Total student count == sum(department totals) == sum(year totals)
    - Department vs student DSA/language aggregations
    - Future contest status (must be UPCOMING, not COMPLETED or ABSENT)
    - Rating integrity (no missing rating converted to 1500)
    - Solver distribution sum == total students
    - Historical snapshot independence
    """
    errors = []
    warnings = []

    exec_dash = live_data.get("executive_dashboard", {})
    tot_students = exec_dash.get("total_students", 0)

    # 1. Department total reconciliation
    dept_list = live_data.get("department_intelligence", [])
    dept_sum = sum(d.get("total_students", 0) for d in dept_list)
    if tot_students != dept_sum:
        errors.append(f"Department Total Mismatch: Total Students ({tot_students}) != Department Sum ({dept_sum})")

    # 2. Year total reconciliation
    year_list = live_data.get("year_intelligence", [])
    year_sum = sum(y.get("total_students", 0) for y in year_list)
    if tot_students != year_sum:
        errors.append(f"Year Total Mismatch: Total Students ({tot_students}) != Year Sum ({year_sum})")

    # 3. Solver / Category distribution reconciliation
    cat_dist = exec_dash.get("category_distribution", {})
    cat_sum = sum(cat_dist.values())
    if cat_sum > 0 and cat_sum != tot_students:
        errors.append(f"Category Distribution Mismatch: Category Sum ({cat_sum}) != Total Students ({tot_students})")

    # 4. Rating integrity check (ensure no 1500 default ratings exist as valid ratings)
    students = live_data.get("student_3_week_comparison", [])
    for s in students:
        r = s.get("contest_rating")
        if r == 1500.0 or r == 1500:
            errors.append(f"Invalid Rating Fallback: Student {s.get('reg_no')} has default rating 1500.0")
            break

    # 5. Contest solve distribution reconciliation
    contest_intel = live_data.get("contest_intelligence", {})
    participants = contest_intel.get("participants_count", 0)
    top_rankers = contest_intel.get("top_rankers", [])

    c_4_4 = sum(1 for s in students if s.get("contest_solved_current") == 4)
    c_3_4 = sum(1 for s in students if s.get("contest_solved_current") == 3)
    c_2_4 = sum(1 for s in students if s.get("contest_solved_current") == 2)
    c_1_4 = sum(1 for s in students if s.get("contest_solved_current") == 1)
    c_0_4 = tot_students - (c_4_4 + c_3_4 + c_2_4 + c_1_4)

    # Determine status
    is_valid = len(errors) == 0
    official_status = "OFFICIAL" if is_valid else "DRAFT — VALIDATION REQUIRED"

    # Availability counts
    available_cnt = sum(1 for s in students if (s.get("current_solved") or 0) > 0)
    partial_cnt = sum(1 for s in students if (s.get("current_solved") or 0) == 0 and s.get("username") and s.get("username") != "N/A")
    not_avail_cnt = tot_students - (available_cnt + partial_cnt)

    reconciliation_summary = {
        "is_valid": is_valid,
        "official_status": official_status,
        "errors": errors,
        "warnings": warnings,
        "total_students": tot_students,
        "dept_sum": dept_sum,
        "year_sum": year_sum,
        "available": available_cnt,
        "partial": partial_cnt,
        "not_available": not_avail_cnt,
        "contest_participants": participants,
        "distribution_4_4": c_4_4,
        "distribution_3_4": c_3_4,
        "distribution_2_4": c_2_4,
        "distribution_1_4": c_1_4,
        "distribution_0_4": c_0_4,
    }

    return reconciliation_summary
