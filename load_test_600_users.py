import asyncio
import aiohttp
import time
import statistics
import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

API_BASE = "http://127.0.0.1:8000"

async def simulate_user(session, user_id):
    results = {}
    
    # 1. Health check
    t0 = time.perf_counter()
    async with session.get(f"{API_BASE}/api/health") as resp:
        await resp.read()
        results["health"] = (time.perf_counter() - t0) * 1000
        
    # 2. Fast Leaderboard (top 20)
    t0 = time.perf_counter()
    async with session.get(f"{API_BASE}/api/students/leaderboard-fast?limit=20") as resp:
        await resp.read()
        results["leaderboard_top20"] = (time.perf_counter() - t0) * 1000

    # 3. Student Search
    search_term = "Ajay" if user_id % 2 == 0 else "Kumar"
    t0 = time.perf_counter()
    async with session.get(f"{API_BASE}/api/students?search={search_term}&limit=10") as resp:
        await resp.read()
        results["search"] = (time.perf_counter() - t0) * 1000

    # 4. Upcoming Contest Session
    t0 = time.perf_counter()
    async with session.get(f"{API_BASE}/api/contests/upcoming-session") as resp:
        await resp.read()
        results["contest_session"] = (time.perf_counter() - t0) * 1000

    # 5. Department Analytics Comparison
    t0 = time.perf_counter()
    async with session.get(f"{API_BASE}/api/analytics/department-comparison") as resp:
        await resp.read()
        results["analytics"] = (time.perf_counter() - t0) * 1000
        
    return results

async def run_600_user_simulation(concurrency=600):
    print("=" * 80)
    print(f"🔥 SIMULATING {concurrency} CONCURRENT USERS REAL-WORLD MIXED WORKLOAD")
    print("=" * 80)
    
    start_time = time.time()
    async with aiohttp.ClientSession() as session:
        tasks = [simulate_user(session, i) for i in range(concurrency)]
        all_results = await asyncio.gather(*tasks, return_exceptions=True)
        
    total_duration = time.time() - start_time
    
    metrics = {
        "health": [],
        "leaderboard_top20": [],
        "search": [],
        "contest_session": [],
        "analytics": []
    }
    
    success_count = 0
    error_count = 0
    
    for res in all_results:
        if isinstance(res, dict):
            success_count += 1
            for k, v in res.items():
                metrics[k].append(v)
        else:
            error_count += 1
            
    print(f"Completed {concurrency} concurrent user flows in {total_duration:.2f} seconds.")
    print(f"Success Users: {success_count} | Errors: {error_count}")
    print("-" * 80)
    print(f"{'Endpoint / Action':25} | {'P50 (ms)':10} | {'P95 (ms)':10} | {'P99 (ms)':10} | {'Avg (ms)':10}")
    print("-" * 80)
    
    summary = {}
    for name, latencies in metrics.items():
        if latencies:
            latencies.sort()
            p50 = latencies[int(len(latencies) * 0.50)]
            p95 = latencies[int(len(latencies) * 0.95)]
            p99 = latencies[int(len(latencies) * 0.99)]
            avg = statistics.mean(latencies)
            summary[name] = {"p50": round(p50, 2), "p95": round(p95, 2), "p99": round(p99, 2), "avg": round(avg, 2)}
            print(f"{name:25} | {p50:10.2f} | {p95:10.2f} | {p99:10.2f} | {avg:10.2f}")
        else:
            print(f"{name:25} | N/A")
            
    print("=" * 80)
    return summary

if __name__ == "__main__":
    asyncio.run(run_600_user_simulation(600))
