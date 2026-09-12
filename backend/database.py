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

env_is_prod = (getattr(settings, "ENVIRONMENT", "") or os.environ.get("ENVIRONMENT", "")).strip().lower() == "production"

if env_is_prod and ("sqlite" in db_url.lower() or not (db_url.startswith("postgresql://") or db_url.startswith("postgres://"))):
    raise RuntimeError("FATAL: Production environment requires PostgreSQL database. SQLite is forbidden in production.")

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

from sqlalchemy.pool import NullPool

engine_kwargs = {}
if "postgresql" in db_url or "postgres" in db_url:
    engine_kwargs.update({
        # Tuned for 1,500 concurrent staff users
        "pool_size": int(os.environ.get("DB_POOL_SIZE", 50)),
        "max_overflow": int(os.environ.get("DB_MAX_OVERFLOW", 20)),
        "pool_timeout": 30,          # wait up to 30s to checkout a connection
        "pool_pre_ping": True,       # verify liveness before returning from pool
        "pool_recycle": 300,         # recycle after 5min (Render drops idle connections ~60s)
        "connect_args": {
            "connect_timeout": 10,
            "keepalives": 1,
            "keepalives_idle": 60,   # probe after 60s idle
            "keepalives_interval": 5,
            "keepalives_count": 5,
            "sslmode": "require",
            # Statement timeout prevents hanging queries from exhausting the pool
            "options": "-c statement_timeout=15000"
        }
    })
