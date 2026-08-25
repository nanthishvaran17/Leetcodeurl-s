"""
test_staff_concurrency_baseline.py — Phase 1: Baseline Measurement

Records current performance characteristics BEFORE any optimizations.
Records: p50, p95, p99 response times, DB query count, payload size, error rate.
"""

import sys
import os
import time
import json
import threading
import statistics
from typing import List, Dict, Any, Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal
from backend.models import User, Student, FacultyStudentAssignment
from backend.services.faculty_assignment_service import faculty_assignment_service


# ─── SQLAlchemy Query Counter ─────────────────────────────────────────────────

from sqlalchemy import event
from backend.database import engine

_query_counts: Dict[int, int] = {}
_query_count_lock = threading.Lock()

@event.listens_for(engine, "before_cursor_execute")
def count_query(conn, cursor, statement, parameters, context, executemany):
    tid = threading.get_ident()
    with _query_count_lock:
        _query_counts[tid] = _query_counts.get(tid, 0) + 1

def reset_query_count():
    tid = threading.get_ident()
    with _query_count_lock:
        _query_counts[tid] = 0

def get_query_count() -> int:
    tid = threading.get_ident()
    with _query_count_lock:
        return _query_counts.get(tid, 0)


# ─── Simulated Endpoint Calls (direct service layer, no HTTP overhead) ────────

def measure_get_my_students(staff_id: int) -> Dict[str, Any]:
    """Measures /faculty-assignments/my-students performance."""
    db = SessionLocal()
    try:
        reset_query_count()
        t0 = time.perf_counter()

        assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, staff_id)
        if not assigned_ids:
            result = {"students": [], "total_assigned": 0}
        else:
            from sqlalchemy.orm import joinedload
            from backend.services.authorization_service import apply_role_based_student_filter

            # CURRENT (BUGGY) IMPLEMENTATION — measuring as-is
            user = db.query(User).filter(User.id == staff_id).first()
            query = db.query(Student).outerjoin(Student.stats).options(
                joinedload(Student.department),
                joinedload(Student.section),
                joinedload(Student.stats)
            ).filter((Student.is_active == True) | (Student.is_active.is_(None)))
            query = apply_role_based_student_filter(query, user, db)
            students = query.all()

            result = {
                "students": [{"id": s.id, "name": s.name} for s in students],
                "total_assigned": len(students)
            }

        elapsed_ms = (time.perf_counter() - t0) * 1000
        q_count = get_query_count()
        payload_size = len(json.dumps(result))

        return {
            "endpoint": "GET /faculty-assignments/my-students",
            "staff_id": staff_id,
            "elapsed_ms": elapsed_ms,
            "query_count": q_count,
            "payload_size_bytes": payload_size,
            "student_count": len(result["students"]),
            "error": None
        }
    except Exception as e:
        return {
            "endpoint": "GET /faculty-assignments/my-students",
            "staff_id": staff_id,
            "elapsed_ms": -1,
            "query_count": -1,
            "payload_size_bytes": 0,
            "student_count": 0,
            "error": str(e)
        }
    finally:
        db.close()


def measure_get_mentoring_summary(staff_id: int) -> Dict[str, Any]:
    """Measures /faculty-assignments/my-mentoring-summary performance."""
    db = SessionLocal()
    try:
        reset_query_count()
        t0 = time.perf_counter()

        from sqlalchemy.orm import joinedload

        assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, staff_id)
        if assigned_ids:
            students = db.query(Student).outerjoin(Student.stats).options(
                joinedload(Student.stats)
            ).filter(Student.id.in_(assigned_ids)).all()
        else:
            students = []

        elapsed_ms = (time.perf_counter() - t0) * 1000
        q_count = get_query_count()

        result = {"total_assigned": len(students)}
        payload_size = len(json.dumps(result))

        return {
            "endpoint": "GET /faculty-assignments/my-mentoring-summary",
            "staff_id": staff_id,
            "elapsed_ms": elapsed_ms,
            "query_count": q_count,
            "payload_size_bytes": payload_size,
            "student_count": len(students),
            "error": None
        }
    except Exception as e:
        return {
            "endpoint": "GET /faculty-assignments/my-mentoring-summary",
            "staff_id": staff_id,
            "elapsed_ms": -1,
            "query_count": -1,
            "payload_size_bytes": 0,
            "student_count": 0,
            "error": str(e)
        }
    finally:
        db.close()


# ─── Percentile Calculation ────────────────────────────────────────────────────

def percentile(data: List[float], pct: float) -> float:
    if not data:
        return 0.0
    sorted_data = sorted(data)
    idx = max(0, min(len(sorted_data) - 1, int(len(sorted_data) * pct / 100)))
    return round(sorted_data[idx], 2)


# ─── Main Baseline Runner ─────────────────────────────────────────────────────

