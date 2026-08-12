import datetime
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

class ReportConfig(BaseModel):
    report_type: str = Field(default="STUDENT_PERFORMANCE", description="COLLEGE_EXECUTIVE, STUDENT_PERFORMANCE, DEPARTMENT_PERFORMANCE, BATCH_PERFORMANCE, CONTEST_PERFORMANCE, STUDENT_MASTER, LEADERBOARD, CUSTOM")
    department: str = Field(default="ALL", description="ALL, CSE(CS), CSE(IOT)")
    year: str = Field(default="ALL", description="ALL, II, III, IV")
    output_scope: str = Field(default="COLLEGE", description="COLLEGE, DEPARTMENT, YEAR, DEPT_YEAR, CUSTOM")
    batch: Optional[str] = None
    filters: Optional[Dict[str, Any]] = {}

class StudentRow(BaseModel):
    s_no: int
    reg_no: str
    name: str
    dept: str
    year: str
    section: str = ""
    leetcode_url: str = ""
    username: str = ""
    easy: Optional[int] = 0
    medium: Optional[int] = 0
    hard: Optional[int] = 0
    total_solved: Optional[int] = 0
    contest_rating: Optional[float] = None
    global_rank: Optional[int] = None
    category: str = "0 Solved"
    status: str = "UNVERIFIED"

class ContestRow(BaseModel):
    s_no: int
    contest_name: str
    date: str
    reg_no: str
    student_name: str
    dept: str
    year: str
    problems_solved: int = 0
    total_problems: int = 4
    rank: str = "-"
    verified_at: Optional[str] = None

class CategorySummary(BaseModel):
    category_name: str
    student_count: int
    percentage: float

class DataQualitySummary(BaseModel):
    total_students: int = 0
    valid_count: int = 0
    unverified_count: int = 0
    missing_username_count: int = 0
    duplicate_reg_no_count: int = 0
    invalid_url_count: int = 0
    warnings: List[str] = []

class ReportDataset(BaseModel):
    report_id: str
    report_type: str
    title: str
    generated_at: str
    verified_at: str
    data_status: str
    message: Optional[str] = None
    config: Dict[str, Any]
    metrics: Dict[str, Any]
    distribution: Dict[str, int]
    data_quality: DataQualitySummary
    top_students: List[Dict[str, Any]] = []
    all_students: List[Dict[str, Any]] = []
    participations: List[Dict[str, Any]] = []

