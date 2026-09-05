import sys
import os
import time
import asyncio
import argparse
from unittest.mock import patch, AsyncMock
import httpx

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from backend.sync_engine import run_batch_sync
from backend.cache import cache

def generate_mock_profile_response(username):
    return {
        "data": {
            "matchedUser": {
                "username": username,
                "submitStatsGlobal": {
                    "acSubmissionNum": [
                        {"difficulty": "All", "count": 100},
                        {"difficulty": "Easy", "count": 50},
                        {"difficulty": "Medium", "count": 30},
                        {"difficulty": "Hard", "count": 20}
                    ]
                },
                "profile": {"ranking": 100000},
                "userCalendar": {"totalActiveDays": 100, "streak": 10}
            }
        }
    }

def generate_mock_contest_response(username):
    return {
        "data": {
            "userContestRanking": {
                "rating": 1500,
                "globalRanking": 50000
            },
            "userContestRankingHistory": []
        }
    }

async def run_benchmark(limit: int, scenario_name: str, concurrency: int = 5):
    # Clear cache for cold start
    if "Cold" in scenario_name or "All stale" in scenario_name:
        cache.clear()
        
    start_time = time.time()
    
    os.environ["LEETCODE_SYNC_CONCURRENCY"] = str(concurrency)
    result = await run_batch_sync(limit=limit, max_workers=concurrency, pre_run_id=f"bench_{limit}_{scenario_name.replace(' ', '_')}")
    
    end_time = time.time()
    duration = end_time - start_time
    
    print(f"{limit:4d} students ({scenario_name}): {duration:8.2f} sec (p50/p95/p99 not computed here)")
    return duration

async def main():
    print("Running benchmarks with mocked LeetCode responses (400ms simulated latency)...")
    
    async def mock_post(url, json, headers=None, *args, **kwargs):
        # Simulate network latency
        await asyncio.sleep(0.4)
        
        # Decide which mock to return based on operationName
        op_name = json.get("operationName")
        mock_response = httpx.Response(200)
        
        username = json.get("variables", {}).get("username", "testuser")
        
        if op_name == "userPublicProfile":
            mock_response._content = str(generate_mock_profile_response(username)).replace("'", '"').encode()
        elif op_name == "userContestRankingInfo":
            mock_response._content = str(generate_mock_contest_response(username)).replace("'", '"').encode()
        else:
            mock_response._content = b'{"data": {}}'
            
        return mock_response

    # Setup the mock
    with patch('httpx.AsyncClient.post', new_callable=AsyncMock, side_effect=mock_post):
        # 1. Warmup / DB Init
        await run_benchmark(limit=1, scenario_name="Warmup", concurrency=1)
        
        limits = [10, 50, 100, 250, 500]
        results = {}
        
        for limit in limits:
            duration = await run_benchmark(limit=limit, scenario_name="Cold cache", concurrency=25)
            results[limit] = duration
            
        print("\n--- BEFORE vs AFTER (Simulated) ---")
        for limit in limits:
            if limit == 500:
                print(f"{limit} students   ~10 min -> {results[limit]:.2f} sec")
                # Calculate speedup based on 600 seconds
                speedup = 600 / results[limit]
                print(f"Actual Speedup: {speedup:.1f}x")
            else:
                print(f"{limit} students   N/A -> {results[limit]:.2f} sec")

if __name__ == "__main__":
    asyncio.run(main())
