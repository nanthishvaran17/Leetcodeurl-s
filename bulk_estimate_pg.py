import sys
import datetime
import os
from dotenv import load_dotenv

sys.path.insert(0, 'e:/Leetcode Web')
load_dotenv('e:/Leetcode Web/.env')

from backend.database import SessionLocal
from backend.models import WeeklyPublicResult
from backend.services.time_estimation_engine import estimate_question_times, SOURCE_ESTIMATED_DIFFICULTY_WEIGHT, SOURCE_UNAVAILABLE

def get_exit_time(entry_time_str, duration_mins):
    dt = datetime.datetime.strptime(entry_time_str, '%I:%M %p')
    dt += datetime.timedelta(minutes=duration_mins)
    return dt.strftime('%I:%M %p')

db = SessionLocal()
try:
    results = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id==18).all()
    count = 0
    updated = 0
    print(f"Found {len(results)} users in Session 18")
    for r in results:
        # Don't overwrite if they have real observed time
        if r.q1_time_source == 'OBSERVED_LIVE' or r.q1_time_source == 'ESTIMATED_DIFFICULTY_WEIGHT':
            # Skip if we already estimated them OR if they are observed live
            pass
            
        solved_count = 0
        solved_map = {1: False, 2: False, 3: False, 4: False}
        if getattr(r, 'q1', 0): solved_map[1] = True; solved_count += 1
        if getattr(r, 'q2', 0): solved_map[2] = True; solved_count += 1
        if getattr(r, 'q3', 0): solved_map[3] = True; solved_count += 1
        if getattr(r, 'q4', 0): solved_map[4] = True; solved_count += 1
        
        if solved_count == 0:
            continue
            
        duration = {4: 72, 3: 48, 2: 28, 1: 14}.get(solved_count, 90)
        entry_time = '08:02 AM'
        exit_time = get_exit_time(entry_time, duration)
        
        estimation = estimate_question_times(entry_time, exit_time, solved_map)
        
        for q in range(1, 5):
            qd = estimation.get(f'q{q}', {})
            source = qd.get('source', SOURCE_UNAVAILABLE)
            secs = qd.get('seconds')
            
            # Wipe old incorrect manual observed times
            setattr(r, f'q{q}_observed_seconds', None)
            
            if source == SOURCE_ESTIMATED_DIFFICULTY_WEIGHT and secs is not None:
                setattr(r, f'q{q}_estimated_seconds', secs)
                setattr(r, f'q{q}_time_source', source)
            else:
                setattr(r, f'q{q}_time_source', SOURCE_UNAVAILABLE)
                
        r.timing_calculation_version = 'v1.0'
        r.timing_confidence = estimation['metadata']['timing_confidence']
        r.timing_calculated_at = datetime.datetime.now(datetime.UTC)
        updated += 1
        
        if updated % 50 == 0:
            db.commit()
            print(f"Committed {updated} records")
            
    db.commit()
    print(f'Successfully ran estimation engine and updated {updated} users in Session 18')
finally:
    db.close()

try:
    from backend.cache import cache
    cache.clear()
    print("Cleared Uvicorn Cache")
except:
    pass
