import sqlite3
import datetime
import sys
sys.path.insert(0, 'e:/Leetcode Web')
from backend.services.time_estimation_engine import estimate_question_times, SOURCE_ESTIMATED_DIFFICULTY_WEIGHT, SOURCE_UNAVAILABLE

def get_exit_time(entry_time_str, duration_mins):
    dt = datetime.datetime.strptime(entry_time_str, '%I:%M %p')
    dt += datetime.timedelta(minutes=duration_mins)
    return dt.strftime('%I:%M %p')

conn = sqlite3.connect('e:/Leetcode Web/data/leetcode_tracker.db', timeout=30.0)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

try:
    cursor.execute("SELECT id, q1, q2, q3, q4, q1_time_source FROM weekly_public_results WHERE session_id = 18")
    rows = cursor.fetchall()
    
    update_data = []
    
    for r in rows:
        if r['q1_time_source'] == 'OBSERVED_LIVE':
            continue
            
        solved_map = {1: bool(r['q1']), 2: bool(r['q2']), 3: bool(r['q3']), 4: bool(r['q4'])}
        solved_count = sum(1 for v in solved_map.values() if v)
        
        if solved_count == 0:
            continue
            
        duration = {4: 72, 3: 48, 2: 28, 1: 14}.get(solved_count, 90)
        entry_time = '08:02 AM'
        exit_time = get_exit_time(entry_time, duration)
        
        estimation = estimate_question_times(entry_time, exit_time, solved_map)
        
        row_updates = [
            'v1.0', 
            estimation['metadata']['timing_confidence'], 
            datetime.datetime.now(datetime.UTC).isoformat()
        ]
        
        for q in range(1, 5):
            qd = estimation.get(f'q{q}', {})
            source = qd.get('source', SOURCE_UNAVAILABLE)
            secs = qd.get('seconds')
            
            row_updates.append(None) # qX_observed_seconds
            
            if source == SOURCE_ESTIMATED_DIFFICULTY_WEIGHT and secs is not None:
                row_updates.append(secs)
                row_updates.append(source)
            else:
                row_updates.append(None)
                row_updates.append(SOURCE_UNAVAILABLE)
                
        row_updates.append(r['id'])
        update_data.append(tuple(row_updates))
        
    query = '''
    UPDATE weekly_public_results 
    SET 
        timing_calculation_version = ?,
        timing_confidence = ?,
        timing_calculated_at = ?,
        q1_observed_seconds = ?, q1_estimated_seconds = ?, q1_time_source = ?,
        q2_observed_seconds = ?, q2_estimated_seconds = ?, q2_time_source = ?,
        q3_observed_seconds = ?, q3_estimated_seconds = ?, q3_time_source = ?,
        q4_observed_seconds = ?, q4_estimated_seconds = ?, q4_time_source = ?
    WHERE id = ?
    '''
    cursor.executemany(query, update_data)
    conn.commit()
    print(f"Successfully updated {len(update_data)} rows in SQLite database!")
except Exception as e:
    print(e)
finally:
    conn.close()

# Also clear cache to reflect changes
try:
    from backend.cache import cache
    cache.clear()
    print("Cleared Uvicorn Cache")
except:
    pass
