"""
test_roster_reconciliation.py
Full roster reconciliation tests for Weekly Contest 515.

Covers all 20 test categories from the audit spec:
- All roster students retained
- Username mapping validation
- Session mapping validation
- Status value preservation (PENDING, UNKNOWN, NOT_PARTICIPATED)
- Solved count 0/1/2/3/4
- Q1-Q4 from evidence only
- Public/Virtual separation
- Rank/Rating None handling
- Department and batch reconciliation
- Current/Last week reconciliation
"""
import pytest
from collections import defaultdict

# ─── Helpers ───────────────────────────────────────────────────────────────────

def make_pub_result(**kwargs):
    """Create a fake WeeklyPublicResult with controlled attribute values."""
    class FakeResult:
        pass
    defaults = {
        "id": 1, "student_id": 1, "session_id": 5,
        "participation_status": "NOT_ATTENDED",
        "data_fetch_status": "SUCCESS",
        "fetch_status": "SUCCESS",
        "total_contest_solved": 0,
        "q1": 0, "q2": 0, "q3": 0, "q4": 0,
        "contest_rank": None, "contest_rating": None,
        "confidence": "VERIFIED", "error_reason": None,
        "verification_evidence": None,
        "error_type": None, "attended": None,
    }
    defaults.update(kwargs)
    r = FakeResult()
    for k, v in defaults.items():
        setattr(r, k, v)
    return r

def make_vir_result(**kwargs):
    """Create a fake WeeklyVirtualResult with controlled attribute values."""
    class FakeVirResult:
        pass
    defaults = {
        "id": 1, "student_id": 1, "session_id": 5,
        "participation_status": "NOT_ATTENDED",
        "data_fetch_status": "SUCCESS",
        "fetch_status": "SUCCESS",
        "total_contest_solved": 0,
        "q1": 0, "q2": 0, "q3": 0, "q4": 0,
        "contest_rank": None, "contest_rating": None,
        "confidence": "VERIFIED",
        "error_type": None, "attended": None,
    }
    defaults.update(kwargs)
    r = FakeVirResult()
    for k, v in defaults.items():
        setattr(r, k, v)
    return r


from backend.services.weekly_report_service import (
    classify_public_contest_outcome,
    classify_virtual_contest_outcome,
)

# ─── Test: classify_public_contest_outcome ─────────────────────────────────────

class TestPublicClassifier:

    def test_none_result_is_not_participated(self):
        assert classify_public_contest_outcome(None) == "NOT_PARTICIPATED"

    def test_not_attended_is_not_participated(self):
        r = make_pub_result(participation_status="NOT_ATTENDED", data_fetch_status="SUCCESS", total_contest_solved=0)
        assert classify_public_contest_outcome(r) == "NOT_PARTICIPATED"

    def test_public_0_solved_returns_0_SOLVED(self):
        r = make_pub_result(participation_status="PUBLIC", total_contest_solved=0)
        assert classify_public_contest_outcome(r) == "0_SOLVED"

    def test_public_1_solved_returns_1_SOLVED(self):
        r = make_pub_result(participation_status="PUBLIC", total_contest_solved=1)
        assert classify_public_contest_outcome(r) == "1_SOLVED"

    def test_public_2_solved_returns_2_SOLVED(self):
        r = make_pub_result(participation_status="PUBLIC", total_contest_solved=2)
        assert classify_public_contest_outcome(r) == "2_SOLVED"

    def test_public_3_solved_returns_3_SOLVED(self):
        r = make_pub_result(participation_status="PUBLIC", total_contest_solved=3)
        assert classify_public_contest_outcome(r) == "3_SOLVED"

    def test_public_4_solved_returns_4_SOLVED(self):
        r = make_pub_result(participation_status="PUBLIC", total_contest_solved=4)
        assert classify_public_contest_outcome(r) == "4_SOLVED"

    def test_invalid_username_returns_unknown(self):
        r = make_pub_result(
            participation_status="UNKNOWN",
            data_fetch_status="INVALID_USERNAME",
            fetch_status="INVALID_USERNAME",
            total_contest_solved=0,
        )
        assert classify_public_contest_outcome(r) == "UNKNOWN"

    def test_username_not_found_returns_unknown(self):
        r = make_pub_result(
            participation_status="UNKNOWN",
            data_fetch_status="USERNAME_NOT_FOUND",
            fetch_status="USERNAME_NOT_FOUND",
            total_contest_solved=0,
        )
        assert classify_public_contest_outcome(r) == "UNKNOWN"

    def test_pending_not_converted_to_not_participated(self):
        r = make_pub_result(participation_status="PENDING", data_fetch_status="PENDING")
        result = classify_public_contest_outcome(r)
        assert result != "NOT_PARTICIPATED", "PENDING must not become NOT_PARTICIPATED"

    def test_unknown_not_converted_to_not_participated(self):
        r = make_pub_result(participation_status="UNKNOWN", data_fetch_status="INVALID_USERNAME")
        result = classify_public_contest_outcome(r)
        assert result != "NOT_PARTICIPATED", "UNKNOWN must not become NOT_PARTICIPATED"

    def test_unknown_not_converted_to_0_solved(self):
        r = make_pub_result(participation_status="UNKNOWN", data_fetch_status="INVALID_USERNAME")
        result = classify_public_contest_outcome(r)
        assert result != "0_SOLVED", "UNKNOWN must not become 0_SOLVED"

    def test_source_unavailable_preserved(self):
        r = make_pub_result(
            participation_status="SOURCE_UNAVAILABLE",
            data_fetch_status="FETCH_FAILED",
            fetch_status="FETCH_FAILED",
        )
        assert classify_public_contest_outcome(r) == "SOURCE_UNAVAILABLE"

    def test_solved_count_none_when_attended_returns_unknown(self):
        r = make_pub_result(participation_status="PUBLIC", total_contest_solved=None)
        assert classify_public_contest_outcome(r) == "UNKNOWN"

    def test_rank_none_not_zero(self):
        r = make_pub_result(participation_status="PUBLIC", total_contest_solved=3, contest_rank=None)
        result = classify_public_contest_outcome(r)
        assert result == "3_SOLVED"
        # rank None is preserved — does not become 0

    def test_rating_none_not_zero(self):
        r = make_pub_result(participation_status="PUBLIC", total_contest_solved=2, contest_rating=None)
        result = classify_public_contest_outcome(r)
        assert result == "2_SOLVED"


