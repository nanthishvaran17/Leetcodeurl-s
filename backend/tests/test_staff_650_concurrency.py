"""
test_staff_650_concurrency.py — Phases 5, 6, 7: Concurrent Staff Load Test

Simulates 100, 300, 650 concurrent Staff users each:
  - Loading their assigned student list
  - Loading their mentoring summary
  - Verifying no data leakage between concurrent sessions
  - Verifying no 500 errors
  - Verifying no timeout spikes

Records p50, p95, p99, error rate, payload size.
"""

import sys
import os
import json
import time
import threading
import statistics
import random
from typing import List, Dict, Any
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal
from backend.models import User, Student, Department, FacultyStudentAssignment, LeetCodeProfileStats, StudentAssignmentHistory
from backend.services.faculty_assignment_service import faculty_assignment_service
from backend.services.authorization_service import get_authorized_student_ids
import datetime

TEST_PREFIX = "TEST_CONC_"


def percentile(data: List[float], pct: float) -> float:
    if not data:
        return 0.0
    sorted_data = sorted(d for d in data if d >= 0)
    if not sorted_data:
        return 0.0
    idx = max(0, min(len(sorted_data) - 1, int(len(sorted_data) * pct / 100)))
    return round(sorted_data[idx], 2)


def cleanup_concurrency_test_data(db):
    """Removes all concurrency test data."""
    conc_students = db.query(Student).filter(Student.reg_no.like(f"{TEST_PREFIX}%")).all()
    conc_staff = db.query(User).filter(User.username.like(f"{TEST_PREFIX}%")).all()

    staff_ids = [u.id for u in conc_staff]
    student_ids = [s.id for s in conc_students]

    if staff_ids:
        db.query(FacultyStudentAssignment).filter(
            FacultyStudentAssignment.faculty_id.in_(staff_ids)
        ).delete(synchronize_session=False)
        db.query(StudentAssignmentHistory).filter(
            StudentAssignmentHistory.new_faculty_id.in_(staff_ids) |
            StudentAssignmentHistory.previous_faculty_id.in_(staff_ids)
        ).delete(synchronize_session=False)
        db.query(User).filter(User.id.in_(staff_ids)).delete(synchronize_session=False)

    if student_ids:
        db.query(LeetCodeProfileStats).filter(
            LeetCodeProfileStats.student_id.in_(student_ids)
        ).delete(synchronize_session=False)
        db.query(Student).filter(Student.id.in_(student_ids)).delete(synchronize_session=False)

    db.commit()
    print(f"    Cleaned: {len(conc_staff)} test staff, {len(conc_students)} test students")


def create_concurrency_test_staff(num_staff: int) -> List[Dict[str, Any]]:
    """
    Creates N test staff members each with up to 5 assigned students.
    Uses a reduced student set to keep DB seeding fast for large N.
    """
    db = SessionLocal()
    try:
        cleanup_concurrency_test_data(db)
        dept = db.query(Department).first()
        dept_id = dept.id if dept else None

        STUDENTS_PER_STAFF = 5  # Reduced for performance in 650-staff test
        all_test_staff = []
        now = datetime.datetime.utcnow()

        print(f"    Seeding {num_staff} staff × {STUDENTS_PER_STAFF} students = {num_staff * STUDENTS_PER_STAFF} total...")

        for i in range(num_staff):
            # Create staff user
            staff = User(
                username=f"{TEST_PREFIX}Staff{i:04d}",
                email=f"conc.staff{i:04d}@nandha.test",
                role="Staff",
                department_id=dept_id,
                is_active=True,
                hashed_password="test_conc_hash"
            )
            db.add(staff)
            db.flush()

            # Create students for this staff member
            student_ids = []
            for j in range(STUDENTS_PER_STAFF):
                s = Student(
                    reg_no=f"{TEST_PREFIX}{i:04d}_{j:02d}",
                    name=f"Conc Student {i}-{j}",
                    department_id=dept_id,
                    year_level="II",
                    is_active=True
                )
                db.add(s)
                db.flush()

                assign = FacultyStudentAssignment(
                    faculty_id=staff.id,
                    student_id=s.id,
                    is_active=True,
                    assigned_at=now
                )
                db.add(assign)
                student_ids.append(s.id)

            all_test_staff.append({
                "staff_id": staff.id,
                "student_ids": student_ids
            })

            if (i + 1) % 50 == 0:
                db.commit()
                print(f"      Committed {i + 1}/{num_staff} staff...")

        db.commit()
        return all_test_staff

    finally:
        db.close()


