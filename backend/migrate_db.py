import sqlite3
import os

from backend.database import engine
from backend.models import Base

def run_db_migrations():
    # Ensure all tables defined in Base (including new models like student_stat_snapshots) exist
    Base.metadata.create_all(bind=engine)

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

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS certificate_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL,
                certificate_type VARCHAR(100) NOT NULL,
                certificate_code VARCHAR(50) UNIQUE NOT NULL,
                issue_date VARCHAR(20) NOT NULL,
                qr_code_path VARCHAR(255),
                pdf_path VARCHAR(255),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES students (id)
            );
        """)

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

