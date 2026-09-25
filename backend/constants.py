"""
Centralized Production Department Constants and Helpers.
Only real academic departments belonging to Nandha Engineering College are allowed in production.
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

    # All real academic departments (CSE, CSE(CS), CSE(IOT), AIDS, ECE, EEE, IT, AGRI, MECH, CIVIL, BME, etc.) are valid
    return True


