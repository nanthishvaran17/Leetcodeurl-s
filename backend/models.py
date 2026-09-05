import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text, JSON, UniqueConstraint, Index
from sqlalchemy.orm import relationship, backref
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
    __table_args__ = (
        Index("ix_students_search", "name", "reg_no", "username"),
        Index("ix_students_dept_year_active", "department_id", "year_level", "is_active"),
    )
    
    id = Column(Integer, primary_key=True, index=True)
    people_id = Column(String(50), unique=True, index=True, nullable=True)
    reg_no = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(150), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False, index=True)
    year_level = Column(String(10), nullable=False, index=True) # II, III, IV
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=True, index=True)
    email = Column(String(150), nullable=True, index=True)
    phone_number = Column(String(30), unique=True, index=True, nullable=True)
    whatsapp_verified = Column(Boolean, default=False)
    date_of_birth = Column(String(20), nullable=True)
    
    batch = Column(String(50), nullable=True, index=True)
    institutional_email = Column(String(150), unique=True, index=True, nullable=True)
    email_status = Column(String(50), default="pending") # pending, generated, needs_verification, error
    
    leetcode_url = Column(String(255), nullable=True)
    username = Column(String(100), index=True, nullable=True)
    codeforces_username = Column(String(100), nullable=True)
    hackerrank_username = Column(String(100), nullable=True)
    
    allocation = Column(String(50), nullable=True, index=True) # 0.25, etc.
    
    is_active = Column(Boolean, default=True, index=True)
    version = Column(Integer, default=1, nullable=False)
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
    faculty_assignment = relationship("FacultyStudentAssignment", back_populates="student", uselist=False, cascade="all, delete-orphan")

class LeetCodeProfileStats(Base):
    __tablename__ = "leetcode_profile_stats"
    __table_args__ = (
        Index("ix_stats_solved_rating", "total_solved", "contest_rating"),
    )
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), unique=True, nullable=False)
    
    total_solved = Column(Integer, nullable=True, default=None, index=True)
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
    sync_status = Column(String(50), default="not_started", index=True) # success, failed, mismatch, not_started, pending
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
    # Audit trail: which LeetCode username was used to fetch this record.
    # Remains stable even if student.username changes — enables forensic diff.
    source_username = Column(String(100), nullable=True, index=True)

    student = relationship("Student", back_populates="contest_participations")


class WeeklySession(Base):
    __tablename__ = "weekly_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    academic_year = Column(String(20), default="2026-27")
    week_number = Column(Integer, default=1, nullable=True)
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

    session_data_hash = Column(String(128), nullable=True)
    reconciliation_summary = Column(JSON, nullable=True)
    
    # 100/10 Production Hardening: Pipeline State Machine
    pipeline_state = Column(String(50), default="DISCOVERED", index=True)
    pipeline_last_updated = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    pipeline_error = Column(Text, nullable=True)
    
    snapshots = relationship("WeeklySessionSnapshot", back_populates="session", cascade="all, delete-orphan")
    public_results = relationship("WeeklyPublicResult", back_populates="session", cascade="all, delete-orphan")
    virtual_results = relationship("WeeklyVirtualResult", back_populates="session", cascade="all, delete-orphan")
    live_events = relationship("WeeklyContestLiveEvent", back_populates="session", cascade="all, delete-orphan")
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
    __table_args__ = (
        Index("ix_weekly_public_results_session_student", "session_id", "student_id"),
        Index("ix_weekly_public_results_session_dept_year", "session_id", "dept", "year"),
        Index("ix_weekly_public_results_participation", "session_id", "participation_status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("weekly_sessions.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    reg_no = Column(String(50), nullable=False)
    name = Column(String(150), nullable=False)
    dept = Column(String(20), nullable=False)
    year = Column(String(10), nullable=False)

    participation_status = Column(String(30), default="PENDING", index=True) # PUBLIC_ATTENDED, PUBLIC_NOT_ATTENDED, DATA_ERROR, PENDING
    state = Column(String(30), default="PENDING", index=True) # PENDING, FETCHING, SOURCE_FOUND, VALIDATING, VALIDATED, CLASSIFIED, FINALIZED, INVALID_USERNAME, FETCH_ERROR, SOURCE_TIMEOUT, RATE_LIMITED, DATA_ERROR, UNVERIFIED
    previous_state = Column(String(30), nullable=True)
    state_changed_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_error_code = Column(String(50), nullable=True)
    evidence_json = Column(Text, nullable=True)
    record_hash = Column(String(128), nullable=True)

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
    data_fetch_status = Column(String(30), default="DATA_UNAVAILABLE") # SUCCESS, FETCH_FAILED, USERNAME_NOT_FOUND, DATA_UNAVAILABLE
    confidence = Column(String(30), default="UNVERIFIED") # VERIFIED, PARTIAL, UNVERIFIED, FAILED
    error_reason = Column(Text, nullable=True)
    verification_evidence = Column(Text, nullable=True) # JSON evidence payload
    retry_count = Column(Integer, default=0)
    last_fetched_at = Column(DateTime, nullable=True)

    session = relationship("WeeklySession", back_populates="public_results")
    student = relationship("Student")

class WeeklyVirtualResult(Base):
    __tablename__ = "weekly_virtual_results"
    __table_args__ = (
        Index("ix_weekly_virtual_results_session_student", "session_id", "student_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("weekly_sessions.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    reg_no = Column(String(50), nullable=False)
    name = Column(String(150), nullable=False)

    participation_status = Column(String(30), default="VIRTUAL_ATTENDED")
    state = Column(String(30), default="VALIDATED", index=True)
    evidence_json = Column(Text, nullable=True)
    record_hash = Column(String(128), nullable=True)

    q1 = Column(Integer, default=0)
    q2 = Column(Integer, default=0)
    q3 = Column(Integer, default=0)
    q4 = Column(Integer, default=0)
    total_contest_solved = Column(Integer, default=0)
    contest_score = Column(Integer, default=0)
    completed_at = Column(DateTime, default=datetime.datetime.utcnow)

    session = relationship("WeeklySession", back_populates="virtual_results")
    student = relationship("Student")


class VirtualContestAttempt(Base):
    """
    Persistent lifecycle record for each student's virtual contest attempt.

    Guarantees idempotency via UNIQUE(student_id, session_id) — a student can
    only have ONE attempt per session regardless of double-clicks, page refreshes,
    WebSocket reconnects, or multi-device access.

    Lifecycle:
        ACTIVE    → attempt is in progress (started, not yet expired/completed)
        COMPLETED → student finished or contest window closed with solved questions
        EXPIRED   → window passed with zero activity
        ABANDONED → admin-cancelled

    start/resume: INSERT OR IGNORE on (student_id, session_id), then SELECT existing.
    Never reset started_at / expires_at when resuming an existing ACTIVE attempt.
    """
    __tablename__ = "virtual_contest_attempts"
    __table_args__ = (
        UniqueConstraint("student_id", "session_id", name="uq_vca_student_session"),
        Index("ix_vca_session_student", "session_id", "student_id"),
        {"extend_existing": True}
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    session_id = Column(Integer, ForeignKey("weekly_sessions.id"), nullable=False, index=True)

    # Denormalized for fast lookup without joins
    contest_id = Column(String(100), nullable=True)
    contest_name = Column(String(150), nullable=True)
    reg_no = Column(String(50), nullable=True)
    student_name = Column(String(150), nullable=True)
    leetcode_username = Column(String(100), nullable=True)

    # Lifecycle
    status = Column(String(30), default="ACTIVE", nullable=False, index=True)
    # ACTIVE | COMPLETED | EXPIRED | ABANDONED

    started_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=True)   # started_at + contest duration (90 min typical)
    last_activity_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Audit
    resume_count = Column(Integer, default=0)      # how many times resumed (idempotency counter)
    source = Column(String(50), default="RECONCILIATION_SCAN")
    # RECONCILIATION_SCAN | STUDENT_INITIATED | ADMIN_CREATED

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    student = relationship("Student")
    session = relationship("WeeklySession")


class WeeklyContestLiveEvent(Base):
    __tablename__ = "weekly_contest_live_events"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("weekly_sessions.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    reg_no = Column(String(50), nullable=False)
    student_name = Column(String(150), nullable=False)
    
    question_id = Column(Integer, nullable=True) # e.g., 1, 2, 3, 4 for Q1, Q2, Q3, Q4
    title_slug = Column(String(150), nullable=False)
    submission_id = Column(String(50), nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    
    # Provenance tracking
    event_type = Column(String(50), default="SOLVE") # SOLVE, ATTEMPT, RANK_CHANGE
    old_rank = Column(Integer, nullable=True)
    new_rank = Column(Integer, nullable=True)
    is_verified = Column(Boolean, default=True)

    session = relationship("WeeklySession", back_populates="live_events")
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
    session_id = Column(Integer, ForeignKey("weekly_sessions.id"), index=True, nullable=False)
    contest_id = Column(String(100), nullable=False)
    contest_name = Column(String(150), nullable=False)
    contest_date = Column(String(20), nullable=False)
    finalized_at = Column(DateTime, default=datetime.datetime.utcnow)
    dataset = Column(JSON, nullable=False)
    dataset_hash = Column(String(100), nullable=False)
    session_data_hash = Column(String(128), nullable=True)
    reconciliation_summary = Column(JSON, nullable=True)
    snapshot_version = Column(Integer, default=1)
    student_count = Column(Integer, default=273)
    error_count = Column(Integer, default=0)
    is_superseded = Column(Boolean, default=False)
    superseded_by_id = Column(Integer, nullable=True)


class WeeklyStudentProgress(Base):
    __tablename__ = "weekly_student_progress"
    __table_args__ = (
        Index("ix_weekly_student_progress_student_week", "student_id", "week_number"),
    )

    id = Column(Integer, primary_key=True, index=True)
    week_number = Column(Integer, nullable=True, default=34)
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
    full_name = Column(String(150), nullable=True)
    designation = Column(String(100), nullable=True)
    institutional_id = Column(String(50), unique=True, index=True, nullable=True) # e.g. NEC-CSE-STF-001
    username = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(30), default="Faculty", index=True) # Super Admin, Admin, Faculty, Staff, CR, Viewer
    phone_number = Column(String(30), unique=True, index=True, nullable=True)
    whatsapp_verified = Column(Boolean, default=False)
    date_of_birth = Column(String(20), nullable=True)
    
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True, index=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=True, index=True)
    academic_year = Column(String(20), nullable=True, index=True) # I Year, II Year, etc.
    mentoring_role = Column(String(50), nullable=True, index=True) # Faculty Mentor, Class Mentor, etc.
    
    require_password_change = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True, index=True)
    last_login = Column(DateTime, nullable=True)
    last_activity = Column(DateTime, nullable=True)
    totp_secret = Column(String(100), nullable=True)
    is_2fa_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    department = relationship("Department", back_populates="users")
    reporting_manager_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    reporting_manager = relationship("User", remote_side=[id], backref="subordinates")
    assigned_students = relationship(
        "FacultyStudentAssignment",
        foreign_keys="FacultyStudentAssignment.faculty_id",
        back_populates="faculty",
        cascade="all, delete-orphan"
    )

class PasswordResetOTP(Base):
    __tablename__ = "password_reset_otps"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    institutional_id = Column(String(50), index=True, nullable=False)
    email = Column(String(150), index=True, nullable=False)
    otp_hash = Column(String(128), nullable=False)
    attempts = Column(Integer, default=0)
    max_attempts = Column(Integer, default=3)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False)
    is_locked = Column(Boolean, default=False)

    user = relationship("User")

class FacultyStudentAssignment(Base):
    __tablename__ = "faculty_student_assignments"
    __table_args__ = (
        UniqueConstraint("student_id", name="uix_faculty_student_assignment"),
        Index("ix_fsa_faculty_active", "faculty_id", "is_active"),
    )

    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), unique=True, nullable=False, index=True)
    assigned_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True, index=True)
    assigned_at = Column(DateTime, default=datetime.datetime.utcnow)

    faculty = relationship("User", foreign_keys=[faculty_id], back_populates="assigned_students")
    student = relationship("Student", back_populates="faculty_assignment")
    assigned_by = relationship("User", foreign_keys=[assigned_by_id])

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

