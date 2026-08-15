import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text, JSON, UniqueConstraint
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
    contest_snapshots = relationship("StudentContestSnapshot", back_populates="student", cascade="all, delete-orphan")
    contest_participation_records = relationship("StudentContestParticipation", back_populates="student", cascade="all, delete-orphan")

class LeetCodeProfileStats(Base):
    __tablename__ = "leetcode_profile_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), unique=True, nullable=False)
    
    total_solved = Column(Integer, nullable=True, default=None)
    source_total_solved = Column(Integer, nullable=True, default=None)
    derived_total_solved = Column(Integer, nullable=True, default=None)
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
    session_code = Column(String(50), unique=True, index=True, nullable=True) # e.g. WEEK-2026-08-16
    session_date = Column(String(20), nullable=False, index=True) # YYYY-MM-DD
    contest_id = Column(String(100), nullable=True) # e.g. weekly-contest-470
    contest_name = Column(String(150), default="Weekly Contest")
    start_time = Column(String(10), default="08:00")
    end_time = Column(String(10), default="09:30")
    status = Column(String(20), default="SCHEDULED", index=True) # SCHEDULED, LIVE, FINALIZING, FINALIZED, ARCHIVED, ERROR
    
    baseline_snapshot_id = Column(String(100), nullable=True)
    final_snapshot_id = Column(String(100), nullable=True)
    total_students = Column(Integer, default=273)
    official_participants = Column(Integer, default=0)
    virtual_participants = Column(Integer, default=0)
    not_participated = Column(Integer, default=0)
    failed_verification = Column(Integer, default=0)
    dataset_hash = Column(String(100), nullable=True)
    sync_status = Column(String(50), default="🟢 Verified") # 🟢 Verified, 🟡 Syncing, 🔴 Sync Error
    last_synced = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    finalized_at = Column(DateTime, nullable=True)

    snapshots = relationship("WeeklySessionSnapshot", back_populates="session", cascade="all, delete-orphan")
    public_results = relationship("WeeklyPublicResult", back_populates="session", cascade="all, delete-orphan")
    virtual_results = relationship("WeeklyVirtualResult", back_populates="session", cascade="all, delete-orphan")
    error_logs = relationship("WeeklyContestErrorLog", back_populates="session", cascade="all, delete-orphan")

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

