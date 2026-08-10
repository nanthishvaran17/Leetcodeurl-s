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

class LeetCodeProfileStats(Base):
    __tablename__ = "leetcode_profile_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), unique=True, nullable=False)
    
    total_solved = Column(Integer, default=0)
    easy_solved = Column(Integer, default=0)
    medium_solved = Column(Integer, default=0)
    hard_solved = Column(Integer, default=0)
    contest_rating = Column(Float, nullable=True)
    contest_global_ranking = Column(Integer, nullable=True)
    public_profile_ranking = Column(Integer, nullable=True)
    
    status = Column(String(50), default="DATA UNAVAILABLE") # OK, MISSING LINK, INVALID LINK, PROFILE NOT FOUND, DATA UNAVAILABLE
    error_message = Column(Text, nullable=True)
    last_updated = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    student = relationship("Student", back_populates="stats")

class WeeklySession(Base):
    __tablename__ = "weekly_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    academic_year = Column(String(20), default="2026-27")
    week_number = Column(Integer, nullable=False)
    session_date = Column(String(20), nullable=False) # YYYY-MM-DD
    start_time = Column(String(10), default="08:00")
    end_time = Column(String(10), default="09:30")
    status = Column(String(20), default="UPCOMING") # UPCOMING, ACTIVE, COMPLETED
    
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