class StudentAssignmentHistory(Base):
    __tablename__ = "student_assignment_history"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    previous_faculty_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    new_faculty_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reason = Column(String(255), nullable=True, default="Initial Allocation")
    assigned_at = Column(DateTime, default=datetime.datetime.utcnow)

    student = relationship("Student")
    previous_faculty = relationship("User", foreign_keys=[previous_faculty_id])
    new_faculty = relationship("User", foreign_keys=[new_faculty_id])
    assigned_by = relationship("User", foreign_keys=[assigned_by_id])

class StaffFollowUp(Base):
    __tablename__ = "staff_follow_ups"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    staff_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    due_date = Column(String(20), nullable=False) # YYYY-MM-DD
    status = Column(String(30), default="PENDING", index=True) # PENDING, COMPLETED, CANCELLED
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    student = relationship("Student")
    staff = relationship("User")

class StaffAlert(Base):
    __tablename__ = "staff_alerts"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    staff_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    alert_type = Column(String(50), nullable=False, index=True) # INACTIVITY, TARGET_MISSED, CONTEST_MISSED, PERFORMANCE_DECLINE, AT_RISK
    severity = Column(String(20), default="MEDIUM") # LOW, MEDIUM, HIGH, CRITICAL
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    student = relationship("Student")
    staff = relationship("User")

class StudentWeeklyTarget(Base):
    __tablename__ = "student_weekly_targets"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    week_number = Column(Integer, nullable=True, default=1)
    academic_year = Column(String(20), default="2026-27")
    target_problems = Column(Integer, default=10)
    target_contests = Column(Integer, default=1)
    completed_problems = Column(Integer, default=0)
    completed_contests = Column(Integer, default=0)
    status = Column(String(30), default="IN_PROGRESS") # IN_PROGRESS, ACHIEVED, MISSED
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    student = relationship("Student")

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
    document_type = Column(String(64), default="CERTIFICATE_OF_EXCELLENCE", nullable=False) # CERTIFICATE_OF_EXCELLENCE, FORENSIC_VERIFICATION_REPORT
    contest_id = Column(String(64), nullable=True)
    sha_hash = Column(String(128), nullable=True)
    
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
    last_synced_at = Column(DateTime, nullable=True)
    status = Column(String(30), default="RUNNING") # RUNNING, COMPLETED, COMPLETED_WITH_WARNINGS, FAILED
    progress = Column(Float, default=0.0)
    total_records = Column(Integer, default=0)
    processed_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    partial_count = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
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
    dispatch_type = Column(String(30), default="AUTOMATED") # MANUAL, AUTOMATED, TEST
    provider = Column(String(50), default="BREVO_API")
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

    questions_solved = Column(Integer, nullable=True, default=None)
    questions_total = Column(Integer, default=4)
    score_display = Column(String(50), nullable=True) # e.g. "3 / 4" or "Not Attended" or "UNKNOWN"

    solved_problems = Column(JSON, nullable=True) # Array of verified problem slugs/IDs
    verification_level = Column(String(30), default="UNVERIFIED", index=True) # DIRECT, CROSS_VERIFIED, PARTIAL, UNVERIFIED
    confidence = Column(Float, default=0.0) # 0.0 to 1.0
    source = Column(String(100), nullable=True) # e.g. leetcode_official_contest_result
    source_url = Column(String(255), nullable=True)
    verification_evidence = Column(JSON, nullable=True)

    contest_rank = Column(Integer, nullable=True)
    contest_rating = Column(Float, nullable=True)
    top_percentage = Column(Float, nullable=True)

    attended = Column(Boolean, default=False)
    status = Column(String(30), default="UNKNOWN", index=True) # PARTICIPATED, NOT_PARTICIPATED, SOURCE_UNAVAILABLE, UNKNOWN, FETCH_FAILED

    # Master Attendance & Freeze Fields
    official_attendance_state = Column(String(30), nullable=True, index=True) # ATTENDED, NOT_ATTENDED, UNKNOWN
    is_frozen = Column(Boolean, default=False, index=True)
    frozen_at = Column(DateTime(timezone=True), nullable=True)
    post_contest_solves_count = Column(Integer, default=0)


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
    delivery_status = Column(String(50), default="PENDING")
    provider_message_id = Column(String(255), nullable=True)


class PasswordResetAuthorization(Base):
    __tablename__ = "password_reset_authorizations"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), index=True, nullable=False)
    reset_token_hash = Column(String(128), index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)


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


# ─────────────────────────────────────────────────────────────────────────────
# CANONICAL NORMALIZED LEETCODE TABLES
# Every field traces to a specific LeetCode GraphQL API response field.
# All tables foreign-key to students.id — never to name, reg_no, or username.
# ─────────────────────────────────────────────────────────────────────────────

class LeetCodeProfile(Base):
    """
    Identity + profile metadata. One row per student.
    Populated by Phase A of the canonical sync pipeline.
    sync_state drives ALL display logic across every consumer.

    State machine values:
      PENDING_USERNAME → VERIFYING → PROFILE_VERIFIED → SYNCING → SYNCED
                                  ↘ INVALID_USERNAME
                                  ↘ IDENTITY_MISMATCH
                                  ↘ FETCH_FAILED
                                  ↘ PARTIAL_SYNC  (core ok, optional data failed)
    """
    __tablename__ = "lc_profiles"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), unique=True, nullable=False, index=True)

    # Verified canonical identity — null until identity confirmed
    canonical_username = Column(String(100), nullable=True, index=True)
    profile_url        = Column(String(255), nullable=True)   # null until verified

    # matchedUser.profile fields — null if user hasn't set them on LeetCode
    real_name  = Column(String(200), nullable=True)
    avatar_url = Column(String(500), nullable=True)   # matchedUser.profile.userAvatar
    about_me   = Column(Text, nullable=True)
    school     = Column(String(200), nullable=True)
    company    = Column(String(200), nullable=True)
    country    = Column(String(100), nullable=True)
    reputation = Column(Integer, nullable=True)

    # State machine — all consumers read sync_state to decide what to show
    verification_status = Column(String(30), default="PENDING_USERNAME", nullable=False, index=True)
    sync_state          = Column(String(30), default="PENDING_USERNAME", nullable=False, index=True)

    error_code    = Column(String(50), nullable=True)
    error_message = Column(Text, nullable=True)

    last_verified_at  = Column(DateTime(timezone=True), nullable=True)
    last_synced_at    = Column(DateTime(timezone=True), nullable=True)
    last_attempted_at = Column(DateTime(timezone=True), nullable=True)
    retry_count       = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    student = relationship("Student", backref=backref("lc_profile", uselist=False))


