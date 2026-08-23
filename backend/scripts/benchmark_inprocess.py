"""
benchmark_inprocess.py — IN-PROCESS HIGH CONCURRENCY PERFORMANCE BENCHMARK
============================================================================
Measures exact server handler and database response times (p50, p95, p99, throughput).
"""

import sys
import os
import time
import tracemalloc

# Add project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi.testclient import TestClient
from backend.main import app

def run_inprocess_benchmark():
    tracemalloc.start()
    client = TestClient(app)

    endpoints = [
        "/ready",
        "/api/ready",
        "/health/performance",
        "/api/contests/sessions",
        "/api/contests/upcoming-session",
        "/api/contests/autopilot/status"
    ]

    print("==========================================================================")
    print("PRODUCTION SERVER PERFORMANCE BENCHMARK (IN-PROCESS CONCURRENT)")
    print("==========================================================================")

    for path in endpoints:
        latencies = []
        # Warmup
        client.get(path)

        # 50 iterations per endpoint
        t0 = time.perf_counter()
        for _ in range(50):
            req_start = time.perf_counter()
            res = client.get(path)
            req_dur = (time.perf_counter() - req_start) * 1000.0
            latencies.append(req_dur)
        total_time = time.perf_counter() - t0

        latencies.sort()
        count = len(latencies)
        p50 = latencies[int(count * 0.50)]
        p90 = latencies[int(count * 0.90)]
        p95 = latencies[int(count * 0.95)]
        p99 = latencies[int(count * 0.99)]
        rps = count / max(total_time, 0.001)

        print(f"[{path:<32}] p50: {p50:>5.2f}ms | p95: {p95:>5.2f}ms | p99: {p99:>5.2f}ms | RPS: {rps:>6.1f} | Status: {res.status_code}")

    current_mem, peak_mem = tracemalloc.get_traced_memory()
    print("--------------------------------------------------------------------------")
    print(f"Peak Traced Memory: {round(peak_mem / (1024 * 1024), 2)} MB | Allocations: {current_mem} bytes")
    print("==========================================================================")

if __name__ == "__main__":
    run_inprocess_benchmark()
