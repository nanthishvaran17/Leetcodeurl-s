"""
Centralized Production Department Constants and Helpers.
Includes all valid institutional departments across pages and filters.
"""

EXCLUDED_DEPT_KEYWORDS = ["TEST", "DEMO", "DEV", "TEMP", "CSE-EDIT-TEST", "CSE_TEST"]

def is_production_department(code: str, name: str = "") -> bool:
    if not code and not name:
        return False
    code_upper = (code or "").upper().strip()
    name_upper = (name or "").upper().strip()

    for kw in EXCLUDED_DEPT_KEYWORDS:
        if kw in code_upper or kw in name_upper:
            return False

    return True