class LeetCodeProblemStats(Base):
    """
    Core problem-solved counts. One row per student.
    Source: matchedUser.submitStatsGlobal.acSubmissionNum
    Updated on every Phase A sync.

    Ranking formula (applied everywhere ranks appear):
      college_rank : ORDER BY total_solved DESC, contest_rating DESC NULLS LAST
      dept_rank    : same formula within department
      year_rank    : same formula within year_level
    Only students with sync_state IN (SYNCED, PARTIAL_SYNC) receive a rank.
    """
    __tablename__ = "lc_problem_stats"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), unique=True, nullable=False, index=True)

    total_solved  = Column(Integer, nullable=True)   # acSubmissionNum[difficulty=All].count
    easy_solved   = Column(Integer, nullable=True)   # acSubmissionNum[difficulty=Easy].count
    medium_solved = Column(Integer, nullable=True)   # acSubmissionNum[difficulty=Medium].count
    hard_solved   = Column(Integer, nullable=True)   # acSubmissionNum[difficulty=Hard].count

    total_submission_count = Column(Integer, nullable=True)  # raw all-difficulty submission count
    profile_global_ranking = Column(Integer, nullable=True)  # matchedUser.profile.ranking

    fetched_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    student = relationship("Student", backref=backref("lc_problem_stats", uselist=False))


class LeetCodeContest(Base):
    """
    Current contest standing. One row per student — upserted every Phase B sync.
    Source: userContestRanking(username)
    """
    __tablename__ = "lc_contest_standing"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), unique=True, nullable=False, index=True)

    contest_rating         = Column(Float, nullable=True)    # userContestRanking.rating
    contest_global_ranking = Column(Integer, nullable=True)  # userContestRanking.globalRanking
    attended_count         = Column(Integer, nullable=True)  # userContestRanking.attendedContestsCount
    top_percentage         = Column(Float, nullable=True)    # userContestRanking.topPercentage

    # Derived from history array: most recent entry where attended=True
    most_recent_contest_name = Column(String(150), nullable=True)
    most_recent_contest_type = Column(String(20), nullable=True)   # weekly | biweekly

    fetched_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    student = relationship("Student", backref=backref("lc_contest_standing", uselist=False))


class LeetCodeContestRatingHistory(Base):
    """
    Append-only per-contest rating history.
    Source: userContestRankingHistory(username) — full array.
    Weekly and Biweekly contests come from the SAME array; type is derived from title prefix.
    One row per contest. NEVER overwritten — only new rows inserted.
    Unique constraint prevents duplicates on re-sync.
    """
    __tablename__ = "lc_contest_rating_history"
    __table_args__ = (
        UniqueConstraint("student_id", "contest_name", "attended", name="uix_lc_contest_hist"),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)

    contest_name        = Column(String(150), nullable=False)  # e.g. "Weekly Contest 515"
    contest_type        = Column(String(20), nullable=True)    # weekly | biweekly
    contest_start_time  = Column(DateTime, nullable=True)      # from contest.startTime (Unix)

    attended            = Column(Boolean, default=False)       # True=official, False=virtual/not attended
    problems_solved     = Column(Integer, default=0)
    total_problems      = Column(Integer, default=4)
    finish_time_seconds = Column(Integer, nullable=True)       # finishTimeInSeconds
    contest_rank        = Column(Integer, nullable=True)       # ranking field (official only)
    rating_after        = Column(Float, nullable=True)         # rating field at end of this contest

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    student = relationship("Student", backref="lc_contest_history")


class LeetCodeBadge(Base):
    """
    Badges awarded by LeetCode.
    Source: matchedUser.badges[]
    Unique by (student_id, badge_id) — safe to re-sync.
    """
    __tablename__ = "lc_badges"
    __table_args__ = (
        UniqueConstraint("student_id", "badge_id", name="uix_lc_badge"),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id   = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)

    badge_id     = Column(String(100), nullable=False)
    display_name = Column(String(200), nullable=True)
    icon_url     = Column(String(500), nullable=True)
    awarded_at   = Column(DateTime, nullable=True)   # badges[].creationDate

    created_at   = Column(DateTime, default=datetime.datetime.utcnow)

    student = relationship("Student", backref="lc_badges")


class LeetCodeLanguageStats(Base):
    """
    Per-language solved counts.
    Source: matchedUser.languageProblemCount[]
    This is real API data — NOT inferred from curriculum or registration data.
    Unique by (student_id, language_name).
    """
    __tablename__ = "lc_language_stats"
    __table_args__ = (
        UniqueConstraint("student_id", "language_name", name="uix_lc_lang"),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id      = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)

    language_name   = Column(String(50), nullable=False)   # e.g. "Python3", "C++", "Java"
    problems_solved = Column(Integer, default=0)

    fetched_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    student = relationship("Student", backref="lc_language_stats")


class LeetCodeTopicStats(Base):
    """
    Per-topic solved counts.
    Source: matchedUser.tagProblemCounts (advanced + intermediate + fundamental arrays)
    This is real API data — do NOT fabricate skill percentages from these counts.
    Unique by (student_id, topic_slug).
    """
    __tablename__ = "lc_topic_stats"
    __table_args__ = (
        UniqueConstraint("student_id", "topic_slug", name="uix_lc_topic"),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id      = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)

    topic_slug      = Column(String(100), nullable=False)   # e.g. "dynamic-programming"
    topic_name      = Column(String(150), nullable=True)    # display name
    topic_tier      = Column(String(20), nullable=True)     # advanced | intermediate | fundamental
    problems_solved = Column(Integer, default=0)

    fetched_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    student = relationship("Student", backref="lc_topic_stats")


class LeetCodeActivity(Base):
    """
    Submission calendar and derived streaks. One row per student.
    Source: matchedUser.userCalendar(year)
    Streaks are DERIVED in Python from the calendar map.
    LeetCode does NOT return a pre-computed streak — compute it ourselves.
    """
    __tablename__ = "lc_activity"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), unique=True, nullable=False, index=True)

    # Raw calendar: JSON string of {"unix_timestamp": submission_count, ...}
    submission_calendar_json = Column(Text, nullable=True)

    total_active_days = Column(Integer, nullable=True)   # days with ≥1 submission
    current_streak    = Column(Integer, nullable=True)   # consecutive days ending today (Python-derived)
    longest_streak    = Column(Integer, nullable=True)   # max consecutive-day run (Python-derived)

    fetched_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    student = relationship("Student", backref=backref("lc_activity", uselist=False))


class LeetCodeSubmission(Base):
    """
    Recent accepted submissions — capped at last 20. NOT exhaustive submission history.
    Source: recentAcSubmissionList(username, limit=20)
    Consumers MUST label this as 'Recent submissions (not complete history)'.
    Unique constraint prevents re-insertion on re-sync.
    """
    __tablename__ = "lc_submissions"
    __table_args__ = (
        UniqueConstraint("student_id", "title_slug", "submission_timestamp", name="uix_lc_submission"),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)

    title_slug           = Column(String(200), nullable=False)
    title                = Column(String(300), nullable=True)
    lang                 = Column(String(50), nullable=True)   # e.g. "python3", "cpp"
    status_display       = Column(String(30), nullable=True)   # e.g. "Accepted"
    runtime_display      = Column(String(50), nullable=True)   # e.g. "32 ms"
    memory_display       = Column(String(50), nullable=True)   # e.g. "16.2 MB"
    submission_timestamp = Column(DateTime, nullable=True)     # from Unix timestamp in API

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    student = relationship("Student", backref="lc_submissions")





# ─────────────────────────────────────────────────────────────────────────────
# FORENSIC AUDIT — 300 STUDENTS × 100 CONTESTS
# ─────────────────────────────────────────────────────────────────────────────

