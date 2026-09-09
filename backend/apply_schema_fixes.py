"""
Standalone synchronous schema migration script.
Run BEFORE alembic and uvicorn to ensure critical columns exist.
Fully idempotent — safe to run on every deploy.
"""
import os
import sys
import logging

logging.basicConfig(level=logging.INFO, format="[SCHEMA_FIX] %(message)s")
logger = logging.getLogger(__name__)

def apply_fixes():
    try:
        from sqlalchemy import create_engine, text

        database_url = os.environ.get("DATABASE_URL")
        if not database_url:
            logger.warning("DATABASE_URL not set — skipping schema fixes.")
            return

        engine = create_engine(database_url)
        with engine.connect() as conn:
            logger.info("Applying idempotent schema fixes to production database...")

            # 1. Add missing columns to students table
            conn.execute(text("""
                ALTER TABLE students
                    ADD COLUMN IF NOT EXISTS primary_leetcode_id VARCHAR(100),
                    ADD COLUMN IF NOT EXISTS secondary_leetcode_id VARCHAR(100),
                    ADD COLUMN IF NOT EXISTS secondary_status VARCHAR(50) DEFAULT 'none'
            """))
            logger.info("  ✓ students.primary_leetcode_id / secondary_leetcode_id / secondary_status")

            # 2. Backfill primary_leetcode_id from username
            result = conn.execute(text("""
                UPDATE students
                SET primary_leetcode_id = username
                WHERE primary_leetcode_id IS NULL AND username IS NOT NULL
            """))
            logger.info(f"  ✓ Backfilled primary_leetcode_id for {result.rowcount} students")

            # 3. Indexes (CREATE INDEX IF NOT EXISTS is a no-op if already exists)
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_students_primary_leetcode_id
                ON students (primary_leetcode_id)
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_students_secondary_leetcode_id
                ON students (secondary_leetcode_id)
            """))
            logger.info("  ✓ Indexes on primary/secondary_leetcode_id")

            # 4. weekly_verification_records table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS weekly_verification_records (
                    id SERIAL PRIMARY KEY,
                    student_id INTEGER NOT NULL REFERENCES students(id),
                    verification_week INTEGER NOT NULL,
                    notification_type VARCHAR(50) NOT NULL,
                    primary_solved INTEGER,
                    secondary_solved INTEGER,
                    status VARCHAR(30),
                    email_dispatched BOOLEAN,
                    timestamp TIMESTAMP,
                    CONSTRAINT uq_weekly_verification_record
                        UNIQUE (student_id, verification_week, notification_type)
                )
            """))
            logger.info("  ✓ weekly_verification_records table")

            # 5. Missing columns from recent updates
            conn.execute(text("""
                ALTER TABLE weekly_session_snapshots
                    ADD COLUMN IF NOT EXISTS is_sequence_broken BOOLEAN DEFAULT FALSE
            """))
            logger.info("  ✓ weekly_session_snapshots.is_sequence_broken")
            
            conn.execute(text("""
                ALTER TABLE student_contest_participations
                    ADD COLUMN IF NOT EXISTS official_attendance_state VARCHAR(30)
            """))
            logger.info("  ✓ student_contest_participations.official_attendance_state")

            conn.commit()
            logger.info("Schema fixes applied successfully — all columns verified.")

        engine.dispose()

    except Exception as e:
        logger.error(f"Schema fix failed: {e}")
        # Do NOT exit(1) — let alembic try next, don't block the deploy
        sys.exit(0)

if __name__ == "__main__":
    apply_fixes()
