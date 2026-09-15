"""
Centralized Production Department Constants and Helpers.
Only real academic departments belonging to Nandha Engineering College are allowed in production.
"""

EXCLUDED_DEPT_KEYWORDS = ["TEST", "DEMO", "DEV", "TEMP"]

def is_production_department(code: str, name: str = "") -> bool:
    if not code:
        return False
    code_upper = code.upper().strip()
    
    # User explicitly requested ONLY Cyber Security and IoT to be visible on the leaderboard
    ALLOWED_CODES = ["CSE(CS)", "CSE(IOT)"]
    if code_upper not in ALLOWED_CODES:
        return False

    return True
