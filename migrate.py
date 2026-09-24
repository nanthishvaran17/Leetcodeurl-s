from backend.database import engine
from sqlalchemy import text
try:
    with engine.connect() as conn:
        conn.execute(text('ALTER TABLE contest_problem_results ADD COLUMN q1_time INTEGER;'))
        conn.execute(text('ALTER TABLE contest_problem_results ADD COLUMN q2_time INTEGER;'))
        conn.execute(text('ALTER TABLE contest_problem_results ADD COLUMN q3_time INTEGER;'))
        conn.execute(text('ALTER TABLE contest_problem_results ADD COLUMN q4_time INTEGER;'))
        conn.commit()
    print('Done')
except Exception as e:
    print(e)
