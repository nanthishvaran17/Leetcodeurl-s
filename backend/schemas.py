import datetime
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Any, Dict

# Department Schemas
class DepartmentBase(BaseModel):
    name: str
    code: str

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentOut(DepartmentBase):
    id: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True

# Section Schemas
class SectionBase(BaseModel):
    name: str
    department_id: int
    year_level: str

class SectionCreate(SectionBase):
    pass

class SectionOut(SectionBase):
    id: int

    class Config:
        from_attributes = True

# Student Schemas
class StudentBase(BaseModel):
    reg_no: str
    name: str
    department_id: int
    year_level: str
    section_id: Optional[int] = None
    email: Optional[str] = None
    leetcode_url: Optional[str] = None
    codeforces_username: Optional[str] = None
    hackerrank_username: Optional[str] = None
    is_active: bool = True

class StudentCreate(StudentBase):
    pass

class StudentUpdate(BaseModel):
    name: Optional[str] = None
    department_id: Optional[int] = None
    year_level: Optional[str] = None
    section_id: Optional[int] = None
    email: Optional[str] = None
    leetcode_url: Optional[str] = None
    codeforces_username: Optional[str] = None
    hackerrank_username: Optional[str] = None
    is_active: Optional[bool] = None

class LeetCodeStatsOut(BaseModel):
    total_solved: int = 0
    easy_solved: int = 0
    medium_solved: int = 0
    hard_solved: int = 0
    contest_rating: Optional[float] = None
    contest_global_ranking: Optional[int] = None
    public_profile_ranking: Optional[int] = None
    status: str = "DATA UNAVAILABLE"
    last_updated: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True

class StudentOut(StudentBase):
    id: int
    username: Optional[str] = None
    joining_date: datetime.datetime
    department: Optional[DepartmentOut] = None
    section: Optional[SectionOut] = None
    stats: Optional[LeetCodeStatsOut] = None
    
    college_rank: Optional[int] = None
    dept_rank: Optional[int] = None
    year_rank: Optional[int] = None
    section_rank: Optional[int] = None
    weekly_progress: Optional[int] = 0
    streak_count: Optional[int] = 0
    consistency_score: Optional[float] = 0.0
    badge_list: List[str] = []

    class Config:
        from_attributes = True

# Auth & User Schemas
class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str = "Faculty"
    department_id: Optional[int] = None
    section_id: Optional[int] = None

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    role: str
    department_id: Optional[int] = None
    section_id: Optional[int] = None
    is_active: bool
    last_login: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True

# Weekly Session Schemas
class WeeklySessionOut(BaseModel):
    id: int
    academic_year: str
    week_number: int
    session_date: str
    start_time: str
    end_time: str
    status: str
    created_at: datetime.datetime
    completed_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True

# Dashboard Summary Schema
class DashboardSummary(BaseModel):
    total_students: int
    total_departments: int
    total_sections: int
    active_students: int
    not_started_students: int
    total_problems_solved: int
    average_problems_solved: float
    average_weekly_progress: float
    highest_contest_rating: Optional[float]
    top_college_ranker: Optional[str]
    current_session: Optional[WeeklySessionOut]
    next_session_countdown_seconds: int

# Audit Log Schema
class AuditLogOut(BaseModel):
    id: int
    user_name: Optional[str]
    action: str
    details: Optional[str]
    ip_address: Optional[str]
    timestamp: datetime.datetime

    class Config:
        from_attributes = True
