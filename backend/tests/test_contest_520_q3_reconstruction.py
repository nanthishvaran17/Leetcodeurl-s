"""
test_contest_520_q3_reconstruction.py
================================================================================
Regression test for student NANHTHISH S (nanthishvaran_07) in Weekly Contest 520.
Verifies that submission 2147218032 for official Q3 (Maximum Pulse Value After
One Subarray Rotation) is correctly identified and produces Q1=1, Q2=1, Q3=1, Q4=0, TOTAL=3.
"""

import pytest
from backend.database import SessionLocal
from backend.models import Student, WeeklySession, WeeklyPublicResult
from backend.services.canonical_contest_engine import build_canonical_contest_dataset, invalidate_canonical_cache
from backend.services.contest_problem_accuracy_engine import ContestProblemAccuracyEngine, normalize_slug

def test_contest_520_nanthishvaran_q3_detection():
    db = SessionLocal()
    try:
        username = "nanthishvaran_07"
        contest_number = 520

        # 1. Verify official problem registry Q3 mapping
        problem_set = ContestProblemAccuracyEngine.resolve_official_problem_set(contest_number)
        assert len(problem_set.problems) == 4
        q3_prob = problem_set.problems[2]
        assert normalize_slug(q3_prob.title_slug) == "maximum-pulse-value-after-one-subarray-rotation"

        # 2. Query session
        session = db.query(WeeklySession).filter(
            (WeeklySession.week_number == contest_number) | (WeeklySession.session_code == "WEEK-2026-09-20")
        ).first()
        assert session is not None, "Weekly Contest 520 session must exist"

        # 3. Query student
        student = db.query(Student).filter(
            (Student.username.ilike(username)) | (Student.primary_leetcode_id.ilike(username))
        ).first()
        assert student is not None, "Student nanthishvaran_07 must exist in database"

        # 4. Invalidate cache to force fresh build
        invalidate_canonical_cache(session.id)

        # 5. Query dataset
        dataset = build_canonical_contest_dataset(session.id, db)
        rows = dataset.get("rows", [])

        user_row = None
        for r in rows:
            if str(r.get("reg_no", "")).strip().upper() == str(student.reg_no).strip().upper() or r.get("username") == username:
                user_row = r
                break

        assert user_row is not None, "Student row must be present in canonical contest dataset"

        q1 = user_row.get("q1", 0)
        q2 = user_row.get("q2", 0)
        q3 = user_row.get("q3", 0)
        q4 = user_row.get("q4", 0)
        total = user_row.get("total_solved") if user_row.get("total_solved") is not None else (q1 + q2 + q3 + q4)

        assert q1 == 1, f"Expected Q1=1, got {q1}"
        assert q2 == 1, f"Expected Q2=1, got {q2}"
        assert q3 == 1, f"Expected Q3=1, got {q3}"
        assert q4 == 0, f"Expected Q4=0, got {q4}"
        assert total == 3, f"Expected TOTAL=3, got {total}"
        assert total == q1 + q2 + q3 + q4, f"Sum mismatch: {total} != {q1} + {q2} + {q3} + {q4}"

    finally:
        db.close()
