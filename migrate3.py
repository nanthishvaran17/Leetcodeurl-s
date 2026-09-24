from backend.database import engine
from sqlalchemy import text

TABLES = ['contest_problem_results', 'weekly_public_results', 'previous_week_participation_records']
QS = [1, 2, 3, 4]

new_cols = []
for q in QS:
    new_cols.append((f'q{q}_observed_seconds', 'INTEGER'))
    new_cols.append((f'q{q}_estimated_seconds', 'INTEGER'))
    new_cols.append((f'q{q}_time_source', 'VARCHAR(50)'))

new_cols += [
    ('timing_calculation_version', 'VARCHAR(20)'),
    ('timing_calculated_at', 'TIMESTAMP'),
    ('timing_confidence', 'VARCHAR(20)'),
]

with engine.connect() as conn:
    for table in TABLES:
        # 1. Rename observed_active_seconds -> observed_seconds
        for q in QS:
            try:
                conn.execute(text(f'ALTER TABLE {table} RENAME COLUMN q{q}_observed_active_seconds TO q{q}_observed_seconds;'))
                print(f'Renamed q{q}_observed_active_seconds in {table}')
            except Exception as ex:
                print(f'Skip rename q{q} in {table}: {ex}')
        # 2. Add new columns
        for col, dtype in new_cols:
            try:
                conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {col} {dtype};'))
                print(f'Added {col} to {table}')
            except Exception as ex:
                print(f'Skip {col} on {table}: {ex}')
    conn.commit()
print('Migration complete')
