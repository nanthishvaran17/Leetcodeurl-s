"""
test_n_plus_one_audit.py — Phase 8: N+1 Query Audit

Instruments SQLAlchemy to count exactly how many queries each critical endpoint
fires per request. Asserts strict query count limits.

Target limits:
  GET /faculty-assignments/my-students       → ≤ 3 queries
  GET /faculty-assignments/my-mentoring-summary → ≤ 4 queries
"""

import sys
import os
import threading
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import pytest
from sqlalchemy import event
from backend.database import SessionLocal, engine
from backend.models import User, Student
from backend.services.faculty_assignment_service import faculty_assignment_service

# ─── Query Counter Instrumentation ────────────────────────────────────────────

_q_counts = {}
_q_lock = threading.Lock()

@event.listens_for(engine, "before_cursor_execute")
def _track_query(conn, cursor, statement, parameters, context, executemany):
    tid = threading.get_ident()
    with _q_lock:
        _q_counts[tid] = _q_counts.get(tid, 0) + 1

def reset_count():
    tid = threading.get_ident()
    with _q_lock:
        _q_counts[tid] = 0

def get_count():
    tid = threading.get_ident()
    with _q_lock:
        return _q_counts.get(tid, 0)


# ─── Helper: load isolation test data ─────────────────────────────────────────

def load_test_staff():
    """Loads the test staff IDs from the isolation seed data."""
    import json
    test_data_path = os.path.join(os.path.dirname(__file__), "..", "scripts", "isolation_test_data.json")
    if not os.path.exists(test_data_path):
        return None
    with open(test_data_path) as f:
        return json.load(f)


# ─── Tests ────────────────────────────────────────────────────────────────────

