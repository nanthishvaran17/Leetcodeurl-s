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
db_url = os.environ.get("DATABASE_URL", settings.DATABASE_URL)

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

engine_kwargs = {}
if "postgresql" in db_url or "postgres" in db_url:
    engine_kwargs.update({
        "pool_size": 10,
        "max_overflow": 20,
        "pool_pre_ping": True,
        "pool_recycle": 300,
    })
else:
    engine_kwargs.update({
        "connect_args": {"check_same_thread": False, "timeout": 60}
    })

engine = create_engine(
    db_url,
    echo=False,
    **engine_kwargs
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
            cursor.execute("PRAGMA cache_size=-64000")  # 64MB cache
            cursor.execute("PRAGMA temp_store=MEMORY")
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

            # Performance Indexes Creation
            indexes = [
                ("idx_students_dept_year", "CREATE INDEX IF NOT EXISTS idx_students_dept_year ON students(department_id, year_level)"),
                ("idx_students_is_active", "CREATE INDEX IF NOT EXISTS idx_students_is_active ON students(is_active)"),
                ("idx_students_name", "CREATE INDEX IF NOT EXISTS idx_students_name ON students(name)"),
                ("idx_students_reg_no", "CREATE INDEX IF NOT EXISTS idx_students_reg_no ON students(reg_no)"),
                ("idx_students_username", "CREATE INDEX IF NOT EXISTS idx_students_username ON students(username)"),
                ("idx_profile_stats_student_id", "CREATE INDEX IF NOT EXISTS idx_profile_stats_student_id ON leetcode_profile_stats(student_id)"),
                ("idx_profile_stats_total_solved", "CREATE INDEX IF NOT EXISTS idx_profile_stats_total_solved ON leetcode_profile_stats(total_solved)"),
                ("idx_profile_stats_contest_rating", "CREATE INDEX IF NOT EXISTS idx_profile_stats_contest_rating ON leetcode_profile_stats(contest_rating)"),
                ("idx_profile_stats_sync_status", "CREATE INDEX IF NOT EXISTS idx_profile_stats_sync_status ON leetcode_profile_stats(sync_status)"),
                ("idx_profile_stats_sync_solved", "CREATE INDEX IF NOT EXISTS idx_profile_stats_sync_solved ON leetcode_profile_stats(sync_status, total_solved)"),
                ("idx_weekly_public_sess_stud", "CREATE INDEX IF NOT EXISTS idx_weekly_public_sess_stud ON weekly_public_results(session_id, student_id)"),
                ("idx_weekly_public_sess_status", "CREATE INDEX IF NOT EXISTS idx_weekly_public_sess_status ON weekly_public_results(session_id, participation_status)"),
                ("idx_weekly_public_solved", "CREATE INDEX IF NOT EXISTS idx_weekly_public_solved ON weekly_public_results(total_contest_solved)"),
                ("idx_weekly_prog_stud_id", "CREATE INDEX IF NOT EXISTS idx_weekly_prog_stud_id ON weekly_student_progress(student_id)"),
                ("idx_weekly_prog_college_rank", "CREATE INDEX IF NOT EXISTS idx_weekly_prog_college_rank ON weekly_student_progress(college_rank)"),
                ("idx_weekly_prog_total_solved", "CREATE INDEX IF NOT EXISTS idx_weekly_prog_total_solved ON weekly_student_progress(total_solved)")
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
