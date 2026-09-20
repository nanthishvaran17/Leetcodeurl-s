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
    combined = f"{code_upper} {name_upper}"
    
    for kw in EXCLUDED_DEPT_KEYWORDS:
        if kw in code_upper or kw in name_upper:
            return False

    # Production website strictly operates ONLY on:
    # 1. Cyber Security - CSE(CS)
    # 2. IoT - CSE(IOT)
    # 3. IT - Information Technology
    if code_upper in ("CSE(CS)", "CSE-CS", "CSE_CS", "CS", "1") or "CYBER" in combined or "CSE(CS)" in combined or "CSE (CS)" in combined:
        return True
    if code_upper in ("CSE(IOT)", "CSE-IOT", "CSE_IOT", "IOT", "2") or "IOT" in combined or "INTERNET" in combined or "CSE(IOT)" in combined or "CSE (IOT)" in combined:
        return True
    if code_upper in ("IT", "7") or "INFORMATION TECHNOLOGY" in combined or "INFO TECH" in combined or "B.TECH IT" in combined or "B.TECH (IT)" in combined:
        return True

    return False