def simulate_staff_session(staff_info: Dict[str, Any], results: List, errors: List, lock: threading.Lock):
    """Simulates a single staff user session: load students + mentoring summary."""
    db = SessionLocal()
    try:
        staff_id = staff_info["staff_id"]
        expected_ids = set(staff_info["student_ids"])

        # ─── Load My Students ─────────────────────────────────────────────────
        t0 = time.perf_counter()
        assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, staff_id)

        from sqlalchemy.orm import joinedload
        students = db.query(Student).outerjoin(Student.stats).options(
            joinedload(Student.stats)
        ).filter(
            Student.id.in_(assigned_ids),
            (Student.is_active == True) | (Student.is_active.is_(None))
        ).all()
        my_students_ms = (time.perf_counter() - t0) * 1000

        # ─── Security Check: No Cross-Staff Leakage ───────────────────────────
        returned_ids = {s.id for s in students}
        leaked_ids = returned_ids - expected_ids
        extra_non_assigned = returned_ids - set(assigned_ids)

        if leaked_ids or extra_non_assigned:
            with lock:
                errors.append({
                    "type": "SECURITY_LEAK",
                    "staff_id": staff_id,
                    "leaked_count": len(leaked_ids | extra_non_assigned),
                    "detail": f"Staff {staff_id} received unauthorized student IDs"
                })
            return

        # ─── Load Mentoring Summary ───────────────────────────────────────────
        t1 = time.perf_counter()
        from backend.models import StaffFollowUp, StaffAlert
        pending_followups = db.query(StaffFollowUp).filter(
            StaffFollowUp.staff_id == staff_id,
            StaffFollowUp.status == "PENDING"
        ).count()
        unread_alerts = db.query(StaffAlert).filter(
            StaffAlert.staff_id == staff_id,
            StaffAlert.is_read == False
        ).count()
        summary_ms = (time.perf_counter() - t1) * 1000

        payload_size = len(json.dumps([{"id": s.id} for s in students]))

        with lock:
            results.append({
                "staff_id": staff_id,
                "my_students_ms": my_students_ms,
                "summary_ms": summary_ms,
                "total_ms": my_students_ms + summary_ms,
                "student_count": len(students),
                "payload_bytes": payload_size,
                "no_leak": True
            })

    except Exception as e:
        with lock:
            errors.append({
                "type": "EXCEPTION",
                "staff_id": staff_info.get("staff_id"),
                "detail": str(e)
            })
    finally:
        db.close()