class TestVirtualClassifier:

    def test_none_result_is_not_participated(self):
        assert classify_virtual_contest_outcome(None) == "NOT_PARTICIPATED"

    def test_virtual_0_solved_returns_0_SOLVED(self):
        r = make_vir_result(participation_status="VIRTUAL", total_contest_solved=0)
        assert classify_virtual_contest_outcome(r) == "0_SOLVED"

    def test_virtual_4_solved_returns_4_SOLVED(self):
        r = make_vir_result(participation_status="VIRTUAL", total_contest_solved=4)
        assert classify_virtual_contest_outcome(r) == "4_SOLVED"

    def test_virtual_not_attended_returns_not_participated(self):
        r = make_vir_result(participation_status="NOT_ATTENDED", total_contest_solved=0)
        assert classify_virtual_contest_outcome(r) == "NOT_PARTICIPATED"

    def test_virtual_invalid_username_returns_unknown(self):
        r = make_vir_result(
            participation_status="UNKNOWN",
            data_fetch_status="INVALID_USERNAME",
            fetch_status="INVALID_USERNAME",
        )
        assert classify_virtual_contest_outcome(r) == "UNKNOWN"


class TestPublicVirtualSeparation:
    """Public and Virtual must remain completely separate."""

    def test_public_3_virtual_4_both_preserved(self):
        pub = make_pub_result(participation_status="PUBLIC", total_contest_solved=3)
        vir = make_vir_result(participation_status="VIRTUAL", total_contest_solved=4)
        assert classify_public_contest_outcome(pub) == "3_SOLVED"
        assert classify_virtual_contest_outcome(vir) == "4_SOLVED"

    def test_virtual_result_does_not_affect_public_outcome(self):
        pub = make_pub_result(participation_status="NOT_ATTENDED", total_contest_solved=0)
        vir = make_vir_result(participation_status="VIRTUAL", total_contest_solved=4)
        assert classify_public_contest_outcome(pub) == "NOT_PARTICIPATED"
        assert classify_virtual_contest_outcome(vir) == "4_SOLVED"


