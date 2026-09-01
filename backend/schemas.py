import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import List, Optional, Any, Dict, Union

# Department Schemas
class DepartmentBase(BaseModel):
    name: str
    code: str

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentOut(DepartmentBase):
    id: int
    created_at: datetime.datetime
    model_config = ConfigDict(from_attributes=True)

# Section Schemas
class SectionBase(BaseModel):
    name: str
    department_id: int
    year_level: str

class SectionCreate(SectionBase):
    pass

class SectionOut(SectionBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

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
    total_solved: Optional[int] = None
    easy_solved: Optional[int] = None
    medium_solved: Optional[int] = None
    hard_solved: Optional[int] = None
    contest_rating: Optional[float] = None
    contest_global_ranking: Optional[int] = None
    public_profile_ranking: Optional[int] = None
    recent_contest_name: Optional[str] = None
    recent_contest_score: Optional[str] = None
    status: str = "pending"
    sync_status: Optional[str] = "not_started"
    validation_status: Optional[str] = None
    source: Optional[str] = None
    error_message: Optional[str] = None
    error_code: Optional[str] = None
    last_successful_sync: Optional[datetime.datetime] = None
    last_verified_at: Optional[datetime.datetime] = None
    last_attempt_at: Optional[datetime.datetime] = None
    retry_count: Optional[int] = 0
    fetch_duration: Optional[float] = None
    last_updated: Optional[datetime.datetime] = None
    model_config = ConfigDict(from_attributes=True)

class ContestResultOut(BaseModel):
    contest_name: Optional[str] = "Weekly Contest"
    contest_number: Optional[int] = None
    contest_date: Optional[str] = None
    questions_solved: int = 0
    questions_total: int = 4
    score_display: str = "Not Attended"
    contest_rank: Optional[int] = None
    contest_rating: Optional[float] = None
    top_percentage: Optional[float] = None
    status: str = "NOT_ATTENDED"
    fetched_at: Optional[str] = None

class CanonicalProfileOut(BaseModel):
    canonical_username: Optional[str] = None
    profile_url: Optional[str] = None
    real_name: Optional[str] = None
    avatar_url: Optional[str] = None
    about_me: Optional[str] = None
    school: Optional[str] = None
    company: Optional[str] = None
    country: Optional[str] = None
    reputation: Optional[int] = None
    verification_status: str = "PENDING_USERNAME"
    sync_state: str = "PENDING_USERNAME"
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    last_verified_at: Optional[datetime.datetime] = None
    last_synced_at: Optional[datetime.datetime] = None
    model_config = ConfigDict(from_attributes=True)

class CanonicalProblemStatsOut(BaseModel):
    total_solved: Optional[int] = None
    easy_solved: Optional[int] = None
    medium_solved: Optional[int] = None
    hard_solved: Optional[int] = None
    total_submission_count: Optional[int] = None
    profile_global_ranking: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

class CanonicalContestOut(BaseModel):
    contest_rating: Optional[float] = None
    contest_global_ranking: Optional[int] = None
    attended_count: Optional[int] = None
    top_percentage: Optional[float] = None
    most_recent_contest_name: Optional[str] = None
    most_recent_contest_type: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class CanonicalActivityOut(BaseModel):
    total_active_days: Optional[int] = None
    current_streak: Optional[int] = None
    longest_streak: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

class StudentOut(StudentBase):
    id: int
    username: Optional[str] = None
    canonical_username: Optional[str] = None
    profile_url: Optional[str] = None
    real_name: Optional[str] = None
    avatar_url: Optional[str] = None
    sync_state: Optional[str] = "PENDING_USERNAME"
    joining_date: Optional[Union[datetime.datetime, datetime.date, str]] = None
    version: Optional[int] = None
    department: Optional[DepartmentOut] = None
    section: Optional[SectionOut] = None
    stats: Optional[LeetCodeStatsOut] = None

    lc_profile: Optional[CanonicalProfileOut] = None
    lc_problem_stats: Optional[CanonicalProblemStatsOut] = None
    lc_contest_standing: Optional[CanonicalContestOut] = None
    lc_activity: Optional[CanonicalActivityOut] = None
    
    college_rank: Optional[int] = None
    dept_rank: Optional[int] = None
    year_rank: Optional[int] = None
    section_rank: Optional[int] = None
    weekly_progress: Optional[int] = 0
    streak_count: Optional[int] = 0
    longest_streak: Optional[int] = 0
    total_active_days: Optional[int] = 0
    consistency_score: Optional[float] = 0.0
    badge_list: List[str] = []
    contest_status: Optional[str] = None
    contest_solved: Optional[int] = 0
    contest_score_display: Optional[str] = None
    contest_name: Optional[str] = None
    contest_number: Optional[int] = None
    has_virtual: Optional[bool] = False
    model_config = ConfigDict(from_attributes=True, extra="allow")

class StudentListOut(StudentBase):
    id: int
    username: Optional[str] = None
    canonical_username: Optional[str] = None
    profile_url: Optional[str] = None
    real_name: Optional[str] = None
    avatar_url: Optional[str] = None
    sync_state: Optional[str] = "PENDING_USERNAME"
    joining_date: Optional[Union[datetime.datetime, datetime.date, str]] = None
    version: Optional[int] = None
    department: Optional[DepartmentOut] = None
    section: Optional[SectionOut] = None
    stats: Optional[LeetCodeStatsOut] = None
    
    college_rank: Optional[int] = None
    dept_rank: Optional[int] = None
    year_rank: Optional[int] = None
    section_rank: Optional[int] = None
    weekly_progress: Optional[int] = 0
    streak_count: Optional[int] = 0
    longest_streak: Optional[int] = 0
    total_active_days: Optional[int] = 0
    consistency_score: Optional[float] = 0.0
    badge_list: List[str] = []
    contest_status: Optional[str] = None
    contest_solved: Optional[int] = 0
    contest_score_display: Optional[str] = None
    contest_name: Optional[str] = None
    contest_number: Optional[int] = None
    has_virtual: Optional[bool] = False
    model_config = ConfigDict(from_attributes=True, extra="allow")

class StudentPaginatedOut(BaseModel):
    total: int
    items: List[StudentListOut]
    page: int
    limit: int
    total_pages: int

class LeaderboardPaginatedOut(BaseModel):
    total: int
    items: List[StudentOut]
    page: int
    limit: int
    total_pages: int
    longest_streak: Optional[int] = 0
    total_active_days: Optional[int] = 0
    consistency_score: Optional[float] = 0.0
    badge_list: List[str] = []

    public_contest_result: Optional[ContestResultOut] = None
    virtual_contest_result: Optional[ContestResultOut] = None
    overall_participation_mode: Optional[str] = "NONE"
    contest_status: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# Auth & User Schemas
class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class UserCreate(BaseModel):
    full_name: str
    username: str
    email: str
    password: Optional[str] = None
    role: str = "Faculty"
    designation: Optional[str] = None
    department_id: Optional[int] = None
    section_id: Optional[int] = None
    academic_year: Optional[str] = None
    reporting_manager_id: Optional[int] = None
    is_active: bool = True
    require_password_change: bool = True

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    designation: Optional[str] = None
    role: Optional[str] = None
    department_id: Optional[int] = None
    reporting_manager_id: Optional[int] = None
    is_active: Optional[bool] = None

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    role: str
    department_id: Optional[int] = None
    section_id: Optional[int] = None
    is_active: bool
    last_login: Optional[datetime.datetime] = None
    model_config = ConfigDict(from_attributes=True)

class VerifyDobRequest(BaseModel):
    email: str
    date_of_birth: str

class ForgotPasswordRequest(BaseModel):
    institutional_id: str
    email: str
    date_of_birth: str

class ForgotPasswordVerifyRequest(BaseModel):
    institutional_id: str
    email: str
    otp: str

class ResetPasswordSubmitRequest(BaseModel):
    institutional_id: str
    email: str
    otp: str
    new_password: str

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
    model_config = ConfigDict(from_attributes=True)

class DashboardScope(BaseModel):
    total_students: int
    total_departments: int
    total_sections: int

class DashboardSync(BaseModel):
    is_running: bool
    processed: int
    total: int
    percentage: float

class DashboardVerification(BaseModel):
    verified: int
    pending: int
    failed: int
    no_username: int

class DashboardPerformance(BaseModel):
    total_problems_solved: int
    active_students: int
    average_problems_solved: float
    average_weekly_progress: float
    highest_contest_rating: float
    top_college_ranker: Optional[str] = None

class DashboardSessionContext(BaseModel):
    current_session: Optional[WeeklySessionOut] = None
    is_session_live: bool = False
    session_phase: str = "SCHEDULED"
    next_session_countdown_seconds: int = 86400

class DashboardSummary(BaseModel):
    scope: DashboardScope
    sync: DashboardSync
    verification: DashboardVerification
    performance: DashboardPerformance
    session: DashboardSessionContext
    model_config = ConfigDict(from_attributes=True)

# Audit Log Schema
class AuditLogOut(BaseModel):
    id: int
    user_name: Optional[str]
    action: str
    details: Optional[str]
    ip_address: Optional[str]
    timestamp: datetime.datetime
    model_config = ConfigDict(from_attributes=True)

class StudentStatSnapshotOut(BaseModel):
    id: int
    student_id: int
    total_solved: Optional[int] = None
    easy_solved: Optional[int] = None
    medium_solved: Optional[int] = None
    hard_solved: Optional[int] = None
    contest_rating: Optional[float] = None
    global_rank: Optional[int] = None
    delta_total: Optional[int] = 0
    delta_easy: Optional[int] = 0
    delta_medium: Optional[int] = 0
    delta_hard: Optional[int] = 0
    delta_rating: Optional[float] = 0.0
    captured_at: datetime.datetime
    sync_run_id: Optional[str] = None
    source: Optional[str] = "leetcode_public_profile"
    model_config = ConfigDict(from_attributes=True)

class ImproverOut(BaseModel):
    student_id: int
    reg_no: str
    name: str
    department_code: str
    year_level: str
    section_name: Optional[str] = "A"
    total_solved: Optional[int] = 0
    easy_solved: int = 0
    medium_solved: int = 0
    hard_solved: int = 0
    delta_solved: int
    delta_easy: int
    delta_medium: int
    delta_hard: int
    delta_rating: float
    current_contest_rating: Optional[float] = None

class SendOtpRequest(BaseModel):
    email: str

class VerifyOtpRequest(BaseModel):
    email: str
    otp: str
    request_id: Optional[str] = None

class AIAssistantContext(BaseModel):
    page: Optional[str] = None
    section: Optional[str] = None
    department: Optional[str] = None
    year: Optional[str] = None
    contest: Optional[str] = None
    role: Optional[str] = None

class AIAssistantMessage(BaseModel):
    sender: str
    text: str

class AIAssistantRequest(BaseModel):
    message: str
    mode: Optional[str] = "institutional" # "operations" | "institutional"
    history: Optional[List[Dict[str, Any]]] = None
    context: Optional[AIAssistantContext] = None

class AIAssistantResponse(BaseModel):
    success: bool
    answer: str
    why: Optional[str] = None
    evidence: Optional[str] = None
    confidence: Optional[str] = "VERIFIED"
    actionLabel: Optional[str] = None
    actionTab: Optional[str] = None
    source: str
    dataStatus: str
    requestId: str
