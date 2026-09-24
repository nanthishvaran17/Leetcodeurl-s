from backend.database import SessionLocal
from backend.models import WeeklyPublicResult

db = SessionLocal()
try:
    result = db.query(WeeklyPublicResult).filter(
        WeeklyPublicResult.session_id == 18,
        WeeklyPublicResult.student_id == 5
    ).first()
    print(f'q1={result.q1}')
    print(f'q1_observed_active_seconds={result.q1_observed_active_seconds}')
    print(f'q2={result.q2}')
    print(f'q2_observed_active_seconds={result.q2_observed_active_seconds}')
    
    # Simulate what backend returns
    obs1 = getattr(result, 'q1_observed_active_seconds', None)
    print(f'API will return q1 as: {obs1 or result.q1}')
    obs2 = getattr(result, 'q2_observed_active_seconds', None)
    print(f'API will return q2 as: {obs2 or result.q2}')
    print(f'formatQTime(660) => 11m 0s')
    print(f'formatQTime(1020) => 17m 0s')
finally:
    db.close()