class ForensicAuditJob(Base):
    """
    Tracks a bulk forensic audit run covering 300 students × 100 canonical contests.
    One row per initiated audit job. Multiple jobs may exist; each is independent.
    Checkpoint index enables safe resume after interruption.
    """
    __tablename__ = "forensic_audit_jobs"

    id      = Column(Integer, primary_key=True, index=True)
    job_id  = Column(String(100), unique=True, index=True, nullable=False)  # FAJ-YYYYMMDD-XXXX

    # Job lifecycle
    status  = Column(String(30), default="PENDING", index=True)   # PENDING/RUNNING/COMPLETED/PARTIAL/FAILED
    phase   = Column(String(20), default="INGEST", index=True)    # INGEST / MATRIX / REPORT / DONE

    # Student ingest counters (Phase 1)
    total_students       = Column(Integer, default=0)
    students_ingested    = Column(Integer, default=0)   # history fetch attempted
    students_succeeded   = Column(Integer, default=0)   # fetch status = SUCCESS
    students_failed      = Column(Integer, default=0)   # NOT_FOUND or SOURCE_UNAVAILABLE
    students_no_username = Column(Integer, default=0)   # PENDING_USERNAME

    # Matrix counters (Phase 2)
    total_matrix_cells   = Column(Integer, default=0)   # expected = students × contests
    cells_processed      = Column(Integer, default=0)
    checkpoint_index     = Column(Integer, default=0)   # resume point

    # Per-status counts (Phase 2 results)
    verified_attended    = Column(Integer, default=0)
    verified_absent      = Column(Integer, default=0)
    data_pending         = Column(Integer, default=0)
    source_unavailable   = Column(Integer, default=0)
    not_found_count      = Column(Integer, default=0)
    pending_username_count = Column(Integer, default=0)

    # Integrity counters (must remain 0 for PASS)
    duplicate_records    = Column(Integer, default=0)
    fabricated_records   = Column(Integer, default=0)   # always 0 — verified by design

    # Canonical contest info
    contest_range_start  = Column(Integer, nullable=True)   # e.g. 416
    contest_range_end    = Column(Integer, nullable=True)   # e.g. 515
    total_contests       = Column(Integer, default=0)

    # Timestamps
    started_at           = Column(DateTime, default=datetime.datetime.utcnow)
    phase1_completed_at  = Column(DateTime, nullable=True)
    phase2_completed_at  = Column(DateTime, nullable=True)
    completed_at         = Column(DateTime, nullable=True)
    report_generated_at  = Column(DateTime, nullable=True)

    # Final report
    report_text          = Column(Text, nullable=True)
    integrity_pass       = Column(Boolean, nullable=True)   # True=PASS, False=FAIL, None=PARTIAL
    triggered_by         = Column(String(100), default="admin")


class ForensicStudentIngestStatus(Base):
    """
    Phase 1 result: full userContestRankingHistory fetch status per student per job.
    Only students with ingest_status='SUCCESS' can have VERIFIED_ABSENT determinations.

    ingest_status values:
      SUCCESS          - history fully fetched; absence can be determined for any contest
      NOT_FOUND        - LeetCode profile does not exist for this username
      SOURCE_UNAVAILABLE - API timeout / error after all retries
      PENDING_USERNAME - student has no username configured
    """
    __tablename__ = "forensic_student_ingest_status"
    __table_args__ = (
        UniqueConstraint("job_id", "student_id", name="uix_forensic_ingest_student"),
    )

    id                    = Column(Integer, primary_key=True, index=True)
    job_id                = Column(String(100), index=True, nullable=False)
    student_id            = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)

    raw_username          = Column(String(100), nullable=True)   # from Student.username
    canonical_username    = Column(String(100), nullable=True)   # confirmed by LeetCode response

    ingest_status         = Column(String(30), default="PENDING_USERNAME", index=True)
    history_entries_count = Column(Integer, default=0)   # rows written to lc_contest_rating_history

    error_message         = Column(Text, nullable=True)
    retry_count           = Column(Integer, default=0)
    ingest_started_at     = Column(DateTime, nullable=True)
    ingest_completed_at   = Column(DateTime, nullable=True)

    student = relationship("Student", backref="forensic_ingest_statuses")


class ForensicAuditRecord(Base):
    """
    Single cell of the 300×100 forensic audit matrix.
    Exactly one record per (student_id, contest_id) — guaranteed by unique constraint.

    verification_status values:
      VERIFIED_ATTENDED   - LeetCode history entry present with attended=True
      VERIFIED_ABSENT     - Full history fetched; contest absent OR attended=False
      NOT_FOUND           - LeetCode profile does not exist for this username
      SOURCE_UNAVAILABLE  - API error/timeout; absence cannot be determined
      DATA_PENDING        - History fetch not yet attempted for this student
      PENDING_USERNAME    - Student has no LeetCode username configured

    CRITICAL DATA INTEGRITY RULES:
    - Q1-Q4 are always NULL: LeetCode history API does not return per-question results.
      Never inferred from problems_solved. Never fabricated.
    - contest_rank: stored directly from LeetCode 'ranking' field. NULL if not returned.
    - contest_rating: stored directly from LeetCode 'rating' field. NULL if not returned.
    - VERIFIED_ABSENT requires: ingest_status=SUCCESS AND contest not in history (or attended=False).
    - SOURCE_UNAVAILABLE/TIMEOUT can NEVER become VERIFIED_ABSENT.
    """
    __tablename__ = "forensic_audit_records"
    __table_args__ = (
        UniqueConstraint("student_id", "contest_id", name="uix_forensic_student_contest"),
    )

    id              = Column(Integer, primary_key=True, index=True)
    job_id          = Column(String(100), index=True, nullable=False)
    student_id      = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)

    # Canonical contest identity
    contest_id      = Column(String(100), nullable=False, index=True)   # weekly-contest-515
    contest_name    = Column(String(150), nullable=False)                # Weekly Contest 515
    contest_number  = Column(Integer, nullable=False, index=True)        # 515
    contest_date    = Column(String(20), nullable=True)                  # YYYY-MM-DD (Sunday)

    # Honest audit status
    verification_status = Column(String(30), nullable=False, index=True)

    # Source-derived performance data — NULL when absent/unavailable; NEVER inferred
    attended        = Column(Boolean, nullable=True)    # direct from LeetCode attended field
    problems_solved = Column(Integer, nullable=True)    # direct from problemsSolved
    score           = Column(Integer, nullable=True)    # direct from problemsSolved (no separate score in history API)
    contest_rank    = Column(Integer, nullable=True)    # direct from ranking; NULL if not returned
    contest_rating  = Column(Float, nullable=True)      # direct from rating; NULL if not returned
    # Q1–Q4 are ALWAYS NULL — LeetCode history API does not provide per-question breakdown
    q1_solved       = Column(Boolean, nullable=True)    # NULL = not available from source
    q2_solved       = Column(Boolean, nullable=True)
    q3_solved       = Column(Boolean, nullable=True)
    q4_solved       = Column(Boolean, nullable=True)

    # Forensic evidence chain
    source_evidence = Column(JSON, nullable=True)        # raw LeetCode response fields
    trace_id        = Column(String(100), nullable=True)
    evidence_hash   = Column(String(64), nullable=True)  # SHA-256 of source_evidence JSON

    # Timestamps
    source_timestamp = Column(DateTime, nullable=True)  # LeetCode contest.startTime
    resolved_at      = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at       = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    student = relationship("Student", backref="forensic_audit_records")


# ─────────────────────────────────────────────────────────────────────────────
# PRODUCTION LEETCODE CONTEST TRACKING SYSTEM (FINAL SCHEMA)
# ─────────────────────────────────────────────────────────────────────────────

class Contest(Base):
    """
    Contest table: Primary Identity = (platform, contest_slug)
    All timestamps stored in UTC.
    """
    __tablename__ = "contests"
    __table_args__ = (
        UniqueConstraint("platform", "contest_slug", name="uix_contests_platform_slug"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String(50), nullable=False, default="leetcode")
    contest_slug = Column(String(200), nullable=False, index=True)
    contest_title = Column(String(200), nullable=True)
    contest_number = Column(Integer, nullable=True)  # DISPLAY ONLY, NOT identity
    contest_type = Column(String(50), nullable=True, default="weekly")
    start_time = Column(DateTime(timezone=True), nullable=False, index=True)  # UTC
    end_time = Column(DateTime(timezone=True), nullable=False)    # UTC
    duration = Column(Integer, nullable=False, default=5400)      # seconds
    status = Column(String(50), default="upcoming", index=True)   # upcoming, live, finalized, completed
    problem_list = Column(JSON, nullable=True)
    metadata_json = Column("metadata", JSON, nullable=True)
    discovered_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class LeetCodeAccount(Base):
    """
    Normalized LeetCode accounts linked to students.
    """
    __tablename__ = "leetcode_accounts"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    leetcode_username = Column(String(100), unique=True, nullable=False, index=True)
    normalized_username = Column(String(100), nullable=True, index=True)
    profile_url = Column(String(500), nullable=True)
    is_verified = Column(Boolean, default=False)
    profile_data = Column(JSON, nullable=True)
    updated_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    student = relationship("Student", backref=backref("leetcode_accounts"))


class IntegrityCase(Base):
    """
    Tracks Contest Integrity Dual-ID detection cases.
    Created when a single People ID is linked to multiple contest accounts that violated rules.
    """
    __tablename__ = "integrity_cases"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(String(100), unique=True, nullable=False, index=True)
    people_id = Column(String(50), nullable=False, index=True)
    contest_id = Column(String(100), nullable=False, index=True)
    account_ids = Column(JSON, nullable=False) # Array of account usernames
    participation_statuses = Column(JSON, nullable=False) # Array of objects
    status = Column(String(50), default="PENDING", index=True) # PENDING, CONFIRMED, DISMISSED
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)
    reviewed_by = Column(String(100), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    # Idempotency & Notification Dispatch tracking
    student_email_sent = Column(Boolean, default=False)
    staff_email_sent = Column(Boolean, default=False)
    staff_push_sent = Column(Boolean, default=False)
    idempotency_key = Column(String(120), nullable=True, unique=True, index=True)
    audit_history = Column(JSON, nullable=True)
    
    __table_args__ = (
        UniqueConstraint("people_id", "contest_id", name="uix_integrity_people_contest"),
    )


class AuditLogRecord(Base):
    """
    Comprehensive lifecycle & integrity system audit log table.
    Stores events: Contest sync started, Contest sync completed, Final attendance calculated,
    Attendance frozen, Account mapping performed, Duplicate account detected, Integrity case created,
    Student email sent, Staff email sent, Staff notification sent, Staff opened case, Staff resolved case.
    """
    __tablename__ = "integrity_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(100), nullable=False, index=True)
    contest_id = Column(String(100), nullable=True, index=True)
    people_id = Column(String(50), nullable=True, index=True)
    details = Column(JSON, nullable=True)
    created_by = Column(String(100), default="SYSTEM")
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, index=True)



