from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.database import get_db
from backend.models import Department, Section, User
from backend.schemas import DepartmentOut, DepartmentCreate, SectionOut, SectionCreate
from backend.security import require_security_access, get_current_user_optional

from backend.constants import is_production_department

router = APIRouter(prefix="/api/departments", tags=["Departments"])

_HOD_ROLES = frozenset({"hod", "department hod", "department_hod"})

@router.get("", response_model=List[DepartmentOut])
def get_departments(
    all_depts: bool = False,
    request: Request = None,
    db: Session = Depends(get_db)
):
    """
    Returns the list of departments.
    - HOD users: Returns ONLY their authorized departments (from HODDepartmentAllocation).
    - Admin / Principal / Management / unauthenticated: Returns full production department list.
    """
    all_d = db.query(Department).order_by(Department.id).all()
    if not all_depts:
        all_d = [d for d in all_d if is_production_department(d.code, d.name)]

    for d in all_d:
        if d.code and d.code.upper() == "IT" and d.name != "Information Technology":
            d.name = "Information Technology"
            db.add(d)
            try:
                db.commit()
            except Exception:
                db.rollback()

    # Attempt to get current user (optional — public access still works for leaderboard)
    current_user: Optional[User] = None
    if request:
        try:
            current_user = get_current_user_optional(request, db)
        except Exception:
            current_user = None

    # HOD: restrict to allocated departments only
    if current_user:
        role = (getattr(current_user, "override_role", None) or current_user.role or "").strip().lower()
        if role in _HOD_ROLES:
            from backend.services.authorization_service import get_hod_authorized_department_ids
            authorized_ids = get_hod_authorized_department_ids(db, current_user)
            if authorized_ids:
                all_d = [d for d in all_d if d.id in authorized_ids]
            else:
                # HOD with no allocations — return empty list (fail closed)
                all_d = []

    return all_d


@router.post("", response_model=DepartmentOut)
def create_department(
    dept_in: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_security_access(resource_name="Create Department", required_roles=["admin", "super admin"]))
):
    existing = db.query(Department).filter(
        (Department.name.ilike(dept_in.name)) | (Department.code.ilike(dept_in.code))
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Department with this name or code already exists.")

    dept = Department(name=dept_in.name, code=dept_in.code.upper())
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept

@router.get("/{dept_id}/sections", response_model=List[SectionOut])
def get_department_sections(dept_id: int, year_level: str = None, db: Session = Depends(get_db)):
    query = db.query(Section).filter(Section.department_id == dept_id)
    if year_level:
        query = query.filter(Section.year_level == year_level)
    return query.all()

@router.post("/{dept_id}/sections", response_model=SectionOut)
def create_section(
    dept_id: int,
    sec_in: SectionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_security_access(resource_name="Create Section", required_roles=["admin", "super admin"]))
):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    sec = Section(name=sec_in.name.upper(), department_id=dept_id, year_level=sec_in.year_level)
    db.add(sec)
    db.commit()
    db.refresh(sec)
    return sec
