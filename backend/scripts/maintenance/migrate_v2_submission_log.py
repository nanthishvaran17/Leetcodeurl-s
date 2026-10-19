import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "leetcode_tracker.db")
# Vercel paths
if os.environ.get("VERCEL") == "1" or os.environ.get("VERCEL_ENV"):
    DB_PATH = "/tmp/leetcode_tracker.db"

def run_migration():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return
        
    print(f"Migrating {DB_PATH} for v2 SubmissionLog constraints...")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # SQLite doesn't support DROP CONSTRAINT. We must recreate the table.
        cursor.execute("BEGIN TRANSACTION;")
        
        # 1. Create new table with new constraint
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS submission_log_v2 (
            id INTEGER NOT NULL PRIMARY KEY,
            student_id INTEGER NOT NULL,
            contest_id VARCHAR(100) NOT NULL,
            title_slug VARCHAR(150) NOT NULL,
            submitted_at BIGINT NOT NULL,
            fetched_at BIGINT NOT NULL,
            CONSTRAINT uix_sublog_all UNIQUE (student_id, contest_id, title_slug, submitted_at),
            FOREIGN KEY(student_id) REFERENCES students (id)
        );
        """)
        
        # 2. Copy data
        cursor.execute("""
        INSERT OR IGNORE INTO submission_log_v2 (id, student_id, contest_id, title_slug, submitted_at, fetched_at)
        SELECT id, student_id, contest_id, title_slug, submitted_at, fetched_at FROM submission_log;
        """)
        
        # 3. Drop old table
        cursor.execute("DROP TABLE submission_log;")
        
        # 4. Rename new table
        cursor.execute("ALTER TABLE submission_log_v2 RENAME TO submission_log;")
        
        # 5. Recreate indexes
        cursor.execute("CREATE INDEX ix_submission_log_id ON submission_log (id);")
        cursor.execute("CREATE INDEX ix_submission_log_student_id ON submission_log (student_id);")
        cursor.execute("CREATE INDEX ix_submission_log_contest_id ON submission_log (contest_id);")
        cursor.execute("CREATE INDEX ix_submission_log_title_slug ON submission_log (title_slug);")
        cursor.execute("CREATE INDEX ix_submission_log_submitted_at ON submission_log (submitted_at);")
        
        conn.commit()
        print("Migration successful!")
    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
