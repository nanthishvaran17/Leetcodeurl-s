import sqlite3
import os

from backend.database import engine
from backend.models import Base

def run_db_migrations():
    # ====================================================================
    # STEP 1: Create all tables defined in models that don't yet exist
    # (Works for both SQLite and PostgreSQL — safe to re-run)
    # ====================================================================
    Base.metadata.create_all(bind=engine)

    # ====================================================================
    # STEP 2: PostgreSQL-safe column migrations using ALTER TABLE IF NOT EXISTS
    # These run on the live Render PostgreSQL DB without breaking SQLite
    # ====================================================================
    from sqlalchemy import text as sql_text
    from backend.database import db_url as _db_url

    if "postgresql" in _db_url or "postgres" in _db_url:
        pg_migrations = [
            # ── users table ─────────────────────────────────────────────────
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS institutional_id VARCHAR(50)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_verified BOOLEAN DEFAULT FALSE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id INTEGER",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS section_id INTEGER",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS mentoring_role VARCHAR(50)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS require_password_change BOOLEAN DEFAULT FALSE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(64)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_2fa_enabled BOOLEAN DEFAULT FALSE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP",
            # ── students table ───────────────────────────────────────────────
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30)",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS whatsapp_verified BOOLEAN DEFAULT FALSE",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS date_of_birth DATE",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS codeforces_username VARCHAR(100)",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS hackerrank_username VARCHAR(100)",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS joining_date TIMESTAMP",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS created_at TIMESTAMP",
            # ── weekly_sessions table ────────────────────────────────────────
            "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20) DEFAULT '2026-27'",
            "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS week_number INTEGER",
            "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS session_code VARCHAR(50)",
            "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS contest_id VARCHAR(100)",
            "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS start_time VARCHAR(20) DEFAULT '08:00'",
            "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS end_time VARCHAR(20) DEFAULT '09:30'",
            "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS baseline_snapshot_id VARCHAR(100)",
            "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS final_snapshot_id VARCHAR(100)",
            "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS total_students INTEGER DEFAULT 0",
            "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS official_participants INTEGER DEFAULT 0",
            "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS virtual_participants INTEGER DEFAULT 0",
            "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS not_participated INTEGER DEFAULT 0",
            "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS failed_verification INTEGER DEFAULT 0",
            "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS dataset_hash VARCHAR(64)",
            "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS sync_status VARCHAR(30) DEFAULT 'PENDING'",
            "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS last_synced TIMESTAMP",
            "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP",
            "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP",
            "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMP",
            "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS session_data_hash VARCHAR(128)",
            "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS reconciliation_summary TEXT",
            "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS pipeline_state VARCHAR(50)",
            "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS pipeline_last_updated TIMESTAMP",
            "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS pipeline_error TEXT",
            # ── leetcode_profile_stats ───────────────────────────────────────
            "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS source_total_solved INTEGER",
            "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS derived_total_solved INTEGER",
            "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS public_profile_ranking INTEGER",
            "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS active_days INTEGER",
            "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS max_streak INTEGER",
            "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS recent_accepted INTEGER",
            "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS recent_contest_name VARCHAR(150)",
            "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS recent_contest_score VARCHAR(20)",
            "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS sync_status VARCHAR(50) DEFAULT 'not_started'",
            "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS validation_status VARCHAR(50)",
            "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS source VARCHAR(100)",
            "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS error_message TEXT",
            "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS error_code VARCHAR(50)",
            "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS last_successful_sync TIMESTAMP",
            "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP",
            "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMP",
            "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0",
            "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS fetch_duration FLOAT",
            # ── weekly_public_results ────────────────────────────────────────
            "ALTER TABLE weekly_public_results ADD COLUMN IF NOT EXISTS state VARCHAR(30) DEFAULT 'PENDING'",
            "ALTER TABLE weekly_public_results ADD COLUMN IF NOT EXISTS previous_state VARCHAR(30)",
            "ALTER TABLE weekly_public_results ADD COLUMN IF NOT EXISTS state_changed_at TIMESTAMP",
            "ALTER TABLE weekly_public_results ADD COLUMN IF NOT EXISTS last_error_code VARCHAR(50)",
            "ALTER TABLE weekly_public_results ADD COLUMN IF NOT EXISTS evidence_json TEXT",
            "ALTER TABLE weekly_public_results ADD COLUMN IF NOT EXISTS record_hash VARCHAR(128)",
            "ALTER TABLE weekly_public_results ADD COLUMN IF NOT EXISTS data_fetch_status VARCHAR(50) DEFAULT 'DATA_UNAVAILABLE'",
            "ALTER TABLE weekly_public_results ADD COLUMN IF NOT EXISTS confidence VARCHAR(50) DEFAULT 'UNVERIFIED'",
            "ALTER TABLE weekly_public_results ADD COLUMN IF NOT EXISTS verification_evidence TEXT",
            "ALTER TABLE weekly_public_results ALTER COLUMN verification_evidence TYPE TEXT",
            "ALTER TABLE weekly_public_results ALTER COLUMN error_reason TYPE TEXT",
            "ALTER TABLE weekly_public_results ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0",
            "ALTER TABLE weekly_public_results ADD COLUMN IF NOT EXISTS last_fetched_at TIMESTAMP",
            # ── weekly_virtual_results ───────────────────────────────────────
            "ALTER TABLE weekly_virtual_results ADD COLUMN IF NOT EXISTS state VARCHAR(30) DEFAULT 'VALIDATED'",
            "ALTER TABLE weekly_virtual_results ADD COLUMN IF NOT EXISTS evidence_json TEXT",
            "ALTER TABLE weekly_virtual_results ADD COLUMN IF NOT EXISTS record_hash VARCHAR(128)",
            # ── weekly_student_progress ──────────────────────────────────────
            "ALTER TABLE weekly_student_progress ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20)",
            "ALTER TABLE weekly_student_progress ADD COLUMN IF NOT EXISTS year_rank INTEGER",
            "ALTER TABLE weekly_student_progress ADD COLUMN IF NOT EXISTS section_rank INTEGER",
            "ALTER TABLE weekly_student_progress ADD COLUMN IF NOT EXISTS progress_rank INTEGER",
            "ALTER TABLE weekly_student_progress ADD COLUMN IF NOT EXISTS streak_count INTEGER DEFAULT 0",
            "ALTER TABLE weekly_student_progress ADD COLUMN IF NOT EXISTS consistency_score FLOAT DEFAULT 0.0",
            "ALTER TABLE weekly_student_progress ADD COLUMN IF NOT EXISTS badge_list TEXT",
            "ALTER TABLE weekly_student_progress ADD COLUMN IF NOT EXISTS composite_score FLOAT DEFAULT 0.0",
            # ── admin_sessions ───────────────────────────────────────────────
            "ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP",
            "ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS ip_hash VARCHAR(128)",
            "ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS user_agent_hash VARCHAR(128)",
            # ── contest_participations ───────────────────────────────────────
            "ALTER TABLE contest_participations ADD COLUMN IF NOT EXISTS source_username VARCHAR(100)",
            # ── student_contest_participations ───────────────────────────────
            "ALTER TABLE student_contest_participations ADD COLUMN IF NOT EXISTS solved_problems TEXT",
            "ALTER TABLE student_contest_participations ADD COLUMN IF NOT EXISTS confidence VARCHAR(50) DEFAULT 'HIGH'",
            "ALTER TABLE student_contest_participations ADD COLUMN IF NOT EXISTS participation_mode VARCHAR(30)",
            "ALTER TABLE student_contest_participations ADD COLUMN IF NOT EXISTS verification_level VARCHAR(50)",
            "ALTER TABLE student_contest_participations ADD COLUMN IF NOT EXISTS verification_evidence TEXT",
            "ALTER TABLE student_contest_participations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP",
            # ── hod_snapshots ────────────────────────────────────────────────
            "ALTER TABLE hod_snapshots ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20) DEFAULT '2026-27'",
            "ALTER TABLE hod_snapshots ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'READY'",
            "ALTER TABLE hod_snapshots ADD COLUMN IF NOT EXISTS created_by VARCHAR(100) DEFAULT 'HOD / System'",
            "ALTER TABLE hod_snapshots ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP",
            # ── official_weekly_snapshots ────────────────────────────────────
            "ALTER TABLE official_weekly_snapshots ADD COLUMN IF NOT EXISTS is_superseded BOOLEAN DEFAULT FALSE",
            "ALTER TABLE official_weekly_snapshots ADD COLUMN IF NOT EXISTS superseded_by_id INTEGER",
            "ALTER TABLE official_weekly_snapshots ADD COLUMN IF NOT EXISTS session_data_hash VARCHAR(128)",
            "ALTER TABLE official_weekly_snapshots ADD COLUMN IF NOT EXISTS reconciliation_summary TEXT",
            "ALTER TABLE official_weekly_snapshots ADD COLUMN IF NOT EXISTS snapshot_version INTEGER DEFAULT 1",
            
            # ── Session Recovery ─────────────────────────────────────────────
            "UPDATE weekly_sessions SET status = 'SCHEDULED' WHERE status = 'FINALIZED' AND id NOT IN (SELECT session_id FROM official_weekly_snapshots)",
        ]

        for migration_sql in pg_migrations:
            try:
                with engine.begin() as pg_conn:
                    pg_conn.execute(sql_text(migration_sql))
            except Exception as _col_err:
                print(f"[PG Migration] Note: {_col_err}")
        print("[PG Migration] PostgreSQL column migrations applied successfully.")

        # ── Compound Performance Indexes ──────────────────────────────────
        perf_indexes = [
            "CREATE INDEX IF NOT EXISTS ix_weekly_public_results_session_student ON weekly_public_results (session_id, student_id)",
            "CREATE INDEX IF NOT EXISTS ix_weekly_virtual_results_session_student ON weekly_virtual_results (session_id, student_id)",
            "CREATE INDEX IF NOT EXISTS ix_weekly_student_progress_student_week ON weekly_student_progress (student_id, week_number)",
            "CREATE INDEX IF NOT EXISTS ix_students_active_dept ON students (is_active, department_id)",
        ]
        for idx_sql in perf_indexes:
            try:
                with engine.begin() as pg_conn:
                    pg_conn.execute(sql_text(idx_sql))
                print(f"[PG Migration] Index applied: {idx_sql.split('ON ')[1].split(' ')[0]}")
            except Exception as _idx_err:
                print(f"[PG Migration] Index note: {_idx_err}")
        return  # Skip SQLite-only section below



    db_paths = [
        os.path.join(os.path.dirname(__file__), "..", "data", "leetcode_tracker.db"),
        os.path.join(os.path.dirname(__file__), "..", "leetcode_tracker.db")
    ]
    for db_path in db_paths:
        if not os.path.exists(db_path):
            continue
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Migrate official_weekly_snapshots if unique constraint exists
        try:
            cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='official_weekly_snapshots'")
            row = cursor.fetchone()
            if row and ("UNIQUE (session_id)" in row[0] or "UNIQUE(session_id)" in row[0] or "session_id INTEGER UNIQUE" in row[0]):
                cursor.execute("ALTER TABLE official_weekly_snapshots RENAME TO official_weekly_snapshots_old")
                cursor.execute("""
                CREATE TABLE official_weekly_snapshots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id INTEGER NOT NULL,
                    contest_id VARCHAR(100) NOT NULL,
                    contest_name VARCHAR(150) NOT NULL,
                    contest_date VARCHAR(20) NOT NULL,
                    finalized_at DATETIME,
                    dataset JSON NOT NULL,
                    dataset_hash VARCHAR(100) NOT NULL,
                    student_count INTEGER DEFAULT 273,
                    error_count INTEGER DEFAULT 0,
                    is_superseded BOOLEAN DEFAULT 0,
                    superseded_by_id INTEGER,
                    FOREIGN KEY(session_id) REFERENCES weekly_sessions (id)
                )
                """)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_official_weekly_snapshots_session_id ON official_weekly_snapshots (session_id)")
                cursor.execute("""
                INSERT INTO official_weekly_snapshots (id, session_id, contest_id, contest_name, contest_date, finalized_at, dataset, dataset_hash, student_count, error_count, is_superseded, superseded_by_id)
                SELECT id, session_id, contest_id, contest_name, contest_date, finalized_at, dataset, dataset_hash, student_count, error_count, 0, NULL
                FROM official_weekly_snapshots_old
                """)
                cursor.execute("DROP TABLE official_weekly_snapshots_old")
                conn.commit()
                print("[DB Migration] Rebuilt official_weekly_snapshots without unique constraint for versioning.")
        except Exception as _snap_err:
            print(f"[DB Migration] Snapshot migration note: {_snap_err}")

        # Ensure public_contest_sync_audits columns exist
        try:
            cursor.execute("PRAGMA table_info(public_contest_sync_audits)")
            cols = [info[1] for info in cursor.fetchall()]
            if "dataset_version" not in cols:
                cursor.execute("ALTER TABLE public_contest_sync_audits ADD COLUMN dataset_version INTEGER DEFAULT 1")
            if "publish_status" not in cols:
                cursor.execute("ALTER TABLE public_contest_sync_audits ADD COLUMN publish_status VARCHAR(50) DEFAULT 'PUBLISHED'")
            if "failure_reason" not in cols:
                cursor.execute("ALTER TABLE public_contest_sync_audits ADD COLUMN failure_reason TEXT")
            conn.commit()
        except Exception as _audit_col_err:
            print(f"[DB Migration] public_contest_sync_audits column migration note: {_audit_col_err}")

        # Register Database-level Snapshot Immutability Trigger
        try:
            cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS trg_prevent_snapshot_mutation
            BEFORE UPDATE OF dataset, dataset_hash, student_count, error_count ON official_weekly_snapshots
            FOR EACH ROW
            WHEN OLD.dataset_hash IS NOT NULL AND NEW.is_superseded = OLD.is_superseded AND NEW.superseded_by_id IS OLD.superseded_by_id
            BEGIN
                SELECT RAISE(ABORT, 'SNAPSHOT_IMMUTABLE: Finalized snapshot cannot be modified in-place. Use snapshot_supersedes() instead.');
            END;
            """)
            conn.commit()
            print("[DB Migration] Registered SQLite snapshot immutability trigger in migrate_db.py.")
        except Exception as _trg_e:
            print(f"[DB Migration] Trigger note: {_trg_e}")

        try:
            cursor.execute("ALTER TABLE email_otp_records ADD COLUMN request_ip_hash VARCHAR(128);")
        except Exception:
            pass  # Already exists

        columns_to_add = [
            ("recent_contest_name",  "VARCHAR(150)"),
            ("recent_contest_score", "VARCHAR(20)"),
            ("last_successful_sync", "DATETIME"),
            ("fetch_duration",       "FLOAT"),
            ("sync_status",          "VARCHAR(20) DEFAULT 'not_started'"),
            ("source",               "VARCHAR(100)"),
            ("last_verified_at",     "DATETIME"),
            ("error_message",        "TEXT"),
            ("public_profile_ranking", "INTEGER"),
            ("validation_status",    "VARCHAR(50)"),
            ("error_code",           "VARCHAR(50)"),
            ("last_attempt_at",      "DATETIME"),
            ("retry_count",          "INTEGER DEFAULT 0"),
            ("active_days",          "INTEGER"),
            ("max_streak",           "INTEGER"),
            ("recent_accepted",      "INTEGER"),
            ("source_total_solved",  "INTEGER"),
            ("derived_total_solved", "INTEGER"),
        ]
        for col_name, col_type in columns_to_add:
            try:
                cursor.execute(f"ALTER TABLE leetcode_profile_stats ADD COLUMN {col_name} {col_type};")
                print(f"Added column '{col_name}' to leetcode_profile_stats.")
            except Exception:
                pass  # Column already exists — safe to ignore

        session_cols = [
            ("academic_year",        "VARCHAR(20) DEFAULT '2026-27'"),
            ("week_number",          "INTEGER"),
            ("session_code",         "VARCHAR(50)"),
            ("session_date",         "VARCHAR(20)"),
            ("contest_id",           "VARCHAR(100)"),
            ("contest_name",         "VARCHAR(200)"),
            ("start_time",           "VARCHAR(20) DEFAULT '08:00'"),
            ("end_time",             "VARCHAR(20) DEFAULT '09:30'"),
            ("status",               "VARCHAR(30) DEFAULT 'SCHEDULED'"),
            ("baseline_snapshot_id",  "VARCHAR(100)"),
            ("final_snapshot_id",     "VARCHAR(100)"),
            ("total_students",        "INTEGER DEFAULT 273"),
            ("official_participants", "INTEGER DEFAULT 0"),
            ("virtual_participants",  "INTEGER DEFAULT 0"),
            ("not_participated",      "INTEGER DEFAULT 0"),
            ("failed_verification",   "INTEGER DEFAULT 0"),
            ("dataset_hash",          "VARCHAR(64)"),
            ("created_at",            "DATETIME"),
            ("completed_at",          "DATETIME"),
            ("finalized_at",          "DATETIME"),
        ]
        for col_name, col_type in session_cols:
            try:
                cursor.execute(f"ALTER TABLE weekly_sessions ADD COLUMN {col_name} {col_type};")
                print(f"Added column '{col_name}' to weekly_sessions.")
            except Exception:
                pass

        hod_cols = [
            ("academic_year", "VARCHAR(20) DEFAULT '2026-27'"),
            ("status",        "VARCHAR(30) DEFAULT 'READY'"),
            ("created_by",    "VARCHAR(100) DEFAULT 'HOD / System'"),
            ("verified_at",   "DATETIME"),
        ]
        for col_name, col_type in hod_cols:
            try:
                cursor.execute(f"ALTER TABLE hod_snapshots ADD COLUMN {col_name} {col_type};")
                print(f"Added column '{col_name}' to hod_snapshots.")
            except Exception:
                pass

        # Auto-create email tables if missing
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS report_email_recipients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(150) NOT NULL,
                email VARCHAR(150) UNIQUE NOT NULL,
                role VARCHAR(50) DEFAULT 'HOD',
                department VARCHAR(50),
                is_active BOOLEAN DEFAULT 1,
                receive_weekly_reports BOOLEAN DEFAULT 1,
                receive_hod_reports BOOLEAN DEFAULT 1,
                receive_error_reports BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        """)

        cert_cols = [
            ("document_type", "VARCHAR(64) DEFAULT 'CERTIFICATE_OF_EXCELLENCE'"),
            ("contest_id",    "VARCHAR(64)"),
            ("sha_hash",      "VARCHAR(128)"),
        ]
        for col_name, col_type in cert_cols:
            try:
                cursor.execute(f"ALTER TABLE certificate_records ADD COLUMN {col_name} {col_type};")
                print(f"Added column '{col_name}' to certificate_records.")
            except Exception:
                pass

        public_res_cols = [
            ("state", "VARCHAR(30) DEFAULT 'PENDING'"),
            ("previous_state", "VARCHAR(30)"),
            ("state_changed_at", "DATETIME"),
            ("last_error_code", "VARCHAR(50)"),
            ("evidence_json", "TEXT"),
            ("record_hash", "VARCHAR(128)"),
        ]
        for col_name, col_type in public_res_cols:
            try:
                cursor.execute(f"ALTER TABLE weekly_public_results ADD COLUMN {col_name} {col_type};")
                print(f"Added column '{col_name}' to weekly_public_results.")
            except Exception:
                pass

        virtual_res_cols = [
            ("state", "VARCHAR(30) DEFAULT 'VALIDATED'"),
            ("evidence_json", "TEXT"),
            ("record_hash", "VARCHAR(128)"),
        ]
        for col_name, col_type in virtual_res_cols:
            try:
                cursor.execute(f"ALTER TABLE weekly_virtual_results ADD COLUMN {col_name} {col_type};")
                print(f"Added column '{col_name}' to weekly_virtual_results.")
            except Exception:
                pass

        snapshot_cols = [
            ("session_data_hash", "VARCHAR(128)"),
            ("reconciliation_summary", "TEXT"),
            ("snapshot_version", "INTEGER DEFAULT 1"),
        ]
        for col_name, col_type in snapshot_cols:
            try:
                cursor.execute(f"ALTER TABLE official_weekly_snapshots ADD COLUMN {col_name} {col_type};")
                print(f"Added column '{col_name}' to official_weekly_snapshots.")
            except Exception:
                pass

        session_cols = [
            ("session_data_hash", "VARCHAR(128)"),
            ("reconciliation_summary", "TEXT"),
        ]
        for col_name, col_type in session_cols:
            try:
                cursor.execute(f"ALTER TABLE weekly_sessions ADD COLUMN {col_name} {col_type};")
                print(f"Added column '{col_name}' to weekly_sessions.")
            except Exception:
                pass

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS student_contest_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL,
                contest_name VARCHAR(100),
                contest_number INTEGER,
                contest_date VARCHAR(30),
                questions_solved INTEGER DEFAULT 0,
                questions_total INTEGER DEFAULT 4,
                contest_rank INTEGER,
                contest_rating REAL,
                top_percentage REAL,
                attended BOOLEAN DEFAULT 1,
                status VARCHAR(30) DEFAULT 'VERIFIED',
                error_message TEXT,
                captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES students (id)
            );
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS email_dispatch_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email_id VARCHAR(100) UNIQUE NOT NULL,
                report_id VARCHAR(100),
                session_id INTEGER,
                idempotency_key VARCHAR(255) NOT NULL,
                recipient VARCHAR(150) NOT NULL,
                role VARCHAR(50) DEFAULT 'HOD',
                subject VARCHAR(255) NOT NULL,
                status VARCHAR(30) DEFAULT 'QUEUED',
                attachment_count INTEGER DEFAULT 0,
                total_attachment_bytes INTEGER DEFAULT 0,
                error_message TEXT,
                retry_count INTEGER DEFAULT 0,
                sent_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # contest_participations: source_username audit trail column
        try:
            cursor.execute("ALTER TABLE contest_participations ADD COLUMN source_username VARCHAR(100);")
            print("Added column 'source_username' to contest_participations.")
        except Exception:
            pass  # Column already exists — safe to ignore

        conn.commit()
        conn.close()
        print("Database migration complete.")

    else:
        print("Database file not found for migration.")


if __name__ == "__main__":
    run_db_migrations()

