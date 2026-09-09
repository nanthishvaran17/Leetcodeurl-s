"""
Centralized Production Department Constants and Helpers.
Only real academic departments belonging to Nandha Engineering College are allowed in production.
"""

EXCLUDED_DEPT_KEYWORDS = ["TEST", "DEMO", "DEV", "TEMP"]

def is_production_department(code: str, name: str = "") -> bool:
    if not code:
        return False
    code_upper = code.upper().strip()
    name_upper = name.upper().strip() if name else ""

    for kw in EXCLUDED_DEPT_KEYWORDS:
        if kw in code_upper or kw in name_upper:
            return False

    return True
