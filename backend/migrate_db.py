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

        conn.commit()
        conn.close()
        print("Database migration complete.")
    else:
        print("Database file not found for migration.")

if __name__ == "__main__":
    run_db_migrations()

