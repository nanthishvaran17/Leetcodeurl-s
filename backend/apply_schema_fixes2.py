import os
import sys
import logging

# Ensure models can be imported if needed
root_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, root_dir)

logging.basicConfig(level=logging.INFO, format="[SCHEMA_FIX] %(message)s")
logger = logging.getLogger(__name__)

def apply_fixes():
    try:
        from sqlalchemy import create_engine, text
        from database import db_url
        
        logger.info(f"Connecting to {db_url.split('@')[-1] if '@' in db_url else db_url}")
        
        engine = create_engine(db_url)
        with engine.connect() as conn:
            logger.info("Applying missing schema fixes to database...")

            # 1. Add missing column to weekly_session_snapshots
            try:
                conn.execute(text("ALTER TABLE weekly_session_snapshots ADD COLUMN is_sequence_broken BOOLEAN DEFAULT FALSE"))
                logger.info("  ✓ weekly_session_snapshots.is_sequence_broken added")
            except Exception as e:
                if 'duplicate column name' in str(e).lower() or 'already exists' in str(e).lower():
                    logger.info("  ✓ weekly_session_snapshots.is_sequence_broken already exists")
                else:
                    logger.warning(f"  ? weekly_session_snapshots.is_sequence_broken issue: {e}")
                    
            # 2. Add missing column to student_contest_participations
            try:
                conn.execute(text("ALTER TABLE student_contest_participations ADD COLUMN official_attendance_state VARCHAR(30)"))
                logger.info("  ✓ student_contest_participations.official_attendance_state added")
            except Exception as e:
                if 'duplicate column name' in str(e).lower() or 'already exists' in str(e).lower():
                    logger.info("  ✓ student_contest_participations.official_attendance_state already exists")
                else:
                    logger.warning(f"  ? student_contest_participations.official_attendance_state issue: {e}")

            conn.commit()
            logger.info("Schema fixes applied successfully.")

        engine.dispose()

    except Exception as e:
        logger.error(f"Schema fix failed: {e}")

if __name__ == "__main__":
    apply_fixes()
