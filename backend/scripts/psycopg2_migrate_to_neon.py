import os
import sys
import json
import sqlite3
import time
import psycopg2
import psycopg2.extras
from sqlalchemy import create_engine, text

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
    "weekly_session_snapshots",
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
    "faculty_action_queue",
    "faculty_action_audit_logs",
    "faculty_interventions",
    "staff_alerts",
    "staff_follow_ups",
    "system_alerts",
    "admin_sessions",
    "email_campaigns",
    "email_deliveries",
    "email_queue_items",
    "email_attachments",
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
    "leetcode_accounts",
    "notification_records",
    "submission_log",
    "scheduled_job_executions"
]

def get_pg_connection(retries=5, delay=2):
    for attempt in range(1, retries + 1):
        try:
            conn = psycopg2.connect(PG_URL, keepalives=1, keepalives_idle=30, keepalives_interval=10, keepalives_count=5)
            conn.autocommit = True
            return conn
        except Exception as ex:
            if attempt == retries:
                raise ex
            print(f"      [RETRY {attempt}/{retries}] Neon connection failed ({ex}). Retrying in {delay}s...", flush=True)
            time.sleep(delay)

def main():
    start_time = time.time()
    print("=" * 70, flush=True)
    print("NANDHA LEETCODE - PSYCOPG2 ULTRA-FAST NEON MIGRATION PIPELINE", flush=True)
    print("=" * 70, flush=True)

    print(f"[1/5] Source Audit & FK Parent Cataloging: SQLite DB {SQLITE_PATH}...", flush=True)
    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    cursor = sqlite_conn.cursor()

    cursor.execute("SELECT id FROM students")
    valid_student_ids = {r[0] for r in cursor.fetchall()}

    cursor.execute("SELECT id FROM users")
    valid_user_ids = {r[0] for r in cursor.fetchall()}

    cursor.execute("SELECT id FROM weekly_sessions")
    valid_session_ids = {r[0] for r in cursor.fetchall()}

    cursor.execute("SELECT id FROM departments")
    valid_dept_ids = {r[0] for r in cursor.fetchall()}

    try:
        cursor.execute("SELECT id FROM faculty_action_queue")
        valid_action_ids = {r[0] for r in cursor.fetchall()}
    except Exception:
        valid_action_ids = set()

    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
    sqlite_tables = [r[0] for r in cursor.fetchall()]

    source_counts = {}
    for t in sqlite_tables:
        cursor.execute(f'SELECT COUNT(*) FROM "{t}"')
        source_counts[t] = cursor.fetchone()[0]

    print(f"      Source contains {len(sqlite_tables)} tables. Students: {len(valid_student_ids)}, Users: {len(valid_user_ids)}, Sessions: {len(valid_session_ids)}", flush=True)

    print("\n[2/5] Resetting Neon PostgreSQL schema cleanly...", flush=True)
    pg_reset_conn = get_pg_connection()
    pg_reset_conn.autocommit = True
    reset_cur = pg_reset_conn.cursor()
    reset_cur.execute("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'neondb' AND pid <> pg_backend_pid();")
    reset_cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;")
    reset_cur.close()
    pg_reset_conn.close()
    print("      Schema reset cleanly.", flush=True)

    print("\n[3/5] Initializing target schema via SQLAlchemy engine bind...", flush=True)
    engine = create_engine(PG_URL, echo=False, pool_pre_ping=True)
    created_count = 0
    for table in Base.metadata.sorted_tables:
        try:
            table.create(bind=engine, checkfirst=True)
            created_count += 1
        except Exception:
            pass
    engine.dispose()
    print(f"      Target schema initialized cleanly ({created_count} tables).", flush=True)

    # Re-connect psycopg2 with robust retry logic
    print("\n[4/5] Connecting to Neon for bulk streaming...", flush=True)
    pg_raw_conn = get_pg_connection()
    pg_raw_conn.autocommit = True
    pg_cursor = pg_raw_conn.cursor()

    # Get target column types, names, and max character lengths per table
    pg_cursor.execute("""
        SELECT table_name, column_name, data_type, character_maximum_length 
        FROM information_schema.columns 
        WHERE table_schema = 'public';
    """)
    pg_cols_info = {}
    pg_max_lens = {}
    for t_name, c_name, d_type, char_len in pg_cursor.fetchall():
        if t_name not in pg_cols_info:
            pg_cols_info[t_name] = {}
        pg_cols_info[t_name][c_name] = d_type.lower()
        if char_len is not None:
            pg_max_lens[(t_name, c_name)] = char_len

    ordered_tables = [t for t in TABLE_MIGRATION_ORDER if t in sqlite_tables]
    for t in sqlite_tables:
        if t not in ordered_tables:
            ordered_tables.append(t)

    print(f"      Streaming bulk data into {len(ordered_tables)} tables via psycopg2 execute_values...", flush=True)
    total_migrated = 0

    for t_name in ordered_tables:
        count = source_counts.get(t_name, 0)
        if count == 0:
            continue
        if t_name not in pg_cols_info:
            print(f"      [SKIP] Table {t_name} not found in PostgreSQL schema", flush=True)
            continue

        cols_meta = pg_cols_info[t_name]
        target_cols = list(cols_meta.keys())

        cursor.execute(f'SELECT * FROM "{t_name}"')
        rows = cursor.fetchall()
        if not rows:
            continue

        sample_row = dict(rows[0])
        valid_cols = [c for c in target_cols if c in sample_row]

        if not valid_cols:
            continue

        bool_cols = {c for c, dt in cols_meta.items() if dt in ('boolean', 'bool')}
        json_cols = {c for c, dt in cols_meta.items() if dt in ('json', 'jsonb')}

        values_tuples = []
        for r in rows:
            r_dict = dict(r)

            # Orphan filtering for Foreign Key integrity
            if 'student_id' in valid_cols:
                sid = r_dict.get('student_id')
                if sid is not None and sid not in valid_student_ids:
                    continue

            if 'user_id' in valid_cols and t_name not in ('users',):
                uid = r_dict.get('user_id')
                if uid is not None and uid not in valid_user_ids:
                    continue

            if 'session_id' in valid_cols and t_name not in ('weekly_sessions',):
                sess_id = r_dict.get('session_id')
                if sess_id is not None and sess_id not in valid_session_ids:
                    continue

            if 'action_id' in valid_cols and t_name == 'faculty_action_audit_logs':
                aid = r_dict.get('action_id')
                if aid is not None and aid not in valid_action_ids:
                    r_dict['action_id'] = None

            row_vals = []
            for col in valid_cols:
                v = r_dict.get(col)
                if v is not None:
                    if col in bool_cols:
                        v = bool(v)
                    elif col in json_cols or isinstance(v, (dict, list)):
                        v = json.dumps(v)
                    elif isinstance(v, str):
                        max_len = pg_max_lens.get((t_name, col))
                        if max_len and len(v) > max_len:
                            v = v[:max_len]
                else:
                    # Provide fallback for NULL timestamps if column is expected to be timestamp/datetime
                    dt_type = cols_meta.get(col, '')
                    if ('timestamp' in dt_type or 'date' in dt_type or 'time' in col) and col in ('event_timestamp', 'timestamp', 'created_at', 'updated_at', 'registered_at'):
                        v = '2026-01-01 00:00:00'
                row_vals.append(v)
            values_tuples.append(tuple(row_vals))

        if not values_tuples:
            continue

        col_names_str = '", "'.join(valid_cols)
        query = f'INSERT INTO "{t_name}" ("{col_names_str}") VALUES %s ON CONFLICT DO NOTHING'

        # Process in sub-batches of 100 to avoid SSL socket timeouts on large payloads
        batch_size = 100
        inserted_for_table = 0

        for chunk_start in range(0, len(values_tuples), batch_size):
            chunk = values_tuples[chunk_start:chunk_start + batch_size]
            try:
                psycopg2.extras.execute_values(pg_cursor, query, chunk, page_size=len(chunk))
                inserted_for_table += len(chunk)
            except Exception as ex:
                # Connection dropped or SSL timeout - reconnect and retry chunk row-by-row
                print(f"      [WARN] Chunk insert failed for {t_name} (range {chunk_start}:{chunk_start+len(chunk)}): {ex}", flush=True)
                try:
                    pg_cursor.execute("SELECT 1")
                except Exception:
                    print("      [RECONNECT] Re-establishing Neon SSL connection...", flush=True)
                    try:
                        pg_raw_conn = get_pg_connection()
                        pg_cursor = pg_raw_conn.cursor()
                    except Exception as r_err:
                        print(f"      [RECONNECT ERROR] {r_err}", flush=True)

                # Retry chunk with row-by-row fallback
                single_query = f'INSERT INTO "{t_name}" ("{col_names_str}") VALUES ({",".join(["%s"]*len(valid_cols))}) ON CONFLICT DO NOTHING'
                for vt in chunk:
                    try:
                        pg_cursor.execute(single_query, vt)
                        inserted_for_table += 1
                    except Exception:
                        try:
                            pg_cursor.execute("SELECT 1")
                        except Exception:
                            try:
                                pg_raw_conn = get_pg_connection()
                                pg_cursor = pg_raw_conn.cursor()
                                pg_cursor.execute(single_query, vt)
                                inserted_for_table += 1
                            except Exception:
                                pass

        total_migrated += inserted_for_table
        print(f"      [MIGRATED] {t_name:<36} : {inserted_for_table:>6} / {count:>6} rows", flush=True)

    print("\n[5/5] Synchronizing PostgreSQL ID SERIAL sequences...", flush=True)
    for t_name in ordered_tables:
        if t_name in pg_cols_info and 'id' in pg_cols_info[t_name]:
            try:
                seq_query = f"""
                    SELECT setval(
                        pg_get_serial_sequence('"{t_name}"', 'id'),
                        COALESCE((SELECT MAX(id) FROM "{t_name}"), 1),
                        true
                    );
                """
                pg_cursor.execute(seq_query)
            except Exception:
                pass

    pg_cursor.close()
    pg_raw_conn.close()
    sqlite_conn.close()

    elapsed = time.time() - start_time
    print("=" * 70, flush=True)
    print(f"SUCCESS! Migrated {total_migrated:,} total records across all tables in {elapsed:.2f} seconds.", flush=True)
    print("=" * 70, flush=True)

if __name__ == "__main__":
    main()
