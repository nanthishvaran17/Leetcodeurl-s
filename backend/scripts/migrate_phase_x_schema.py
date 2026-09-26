"""
Non-destructive schema migration for Phase X Accuracy Hardening (Fix 1 & Fix 2).
Adds classification_signal, solve_timeline, live_solves_count, post_contest_solves_count to participation tables,
adds ContestReportVersion table, and updates ContestReconciliationEvent.
"""
import sys
import os
from sqlalchemy import inspect, text

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.database import engine, Base
from backend.models import (
    ContestParticipation,
    StudentContestParticipation,
    WeeklyPublicResult,
    WeeklyVirtualResult,
    ContestRawEvidence,
    ContestReconciliationEvent,
    ContestReportVersion
)

def run_migration():
    print("Running Phase X schema migration...")
    
    # 1. Create any missing tables defined in Base metadata
    Base.metadata.create_all(bind=engine)
    print("Base.metadata.create_all completed.")
    
    inspector = inspect(engine)
    
    # Define columns to ensure
    alter_queries = []
    
    def check_and_add_column(table_name, column_name, col_type):
        columns = [c["name"] for c in inspector.get_columns(table_name)] if inspector.has_table(table_name) else []
        if table_name in inspector.get_table_names() and column_name not in columns:
            alter_queries.append(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {col_type}")

    # contest_participations
    check_and_add_column("contest_participations", "classification_signal", "VARCHAR(100)")
    check_and_add_column("contest_participations", "solve_timeline", "JSON")
    check_and_add_column("contest_participations", "live_solves_count", "INTEGER DEFAULT 0")
    check_and_add_column("contest_participations", "post_contest_solves_count", "INTEGER DEFAULT 0")

    # student_contest_participations
    check_and_add_column("student_contest_participations", "classification_signal", "VARCHAR(100)")
    check_and_add_column("student_contest_participations", "solve_timeline", "JSON")
    check_and_add_column("student_contest_participations", "live_solves_count", "INTEGER DEFAULT 0")
    check_and_add_column("student_contest_participations", "post_contest_solves_count", "INTEGER DEFAULT 0")

    # weekly_public_results
    check_and_add_column("weekly_public_results", "classification_signal", "VARCHAR(100)")
    check_and_add_column("weekly_public_results", "solve_timeline", "JSON")

    # weekly_virtual_results
    check_and_add_column("weekly_virtual_results", "classification_signal", "VARCHAR(100)")
    check_and_add_column("weekly_virtual_results", "solve_timeline", "JSON")

    # contest_reconciliation_events
    check_and_add_column("contest_reconciliation_events", "contest_id", "VARCHAR(100)")
    check_and_add_column("contest_reconciliation_events", "classification_signal", "VARCHAR(100)")
    check_and_add_column("contest_reconciliation_events", "reason", "TEXT")
    check_and_add_column("contest_reconciliation_events", "old_solved_count", "INTEGER")
    check_and_add_column("contest_reconciliation_events", "new_solved_count", "INTEGER")
    check_and_add_column("contest_reconciliation_events", "reconciliation_stage", "VARCHAR(50)")

    with engine.begin() as conn:
        for q in alter_queries:
            try:
                print(f"Executing: {q}")
                conn.execute(text(q))
            except Exception as e:
                print(f"Migration note ({q}): {e}")

    print("Phase X schema migration completed successfully!")

if __name__ == "__main__":
    run_migration()