class WeeklyPublicResult(Base):
    __tablename__ = "weekly_public_results"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("weekly_sessions.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    reg_no = Column(String(50), nullable=False)
    name = Column(String(150), nullable=False)
    dept = Column(String(20), nullable=False)
    year = Column(String(10), nullable=False)

    participation_status = Column(String(30), default="PENDING", index=True) # PUBLIC_ATTENDED, PUBLIC_NOT_ATTENDED, DATA_ERROR, PENDING
    q1 = Column(Integer, default=0)
    q2 = Column(Integer, default=0)
    q3 = Column(Integer, default=0)
    q4 = Column(Integer, default=0)
    total_contest_solved = Column(Integer, default=0)
    contest_score = Column(Integer, default=0)
    contest_rank = Column(Integer, nullable=True)
    contest_rating = Column(Float, nullable=True)
    rating_change = Column(Float, default=0.0)

    fetch_status = Column(String(30), default="PENDING") # SUCCESS, PARTIAL_SUCCESS, FETCH_ERROR, PENDING
    error_reason = Column(String(100), nullable=True)
    retry_count = Column(Integer, default=0)
    last_fetched_at = Column(DateTime, nullable=True)

    session = relationship("WeeklySession", back_populates="public_results")
    student = relationship("Student")

class WeeklyVirtualResult(Base):
    __tablename__ = "weekly_virtual_results"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("weekly_sessions.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    reg_no = Column(String(50), nullable=False)
    name = Column(String(150), nullable=False)

    participation_status = Column(String(30), default="VIRTUAL_ATTENDED")
    q1 = Column(Integer, default=0)
    q2 = Column(Integer, default=0)
    q3 = Column(Integer, default=0)
    q4 = Column(Integer, default=0)
    total_contest_solved = Column(Integer, default=0)
    contest_score = Column(Integer, default=0)
    completed_at = Column(DateTime, default=datetime.datetime.utcnow)

    session = relationship("WeeklySession", back_populates="virtual_results")
    student = relationship("Student")

class WeeklyContestErrorLog(Base):
    __tablename__ = "weekly_contest_error_logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("weekly_sessions.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    reg_no = Column(String(50), nullable=False)
    student_name = Column(String(150), nullable=False)
    field_name = Column(String(50), default="contest_participation")
    error_type = Column(String(50), default="FETCH_ERROR") # INVALID_LINK, RATE_LIMIT, TIMEOUT, PROFILE_NOT_FOUND, CONTEST_UNAVAILABLE, DATA_ERROR
    error_message = Column(Text, nullable=True)
    attempt_count = Column(Integer, default=1)
    status = Column(String(20), default="UNRESOLVED") # UNRESOLVED, RESOLVED
    last_attempt_at = Column(DateTime, default=datetime.datetime.utcnow)

    session = relationship("WeeklySession", back_populates="error_logs")
    student = relationship("Student")

class OfficialWeeklySnapshot(Base):
    __tablename__ = "official_weekly_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("weekly_sessions.id"), unique=True, nullable=False)
    contest_id = Column(String(100), nullable=False)
    contest_name = Column(String(150), nullable=False)
    contest_date = Column(String(20), nullable=False)
    finalized_at = Column(DateTime, default=datetime.datetime.utcnow)
    dataset = Column(JSON, nullable=False)
    dataset_hash = Column(String(100), nullable=False)
    student_count = Column(Integer, default=273)
    error_count = Column(Integer, default=0)


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
    verification_id = Column(String(64), unique=True, index=True, nullable=False) # e.g. CERT-AA4933CE
    certificate_code = Column(String(64), nullable=True) # Backwards compatibility
    certificate_type = Column(String(64), default="Top Performer", nullable=False)
    
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True)
    student_name = Column(String(255), nullable=False)
    register_no = Column(String(64), index=True, nullable=False)
    department = Column(String(64), nullable=False) # e.g. CSE(CS) or CSE(IOT)
    department_name = Column(String(255), nullable=False) # Full expanded official name
    
    program = Column(String(255), default="Institutional LeetCode Continuous Performance Tracking System", nullable=False)
    recognition = Column(String(128), default="Top Performer", nullable=False)
    issue_date = Column(String(64), nullable=False) # e.g. "Aug 14, 2026"
    status = Column(String(32), default="VALID", index=True, nullable=False) # DRAFT, ISSUED, VALID, REVOKED
    
    principal_signature_version = Column(String(32), default="v1", nullable=False)
    hod_signature_version = Column(String(32), default="v1", nullable=False)
    verification_url = Column(String(512), nullable=False)
    
    pdf_path = Column(String(512), nullable=True)
    qr_path = Column(String(512), nullable=True)
    qr_code_path = Column(String(512), nullable=True)
    
    created_by = Column(String(128), default="Admin")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    revoked_at = Column(DateTime, nullable=True)
    revocation_reason = Column(String(255), nullable=True)

    student = relationship("Student", backref="certificates", foreign_keys=[student_id])

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

class StudentContestSnapshot(Base):
    __tablename__ = "student_contest_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    
    contest_name = Column(String(100), nullable=True)
    contest_number = Column(Integer, nullable=True)
    contest_date = Column(String(30), nullable=True)
    questions_solved = Column(Integer, default=0)
    questions_total = Column(Integer, default=4)
    contest_rank = Column(Integer, nullable=True)
    contest_rating = Column(Float, nullable=True)
    top_percentage = Column(Float, nullable=True)
    attended = Column(Boolean, default=True)
    status = Column(String(30), default="VERIFIED")
    error_message = Column(Text, nullable=True)
    captured_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)

    student = relationship("Student", back_populates="contest_snapshots")

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


class SyncJob(Base):
    __tablename__ = "sync_jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(100), unique=True, index=True, nullable=False)
    job_type = Column(String(50), default="FULL_SYNC") # FULL_SYNC, SINGLE_STUDENT, CONTEST_SYNC
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    status = Column(String(30), default="RUNNING") # RUNNING, COMPLETED, COMPLETED_WITH_WARNINGS, FAILED
    total_records = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    partial_count = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    triggered_by = Column(String(100), default="admin")


class SyncJobItem(Base):
    __tablename__ = "sync_job_items"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(100), ForeignKey("sync_jobs.job_id"), index=True, nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), index=True, nullable=False)
    field = Column(String(50), nullable=False) # e.g. total_solved, easy_solved, medium_solved, hard_solved, contest_rating
    status = Column(String(50), default="FRESH") # FRESH, LAST_VERIFIED, FETCH_ERROR, TIMEOUT, INVALID_PROFILE, DATA_INCONSISTENCY
    old_value = Column(String(255), nullable=True)
    new_value = Column(String(255), nullable=True)
    error_code = Column(String(100), nullable=True)
    attempt_count = Column(Integer, default=1)
    completed_at = Column(DateTime, default=datetime.datetime.utcnow)


class ReportEmailRecipient(Base):
    __tablename__ = "report_email_recipients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    role = Column(String(50), default="HOD") # MANAGEMENT, HOD, DEPARTMENT_COORDINATOR, ADMIN
    department = Column(String(50), nullable=True) # CSE(CS), CSE(IoT), ALL
    is_active = Column(Boolean, default=True)
    receive_weekly_reports = Column(Boolean, default=True)
    receive_hod_reports = Column(Boolean, default=True)
    receive_error_reports = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