class ContestParticipationRecord(Base):
    """
    Core normalized contest participation table.
    - 3 User-Facing States: ACTUAL, VIRTUAL, NOT_VERIFIED
    - 5 Internal Verification States: VERIFIED, PENDING, CONFLICT, INSUFFICIENT_EVIDENCE, SOURCE_ERROR
    - Immutable 09:58 / 10:00 Snapshot preservation
    """
    __tablename__ = "contest_participation"
    __table_args__ = (
        UniqueConstraint("contest_id", "student_id", name="uix_contest_part_student"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, index=True)
    contest_id = Column(Integer, ForeignKey("contests.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    leetcode_username = Column(String(100), nullable=False)

    # USER-FACING STATE (3 states only)
    participation_status = Column(String(50), nullable=False, default="NOT_VERIFIED", index=True)

    # INTERNAL VERIFICATION STATE (5 states)
    verification_status = Column(String(50), default="PENDING", index=True)

    # Contest Results (NULL if unavailable)
    rank = Column(Integer, nullable=True)
    score = Column(Integer, nullable=True)
    solved_count = Column(Integer, nullable=True)
    finish_time = Column(Integer, nullable=True)  # seconds

    # Question-level data
    questions = Column(JSON, nullable=True)

    # Evidence Tracking (Source only, NOT raw payload)
    evidence_source = Column(String(200), nullable=True)
    evidence_metadata = Column(JSON, nullable=True)
    confidence = Column(String(20), default="NONE")  # HIGH, MEDIUM, UNKNOWN, NONE

    # Timelines
    first_fetched_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)
    last_fetched_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)
    verified_at = Column(DateTime(timezone=True), nullable=True)

    # Rating (Separate Lifecycle)
    rating = Column(Integer, nullable=True)
    rating_change = Column(Integer, nullable=True)
    global_ranking = Column(Integer, nullable=True)
    rating_updated_at = Column(DateTime(timezone=True), nullable=True)

    # 10 AM Snapshot (Immutable)
    snapshot_rank = Column(Integer, nullable=True)
    snapshot_score = Column(Integer, nullable=True)
    snapshot_solved = Column(Integer, nullable=True)
    snapshot_at = Column(DateTime(timezone=True), nullable=True, index=True)

    contest = relationship("Contest", backref="participations")
    student = relationship("Student", backref="contest_tracking_records")


class SnapshotRecord(Base):
    """
    Live tracking snapshot history.
    """
    __tablename__ = "snapshots"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    contest_id = Column(Integer, ForeignKey("contests.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    rank = Column(Integer, nullable=True)
    score = Column(Integer, nullable=True)
    solved_count = Column(Integer, nullable=True)
    captured_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, index=True)

    contest = relationship("Contest", backref="live_snapshots")
    student = relationship("Student", backref="contest_snapshots_history")


class RawDataRecord(Base):
    """
    Audit table: Raw API responses stored separately from normalized data.
    """
    __tablename__ = "raw_data"
    __table_args__ = (
        UniqueConstraint("contest_id", "username", "operation_name", "captured_at", name="uix_raw_data_audit"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, index=True)
    contest_id = Column(Integer, ForeignKey("contests.id"), nullable=True, index=True)
    username = Column(String(100), nullable=True)
    endpoint = Column(String(200), nullable=True)
    operation_name = Column(String(200), nullable=True)
    http_status = Column(Integer, nullable=True)
    graphql_errors = Column(JSON, nullable=True)
    payload = Column(JSON, nullable=True)  # Full raw response
    is_critical = Column(Boolean, default=False)
    captured_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, index=True)


class AIChatHistory(Base):
    """
    Stores all user AI chat queries, AI responses, and metadata in SQLite DB for persistence & auditing.
    """
    __tablename__ = "ai_chat_history"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), index=True, nullable=True)
    user_query = Column(Text, nullable=False)
    ai_response = Column(Text, nullable=False)
    mode = Column(String(50), default="operations")
    data_status = Column(String(50), default="VERIFIED")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# ============================================================================
# 🤖 AI CODING INTELLIGENCE PLATFORM MODELS
# ============================================================================

class StudentRiskProfile(Base):
    """
    Stores dynamic Risk Score (0-100), Risk Level (LOW, MODERATE, HIGH, CRITICAL),
    Early Disengagement detection, Evidence, Explanations, Confidence, and Recommended Actions.
    """
    __tablename__ = "student_risk_profiles"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), unique=True, nullable=False, index=True)
    
    risk_score = Column(Float, default=0.0, nullable=False) # 0 to 100
    risk_level = Column(String(30), default="LOW", nullable=False) # LOW, MODERATE, HIGH, CRITICAL
    
    is_silent_disengaged = Column(Boolean, default=False)
    disengagement_drop_pct = Column(Float, nullable=True)
    
    evidence_json = Column(JSON, nullable=True) # Bullet points of signals
    explanation = Column(Text, nullable=True) # Explainable AI description
    recommended_action = Column(Text, nullable=True) # Actionable mentor guidance
    confidence_pct = Column(Float, default=85.0) # AI Confidence score 0-100%
    
    last_calculated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    student = relationship("Student", backref=backref("risk_profile", uselist=False))


class FacultyIntervention(Base):
    """
    Tracks faculty mentoring interventions across their full lifecycle:
    Risk Detected -> Faculty Assigned -> Intervention Created -> Practice Assigned -> Student Completes -> Performance Re-evaluated.
    """
    __tablename__ = "faculty_interventions"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    faculty_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    
    title = Column(String(200), nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(30), default="Pending", index=True) # Pending, In Progress, Completed, Monitoring, Resolved
    priority = Column(String(20), default="Medium", index=True) # High, Medium, Low
    
    assigned_topics = Column(JSON, nullable=True) # e.g. ["Dynamic Programming", "Graphs"]
    target_problem_count = Column(Integer, default=5)
    completed_problem_count = Column(Integer, default=0)
    
    # Intervention Effectiveness Tracking
    rating_before = Column(Float, nullable=True)
    rating_after = Column(Float, nullable=True)
    weekly_solved_before = Column(Integer, default=0)
    weekly_solved_after = Column(Integer, default=0)
    improvement_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    student = relationship("Student", backref="interventions")
    faculty = relationship("User", backref="assigned_interventions")


class StudentSkillProfile(Base):
    """
    Stores DSA Skill Knowledge Map (16 core topics), Contest Skill, DSA Skill,
    Consistency Score, Growth Rate, and Next Recommended Skill.
    """
    __tablename__ = "student_skill_profiles"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), unique=True, nullable=False, index=True)
    
    overall_score = Column(Float, default=50.0) # 0 to 100
    contest_skill = Column(Float, default=50.0) # 0 to 100
    dsa_skill = Column(Float, default=50.0) # 0 to 100
    consistency_score = Column(Float, default=50.0) # 0 to 100
    growth_rate_pct = Column(Float, default=0.0) # e.g. +18.4%
    
    current_level = Column(String(30), default="INTERMEDIATE") # BEGINNER, INTERMEDIATE, ADVANCED, EXPERT
    next_recommended_skill = Column(String(100), default="Dynamic Programming")
    
    dsa_topic_scores = Column(JSON, nullable=True) # Dict of 16 topics -> score (0-100)
    strong_areas = Column(JSON, nullable=True) # Array of top strong topic strings
    weak_areas = Column(JSON, nullable=True) # Array of top weak topic strings
    
    last_calculated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    student = relationship("Student", backref=backref("skill_profile", uselist=False))


class StudentLearningPath(Base):
    """
    Stores student-specific 4-week adaptive learning plan.
    """
    __tablename__ = "student_learning_paths"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    
    title = Column(String(200), default="Adaptive 4-Week DSA Acceleration Plan")
    status = Column(String(30), default="ACTIVE") # ACTIVE, COMPLETED, ADJUSTED
    current_week = Column(Integer, default=1)
    weeks_plan_json = Column(JSON, nullable=False) # 4 week plan array with tasks and targets
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    student = relationship("Student", backref="learning_paths")


class SystemAlert(Base):
    """
    Automated Priority Notification Alert Center record.
    Types: CRITICAL (Red), WARNING (Orange), ATTENTION (Yellow), ACHIEVEMENT (Green)
    """
    __tablename__ = "system_alerts"

    id = Column(Integer, primary_key=True, index=True)
    alert_type = Column(String(30), default="ATTENTION", index=True) # CRITICAL, WARNING, ATTENTION, ACHIEVEMENT
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=True)
    
    action_label = Column(String(100), nullable=True)
    action_route = Column(String(100), nullable=True)
    
    is_read = Column(Boolean, default=False, index=True)
    is_resolved = Column(Boolean, default=False, index=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)

    student = relationship("Student")
    department = relationship("Department")


