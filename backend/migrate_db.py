import sqlite3
import os

def run_db_migrations():
    db_path = os.path.join(os.path.dirname(__file__), "..", "data", "leetcode_tracker.db")
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        columns_to_add = [
            ("recent_contest_name", "VARCHAR(150)"),
            ("recent_contest_score", "VARCHAR(20)"),
            ("last_successful_sync", "DATETIME"),
            ("fetch_duration", "FLOAT")
        ]
        for col_name, col_type in columns_to_add:
            try:
                cursor.execute(f"ALTER TABLE leetcode_profile_stats ADD COLUMN {col_name} {col_type};")
                print(f"Added column '{col_name}' to leetcode_profile_stats.")
            except Exception:
                pass
            
        conn.commit()
        conn.close()
        print("Database migration complete.")
    else:
        print("Database file not found for migration.")

if __name__ == "__main__":
    run_db_migrations()

