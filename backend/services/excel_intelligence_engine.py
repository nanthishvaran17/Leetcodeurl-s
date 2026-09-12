import re
import datetime
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd

# Canonical student import schema fields
CANONICAL_FIELDS = {
    "reg_no": {
        "label": "REG NO / ROLL NO",
        "required": True,
        "synonyms": ["reg_no", "regno", "reg_number", "register_no", "register_number", "registration_no", "roll_no", "rollno", "roll_number"]
    },
    "name": {
        "label": "NAME",
        "required": True,
        "synonyms": ["name", "student_name", "full_name", "candidate_name", "name_of_the_student", "student"]
    },
    "department": {
        "label": "DEPARTMENT",
        "required": True,
        "synonyms": ["dept", "department", "branch", "stream", "dept_name", "department_name", "branch_name"]
    },
    "year_level": {
        "label": "YEAR LEVEL",
        "required": True,
        "synonyms": ["year", "year_level", "academic_year", "student_year", "class", "yr"]
    },
    "email": {
        "label": "EMAIL",
        "required": True,
        "synonyms": ["email", "mail_id", "email_id", "email_address", "institutional_email", "college_email", "mail"]
    },
    "leetcode_url": {
        "label": "PRIMARY LEETCODE LINK",
        "required": True,
        "synonyms": ["primary_leetcode_link", "leetcode_profile_link", "leetcode_url", "leetcode", "profile_link", "leetcode_link", "primary_leetcode", "leetcode_handle", "primary_account"]
    },
    "sec_leetcode_url": {
        "label": "SECONDARY LEETCODE LINK",
        "required": False,
        "synonyms": ["secondary_leetcode_link", "secondary_leetcode_profile_link", "secondary_leetcode", "secondary_account", "secondary_link", "secondary_leetcode_handle", "alternate_leetcode"]
    },
    "section": {
        "label": "SECTION",
        "required": False,
        "synonyms": ["section", "sec", "class_section", "sec_name"]
    },
    "batch": {
        "label": "ACADEMIC BATCH",
        "required": False,
        "synonyms": ["batch", "academic_batch", "passing_batch", "batch_year", "grad_year", "graduation_year"]
    }
}

# --- Value Normalizers ---

def normalize_year_value(val: Any) -> Tuple[str, str]:
    """
    Normalizes year input to canonical 'I Year', 'II Year', 'III Year', 'IV Year' or 'I', 'II', 'III', 'IV'.
    Returns (canonical_year_str, confidence_level)
    """
    if val is None or pd.isna(val):
        return ("III Year", "LOW")
    
    s = str(val).strip().upper()
    if not s:
        return ("III Year", "LOW")
    
    # Strip common suffixes
    s_clean = re.sub(r'[\s_\-\.\,]+', ' ', s).strip()

    if s_clean in ["1", "I", "FIRST", "FIRST YEAR", "1ST", "1ST YEAR", "I YEAR", "YEAR 1", "YR 1", "YR I"]:
        return ("I Year", "HIGH")
    elif s_clean in ["2", "II", "SECOND", "SECOND YEAR", "2ND", "2ND YEAR", "II YEAR", "YEAR 2", "YR 2", "YR II"]:
        return ("II Year", "HIGH")
    elif s_clean in ["3", "III", "THIRD", "THIRD YEAR", "3RD", "3RD YEAR", "III YEAR", "YEAR 3", "YR 3", "YR III"]:
        return ("III Year", "HIGH")
    elif s_clean in ["4", "IV", "FOURTH", "FOURTH YEAR", "4TH", "4TH YEAR", "IV YEAR", "YEAR 4", "YR 4", "YR IV"]:
        return ("IV Year", "HIGH")

    # Partial digit check
    if "1" in s_clean: return ("I Year", "MEDIUM")
    if "2" in s_clean: return ("II Year", "MEDIUM")
    if "3" in s_clean: return ("III Year", "MEDIUM")
    if "4" in s_clean: return ("IV Year", "MEDIUM")

    return (s, "LOW")

def normalize_batch_value(val: Any) -> Tuple[Optional[str], str]:
    """
    Normalizes academic batch to canonical 'YYYY-YYYY' (e.g. 2023-2027).
    Returns (canonical_batch_str, confidence_level)
    """
    if val is None or pd.isna(val):
        return (None, "HIGH")

    s = str(val).strip()
    if not s:
        return (None, "HIGH")

    # Regex for 4-digit years
    match = re.search(r'(\d{4})[\s\-\–\/to]+(\d{4})', s, re.IGNORECASE)
    if match:
        y1, y2 = match.group(1), match.group(2)
        return (f"{y1}-{y2}", "HIGH")

    # Short format like 23-27
    short_match = re.search(r'(\d{2})[\s\-\–\/to]+(\d{2})', s, re.IGNORECASE)
    if short_match:
        y1, y2 = "20" + short_match.group(1), "20" + short_match.group(2)
        return (f"{y1}-{y2}", "MEDIUM")

    return (s, "LOW")

