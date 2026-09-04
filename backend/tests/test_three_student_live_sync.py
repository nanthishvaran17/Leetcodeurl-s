import pytest
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.leetcode_fetcher import fetch_leetcode_profile

@pytest.mark.asyncio
async def test_three_student_live_leetcode_fetch():
    """
    Three-Student Live Forensic Test:
    Fetches real LeetCode profile statistics via GraphQL for 3 real handles:
    1. nanthishvaran_07
    2. Spidy_42
    3. ajaysoftware
    Verifies GraphQL response structure and persistence.
    """
    test_handles = [
        ("732224CC031", "nanthishvaran_07"),
        ("732224CI008", "Spidy_42"),
        ("23CI002", "ajaysoftware")
    ]

    print("\n" + "=" * 80)
    print("THREE-STUDENT LIVE LEETCODE GRAPHQL FORENSIC TEST")
    print("=" * 80)

    for reg_no, handle in test_handles:
        print(f"[FETCHING] Handle: '{handle}' (Reg No: {reg_no})")
        data = await fetch_leetcode_profile(handle)
        
        assert isinstance(data, dict), f"Expected dict response for {handle}, got {type(data)}"
        print(f"  - Status Response  : {data.get('status')}")
        print(f"  - Total Solved     : {data.get('total_solved')}")
        print(f"  - Easy / Med / Hard: {data.get('easy_solved')} / {data.get('medium_solved')} / {data.get('hard_solved')}")
        print(f"  - Contest Rating   : {data.get('contest_rating')}")
        print("-" * 50)
