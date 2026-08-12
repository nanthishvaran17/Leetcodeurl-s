import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from backend.database import Base

class Department(Base):
    __tablename__ = "departments"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    students = relationship("Student", back_populates="department")
    users = relationship("User", back_populates="department")

class AcademicYear(Base):
    __tablename__ = "academic_years"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(20), unique=True, nullable=False) # e.g., 2025-26
    is_current = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Section(Base):
    __tablename__ = "sections"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(10), nullable=False) # A, B, C, etc.
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    year_level = Column(String(10), nullable=False) # II, III, IV

    department = relationship("Department")
    students = relationship("Student", back_populates="section")

class Student(Base):
    __tablename__ = "students"
    
    id = Column(Integer, primary_key=True, index=True)
    reg_no = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(150), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    year_level = Column(String(10), nullable=False) # II, III, IV
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=True)
    email = Column(String(150), nullable=True)
    
    leetcode_url = Column(String(255), nullable=True)
    username = Column(String(100), index=True, nullable=True)
    codeforces_username = Column(String(100), nullable=True)
    hackerrank_username = Column(String(100), nullable=True)
    
    is_active = Column(Boolean, default=True)
    joining_date = Column(DateTime, default=datetime.datetime.utcnow)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    department = relationship("Department", back_populates="students")
    section = relationship("Section", back_populates="students")
    stats = relationship("LeetCodeProfileStats", back_populates="student", uselist=False, cascade="all, delete-orphan")
    progress_records = relationship("WeeklyStudentProgress", back_populates="student", cascade="all, delete-orphan")
    snapshots = relationship("WeeklySessionSnapshot", back_populates="student", cascade="all, delete-orphan")
    mentor_notes = relationship("MentorNote", back_populates="student", cascade="all, delete-orphan")
    stat_snapshots = relationship("StudentStatSnapshot", back_populates="student", cascade="all, delete-orphan")
    contest_participations = relationship("ContestParticipation", back_populates="student", cascade="all, delete-orphan")

class LeetCodeProfileStats(Base):
    __tablename__ = "leetcode_profile_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), unique=True, nullable=False)
    
    total_solved = Column(Integer, nullable=True, default=None)
    easy_solved = Column(Integer, nullable=True, default=None)
    medium_solved = Column(Integer, nullable=True, default=None)
    hard_solved = Column(Integer, nullable=True, default=None)
    contest_rating = Column(Float, nullable=True)
    contest_global_ranking = Column(Integer, nullable=True)
    public_profile_ranking = Column(Integer, nullable=True)
    
    active_days = Column(Integer, nullable=True)
    max_streak = Column(Integer, nullable=True)
    recent_accepted = Column(Integer, nullable=True)

    recent_contest_name = Column(String(150), nullable=True)
    recent_contest_score = Column(String(20), nullable=True) # e.g. "3 / 4"
    
    status = Column(String(50), default="pending") # OK, MISSING LINK, INVALID LINK, PROFILE NOT FOUND, pending
    sync_status = Column(String(50), default="not_started") # success, failed, mismatch, not_started, pending
    validation_status = Column(String(50), nullable=True)  # verified, mismatch, pending, identity_mismatch
    source = Column(String(100), nullable=True)  # leetcode_public_profile — only set after real fetch
    error_message = Column(Text, nullable=True)
    error_code = Column(String(50), nullable=True)  # NETWORK_TIMEOUT, PROFILE_NOT_FOUND, MISMATCH, IDENTITY_MISMATCH
    last_successful_sync = Column(DateTime, nullable=True)
    last_verified_at = Column(DateTime(timezone=True), nullable=True)
    last_attempt_at = Column(DateTime(timezone=True), nullable=True)  # Tracks every sync attempt, success or fail
    retry_count = Column(Integer, default=0, nullable=False)  # Number of failed fetch attempts
    fetch_duration = Column(Float, nullable=True)
    last_updated = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    student = relationship("Student", back_populates="stats")

