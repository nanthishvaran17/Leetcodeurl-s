import sqlite3
import os

DB_PATH = "e:/Leetcode Web/data/leetcode_tracker.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print("Database not found!")
        return

    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute("PRAGMA busy_timeout = 10000;")


    try:
        # 1. Add people_id to students if it doesn't exist
        print("Adding people_id to students...")
        cursor.execute("ALTER TABLE students ADD COLUMN people_id VARCHAR(50);")
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_students_people_id ON students (people_id);")
    except sqlite3.OperationalError as e:
        print(f"people_id note: {e}")

    try:
        # Create weekly_student_snapshots table
        print("Creating weekly_student_snapshots table...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS weekly_student_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reporting_period_id VARCHAR(100) NOT NULL,
            people_id VARCHAR(100) NOT NULL,
            student_id INTEGER NOT NULL,
            primary_account_id VARCHAR(100),
            primary_solved_count INTEGER DEFAULT 0 NOT NULL,
            solved_bucket VARCHAR(50) NOT NULL,
            contest_attended BOOLEAN DEFAULT 0,
            contest_data TEXT,
            contest_rating REAL,
            contest_ranking INTEGER,
            verification_status VARCHAR(50) DEFAULT 'VERIFIED',
            captured_at DATETIME NOT NULL,
            created_at DATETIME,
            updated_at DATETIME
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_weekly_student_snapshots_period ON weekly_student_snapshots (reporting_period_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_weekly_student_snapshots_people_id ON weekly_student_snapshots (people_id);")

        # Create weekly_report_audits table
        print("Creating weekly_report_audits table...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS weekly_report_audits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            report_id VARCHAR(100) UNIQUE NOT NULL,
            reporting_period_id VARCHAR(100) NOT NULL,
            report_date VARCHAR(50) NOT NULL,
            generated_by VARCHAR(100) DEFAULT 'System',
            contests_included TEXT NOT NULL,
            total_students INTEGER NOT NULL,
            total_batches INTEGER NOT NULL,
            validation_status VARCHAR(50) DEFAULT 'VALID' NOT NULL,
            validation_details TEXT,
            file_hash VARCHAR(128),
            created_at DATETIME
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_weekly_report_audits_report_id ON weekly_report_audits (report_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_weekly_report_audits_period ON weekly_report_audits (reporting_period_id);")

        conn.commit()
        print("Migration completed successfully.")
    except Exception as e:
        print(f"Error during migration: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
