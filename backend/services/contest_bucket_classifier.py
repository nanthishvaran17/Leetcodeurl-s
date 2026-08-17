"""
Contest Bucket Classifier
Strict, rule-compliant classification of student contest outcomes.
Guarantees separation of None vs 0, Public vs Virtual, and verified states.
"""
from typing import Any, Optional


ALLOWED_OUTCOMES = (
    "4_SOLVED",
    "3_SOLVED",
    "2_SOLVED",
    "1_SOLVED",
    "0_SOLVED",
    "NOT_PARTICIPATED",
    "UNKNOWN",
    "SOURCE_UNAVAILABLE",
)


def _get_val(obj: Any, *keys: str, default: Any = None) -> Any:
    """Helper to extract attribute or dictionary key safely."""
    if obj is None:
        return default
    if isinstance(obj, dict):
        for k in keys:
            if k in obj:
                return obj[k]
        return default
    for k in keys:
        if hasattr(obj, k):
            val = getattr(obj, k)
            if val is not None:
                return val
    return default


def classify_public_contest_outcome(result: Any) -> str:
    """
    Classifies public contest performance for a student result.
    
    Allowed outputs:
      4_SOLVED, 3_SOLVED, 2_SOLVED, 1_SOLVED, 0_SOLVED,
      NOT_PARTICIPATED, UNKNOWN, SOURCE_UNAVAILABLE
      
    Rules:
      * solved_count == 0 -> 0_SOLVED ONLY when participation is verified.
      * solved_count is None + NOT_PARTICIPATED -> NOT_PARTICIPATED.
      * solved_count is None + UNKNOWN -> UNKNOWN.
      * source unavailable -> SOURCE_UNAVAILABLE.
      * Never use `result.total_contest_solved or 0`.
      * Never infer solved count from rank or score.
      * Never convert missing data to zero.
    """
    if result is None:
        # No result row in DB for this student — no evidence of participation.
        # NOT_PARTICIPATED is the correct sentinel; UNKNOWN is reserved for fetch errors.
        return "NOT_PARTICIPATED"

    # Extract statuses
    part_status = _get_val(result, "participation_status", "status")
    part_status = str(part_status).upper().strip() if part_status is not None else ""

    fetch_status = _get_val(result, "data_fetch_status", "fetch_status", "error_code")
    fetch_status = str(fetch_status).upper().strip() if fetch_status is not None else ""

    error_type = _get_val(result, "error_type")
    error_type = str(error_type).upper().strip() if error_type is not None else ""

    confidence = _get_val(result, "confidence", "verification_level")
    confidence = str(confidence).upper().strip() if confidence is not None else ""

    attended_raw = _get_val(result, "attended")
    
    # 1. Check Source Unavailable / Fetch Errors
    if (
        fetch_status in ("FETCH_FAILED", "FETCH_ERROR", "TIMEOUT", "SOURCE_UNAVAILABLE", "NETWORK_TIMEOUT")
        or error_type in ("FETCH_ERROR", "SOURCE_UNAVAILABLE", "TIMEOUT")
        or part_status in ("SOURCE_UNAVAILABLE", "FETCH_FAILED", "DATA_ERROR")
    ):
        return "SOURCE_UNAVAILABLE"

    # 2. Check Unknown / Missing Profile Statuses
    if (
        fetch_status in ("INVALID_USERNAME", "USERNAME_NOT_FOUND", "PENDING_USERNAME", "MISSING_LINK")
        or part_status in ("UNKNOWN", "PENDING", "DATA_UNAVAILABLE")
    ):
        # If explicitly not attended and fetch status was just DATA_UNAVAILABLE, check participation
        if part_status in ("PUBLIC_NOT_ATTENDED", "NOT_ATTENDED", "NOT_PARTICIPATED", "ABSENT") and fetch_status == "DATA_UNAVAILABLE":
            return "NOT_PARTICIPATED"
        if fetch_status in ("INVALID_USERNAME", "USERNAME_NOT_FOUND", "PENDING_USERNAME", "MISSING_LINK"):
            return "UNKNOWN"
        if part_status in ("UNKNOWN", "PENDING"):
            return "UNKNOWN"

    # 3. Check Explicit Non-Attendance
    if part_status in ("PUBLIC_NOT_ATTENDED", "NOT_ATTENDED", "NOT_PARTICIPATED", "ABSENT") or attended_raw is False:
        # If participation status specifically indicates attended even if attended_raw is False, verify
        if part_status in ("PUBLIC_ATTENDED", "PUBLIC", "ATTENDED"):
            pass  # proceed to solved check
        else:
            return "NOT_PARTICIPATED"

    # 4. Check Participation / Solved Count
    # Solved count must be strictly extracted without default to 0
    solved_count = None
    if isinstance(result, dict):
        if "total_contest_solved" in result and result["total_contest_solved"] is not None:
            solved_count = result["total_contest_solved"]
        elif "questions_solved" in result and result["questions_solved"] is not None:
            solved_count = result["questions_solved"]
        elif "problems_solved" in result and result["problems_solved"] is not None:
            solved_count = result["problems_solved"]
    else:
        if hasattr(result, "total_contest_solved") and getattr(result, "total_contest_solved") is not None:
            solved_count = getattr(result, "total_contest_solved")
        elif hasattr(result, "questions_solved") and getattr(result, "questions_solved") is not None:
            solved_count = getattr(result, "questions_solved")
        elif hasattr(result, "problems_solved") and getattr(result, "problems_solved") is not None:
            solved_count = getattr(result, "problems_solved")

    is_attended = (
        part_status in ("PUBLIC_ATTENDED", "PUBLIC", "ATTENDED", "PARTICIPATED")
        or attended_raw is True
    )

    if is_attended:
        if solved_count is None:
            return "UNKNOWN"
        try:
            val = int(solved_count)
            if val >= 4:
                return "4_SOLVED"
            elif val == 3:
                return "3_SOLVED"
            elif val == 2:
                return "2_SOLVED"
            elif val == 1:
                return "1_SOLVED"
            elif val == 0:
                # 0_SOLVED ONLY when verified attended
                return "0_SOLVED"
        except (ValueError, TypeError):
            return "UNKNOWN"

    # If not explicitly marked attended but solved_count > 0 is present
    if solved_count is not None:
        try:
            val = int(solved_count)
            if val >= 4:
                return "4_SOLVED"
            elif val == 3:
                return "3_SOLVED"
            elif val == 2:
                return "2_SOLVED"
            elif val == 1:
                return "1_SOLVED"
            elif val == 0 and is_attended:
                return "0_SOLVED"
        except (ValueError, TypeError):
            pass

    return "NOT_PARTICIPATED"


