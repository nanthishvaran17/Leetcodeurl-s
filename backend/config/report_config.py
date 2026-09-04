"""
Report Layer Central Configuration
AY 2026-27 Standardized Batches, Department Coordinators, and Statuses.
"""
from typing import Optional

BATCH_YEAR_MAP = {
    "II": "2025 - 2029",
    "2": "2025 - 2029",
    "2ND": "2025 - 2029",
    "2-ND": "2025 - 2029",
    "SECOND": "2025 - 2029",
    "III": "2024 - 2028",
    "3": "2024 - 2028",
    "3RD": "2024 - 2028",
    "3-RD": "2024 - 2028",
    "THIRD": "2024 - 2028",
    "IV": "2023 - 2027",
    "4": "2023 - 2027",
    "4TH": "2023 - 2027",
    "4-TH": "2023 - 2027",
    "FOURTH": "2023 - 2027",
}

BATCH_CONFIG = [
    {"key": "2023_2027", "label": "2023 - 2027", "year": "IV"},
    {"key": "2024_2028", "label": "2024 - 2028", "year": "III"},
    {"key": "2025_2029", "label": "2025 - 2029", "year": "II"},
]

DEPARTMENT_COORDINATORS = {
    "CSE(CS)": "M. Santhoshkumar, AP / CSE (Cyber Security)",
    "CSE(IoT)": "Mohan Gandhi S",
    "CSE(IOT)": "Mohan Gandhi S",
    "DEFAULT": "Dr. S. Prabhu, M.E., Ph.D. / Associate Professor & Head - CSE (Cyber Security)",
}

FINALIZED_STATUSES = ("COMPLETED", "FINALIZED")

YEAR_ROMAN_MAP = {
    "1": "I", "1ST": "I", "1-ST": "I", "FIRST": "I", "I": "I",
    "2": "II", "2ND": "II", "2-ND": "II", "SECOND": "II", "II": "II",
    "3": "III", "3RD": "III", "3-RD": "III", "THIRD": "III", "III": "III",
    "4": "IV", "4TH": "IV", "4-TH": "IV", "FOURTH": "IV", "IV": "IV",
}

def normalize_year_roman(year_level: Optional[str]) -> str:
    if not year_level:
        return "III"
    cleaned = str(year_level).upper().strip()
    return YEAR_ROMAN_MAP.get(cleaned, "III")

def derive_student_batch(year_level: Optional[str]) -> str:
    """Derives standard academic batch from year level for AY 2026-27."""
    if not year_level:
        return "2025 - 2029"
    cleaned = str(year_level).upper().strip()
    return BATCH_YEAR_MAP.get(cleaned, "2025 - 2029")


def get_coordinator_for_department(dept_code_or_name: Optional[str]) -> str:
    """Retrieves standard coordinator name for department."""
    if not dept_code_or_name:
        return DEPARTMENT_COORDINATORS["DEFAULT"]
    
    code = str(dept_code_or_name).strip()
    if "CS" in code.upper() and "IOT" not in code.upper():
        return DEPARTMENT_COORDINATORS.get("CSE(CS)", DEPARTMENT_COORDINATORS["DEFAULT"])
    elif "IOT" in code.upper():
        return DEPARTMENT_COORDINATORS.get("CSE(IoT)", DEPARTMENT_COORDINATORS["DEFAULT"])
    return DEPARTMENT_COORDINATORS.get(code, DEPARTMENT_COORDINATORS["DEFAULT"])