def run_baseline():
    print("=" * 70)
    print("PHASE 1 — BASELINE MEASUREMENT (Before Optimization)")
    print("=" * 70)

    db = SessionLocal()
    staff_users = db.query(User).filter(
        User.role.in_(["Staff", "staff", "Faculty", "faculty"]),
        User.is_active == True
    ).all()
    staff_ids = [u.id for u in staff_users]
    db.close()

    if not staff_ids:
        print("[WARN] No active Staff/Faculty users found. Run seed script first.")
        return {}

    print(f"\n[OK] Found {len(staff_ids)} active Staff/Faculty users: {staff_ids}")

    # Run 10 measurements per staff user per endpoint
    RUNS_PER_STAFF = 10

    my_students_results = []
    mentoring_results = []
    errors = 0

    print(f"\n▶  Running {RUNS_PER_STAFF} × {len(staff_ids)} = {RUNS_PER_STAFF * len(staff_ids)} measurements per endpoint...")

    for run in range(RUNS_PER_STAFF):
        for sid in staff_ids:
            r1 = measure_get_my_students(sid)
            r2 = measure_get_mentoring_summary(sid)

            if r1["error"]:
                errors += 1
                print(f"  [FAIL] Error on /my-students (staff {sid}, run {run+1}): {r1['error']}")
            else:
                my_students_results.append(r1)

            if r2["error"]:
                errors += 1
            else:
                mentoring_results.append(r2)

    total_calls = RUNS_PER_STAFF * len(staff_ids) * 2
    error_rate = round(errors / max(total_calls, 1) * 100, 2)

    # Aggregate metrics
    ms_times = [r["elapsed_ms"] for r in my_students_results]
    ms_queries = [r["query_count"] for r in my_students_results]
    ms_payloads = [r["payload_size_bytes"] for r in my_students_results]

    mentor_times = [r["elapsed_ms"] for r in mentoring_results]
    mentor_queries = [r["query_count"] for r in mentoring_results]

    print("\n" + "=" * 70)
    print("BASELINE RESULTS — GET /faculty-assignments/my-students")
    print("=" * 70)
    print(f"  Total samples:    {len(ms_times)}")
    print(f"  p50 (median):     {percentile(ms_times, 50)} ms")
    print(f"  p95:              {percentile(ms_times, 95)} ms")
    print(f"  p99:              {percentile(ms_times, 99)} ms")
    print(f"  Mean queries:     {round(statistics.mean(ms_queries), 1) if ms_queries else 0}")
    print(f"  Max queries:      {max(ms_queries) if ms_queries else 0}")
    print(f"  Mean payload:     {round(statistics.mean(ms_payloads), 0) if ms_payloads else 0} bytes")

    print("\n" + "=" * 70)
    print("BASELINE RESULTS — GET /faculty-assignments/my-mentoring-summary")
    print("=" * 70)
    print(f"  Total samples:    {len(mentor_times)}")
    print(f"  p50 (median):     {percentile(mentor_times, 50)} ms")
    print(f"  p95:              {percentile(mentor_times, 95)} ms")
    print(f"  p99:              {percentile(mentor_times, 99)} ms")
    print(f"  Mean queries:     {round(statistics.mean(mentor_queries), 1) if mentor_queries else 0}")
    print(f"  Max queries:      {max(mentor_queries) if mentor_queries else 0}")

    print("\n" + "=" * 70)
    print("ERROR RATE")
    print("=" * 70)
    print(f"  Total calls:      {total_calls}")
    print(f"  Errors:           {errors}")
    print(f"  Error rate:       {error_rate}%")

    baseline = {
        "phase": "BASELINE",
        "staff_count": len(staff_ids),
        "my_students": {
            "p50_ms": percentile(ms_times, 50),
            "p95_ms": percentile(ms_times, 95),
            "p99_ms": percentile(ms_times, 99),
            "mean_queries": round(statistics.mean(ms_queries), 1) if ms_queries else 0,
            "max_queries": max(ms_queries) if ms_queries else 0,
            "mean_payload_bytes": round(statistics.mean(ms_payloads), 0) if ms_payloads else 0,
        },
        "mentoring_summary": {
            "p50_ms": percentile(mentor_times, 50),
            "p95_ms": percentile(mentor_times, 95),
            "p99_ms": percentile(mentor_times, 99),
            "mean_queries": round(statistics.mean(mentor_queries), 1) if mentor_queries else 0,
            "max_queries": max(mentor_queries) if mentor_queries else 0,
        },
        "error_rate_pct": error_rate,
    }

    # Save baseline to file
    baseline_path = os.path.join(os.path.dirname(__file__), "baseline_results.json")
    with open(baseline_path, "w") as f:
        json.dump(baseline, f, indent=2)
    print(f"\n[OK] Baseline saved to: {baseline_path}")

    return baseline


if __name__ == "__main__":
    run_baseline()