def classify_virtual_contest_outcome(result: Any) -> str:
    """
    Classifies virtual contest performance for a student result.
    
    Allowed outputs:
      4_SOLVED, 3_SOLVED, 2_SOLVED, 1_SOLVED, 0_SOLVED,
      NOT_PARTICIPATED, UNKNOWN, SOURCE_UNAVAILABLE
    """
    if result is None:
        return "NOT_PARTICIPATED"

    part_status = _get_val(result, "participation_status", "status")
    part_status = str(part_status).upper().strip() if part_status is not None else ""

    fetch_status = _get_val(result, "data_fetch_status", "fetch_status", "error_code")
    fetch_status = str(fetch_status).upper().strip() if fetch_status is not None else ""

    attended_raw = _get_val(result, "attended")

    # 1. Source Unavailable
    if (
        fetch_status in ("FETCH_FAILED", "FETCH_ERROR", "TIMEOUT", "SOURCE_UNAVAILABLE")
        or part_status in ("SOURCE_UNAVAILABLE", "FETCH_FAILED")
    ):
        return "SOURCE_UNAVAILABLE"

    # 2. Unknown
    if (
        fetch_status in ("INVALID_USERNAME", "USERNAME_NOT_FOUND", "PENDING_USERNAME", "MISSING_LINK")
        or part_status in ("UNKNOWN", "PENDING")
    ):
        return "UNKNOWN"

    # 3. Not Participated
    if part_status in ("VIRTUAL_NOT_ATTENDED", "NOT_ATTENDED", "NOT_PARTICIPATED", "ABSENT") or attended_raw is False:
        if part_status not in ("VIRTUAL_ATTENDED", "VIRTUAL", "ATTENDED"):
            return "NOT_PARTICIPATED"

    # 4. Solved Count Extraction
    solved_count = None
    if isinstance(result, dict):
        if "total_contest_solved" in result and result["total_contest_solved"] is not None:
            solved_count = result["total_contest_solved"]
        elif "questions_solved" in result and result["questions_solved"] is not None:
            solved_count = result["questions_solved"]
        elif "problems_solved" in result and result["problems_solved"] is not None:
            solved_count = result["problems_solved"]
    else:
        if hasattr(result, "total_contest_solved") and getattr(result, "total_contest_solved") is not None:
            solved_count = getattr(result, "total_contest_solved")
        elif hasattr(result, "questions_solved") and getattr(result, "questions_solved") is not None:
            solved_count = getattr(result, "questions_solved")
        elif hasattr(result, "problems_solved") and getattr(result, "problems_solved") is not None:
            solved_count = getattr(result, "problems_solved")

    is_attended = (
        part_status in ("VIRTUAL_ATTENDED", "VIRTUAL", "ATTENDED", "PARTICIPATED")
        or attended_raw is True
    )

    if is_attended:
        if solved_count is None:
            return "UNKNOWN"
        try:
            val = int(solved_count)
            if val >= 4:
                return "4_SOLVED"
            elif val == 3:
                return "3_SOLVED"
            elif val == 2:
                return "2_SOLVED"
            elif val == 1:
                return "1_SOLVED"
            elif val == 0:
                return "0_SOLVED"
        except (ValueError, TypeError):
            return "UNKNOWN"

    if solved_count is not None:
        try:
            val = int(solved_count)
            if val >= 4:
                return "4_SOLVED"
            elif val == 3:
                return "3_SOLVED"
            elif val == 2:
                return "2_SOLVED"
            elif val == 1:
                return "1_SOLVED"
            elif val == 0 and is_attended:
                return "0_SOLVED"
        except (ValueError, TypeError):
            pass

    return "NOT_PARTICIPATED"