def normalize_department_value(val: Any, existing_depts: Dict[str, Any]) -> Tuple[str, Optional[int], str, bool]:
    """
    Resolves department string against database Department master.
    Returns (dept_code, dept_id, confidence, is_new_dept)
    """
    if val is None or pd.isna(val):
        return ("CSE", None, "LOW", False)

    raw_dept = str(val).strip()
    if not raw_dept:
        return ("CSE", None, "LOW", False)

    dept_upper = raw_dept.upper().replace(".", "").replace(" ", "").replace("&", "")
    
    # Check exact code or name in existing departments
    for key, dept_obj in existing_depts.items():
        k_clean = str(key).upper().replace(".", "").replace(" ", "").replace("&", "")
        if dept_upper == k_clean or (len(dept_upper) >= 4 and dept_upper in k_clean):
            code = dept_obj.code if hasattr(dept_obj, 'code') else str(key)
            d_id = dept_obj.id if hasattr(dept_obj, 'id') else None
            return (code, d_id, "HIGH", False)

    # Common synonym aliases
    if any(k in dept_upper for k in ["CYBER", "CSECS", "CS"]):
        for key, dept_obj in existing_depts.items():
            if "CS" in str(key).upper():
                return (dept_obj.code, dept_obj.id, "HIGH", False)
    elif any(k in dept_upper for k in ["IOT", "CSEIOT", "CI"]):
        for key, dept_obj in existing_depts.items():
            if "IOT" in str(key).upper() or "CI" in str(key).upper():
                return (dept_obj.code, dept_obj.id, "HIGH", False)
    elif any(k in dept_upper for k in ["IT", "INFORMATION"]):
        for key, dept_obj in existing_depts.items():
            if "IT" in str(key).upper():
                return (dept_obj.code, dept_obj.id, "HIGH", False)
    elif any(k in dept_upper for k in ["AIDS", "ARTIFICIAL"]):
        for key, dept_obj in existing_depts.items():
            if "AIDS" in str(key).upper():
                return (dept_obj.code, dept_obj.id, "HIGH", False)

    # Flag as newly discovered department
    return (raw_dept.upper(), None, "HIGH", True)

def normalize_leetcode_url(val: Any) -> Tuple[Optional[str], Optional[str]]:
    """
    Extracts LeetCode username handle and returns (canonical_url, username)
    """
    if val is None or pd.isna(val):
        return (None, None)

    s = str(val).strip()
    if not s:
        return (None, None)

    from backend.leetcode_client import extract_leetcode_username
    username, std_url, status = extract_leetcode_username(s)
    if username:
        return (f"https://leetcode.com/u/{username.lower()}/", username.lower())
    return (s, None)

def detect_column_headers(raw_headers: List[str]) -> Tuple[Dict[str, str], Dict[str, str], List[str]]:
    """
    Analyzes raw Excel sheet headers and maps them to internal canonical fields.
    Returns: (mapped_columns, confidence_map, unmapped_headers)
    """
    mapped_columns: Dict[str, str] = {}
    confidence_map: Dict[str, str] = {}
    unmapped_headers: List[str] = []

    used_canonicals = set()

    for h in raw_headers:
        clean_h = str(h).strip().lower().replace(" ", "_").replace(".", "").replace("-", "_")

        matched_field = None
        confidence = "LOW"

        # 1. Exact or Synonym match
        for field_key, meta in CANONICAL_FIELDS.items():
            if field_key in used_canonicals:
                continue
            for syn in meta["synonyms"]:
                if clean_h == syn:
                    matched_field = field_key
                    confidence = "HIGH"
                    break
            if matched_field:
                break

        # 2. Substring match fallback
        if not matched_field:
            for field_key, meta in CANONICAL_FIELDS.items():
                if field_key in used_canonicals:
                    continue
                for syn in meta["synonyms"]:
                    if syn in clean_h or clean_h in syn:
                        matched_field = field_key
                        confidence = "MEDIUM"
                        break
                if matched_field:
                    break

        if matched_field:
            mapped_columns[h] = matched_field
            confidence_map[h] = confidence
            used_canonicals.add(matched_field)
        else:
            unmapped_headers.append(h)
            confidence_map[h] = "LOW"

    return (mapped_columns, confidence_map, unmapped_headers)