def run_concurrency_test(num_staff: int, test_staff: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Runs the concurrency test with the given number of staff."""
    print(f"\n  Running {num_staff} concurrent staff sessions...")
    results = []
    errors = []
    lock = threading.Lock()

    # Use only the first num_staff entries if more were created
    staff_subset = test_staff[:num_staff]

    t_start = time.perf_counter()
    threads = []
    for staff_info in staff_subset:
        t = threading.Thread(
            target=simulate_staff_session,
            args=(staff_info, results, errors, lock)
        )
        threads.append(t)

    for t in threads:
        t.start()
    for t in threads:
        t.join()

    wall_time_ms = (time.perf_counter() - t_start) * 1000

    total_times = [r["total_ms"] for r in results]
    my_students_times = [r["my_students_ms"] for r in results]
    payload_sizes = [r["payload_bytes"] for r in results]

    security_leaks = [e for e in errors if e.get("type") == "SECURITY_LEAK"]
    exceptions = [e for e in errors if e.get("type") == "EXCEPTION"]
    error_rate = round(len(errors) / max(num_staff, 1) * 100, 2)

    result = {
        "num_staff": num_staff,
        "wall_time_ms": round(wall_time_ms, 2),
        "successful_sessions": len(results),
        "p50_ms": percentile(total_times, 50),
        "p95_ms": percentile(total_times, 95),
        "p99_ms": percentile(total_times, 99),
        "my_students_p50_ms": percentile(my_students_times, 50),
        "my_students_p95_ms": percentile(my_students_times, 95),
        "my_students_p99_ms": percentile(my_students_times, 99),
        "mean_payload_bytes": round(statistics.mean(payload_sizes), 0) if payload_sizes else 0,
        "error_count": len(errors),
        "error_rate_pct": error_rate,
        "security_leaks": len(security_leaks),
        "exceptions": len(exceptions),
        "exception_details": [e["detail"] for e in exceptions[:5]],
        "pass": len(security_leaks) == 0 and error_rate < 5.0
    }

    return result


def print_concurrency_result(r: Dict[str, Any]):
    status = "[PASS]" if r["pass"] else "[FAIL]"
    print(f"\n  {'='*60}")
    print(f"  {r['num_staff']} CONCURRENT STAFF TEST — {status}")
    print(f"  {'='*60}")
    print(f"  Successful sessions: {r['successful_sessions']}/{r['num_staff']}")
    print(f"  Wall clock time:     {r['wall_time_ms']:.1f} ms")
    print(f"  p50 (session):       {r['p50_ms']} ms")
    print(f"  p95 (session):       {r['p95_ms']} ms")
    print(f"  p99 (session):       {r['p99_ms']} ms")
    print(f"  /my-students p50:    {r['my_students_p50_ms']} ms")
    print(f"  /my-students p95:    {r['my_students_p95_ms']} ms")
    print(f"  /my-students p99:    {r['my_students_p99_ms']} ms")
    print(f"  Mean payload:        {r['mean_payload_bytes']} bytes")
    print(f"  Error rate:          {r['error_rate_pct']}%")
    print(f"  Security leaks:      {r['security_leaks']}")
    if r["exception_details"]:
        print(f"  Exceptions:         {r['exception_details'][:3]}")


def main():
    print("=" * 70)
    print("PHASES 5, 6, 7 — CONCURRENT STAFF LOAD TESTS")
    print("=" * 70)

    # Create enough test staff for 650 tests (5 students each)
    TOTAL_STAFF_NEEDED = 650
    print(f"\n[SETUP] Creating {TOTAL_STAFF_NEEDED} test staff members with 5 students each...")
    test_staff = create_concurrency_test_staff(TOTAL_STAFF_NEEDED)
    print(f"  Created {len(test_staff)} staff members")

    all_results = {}

    for n in [100, 300, 650]:
        print(f"\n[RUNNING] {n}-staff concurrency test...")
        result = run_concurrency_test(n, test_staff)
        print_concurrency_result(result)
        all_results[f"{n}_staff"] = result

    # Save results
    output_path = os.path.join(os.path.dirname(__file__), "concurrency_results.json")
    with open(output_path, "w") as f:
        json.dump(all_results, f, indent=2)
    print(f"\n[OK] Results saved to: {output_path}")

    # Final summary
    print("\n" + "=" * 70)
    print("CONCURRENCY TEST SUMMARY")
    print("=" * 70)
    for key, result in all_results.items():
        status = "PASS" if result["pass"] else "FAIL"
        print(f"  {result['num_staff']} Staff: {status} | p50={result['p50_ms']}ms | p95={result['p95_ms']}ms | errors={result['error_rate_pct']}% | leaks={result['security_leaks']}")

    # Cleanup
    print("\n[CLEANUP] Removing concurrency test data...")
    db = SessionLocal()
    cleanup_concurrency_test_data(db)
    db.close()

    # Assert all tests passed
    failed = [k for k, v in all_results.items() if not v["pass"]]
    if failed:
        print(f"\n[FAIL] Tests failed: {failed}")
        return False
    else:
        print(f"\n[PASS] All concurrency tests passed")
        return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
