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
        from sqlalchemy import inspect as _inspect
        try:
            inspector = _inspect(engine)
            existing_tables = set(inspector.get_table_names())
            table_cols_map = {}
            for t_name in existing_tables:
                table_cols_map[t_name] = {c["name"] for c in inspector.get_columns(t_name)}
        except Exception as _insp_err:
            table_cols_map = {}

        pg_migrations = [
            # ── users table ─────────────────────────────────────────────────
            ("users", "institutional_id", "ALTER TABLE users ADD COLUMN IF NOT EXISTS institutional_id VARCHAR(50)"),
            ("users", "full_name", "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(200)"),
            ("users", "designation", "ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(100)"),
            ("users", "phone_number", "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30)"),
            ("users", "whatsapp_verified", "ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_verified BOOLEAN DEFAULT FALSE"),
            ("users", "date_of_birth", "ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE"),
            ("users", "department_id", "ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id INTEGER"),
            ("users", "section_id", "ALTER TABLE users ADD COLUMN IF NOT EXISTS section_id INTEGER"),
            ("users", "academic_year", "ALTER TABLE users ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20)"),
            ("users", "mentoring_role", "ALTER TABLE users ADD COLUMN IF NOT EXISTS mentoring_role VARCHAR(50)"),
            ("users", "require_password_change", "ALTER TABLE users ADD COLUMN IF NOT EXISTS require_password_change BOOLEAN DEFAULT FALSE"),
            ("users", "last_login", "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP"),
            ("users", "last_activity", "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP"),
            ("users", "totp_secret", "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(64)"),
            ("users", "is_2fa_enabled", "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_2fa_enabled BOOLEAN DEFAULT FALSE"),
            ("users", "created_at", "ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP"),
            ("users", "reporting_manager_id", "ALTER TABLE users ADD COLUMN IF NOT EXISTS reporting_manager_id INTEGER"),
            # ── students table ───────────────────────────────────────────────
            ("students", "people_id", "ALTER TABLE students ADD COLUMN IF NOT EXISTS people_id VARCHAR(50)"),
            ("students", "phone_number", "ALTER TABLE students ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30)"),
            ("students", "whatsapp_verified", "ALTER TABLE students ADD COLUMN IF NOT EXISTS whatsapp_verified BOOLEAN DEFAULT FALSE"),
            ("students", "date_of_birth", "ALTER TABLE students ADD COLUMN IF NOT EXISTS date_of_birth DATE"),
            ("students", "batch", "ALTER TABLE students ADD COLUMN IF NOT EXISTS batch VARCHAR(50)"),
            ("students", "institutional_email", "ALTER TABLE students ADD COLUMN IF NOT EXISTS institutional_email VARCHAR(150)"),
            ("students", "email_status", "ALTER TABLE students ADD COLUMN IF NOT EXISTS email_status VARCHAR(50) DEFAULT 'pending'"),
            ("students", "allocation", "ALTER TABLE students ADD COLUMN IF NOT EXISTS allocation VARCHAR(50)"),
            ("students", "codeforces_username", "ALTER TABLE students ADD COLUMN IF NOT EXISTS codeforces_username VARCHAR(100)"),
            ("students", "hackerrank_username", "ALTER TABLE students ADD COLUMN IF NOT EXISTS hackerrank_username VARCHAR(100)"),
            ("students", "version", "ALTER TABLE students ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1"),
            ("students", "joining_date", "ALTER TABLE students ADD COLUMN IF NOT EXISTS joining_date TIMESTAMP"),
            ("students", "created_at", "ALTER TABLE students ADD COLUMN IF NOT EXISTS created_at TIMESTAMP"),
            # ── weekly_sessions table ────────────────────────────────────────
            ("weekly_sessions", "academic_year", "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20) DEFAULT '2026-27'"),
            ("weekly_sessions", "week_number", "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS week_number INTEGER"),
            ("weekly_sessions", "session_code", "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS session_code VARCHAR(50)"),
            ("weekly_sessions", "contest_id", "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS contest_id VARCHAR(100)"),
            ("weekly_sessions", "start_time", "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS start_time VARCHAR(20) DEFAULT '08:00'"),
            ("weekly_sessions", "end_time", "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS end_time VARCHAR(20) DEFAULT '09:30'"),
            ("weekly_sessions", "baseline_snapshot_id", "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS baseline_snapshot_id VARCHAR(100)"),
            ("weekly_sessions", "final_snapshot_id", "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS final_snapshot_id VARCHAR(100)"),
            ("weekly_sessions", "total_students", "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS total_students INTEGER DEFAULT 0"),
            ("weekly_sessions", "official_participants", "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS official_participants INTEGER DEFAULT 0"),
            ("weekly_sessions", "virtual_participants", "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS virtual_participants INTEGER DEFAULT 0"),
            ("weekly_sessions", "not_participated", "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS not_participated INTEGER DEFAULT 0"),
            ("weekly_sessions", "failed_verification", "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS failed_verification INTEGER DEFAULT 0"),
            ("weekly_sessions", "dataset_hash", "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS dataset_hash VARCHAR(64)"),
            ("weekly_sessions", "sync_status", "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS sync_status VARCHAR(30) DEFAULT 'PENDING'"),
            ("weekly_sessions", "last_synced", "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS last_synced TIMESTAMP"),
            ("weekly_sessions", "created_at", "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP"),
            ("weekly_sessions", "completed_at", "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP"),
            ("weekly_sessions", "finalized_at", "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMP"),
            ("weekly_sessions", "session_data_hash", "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS session_data_hash VARCHAR(128)"),
            ("weekly_sessions", "reconciliation_summary", "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS reconciliation_summary TEXT"),
            ("weekly_sessions", "pipeline_state", "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS pipeline_state VARCHAR(50)"),
            ("weekly_sessions", "pipeline_last_updated", "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS pipeline_last_updated TIMESTAMP"),
            ("weekly_sessions", "pipeline_error", "ALTER TABLE weekly_sessions ADD COLUMN IF NOT EXISTS pipeline_error TEXT"),
            # ── leetcode_profile_stats ───────────────────────────────────────
            ("leetcode_profile_stats", "source_total_solved", "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS source_total_solved INTEGER"),
            ("leetcode_profile_stats", "derived_total_solved", "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS derived_total_solved INTEGER"),
            ("leetcode_profile_stats", "public_profile_ranking", "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS public_profile_ranking INTEGER"),
            ("leetcode_profile_stats", "active_days", "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS active_days INTEGER"),
            ("leetcode_profile_stats", "max_streak", "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS max_streak INTEGER"),
            ("leetcode_profile_stats", "recent_accepted", "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS recent_accepted INTEGER"),
            ("leetcode_profile_stats", "recent_contest_name", "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS recent_contest_name VARCHAR(150)"),
            ("leetcode_profile_stats", "recent_contest_score", "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS recent_contest_score VARCHAR(20)"),
            ("leetcode_profile_stats", "sync_status", "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS sync_status VARCHAR(50) DEFAULT 'not_started'"),
            ("leetcode_profile_stats", "validation_status", "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS validation_status VARCHAR(50)"),
            ("leetcode_profile_stats", "source", "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS source VARCHAR(100)"),
            ("leetcode_profile_stats", "error_message", "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS error_message TEXT"),
            ("leetcode_profile_stats", "error_code", "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS error_code VARCHAR(50)"),
            ("leetcode_profile_stats", "last_successful_sync", "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS last_successful_sync TIMESTAMP"),
            ("leetcode_profile_stats", "last_verified_at", "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP"),
            ("leetcode_profile_stats", "last_attempt_at", "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMP"),
            ("leetcode_profile_stats", "retry_count", "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0"),
            ("leetcode_profile_stats", "fetch_duration", "ALTER TABLE leetcode_profile_stats ADD COLUMN IF NOT EXISTS fetch_duration FLOAT"),
            # ── weekly_public_results ────────────────────────────────────────
            ("weekly_public_results", "state", "ALTER TABLE weekly_public_results ADD COLUMN IF NOT EXISTS state VARCHAR(30) DEFAULT 'PENDING'"),
            ("weekly_public_results", "previous_state", "ALTER TABLE weekly_public_results ADD COLUMN IF NOT EXISTS previous_state VARCHAR(30)"),
            ("weekly_public_results", "state_changed_at", "ALTER TABLE weekly_public_results ADD COLUMN IF NOT EXISTS state_changed_at TIMESTAMP"),
            ("weekly_public_results", "last_error_code", "ALTER TABLE weekly_public_results ADD COLUMN IF NOT EXISTS last_error_code VARCHAR(50)"),
            ("weekly_public_results", "evidence_json", "ALTER TABLE weekly_public_results ADD COLUMN IF NOT EXISTS evidence_json TEXT"),
            ("weekly_public_results", "record_hash", "ALTER TABLE weekly_public_results ADD COLUMN IF NOT EXISTS record_hash VARCHAR(128)"),
            ("weekly_public_results", "data_fetch_status", "ALTER TABLE weekly_public_results ADD COLUMN IF NOT EXISTS data_fetch_status VARCHAR(50) DEFAULT 'DATA_UNAVAILABLE'"),
            ("weekly_public_results", "confidence", "ALTER TABLE weekly_public_results ADD COLUMN IF NOT EXISTS confidence VARCHAR(50) DEFAULT 'UNVERIFIED'"),
            ("weekly_public_results", "verification_evidence", "ALTER TABLE weekly_public_results ADD COLUMN IF NOT EXISTS verification_evidence TEXT"),
            ("weekly_public_results", "retry_count", "ALTER TABLE weekly_public_results ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0"),
            ("weekly_public_results", "last_fetched_at", "ALTER TABLE weekly_public_results ADD COLUMN IF NOT EXISTS last_fetched_at TIMESTAMP"),
            # ── weekly_virtual_results ───────────────────────────────────────
            ("weekly_virtual_results", "state", "ALTER TABLE weekly_virtual_results ADD COLUMN IF NOT EXISTS state VARCHAR(30) DEFAULT 'VALIDATED'"),
            ("weekly_virtual_results", "evidence_json", "ALTER TABLE weekly_virtual_results ADD COLUMN IF NOT EXISTS evidence_json TEXT"),
            ("weekly_virtual_results", "record_hash", "ALTER TABLE weekly_virtual_results ADD COLUMN IF NOT EXISTS record_hash VARCHAR(128)"),
            # ── weekly_student_progress ──────────────────────────────────────
            ("weekly_student_progress", "academic_year", "ALTER TABLE weekly_student_progress ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20)"),
            ("weekly_student_progress", "year_rank", "ALTER TABLE weekly_student_progress ADD COLUMN IF NOT EXISTS year_rank INTEGER"),
            ("weekly_student_progress", "section_rank", "ALTER TABLE weekly_student_progress ADD COLUMN IF NOT EXISTS section_rank INTEGER"),
            ("weekly_student_progress", "progress_rank", "ALTER TABLE weekly_student_progress ADD COLUMN IF NOT EXISTS progress_rank INTEGER"),
            ("weekly_student_progress", "streak_count", "ALTER TABLE weekly_student_progress ADD COLUMN IF NOT EXISTS streak_count INTEGER DEFAULT 0"),
            ("weekly_student_progress", "consistency_score", "ALTER TABLE weekly_student_progress ADD COLUMN IF NOT EXISTS consistency_score FLOAT DEFAULT 0.0"),
            ("weekly_student_progress", "badge_list", "ALTER TABLE weekly_student_progress ADD COLUMN IF NOT EXISTS badge_list TEXT"),
            ("weekly_student_progress", "composite_score", "ALTER TABLE weekly_student_progress ADD COLUMN IF NOT EXISTS composite_score FLOAT DEFAULT 0.0"),
            # ── admin_sessions ───────────────────────────────────────────────
            ("admin_sessions", "revoked_at", "ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP"),
            ("admin_sessions", "ip_hash", "ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS ip_hash VARCHAR(128)"),
            ("admin_sessions", "user_agent_hash", "ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS user_agent_hash VARCHAR(128)"),
            # ── contest_participations ───────────────────────────────────────
            ("contest_participations", "source_username", "ALTER TABLE contest_participations ADD COLUMN IF NOT EXISTS source_username VARCHAR(100)"),
            # ── student_contest_participations ───────────────────────────────
            ("student_contest_participations", "solved_problems", "ALTER TABLE student_contest_participations ADD COLUMN IF NOT EXISTS solved_problems TEXT"),
            ("student_contest_participations", "confidence", "ALTER TABLE student_contest_participations ADD COLUMN IF NOT EXISTS confidence VARCHAR(50) DEFAULT 'HIGH'"),
            ("student_contest_participations", "participation_mode", "ALTER TABLE student_contest_participations ADD COLUMN IF NOT EXISTS participation_mode VARCHAR(30)"),
            ("student_contest_participations", "verification_level", "ALTER TABLE student_contest_participations ADD COLUMN IF NOT EXISTS verification_level VARCHAR(50)"),
            ("student_contest_participations", "verification_evidence", "ALTER TABLE student_contest_participations ADD COLUMN IF NOT EXISTS verification_evidence TEXT"),
            ("student_contest_participations", "updated_at", "ALTER TABLE student_contest_participations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP"),
            # ── hod_snapshots ────────────────────────────────────────────────
            ("hod_snapshots", "academic_year", "ALTER TABLE hod_snapshots ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20) DEFAULT '2026-27'"),
            ("hod_snapshots", "status", "ALTER TABLE hod_snapshots ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'READY'"),
            ("hod_snapshots", "created_by", "ALTER TABLE hod_snapshots ADD COLUMN IF NOT EXISTS created_by VARCHAR(100) DEFAULT 'HOD / System'"),
            ("hod_snapshots", "verified_at", "ALTER TABLE hod_snapshots ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP"),
            # ── official_weekly_snapshots ────────────────────────────────────
            ("official_weekly_snapshots", "is_superseded", "ALTER TABLE official_weekly_snapshots ADD COLUMN IF NOT EXISTS is_superseded BOOLEAN DEFAULT FALSE"),
            ("official_weekly_snapshots", "superseded_by_id", "ALTER TABLE official_weekly_snapshots ADD COLUMN IF NOT EXISTS superseded_by_id INTEGER"),
            ("official_weekly_snapshots", "session_data_hash", "ALTER TABLE official_weekly_snapshots ADD COLUMN IF NOT EXISTS session_data_hash VARCHAR(128)"),
            ("official_weekly_snapshots", "reconciliation_summary", "ALTER TABLE official_weekly_snapshots ADD COLUMN IF NOT EXISTS reconciliation_summary TEXT"),
            ("official_weekly_snapshots", "snapshot_version", "ALTER TABLE official_weekly_snapshots ADD COLUMN IF NOT EXISTS snapshot_version INTEGER DEFAULT 1"),
            # ── scheduled_job_executions table ───────────────────────────────
            ("scheduled_job_executions", "error_message", "ALTER TABLE scheduled_job_executions ADD COLUMN IF NOT EXISTS error_message TEXT"),
            ("scheduled_job_executions", "last_error", "ALTER TABLE scheduled_job_executions ADD COLUMN IF NOT EXISTS last_error TEXT"),
            ("scheduled_job_executions", "next_run", "ALTER TABLE scheduled_job_executions ADD COLUMN IF NOT EXISTS next_run TIMESTAMP"),
            # ── conversations table ──────────────────────────────────────────
            ("conversations", "last_message_preview", "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_preview VARCHAR(255)"),
            ("conversations", "last_message_at", "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP"),
            ("conversations", "unread_count_1", "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS unread_count_1 INTEGER DEFAULT 0"),
            ("conversations", "unread_count_2", "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS unread_count_2 INTEGER DEFAULT 0"),
            # ── messages table ───────────────────────────────────────────────
            ("messages", "delivered_at", "ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP"),
            ("messages", "read_at", "ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP"),
            ("messages", "edited_at", "ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP"),
            ("messages", "is_edited", "ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE"),
            ("messages", "is_deleted_everyone", "ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted_everyone BOOLEAN DEFAULT FALSE"),
            ("messages", "deleted_by_users", "ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_by_users TEXT DEFAULT '[]'"),
            ("messages", "reply_to_message_id", "ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_message_id VARCHAR(100)"),
            ("messages", "client_message_id", "ALTER TABLE messages ADD COLUMN IF NOT EXISTS client_message_id VARCHAR(100)"),
            ("messages", "t0_client_send", "ALTER TABLE messages ADD COLUMN IF NOT EXISTS t0_client_send BIGINT"),
            ("messages", "t1_server_receive", "ALTER TABLE messages ADD COLUMN IF NOT EXISTS t1_server_receive BIGINT"),
            ("messages", "t2_auth_persist", "ALTER TABLE messages ADD COLUMN IF NOT EXISTS t2_auth_persist BIGINT"),
            ("messages", "t3_fanout", "ALTER TABLE messages ADD COLUMN IF NOT EXISTS t3_fanout BIGINT"),
            ("messages", "reactions", "ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions TEXT DEFAULT '{}'"),
            ("messages", "attachment_file_id", "ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_file_id VARCHAR(100)"),
            # ── notification_files table ─────────────────────────────────────
            ("notification_files", "file_size", "ALTER TABLE notification_files ADD COLUMN IF NOT EXISTS file_size INTEGER"),
            ("notification_files", "entity_type", "ALTER TABLE notification_files ADD COLUMN IF NOT EXISTS entity_type VARCHAR(60)"),
            ("notification_files", "entity_id", "ALTER TABLE notification_files ADD COLUMN IF NOT EXISTS entity_id VARCHAR(100)"),
            ("notification_files", "access_scope", "ALTER TABLE notification_files ADD COLUMN IF NOT EXISTS access_scope VARCHAR(100) DEFAULT 'ALL'"),
            ("notification_files", "allowed_user_ids", "ALTER TABLE notification_files ADD COLUMN IF NOT EXISTS allowed_user_ids TEXT"),
            ("notification_files", "is_deleted", "ALTER TABLE notification_files ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE"),
            ("notification_files", "expires_at", "ALTER TABLE notification_files ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP"),
            # ── notification_preferences table ───────────────────────────────
            ("notification_preferences", "push_enabled", "ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT TRUE"),
            ("notification_preferences", "email_enabled", "ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN DEFAULT TRUE"),
            ("notification_preferences", "categories_json", "ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS categories_json TEXT"),
        ]

        for t_name, c_name, migration_sql in pg_migrations:
            # Skip if table exists and column is already present
            if t_name in table_cols_map and c_name in table_cols_map[t_name]:
                continue
            try:
                with engine.begin() as pg_conn:
                    pg_conn.execute(sql_text(migration_sql))
                    print(f"[PG Migration] Added column {c_name} to {t_name}")
            except Exception as _col_err:
                print(f"[PG Migration] Note ({t_name}.{c_name}): {_col_err}")

        # ── Session Recovery ─────────────────────────────────────────────
        try:
            with engine.begin() as pg_conn:
                pg_conn.execute(sql_text("UPDATE weekly_sessions SET status = 'SCHEDULED' WHERE status = 'FINALIZED' AND id NOT IN (SELECT session_id FROM official_weekly_snapshots)"))
        except Exception as _rec_err:
            pass

        print("[PG Migration] PostgreSQL column migrations applied successfully.")

        # ── Compound Performance Indexes ──────────────────────────────────
        perf_indexes = [
            "CREATE INDEX IF NOT EXISTS ix_weekly_public_results_session_student ON weekly_public_results (session_id, student_id)",
            "CREATE INDEX IF NOT EXISTS ix_weekly_virtual_results_session_student ON weekly_virtual_results (session_id, student_id)",
            "CREATE INDEX IF NOT EXISTS ix_weekly_student_progress_student_week ON weekly_student_progress (student_id, week_number)",
            "CREATE INDEX IF NOT EXISTS ix_students_active_dept ON students (is_active, department_id)",
            "CREATE INDEX IF NOT EXISTS ix_messages_conv_created ON messages (conversation_id, created_at)",
            "CREATE INDEX IF NOT EXISTS ix_messages_unread_status ON messages (conversation_id, receiver_id, status)",
            "CREATE INDEX IF NOT EXISTS ix_messages_message_id ON messages (message_id)",
            "CREATE INDEX IF NOT EXISTS ix_conversations_conversation_id ON conversations (conversation_id)",
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

        # Ensure students table has people_id column in SQLite
        try:
            cursor.execute("PRAGMA table_info(students)")
            stud_cols = [info[1] for info in cursor.fetchall()]
            if "people_id" not in stud_cols:
                cursor.execute("ALTER TABLE students ADD COLUMN people_id VARCHAR(50)")
                conn.commit()
                print("[DB Migration] Added people_id column to students table in SQLite.")
        except Exception as _stud_col_err:
            print(f"[DB Migration] students people_id migration note: {_stud_col_err}")

        # Ensure scheduled_job_executions table has error_message, last_error, next_run in SQLite
        try:
            cursor.execute("PRAGMA table_info(scheduled_job_executions)")
            job_cols = [info[1] for info in cursor.fetchall()]
            if "error_message" not in job_cols:
                cursor.execute("ALTER TABLE scheduled_job_executions ADD COLUMN error_message TEXT")
            if "last_error" not in job_cols:
                cursor.execute("ALTER TABLE scheduled_job_executions ADD COLUMN last_error TEXT")
            if "next_run" not in job_cols:
                cursor.execute("ALTER TABLE scheduled_job_executions ADD COLUMN next_run TIMESTAMP")
            conn.commit()
            print("[DB Migration] Added missing columns to scheduled_job_executions table in SQLite.")
        except Exception as _job_col_err:
            print(f"[DB Migration] scheduled_job_executions column migration note: {_job_col_err}")

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

        messages_cols2 = [
            ("client_message_id", "VARCHAR(100)"),
            ("t0_client_send", "BIGINT"),
            ("t1_server_receive", "BIGINT"),
            ("t2_auth_persist", "BIGINT"),
            ("t3_fanout", "BIGINT")
        ]
        for col_name, col_type in messages_cols2:
            try:
                cursor.execute(f"ALTER TABLE messages ADD COLUMN {col_name} {col_type};")
                print(f"Added column '{col_name}' to messages.")
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

