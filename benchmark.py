import time
import asyncio
import aiohttp
import statistics
import sys

API_BASE = "http://127.0.0.1:8001"

async def fetch(session, url):
    start = time.perf_counter()
    async with session.get(url) as response:
        await response.read()
    return time.perf_counter() - start

async def load_test(endpoint, concurrent=50, total_requests=200):
    url = f"{API_BASE}{endpoint}"
    print(f"Starting load test on {url} with {concurrent} concurrency and {total_requests} total requests...")
    
    async with aiohttp.ClientSession() as session:
        # Warmup
        await fetch(session, url)
        
        times = []
        for i in range(0, total_requests, concurrent):
            batch = [fetch(session, url) for _ in range(concurrent)]
            results = await asyncio.gather(*batch)
            times.extend(results)
            
    times.sort()
    p50 = times[int(len(times) * 0.50)] * 1000
    p95 = times[int(len(times) * 0.95)] * 1000
    p99 = times[int(len(times) * 0.99)] * 1000
    avg = statistics.mean(times) * 1000
    
    print(f"Results for {endpoint}:")
    print(f"  P50: {p50:.2f} ms")
    print(f"  P95: {p95:.2f} ms")
    print(f"  P99: {p99:.2f} ms")
    print(f"  Avg: {avg:.2f} ms")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(load_test("/api/hr-candidate-finder/candidates", 50, 200))
    asyncio.run(load_test("/api/students/leaderboard", 50, 200))
