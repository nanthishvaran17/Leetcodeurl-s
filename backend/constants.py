"""
Centralized Production Department Constants and Helpers.
Includes all valid institutional departments across pages and filters.
"""

EXCLUDED_DEPT_KEYWORDS = ["TEST", "DEMO", "DEV", "TEMP", "CSE-EDIT-TEST", "CSE_TEST", "UNSEEN", "DUMMY"]

def is_production_department(code: str, name: str = "") -> bool:
    if not code and not name:
        return False
    code_upper = (code or "").upper().strip()
    name_upper = (name or "").upper().strip()

    for kw in EXCLUDED_DEPT_KEYWORDS:
        if kw in code_upper or kw in name_upper:
            return False

    # Generic unspecialized 'CSE' is a test fixture department; live college departments are CSE(CS), CSE(IOT), IT
    if code_upper == "CSE" or name_upper == "COMPUTER SCIENCE AND ENGINEERING":
        return False

    return True

from typing import Optional, List, Any
from sqlalchemy import func, or_

def get_academic_year_variants(year_input: Optional[str]) -> List[str]:
    """
    Returns list of uppercase DB string variants matching the given academic year input.
    Handles '1st Year', '2nd Year', '3rd Year', '4th Year', Roman numerals ('I', 'II', 'III', 'IV'),
    digits ('1', '2', '3', '4'), etc.
    """
    if not year_input:
        return []
    raw = str(year_input).strip().upper()
    if raw in ("ALL", "ALL YEARS", "ALL_YEARS", "ALL ACADEMIC YEARS", ""):
        return []

    target_year = None
    if any(k in raw for k in ["IV", "4", "FINAL", "2023", "2027"]):
        target_year = 4
    elif any(k in raw for k in ["III", "3", "2024", "2028"]):
        target_year = 3
    elif any(k in raw for k in ["II", "2", "2025", "2029"]):
        target_year = 2
    elif any(k in raw for k in ["I", "1", "2026", "2030"]):
        target_year = 1

    variants_map = {
        1: ["1", "I", "1ST", "1 YEAR", "I YEAR", "1ST YEAR", "1 YR", "I YR", "YEAR 1", "YEAR I"],
        2: ["2", "II", "2ND", "2 YEAR", "II YEAR", "2ND YEAR", "2 YR", "II YR", "YEAR 2", "YEAR II"],
        3: ["3", "III", "3RD", "3 YEAR", "III YEAR", "3RD YEAR", "3 YR", "III YR", "YEAR 3", "YEAR III"],
        4: ["4", "IV", "4TH", "4 YEAR", "IV YEAR", "4TH YEAR", "4 YR", "IV YR", "YEAR 4", "YEAR IV"],
    }

    if target_year and target_year in variants_map:
        return variants_map[target_year]

    clean = raw.replace("YEAR", "").strip()
    return [raw, clean]


def get_academic_year_filter_clause(student_model: Any, year_input: Optional[str]):
    """
    Constructs a robust SQLAlchemy filter clause matching Student.year_level or batch reg_no.
    """
    if not year_input:
        return None
    raw = str(year_input).strip().upper()
    if raw in ("ALL", "ALL YEARS", "ALL_YEARS", "ALL ACADEMIC YEARS", ""):
        return None

    target_year = None
    if any(k in raw for k in ["IV", "4", "FINAL", "2023", "2027"]):
        target_year = 4
    elif any(k in raw for k in ["III", "3", "2024", "2028"]):
        target_year = 3
    elif any(k in raw for k in ["II", "2", "2025", "2029"]):
        target_year = 2
    elif any(k in raw for k in ["I", "1", "2026", "2030"]):
        target_year = 1

    variants_map = {
        1: ["1", "I", "1ST", "1 YEAR", "I YEAR", "1ST YEAR", "1 YR", "I YR", "YEAR 1", "YEAR I"],
        2: ["2", "II", "2ND", "2 YEAR", "II YEAR", "2ND YEAR", "2 YR", "II YR", "YEAR 2", "YEAR II"],
        3: ["3", "III", "3RD", "3 YEAR", "III YEAR", "3RD YEAR", "3 YR", "III YR", "YEAR 3", "YEAR III"],
        4: ["4", "IV", "4TH", "4 YEAR", "IV YEAR", "4TH YEAR", "4 YR", "IV YR", "YEAR 4", "YEAR IV"],
    }

    batch_prefix_map = {
        1: ["732226", "26"],
        2: ["732225", "25"],
        3: ["732224", "24"],
        4: ["732223", "23"],
    }

    if target_year and target_year in variants_map:
        variants = variants_map[target_year]
        prefixes = batch_prefix_map[target_year]
        reg_clauses = [
            student_model.reg_no.ilike(f"%{prefixes[0]}%"),
            student_model.reg_no.ilike(f"{prefixes[1]}%")
        ]
        return or_(
            func.upper(student_model.year_level).in_(variants),
            *reg_clauses
        )
    else:
        clean = raw.replace("YEAR", "").strip()
        return func.upper(student_model.year_level).ilike(f"%{clean}%")



