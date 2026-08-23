import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from backend.config import settings

# Ensure data directory exists
is_vercel = os.environ.get("VERCEL") == "1" or os.environ.get("VERCEL_ENV")
if is_vercel:
    DATA_DIR = "/tmp/data"
else:
    DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")

try:
    os.makedirs(DATA_DIR, exist_ok=True)
except Exception:
    DATA_DIR = "/tmp"

# Replace relative path if sqlite or handle Render postgres:// connection strings
raw_db_url = os.environ.get("DATABASE_URL")
db_url = raw_db_url.strip() if raw_db_url and raw_db_url.strip() else (settings.DATABASE_URL or "sqlite:///./data/leetcode_tracker.db")

if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)
elif is_vercel:
    db_url = "sqlite:////tmp/leetcode_tracker.db"
elif db_url.startswith("sqlite:///./"):
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), db_url.replace("sqlite:///./", ""))
    try:
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
    except Exception:
        pass
    db_url = f"sqlite:///{db_path}"

from sqlalchemy.pool import NullPool, QueuePool

engine_kwargs = {}
if "postgresql" in db_url or "postgres" in db_url:
    engine_kwargs.update({
        "pool_size": 25,
        "max_overflow": 15,
        "pool_timeout": 30,
        "pool_pre_ping": True,
        "pool_recycle": 300,
        "connect_args": {
            "connect_timeout": 10,
            "keepalives": 1,
            "keepalives_idle": 30,
            "keepalives_interval": 10,
            "keepalives_count": 5
        }
    })
else:
    engine_kwargs.update({
        "poolclass": NullPool,
        "connect_args": {"check_same_thread": False, "timeout": 60}
    })

try:
    engine = create_engine(
        db_url,
        echo=False,
        **engine_kwargs
    )
except Exception as _e_init:
    # Fallback to local SQLite if remote PostgreSQL URL is completely unreachable
    sqlite_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "leetcode_tracker.db")
    db_url = f"sqlite:///{sqlite_path}"
    engine = create_engine(
        db_url,
        echo=False,
        connect_args={"check_same_thread": False, "timeout": 60}
    )

