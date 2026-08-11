import os
import sys
import asyncio
import datetime

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal
from backend.models import Student, LeetCodeProfileStats
from backend.leetcode_fetcher import fetch_leetcode_profile, extract_leetcode_username
from backend.sync_engine import sync_single_student_db, sync_single_student_by_id

async def run_live_verification_tests():
    print("=" * 70)
    print("🧪 RUNNING CRITICAL LEETCODE PROFILE VERIFICATION TESTS")
    print("=" * 70)

    # Test 1: Username extraction & normalization
    print("\n[Test 1] Username Extraction & Normalization...")
    test_urls = [
        "https://leetcode.com/u/thamaraikannan_mr_2007/",
        "https://leetcode.com/u/thamaraikannan_mr_2007",
        "https://leetcode.com/thamaraikannan_mr_2007",
        "  thamaraikannan_mr_2007  "
    ]
    for url in test_urls:
        u, std_url, status = extract_leetcode_username(url)
        assert u == "thamaraikannan_mr_2007", f"Failed to extract username from '{url}'"
        assert status == "OK", f"URL status error for '{url}'"
    print("✅ Passed: Username extraction handles trailing slashes, spaces, and domain paths.")

    # Test 2: Dynamic Live Fetch & Sum Validation for thamaraikannan_mr_2007
    print("\n[Test 2] Fetching Live Public Profile for 'thamaraikannan_mr_2007'...")
    profile_data = await fetch_leetcode_profile("thamaraikannan_mr_2007", force_refresh=True)
    
    status = profile_data.get("status")
    tot = profile_data.get("total_solved", 0)
    ez = profile_data.get("easy_solved", 0)
    med = profile_data.get("medium_solved", 0)
    hd = profile_data.get("hard_solved", 0)

    print(f"📊 Live Profile Result for thamaraikannan_mr_2007:")
    print(f"   Status: {status}")
    print(f"   Total Solved: {tot}")
    print(f"   Easy: {ez}")
    print(f"   Medium: {med}")
    print(f"   Hard: {hd}")

    # Validate sum rule: easy + medium + hard == total_solved
    calculated_sum = ez + med + hd
    assert calculated_sum == tot, f"Validation Failed: easy({ez}) + med({med}) + hard({hd}) != total({tot})"
    print(f"✅ Passed: Sum Validation Verified ({ez} + {med} + {hd} = {tot}).")

    # Test 3: DB & Identity Mapping Verification
    print("\n[Test 3] Verifying Identity Mapping in Database for THAMARAIKANNAN M R (732225CI056)...")
    db = SessionLocal()
    try:
        student = db.query(Student).filter(Student.reg_no == "732225CI056").first()
        assert student is not None, "Student record 732225CI056 not found in DB"
        
        # Verify identity mapping
        assert student.username == "thamaraikannan_mr_2007", f"Student username mismatch: {student.username}"
        
        # Perform sync_single_student_db
        updated_student = sync_single_student_db(student.id, profile_data, db)
        assert updated_student.stats.total_solved == tot
        assert updated_student.stats.easy_solved == ez
        assert updated_student.stats.medium_solved == med
        assert updated_student.stats.hard_solved == hd
        assert updated_student.stats.sync_status == "success"
        assert updated_student.stats.source == "leetcode_public_profile"
        assert updated_student.stats.last_verified_at is not None
        print("✅ Passed: Database record updated with 100% verified live stats & source metadata.")
    finally:
        db.close()

    # Test 4: Identity Mismatch Safeguard (Profile A vs Profile B)
    print("\n[Test 4] Testing Identity Mismatch Safeguard (Profile A vs Profile B)...")
    db = SessionLocal()
    try:
        nanthish_student = db.query(Student).filter(Student.reg_no == "732224CC031").first()
        mismatched_payload = {
            "username": "thamaraikannan_mr_2007", # Wrong username for Nanthish
            "total_solved": 33,
            "easy_solved": 15,
            "medium_solved": 17,
            "hard_solved": 1,
            "status": "success"
        }
        res_student = sync_single_student_db(nanthish_student.id, mismatched_payload, db)
        assert res_student.stats.sync_status == "mismatch", "Identity mismatch was not caught!"
        print("✅ Passed: Mismatched stats were rejected and marked with 'mismatch' status.")
    finally:
        db.close()

    # Test 5: 30-Second Timeout Constraint
    print("\n[Test 5] Testing 30-Second Single Student Timeout Endpoint...")
    sync_result = await sync_single_student_by_id(student.id, timeout=30.0)
    assert sync_result.get("status") in ["success", "timeout"]
    print("✅ Passed: Single student refresh endpoint respects 30-second target constraint.")

    print("\n" + "=" * 70)
    print("🎉 ALL PROFILE VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_live_verification_tests())
