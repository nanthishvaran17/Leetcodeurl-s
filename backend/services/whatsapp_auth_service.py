"""
whatsapp_auth_service.py — Secure WhatsApp Identity & 4-Tier Role Resolver

Responsibilities:
1. Normalizes phone numbers to standard E.164 (+91 format).
2. Resolves incoming WhatsApp sender to existing User (Principal, HOD, Faculty) or Student.
3. Enforces 4-tier role boundaries:
   - PRINCIPAL (Full Institutional Scope)
   - HOD (Department Scoped: department_id)
   - FACULTY (Mentee Scoped: assigned_student_ids)
   - STUDENT (Self Scoped: student_id)
   - UNREGISTERED (Zero access - onboarding prompt only)
4. No separate database: directly queries existing User and Student tables.
"""

import re
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_

from backend.models import User, Student
from backend.logger import logger


@dataclass
class WhatsAppIdentity:
    phone_number: str
    user_type: str                  # 'USER', 'STUDENT', 'UNREGISTERED'
    role: str                       # 'PRINCIPAL', 'HOD', 'FACULTY', 'STUDENT', 'UNREGISTERED'
    display_role: str               # Human-readable title
    user_id: Optional[int]          # User.id or Student.id
    name: str                       # Full name or username
    department_id: Optional[int] = None
    department_code: Optional[str] = None
    assigned_student_ids: List[int] = field(default_factory=list)
    student_id: Optional[int] = None
    is_verified: bool = False

    def is_authorized_for_student(self, target_student_id: int, target_dept_id: Optional[int] = None) -> bool:
        """Enforces 4-tier role scoping on any student record access."""
        if self.role == "PRINCIPAL":
            return True
        elif self.role == "HOD":
            return self.department_id is not None and self.department_id == target_dept_id
        elif self.role == "FACULTY":
            return target_student_id in self.assigned_student_ids
        elif self.role == "STUDENT":
            return self.student_id == target_student_id
        return False

    def is_authorized_for_department(self, target_dept_id: int) -> bool:
        """Enforces 4-tier role scoping on department data access."""
        if self.role == "PRINCIPAL":
            return True
        elif self.role == "HOD":
            return self.department_id == target_dept_id
        return False