# Alias for backward compatibility & specification match
ReportRecipient = ReportEmailRecipient


class EmailDispatchLog(Base):
    __tablename__ = "email_dispatch_logs"

    id = Column(Integer, primary_key=True, index=True)
    email_id = Column(String(100), unique=True, index=True, nullable=False)
    report_id = Column(String(100), nullable=True)
    session_id = Column(Integer, nullable=True)
    idempotency_key = Column(String(255), index=True, nullable=False)
    recipient = Column(String(150), index=True, nullable=False)
    role = Column(String(50), default="HOD")
    subject = Column(String(255), nullable=False)
    status = Column(String(30), default="QUEUED") # QUEUED, SENDING, SENT, FAILED, RETRYING
    attachment_count = Column(Integer, default=0)
    total_attachment_bytes = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class StudentContestParticipation(Base):
    __tablename__ = "student_contest_participations"
    __table_args__ = (
        UniqueConstraint("student_id", "contest_id", "participation_mode", name="uix_student_contest_mode"),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)

    contest_id = Column(String(100), nullable=False, index=True) # e.g. weekly-contest-470
    contest_name = Column(String(150), nullable=False) # e.g. Weekly Contest 470
    contest_number = Column(Integer, nullable=True) # e.g. 470
    contest_date = Column(String(20), nullable=True, index=True) # YYYY-MM-DD

    participation_mode = Column(String(20), nullable=False, index=True) # PUBLIC or VIRTUAL

    questions_solved = Column(Integer, default=0)
    questions_total = Column(Integer, default=4)
    score_display = Column(String(20), nullable=True) # e.g. "3 / 4" or "Not Attended"

    contest_rank = Column(Integer, nullable=True)
    contest_rating = Column(Float, nullable=True)
    top_percentage = Column(Float, nullable=True)

    attended = Column(Boolean, default=False)
    status = Column(String(30), default="NOT_ATTENDED", index=True) # ATTENDED, NOT_ATTENDED, FETCH_FAILED, PARSER_ERROR, DATA_MISMATCH, MODE_UNCERTAIN, PROFILE_NOT_FOUND

    started_at = Column(DateTime, nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    fetched_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    student = relationship("Student", back_populates="contest_participation_records")


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    audit_id = Column(String(100), unique=True, index=True, nullable=False) # AUD-2026-XXXXX
    
    admin_user_id = Column(Integer, nullable=True, index=True)
    admin_name = Column(String(150), nullable=True)
    admin_email = Column(String(150), nullable=True)
    admin_role = Column(String(50), default="ADMIN")

    action = Column(String(100), nullable=False, index=True)
    action_type = Column(String(50), default="GENERAL", index=True) # SECURITY, DATA_SYNC, REPORT, EMAIL, RECIPIENT, SETTINGS
    
    target_type = Column(String(50), nullable=True)
    target_id = Column(String(100), nullable=True)
    
    description = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(255), nullable=True)
    
    status = Column(String(30), default="SUCCESS", index=True) # SUCCESS, FAILED, WARNING
    metadata_json = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)


class EmailDelivery(Base):
    __tablename__ = "email_deliveries"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(String(100), unique=True, index=True, nullable=False) # MSG-MANUAL-XXXXX or MSG-AUTO-XXXXX
    
    recipient_id = Column(Integer, ForeignKey("report_email_recipients.id"), nullable=True)
    recipient_email = Column(String(150), nullable=False, index=True)
    recipient_name = Column(String(150), nullable=True)
    recipient_role = Column(String(50), default="MANAGEMENT")
    department = Column(String(50), default="ALL")
    
    report_type = Column(String(100), default="WEEKLY_LEETCODE", index=True)
    report_date = Column(String(20), nullable=True)
    
    subject = Column(String(255), nullable=False)
    status = Column(String(30), default="QUEUED", index=True) # QUEUED, SENDING, SENT, DELIVERED, FAILED, RETRYING
    
    attachments_count = Column(Integer, default=0)
    attachment_metadata_json = Column(JSON, nullable=True)
    
    provider_message_id = Column(String(100), nullable=True)
    sent_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)
    
    retry_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    
    trigger_type = Column(String(30), default="AUTOMATED", index=True) # MANUAL or AUTOMATED
    triggered_by_user_id = Column(Integer, nullable=True)
    triggered_by_email = Column(String(150), nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    attachments = relationship("EmailAttachment", back_populates="delivery", cascade="all, delete-orphan")


class EmailAttachment(Base):
    __tablename__ = "email_attachments"

    id = Column(Integer, primary_key=True, index=True)
    email_delivery_id = Column(Integer, ForeignKey("email_deliveries.id"), nullable=False, index=True)
    
    filename = Column(String(255), nullable=False)
    file_type = Column(String(100), nullable=True)
    file_size = Column(Integer, default=0)
    storage_path = Column(String(255), nullable=True)
    checksum = Column(String(100), nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    delivery = relationship("EmailDelivery", back_populates="attachments")


class EmailOTPRecord(Base):
    __tablename__ = "email_otp_records"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), index=True, nullable=False)
    email_hash = Column(String(128), index=True, nullable=False)
    otp_hash = Column(String(128), nullable=False)
    request_id = Column(String(100), unique=True, index=True, nullable=False)
    attempt_count = Column(Integer, default=0)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    used_at = Column(DateTime, nullable=True)
    ip_address = Column(String(50), nullable=True)
    request_ip_hash = Column(String(128), nullable=True, index=True)