class ContestParticipation(Base):
    __tablename__ = "contest_participations"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    contest_id = Column(String(100), nullable=True, index=True)
    contest_name = Column(String(150), nullable=False)
    contest_date = Column(String(20), nullable=True) # YYYY-MM-DD
    contest_start_time = Column(DateTime, nullable=True)
    contest_end_time = Column(DateTime, nullable=True)
    
    participation_type = Column(String(30), default="UNKNOWN", index=True) # OFFICIAL, VIRTUAL, UNKNOWN
    registered = Column(Boolean, default=False)
    started = Column(Boolean, default=False)
    submitted = Column(Boolean, default=False)
    problems_solved = Column(Integer, default=0)
    total_problems = Column(Integer, default=4)
    contest_rank = Column(Integer, nullable=True)
    contest_rating_before = Column(Float, nullable=True)
    contest_rating_after = Column(Float, nullable=True)
    submission_times = Column(JSON, nullable=True)
    
    verified_at = Column(DateTime, default=datetime.datetime.utcnow)
    source = Column(String(100), default="leetcode_api")

    student = relationship("Student", back_populates="contest_participations")

class WeeklySession(Base):
    __tablename__ = "weekly_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    academic_year = Column(String(20), default="2026-27")
    week_number = Column(Integer, nullable=False)
    session_date = Column(String(20), nullable=False) # YYYY-MM-DD
    start_time = Column(String(10), default="08:00")
    end_time = Column(String(10), default="09:30")
    status = Column(String(20), default="UPCOMING") # UPCOMING, ACTIVE, COMPLETED
    
    baseline_snapshot_id = Column(String(100), nullable=True)
    final_snapshot_id = Column(String(100), nullable=True)
    total_students = Column(Integer, default=273)
    official_participants = Column(Integer, default=0)
    virtual_participants = Column(Integer, default=0)
    not_participated = Column(Integer, default=0)
    failed_verification = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    snapshots = relationship("WeeklySessionSnapshot", back_populates="session", cascade="all, delete-orphan")

class WeeklySessionSnapshot(Base):
    __tablename__ = "weekly_session_snapshots"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("weekly_sessions.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    
    start_solved_count = Column(Integer, default=0)
    end_solved_count = Column(Integer, default=0)
    problems_added = Column(Integer, default=0)
    
    start_rating = Column(Float, nullable=True)
    end_rating = Column(Float, nullable=True)
    rating_change = Column(Float, default=0.0)
    
    status = Column(String(30), default="NOT STARTED") # STARTED, NOT STARTED, DATA UNAVAILABLE
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    session = relationship("WeeklySession", back_populates="snapshots")
    student = relationship("Student", back_populates="snapshots")

class WeeklyStudentProgress(Base):
    __tablename__ = "weekly_student_progress"
    
    id = Column(Integer, primary_key=True, index=True)
    week_number = Column(Integer, nullable=False)
    academic_year = Column(String(20), default="2026-27")
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    
    total_solved = Column(Integer, default=0)
    weekly_progress = Column(Integer, default=0)
    easy_solved = Column(Integer, default=0)
    medium_solved = Column(Integer, default=0)
    hard_solved = Column(Integer, default=0)
    rating = Column(Float, nullable=True)
    
    college_rank = Column(Integer, nullable=True)
    dept_rank = Column(Integer, nullable=True)
    year_rank = Column(Integer, nullable=True)
    section_rank = Column(Integer, nullable=True)
    progress_rank = Column(Integer, nullable=True)
    
    streak_count = Column(Integer, default=0)
    consistency_score = Column(Float, default=0.0) # Percentage 0-100%
    badge_list = Column(JSON, default=list) # e.g. ["Top Performer", "10 Week Streak"]
    composite_score = Column(Float, default=0.0)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    student = relationship("Student", back_populates="progress_records")

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(30), default="Faculty") # Super Admin, HOD, Faculty, CR, Viewer
    
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=True)
    
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime, nullable=True)
    totp_secret = Column(String(100), nullable=True)
    is_2fa_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    department = relationship("Department", back_populates="users")

