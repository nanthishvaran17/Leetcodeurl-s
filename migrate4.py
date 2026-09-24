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

renames = [(f'q{q}_observed_active_seconds', f'q{q}_observed_seconds') for q in QS]

# Execute each DDL in its own connection/transaction to avoid cascade failures in PostgreSQL
for table in TABLES:
    for old_col, new_col in renames:
        try:
            with engine.connect() as conn:
                conn.execute(text(f'ALTER TABLE {table} RENAME COLUMN {old_col} TO {new_col};'))
                conn.commit()
                print(f'OK rename {old_col}->{new_col} on {table}')
        except Exception as ex:
            print(f'Skip rename {old_col} on {table}: {ex}')
    for col, dtype in new_cols:
        try:
            with engine.connect() as conn:
                conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {col} {dtype};'))
                conn.commit()
                print(f'OK add {col} on {table}')
        except Exception as ex:
            print(f'Skip {col} on {table}: {ex}')

print('Migration done')
