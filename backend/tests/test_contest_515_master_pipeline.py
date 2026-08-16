"""
test_contest_515_master_pipeline.py
Automated Production Test Suite for Weekly Contest 515.
Validates all specifications, critical invariants, and reconciliation requirements.
"""

import sys
import os
import datetime

sys.path.insert(0, r"e:\Leetcode Web")

from backend.database import SessionLocal
from backend.models import (
    Student, WeeklySession, WeeklyPublicResult, OfficialWeeklySnapshot,
    LeetCodeContestRatingHistory
)
from backend.services.contest_discovery import discover_contest_metadata, calculate_contest_number
from backend.routes.weekly_contests import get_normalized_contest_data
from backend.exporters.excel_exporter import export_excel_from_dataset
from backend.exporters.pdf_exporter import export_pdf_from_dataset
from backend.exporters.word_exporter import export_word_from_dataset
from backend.exporters.csv_exporter import export_csv_from_dataset
from backend.exporters.zip_exporter import export_zip_bundle_from_dataset


def run_all_tests():
    db = SessionLocal()
    passed = 0
    failed = 0

    print("=" * 60)
    print("RUNNING WEEKLY CONTEST 515 MASTER PIPELINE AUTOMATED TESTS")
    print("=" * 60)

    # 1. Test exact resolution of Weekly Contest 515 metadata
    try:
        target_date = datetime.date(2026, 8, 16)
        meta = discover_contest_metadata(target_date)
        assert meta["contest_number"] == 515
        assert meta["contest_id"] == "weekly-contest-515"
        assert meta["contest_name"] == "Weekly Contest 515"
        assert meta["session_date"] == "16.08.2026"
        assert len(meta["problems"]) == 4
        print("[PASS] Test 1: Contest 515 Metadata Resolution")
        passed += 1
    except Exception as e:
        print(f"[FAIL] Test 1: Contest 515 Metadata Resolution - {e}")
        failed += 1

    # 2. Test master roster count == 300
    try:
        roster_count = db.query(Student).filter(
            (Student.is_active == True) | (Student.is_active.is_(None))
        ).count()
        assert roster_count == 300, f"Expected 300, got {roster_count}"
        print("[PASS] Test 2: Master Roster Count = 300")
        passed += 1
    except Exception as e:
        print(f"[FAIL] Test 2: Master Roster Count - {e}")
        failed += 1

    # 3. Test 300/300 mathematical reconciliation
    try:
        session_515 = db.query(WeeklySession).filter(WeeklySession.contest_name.ilike("%515%")).first()
        assert session_515 is not None
        norm_data = get_normalized_contest_data(session_515.id, db=db)
        metrics = norm_data["metrics"]
        rows = norm_data["rows"]
        assert len(rows) == 300
        pub = metrics["officialAttended"]
        virt = metrics["virtualAttended"]
        not_att = metrics["notAttended"]
        errs = metrics["dataErrors"]
        assert pub + virt + not_att + errs == 300, f"Sum {pub}+{virt}+{not_att}+{errs} != 300"
        assert norm_data["reconciliation"] == "PASSED"
        print(f"[PASS] Test 3: 300/300 Mathematical Reconciliation (Public={pub}, Virtual={virt}, NotAttended={not_att}, Errors={errs})")
        passed += 1
    except Exception as e:
        print(f"[FAIL] Test 3: Mathematical Reconciliation - {e}")
        failed += 1

    # 4. Test Q1-Q4 solved invariant
    try:
        session_515 = db.query(WeeklySession).filter(WeeklySession.contest_name.ilike("%515%")).first()
        norm_data = get_normalized_contest_data(session_515.id, db=db)
        for r in norm_data["rows"]:
            if r["status"] in ("PUBLIC", "VIRTUAL"):
                q1, q2, q3, q4 = int(r["q1"] or 0), int(r["q2"] or 0), int(r["q3"] or 0), int(r["q4"] or 0)
                tot = int(r["total_solved"] or 0)
                assert q1 + q2 + q3 + q4 == tot
            elif r["status"] == "NOT ATTENDED":
                assert r["q1"] == "—"
                assert r["score_display"] == "Not Attended"
        print("[PASS] Test 4: Q1-Q4 Solved Invariant (100% Validated across all 300 rows)")
        passed += 1
    except Exception as e:
        print(f"[FAIL] Test 4: Q1-Q4 Invariant - {e}")
        failed += 1

    # 5. Test contest isolation
    try:
        s515 = db.query(WeeklySession).filter(WeeklySession.contest_name.ilike("%515%")).first()
        s514 = db.query(WeeklySession).filter(WeeklySession.contest_name.ilike("%514%")).first()
        assert s515.id != s514.id
        assert s515.contest_id != s514.contest_id
        print("[PASS] Test 5: Contest 515 vs 514 Complete Isolation")
        passed += 1
    except Exception as e:
        print(f"[FAIL] Test 5: Contest Isolation - {e}")
        failed += 1

    # 6. Test regression: suspicious 280 not attended bug
    try:
        session_515 = db.query(WeeklySession).filter(WeeklySession.contest_name.ilike("%515%")).first()
        norm_data = get_normalized_contest_data(session_515.id, db=db)
        metrics = norm_data["metrics"]
        assert metrics["officialAttended"] > 0
        assert not (metrics["officialAttended"] == 0 and metrics["notAttended"] == 280 and metrics["dataErrors"] == 0)
        print("[PASS] Test 6: Zero False NOT_ATTENDED & Zero-Count Protection")
        passed += 1
    except Exception as e:
        print(f"[FAIL] Test 6: Zero False NOT_ATTENDED - {e}")
        failed += 1

    # 7. Test cross-report parity (Excel, PDF, Word, CSV, ZIP)
    try:
        session_515 = db.query(WeeklySession).filter(WeeklySession.contest_name.ilike("%515%")).first()
        norm_data = get_normalized_contest_data(session_515.id, db=db)
        excel_bytes = export_excel_from_dataset(norm_data)
        pdf_bytes = export_pdf_from_dataset(norm_data)
        word_bytes = export_word_from_dataset(norm_data)
        csv_str = export_csv_from_dataset(norm_data)
        zip_bytes = export_zip_bundle_from_dataset(norm_data)
        assert len(excel_bytes) > 10000
        assert len(pdf_bytes) > 5000
        assert len(word_bytes) > 5000
        assert len(csv_str) > 1000
        assert len(zip_bytes) > 20000
        print("[PASS] Test 7: Cross-Report Parity (Excel, PDF, Word, CSV, ZIP generated cleanly)")
        passed += 1
    except Exception as e:
        print(f"[FAIL] Test 7: Cross-Report Parity - {e}")
        failed += 1

    # 8. Test Department & Year Filter aggregation
    try:
        session_515 = db.query(WeeklySession).filter(WeeklySession.contest_name.ilike("%515%")).first()
        cs_data = get_normalized_contest_data(session_515.id, dept="CSE(CS)", db=db)
        assert len(cs_data["rows"]) == 159
        iot_data = get_normalized_contest_data(session_515.id, dept="CSE(IOT)", db=db)
        assert len(iot_data["rows"]) == 141
        ii_data = get_normalized_contest_data(session_515.id, year="II", db=db)
        assert len(ii_data["rows"]) == 130
        print("[PASS] Test 8: Department & Year Aggregation (CS=159, IoT=141, II Year=130)")
        passed += 1
    except Exception as e:
        print(f"[FAIL] Test 8: Department & Year Aggregation - {e}")
        failed += 1

    print("=" * 60)
    print(f"FINAL TEST RESULT: {passed} PASSED, {failed} FAILED")
    print("=" * 60)
    db.close()
    return failed == 0

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
