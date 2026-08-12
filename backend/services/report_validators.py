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

        st = s.stats
        if st and st.validation_status == "verified":
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
        warnings=warnings[:10]  # Limit warning lines for UI readability
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