class AdminSession(Base):
    __tablename__ = "admin_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token_hash = Column(String(128), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    last_used_at = Column(DateTime, default=datetime.datetime.utcnow)
    revoked_at = Column(DateTime, nullable=True)
    ip_hash = Column(String(128), nullable=True)
    user_agent_hash = Column(String(128), nullable=True)

    user = relationship("User")


class ScheduledReportConfig(Base):
    __tablename__ = "scheduled_report_configs"

    id = Column(Integer, primary_key=True, index=True)
    report_type = Column(String(100), default="weekly_public_leetcode", unique=True, index=True, nullable=False)
    report_name = Column(String(150), default="Weekly Public LeetCode Report", nullable=False)
    
    day_of_week = Column(String(20), default="sunday", nullable=False) # sunday, monday, etc.
    hour = Column(Integer, default=9, nullable=False) # 0-23
    minute = Column(Integer, default=45, nullable=False) # 0-59
    timezone = Column(String(50), default="Asia/Kolkata", nullable=False)
    
    is_enabled = Column(Boolean, default=True, index=True)
    recipients = Column(JSON, nullable=True) # list of email addresses
    job_id = Column(String(100), default="sunday_auto_email_945", nullable=False)
    
    last_run = Column(DateTime, nullable=True)
    last_status = Column(String(50), default="NOT_RUN_YET") # SUCCESS, FAILED, EMAIL_BLOCKED, NOT_RUN_YET
    last_report_filename = Column(String(255), nullable=True)
    last_email_status = Column(String(50), default="PENDING") # DISPATCHED, FAILED, SKIPPED, PENDING
    
    updated_by = Column(String(150), nullable=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class ReportExecutionHistory(Base):
    __tablename__ = "report_execution_histories"

    id = Column(Integer, primary_key=True, index=True)
    execution_id = Column(String(100), unique=True, index=True, nullable=False) # EXEC-YYYYMMDD-XXXX
    schedule_id = Column(Integer, nullable=True)
    
    report_type = Column(String(100), default="weekly_public_leetcode", index=True)
    scheduled_time = Column(String(50), default="09:45 IST")
    scheduled_date = Column(String(20), nullable=True, index=True) # YYYY-MM-DD
    
    actual_start = Column(DateTime, default=datetime.datetime.utcnow)
    actual_end = Column(DateTime, nullable=True)
    
    contest_name = Column(String(150), default="Weekly Contest")
    students_processed = Column(Integer, default=0)
    
    excel_generated = Column(Boolean, default=False)
    excel_filename = Column(String(255), nullable=True)
    
    email_sent = Column(Boolean, default=False)
    recipients_count = Column(Integer, default=0)
    
    status = Column(String(50), default="STARTED", index=True) # SCHEDULED, STARTED, DATA_PROCESSING, REPORT_GENERATED, ATTACHMENT_READY, EMAIL_SENDING, COMPLETED, FAILED, EMAIL_BLOCKED
    error_message = Column(Text, nullable=True)
    idempotency_key = Column(String(255), index=True, nullable=False)
    
    is_test_run = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)





class AuthorizedSignature(Base):
    __tablename__ = "authorized_signatures"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    signature_type = Column(String(64), index=True, nullable=False) # PRINCIPAL, HOD_CSE_CS, HOD_CSE_IOT
    department = Column(String(64), nullable=True) # CSE(CS), CSE(IOT), ALL
    signatory_title = Column(String(128), nullable=False) # "Principal", "HOD / Coordinator"
    signatory_name = Column(String(128), nullable=True)
    
    version = Column(String(32), default="v1", nullable=False)
    image_path = Column(String(512), nullable=True)
    image_data = Column(Text, nullable=True) # base64 data url for high availability & canvas preview
    mime_type = Column(String(64), default="image/png")
    
    is_active = Column(Boolean, default=True, index=True)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)
    uploaded_by = Column(String(128), default="Admin")