class FacultyActionQueueItem(Base):
    """
    Task-based action queue item for faculty interventions & mentoring lifecycle.
    Lifecycle: Pending -> In Progress -> Monitoring -> Completed -> Resolved
    """
    __tablename__ = "faculty_action_queue"
    __table_args__ = (
        UniqueConstraint("student_id", "signal_type", "contest_id", name="uq_faculty_action_signal"),
        {"extend_existing": True}
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    faculty_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    
    priority = Column(String(20), default="Medium", index=True) # Critical, High, Medium, Low
    priority_score = Column(Integer, default=50) # 0 to 100
    signal_type = Column(String(50), default="PERFORMANCE_DROP", index=True) # CONTEST_ABSENT, VIRTUAL_STREAK, PERFORMANCE_DROP, WEAK_TOPIC, LOW_SOLVE_COUNT, SILENT_DISENGAGED
    contest_id = Column(String(100), default="live", index=True)
    
    reason = Column(Text, nullable=False)
    recommended_action = Column(Text, nullable=False)
    status = Column(String(30), default="Pending", index=True) # Pending, In Progress, Monitoring, Completed, Resolved
    category = Column(String(50), default="PERFORMANCE_DROP", index=True)
    
    assigned_faculty_name = Column(String(150), nullable=True)
    due_date = Column(DateTime, nullable=True)
    follow_up_date = Column(DateTime, nullable=True)
    next_review_date = Column(DateTime, nullable=True)
    
    action_taken = Column(Text, nullable=True)
    faculty_notes = Column(Text, nullable=True)
    evidence_remarks = Column(Text, nullable=True)
    
    is_escalated = Column(Boolean, default=False)
    escalated_to = Column(String(100), nullable=True) # e.g. "HOD", "Principal"
    escalated_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    student = relationship("Student", backref="faculty_actions")
    faculty = relationship("User")
    audit_logs = relationship("FacultyActionAuditLog", back_populates="action_item", cascade="all, delete-orphan", order_by="FacultyActionAuditLog.id.asc()")


class FacultyActionAuditLog(Base):
    """
    Immutable audit history log for faculty intervention actions.
    Records every status change, assignment, note addition, follow-up, and escalation.
    """
    __tablename__ = "faculty_action_audit_logs"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    action_id = Column(Integer, ForeignKey("faculty_action_queue.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_name = Column(String(150), default="System")
    
    event_type = Column(String(50), nullable=False, index=True) # ACTION_CREATED, PRIORITY_CHANGED, FACULTY_ASSIGNED, STATUS_CHANGED, NOTE_ADDED, FOLLOW_UP_SCHEDULED, ESCALATED, RESOLVED
    previous_value = Column(String(200), nullable=True)
    new_value = Column(String(200), nullable=True)
    reason = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)

    action_item = relationship("FacultyActionQueueItem", back_populates="audit_logs")
    user = relationship("User")


class EmailCampaign(Base):
    """
    Institutional Email Campaign model for bulk notifications and reports.
    Supports campaigns targeting up to 3,500+ students, faculty, and HODs.
    """
    __tablename__ = "email_campaigns"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    campaign_name = Column(String(200), nullable=False, index=True)
    subject = Column(String(255), nullable=False)
    body_html = Column(Text, nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    scope_type = Column(String(50), nullable=False)  # ALL_INSTITUTION, ALL_HODS, ALL_FACULTY, ALL_STUDENTS, DEPT_ALL, DEPT_FACULTY, DEPT_STUDENTS, MY_MENTEES, CUSTOM
    scope_id = Column(Integer, nullable=True)  # department_id or faculty_id
    status = Column(String(50), default="QUEUED", index=True)  # QUEUED, PROCESSING, COMPLETED, PAUSED, FAILED
    
    total_recipients = Column(Integer, default=0)
    queued_count = Column(Integer, default=0)
    sent_count = Column(Integer, default=0)
    delivered_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    bounced_count = Column(Integer, default=0)
    skipped_duplicates = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    sender = relationship("User")
    queue_items = relationship("EmailQueueItem", back_populates="campaign", cascade="all, delete-orphan")


class EmailQueueItem(Base):
    """
    Individual queued email record for bulk dispatch tracking.
    """
    __tablename__ = "email_queue_items"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("email_campaigns.id"), nullable=False, index=True)
    recipient_email = Column(String(255), nullable=False, index=True)
    recipient_name = Column(String(200), nullable=True)
    recipient_role = Column(String(50), nullable=True)
    status = Column(String(50), default="PENDING", index=True)  # PENDING, SENDING, DELIVERED, FAILED, BOUNCED, SKIPPED
    attempts = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    last_attempt_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)

    campaign = relationship("EmailCampaign", back_populates="queue_items")


class ContestVirtualEvidence(Base):
    """
    Dedicated immutable evidence records for verified Virtual Contest participation.
    """
    __tablename__ = "contest_virtual_evidence"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    contest_id = Column(String(100), nullable=False, index=True)
    session_id = Column(Integer, ForeignKey("weekly_sessions.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    registration_number = Column(String(50), nullable=False, index=True)
    leetcode_username = Column(String(100), nullable=False, index=True)
    
    virtual_status = Column(String(50), default="VERIFIED_VIRTUAL")
    virtual_session_id = Column(String(100), nullable=True)
    participation_time_utc = Column(DateTime, nullable=True)
    participation_time_ist = Column(String(50), nullable=True)
    evidence_level = Column(String(50), default="LEVEL_5_AUTHORITATIVE_VIRTUAL")
    evidence_source = Column(String(100), default="LeetCode Authoritative Virtual Contest API")
    evidence_reference = Column(Text, nullable=True)
    verified_at = Column(DateTime, default=datetime.datetime.utcnow)
    verification_method = Column(String(50), default="AUTHORITATIVE_GRAPHQL")

    session = relationship("WeeklySession")
    student = relationship("Student")


class ContestPostPracticeEvidence(Base):
    """
    Dedicated records for post-contest practice submissions on official contest problems.
    """
    __tablename__ = "contest_post_practice_evidence"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    contest_id = Column(String(100), nullable=False, index=True)
    session_id = Column(Integer, ForeignKey("weekly_sessions.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    registration_number = Column(String(50), nullable=False, index=True)
    leetcode_username = Column(String(100), nullable=False, index=True)
    
    problem_id = Column(String(50), nullable=False)
    question_number = Column(Integer, nullable=False)
    slug = Column(String(150), nullable=False, index=True)
    submission_id = Column(String(100), nullable=True)
    status = Column(String(50), default="ACCEPTED")
    accepted_timestamp_utc = Column(DateTime, nullable=True)
    accepted_timestamp_ist = Column(String(50), nullable=True)
    evidence_source = Column(String(100), default="LeetCode Recent Submissions API")
    detected_at = Column(DateTime, default=datetime.datetime.utcnow)

    session = relationship("WeeklySession")
    student = relationship("Student")


class VirtualScanAudit(Base):
    """
    Forensic scan execution log for complete audit traceability.
    """
    __tablename__ = "virtual_scan_audits"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    scan_id = Column(String(100), unique=True, nullable=False, index=True)
    contest_id = Column(String(100), nullable=False, index=True)
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    students_scanned = Column(Integer, default=0)
    profiles_valid = Column(Integer, default=0)
    profiles_invalid = Column(Integer, default=0)
    live_candidates = Column(Integer, default=0)
    virtual_candidates = Column(Integer, default=0)
    practice_candidates = Column(Integer, default=0)
    
    api_success = Column(Boolean, default=True)
    api_failure = Column(Boolean, default=False)
    evidence_found = Column(Integer, default=0)
    evidence_unavailable = Column(Integer, default=0)
    snapshot_created = Column(Boolean, default=False)
    checksum = Column(String(128), nullable=True)
    engine_version = Column(String(50), default="7.0.0-AUTHENTICATED-VIRTUAL")


class ContestVirtualScreenshotEvidence(Base):
    """
    Optional screenshot-based forensic evidence record with SHA-256 integrity hash.
    """
    __tablename__ = "contest_virtual_screenshot_evidence"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    leetcode_username = Column(String(100), nullable=False, index=True)
    contest_id = Column(String(100), nullable=False, index=True)
    image_hash = Column(String(64), nullable=False, index=True)
    captured_at = Column(DateTime, default=datetime.datetime.utcnow)
    source = Column(String(100), default="USER_UPLOADED_SCREENSHOT")
    ocr_result = Column(JSON, nullable=True)
    detected_contest_name = Column(String(150), nullable=True)
    detected_virtual_label = Column(Boolean, default=False)
    detected_solved_count = Column(Integer, default=0)
    confidence = Column(Float, default=0.0)
    review_status = Column(String(50), default="PENDING_REVIEW")  # PENDING_REVIEW, VERIFIED, UNVERIFIED_SCREENSHOT, REJECTED

    student = relationship("Student")


class OfficialPublicParticipant(Base):
    """
    Authoritative record for Official Public/Live Contest Participants.
    Contains ONLY verified matches from complete official LeetCode contest leaderboards.
    Supports versioned dataset management with historical superseding.
    """
    __tablename__ = "official_public_participants"
    __table_args__ = (
        UniqueConstraint("session_id", "student_id", "dataset_version", name="uq_official_public_session_student_version"),
        {"extend_existing": True}
    )

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("weekly_sessions.id"), nullable=False, index=True)
    contest_id = Column(String(100), nullable=True, index=True)
    contest_slug = Column(String(100), nullable=False, index=True)
    contest_title = Column(String(150), nullable=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    leetcode_username = Column(String(100), nullable=False, index=True)
    official_rank = Column(Integer, nullable=True)
    official_problems_solved = Column(Integer, default=0)
    official_score = Column(Integer, default=0)
    official_finish_time = Column(String(50), nullable=True)
    source = Column(String(100), default="official_leetcode_leaderboard")
    verification_status = Column(String(50), default="VERIFIED")
    dataset_version = Column(Integer, default=1, index=True)
    is_active_version = Column(Boolean, default=True, index=True)
    sync_timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    session = relationship("WeeklySession")
    student = relationship("Student")


class PublicContestSyncAudit(Base):
    """
    Comprehensive operational audit trail & distributed lease lock tracking for official public contest synchronizations.
    """
    __tablename__ = "public_contest_sync_audits"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    sync_id = Column(String(100), unique=True, nullable=False, index=True)
    session_id = Column(Integer, ForeignKey("weekly_sessions.id"), nullable=True, index=True)
    contest_id = Column(String(100), nullable=True, index=True)
    contest_slug = Column(String(100), nullable=False, index=True)
    contest_title = Column(String(150), nullable=True)
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    source = Column(String(100), default="official_leetcode_leaderboard")
    pages_requested = Column(Integer, default=0)
    pages_successfully_fetched = Column(Integer, default=0)
    total_reported = Column(Integer, nullable=True)
    total_fetched = Column(Integer, default=0)
    unique_usernames = Column(Integer, default=0)
    duplicate_count = Column(Integer, default=0)
    matched_students = Column(Integer, default=0)
    missing_username_count = Column(Integer, default=0)
    retry_count = Column(Integer, default=0)
    dataset_version = Column(Integer, default=1)
    sync_owner = Column(String(100), nullable=True)
    heartbeat_at = Column(DateTime, nullable=True)
    lock_expiry = Column(DateTime, nullable=True)
    circuit_breaker_state = Column(String(50), default="CLOSED")  # CLOSED, OPEN, HALF_OPEN
    cache_state = Column(String(50), default="FRESH")  # FRESH, STABLE, STALE, EXPIRED, INVALID
    validation_status = Column(String(50), default="VERIFIED")  # VERIFIED, CONTEST_MISMATCH, LEADERBOARD_INCOMPLETE, VERIFICATION_REQUIRED, API_FETCH_FAILED, SCHEMA_VALIDATION_FAILED, SYNC_IN_PROGRESS
    publish_status = Column(String(50), default="PUBLISHED")  # PUBLISHED, DO_NOT_PUBLISH, KPT_LAST_VERIFIED, SUPERSEDED
    failure_reason = Column(Text, nullable=True)


class PreviousWeekParticipationRecord(Base):
    """
    Unified Authoritative Previous Week LeetCode Contest Participation Record.
    Classifies every student into PUBLIC, VIRTUAL, NOT_PARTICIPATED, NOT_VERIFIED, or MISSING_LEETCODE_USERNAME.
    Supports atomic dataset versioning and role-based access control.
    """
    __tablename__ = "previous_week_participation_records"
    __table_args__ = (
        UniqueConstraint("session_id", "student_id", "dataset_version", name="uq_prev_week_session_student_version"),
        {"extend_existing": True}
    )

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("weekly_sessions.id"), nullable=False, index=True)
    contest_id = Column(String(100), nullable=False, index=True)
    contest_slug = Column(String(100), nullable=False, index=True)
    contest_title = Column(String(150), nullable=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    leetcode_username = Column(String(100), nullable=True, index=True)
    
    participation_type = Column(String(50), nullable=False, index=True)  # PUBLIC, VIRTUAL, NOT_PARTICIPATED, NOT_VERIFIED, MISSING_LEETCODE_USERNAME
    official_rank = Column(Integer, nullable=True)
    official_score = Column(Integer, nullable=True)
    q1 = Column(Integer, default=0)
    q2 = Column(Integer, default=0)
    q3 = Column(Integer, default=0)
    q4 = Column(Integer, default=0)
    problems_solved = Column(Integer, default=0)
    finish_time = Column(String(50), nullable=True)
    
    source = Column(String(100), default="official_leetcode_leaderboard")
    verification_status = Column(String(50), default="VERIFIED")  # VERIFIED, UNVERIFIED, VERIFICATION_REQUIRED
    verified_at = Column(DateTime, default=datetime.datetime.utcnow)
    sync_id = Column(String(100), nullable=True, index=True)
    dataset_version = Column(Integer, default=1, index=True)
    is_active_version = Column(Boolean, default=True, index=True)

    session = relationship("WeeklySession")
    student = relationship("Student")


class GlobalSyncLock(Base):
    """
    Global Single-Flight Atomic Lock for LeetCode Sync.
    Ensures that only one institutional sync operation runs at any given time across all workers.
    """
    __tablename__ = "global_sync_lock"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    is_locked = Column(Boolean, default=False, nullable=False)
    locked_by_job_id = Column(String(100), nullable=True)
    locked_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)


class ScheduledJobExecution(Base):
    __tablename__ = "scheduled_job_executions"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(100), index=True, nullable=False)
    job_type = Column(String(50), nullable=True)
    scheduled_at = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    status = Column(String(50), default="PENDING")
    error_message = Column(Text, nullable=True)
    last_error = Column(Text, nullable=True)
    next_run = Column(DateTime, nullable=True)


class ContestConfig(Base):
    """
    Configurable contest timing and parameters model.
    Enforces server-authoritative time and freeze boundaries.
    """
    __tablename__ = "contest_configs"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    contest_id = Column(String(100), unique=True, index=True, nullable=False)
    contest_name = Column(String(150), nullable=False)
    contest_start_time = Column(DateTime(timezone=True), nullable=False) # e.g. 08:00:00 IST
    contest_end_time = Column(DateTime(timezone=True), nullable=False)   # e.g. 09:30:00 IST
    final_sync_end_time = Column(DateTime(timezone=True), nullable=False) # e.g. 09:35:00 IST
    timezone = Column(String(50), default="Asia/Kolkata", nullable=False)
    is_frozen = Column(Boolean, default=False, index=True)
    attendance_frozen_at = Column(DateTime(timezone=True), nullable=True)
    algorithm_version = Column(String(30), default="2.0.0")
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)


class AttendanceSnapshot(Base):
    """
    Immutable frozen snapshot of official contest attendance.
    Written at 09:35 AM IST freeze and never silently mutated.
    """
    __tablename__ = "attendance_snapshots"
    __table_args__ = (
        UniqueConstraint("contest_id", "people_id", "leetcode_username", name="uix_att_snapshot_user"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, index=True)
    contest_id = Column(String(100), nullable=False, index=True)
    people_id = Column(String(50), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    leetcode_username = Column(String(100), nullable=False, index=True)
    official_attendance_state = Column(String(30), nullable=False, index=True) # ATTENDED, NOT_ATTENDED, UNKNOWN
    source = Column(String(100), default="official_contest_sync")
    calculated_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)
    frozen_at = Column(DateTime(timezone=True), nullable=False)
    algorithm_version = Column(String(30), default="2.0.0")
    snapshot_version = Column(Integer, default=1)


class CorrectionEvent(Base):
    """
    Audit log record for legitimate administrative corrections to frozen snapshots.
    """
    __tablename__ = "attendance_correction_events"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    audit_id = Column(String(100), unique=True, index=True, nullable=False)
    snapshot_id = Column(Integer, ForeignKey("attendance_snapshots.id"), nullable=False, index=True)
    contest_id = Column(String(100), nullable=False, index=True)
    people_id = Column(String(50), nullable=False, index=True)
    old_value = Column(String(30), nullable=False)
    new_value = Column(String(30), nullable=False)
    reason = Column(Text, nullable=False)
    staff_id = Column(String(100), nullable=False)
    timestamp = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, index=True)


class PostContestActivityRecord(Base):
    """
    Persistent storage for solves/submissions occurring after official cutoff (09:30 AM IST).
    Does NOT alter frozen official attendance.
    """
    __tablename__ = "post_contest_activity_records"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(String(120), unique=True, index=True, nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    people_id = Column(String(50), nullable=False, index=True)
    contest_id = Column(String(100), nullable=False, index=True)
    account_id = Column(String(100), nullable=False) # LeetCode username
    submission_time = Column(DateTime(timezone=True), nullable=False, index=True)
    activity_type = Column(String(30), nullable=False, index=True) # IN_CONTEST, POST_CONTEST, VIRTUAL
    problem_slug = Column(String(150), nullable=True)
    result = Column(String(50), nullable=True)
    source = Column(String(100), default="leetcode_post_sync")
    server_received_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)


class NotificationEvent(Base):
    """
    Transactional Outbox model for idempotent notifications.
    Guarantees exactly 1 Student Email, 1 Staff Email, 1 Staff Push per case.
    """
    __tablename__ = "notification_outbox_events"
    __table_args__ = (
        UniqueConstraint("case_id", "recipient_type", "channel", name="uix_notif_outbox_case_rec_chan"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, index=True)
    notification_event_id = Column(String(120), unique=True, index=True, nullable=False)
    case_id = Column(String(100), nullable=False, index=True)
    people_id = Column(String(50), nullable=False, index=True)
    recipient_type = Column(String(30), nullable=False) # STUDENT, STAFF_EMAIL, STAFF_PUSH
    channel = Column(String(30), nullable=False)        # EMAIL, FCM_PUSH, FIRESTORE
    recipient_target = Column(String(255), nullable=False) # email address, FCM token, or UID
    payload = Column(JSON, nullable=False)
    status = Column(String(30), default="PENDING", index=True) # PENDING, PROCESSING, SENT, FAILED, RETRYING
    attempt_count = Column(Integer, default=0)
    max_attempts = Column(Integer, default=3)
    idempotency_key = Column(String(120), unique=True, index=True, nullable=False)
    provider_message_id = Column(String(100), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, index=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)


class LiveContestEvent(Base):
    """
    Persistent sequence store for real-time WebSocket contest activity events.
    Enables missed event recovery (via version > last_received_version) and deduplication.
    """
    __tablename__ = "live_contest_events"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(120), unique=True, index=True, nullable=False)
    version = Column(Integer, index=True, nullable=False)
    contest_id = Column(String(100), index=True, nullable=False)
    people_id = Column(String(50), index=True, nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    account_id = Column(String(100), nullable=False)
    event_type = Column(String(50), nullable=False, default="STUDENT_ACTIVITY_UPDATED")
    payload = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, index=True)

    next_run = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class WeeklyStudentSnapshot(Base):
    """
    Immutable historical student snapshot captured per reporting period for official college reports.
    Ensures Last Week calculations represent the student's problem-solving state at that cutoff.
    """
    __tablename__ = "weekly_student_snapshots"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    reporting_period_id = Column(String(100), index=True, nullable=False)
    people_id = Column(String(100), index=True, nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    primary_account_id = Column(String(100), nullable=True)
    primary_solved_count = Column(Integer, default=0, nullable=False)
    solved_bucket = Column(String(50), nullable=False)
    contest_attended = Column(Boolean, default=False)
    contest_data = Column(Text, nullable=True)
    contest_rating = Column(Float, nullable=True)
    contest_ranking = Column(Integer, nullable=True)
    verification_status = Column(String(50), default="VERIFIED")
    captured_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    student = relationship("Student", backref="weekly_snapshots")


class WeeklyReportAudit(Base):
    """
    Audit log record generated for every official college report export.
    Proves exactly how a report was generated, including discovered contest IDs and validation results.
    """
    __tablename__ = "weekly_report_audits"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(String(100), unique=True, index=True, nullable=False)
    reporting_period_id = Column(String(100), index=True, nullable=False)
    report_date = Column(String(50), nullable=False)
    generated_by = Column(String(100), default="System")
    contests_included = Column(Text, nullable=False)
    total_students = Column(Integer, nullable=False)
    total_batches = Column(Integer, nullable=False)
    validation_status = Column(String(50), nullable=False, default="VALID")
    validation_details = Column(Text, nullable=True)
    file_hash = Column(String(128), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)


class NotificationRecord(Base):
    """
    Central persistent Notification Record for Web + Android.
    Supports idempotency (event_id), recipient scope, categories, and deep routes.
    """
    __tablename__ = "notification_records"
    __table_args__ = (
        Index("ix_notif_rec_recipient_read", "recipient_user_id", "is_read"),
        Index("ix_notif_rec_created", "created_at"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, index=True)
    notification_id = Column(String(100), unique=True, index=True, nullable=False)
    event_id = Column(String(120), index=True, nullable=True)
    event_type = Column(String(60), index=True, nullable=False, default="ANNOUNCEMENT")
    category = Column(String(50), index=True, nullable=False, default="announcements")
    
    recipient_user_id = Column(String(150), index=True, nullable=False)
    actor_user_id = Column(String(150), nullable=True)
    
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    
    entity_type = Column(String(60), nullable=True, index=True)
    entity_id = Column(String(100), nullable=True)
    file_id = Column(String(100), nullable=True)
    route = Column(String(255), nullable=True)
    priority = Column(String(20), default="normal", nullable=False) # low, normal, high, critical
    
    is_read = Column(Boolean, default=False, index=True)
    read_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    delivery_status = Column(String(30), default="SENT") # PENDING, SENT, DELIVERED, FAILED
    
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)


class FCMDeviceToken(Base):
    """
    Stores FCM device registration tokens for multi-device push notification delivery.
    """
    __tablename__ = "fcm_device_tokens"
    __table_args__ = (
        Index("ix_fcm_tokens_user_active", "user_id", "is_active"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(150), index=True, nullable=False)
    device_token = Column(String(500), unique=True, index=True, nullable=False)
    platform = Column(String(30), default="android", nullable=False) # android, ios, web
    app_version = Column(String(30), nullable=True)
    device_model = Column(String(100), nullable=True)
    
    is_active = Column(Boolean, default=True, index=True)
    last_seen = Column(DateTime, default=datetime.datetime.utcnow)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class NotificationPreference(Base):
    """
    User notification settings & category opt-in/opt-out preferences.
    """
    __tablename__ = "notification_preferences"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(150), unique=True, index=True, nullable=False)
    push_enabled = Column(Boolean, default=True, nullable=False)
    email_enabled = Column(Boolean, default=True, nullable=False)
    categories_json = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class NotificationFile(Base):
    """
    Secure file metadata store for notification attachments, reports, and documents.
    Enforces authorization check prior to preview or download.
    """
    __tablename__ = "notification_files"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(String(100), unique=True, index=True, nullable=False)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False) # pdf, xlsx, docx, png, jpg, etc.
    file_size = Column(Integer, nullable=True) # size in bytes
    storage_path = Column(String(500), nullable=False)
    uploaded_by = Column(String(150), nullable=False)
    
    entity_type = Column(String(60), nullable=True)
    entity_id = Column(String(100), nullable=True)
    access_scope = Column(String(100), default="ALL", nullable=False) # ALL, STUDENT, STAFF, CSE, CSE(CS), CSE(IoT), YEAR_3, ADMIN_ONLY, RECIPIENTS_ONLY
    allowed_user_ids = Column(Text, nullable=True) # JSON list if specific users
    
    is_deleted = Column(Boolean, default=False)
    expires_at = Column(DateTime, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)


class Conversation(Base):
    """
    Tracks a 1-to-1 conversation between two users.
    """
    __tablename__ = "conversations"
    __table_args__ = (
        UniqueConstraint("participant_1_id", "participant_2_id", name="uix_conversation_participants"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(String(100), unique=True, index=True, nullable=False)
    
    # Store user IDs (email, reg_no, or STAFF_{id})
    participant_1_id = Column(String(150), index=True, nullable=False)
    participant_2_id = Column(String(150), index=True, nullable=False)
    
    last_message_preview = Column(String(255), nullable=True)
    last_message_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    unread_count_1 = Column(Integer, default=0)
    unread_count_2 = Column(Integer, default=0)

    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    """
    Tracks individual messages within a conversation.
    """
    __tablename__ = "messages"
    __table_args__ = (
        Index("ix_messages_conv_created", "conversation_id", "created_at"),
        Index("ix_messages_unread_status", "conversation_id", "receiver_id", "status"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(String(100), unique=True, index=True, nullable=False)
    conversation_id = Column(String(100), ForeignKey("conversations.conversation_id"), index=True, nullable=False)
    
    sender_id = Column(String(150), index=True, nullable=False)
    receiver_id = Column(String(150), index=True, nullable=False)
    
    content = Column(Text, nullable=False)
    status = Column(String(30), default="SENT", index=True) # SENT, DELIVERED, READ
    
    delivered_at = Column(DateTime, nullable=True)
    read_at = Column(DateTime, nullable=True)
    edited_at = Column(DateTime, nullable=True)
    is_edited = Column(Boolean, default=False)
    is_deleted_everyone = Column(Boolean, default=False)
    deleted_by_users = Column(Text, default="[]") # JSON string of user_ids who executed delete-for-me
    reply_to_message_id = Column(String(100), nullable=True, index=True)
    reactions = Column(Text, default="{}") # JSON string mapping user_id -> emoji
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    
    attachment_file_id = Column(String(100), nullable=True) # Optional reference to NotificationFile

    conversation = relationship("Conversation", back_populates="messages")


class ReportCache(Base):
    """
    Stores pre-generated report metadata and file links for instant downloads.
    """
    __tablename__ = "report_cache"
    __table_args__ = (
        UniqueConstraint("institution_id", "week_id", "file_type", "data_version", name="uix_report_cache_key"),
        Index("ix_report_cache_lookup", "institution_id", "week_id", "file_type", "status"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, index=True)
    institution_id = Column(String(50), default="NEC", index=True, nullable=False)
    week_id = Column(String(50), default="latest", index=True, nullable=False)
    file_type = Column(String(50), index=True, nullable=False) # e.g. pdf, excel, official_summary, master_tracker
    storage_path = Column(String(500), nullable=True)
    download_url = Column(String(500), nullable=True)
    data_version = Column(String(100), index=True, nullable=False)
    status = Column(String(30), default="READY", index=True, nullable=False) # READY, PREPARING, FAILED
    generated_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    generation_time_ms = Column(Float, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)


class SystemSetting(Base):
    """
    Key-value system setting configuration store.
    """
    __tablename__ = "system_settings"
    __table_args__ = ({"extend_existing": True},)

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, index=True, nullable=False)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


