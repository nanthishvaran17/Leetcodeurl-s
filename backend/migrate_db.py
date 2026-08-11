import sqlite3
import os

def run_db_migrations():
    db_path = os.path.join(os.path.dirname(__file__), "..", "data", "leetcode_tracker.db")
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        columns_to_add = [
            ("recent_contest_name",  "VARCHAR(150)"),
            ("recent_contest_score", "VARCHAR(20)"),
            ("last_successful_sync", "DATETIME"),
            ("fetch_duration",       "FLOAT"),
            # Added for LeetCode profile verification system
            ("sync_status",          "VARCHAR(20) DEFAULT 'success'"),
            ("source",               "VARCHAR(100) DEFAULT 'leetcode_public_profile'"),
            ("last_verified_at",     "DATETIME"),
            ("error_message",        "TEXT"),
            ("public_profile_ranking", "INTEGER"),
        ]
        for col_name, col_type in columns_to_add:
            try:
                cursor.execute(f"ALTER TABLE leetcode_profile_stats ADD COLUMN {col_name} {col_type};")
                print(f"Added column '{col_name}' to leetcode_profile_stats.")
            except Exception:
                pass  # Column already exists — safe to ignore
            
        conn.commit()
        conn.close()
        print("Database migration complete.")
    else:
        print("Database file not found for migration.")

if __name__ == "__main__":
    run_db_migrations()

