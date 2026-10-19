import sqlite3
import os

DB_PATH = "e:/Leetcode Web/backend/database.db"

def migrate():
    print(f"Connecting to database at {DB_PATH}")
    if not os.path.exists(DB_PATH):
        print("Database not found!")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Add status to hod_snapshots if it doesn't exist
    print("Checking hod_snapshots table...")
    cursor.execute("PRAGMA table_info(hod_snapshots)")
    columns = [col[1] for col in cursor.fetchall()]
    if "status" not in columns:
        print("Adding 'status' column to 'hod_snapshots'...")
        cursor.execute("ALTER TABLE hod_snapshots ADD COLUMN status VARCHAR(30) DEFAULT 'READY'")
    else:
        print("'status' column already exists in 'hod_snapshots'.")

    # 2. Create report_history table
    print("Creating report_history table...")
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS report_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_id VARCHAR(100) NOT NULL UNIQUE,
        report_type VARCHAR(100) NOT NULL,
        title VARCHAR(200) NOT NULL,
        snapshot_id VARCHAR(100),
        filters JSON,
        dataset JSON NOT NULL,
        status VARCHAR(30) DEFAULT 'GENERATED',
        created_by VARCHAR(100) DEFAULT 'System',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    cursor.execute('CREATE INDEX IF NOT EXISTS ix_report_history_id ON report_history (id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS ix_report_history_report_id ON report_history (report_id)')

    conn.commit()
    conn.close()
    print("Migration completed successfully.")

if __name__ == "__main__":
    migrate()