class WhatsAppAuthService:

    @staticmethod
    def normalize_phone_number(raw_phone: str) -> str:
        """
        Normalizes any phone format (e.g. 'whatsapp:+919876543210', '+91 98765-43210', '09876543210', '9876543210')
        into a standard E.164 string: '+919876543210'.
        """
        if not raw_phone:
            return ""
        
        cleaned = str(raw_phone).strip()
        if cleaned.lower().startswith("whatsapp:"):
            cleaned = cleaned[9:].strip()
        
        # Remove non-digits except leading plus
        has_plus = cleaned.startswith("+")
        digits = re.sub(r"\D", "", cleaned)

        if not digits:
            return ""

        # If 10 digits (standard Indian mobile), prepend +91
        if len(digits) == 10:
            return f"+91{digits}"
        # If 11 digits starting with 0, replace 0 with +91
        elif len(digits) == 11 and digits.startswith("0"):
            return f"+91{digits[1:]}"
        # If 12 digits starting with 91, prepend +
        elif len(digits) == 12 and digits.startswith("91"):
            return f"+{digits}"
        
        return f"+{digits}" if has_plus else f"+{digits}"

    @classmethod
    def get_phone_variants(cls, phone_number: str) -> List[str]:
        """Generates all common database storage variants for resilient lookup."""
        normalized = cls.normalize_phone_number(phone_number)
        if not normalized:
            return []
        
        digits = re.sub(r"\D", "", normalized)
        variants = [normalized, digits]
        
        # If Indian number (+91XXXXXXXXXX)
        if digits.startswith("91") and len(digits) == 12:
            pure_10 = digits[2:]
            variants.extend([pure_10, f"0{pure_10}", f"+91 {pure_10}", f"91{pure_10}"])
            
        return list(set(variants))

    @classmethod
    def resolve_identity(cls, db: Session, raw_phone: str) -> WhatsAppIdentity:
        """
        Dual Identity Resolver:
        Resolves incoming phone number to an authenticated User or Student with 4-tier role boundaries.
        """
        normalized = cls.normalize_phone_number(raw_phone)
        variants = cls.get_phone_variants(raw_phone)

        if not variants:
            return WhatsAppIdentity(
                phone_number="",
                user_type="UNREGISTERED",
                role="UNREGISTERED",
                display_role="Guest",
                user_id=None,
                name="Guest",
                is_verified=False
            )

        # 1. Check User table (Principal, Super Admin, HOD, Faculty)
        user = db.query(User).options(
            joinedload(User.department),
            joinedload(User.assigned_students)
        ).filter(
            or_(*[User.phone_number == v for v in variants]),
            User.is_active == True
        ).first()

        if user:
            role_raw = (user.role or "Faculty").strip()
            dept_code = user.department.code if user.department else "ALL"
            
            # A. Principal / Super Admin
            if role_raw in ["Super Admin", "super admin", "Admin", "admin", "Principal", "principal"]:
                return WhatsAppIdentity(
                    phone_number=normalized,
                    user_type="USER",
                    role="PRINCIPAL",
                    display_role="Principal / Super Admin",
                    user_id=user.id,
                    name=user.username,
                    department_id=user.department_id,
                    department_code=dept_code,
                    is_verified=True
                )
            
            # B. HOD
            elif role_raw in ["HOD", "hod", "Head of Department"]:
                return WhatsAppIdentity(
                    phone_number=normalized,
                    user_type="USER",
                    role="HOD",
                    display_role=f"HOD ({dept_code})",
                    user_id=user.id,
                    name=user.username,
                    department_id=user.department_id,
                    department_code=dept_code,
                    is_verified=True
                )
            
            # C. Faculty Mentor
            else:
                assigned_ids = [
                    a.student_id for a in user.assigned_students
                    if a.is_active != False
                ]
                return WhatsAppIdentity(
                    phone_number=normalized,
                    user_type="USER",
                    role="FACULTY",
                    display_role=f"Faculty Mentor ({dept_code})",
                    user_id=user.id,
                    name=user.username,
                    department_id=user.department_id,
                    department_code=dept_code,
                    assigned_student_ids=assigned_ids,
                    is_verified=True
                )

        # 2. Check Student table
        student = db.query(Student).options(
            joinedload(Student.department)
        ).filter(
            or_(*[Student.phone_number == v for v in variants]),
            Student.is_active == True
        ).first()

        if student:
            dept_code = student.department.code if student.department else "CSE"
            return WhatsAppIdentity(
                phone_number=normalized,
                user_type="STUDENT",
                role="STUDENT",
                display_role=f"Student ({student.reg_no})",
                user_id=student.id,
                student_id=student.id,
                name=student.name,
                department_id=student.department_id,
                department_code=dept_code,
                is_verified=True
            )

        # 3. Unregistered phone number
        return WhatsAppIdentity(
            phone_number=normalized,
            user_type="UNREGISTERED",
            role="UNREGISTERED",
            display_role="Unregistered Number",
            user_id=None,
            name="Guest User",
            is_verified=False
        )

    @classmethod
    def link_phone_number(
        cls,
        db: Session,
        target_type: str,
        target_id: int,
        phone_number: str
    ) -> Dict[str, Any]:
        """
        Links and verifies a phone number for an existing User or Student.
        Prevents duplicate binding of the same phone number to multiple accounts.
        """
        normalized = cls.normalize_phone_number(phone_number)
        if not normalized:
            return {"success": False, "error": "Invalid phone number format."}

        target_type_upper = target_type.upper().strip()

        # Check if phone is already used by another entity
        existing_user = db.query(User).filter(User.phone_number == normalized).first()
        existing_student = db.query(Student).filter(Student.phone_number == normalized).first()

        if target_type_upper == "USER":
            if existing_user and existing_user.id != target_id:
                return {"success": False, "error": f"Phone number {normalized} is already linked to user '{existing_user.username}'."}
            if existing_student:
                return {"success": False, "error": f"Phone number {normalized} is already linked to student '{existing_student.reg_no}'."}

            user = db.query(User).filter(User.id == target_id).first()
            if not user:
                return {"success": False, "error": f"User ID {target_id} not found."}

            user.phone_number = normalized
            user.whatsapp_verified = True
            db.commit()
            logger.info(f"[WHATSAPP_LINK] Linked phone {normalized} to User '{user.username}' ({user.role}).")
            return {
                "success": True,
                "target_type": "USER",
                "id": user.id,
                "name": user.username,
                "role": user.role,
                "phone_number": normalized
            }

        elif target_type_upper == "STUDENT":
            if existing_student and existing_student.id != target_id:
                return {"success": False, "error": f"Phone number {normalized} is already linked to student '{existing_student.reg_no}'."}
            if existing_user:
                return {"success": False, "error": f"Phone number {normalized} is already linked to user '{existing_user.username}'."}

            student = db.query(Student).filter(Student.id == target_id).first()
            if not student:
                return {"success": False, "error": f"Student ID {target_id} not found."}

            student.phone_number = normalized
            student.whatsapp_verified = True
            db.commit()
            logger.info(f"[WHATSAPP_LINK] Linked phone {normalized} to Student '{student.name}' ({student.reg_no}).")
            return {
                "success": True,
                "target_type": "STUDENT",
                "id": student.id,
                "name": student.name,
                "reg_no": student.reg_no,
                "phone_number": normalized
            }

        return {"success": False, "error": f"Unsupported target_type '{target_type}'. Use 'USER' or 'STUDENT'."}


whatsapp_auth_service = WhatsAppAuthService()
