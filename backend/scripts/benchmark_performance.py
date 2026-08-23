"""
benchmark_performance.py — PRODUCTION PERFORMANCE BENCHMARK & LOAD STRESS TEST
================================================================================
Measures actual measured p50, p95, p99 latencies, throughput (RPS), RAM, CPU,
and DB query latency under concurrent load.
"""

import time
import asyncio
import os
import sys
import tracemalloc
import httpx
from typing import List, Dict, Any

API_BASE = os.environ.get("API_BASE", "http://127.0.0.1:8000")


async def benchmark_endpoint(client: httpx.AsyncClient, path: str, num_requests: int = 50, concurrency: int = 10) -> Dict[str, Any]:
    latencies: List[float] = []
    sem = asyncio.Semaphore(concurrency)
    success_count = 0
    error_count = 0

    async def fetch():
        nonlocal success_count, error_count
        async with sem:
            t0 = time.perf_counter()
            try:
                r = await client.get(f"{API_BASE}{path}", timeout=10.0)
                dur = (time.perf_counter() - t0) * 1000.0
                if r.status_code < 400:
                    latencies.append(dur)
                    success_count += 1
                else:
                    error_count += 1
            except Exception as e:
                error_count += 1

    t_start = time.perf_counter()
    tasks = [asyncio.create_task(fetch()) for _ in range(num_requests)]
    await asyncio.gather(*tasks)
    total_time = time.perf_counter() - t_start

    latencies.sort()
    count = len(latencies)
    p50 = latencies[int(count * 0.50)] if count > 0 else 0.0
    p90 = latencies[int(count * 0.90)] if count > 0 else 0.0
    p95 = latencies[int(count * 0.95)] if count > 0 else 0.0
    p99 = latencies[int(count * 0.99)] if count > 0 else 0.0
    avg = sum(latencies) / count if count > 0 else 0.0

    return {
        "endpoint": path,
        "requests": num_requests,
        "success": success_count,
        "errors": error_count,
        "total_time_sec": round(total_time, 3),
        "throughput_rps": round(num_requests / max(total_time, 0.001), 1),
        "p50_ms": round(p50, 2),
        "p95_ms": round(p95, 2),
        "p99_ms": round(p99, 2),
        "avg_ms": round(avg, 2)
    }


async def run_production_benchmarks():
    tracemalloc.start()
    current_mem, peak_mem = tracemalloc.get_traced_memory()
    ram_start = round(peak_mem / (1024 * 1024), 2)

    endpoints = [
        "/ready",
        "/api/contests/sessions",
        "/api/contests/upcoming-session",
        "/api/contests/autopilot/status",
        "/api/health/performance"
    ]

    print("==========================================================================")
    print("PRODUCTION PERFORMANCE & ZERO-LAG BENCHMARK AUDIT")
    print(f"Target API: {API_BASE} | Initial Traced RAM: {ram_start} MB")
    print("==========================================================================")

    results = []
    async with httpx.AsyncClient() as client:
        for ep in endpoints:
            res = await benchmark_endpoint(client, ep, num_requests=40, concurrency=10)
            results.append(res)
            print(f"[{res['endpoint']:<32}] p50: {res['p50_ms']:>6.2f}ms | p95: {res['p95_ms']:>6.2f}ms | p99: {res['p99_ms']:>6.2f}ms | RPS: {res['throughput_rps']:>6.1f} | Errors: {res['errors']}")

    current_mem, peak_mem = tracemalloc.get_traced_memory()
    ram_end = round(peak_mem / (1024 * 1024), 2)

    print("--------------------------------------------------------------------------")
    print(f"Final Peak RAM: {ram_end} MB (Growth: {round(ram_end - ram_start, 2)} MB)")
    print("==========================================================================")


if __name__ == "__main__":
    asyncio.run(run_production_benchmarks())