from sqlalchemy import event

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if "sqlite" in db_url:
        try:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.execute("PRAGMA busy_timeout=60000")
            cursor.execute("PRAGMA cache_size=-128000")  # 128MB ultra-fast in-memory cache
            cursor.execute("PRAGMA mmap_size=268435456")  # 256MB Memory-Mapped I/O for instant reads
            cursor.execute("PRAGMA temp_store=MEMORY")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()
        except Exception:
            pass


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def run_migrations():
    """Apply any missing column migrations and performance indexes to the existing SQLite database."""
    try:
        from backend.models import Base as ModelsBase
        ModelsBase.metadata.create_all(bind=engine)
    except Exception as _t_err:
        pass

    if "sqlite" not in db_url:
        return  # Only needed for local SQLite
    try:
        with engine.connect() as conn:
            # Check leetcode_profile_stats columns
            result = conn.execute(
                __import__('sqlalchemy').text("PRAGMA table_info(leetcode_profile_stats)")
            )
            existing_cols = {row[1] for row in result}

            migrations = [
                ("sync_status",     "ALTER TABLE leetcode_profile_stats ADD COLUMN sync_status VARCHAR DEFAULT 'success'"),
                ("source",          "ALTER TABLE leetcode_profile_stats ADD COLUMN source VARCHAR DEFAULT 'leetcode_public_profile'"),
                ("last_verified_at","ALTER TABLE leetcode_profile_stats ADD COLUMN last_verified_at DATETIME"),
            ]
            for col_name, sql in migrations:
                if col_name not in existing_cols:
                    conn.execute(__import__('sqlalchemy').text(sql))
                    conn.commit()
                    print(f"[DB Migration] Added column: {col_name}")

            # Check hod_snapshots columns
            result_hod = conn.execute(
                __import__('sqlalchemy').text("PRAGMA table_info(hod_snapshots)")
            )
            hod_cols = {row[1] for row in result_hod}
            if hod_cols:
                hod_migrations = [
                    ("academic_year", "ALTER TABLE hod_snapshots ADD COLUMN academic_year VARCHAR DEFAULT '2026-27'"),
                    ("status",        "ALTER TABLE hod_snapshots ADD COLUMN status VARCHAR DEFAULT 'READY'"),
                    ("created_by",    "ALTER TABLE hod_snapshots ADD COLUMN created_by VARCHAR DEFAULT 'HOD / System'"),
                    ("verified_at",   "ALTER TABLE hod_snapshots ADD COLUMN verified_at DATETIME"),
                ]
                for col_name, sql in hod_migrations:
                    if col_name not in hod_cols:
                        conn.execute(__import__('sqlalchemy').text(sql))
                        conn.commit()
                        print(f"[DB Migration] Added hod_snapshots column: {col_name}")

            # Check weekly_sessions columns
            result_sess = conn.execute(
                __import__('sqlalchemy').text("PRAGMA table_info(weekly_sessions)")
            )
            sess_cols = {row[1] for row in result_sess}
            if sess_cols:
                sess_migrations = [
                    ("academic_year",        "ALTER TABLE weekly_sessions ADD COLUMN academic_year VARCHAR DEFAULT '2026-27'"),
                    ("week_number",          "ALTER TABLE weekly_sessions ADD COLUMN week_number INTEGER"),
                    ("session_code",         "ALTER TABLE weekly_sessions ADD COLUMN session_code VARCHAR"),
                    ("session_date",         "ALTER TABLE weekly_sessions ADD COLUMN session_date VARCHAR"),
                    ("contest_id",           "ALTER TABLE weekly_sessions ADD COLUMN contest_id VARCHAR"),
                    ("contest_name",         "ALTER TABLE weekly_sessions ADD COLUMN contest_name VARCHAR"),
                    ("start_time",           "ALTER TABLE weekly_sessions ADD COLUMN start_time VARCHAR DEFAULT '08:00'"),
                    ("end_time",             "ALTER TABLE weekly_sessions ADD COLUMN end_time VARCHAR DEFAULT '09:30'"),
                    ("status",               "ALTER TABLE weekly_sessions ADD COLUMN status VARCHAR DEFAULT 'SCHEDULED'"),
                    ("baseline_snapshot_id",  "ALTER TABLE weekly_sessions ADD COLUMN baseline_snapshot_id VARCHAR"),
                    ("final_snapshot_id",     "ALTER TABLE weekly_sessions ADD COLUMN final_snapshot_id VARCHAR"),
                    ("total_students",        "ALTER TABLE weekly_sessions ADD COLUMN total_students INTEGER DEFAULT 273"),
                    ("official_participants", "ALTER TABLE weekly_sessions ADD COLUMN official_participants INTEGER DEFAULT 0"),
                    ("virtual_participants",  "ALTER TABLE weekly_sessions ADD COLUMN virtual_participants INTEGER DEFAULT 0"),
                    ("not_participated",      "ALTER TABLE weekly_sessions ADD COLUMN not_participated INTEGER DEFAULT 0"),
                    ("failed_verification",   "ALTER TABLE weekly_sessions ADD COLUMN failed_verification INTEGER DEFAULT 0"),
                    ("dataset_hash",          "ALTER TABLE weekly_sessions ADD COLUMN dataset_hash VARCHAR"),
                    ("created_at",            "ALTER TABLE weekly_sessions ADD COLUMN created_at DATETIME"),
                    ("completed_at",          "ALTER TABLE weekly_sessions ADD COLUMN completed_at DATETIME"),
                    ("finalized_at",          "ALTER TABLE weekly_sessions ADD COLUMN finalized_at DATETIME"),
                ]
                for col_name, sql in sess_migrations:
                    if col_name not in sess_cols:
                        conn.execute(__import__('sqlalchemy').text(sql))
                        conn.commit()
                        print(f"[DB Migration] Added weekly_sessions column: {col_name}")

            # Check weekly_public_results columns
            result_pub = conn.execute(
                __import__('sqlalchemy').text("PRAGMA table_info(weekly_public_results)")
            )
            pub_cols = {row[1] for row in result_pub}
            if pub_cols:
                pub_migrations = [
                    ("data_fetch_status", "ALTER TABLE weekly_public_results ADD COLUMN data_fetch_status VARCHAR DEFAULT 'DATA_UNAVAILABLE'"),
                    ("confidence",        "ALTER TABLE weekly_public_results ADD COLUMN confidence VARCHAR DEFAULT 'UNVERIFIED'"),
                ]
                for col_name, sql in pub_migrations:
                    if col_name not in pub_cols:
                        conn.execute(__import__('sqlalchemy').text(sql))
                        conn.commit()
                        print(f"[DB Migration] Added weekly_public_results column: {col_name}")

            # Check student_contest_participations columns
            result_scp = conn.execute(
                __import__('sqlalchemy').text("PRAGMA table_info(student_contest_participations)")
            )
            scp_cols = {row[1] for row in result_scp}
            if scp_cols:
                scp_migrations = [
                    ("solved_problems", "ALTER TABLE student_contest_participations ADD COLUMN solved_problems TEXT"),
                    ("confidence",      "ALTER TABLE student_contest_participations ADD COLUMN confidence VARCHAR DEFAULT 'HIGH'"),
                ]
                for col_name, sql in scp_migrations:
                    if col_name not in scp_cols:
                        conn.execute(__import__('sqlalchemy').text(sql))
                        conn.commit()
                        print(f"[DB Migration] Added student_contest_participations column: {col_name}")

            # Check sync_jobs columns
            result_jobs = conn.execute(
                __import__('sqlalchemy').text("PRAGMA table_info(sync_jobs)")
            )
            job_cols = {row[1] for row in result_jobs}
            if job_cols:
                job_migrations = [
                    ("progress",        "ALTER TABLE sync_jobs ADD COLUMN progress FLOAT DEFAULT 0.0"),
                    ("processed_count", "ALTER TABLE sync_jobs ADD COLUMN processed_count INTEGER DEFAULT 0"),
                    ("last_synced_at",  "ALTER TABLE sync_jobs ADD COLUMN last_synced_at DATETIME"),
                    ("error_message",   "ALTER TABLE sync_jobs ADD COLUMN error_message TEXT"),
                ]
                for col_name, sql in job_migrations:
                    if col_name not in job_cols:
                        conn.execute(__import__('sqlalchemy').text(sql))
                        conn.commit()
                        print(f"[DB Migration] Added sync_jobs column: {col_name}")

                # Clean up any stale zombie RUNNING jobs on startup
                conn.execute(
                    __import__('sqlalchemy').text("UPDATE sync_jobs SET status = 'INTERRUPTED', completed_at = started_at WHERE status = 'RUNNING'")
                )
                conn.commit()

            # Check users table columns for WhatsApp integration
            result_users = conn.execute(
                __import__('sqlalchemy').text("PRAGMA table_info(users)")
            )
            users_cols = {row[1] for row in result_users}
            if users_cols:
                if "phone_number" not in users_cols:
                    conn.execute(__import__('sqlalchemy').text("ALTER TABLE users ADD COLUMN phone_number VARCHAR(30)"))
                    conn.commit()
                    print("[DB Migration] Added users column: phone_number")
                if "whatsapp_verified" not in users_cols:
                    conn.execute(__import__('sqlalchemy').text("ALTER TABLE users ADD COLUMN whatsapp_verified BOOLEAN DEFAULT 0"))
                    conn.commit()
                    print("[DB Migration] Added users column: whatsapp_verified")

            # Check students table columns for WhatsApp integration
            result_students = conn.execute(
                __import__('sqlalchemy').text("PRAGMA table_info(students)")
            )
            st_cols = {row[1] for row in result_students}
            if st_cols:
                if "phone_number" not in st_cols:
                    conn.execute(__import__('sqlalchemy').text("ALTER TABLE students ADD COLUMN phone_number VARCHAR(30)"))
                    conn.commit()
                    print("[DB Migration] Added students column: phone_number")
                if "whatsapp_verified" not in st_cols:
                    conn.execute(__import__('sqlalchemy').text("ALTER TABLE students ADD COLUMN whatsapp_verified BOOLEAN DEFAULT 0"))
                    conn.commit()
                    print("[DB Migration] Added students column: whatsapp_verified")

            # Promote nanthishvaran17@gmail.com to Admin role
            admin_check = conn.execute(
                __import__('sqlalchemy').text("SELECT id, role FROM users WHERE email = 'nanthishvaran17@gmail.com'")
            ).fetchone()

            if admin_check:
                if admin_check[1] != "Admin" and admin_check[1] != "admin":
                    conn.execute(
                        __import__('sqlalchemy').text("UPDATE users SET role = 'Admin', is_active = 1 WHERE email = 'nanthishvaran17@gmail.com'")
                    )
                    conn.commit()
                    print("[DB Migration] Promoted nanthishvaran17@gmail.com to Admin role.")
            else:
                conn.execute(
                    __import__('sqlalchemy').text(
                        "INSERT INTO users (username, email, hashed_password, role, is_active) "
                        "VALUES ('nanthishvaran17', 'nanthishvaran17@gmail.com', 'N/A_OTP_USER', 'Admin', 1)"
                    )
                )
                conn.commit()
                print("[DB Migration] Created Admin User account for nanthishvaran17@gmail.com.")

            # Check official_weekly_snapshots columns
            result_snaps = conn.execute(
                __import__('sqlalchemy').text("PRAGMA table_info(official_weekly_snapshots)")
            )
            snap_cols = {row[1] for row in result_snaps}
            if snap_cols:
                snap_migrations = [
                    ("is_superseded", "ALTER TABLE official_weekly_snapshots ADD COLUMN is_superseded BOOLEAN DEFAULT 0"),
                    ("superseded_by_id", "ALTER TABLE official_weekly_snapshots ADD COLUMN superseded_by_id INTEGER"),
                ]
                for col_name, sql in snap_migrations:
                    if col_name not in snap_cols:
                        conn.execute(__import__('sqlalchemy').text(sql))
                        conn.commit()
                        print(f"[DB Migration] Added official_weekly_snapshots column: {col_name}")

            # Check email_otp_records columns
            try:
                result_otp = conn.execute(
                    __import__('sqlalchemy').text("PRAGMA table_info(email_otp_records)")
                )
                otp_cols = {row[1] for row in result_otp}
                if otp_cols:
                    otp_migrations = [
                        ("delivery_status", "ALTER TABLE email_otp_records ADD COLUMN delivery_status VARCHAR(50) DEFAULT 'PENDING'"),
                        ("provider_message_id", "ALTER TABLE email_otp_records ADD COLUMN provider_message_id VARCHAR(255)"),
                    ]
                    for col_name, sql in otp_migrations:
                        if col_name not in otp_cols:
                            conn.execute(__import__('sqlalchemy').text(sql))
                            conn.commit()
                            print(f"[DB Migration] Added email_otp_records column: {col_name}")
            except Exception as _e_otp:
                pass

            # Check email_dispatch_logs columns
            try:
                result_edl = conn.execute(
                    __import__('sqlalchemy').text("PRAGMA table_info(email_dispatch_logs)")
                )
                edl_cols = {row[1] for row in result_edl}
                if edl_cols:
                    edl_migrations = [
                        ("email_id", "ALTER TABLE email_dispatch_logs ADD COLUMN email_id VARCHAR(100)"),
                        ("report_id", "ALTER TABLE email_dispatch_logs ADD COLUMN report_id VARCHAR(100)"),
                        ("session_id", "ALTER TABLE email_dispatch_logs ADD COLUMN session_id INTEGER"),
                        ("idempotency_key", "ALTER TABLE email_dispatch_logs ADD COLUMN idempotency_key VARCHAR(255)"),
                        ("recipient", "ALTER TABLE email_dispatch_logs ADD COLUMN recipient VARCHAR(150)"),
                        ("role", "ALTER TABLE email_dispatch_logs ADD COLUMN role VARCHAR(50) DEFAULT 'HOD'"),
                        ("subject", "ALTER TABLE email_dispatch_logs ADD COLUMN subject VARCHAR(255)"),
                        ("dispatch_type", "ALTER TABLE email_dispatch_logs ADD COLUMN dispatch_type VARCHAR(30) DEFAULT 'AUTOMATED'"),
                        ("provider", "ALTER TABLE email_dispatch_logs ADD COLUMN provider VARCHAR(50) DEFAULT 'BREVO_API'"),
                        ("status", "ALTER TABLE email_dispatch_logs ADD COLUMN status VARCHAR(30) DEFAULT 'QUEUED'"),
                        ("attachment_count", "ALTER TABLE email_dispatch_logs ADD COLUMN attachment_count INTEGER DEFAULT 0"),
                        ("total_attachment_bytes", "ALTER TABLE email_dispatch_logs ADD COLUMN total_attachment_bytes INTEGER DEFAULT 0"),
                        ("error_message", "ALTER TABLE email_dispatch_logs ADD COLUMN error_message TEXT"),
                        ("retry_count", "ALTER TABLE email_dispatch_logs ADD COLUMN retry_count INTEGER DEFAULT 0"),
                        ("sent_at", "ALTER TABLE email_dispatch_logs ADD COLUMN sent_at DATETIME"),
                        ("created_at", "ALTER TABLE email_dispatch_logs ADD COLUMN created_at DATETIME"),
                    ]
                    for col_name, sql in edl_migrations:
                        if col_name not in edl_cols:
                            conn.execute(__import__('sqlalchemy').text(sql))
                            conn.commit()
                            print(f"[DB Migration] Added email_dispatch_logs column: {col_name}")
            except Exception as _e_edl:
                pass

            # ── faculty_action_queue: add new columns if missing ─────────────
            try:
                result_faq = conn.execute(
                    __import__('sqlalchemy').text("PRAGMA table_info(faculty_action_queue)")
                )
                faq_cols = {row[1] for row in result_faq}
                if faq_cols:
                    faq_migrations = [
                        ("priority_score",        "ALTER TABLE faculty_action_queue ADD COLUMN priority_score INTEGER DEFAULT 20"),
                        ("signal_type",           "ALTER TABLE faculty_action_queue ADD COLUMN signal_type VARCHAR(80) DEFAULT 'ROUTINE_MONITORING'"),
                        ("contest_id",            "ALTER TABLE faculty_action_queue ADD COLUMN contest_id VARCHAR(60)"),
                        ("assigned_faculty_name", "ALTER TABLE faculty_action_queue ADD COLUMN assigned_faculty_name VARCHAR(150)"),
                        ("due_date",              "ALTER TABLE faculty_action_queue ADD COLUMN due_date DATETIME"),
                        ("follow_up_date",        "ALTER TABLE faculty_action_queue ADD COLUMN follow_up_date DATETIME"),
                        ("next_review_date",      "ALTER TABLE faculty_action_queue ADD COLUMN next_review_date DATETIME"),
                        ("action_taken",          "ALTER TABLE faculty_action_queue ADD COLUMN action_taken TEXT"),
                        ("faculty_notes",         "ALTER TABLE faculty_action_queue ADD COLUMN faculty_notes TEXT"),
                        ("evidence_remarks",      "ALTER TABLE faculty_action_queue ADD COLUMN evidence_remarks TEXT"),
                        ("is_escalated",          "ALTER TABLE faculty_action_queue ADD COLUMN is_escalated BOOLEAN DEFAULT 0"),
                        ("escalated_to",          "ALTER TABLE faculty_action_queue ADD COLUMN escalated_to VARCHAR(150)"),
                        ("escalated_at",          "ALTER TABLE faculty_action_queue ADD COLUMN escalated_at DATETIME"),
                        ("resolved_at",           "ALTER TABLE faculty_action_queue ADD COLUMN resolved_at DATETIME"),
                    ]
                    for col_name, sql in faq_migrations:
                        if col_name not in faq_cols:
                            conn.execute(__import__('sqlalchemy').text(sql))
                            conn.commit()
                            print(f"[DB Migration] Added faculty_action_queue column: {col_name}")
            except Exception as _e_faq:
                print(f"[DB Migration] faculty_action_queue migration note: {_e_faq}")

            # ── faculty_action_audit_logs: create if missing ─────────────────
            try:
                conn.execute(__import__('sqlalchemy').text("""
                    CREATE TABLE IF NOT EXISTS faculty_action_audit_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        action_id INTEGER NOT NULL REFERENCES faculty_action_queue(id),
                        user_id INTEGER REFERENCES users(id),
                        user_name VARCHAR(150) DEFAULT 'System',
                        event_type VARCHAR(50) NOT NULL,
                        previous_value VARCHAR(200),
                        new_value VARCHAR(200),
                        reason TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                conn.commit()
                print("[DB Migration] faculty_action_audit_logs table ensured.")
            except Exception as _e_audit:
                pass  # table already exists

            # Database-Level Snapshot Immutability Trigger (Prevents direct in-place mutation of dataset)
            try:
                trigger_sql = """
                CREATE TRIGGER IF NOT EXISTS trg_prevent_snapshot_mutation
                BEFORE UPDATE OF dataset, dataset_hash, student_count, error_count ON official_weekly_snapshots
                FOR EACH ROW
                WHEN OLD.dataset_hash IS NOT NULL AND NEW.is_superseded = OLD.is_superseded AND NEW.superseded_by_id IS OLD.superseded_by_id
                BEGIN
                    SELECT RAISE(ABORT, 'SNAPSHOT_IMMUTABLE: Finalized snapshot cannot be modified in-place. Use snapshot_supersedes() instead.');
                END;
                """
                conn.execute(__import__('sqlalchemy').text(trigger_sql))
                conn.commit()
                print("[DB Migration] Registered SQLite snapshot immutability trigger.")
            except Exception as _trg_err:
                print(f"[DB Migration] Trigger registration note: {_trg_err}")

            # ── faculty_student_assignments: create if missing ────────────────
            try:
                conn.execute(__import__('sqlalchemy').text("""
                    CREATE TABLE IF NOT EXISTS faculty_student_assignments (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        faculty_id INTEGER NOT NULL REFERENCES users(id),
                        student_id INTEGER NOT NULL UNIQUE REFERENCES students(id),
                        assigned_by_id INTEGER REFERENCES users(id),
                        is_active BOOLEAN DEFAULT 1,
                        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                conn.commit()
                print("[DB Migration] faculty_student_assignments table ensured.")
            except Exception as _e_fsa:
                pass

            # Performance Indexes Creation (Universal for both SQLite and PostgreSQL)
            indexes = [
                ("idx_students_dept_year", "CREATE INDEX IF NOT EXISTS idx_students_dept_year ON students(department_id, year_level)"),
                ("idx_students_is_active", "CREATE INDEX IF NOT EXISTS idx_students_is_active ON students(is_active)"),
                ("idx_students_name", "CREATE INDEX IF NOT EXISTS idx_students_name ON students(name)"),
                ("idx_students_reg_no", "CREATE INDEX IF NOT EXISTS idx_students_reg_no ON students(reg_no)"),
                ("idx_students_username", "CREATE INDEX IF NOT EXISTS idx_students_username ON students(username)"),
                ("idx_students_email", "CREATE INDEX IF NOT EXISTS idx_students_email ON students(email)"),
                ("idx_faculty_assign_fac_stud", "CREATE INDEX IF NOT EXISTS idx_faculty_assign_fac_stud ON faculty_student_assignments(faculty_id, student_id)"),
                ("idx_faculty_assign_stud", "CREATE INDEX IF NOT EXISTS idx_faculty_assign_stud ON faculty_student_assignments(student_id)"),
                ("idx_profile_stats_student_id", "CREATE INDEX IF NOT EXISTS idx_profile_stats_student_id ON leetcode_profile_stats(student_id)"),
                ("idx_profile_stats_total_solved", "CREATE INDEX IF NOT EXISTS idx_profile_stats_total_solved ON leetcode_profile_stats(total_solved)"),
                ("idx_profile_stats_contest_rating", "CREATE INDEX IF NOT EXISTS idx_profile_stats_contest_rating ON leetcode_profile_stats(contest_rating)"),
                ("idx_profile_stats_sync_status", "CREATE INDEX IF NOT EXISTS idx_profile_stats_sync_status ON leetcode_profile_stats(sync_status)"),
                ("idx_profile_stats_sync_solved", "CREATE INDEX IF NOT EXISTS idx_profile_stats_sync_solved ON leetcode_profile_stats(sync_status, total_solved)"),
                ("idx_weekly_public_sess_stud", "CREATE INDEX IF NOT EXISTS idx_weekly_public_sess_stud ON weekly_public_results(session_id, student_id)"),
                ("idx_weekly_public_sess_status", "CREATE INDEX IF NOT EXISTS idx_weekly_public_sess_status ON weekly_public_results(session_id, participation_status)"),
                ("idx_weekly_public_solved", "CREATE INDEX IF NOT EXISTS idx_weekly_public_solved ON weekly_public_results(total_contest_solved)"),
                ("idx_weekly_virtual_sess_stud", "CREATE INDEX IF NOT EXISTS idx_weekly_virtual_sess_stud ON weekly_virtual_results(session_id, student_id)"),
                ("idx_weekly_prog_stud_id", "CREATE INDEX IF NOT EXISTS idx_weekly_prog_stud_id ON weekly_student_progress(student_id)"),
                ("idx_weekly_prog_college_rank", "CREATE INDEX IF NOT EXISTS idx_weekly_prog_college_rank ON weekly_student_progress(college_rank)"),
                ("idx_weekly_prog_total_solved", "CREATE INDEX IF NOT EXISTS idx_weekly_prog_total_solved ON weekly_student_progress(total_solved)"),
                ("idx_email_otp_email_hash", "CREATE INDEX IF NOT EXISTS idx_email_otp_email_hash ON email_otp_records(email_hash)"),
                ("idx_email_otp_request_id", "CREATE INDEX IF NOT EXISTS idx_email_otp_request_id ON email_otp_records(request_id)"),
                ("idx_email_otp_created_at", "CREATE INDEX IF NOT EXISTS idx_email_otp_created_at ON email_otp_records(created_at)"),
                ("idx_admin_sessions_token_hash", "CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON admin_sessions(token_hash)"),
                ("idx_admin_sessions_expires_at", "CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at)")
            ]
            for idx_name, idx_sql in indexes:
                try:
                    conn.execute(__import__('sqlalchemy').text(idx_sql))
                except Exception:
                    pass
            conn.commit()
            print("[DB Migration] Performance indexes verified/created successfully.")
    except Exception as e:
        print(f"[DB Migration] Warning: {e}")

    # Ensure PostgreSQL / Supabase also receives all performance indexes
    if "sqlite" not in db_url:
        try:
            with engine.connect() as pg_conn:
                pg_indexes = [
                    "CREATE INDEX IF NOT EXISTS idx_students_dept_year ON students(department_id, year_level)",
                    "CREATE INDEX IF NOT EXISTS idx_students_is_active ON students(is_active)",
                    "CREATE INDEX IF NOT EXISTS idx_students_name ON students(name)",
                    "CREATE INDEX IF NOT EXISTS idx_students_reg_no ON students(reg_no)",
                    "CREATE INDEX IF NOT EXISTS idx_students_username ON students(username)",
                    "CREATE INDEX IF NOT EXISTS idx_students_email ON students(email)",
                    "CREATE INDEX IF NOT EXISTS idx_profile_stats_student_id ON leetcode_profile_stats(student_id)",
                    "CREATE INDEX IF NOT EXISTS idx_profile_stats_total_solved ON leetcode_profile_stats(total_solved)",
                    "CREATE INDEX IF NOT EXISTS idx_profile_stats_contest_rating ON leetcode_profile_stats(contest_rating)",
                    "CREATE INDEX IF NOT EXISTS idx_profile_stats_sync_status ON leetcode_profile_stats(sync_status)",
                    "CREATE INDEX IF NOT EXISTS idx_weekly_public_sess_stud ON weekly_public_results(session_id, student_id)",
                    "CREATE INDEX IF NOT EXISTS idx_weekly_public_sess_status ON weekly_public_results(session_id, participation_status)",
                    "CREATE INDEX IF NOT EXISTS idx_weekly_virtual_sess_stud ON weekly_virtual_results(session_id, student_id)",
                    "CREATE INDEX IF NOT EXISTS idx_weekly_prog_stud_id ON weekly_student_progress(student_id)",
                    "CREATE INDEX IF NOT EXISTS idx_email_otp_email_hash ON email_otp_records(email_hash)",
                    "CREATE INDEX IF NOT EXISTS idx_email_otp_request_id ON email_otp_records(request_id)",
                    "CREATE INDEX IF NOT EXISTS idx_email_otp_created_at ON email_otp_records(created_at)",
                    "CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON admin_sessions(token_hash)",
                    "CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at)"
                ]
                for pgi in pg_indexes:
                    try:
                        pg_conn.execute(__import__('sqlalchemy').text(pgi))
                    except Exception:
                        pass
                pg_conn.commit()
                print("[DB Migration] PostgreSQL / Supabase performance indexes ensured.")
        except Exception as _pge:
            print(f"[DB Migration] PostgreSQL index note: {_pge}")

run_migrations()