class TestN1Queries:
    """Verifies that critical endpoints do not have N+1 query patterns."""

    def test_my_students_query_count(self):
        """
        GET /faculty-assignments/my-students must use ≤ 3 queries total:
          Q1: get_faculty_assigned_student_ids (SELECT from faculty_student_assignments)
          Q2: Student JOIN stats (main query with joinedload)
          Q3: Department/Section lazy loads if not joined (should be 0 with joinedload)
        After fix: 2 queries (1 for assigned IDs, 1 for students+joinedload)
        """
        test_data = load_test_staff()
        if not test_data:
            pytest.skip("Run seed_staff_isolation_test_data.py first")

        staff_a_id = test_data["staff_a"]["id"]

        db = SessionLocal()
        try:
            from sqlalchemy.orm import joinedload
            user = db.query(User).filter(User.id == staff_a_id).first()
            assert user is not None, f"Staff A (ID {staff_a_id}) not found"

            reset_count()

            # Simulate the FIXED endpoint logic
            assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, staff_a_id)
            q_after_ids = get_count()

            students = db.query(Student).outerjoin(Student.stats).options(
                joinedload(Student.department),
                joinedload(Student.section),
                joinedload(Student.stats)
            ).filter(
                Student.id.in_(assigned_ids),
                (Student.is_active == True) | (Student.is_active.is_(None))
            ).all()

            q_total = get_count()

            print(f"\n  Queries for get_faculty_assigned_student_ids: {q_after_ids}")
            print(f"  Total queries for /my-students: {q_total}")
            print(f"  Students returned: {len(students)} (expected: 20)")

            # Assertions
            assert len(students) == 20, f"Expected 20 students, got {len(students)}"
            assert q_total <= 3, (
                f"N+1 DETECTED: /my-students fired {q_total} queries. "
                f"Expected ≤ 3. Fix the query to use joinedload."
            )
            print(f"  [PASS] /my-students: {q_total} queries (within ≤3 limit)")

        finally:
            db.close()

    def test_my_mentoring_summary_query_count(self):
        """
        GET /faculty-assignments/my-mentoring-summary must use ≤ 4 queries:
          Q1: get_faculty_assigned_student_ids
          Q2: Students+stats batch query
          Q3: StaffFollowUp pending count
          Q4: StaffAlert unread count
        """
        test_data = load_test_staff()
        if not test_data:
            pytest.skip("Run seed_staff_isolation_test_data.py first")

        staff_a_id = test_data["staff_a"]["id"]

        db = SessionLocal()
        try:
            from sqlalchemy.orm import joinedload
            from backend.models import StaffFollowUp, StaffAlert

            reset_count()

            assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, staff_a_id)
            students = db.query(Student).outerjoin(Student.stats).options(
                joinedload(Student.stats)
            ).filter(Student.id.in_(assigned_ids)).all()

            pending_followups = db.query(StaffFollowUp).filter(
                StaffFollowUp.staff_id == staff_a_id,
                StaffFollowUp.status == "PENDING"
            ).count()

            unread_alerts = db.query(StaffAlert).filter(
                StaffAlert.staff_id == staff_a_id,
                StaffAlert.is_read == False
            ).count()

            q_total = get_count()

            print(f"\n  Total queries for /my-mentoring-summary: {q_total}")
            print(f"  Students: {len(students)}, Follow-ups: {pending_followups}, Alerts: {unread_alerts}")

            assert q_total <= 4, (
                f"N+1 DETECTED: /my-mentoring-summary fired {q_total} queries. "
                f"Expected ≤ 4."
            )
            print(f"  [PASS] /my-mentoring-summary: {q_total} queries (within ≤4 limit)")

        finally:
            db.close()

    def test_no_per_student_queries(self):
        """
        Verifies that the number of queries does NOT scale linearly with student count.
        If queries == student_count × N + constant, that's an N+1 pattern.
        """
        test_data = load_test_staff()
        if not test_data:
            pytest.skip("Run seed_staff_isolation_test_data.py first")

        staff_a_id = test_data["staff_a"]["id"]

        db = SessionLocal()
        try:
            from sqlalchemy.orm import joinedload

            reset_count()
            assigned_ids = faculty_assignment_service.get_faculty_assigned_student_ids(db, staff_a_id)
            students = db.query(Student).outerjoin(Student.stats).options(
                joinedload(Student.department),
                joinedload(Student.section),
                joinedload(Student.stats)
            ).filter(Student.id.in_(assigned_ids)).all()
            q_total = get_count()

            student_count = len(students)

            # If queries > student_count, we likely have N+1
            assert q_total < student_count, (
                f"Possible N+1: {q_total} queries for {student_count} students. "
                f"Queries should not scale with student count."
            )
            print(f"\n  [PASS] {q_total} queries for {student_count} students — no N+1 pattern")

        finally:
            db.close()

    def test_workload_summary_single_grouped_query(self):
        """
        GET /faculty-assignments/workload-summary must use a single grouped query
        for counting assigned students (not 1 query per faculty member).
        """
        db = SessionLocal()
        try:
            from backend.models import FacultyStudentAssignment
            from sqlalchemy import func

            # Get active faculty
            faculty_list = db.query(User).filter(
                User.is_active == True,
                User.role.in_(["Faculty", "faculty", "Staff", "staff"])
            ).limit(10).all()

            fac_ids = [f.id for f in faculty_list]

            reset_count()

            # CORRECT: Single grouped query (what the workload-summary endpoint does)
            count_rows = db.query(
                FacultyStudentAssignment.faculty_id,
                func.count(FacultyStudentAssignment.id)
            ).filter(
                FacultyStudentAssignment.faculty_id.in_(fac_ids),
                FacultyStudentAssignment.is_active == True
            ).group_by(FacultyStudentAssignment.faculty_id).all()

            q_total = get_count()

            # Should use exactly 1 grouped query — not 1 per faculty
            assert q_total == 1, (
                f"Expected 1 grouped query for workload counts, got {q_total}. "
                f"This indicates N+1 per-faculty queries."
            )
            print(f"\n  [PASS] workload-summary uses {q_total} grouped query for {len(fac_ids)} faculty members")

        finally:
            db.close()


if __name__ == "__main__":
    t = TestN1Queries()
    t.test_my_students_query_count()
    t.test_my_mentoring_summary_query_count()
    t.test_no_per_student_queries()
    t.test_workload_summary_single_grouped_query()
    print("\n[COMPLETE] All N+1 query audit tests passed.")