else:
    engine_kwargs.update({
        "poolclass": NullPool,
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
            cursor.execute("PRAGMA cache_size=-128000")  # 128MB ultra-fast in-memory cache
            cursor.execute("PRAGMA mmap_size=268435456")  # 256MB Memory-Mapped I/O for instant reads
            cursor.execute("PRAGMA temp_store=MEMORY")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()
        except Exception:
            pass

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


if "postgresql" in db_url or "postgres" in db_url:
    try:
        import psycopg2
        from sqlalchemy import event as _pg_event

        @_pg_event.listens_for(engine, "handle_error")
        def _invalidate_broken_pg_connection(exception_context):
            """
            Automatically invalidates and discards any PostgreSQL connection that
            raises OperationalError (e.g. SSL closed unexpectedly, connection reset).
            This ensures the pool never returns a stale/broken connection on retry.
            """
            orig = getattr(exception_context, 'original_exception', None)
            if orig and isinstance(orig, (psycopg2.OperationalError, psycopg2.InterfaceError)):
                from backend.logger import logger as _logger
                conn = exception_context.connection
                if conn is not None:
                    _logger.warning(
                        "[DB_POOL] Invalidating broken PostgreSQL connection: "
                        f"{type(orig).__name__}: {str(orig)[:120]}"
                    )
                    conn.invalidate()
    except ImportError:
        pass  # psycopg2 not available in this environment


def get_db():
    """FastAPI dependency that provides a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


from contextlib import contextmanager

@contextmanager
def get_db_session():
    """
    Context manager for use in background tasks (non-FastAPI dependency contexts).
    Automatically retries once on transient SSL / connection-reset errors.
    Usage: with get_db_session() as db: ...
    """
    import time as _time
    _max_retries = 2
    last_exc = None
    for _attempt in range(_max_retries):
        db = SessionLocal()
        try:
            yield db
            db.commit()
            return
        except Exception as _exc:
            db.rollback()
            last_exc = _exc
            exc_str = str(_exc).lower()
            _is_transient = any(kw in exc_str for kw in (
                "ssl connection", "connection reset", "broken pipe",
                "could not connect", "connection refused", "operationalerror"
            ))
            try:
                import psycopg2
                if isinstance(_exc, (psycopg2.OperationalError, psycopg2.InterfaceError)):
                    _is_transient = True
            except ImportError:
                pass
            if _is_transient and _attempt < _max_retries - 1:
                import logging as _logging
                _logging.warning(
                    f"[DB_RETRY] Transient DB error on attempt {_attempt + 1}/{_max_retries}, retrying: "
                    f"{type(_exc).__name__}: {str(_exc)[:120]}"
                )
                _time.sleep(0.3 * (_attempt + 1))
            else:
                raise
        finally:
            db.close()
    if last_exc:
        raise last_exc


def run_migrations():
    """Apply any missing column migrations and performance indexes to the existing SQLite database."""
    try:
        from backend.models import Base as ModelsBase
        ModelsBase.metadata.create_all(bind=engine)
    except Exception as _t_err:
        pass

    try:
        with engine.connect() as conn:
            # Create PostgreSQL performance indexes and missing columns if applicable
            if "postgresql" in db_url or "postgres" in db_url:
                conn.execute(__import__('sqlalchemy').text("""
                    ALTER TABLE students
                        ADD COLUMN IF NOT EXISTS primary_leetcode_id VARCHAR(100),
                        ADD COLUMN IF NOT EXISTS secondary_leetcode_id VARCHAR(100),
                        ADD COLUMN IF NOT EXISTS secondary_status VARCHAR(50) DEFAULT 'none',
                        ADD COLUMN IF NOT EXISTS accommodation VARCHAR(50),
                        ADD COLUMN IF NOT EXISTS twelfth_cutoff DOUBLE PRECISION;

                    ALTER TABLE student_contest_participations
                        ADD COLUMN IF NOT EXISTS official_attendance_state VARCHAR(30),
                        ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT FALSE,
                        ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMP WITH TIME ZONE,
                        ADD COLUMN IF NOT EXISTS post_contest_solves_count INTEGER DEFAULT 0,
                        ADD COLUMN IF NOT EXISTS solved_problems TEXT,
                        ADD COLUMN IF NOT EXISTS confidence VARCHAR(50) DEFAULT 'HIGH',
                        ADD COLUMN IF NOT EXISTS verification_level VARCHAR(50),
                        ADD COLUMN IF NOT EXISTS verification_evidence TEXT;

                    ALTER TABLE admin_audit_logs
                        ADD COLUMN IF NOT EXISTS audit_id VARCHAR(100),
                        ADD COLUMN IF NOT EXISTS event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        ADD COLUMN IF NOT EXISTS admin_user_id INTEGER,
                        ADD COLUMN IF NOT EXISTS admin_name VARCHAR(150),
                        ADD COLUMN IF NOT EXISTS admin_email VARCHAR(150),
                        ADD COLUMN IF NOT EXISTS admin_role VARCHAR(50) DEFAULT 'ADMIN',
                        ADD COLUMN IF NOT EXISTS access_level VARCHAR(50) DEFAULT 'LEVEL_1',
                        ADD COLUMN IF NOT EXISTS action VARCHAR(100),
                        ADD COLUMN IF NOT EXISTS action_type VARCHAR(50) DEFAULT 'GENERAL',
                        ADD COLUMN IF NOT EXISTS action_classification VARCHAR(50) DEFAULT 'SECURITY_ACCESS',
                        ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'SUCCESS',
                        ADD COLUMN IF NOT EXISTS severity VARCHAR(30) DEFAULT 'INFO',
                        ADD COLUMN IF NOT EXISTS target_type VARCHAR(50),
                        ADD COLUMN IF NOT EXISTS target_id VARCHAR(100),
                        ADD COLUMN IF NOT EXISTS resource_name VARCHAR(150),
                        ADD COLUMN IF NOT EXISTS route VARCHAR(255),
                        ADD COLUMN IF NOT EXISTS http_method VARCHAR(10),
                        ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50),
                        ADD COLUMN IF NOT EXISTS client_ip VARCHAR(50),
                        ADD COLUMN IF NOT EXISTS ip_version VARCHAR(10) DEFAULT 'IPv4',
                        ADD COLUMN IF NOT EXISTS session_id VARCHAR(100),
                        ADD COLUMN IF NOT EXISTS request_id VARCHAR(100),
                        ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(100),
                        ADD COLUMN IF NOT EXISTS browser VARCHAR(100),
                        ADD COLUMN IF NOT EXISTS browser_version VARCHAR(50),
                        ADD COLUMN IF NOT EXISTS operating_system VARCHAR(100),
                        ADD COLUMN IF NOT EXISTS device_type VARCHAR(50),
                        ADD COLUMN IF NOT EXISTS user_agent_category VARCHAR(100),
                        ADD COLUMN IF NOT EXISTS user_agent VARCHAR(500),
                        ADD COLUMN IF NOT EXISTS authentication_status VARCHAR(50) DEFAULT 'AUTHENTICATED',
                        ADD COLUMN IF NOT EXISTS authorization_result VARCHAR(50) DEFAULT 'ALLOWED',
                        ADD COLUMN IF NOT EXISTS permission_checked VARCHAR(100),
                        ADD COLUMN IF NOT EXISTS risk_level VARCHAR(30) DEFAULT 'LOW',
                        ADD COLUMN IF NOT EXISTS denial_reason TEXT,
                        ADD COLUMN IF NOT EXISTS request_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        ADD COLUMN IF NOT EXISTS response_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        ADD COLUMN IF NOT EXISTS response_status INTEGER DEFAULT 200,
                        ADD COLUMN IF NOT EXISTS response_time_ms DOUBLE PRECISION DEFAULT 0.0,
                        ADD COLUMN IF NOT EXISTS trace_id VARCHAR(100),
                        ADD COLUMN IF NOT EXISTS event_hash VARCHAR(100),
                        ADD COLUMN IF NOT EXISTS previous_event_hash VARCHAR(100),
                        ADD COLUMN IF NOT EXISTS integrity_status VARCHAR(30) DEFAULT 'VERIFIED',
                        ADD COLUMN IF NOT EXISTS institution_id VARCHAR(50) DEFAULT 'NEC',
                        ADD COLUMN IF NOT EXISTS institution_branding_version VARCHAR(50) DEFAULT 'v1.0',
                        ADD COLUMN IF NOT EXISTS institution_logo_reference VARCHAR(100) DEFAULT 'nandha_emblem.png',
                        ADD COLUMN IF NOT EXISTS description TEXT,
                        ADD COLUMN IF NOT EXISTS metadata_json JSONB,
                        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                """))
                conn.execute(__import__('sqlalchemy').text("""
                    UPDATE students
                    SET primary_leetcode_id = username
                    WHERE primary_leetcode_id IS NULL AND username IS NOT NULL;
                """))
                conn.execute(__import__('sqlalchemy').text("CREATE INDEX IF NOT EXISTS ix_students_primary_leetcode_id ON students (primary_leetcode_id);"))
                conn.execute(__import__('sqlalchemy').text("CREATE INDEX IF NOT EXISTS ix_students_secondary_leetcode_id ON students (secondary_leetcode_id);"))
                conn.execute(__import__('sqlalchemy').text("CREATE INDEX IF NOT EXISTS ix_leetcode_profile_stats_total_solved ON leetcode_profile_stats (total_solved);"))
                conn.execute(__import__('sqlalchemy').text("CREATE INDEX IF NOT EXISTS ix_leetcode_profile_stats_sync_status ON leetcode_profile_stats (sync_status);"))
                conn.execute(__import__('sqlalchemy').text("CREATE INDEX IF NOT EXISTS ix_faculty_student_assignments_faculty_id ON faculty_student_assignments (faculty_id);"))
                conn.execute(__import__('sqlalchemy').text("CREATE INDEX IF NOT EXISTS ix_faculty_student_assignments_is_active ON faculty_student_assignments (is_active);"))
                conn.execute(__import__('sqlalchemy').text("CREATE INDEX IF NOT EXISTS ix_admin_audit_logs_event_timestamp ON admin_audit_logs (event_timestamp);"))
                conn.execute(__import__('sqlalchemy').text("CREATE INDEX IF NOT EXISTS ix_admin_audit_logs_audit_id ON admin_audit_logs (audit_id);"))
                conn.commit()
    except Exception as e:
        import logging
        logging.error(f"PostgreSQL migration error: {e}")

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
                    ("manual_review_required_at", "ALTER TABLE weekly_sessions ADD COLUMN manual_review_required_at DATETIME"),
                    ("manual_review_reason",  "ALTER TABLE weekly_sessions ADD COLUMN manual_review_reason TEXT"),
                    ("last_successful_source_fetch", "ALTER TABLE weekly_sessions ADD COLUMN last_successful_source_fetch DATETIME"),
                    ("last_reconciliation_attempt",  "ALTER TABLE weekly_sessions ADD COLUMN last_reconciliation_attempt DATETIME"),
                    ("reconciliation_failure_count", "ALTER TABLE weekly_sessions ADD COLUMN reconciliation_failure_count INTEGER DEFAULT 0"),
                    ("last_error_code",       "ALTER TABLE weekly_sessions ADD COLUMN last_error_code VARCHAR(100)"),
                    ("last_error_message_safe", "ALTER TABLE weekly_sessions ADD COLUMN last_error_message_safe TEXT"),
                    ("finalization_method",   "ALTER TABLE weekly_sessions ADD COLUMN finalization_method VARCHAR(50)"),
                    ("finalized_by",          "ALTER TABLE weekly_sessions ADD COLUMN finalized_by VARCHAR(150)"),
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
            result_part = conn.execute(
                __import__('sqlalchemy').text("PRAGMA table_info(student_contest_participations)")
            )
            part_cols = {row[1] for row in result_part}
            if part_cols:
                part_migrations = [
                    ("is_public_attended", "ALTER TABLE student_contest_participations ADD COLUMN is_public_attended BOOLEAN DEFAULT 0"),
                    ("is_virtual_attended", "ALTER TABLE student_contest_participations ADD COLUMN is_virtual_attended BOOLEAN DEFAULT 0"),
                    ("solved_problems", "ALTER TABLE student_contest_participations ADD COLUMN solved_problems TEXT"),
                    ("confidence", "ALTER TABLE student_contest_participations ADD COLUMN confidence VARCHAR DEFAULT 'HIGH'"),
                    ("verification_level", "ALTER TABLE student_contest_participations ADD COLUMN verification_level VARCHAR"),
                    ("verification_evidence", "ALTER TABLE student_contest_participations ADD COLUMN verification_evidence TEXT"),
                ]
                for col_name, sql in part_migrations:
                    if col_name not in part_cols:
                        conn.execute(__import__('sqlalchemy').text(sql))
                        conn.commit()

            # Check admin_audit_logs columns
            result_audit = conn.execute(
                __import__('sqlalchemy').text("PRAGMA table_info(admin_audit_logs)")
            )
            audit_cols = {row[1] for row in result_audit}
            if audit_cols:
                audit_migrations = [
                    ("event_timestamp", "ALTER TABLE admin_audit_logs ADD COLUMN event_timestamp DATETIME"),
                    ("access_level", "ALTER TABLE admin_audit_logs ADD COLUMN access_level VARCHAR(50) DEFAULT 'LEVEL_1'"),
                    ("action_classification", "ALTER TABLE admin_audit_logs ADD COLUMN action_classification VARCHAR(50) DEFAULT 'SECURITY_ACCESS'"),
                    ("severity", "ALTER TABLE admin_audit_logs ADD COLUMN severity VARCHAR(30) DEFAULT 'INFO'"),
                    ("resource_name", "ALTER TABLE admin_audit_logs ADD COLUMN resource_name VARCHAR(150)"),
                    ("route", "ALTER TABLE admin_audit_logs ADD COLUMN route VARCHAR(255)"),
                    ("http_method", "ALTER TABLE admin_audit_logs ADD COLUMN http_method VARCHAR(10)"),
                    ("client_ip", "ALTER TABLE admin_audit_logs ADD COLUMN client_ip VARCHAR(50)"),
                    ("ip_version", "ALTER TABLE admin_audit_logs ADD COLUMN ip_version VARCHAR(10) DEFAULT 'IPv4'"),
                    ("session_id", "ALTER TABLE admin_audit_logs ADD COLUMN session_id VARCHAR(100)"),
                    ("request_id", "ALTER TABLE admin_audit_logs ADD COLUMN request_id VARCHAR(100)"),
                    ("correlation_id", "ALTER TABLE admin_audit_logs ADD COLUMN correlation_id VARCHAR(100)"),
                    ("browser", "ALTER TABLE admin_audit_logs ADD COLUMN browser VARCHAR(100)"),
                    ("browser_version", "ALTER TABLE admin_audit_logs ADD COLUMN browser_version VARCHAR(50)"),
                    ("operating_system", "ALTER TABLE admin_audit_logs ADD COLUMN operating_system VARCHAR(100)"),
                    ("device_type", "ALTER TABLE admin_audit_logs ADD COLUMN device_type VARCHAR(50)"),
                    ("user_agent_category", "ALTER TABLE admin_audit_logs ADD COLUMN user_agent_category VARCHAR(100)"),
                    ("authentication_status", "ALTER TABLE admin_audit_logs ADD COLUMN authentication_status VARCHAR(50) DEFAULT 'AUTHENTICATED'"),
                    ("authorization_result", "ALTER TABLE admin_audit_logs ADD COLUMN authorization_result VARCHAR(50) DEFAULT 'ALLOWED'"),
                    ("permission_checked", "ALTER TABLE admin_audit_logs ADD COLUMN permission_checked VARCHAR(100)"),
                    ("risk_level", "ALTER TABLE admin_audit_logs ADD COLUMN risk_level VARCHAR(30) DEFAULT 'LOW'"),
                    ("denial_reason", "ALTER TABLE admin_audit_logs ADD COLUMN denial_reason VARCHAR(255)"),
                    ("request_timestamp", "ALTER TABLE admin_audit_logs ADD COLUMN request_timestamp DATETIME"),
                    ("response_timestamp", "ALTER TABLE admin_audit_logs ADD COLUMN response_timestamp DATETIME"),
                    ("response_status", "ALTER TABLE admin_audit_logs ADD COLUMN response_status INTEGER DEFAULT 200"),
                    ("response_time_ms", "ALTER TABLE admin_audit_logs ADD COLUMN response_time_ms FLOAT DEFAULT 15.0"),
                    ("trace_id", "ALTER TABLE admin_audit_logs ADD COLUMN trace_id VARCHAR(100)"),
                    ("event_hash", "ALTER TABLE admin_audit_logs ADD COLUMN event_hash VARCHAR(64)"),
                    ("previous_event_hash", "ALTER TABLE admin_audit_logs ADD COLUMN previous_event_hash VARCHAR(64)"),
                    ("integrity_status", "ALTER TABLE admin_audit_logs ADD COLUMN integrity_status VARCHAR(30) DEFAULT 'VERIFIED'"),
                    ("institution_id", "ALTER TABLE admin_audit_logs ADD COLUMN institution_id VARCHAR(100) DEFAULT 'NEC_AUTONOMOUS_001'"),
                    ("institution_branding_version", "ALTER TABLE admin_audit_logs ADD COLUMN institution_branding_version VARCHAR(50) DEFAULT 'v2026.1'"),
                    ("institution_logo_reference", "ALTER TABLE admin_audit_logs ADD COLUMN institution_logo_reference VARCHAR(255) DEFAULT 'assets/nec_logo.png'"),
                    ("description", "ALTER TABLE admin_audit_logs ADD COLUMN description TEXT"),
                    ("metadata_json", "ALTER TABLE admin_audit_logs ADD COLUMN metadata_json TEXT"),
                    ("created_at", "ALTER TABLE admin_audit_logs ADD COLUMN created_at DATETIME"),
                    ("updated_at", "ALTER TABLE admin_audit_logs ADD COLUMN updated_at DATETIME")
                ]
                for col_name, sql in audit_migrations:
                    if col_name not in audit_cols:
                        try:
                            conn.execute(__import__('sqlalchemy').text(sql))
                            conn.commit()
                            print(f"[DB Migration] Added admin_audit_logs column: {col_name}")
                        except Exception:
                            pass
            result_scp = conn.execute(
                __import__('sqlalchemy').text("PRAGMA table_info(student_contest_participations)")
            )
            scp_cols = {row[1] for row in result_scp}
            if scp_cols:
                scp_migrations = [
                    ("solved_problems", "ALTER TABLE student_contest_participations ADD COLUMN solved_problems TEXT"),
                    ("confidence",      "ALTER TABLE student_contest_participations ADD COLUMN confidence VARCHAR DEFAULT 'HIGH'"),
                    ("official_attendance_state", "ALTER TABLE student_contest_participations ADD COLUMN official_attendance_state VARCHAR(30)"),
                    ("is_frozen",       "ALTER TABLE student_contest_participations ADD COLUMN is_frozen BOOLEAN DEFAULT 0"),
                    ("frozen_at",       "ALTER TABLE student_contest_participations ADD COLUMN frozen_at DATETIME"),
                    ("post_contest_solves_count", "ALTER TABLE student_contest_participations ADD COLUMN post_contest_solves_count INTEGER DEFAULT 0"),
                ]
                for col_name, sql in scp_migrations:
                    if col_name not in scp_cols:
                        conn.execute(__import__('sqlalchemy').text(sql))
                        conn.commit()
                        print(f"[DB Migration] Added student_contest_participations column: {col_name}")

            # Check certificate_records columns
            result_cert = conn.execute(
                __import__('sqlalchemy').text("PRAGMA table_info(certificate_records)")
            )
            cert_cols = {row[1] for row in result_cert}
            if cert_cols:
                cert_migrations = [
                    ("contest_name", "ALTER TABLE certificate_records ADD COLUMN contest_name VARCHAR(128)"),
                    ("leetcode_username", "ALTER TABLE certificate_records ADD COLUMN leetcode_username VARCHAR(128)"),
                    ("participation_status", "ALTER TABLE certificate_records ADD COLUMN participation_status VARCHAR(64)"),
                    ("problems_solved", "ALTER TABLE certificate_records ADD COLUMN problems_solved VARCHAR(64)"),
                    ("contest_score", "ALTER TABLE certificate_records ADD COLUMN contest_score VARCHAR(32)"),
                    ("contest_rank", "ALTER TABLE certificate_records ADD COLUMN contest_rank VARCHAR(32)"),
                    ("contest_rating", "ALTER TABLE certificate_records ADD COLUMN contest_rating VARCHAR(32)"),
                    ("q1_score", "ALTER TABLE certificate_records ADD COLUMN q1_score INTEGER DEFAULT 0"),
                    ("q2_score", "ALTER TABLE certificate_records ADD COLUMN q2_score INTEGER DEFAULT 0"),
                    ("q3_score", "ALTER TABLE certificate_records ADD COLUMN q3_score INTEGER DEFAULT 0"),
                    ("q4_score", "ALTER TABLE certificate_records ADD COLUMN q4_score INTEGER DEFAULT 0"),
                    ("retrieved_timestamp", "ALTER TABLE certificate_records ADD COLUMN retrieved_timestamp VARCHAR(64)")
                ]
                for col_name, sql in cert_migrations:
                    if col_name not in cert_cols:
                        try:
                            conn.execute(__import__('sqlalchemy').text(sql))
                            conn.commit()
                            print(f"[DB Migration] Added certificate_records column: {col_name}")
                        except Exception:
                            pass

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
                if "allocation" not in st_cols:
                    conn.execute(__import__('sqlalchemy').text("ALTER TABLE students ADD COLUMN allocation VARCHAR(50)"))
                    conn.commit()
                    print("[DB Migration] Added students column: allocation")
                if "batch" not in st_cols:
                    conn.execute(__import__('sqlalchemy').text("ALTER TABLE students ADD COLUMN batch VARCHAR(50)"))
                    conn.commit()
                    print("[DB Migration] Added students column: batch")
                if "institutional_email" not in st_cols:
                    conn.execute(__import__('sqlalchemy').text("ALTER TABLE students ADD COLUMN institutional_email VARCHAR(150)"))
                    conn.commit()
                    print("[DB Migration] Added students column: institutional_email")
                if "email_status" not in st_cols:
                    conn.execute(__import__('sqlalchemy').text("ALTER TABLE students ADD COLUMN email_status VARCHAR(50) DEFAULT 'pending'"))
                    conn.commit()
                    print("[DB Migration] Added students column: email_status")
                if "accommodation" not in st_cols:
                    conn.execute(__import__('slate_text' if False else 'sqlalchemy').text("ALTER TABLE students ADD COLUMN accommodation VARCHAR(50)"))
                    conn.commit()
                    print("[DB Migration] Added students column: accommodation")
                if "twelfth_cutoff" not in st_cols:
                    conn.execute(__import__('sqlalchemy').text("ALTER TABLE students ADD COLUMN twelfth_cutoff FLOAT"))
                    conn.commit()
                    print("[DB Migration] Added students column: twelfth_cutoff")

            # Check messages table columns for WhatsApp-style messaging
            try:
                from sqlalchemy import inspect as _inspect
                inspector = _inspect(conn)
                if "messages" in inspector.get_table_names():
                    msg_cols = {c["name"] for c in inspector.get_columns("messages")}
                    if msg_cols:
                        is_pg = "postgresql" in db_url or "postgres" in db_url
                        dt_type = "TIMESTAMP" if is_pg else "DATETIME"
                        bool_def = "FALSE" if is_pg else "0"
                        
                        msg_migrations = [
                            ("delivered_at", f"ALTER TABLE messages ADD COLUMN delivered_at {dt_type}"),
                            ("read_at", f"ALTER TABLE messages ADD COLUMN read_at {dt_type}"),
                            ("edited_at", f"ALTER TABLE messages ADD COLUMN edited_at {dt_type}"),
                            ("is_edited", f"ALTER TABLE messages ADD COLUMN is_edited BOOLEAN DEFAULT {bool_def}"),
                            ("is_deleted_everyone", f"ALTER TABLE messages ADD COLUMN is_deleted_everyone BOOLEAN DEFAULT {bool_def}"),
                            ("deleted_by_users", "ALTER TABLE messages ADD COLUMN deleted_by_users TEXT DEFAULT '[]'"),
                            ("reply_to_message_id", "ALTER TABLE messages ADD COLUMN reply_to_message_id VARCHAR(100)"),
                            ("reactions", "ALTER TABLE messages ADD COLUMN reactions TEXT DEFAULT '{}'"),
                            ("attachment_file_id", "ALTER TABLE messages ADD COLUMN attachment_file_id VARCHAR(100)")
                        ]
                        for col_name, sql in msg_migrations:
                            if col_name not in msg_cols:
                                conn.execute(__import__('sqlalchemy').text(sql))
                                conn.commit()
                                print(f"[DB Migration] Added messages column: {col_name}")
            except Exception as _e_msg:
                print(f"[DB Migration] messages table migration note: {_e_msg}")

            # Ensure system default Admin account exists
            admin_check = conn.execute(
                __import__('sqlalchemy').text("SELECT id, role FROM users WHERE email = 'admin@college.edu' OR role = 'Admin'")
            ).fetchone()
            if not admin_check:
                conn.execute(
                    __import__('sqlalchemy').text(
                        "INSERT INTO users (username, email, hashed_password, role, is_active) "
                        "VALUES ('admin', 'admin@college.edu', 'N/A_SYSTEM_ADMIN', 'Admin', 1)"
                    )
                )
                conn.commit()
                print("[DB Migration] Ensured default Admin account exists.")

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

            # faculty_action_queue: add new columns if missing 
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

            # faculty_action_audit_logs: create if missing 
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

            # faculty_student_assignments: create if missing 
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

            # report_cache: ensure missing columns exist (PostgreSQL & SQLite safe) 
            try:
                from sqlalchemy import inspect, text
                inspector = inspect(conn)
                if inspector.has_table("report_cache"):
                    existing_cols = {c["name"] for c in inspector.get_columns("report_cache")}
                    date_type = "TIMESTAMP" if "postgresql" in str(engine.dialect.name).lower() else "DATETIME"
                    report_cache_cols = [
                        ("filter_hash", "VARCHAR(64)"),
                        ("report_type", "VARCHAR(100)"),
                        ("format", "VARCHAR(20)"),
                        ("filters_json", "TEXT"),
                        ("user_scope", "VARCHAR(100)"),
                        ("filename", "VARCHAR(255)"),
                        ("mime_type", "VARCHAR(100)"),
                        ("storage_path", "VARCHAR(500)"),
                        ("download_url", "VARCHAR(500)"),
                        ("data_version", "VARCHAR(100)"),
                        ("status", "VARCHAR(30)"),
                        ("generated_at", date_type),
                        ("expires_at", date_type),
                        ("generation_time_ms", "FLOAT"),
                        ("file_size_bytes", "INTEGER"),
                        ("error_message", "TEXT"),
                    ]
                    for col_name, col_type in report_cache_cols:
                        if col_name not in existing_cols:
                            try:
                                conn.execute(text(f"ALTER TABLE report_cache ADD COLUMN {col_name} {col_type}"))
                                conn.commit()
                                print(f"[DB Migration] Added missing column '{col_name}' to report_cache table.")
                            except Exception as _e_rc_col:
                                conn.rollback()
                                print(f"[DB Migration] Note: Could not add column '{col_name}' to report_cache: {_e_rc_col}")
            except Exception as _e_rc:
                print(f"[DB Migration] report_cache column migration note: {_e_rc}")

            # Performance Indexes Creation (Universal for both SQLite and PostgreSQL)
            indexes = [
                ("idx_students_dept_year", "CREATE INDEX IF NOT EXISTS idx_students_dept_year ON students(department_id, year_level)"),
                ("idx_students_is_active", "CREATE INDEX IF NOT EXISTS idx_students_is_active ON students(is_active)"),
                ("idx_students_name", "CREATE INDEX IF NOT EXISTS idx_students_name ON students(name)"),
                ("idx_students_reg_no", "CREATE INDEX IF NOT EXISTS idx_students_reg_no ON students(reg_no)"),
                ("idx_students_username", "CREATE INDEX IF NOT EXISTS idx_students_username ON students(username)"),
                ("idx_students_email", "CREATE INDEX IF NOT EXISTS idx_students_email ON students(email)"),
                ("idx_students_department_id", "CREATE INDEX IF NOT EXISTS idx_students_department_id ON students(department_id)"),
                ("idx_students_year_level", "CREATE INDEX IF NOT EXISTS idx_students_year_level ON students(year_level)"),
                ("idx_users_email", "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)"),
                ("idx_users_role", "CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)"),
                ("idx_users_department_id", "CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id)"),
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
                ("idx_admin_sessions_expires_at", "CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at)"),
                ("idx_audit_user_timestamp", "CREATE INDEX IF NOT EXISTS idx_audit_user_timestamp ON admin_audit_logs(user_id, event_timestamp)"),
                ("idx_audit_event_timestamp", "CREATE INDEX IF NOT EXISTS idx_audit_event_timestamp ON admin_audit_logs(event_timestamp)"),
                ("idx_audit_trace_id", "CREATE INDEX IF NOT EXISTS idx_audit_trace_id ON admin_audit_logs(trace_id)"),
                ("idx_audit_correlation_id", "CREATE INDEX IF NOT EXISTS idx_audit_correlation_id ON admin_audit_logs(correlation_id)"),
                ("idx_cert_verification_code", "CREATE INDEX IF NOT EXISTS idx_cert_verification_code ON certificate_records(verification_code)"),
                ("idx_cert_trace_id", "CREATE INDEX IF NOT EXISTS idx_cert_trace_id ON certificate_records(trace_id)"),
                ("idx_scp_stud_contest", "CREATE INDEX IF NOT EXISTS idx_scp_stud_contest ON student_contest_participations(student_id, contest_id)")
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
                    "CREATE INDEX IF NOT EXISTS idx_students_department_id ON students(department_id)",
                    "CREATE INDEX IF NOT EXISTS idx_students_year_level ON students(year_level)",
                    "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
                    "CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)",
                    "CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id)",
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

# Migrations are deferred to FastAPI lifespan in main.py to prevent blocking port binding.
