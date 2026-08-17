"""
Report Layer Central Configuration
AY 2026-27 Standardized Batches, Department Coordinators, and Statuses.
"""
from typing import Dict, Any, List, Optional

BATCH_YEAR_MAP = {
    "I": "2026 - 2030",
    "1": "2026 - 2030",
    "II": "2025 - 2029",
    "2": "2025 - 2029",
    "III": "2024 - 2028",
    "3": "2024 - 2028",
    "IV": "2023 - 2027",
    "4": "2023 - 2027",
}

BATCH_CONFIG = [
    {"key": "2026_2030", "label": "2026 - 2030", "year": "I"},
    {"key": "2025_2029", "label": "2025 - 2029", "year": "II"},
    {"key": "2024_2028", "label": "2024 - 2028", "year": "III"},
    {"key": "2023_2027", "label": "2023 - 2027", "year": "IV"},
]

DEPARTMENT_COORDINATORS = {
    "CSE(CS)": "M. Santhoshkumar, AP / CSE (Cyber Security)",
    "CSE(IoT)": "Mohan Gandhi S",
    "CSE(IOT)": "Mohan Gandhi S",
    "DEFAULT": "Dr. S. Prabhu, M.E., Ph.D. / Associate Professor & Head - CSE (Cyber Security)",
}

FINALIZED_STATUSES = ("COMPLETED", "FINALIZED")


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
