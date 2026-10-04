"""
Report Layer Central Configuration
AY 2026-27 Standardized Batches, Department Coordinators, and Statuses.
"""
from typing import Optional

BATCH_YEAR_MAP = {
    "I": "2026 - 2030",
    "1": "2026 - 2030",
    "1ST": "2026 - 2030",
    "1-ST": "2026 - 2030",
    "FIRST": "2026 - 2030",
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
    {"key": "2026_2030", "label": "2026 - 2030", "year": "I"},
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

def normalize_year_roman(year_level: Optional[str] = None, reg_no: Optional[str] = None) -> str:
    """
    Derives and normalizes academic year strictly to canonical Roman numerals: 'I', 'II', 'III', 'IV'.
    Rules:
    - 23 / 732223... -> 'IV'
    - 24 / 732224... -> 'III'
    - 25 / 732225... -> 'II'
    - 26 / 732226... -> 'I'
    - '4', '4th', 'IV' -> 'IV'
    - '3', '3rd', 'III' -> 'III'
    - '2', '2nd', 'II' -> 'II'
    - '1', '1st', 'I' -> 'I'
    """
    reg_clean = (str(reg_no or "")).upper().strip()
    if reg_clean:
        if "732223" in reg_clean or "23CC" in reg_clean or "23CI" in reg_clean or "23CS" in reg_clean or "23IT" in reg_clean or "23AI" in reg_clean or "23EC" in reg_clean or "23EE" in reg_clean or "23ME" in reg_clean or reg_clean.startswith("23"):
            return "IV"
        if "732224" in reg_clean or "24CC" in reg_clean or "24CI" in reg_clean or "24CS" in reg_clean or "24IT" in reg_clean or "24AI" in reg_clean or "24EC" in reg_clean or "24EE" in reg_clean or "24ME" in reg_clean or reg_clean.startswith("24"):
            return "III"
        if "732225" in reg_clean or "73225" in reg_clean or "25CC" in reg_clean or "25CI" in reg_clean or "25CS" in reg_clean or "25IT" in reg_clean or "25AI" in reg_clean or "25EC" in reg_clean or "25EE" in reg_clean or "25ME" in reg_clean or reg_clean.startswith("25"):
            return "II"
        if "732226" in reg_clean or "26CC" in reg_clean or "26CI" in reg_clean or "26CS" in reg_clean or "26IT" in reg_clean or "26AI" in reg_clean or "26EC" in reg_clean or "26EE" in reg_clean or "26ME" in reg_clean or reg_clean.startswith("26"):
            return "I"

    if year_level:
        cleaned = str(year_level).upper().replace("YEAR", "").replace("YR", "").strip()
        if cleaned in YEAR_ROMAN_MAP:
            return YEAR_ROMAN_MAP[cleaned]
        if "2027" in cleaned or "2023-2027" in cleaned:
            return "IV"
        if "2028" in cleaned or "2024-2028" in cleaned:
            return "III"
        if "2029" in cleaned or "2025-2029" in cleaned:
            return "II"
        if "2030" in cleaned or "2026-2030" in cleaned:
            return "I"

    return "III"

def derive_student_batch(year_level: Optional[str]) -> str:
    """Derives standard academic batch from year level for AY 2026-27."""
    if not year_level:
        return "2025 - 2029"
    cleaned = year_level.upper().replace("YEAR", "").strip()
    return BATCH_YEAR_MAP.get(cleaned, "2025 - 2029")


def get_coordinator_for_department(dept_code_or_name: Optional[str]) -> str:
    """Retrieves standard coordinator name for department."""
    if not dept_code_or_name:
        return DEPARTMENT_COORDINATORS["DEFAULT"]
    
    code = dept_code_or_name.strip()
    if "CS" in code.upper() and "IOT" not in code.upper():
        return DEPARTMENT_COORDINATORS.get("CSE(CS)", DEPARTMENT_COORDINATORS["DEFAULT"])
    elif "IOT" in code.upper():
        return DEPARTMENT_COORDINATORS.get("CSE(IoT)", DEPARTMENT_COORDINATORS["DEFAULT"])
    return DEPARTMENT_COORDINATORS.get(code, DEPARTMENT_COORDINATORS["DEFAULT"])
