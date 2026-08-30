import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.database import engine
from sqlalchemy import text

def apply_indexes():
    indexes_sql = [
        "CREATE INDEX IF NOT EXISTS ix_students_search_optimized ON students (name, reg_no, username);",
        "CREATE INDEX IF NOT EXISTS ix_students_dept_year_active ON students (department_id, year_level, is_active);",
        "CREATE INDEX IF NOT EXISTS ix_weekly_public_results_session_dept_year ON weekly_public_results (session_id, dept, year);",
        "CREATE INDEX IF NOT EXISTS ix_weekly_public_results_session_participation ON weekly_public_results (session_id, participation_status);"
    ]
    
    try:
        with engine.connect() as conn:
            for sql in indexes_sql:
                print(f"Applying: {sql}")
                conn.execute(text(sql))
            conn.commit()
            print("Successfully applied all performance indexes!")
    except Exception as e:
        print(f"Error applying indexes: {e}")

if __name__ == "__main__":
    apply_indexes()
