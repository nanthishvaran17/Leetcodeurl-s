import re
import logging

logger = logging.getLogger(__name__)

DEPARTMENT_CODE_MAP = {
    "CC": "Cyber Security",
    "CI": "IoT",
    "CS": "Computer Science",
    "EC": "Electronics and Communication",
    "EE": "Electrical and Electronics",
    "ME": "Mechanical Engineering",
    "CE": "Civil Engineering",
    "IT": "Information Technology",
    "AI": "Artificial Intelligence",
    "AD": "Artificial Intelligence and Data Science",
    "BM": "Biomedical Engineering",
    "AG": "Agriculture Engineering",
    "CH": "Chemical Engineering"
}

def normalize_registration(reg_no: str) -> str:
    """
    Safely normalizes registration number:
    - Strips whitespace
    - Converts to uppercase
    """
    if not reg_no:
        return ""
    return reg_no.strip().upper()

def extract_department_code(reg_no: str) -> str:
    """
    Extracts the alphabetical department code from standard registration format.
    Example: 732225CC001 -> CC
    """
    normalized = normalize_registration(reg_no)
    match = re.search(r'[A-Z]+', normalized)
    if match:
        return match.group(0)
    return ""

def generate_institutional_email(reg_no: str) -> str:
    """
    Generates the institutional email from the registration number.
    Rules:
    - If reg_no starts with '7322' and length is 11, check the year (digits 5-6).
    - If year <= 24 (e.g. 23 or 24), email is reg_no[4:] + "@nandhaengg.org"
    - If year >= 25, email is reg_no + "@nandhaengg.org"
    """
    normalized = normalize_registration(reg_no)
    if not normalized:
        return ""
    
    if normalized.startswith("7322") and len(normalized) == 11:
        try:
            year = int(normalized[4:6])
            if year <= 24:
                return f"{normalized[4:]}@nandhaengg.org".lower()
        except ValueError:
            pass
            
    return f"{normalized}@nandhaengg.org".lower()

def check_and_generate_email(db_session, reg_no: str, current_assigned: str = None) -> dict:
    """
    Checks if the registration number is valid, generates the email,
    and checks for database uniqueness.
    
    Returns a dictionary:
    {
        "status": "generated" | "needs_verification" | "error",
        "email": str | None,
        "message": str
    }
    """
    from backend.models import Student
    
    normalized_reg = normalize_registration(reg_no)
    if not normalized_reg:
        return {"status": "error", "email": None, "message": "Invalid registration number."}
        
    generated_email = generate_institutional_email(normalized_reg)
    
    # If the student already has this exact email assigned, no-op
    if current_assigned and current_assigned.lower() == generated_email.lower():
        return {"status": "generated", "email": generated_email, "message": "Email already up to date."}
        
    # Check for duplicate
    existing = db_session.query(Student).filter(Student.institutional_email == generated_email).first()
    if existing and existing.reg_no != normalized_reg:
        return {
            "status": "needs_verification", 
            "email": None, 
            "message": f"Generated email {generated_email} is already in use by another student."
        }
        
    return {"status": "generated", "email": generated_email, "message": "Email generated successfully."}
