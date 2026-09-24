from backend.database import engine
from sqlalchemy import text
try:
    with engine.connect() as conn:
        for table in ['weekly_public_results', 'previous_week_participation_records']:
            for col in ['q1_time', 'q2_time', 'q3_time', 'q4_time']:
                try:
                    conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {col} INTEGER;'))
                except Exception as ex:
                    print(f"Skipping {col} on {table}: {ex}")
        conn.commit()
    print('Done')
except Exception as e:
    print(e)
