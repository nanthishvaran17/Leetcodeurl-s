"""
profile_p99_investigation.py — Profiling script to identify exact causes of tail latency (p99).
"""

import sys
import os
import time
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.main import app
from backend.database import SessionLocal
from backend.routes.auth import create_access_token

client = TestClient(app)

token = create_access_token({"sub": "prod_super_admin", "role": "Super Admin"})
headers = {"Authorization": f"Bearer {token}"}

endpoints = [
    "/api/students?page=1&limit=25",
    "/api/students?page=5&limit=25&sort_by=solved_desc",
    "/api/students?page=10&limit=25&dept_id=1",
    "/api/students?page=1&limit=25&search=coder",
    "/api/students/leaderboard-fast",
    "/api/institutional/super-admin",
    "/api/institutional/hod?dept_id=1",
    "/api/faculty-assignments/workload-summary"
]

print("=" * 80)
print("PROFILING ENDPOINTS INDIVIDUALLY (Warm vs Cold, 20 runs each)")
print("=" * 80)

for ep in endpoints:
    times = []
    for i in range(20):
        t0 = time.perf_counter()
        resp = client.get(ep, headers=headers)
        t1 = time.perf_counter()
        assert resp.status_code == 200, f"Error {resp.status_code} on {ep}: {resp.text}"
        times.append((t1 - t0) * 1000)
    
    first = times[0]
    sorted_times = sorted(times)
    p50 = sorted_times[int(len(sorted_times) * 0.5)]
    p95 = sorted_times[int(len(sorted_times) * 0.95)]
    p99 = sorted_times[-1]
    
    print(f"Endpoint: {ep}")
    print(f"  Cold (First call): {first:.2f} ms | p50: {p50:.2f} ms | p95: {p95:.2f} ms | Max: {p99:.2f} ms")
    print("-" * 80)
