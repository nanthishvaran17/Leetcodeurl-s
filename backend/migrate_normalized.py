"""
migrate_normalized.py — Create canonical normalized LeetCode tables.
Safe to run on a live DB: uses checkfirst=True, never drops existing tables.
"""
import sys
sys.path.insert(0, ".")

from backend.database import Base, engine
# Import all models so they register with Base.metadata
import backend.models  # noqa: F401

print("Running canonical LeetCode schema migration...")
tables_before = set(engine.dialect.get_table_names(engine.connect()))

# Create only NEW tables; existing tables are untouched
Base.metadata.create_all(bind=engine, checkfirst=True)

tables_after = set(engine.dialect.get_table_names(engine.connect()))
new_tables = tables_after - tables_before

target_tables = {
    "lc_profiles", "lc_problem_stats", "lc_contest_standing",
    "lc_contest_rating_history", "lc_badges", "lc_language_stats",
    "lc_topic_stats", "lc_activity", "lc_submissions"
}

print(f"\nNew tables created: {sorted(new_tables) or 'none (all already existed)'}")
print()
for t in sorted(target_tables):
    exists = t in tables_after
    status = "OK" if exists else "MISSING"
    print(f"  [{status}] {t}")

missing = target_tables - tables_after
if missing:
    print(f"\nERROR: Tables not created: {missing}")
    sys.exit(1)
else:
    print("\nMigration complete. All canonical tables exist.")
