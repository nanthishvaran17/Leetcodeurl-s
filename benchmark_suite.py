import asyncio
import aiohttp
import time
import statistics
import os

API_BASE = "http://127.0.0.1:8000"

# Mock credentials or dynamically passed in CI
USERNAME = os.getenv("BENCHMARK_USERNAME", "admin")
PASSWORD = os.getenv("BENCHMARK_PASSWORD", "admin123")

async def login(session):
    url = f"{API_BASE}/api/auth/login"
    data = {"username": USERNAME, "password": PASSWORD}
    async with session.post(url, data=data) as response:
        if response.status == 200:
            res_data = await response.json()
            return res_data.get("access_token")
        else:
            print(f"Login failed: {response.status}")
            return None

async def fetch(session, url, headers):
    start = time.perf_counter()
    async with session.get(url, headers=headers) as response:
        await response.read()
    return time.perf_counter() - start, response.status

async def load_test(session, endpoint, headers, concurrent=10, total_requests=50):
    url = f"{API_BASE}{endpoint}"
    print(f"Benchmarking {url} (Concurrency: {concurrent}, Total: {total_requests})")
    
    # Warm-up (1 request)
    await fetch(session, url, headers)
    
    times = []
    errors = 0
    start_time = time.time()
    
    for i in range(0, total_requests, concurrent):
        batch = [fetch(session, url, headers) for _ in range(min(concurrent, total_requests - i))]
        results = await asyncio.gather(*batch)
        
        for t, status in results:
            if status == 200:
                times.append(t)
            else:
                errors += 1
                
    total_time = time.time() - start_time
    rps = total_requests / total_time if total_time > 0 else 0
                
    if not times:
        print(f"All requests failed for {endpoint}.")
        return None
        
    times.sort()
    p50 = times[int(len(times) * 0.50)] * 1000
    p75 = times[int(len(times) * 0.75)] * 1000
    p95 = times[int(len(times) * 0.95)] * 1000
    p99 = times[int(len(times) * 0.99)] * 1000
    avg = statistics.mean(times) * 1000
    
    print(f"  P50: {p50:.2f} ms")
    print(f"  P75: {p75:.2f} ms")
    print(f"  P95: {p95:.2f} ms")
    print(f"  P99: {p99:.2f} ms")
    print(f"  Avg: {avg:.2f} ms")
    print(f"  Req/sec: {rps:.2f}")
    print(f"  Error Rate: {errors/total_requests*100:.1f}%\n")
    
    return {
        "endpoint": endpoint,
        "p50": p50,
        "p75": p75,
        "p95": p95,
        "p99": p99,
        "rps": rps,
        "error_rate": errors/total_requests*100
    }

async def main():
    async with aiohttp.ClientSession() as session:
        # Try to get token
        token = await login(session)
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        
        endpoints = [
            "/api/health",
            "/api/sessions/dashboard-summary",
            "/api/students/leaderboard",
            "/api/hr-candidate-finder/candidates",
        ]
        
        for ep in endpoints:
            await load_test(session, ep, headers, concurrent=10, total_requests=100)

if __name__ == "__main__":
    asyncio.run(main())
