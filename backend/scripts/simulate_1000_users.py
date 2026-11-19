import asyncio
import time
import statistics
import httpx

BASE_URL = "http://127.0.0.1:8000"
CONCURRENT_USERS = 1000

async def simulate_user(client: httpx.AsyncClient, user_id: int, results: list):
    # Simulated distinct student IP address per virtual user (10.0.x.y)
    user_ip = f"10.0.{user_id // 256}.{user_id % 256}"
    headers = {
        "X-Forwarded-For": user_ip,
        "User-Agent": f"Mozilla/5.0 (StudentDevice-{user_id})"
    }

    # Simulated endpoints that a user hits upon opening app
    endpoints = [
        ("GET", f"{BASE_URL}/health"),
        ("GET", f"{BASE_URL}/api/students/leaderboard-fast?limit=25"),
        ("GET", f"{BASE_URL}/api/departments"),
    ]
    
    for method, url in endpoints:
        start = time.perf_counter()
        status = 0
        error = None
        try:
            res = await client.get(url, headers=headers, timeout=15.0)
            status = res.status_code
        except Exception as exc:
            error = str(type(exc).__name__)
        elapsed_ms = (time.perf_counter() - start) * 1000.0
        results.append({
            "user_id": user_id,
            "url": url,
            "status": status,
            "elapsed_ms": elapsed_ms,
            "error": error
        })

async def run_load_test():
    print(f"===========================================================")
    print(f"  STARTING LOAD TEST: {CONCURRENT_USERS} CONCURRENT USERS (SAME TIME) ")
    print(f"  Target: {BASE_URL}")
    print(f"===========================================================\n")
    
    limits = httpx.Limits(max_keepalive_connections=CONCURRENT_USERS, max_connections=CONCURRENT_USERS)
    results = []
    
    start_total = time.perf_counter()
    async with httpx.AsyncClient(limits=limits, timeout=15.0) as client:
        tasks = [
            simulate_user(client, user_id=i, results=results)
            for i in range(CONCURRENT_USERS)
        ]
        await asyncio.gather(*tasks)
    total_time = time.perf_counter() - start_total
    
    total_requests = len(results)
    success_count = sum(1 for r in results if 200 <= r["status"] < 300)
    error_count = total_requests - success_count
    latencies = [r["elapsed_ms"] for r in results if r["status"] == 200]
    
    rps = total_requests / total_time if total_time > 0 else 0
    avg_latency = statistics.mean(latencies) if latencies else 0
    median_latency = statistics.median(latencies) if latencies else 0
    p95_latency = statistics.quantiles(latencies, n=100)[94] if len(latencies) >= 100 else 0
    p99_latency = statistics.quantiles(latencies, n=100)[98] if len(latencies) >= 100 else 0
    min_latency = min(latencies) if latencies else 0
    max_latency = max(latencies) if latencies else 0
    
    print(f"\n===========================================================")
    print(f"                 LOAD TEST RESULTS SUMMARY                 ")
    print(f"===========================================================")
    print(f"Simultaneous Virtual Users : {CONCURRENT_USERS:,}")
    print(f"Total Requests Dispatched  : {total_requests:,}")
    print(f"Successful Requests (200) : {success_count:,} ({(success_count/total_requests)*100:.1f}%)")
    print(f"Failed Requests (Errors)   : {error_count:,} ({(error_count/total_requests)*100:.1f}%)")
    print(f"Total Test Duration        : {total_time:.2f} seconds")
    print(f"Throughput (Requests / sec): {rps:.1f} req/s")
    print(f"-----------------------------------------------------------")
    print(f"Latency (Response Time):")
    print(f"  - Minimum               : {min_latency:.2f} ms")
    print(f"  - Average (Mean)        : {avg_latency:.2f} ms")
    print(f"  - Median (p50)          : {median_latency:.2f} ms")
    print(f"  - 95th Percentile (p95) : {p95_latency:.2f} ms")
    print(f"  - 99th Percentile (p99) : {p99_latency:.2f} ms")
    print(f"  - Maximum               : {max_latency:.2f} ms")
    print(f"===========================================================\n")

if __name__ == "__main__":
    asyncio.run(run_load_test())
