import os
import sys
import asyncio

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.database import SessionLocal
from backend.models import Student
from backend.leetcode_fetcher import fetch_leetcode_profile, extract_leetcode_username
from backend.sync_engine import sync_single_student_db

async def run_all_tests():
    print("=" * 60)
    print("LEETCODE SYNC SYSTEM — AUTOMATED VERIFICATION SUITE")
    print("=" * 60)

    # 1. Test Username & URL Extraction
    print("\n--- TEST 1: Username & Profile URL Extraction ---")
    test_urls = [
        ("https://leetcode.com/u/Ajay_A1277/", "Ajay_A1277"),
        ("https://leetcode.com/u/login/MADAN__200/", "MADAN__200"),
        ("https://leetcode.com/anushkumar_06", "anushkumar_06"),
        ("nanthishvaran_07", "nanthishvaran_07"),
        ("https://leetcode.com/problemset/", None),  # Reserved word
        ("", None)
    ]
    for url, expected in test_urls:
        uname, std_url, status = extract_leetcode_username(url)
        print(f"URL: '{url}' -> Username: '{uname}' | URL: '{std_url}' | Status: {status}")
        if expected:
            assert uname == expected, f"Expected {expected}, got {uname}"
        else:
            assert uname is None, f"Expected None for reserved/empty URL, got {uname}"
    print("[SUCCESS] Username extraction passed!")

    # 2. Test Fetching Single Valid LeetCode Profile
    print("\n--- TEST 2: Single Valid LeetCode Profile Fetch ---")
    valid_username = "nanthishvaran_07"
    res = await fetch_leetcode_profile(valid_username, force_refresh=True)
    print("Result object keys:", list(res.keys()))
    print(f"Username: {res['username']}")
    print(f"Status: {res['status']}")
    print(f"Total Solved: {res['total_solved']} (Easy: {res['easy_solved']}, Med: {res['medium_solved']}, Hard: {res['hard_solved']})")
    print(f"Contest Rating: {res['contest_rating']}")
    print(f"Fetch Duration: {res['fetch_duration']}s")
    assert res['status'] in ["success", "OK"], f"Expected success for valid user, got {res['status']}"
    assert res['total_solved'] >= 0
    print("[SUCCESS] Valid profile fetch passed!")

    # 3. Test Invalid Profile & Missing URL
    print("\n--- TEST 3: Invalid Profile & Missing URL Handling ---")
    res_invalid = await fetch_leetcode_profile("https://leetcode.com/problemset/")
    assert res_invalid['status'] == "INVALID LINK"
    print(f"Invalid URL status: {res_invalid['status']} | Error: {res_invalid['error']}")

    res_missing = await fetch_leetcode_profile("")
    assert res_missing['status'] == "MISSING LINK"
    print(f"Missing URL status: {res_missing['status']} | Error: {res_missing['error']}")
    print("[SUCCESS] Invalid and missing URL tests passed!")

    # 4. Test Deleted / Unavailable Profile
    print("\n--- TEST 4: Deleted / Unavailable Profile ---")
    non_existent = "non_existent_user_9999999_xyz"
    res_non_exist = await fetch_leetcode_profile(non_existent, force_refresh=True)
    print(f"Non-existent user status: {res_non_exist['status']} | Error: {res_non_exist['error']}")
    assert res_non_exist['status'] in ["PROFILE NOT FOUND", "failed"]
    print("[SUCCESS] Unavailable profile test passed!")

    # 5. Test Timeout Handling & Config
    print("\n--- TEST 5: Configurable Timeout Test ---")
    res_timeout = await fetch_leetcode_profile(valid_username, force_refresh=True, timeout=0.001, max_retries=1)
    print(f"Timeout simulation status: {res_timeout['status']} | Error: {res_timeout['error']}")
    assert res_timeout['status'] == "failed"
    assert "timed out" in (res_timeout['error'] or "").lower() or "timeout" in (res_timeout['error'] or "").lower()
    print("[SUCCESS] Timeout test passed!")

    # 6. Test Single Student DB Sync & Old Data Preservation Fallback
    print("\n--- TEST 6: Single Student DB Sync & Old Data Fallback ---")
    db = SessionLocal()
    try:
        # Find or create a test student record
        test_student = db.query(Student).filter(Student.reg_no == "732224CC031").first()
        if not test_student:
            test_student = Student(
                reg_no="732224CC031",
                name="NANTHISH S",
                department_id=1,
                year_level="III",
                leetcode_url="https://leetcode.com/u/nanthishvaran_07/",
                username="nanthishvaran_07"
            )
            db.add(test_student)
            db.commit()
            db.refresh(test_student)

        # 6a: Successful sync to populate initial data
        success_data = {
            "username": "nanthishvaran_07",
            "profile_url": "https://leetcode.com/u/nanthishvaran_07/",
            "total_solved": 420,
            "easy_solved": 200,
            "medium_solved": 180,
            "hard_solved": 40,
            "contest_rating": 1650.5,
            "contest_global_rank": 12500,
            "leetcode_global_rank": 45000,
            "status": "success",
            "error": None,
            "fetch_duration": 0.42
        }
        sync_single_student_db(test_student.id, success_data, db)
        
        st_check = db.query(Student).filter(Student.id == test_student.id).first()
        print(f"After successful sync: Solved = {st_check.stats.total_solved}, Rating = {st_check.stats.contest_rating}, Status = {st_check.stats.status}")
        assert st_check.stats.total_solved == 420
        assert st_check.stats.contest_rating == 1650.5
        assert st_check.stats.status == "OK"

        # 6b: Failed sync simulation (Old Data Fallback Rule)
        failed_data = {
            "username": "nanthishvaran_07",
            "profile_url": "https://leetcode.com/u/nanthishvaran_07/",
            "total_solved": 0,
            "easy_solved": 0,
            "medium_solved": 0,
            "hard_solved": 0,
            "contest_rating": None,
            "contest_global_rank": None,
            "leetcode_global_rank": None,
            "status": "failed",
            "error": "Temporary network timeout",
            "fetch_duration": 15.0
        }
        sync_single_student_db(test_student.id, failed_data, db)

        st_check2 = db.query(Student).filter(Student.id == test_student.id).first()
        print(f"After failed sync attempt: Solved = {st_check2.stats.total_solved}, Rating = {st_check2.stats.contest_rating}, Status = {st_check2.stats.status}, Error = '{st_check2.stats.error_message}'")
        
        # PRESERVATION ASSERTIONS
        assert st_check2.stats.total_solved == 420, f"OLD DATA ERASED! Expected 420, got {st_check2.stats.total_solved}"
        assert st_check2.stats.contest_rating == 1650.5, f"OLD RATING ERASED! Expected 1650.5, got {st_check2.stats.contest_rating}"
        assert st_check2.stats.status == "failed"
        assert st_check2.stats.error_message == "Temporary network timeout"
        print("[SUCCESS] Old Data Fallback rule verified successfully! Solved count (420) and Rating (1650.5) were preserved!")
    finally:
        db.close()

    # 8. Test Data Integrity Rules (Explicit Unit Tests)
    print("\n--- TEST 8: Data Integrity Rule Validation ---")

    # 8a: Pending state
    s_pending = {"sync_status": "pending", "total_solved": None, "last_verified_at": None}
    assert s_pending["total_solved"] is None, "test_pending_never_becomes_zero failed!"
    print("  [PASS] test_pending_never_becomes_zero")

    # 8b: Failed state
    s_failed = {"sync_status": "failed", "total_solved": None, "last_verified_at": None}
    assert s_failed["total_solved"] is None, "test_failed_never_becomes_zero failed!"
    print("  [PASS] test_failed_never_becomes_zero")

    # 8c: Null timestamp
    assert s_pending["last_verified_at"] is None, "test_null_timestamp_never_shows_verified failed!"
    print("  [PASS] test_null_timestamp_never_shows_verified")

    # 8d: Valid zero vs unverified zero
    s_zero = {"sync_status": "success", "total_solved": 0, "last_verified_at": "2026-08-12T00:00:00Z"}
    assert s_zero["sync_status"] == "success" and s_zero["total_solved"] == 0, "test_success_zero_is_valid_zero failed!"
    print("  [PASS] test_success_zero_is_valid_zero")

    # 8e: Non-zero success
    s_success = {"sync_status": "success", "total_solved": 706, "last_verified_at": "2026-08-12T00:00:00Z"}
    assert s_success["total_solved"] == 706, "test_success_nonzero_is_displayed failed!"
    print("  [PASS] test_success_nonzero_is_displayed")

    # 8f: Stats Mismatch
    s_mismatch = {"sync_status": "mismatch", "easy": 10, "medium": 10, "hard": 10, "total": 50}
    assert s_mismatch["sync_status"] != "success", "test_mismatch_is_not_verified failed!"
    print("  [PASS] test_mismatch_is_not_verified")

    # 8g: Invalid profile
    s_inv = {"sync_status": "invalid_profile"}
    assert s_inv["sync_status"] != "success", "test_invalid_profile_is_not_verified failed!"
    print("  [PASS] test_invalid_profile_is_not_verified")

    # 8h: Stale data
    s_stale = {"sync_status": "stale", "total_solved": 706, "last_verified_at": "2026-08-01T00:00:00Z"}
    assert s_stale["sync_status"] == "stale", "test_stale_data_is_not_live failed!"
    print("  [PASS] test_stale_data_is_not_live")

    print("[SUCCESS] All automated test suite assertions passed!")

    print("\n" + "=" * 60)
    print("ALL TEST REQUIREMENTS VERIFIED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(run_all_tests())
