import os
import sys
import json
import sqlite3
from sqlalchemy import create_engine, MetaData, text, Boolean

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT_DIR)

from backend.models import Base

SQLITE_PATH = os.path.join(ROOT_DIR, "data", "leetcode_tracker.db")
PG_URL = "postgresql://neondb_owner:npg_5oAmt0ICFKMT@ep-falling-pine-ae9dk8zu.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

TABLE_MIGRATION_ORDER = [
    "departments",
    "academic_years",
    "sections",
    "users",
    "admin_settings",
    "authorized_signatures",
    "report_email_recipients",
    "scheduled_report_configs",
    "students",
    "faculty_student_assignments",
    "student_assignment_history",
    "weekly_sessions",
    "weekly_sessions_snapshots",
    "weekly_public_results",
    "weekly_virtual_results",
    "weekly_student_progress",
    "lc_profiles",
    "lc_problem_stats",
    "lc_topic_stats",
    "lc_language_stats",
    "lc_submissions",
    "lc_contest_rating_history",
    "lc_contest_standing",
    "lc_badges",
    "lc_activity",
    "leetcode_profile_stats",
    "previous_week_participation_records",
    "contests",
    "contest_participations",
    "student_contest_participations",
    "student_contest_snapshots",
    "student_stat_snapshots",
    "student_risk_profiles",
    "student_goals",
    "student_weekly_targets",
    "student_learning_paths",
    "student_skill_profiles",
    "hod_snapshots",
    "snapshots",
    "forensic_audit_jobs",
    "forensic_audit_records",
    "forensic_student_ingest_status",
    "public_contest_sync_audits",
    "virtual_scan_audits",
    "sync_jobs",
    "sync_job_items",
    "admin_audit_logs",
    "audit_logs",
    "faculty_action_audit_logs",
    "faculty_action_queue",
    "faculty_interventions",
    "staff_alerts",
    "staff_follow_ups",
    "system_alerts",
    "admin_sessions",
    "email_campaigns",
    "email_queue_items",
    "email_attachments",
    "email_deliveries",
    "email_logs",
    "email_otp_records",
    "email_dispatch_logs",
    "password_reset_authorizations",
    "password_reset_otps",
    "certificate_records",
    "report_execution_histories",
    "report_history",
    "weekly_contest_error_logs",
    "raw_data",
    "official_public_participants",
    "official_weekly_snapshots",
    "mentor_notes",
    "ai_chat_history",
    "leetcode_accounts"
]

def main():
    print("=" * 70, flush=True)
    print("ULTRA FAST AUTHORITATIVE NEON MIGRATOR", flush=True)
    print("=" * 70, flush=True)

    print(f"[SOURCE] Reading SQLite: {SQLITE_PATH}...", flush=True)
    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    cursor = sqlite_conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
    sqlite_tables = [r[0] for r in cursor.fetchall()]

    source_counts = {}
    for t in sqlite_tables:
        cursor.execute(f'SELECT COUNT(*) FROM "{t}"')
        source_counts[t] = cursor.fetchone()[0]

    print(f"[SOURCE] Found {len(sqlite_tables)} tables. Students: {source_counts.get('students', 0)}, Results: {source_counts.get('weekly_public_results', 0)}", flush=True)

    print("[NEON DB] Terminating stale connections & resetting schema...", flush=True)
    engine = create_engine(PG_URL, echo=False, pool_pre_ping=True)
    with engine.connect() as conn:
        conn.execute(text("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'neondb' AND pid <> pg_backend_pid();"))
        conn.commit()
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
        conn.commit()
    engine.dispose()

    print("[NEON DB] Creating all 125 PostgreSQL schema tables...", flush=True)
    engine = create_engine(PG_URL, echo=False, pool_pre_ping=True)
    for table in Base.metadata.sorted_tables:
        try:
            table.create(bind=engine, checkfirst=True)
        except Exception:
            pass

    target_metadata = MetaData()
    target_metadata.reflect(bind=engine)
    print(f"[NEON DB] Reflecting {len(target_metadata.tables)} active PostgreSQL tables!", flush=True)

    ordered_tables = [t for t in TABLE_MIGRATION_ORDER if t in sqlite_tables]
    for t in sqlite_tables:
        if t not in ordered_tables:
            ordered_tables.append(t)

    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cursor = sqlite_conn.cursor()

    total_rows = 0
    with engine.connect() as pg_conn:
        for t_name in ordered_tables:
            count = source_counts.get(t_name, 0)
            if count == 0:
                continue
            if t_name not in target_metadata.tables:
                continue

            target_table = target_metadata.tables[t_name]
            target_cols = {c.name for c in target_table.columns}

            bool_cols = set()
            for col in target_table.columns:
                try:
                    if isinstance(col.type, Boolean) or getattr(col.type, "python_type", None) is bool:
                        bool_cols.add(col.name)
                except Exception:
                    if col.name.startswith("is_") or col.name.startswith("has_") or col.name.startswith("was_") or "verified" in col.name or "active" in col.name:
                        bool_cols.add(col.name)

            sqlite_cursor.execute(f'SELECT * FROM "{t_name}"')
            rows = sqlite_cursor.fetchall()

            batch = []
            for r in rows:
                row_dict = dict(r)
                filtered = {k: v for k, v in row_dict.items() if k in target_cols}
                for k, v in filtered.items():
                    if k in bool_cols and v is not None:
                        filtered[k] = bool(v)
                    elif isinstance(v, (dict, list)):
                        filtered[k] = json.dumps(v)
                batch.append(filtered)

            chunk_size = 1000
            inserted_count = 0
            for i in range(0, len(batch), chunk_size):
                chunk = batch[i:i + chunk_size]
                try:
                    pg_conn.execute(target_table.insert(), chunk)
                    pg_conn.commit()
                    inserted_count += len(chunk)
                except Exception:
                    pg_conn.rollback()
                    for single_r in chunk:
                        try:
                            pg_conn.execute(target_table.insert().values(**single_r))
                            pg_conn.commit()
                            inserted_count += 1
                        except Exception:
                            pg_conn.rollback()

            total_rows += inserted_count
            print(f"  [MIGRATED] {t_name:<36} : {inserted_count:>6} / {count:>6} rows", flush=True)

        print("\n[SEQUENCES] Synchronizing PostgreSQL ID sequences...", flush=True)
        for t_name in ordered_tables:
            if t_name in target_metadata.tables:
                try:
                    seq_query = text(f"""
                        SELECT setval(
                            pg_get_serial_sequence('"{t_name}"', 'id'),
                            COALESCE((SELECT MAX(id) FROM "{t_name}"), 1),
                            true
                        );
                    """)
                    pg_conn.execute(seq_query)
                    pg_conn.commit()
                except Exception:
                    pg_conn.rollback()

    sqlite_conn.close()
    print("=" * 70, flush=True)
    print(f"SUCCESS! Migration completed. Total records migrated: {total_rows:,}", flush=True)
    print("=" * 70, flush=True)

if __name__ == "__main__":
    main()
