from backend.database import engine
from sqlalchemy import text
try:
    with engine.connect() as conn:
        for table in ['contest_problem_results', 'weekly_public_results', 'previous_week_participation_records']:
            for q in [1, 2, 3, 4]:
                try:
                    conn.execute(text(f'ALTER TABLE {table} RENAME COLUMN q{q}_time TO q{q}_observed_active_seconds;'))
                except Exception as ex:
                    print(f"Skipping q{q}_time on {table}: {ex}")
        conn.commit()
    print('Done')
except Exception as e:
    print(e)