class MentorNote(Base):
    __tablename__ = "mentor_notes"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    faculty_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    note = Column(Text, nullable=False)
    escalation_level = Column(String(30), default="NORMAL") # NORMAL, WARNING, CRITICAL
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    student = relationship("Student", back_populates="mentor_notes")
    faculty = relationship("User")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    user_name = Column(String(100), nullable=True)
    action = Column(String(100), nullable=False)
    details = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class EmailLog(Base):
    __tablename__ = "email_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, nullable=True)
    recipient = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    status = Column(String(30), default="SENT") # SENT, FAILED, RETRYING
    error_message = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class CertificateRecord(Base):
    __tablename__ = "certificate_records"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    certificate_type = Column(String(100), nullable=False) # e.g. Top Performer
    certificate_code = Column(String(50), unique=True, index=True, nullable=False)
    issue_date = Column(String(20), nullable=False)
    qr_code_path = Column(String(255), nullable=True)
    pdf_path = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    student = relationship("Student")

class AdminSettingsModel(Base):
    __tablename__ = "admin_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(Text, nullable=False)

class StudentStatSnapshot(Base):
    __tablename__ = "student_stat_snapshots"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    
    total_solved = Column(Integer, nullable=True)
    easy_solved = Column(Integer, nullable=True)
    medium_solved = Column(Integer, nullable=True)
    hard_solved = Column(Integer, nullable=True)
    contest_rating = Column(Float, nullable=True)
    global_rank = Column(Integer, nullable=True)
    
    delta_total = Column(Integer, nullable=True, default=0)
    delta_easy = Column(Integer, nullable=True, default=0)
    delta_medium = Column(Integer, nullable=True, default=0)
    delta_hard = Column(Integer, nullable=True, default=0)
    delta_rating = Column(Float, nullable=True, default=0.0)
    
    captured_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)
    sync_run_id = Column(String(100), nullable=True)
    source = Column(String(50), default="leetcode_public_profile")
    
    student = relationship("Student", back_populates="stat_snapshots")

class StudentGoal(Base):
    __tablename__ = "student_goals"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    
    target_solved = Column(Integer, nullable=False)
    target_date = Column(String(20), nullable=False) # YYYY-MM-DD
    status = Column(String(30), default="IN_PROGRESS") # IN_PROGRESS, COMPLETED, OVERDUE
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    student = relationship("Student")

class HODSnapshot(Base):
    __tablename__ = "hod_snapshots"
    
    id = Column(Integer, primary_key=True, index=True)
    snapshot_id = Column(String(100), unique=True, index=True, nullable=False)
    title = Column(String(200), nullable=False)
    academic_year = Column(String(20), default="2026-27")
    metrics = Column(JSON, nullable=False)
    status = Column(String(30), default="READY") # DRAFT, READY, PUBLISHED, ARCHIVED, INVALID
    created_by = Column(String(100), default="HOD / System")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    verified_at = Column(DateTime, default=datetime.datetime.utcnow)


class ReportHistory(Base):
    __tablename__ = "report_history"
    
    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(String(100), unique=True, index=True, nullable=False)
    report_type = Column(String(100), nullable=False) # e.g. COLLEGE_EXECUTIVE, DEPT_REPORT
    title = Column(String(200), nullable=False)
    snapshot_id = Column(String(100), nullable=True) # Optional link to an HOD snapshot
    filters = Column(JSON, nullable=True)
    dataset = Column(JSON, nullable=False) # The frozen verified dataset
    status = Column(String(30), default="GENERATED") # GENERATED, ERROR
    
    created_by = Column(String(100), default="System")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)



