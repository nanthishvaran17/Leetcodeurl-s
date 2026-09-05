import sys
import os
import time
import asyncio
import statistics
import functools
import httpx
from typing import Dict, List, Any
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from backend.database import SessionLocal
from backend.models import Student
from backend.leetcode_fetcher import fetch_leetcode_profile
from backend.sync_engine import sync_single_student_db

# Metrics storage
class Metrics:
    def __init__(self):
        self.auth_times = []
        self.lc_requests = []
        self.lc_total_time = []
        self.parse_times = []
        self.db_read_times = []
        self.db_write_times = []
        self.cache_times = []
        self.ws_times = []
        self.e2e_times = []
        self.external_req_count = []
        self.db_query_count = []
        self.db_write_count = []

metrics = Metrics()

# Monkey patch httpx to track external requests
original_client_post = httpx.AsyncClient.post
original_client_get = httpx.AsyncClient.get

async def patched_post(self, *args, **kwargs):
    t_start = time.perf_counter()
    res = await original_client_post(self, *args, **kwargs)
    t_end = time.perf_counter()
    metrics.lc_requests.append(t_end - t_start)
    return res

async def patched_get(self, *args, **kwargs):
    t_start = time.perf_counter()
    res = await original_client_get(self, *args, **kwargs)
    t_end = time.perf_counter()
    metrics.lc_requests.append(t_end - t_start)
    return res

httpx.AsyncClient.post = patched_post
httpx.AsyncClient.get = patched_get


async def measure_single_sync(student: Student, db, use_cache=False):
    t1 = time.perf_counter()  # Backend receives request
    
    # Mock Auth
    time.sleep(0.01) 
    t2 = time.perf_counter()  # Auth complete
    
    if not use_cache:
        import backend.leetcode_fetcher
        backend.leetcode_fetcher.clear_leetcode_cache(student.username)
        
    metrics.lc_requests = []
    
    t3 = time.perf_counter()  # First LeetCode request starts
    
    # Fetch Data
    try:
        data = await fetch_leetcode_profile(student.username)
    except Exception as e:
        print(f"Error fetching {student.username}: {e}")
        return
        
    t4 = time.perf_counter()  # Last LC response received
    
    # In leetcode_fetcher, parsing is part of the fetch. 
    # We will approximate parsing time as total fetch time minus raw network time
    total_lc_network = sum(metrics.lc_requests)
    metrics.external_req_count.append(len(metrics.lc_requests))
    
    t5 = time.perf_counter() # Parsing complete
    
    t6_start = time.perf_counter()
    # Mock DB read (already happened partly when getting the student, but let's measure sync_single_student_db)
    # Actually sync_single_student_db does a DB read
    
    try:
        t7_start = time.perf_counter()
        sync_single_student_db(student.id, data, db)
        t7 = time.perf_counter() # DB Write complete
    except Exception as e:
        print(f"DB Error for {student.username}: {e}")
        return
        
    t8 = time.perf_counter() # Cache complete
    
    # Mock WS
    time.sleep(0.005)
    t9 = time.perf_counter() # WS sent
    
    metrics.auth_times.append(t2 - t1)
    metrics.lc_total_time.append(t4 - t3)
    metrics.parse_times.append((t4 - t3) - total_lc_network)
    metrics.db_read_times.append(t7_start - t6_start) # Approximation
    metrics.db_write_times.append(t7 - t7_start)
    metrics.e2e_times.append(t9 - t1)


async def run_audit():
    db = SessionLocal()
    students = db.query(Student).filter(Student.username != None, Student.username != "").limit(50).all()
    
    print(f"Running audit on {len(students)} students...")
    
    # Run 10 syncs (Cold Cache)
    print("--- 10 SYNCS (COLD CACHE) ---")
    metrics.__init__()
    for s in students[:10]:
        await measure_single_sync(s, db, use_cache=False)
        
    print(f"Avg E2E: {statistics.mean(metrics.e2e_times)*1000:.2f}ms")
    print(f"Avg LC Fetch: {statistics.mean(metrics.lc_total_time)*1000:.2f}ms")
    print(f"Avg DB Write: {statistics.mean(metrics.db_write_times)*1000:.2f}ms")
    print(f"External requests per user: {statistics.mean(metrics.external_req_count):.1f}")
    
    # Run 50 syncs (Cold Cache)
    print("\n--- 50 SYNCS (COLD CACHE) ---")
    metrics.__init__()
    for s in students:
        await measure_single_sync(s, db, use_cache=False)
        
    print(f"Avg E2E: {statistics.mean(metrics.e2e_times)*1000:.2f}ms")
    print(f"Min E2E: {min(metrics.e2e_times)*1000:.2f}ms")
    print(f"Max E2E: {max(metrics.e2e_times)*1000:.2f}ms")
    print(f"p95 E2E: {statistics.quantiles(metrics.e2e_times, n=100)[94]*1000:.2f}ms")
    
    # Concurrent 50 syncs
    print("\n--- 50 CONCURRENT SYNCS ---")
    metrics.__init__()
    start = time.perf_counter()
    tasks = [measure_single_sync(s, db, use_cache=False) for s in students]
    await asyncio.gather(*tasks)
    end = time.perf_counter()
    print(f"Total concurrent 50 syncs time: {(end - start):.2f}s")
    print(f"External requests per user: {statistics.mean(metrics.external_req_count):.1f}")

    db.close()

if __name__ == "__main__":
    asyncio.run(run_audit())
