from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db
from backend.models import Department, Section, Student
from backend.schemas import DepartmentOut, DepartmentCreate, SectionOut, SectionCreate
from backend.routes.auth import get_current_user
from backend.security import require_security_access

router = APIRouter(prefix="/api/departments", tags=["Departments"])

@router.get("", response_model=List[DepartmentOut])
def get_departments(
    db: Session = Depends(get_db),
    current_user=Depends(require_security_access(resource_name="Department Analytics", dept_scoped=True))
):
    return db.query(Department).order_by(Department.name).all()

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