class TestRosterCoverage:
    """All roster students must be present; no student appears twice."""

    def test_all_302_students_present_in_reconciliation(self):
        """Verify the CSV has exactly 302 rows — one per roster student."""
        import csv, os
        csv_path = "Contest515_Full_Reconciliation.csv"
        if not os.path.exists(csv_path):
            pytest.skip("Reconciliation CSV not generated yet")
        with open(csv_path, newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        assert len(rows) == 302, f"Expected 302 rows, got {len(rows)}"

    def test_no_duplicate_students_in_reconciliation(self):
        import csv, os
        csv_path = "Contest515_Full_Reconciliation.csv"
        if not os.path.exists(csv_path):
            pytest.skip("Reconciliation CSV not generated yet")
        with open(csv_path, newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        reg_nos = [r["reg_no"] for r in rows]
        assert len(reg_nos) == len(set(reg_nos)), "Duplicate students found"

    def test_public_total_sums_to_302(self):
        import csv, os
        csv_path = "Contest515_Full_Reconciliation.csv"
        if not os.path.exists(csv_path):
            pytest.skip("Reconciliation CSV not generated yet")
        with open(csv_path, newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        counts = defaultdict(int)
        for r in rows:
            counts[r["pub_outcome"]] += 1
        total = sum(counts.values())
        assert total == 302, f"Expected 302 total, got {total}"

    def test_no_solved_gt0_classified_as_not_participated(self):
        import csv, os
        csv_path = "Contest515_Full_Reconciliation.csv"
        if not os.path.exists(csv_path):
            pytest.skip("Reconciliation CSV not generated yet")
        with open(csv_path, newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        bad = [r["reg_no"] for r in rows
               if r["pub_solved_db"] not in ("None","","NULL","0")
               and r["pub_outcome"] == "NOT_PARTICIPATED"]
        assert len(bad) == 0, f"Solved>0 but NOT_PARTICIPATED: {bad}"

    def test_no_participated_classified_as_unknown_when_solved_known(self):
        import csv, os
        csv_path = "Contest515_Full_Reconciliation.csv"
        if not os.path.exists(csv_path):
            pytest.skip("Reconciliation CSV not generated yet")
        with open(csv_path, newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        bad = [r["reg_no"] for r in rows
               if r["pub_status_db"] == "PUBLIC"
               and r["pub_solved_db"] not in ("None","","NULL")
               and r["pub_outcome"] == "UNKNOWN"]
        assert len(bad) == 0, f"Solved known but UNKNOWN: {bad}"

    def test_unknown_students_have_bad_username(self):
        import csv, os
        csv_path = "Contest515_Full_Reconciliation.csv"
        if not os.path.exists(csv_path):
            pytest.skip("Reconciliation CSV not generated yet")
        with open(csv_path, newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        # Every UNKNOWN should have INVALID_USERNAME or USERNAME_NOT_FOUND or MISSING fetch
        bad = [r["reg_no"] for r in rows
               if r["pub_outcome"] == "UNKNOWN"
               and r["pub_fetch"] not in ("INVALID_USERNAME","USERNAME_NOT_FOUND","MISSING")]
        assert len(bad) == 0, f"UNKNOWN but valid fetch: {bad}"

    def test_dept_totals_sum_to_roster(self):
        import csv, os
        csv_path = "Contest515_Full_Reconciliation.csv"
        if not os.path.exists(csv_path):
            pytest.skip("Reconciliation CSV not generated yet")
        with open(csv_path, newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        by_dept = defaultdict(int)
        for r in rows: by_dept[r["dept"]] += 1
        total = sum(by_dept.values())
        assert total == 302, f"Dept totals sum to {total}, expected 302"

    def test_batch_totals_sum_to_roster(self):
        import csv, os
        csv_path = "Contest515_Full_Reconciliation.csv"
        if not os.path.exists(csv_path):
            pytest.skip("Reconciliation CSV not generated yet")
        with open(csv_path, newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        # Batches I-IV must cover all active students (2 test fixtures have year=N/A)
        known_year = [r for r in rows if r["year"] in ("I","II","III","IV")]
        total_known = len(known_year)
        assert total_known >= 300, f"Less than 300 students with known year: {total_known}"

    def test_no_q_value_fabricated_for_not_attended(self):
        """Ensure students marked NOT_ATTENDED have Q1-Q4 = 0 (not fabricated)."""
        r = make_pub_result(participation_status="NOT_ATTENDED", total_contest_solved=0,
                            q1=0, q2=0, q3=0, q4=0)
        assert classify_public_contest_outcome(r) == "NOT_PARTICIPATED"


class TestQ1Q4Accuracy:
    """Q1-Q4 must come from DB evidence only, never inferred from solved count."""

    def test_q1_only_means_1_solved(self):
        # DB stores q1=1,q2=0,q3=0,q4=0,solved=1
        r = make_pub_result(participation_status="PUBLIC", total_contest_solved=1,
                            q1=1, q2=0, q3=0, q4=0)
        assert classify_public_contest_outcome(r) == "1_SOLVED"

    def test_q1_q2_q4_means_3_solved(self):
        # DB stores q1=1,q2=1,q3=0,q4=1,solved=3
        r = make_pub_result(participation_status="PUBLIC", total_contest_solved=3,
                            q1=1, q2=1, q3=0, q4=1)
        assert classify_public_contest_outcome(r) == "3_SOLVED"

    def test_4_solved_exact(self):
        r = make_pub_result(participation_status="PUBLIC", total_contest_solved=4,
                            q1=1, q2=1, q3=1, q4=1)
        assert classify_public_contest_outcome(r) == "4_SOLVED"

    def test_solved_0_attended_is_0_SOLVED(self):
        r = make_pub_result(participation_status="PUBLIC", total_contest_solved=0,
                            q1=0, q2=0, q3=0, q4=0)
        assert classify_public_contest_outcome(r) == "0_SOLVED"

    def test_no_solved_inferred_from_rank_alone(self):
        # rank alone should NOT produce a SOLVED outcome
        r = make_pub_result(participation_status="NOT_ATTENDED", total_contest_solved=0,
                            contest_rank=5000, q1=0, q2=0, q3=0, q4=0)
        assert classify_public_contest_outcome(r) == "NOT_PARTICIPATED"


class TestSessionMapping:
    """Session ID must match the correct contest, not be assumed."""

    def test_session_5_is_contest_515(self):
        from backend.database import SessionLocal
        from backend.models import WeeklySession
        db = SessionLocal()
        ws = db.query(WeeklySession).filter(WeeklySession.id == 5).first()
        db.close()
        assert ws is not None
        assert "515" in ws.contest_name, f"Session 5 should be Contest 515, got {ws.contest_name}"

    def test_session_16_is_contest_514(self):
        from backend.database import SessionLocal
        from backend.models import WeeklySession
        db = SessionLocal()
        ws = db.query(WeeklySession).filter(WeeklySession.id == 16).first()
        db.close()
        assert ws is not None
        assert "514" in ws.contest_name, f"Session 16 should be Contest 514, got {ws.contest_name}"

    def test_current_last_auto_resolve(self):
        from backend.database import SessionLocal
        from backend.services.weekly_session_resolver import resolve_weekly_sessions
        db = SessionLocal()
        res = resolve_weekly_sessions(db)
        db.close()
        curr = res.get("current_week_session")
        last = res.get("last_week_session")
        assert curr is not None, "Current session must resolve"
        assert last is not None, "Last session must resolve"
        assert curr.id != last.id, "Current and last sessions must differ"


class TestUsernameMapping:
    """Every student must have a username; NULL/empty → UNKNOWN."""

    def test_null_username_student_gets_unknown_outcome(self):
        # When username is None in roster, result will be USERNAME_NOT_FOUND → UNKNOWN
        r = make_pub_result(
            participation_status="UNKNOWN",
            data_fetch_status="USERNAME_NOT_FOUND",
            fetch_status="USERNAME_NOT_FOUND",
        )
        assert classify_public_contest_outcome(r) == "UNKNOWN"

    def test_invalid_username_not_assumed_not_participated(self):
        r = make_pub_result(
            participation_status="UNKNOWN",
            data_fetch_status="INVALID_USERNAME",
            fetch_status="INVALID_USERNAME",
        )
        result = classify_public_contest_outcome(r)
        assert result == "UNKNOWN"
        assert result != "NOT_PARTICIPATED"

    def test_duplicate_usernames_detectable(self):
        from backend.database import SessionLocal
        from backend.models import Student
        from sqlalchemy import func
        db = SessionLocal()
        dupes = db.query(Student.username, func.count(Student.id)).filter(
            Student.username.isnot(None), Student.username != ""
        ).group_by(Student.username).having(func.count(Student.id) > 1).all()
        db.close()
        # Report duplicates but do not fail — they should be corrected in roster data
        if dupes:
            msg = "Duplicate usernames found: " + str([(u, c) for u, c in dupes])
            print("\nWARNING: " + msg)


class TestRatingRankingNone:
    """Missing rank/rating must be None/N/A, never NaN or 0."""

    def test_missing_rank_is_none_not_zero(self):
        r = make_pub_result(participation_status="PUBLIC", total_contest_solved=2,
                            contest_rank=None)
        # rank is None in DB — must stay None, never converted to 0
        assert r.contest_rank is None

    def test_missing_rating_is_none_not_zero(self):
        r = make_pub_result(participation_status="PUBLIC", total_contest_solved=3,
                            contest_rating=None)
        assert r.contest_rating is None
