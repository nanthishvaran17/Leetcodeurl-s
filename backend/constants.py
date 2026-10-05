"""
Centralized Production Department Constants and Helpers.
Only the 3 active institutional departments are shown across all pages and filters.
"""

# Exclusive whitelist — only these 3 department codes are active institution-wide.
ACTIVE_DEPARTMENT_CODES = frozenset({"CSE(CS)", "CSE(IOT)", "IT"})

EXCLUDED_DEPT_KEYWORDS = ["TEST", "DEMO", "DEV", "TEMP", "CSE-EDIT-TEST", "CSE_TEST"]

def is_production_department(code: str, name: str = "") -> bool:
    if not code and not name:
        return False
    code_upper = (code or "").upper().strip()
    name_upper = (name or "").upper().strip()

    for kw in EXCLUDED_DEPT_KEYWORDS:
        if kw in code_upper or kw in name_upper:
            return False

    # Only allow the 3 officially active departments
    return code_upper in {c.upper() for c in ACTIVE_DEPARTMENT_CODES}


