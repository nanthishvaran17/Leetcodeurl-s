#!/usr/bin/env python3
"""
Fix and synchronize all PostgreSQL primary key sequences with MAX(id).
Can be run locally or in GitHub Actions against Supabase / Neon / PostgreSQL.
"""
import os
import sys

# Ensure root directory is on PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import sqlalchemy
from sqlalchemy import text
from backend.database import engine, db_url

def fix_all_sequences():
    if "postgresql" not in db_url and "postgres" not in db_url:
        print(f"[SKIP] Current database is not PostgreSQL ({db_url}). No sequences to synchronize.")
        return

    print(f"[SEQ_SYNC] Connecting to PostgreSQL database...")
    fixed_count = 0

    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        # 1. Run dynamic DO block across all public tables with primary key
        try:
            print("[SEQ_SYNC] Running dynamic schema-wide sequence synchronization...")
            conn.execute(text("""
                DO $$
                DECLARE
                    rec RECORD;
                    max_id BIGINT;
                    seq_name TEXT;
                BEGIN
                    FOR rec IN 
                        SELECT 
                            tc.table_name, 
                            kcu.column_name
                        FROM information_schema.table_constraints tc
                        JOIN information_schema.key_column_usage kcu 
                            ON tc.constraint_name = kcu.constraint_name
                            AND tc.table_schema = kcu.table_schema
                        WHERE tc.constraint_type = 'PRIMARY KEY'
                          AND tc.table_schema = 'public'
                    LOOP
                        BEGIN
                            seq_name := pg_get_serial_sequence(quote_ident(rec.table_name), rec.column_name);
                            IF seq_name IS NOT NULL THEN
                                EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM %I', rec.column_name, rec.table_name) INTO max_id;
                                IF max_id > 0 THEN
                                    EXECUTE format('SELECT setval(%L, %s, true)', seq_name, max_id);
                                ELSE
                                    EXECUTE format('SELECT setval(%L, 1, false)', seq_name);
                                END IF;
                            END IF;
                        EXCEPTION WHEN OTHERS THEN
                            NULL;
                        END;
                    END LOOP;
                END $$;
            """))
            print("[SEQ_SYNC] Dynamic sequence sync completed.")
        except Exception as e:
            print(f"[SEQ_SYNC] Dynamic sync warning: {e}")

        # 2. Explicit alignment and verification for all known tables
        explicit_seq_tables = [
            "departments", "students", "users", "weekly_sessions", "student_contest_participations",
            "lc_topic_stats", "lc_language_stats", "student_stat_snapshots", "student_badges",
            "weekly_public_results", "weekly_virtual_results", "weekly_student_progress",
            "official_weekly_snapshots", "scheduled_job_executions", "faculty_action_audit_logs",
            "faculty_student_assignments", "public_contest_sync_audits", "email_otp_records",
            "email_dispatch_logs", "verification_notifications", "weekly_verification_records",
            "weekly_report_audits", "conversations", "messages", "sync_jobs", "sync_job_items",
            "staff_alerts", "staff_follow_ups", "student_weekly_targets", "report_cache",
            "certificate_records", "admin_sessions", "lc_activity", "lc_submissions",
            "lc_contest_rating_history", "lc_problem_stats", "leetcode_profile_stats"
        ]

        print(f"[SEQ_SYNC] Verifying {len(explicit_seq_tables)} core application tables...")
        for t_name in explicit_seq_tables:
            try:
                # Check if table exists
                has_tbl = conn.execute(text(f"""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' AND table_name = '{t_name}'
                    );
                """)).scalar()
                if not has_tbl:
                    continue

                res = conn.execute(text(f"""
                    SELECT 
                        pg_get_serial_sequence('"{t_name}"', 'id') AS seq,
                        COALESCE(MAX(id), 0) AS max_id
                    FROM "{t_name}";
                """)).fetchone()

                if res and res.seq:
                    seq_name = res.seq
                    max_id = res.max_id
                    if max_id > 0:
                        conn.execute(text(f"SELECT setval('{seq_name}', {max_id}, true);"))
                        # Verify nextval
                        curr = conn.execute(text(f"SELECT last_value FROM {seq_name};")).scalar()
                        print(f"  ✓ {t_name:<35} -> sequence {seq_name} aligned to {curr} (max_id: {max_id})")
                    else:
                        conn.execute(text(f"SELECT setval('{seq_name}', 1, false);"))
                        print(f"  ✓ {t_name:<35} -> empty table, sequence reset to 1")
                    fixed_count += 1
            except Exception as ex:
                print(f"  ⚠ {t_name:<35} note: {ex}")

    print(f"\n[SEQ_SYNC] Successfully verified and aligned {fixed_count} sequences.")

if __name__ == "__main__":
    fix_all_sequences()
