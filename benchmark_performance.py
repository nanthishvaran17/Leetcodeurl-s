# benchmark_performance.py
import sys
import os
import time
import requests
import json

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_URL = "http://127.0.0.1:8000"

endpoints = [
    ("/api/health", "Liveness Health Check"),
    ("/api/ready", "Readiness Check"),
    ("/api/auth/session", "Session Check"),
    ("/api/students/leaderboard-fast", "Fast Leaderboard (All)"),
    ("/api/students/leaderboard-fast?limit=20", "Fast Leaderboard (Top 20)"),
    ("/api/students?limit=50", "Student List (50 Rows)"),
    ("/api/students?search=Ajay", "Student Search (Ajay)"),
    ("/api/students/by-email?email=nanthishvaran17@gmail.com", "Student By Email Lookup"),
    ("/api/contests/upcoming-session", "Contest Upcoming Session"),
    ("/api/analytics/department-comparison", "Department Comparison Analytics"),
]

def run_benchmark():
    print("=" * 88)
    print("🚀 POSTGRESQL / SUPABASE & BACKEND PERFORMANCE BENCHMARK")
    print("=" * 88)
    print(f"{'Status':8} | {'Endpoint Description':32} | {'Avg Latency':13} | {'Min Latency':13} | {'Size':10}")
    print("-" * 88)
    
    results = {}
    for ep, name in endpoints:
        url = f"{BASE_URL}{ep}"
        durations = []
        status_code = None
        payload_size = 0
        
        for _ in range(5):
            t0 = time.perf_counter()
            try:
                r = requests.get(url, timeout=10)
                dur = (time.perf_counter() - t0) * 1000
                durations.append(dur)
                status_code = r.status_code
                payload_size = len(r.content)
            except Exception as e:
                durations.append(9999)
                status_code = f"ERR"
            time.sleep(0.02)
            
        avg_dur = sum(durations) / len(durations)
        min_dur = min(durations)
        results[ep] = {
            "name": name,
            "avg_ms": round(avg_dur, 2),
            "min_ms": round(min_dur, 2),
            "status": status_code,
            "size_kb": round(payload_size / 1024, 2)
        }
        print(f"[{status_code}]     | {name:32} | {avg_dur:7.2f} ms    | {min_dur:7.2f} ms    | {round(payload_size/1024, 2):6.2f} KB")
        
    print("=" * 88)
    return results

if __name__ == "__main__":
    run_benchmark()
