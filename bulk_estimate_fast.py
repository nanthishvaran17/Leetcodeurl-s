import sys
import datetime
import os
from dotenv import load_dotenv

sys.path.insert(0, 'e:/Leetcode Web')
load_dotenv('e:/Leetcode Web/.env')

from backend.database import SessionLocal, engine
from backend.models import WeeklyPublicResult
from backend.services.time_estimation_engine import estimate_question_times, SOURCE_ESTIMATED_DIFFICULTY_WEIGHT, SOURCE_UNAVAILABLE
from sqlalchemy import text

def get_exit_time(entry_time_str, duration_mins):
    dt = datetime.datetime.strptime(entry_time_str, '%I:%M %p')
    dt += datetime.timedelta(minutes=duration_mins)
    return dt.strftime('%I:%M %p')

db = SessionLocal()
try:
    results = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id==18).all()
    count = 0
    
    update_data = []
    
    for r in results:
        if r.q1_time_source == 'OBSERVED_LIVE' or r.q1_time_source == 'ESTIMATED_DIFFICULTY_WEIGHT':
            continue
            
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
        
        row_dict = {
            'pid': r.id,
            'calc_ver': 'v1.0',
            'calc_conf': estimation['metadata']['timing_confidence'],
            'calc_at': datetime.datetime.now(datetime.UTC)
        }
        
        for q in range(1, 5):
            qd = estimation.get(f'q{q}', {})
            source = qd.get('source', SOURCE_UNAVAILABLE)
            secs = qd.get('seconds')
            
            row_dict[f'q{q}_obs'] = None
            if source == SOURCE_ESTIMATED_DIFFICULTY_WEIGHT and secs is not None:
                row_dict[f'q{q}_est'] = secs
                row_dict[f'q{q}_src'] = source
            else:
                row_dict[f'q{q}_est'] = None
                row_dict[f'q{q}_src'] = SOURCE_UNAVAILABLE
                
        update_data.append(row_dict)
        count += 1

    if update_data:
        # bulk update
        stmt = text('''
            UPDATE weekly_public_results 
            SET 
                timing_calculation_version = :calc_ver,
                timing_confidence = :calc_conf,
                timing_calculated_at = :calc_at,
                q1_observed_seconds = :q1_obs, q1_estimated_seconds = :q1_est, q1_time_source = :q1_src,
                q2_observed_seconds = :q2_obs, q2_estimated_seconds = :q2_est, q2_time_source = :q2_src,
                q3_observed_seconds = :q3_obs, q3_estimated_seconds = :q3_est, q3_time_source = :q3_src,
                q4_observed_seconds = :q4_obs, q4_estimated_seconds = :q4_est, q4_time_source = :q4_src
            WHERE id = :pid
        ''')
        db.execute(stmt, update_data)
        db.commit()
        print(f"Successfully bulk updated {count} records in Postgres!")
    else:
        print("No records needed updating.")
finally:
    db.close()

try:
    from backend.cache import cache
    cache.clear()
    print("Cleared Uvicorn Cache")
except:
    pass
