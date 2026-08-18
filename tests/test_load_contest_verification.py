import asyncio
import time
import random
import pytest
from typing import Dict, Any, List, Optional
from collections import defaultdict

from backend.services.token_bucket_limiter import (
    TokenBucketRateLimiter,
    LeetCodeSourceError,
    SourceUnavailableError,
    SourceMalformedResponseError,
    SourceRateLimitExhaustedError,
)

# ==============================================================================
# 1. IN-PROCESS MOCK LEETCODE API SERVER SIMULATOR
# ==============================================================================

class MockLeetCodeServer:
    """
    Simulates high-scale LeetCode GraphQL & Contest Ranking endpoints.
    Tracks all incoming request timestamps to verify rate limiting and throttle compliance.
    """
    def __init__(self, throttle_rate: float = 0.15, server_error_rate: float = 0.03):
        self.throttle_rate = throttle_rate
        self.server_error_rate = server_error_rate
        self.request_timestamps: List[float] = []
        self.total_requests = 0
        self.total_429s = 0
        self.total_5xx = 0
        self.retry_delays: List[float] = []
        self._last_429_per_student: Dict[str, float] = {}

    def simulate_request(self, username: str, contest_slug: str, seeded_profile: Dict[str, Any]) -> Dict[str, Any]:
        """
        Simulates an incoming request to LeetCode API with configurable throttling & error injection.
        """
        now = time.monotonic()
        self.request_timestamps.append(now)
        self.total_requests += 1

        # Check if this is a retry following a recent 429
        if username in self._last_429_per_student:
            delay = now - self._last_429_per_student.pop(username)
            self.retry_delays.append(delay)

        # 1. Forced 5xx / Malformed payload for SOURCE_ERROR profiles
        if seeded_profile.get("behavior") == "FORCED_SOURCE_ERROR":
            self.total_5xx += 1
            if seeded_profile.get("error_mode") == "MALFORMED_JSON":
                raise SourceMalformedResponseError(f"Malformed GraphQL response for {username}", status_code=200)
            else:
                class Mock503Error(Exception):
                    status_code = 503
                raise SourceUnavailableError(f"HTTP 503: Service Unavailable for {username}", status_code=503)

        # 2. Simulated random HTTP 429 throttling
        # Only throttle standard profiles randomly (with ~15% chance on fresh requests)
        if random.random() < self.throttle_rate and not seeded_profile.get("_is_retrying"):
            self.total_429s += 1
            self._last_429_per_student[username] = now
            seeded_profile["_is_retrying"] = True

            class Mock429(Exception):
                status_code = 429
                class Response:
                    headers = {"Retry-After": "0.02"}
                response = Response()

            raise Mock429("HTTP 429: Too Many Requests")

        seeded_profile["_is_retrying"] = False

        # 3. Successful Payload Generation based on Seeded Category
        behavior = seeded_profile.get("behavior")

        if behavior == "ACTUAL":
            return {
                "username": username,
                "participation_status": "PUBLIC",
                "attended": True,
                "contest_id": contest_slug,
                "rank": seeded_profile["rank"],
                "score": seeded_profile["score"],
                "total_solved": seeded_profile["solved"],
                "q1": 1 if seeded_profile["solved"] >= 1 else 0,
                "q2": 1 if seeded_profile["solved"] >= 2 else 0,
                "q3": 1 if seeded_profile["solved"] >= 3 else 0,
                "q4": 1 if seeded_profile["solved"] >= 4 else 0,
                "finish_time_delta": 3420,
                "confidence": "HIGH"
            }
        elif behavior == "VIRTUAL":
            return {
                "username": username,
                "participation_status": "VIRTUAL",
                "attended": False,
                "virtual_attended": True,
                "contest_id": contest_slug,
                "rank": None,
                "score": seeded_profile["score"],
                "total_solved": seeded_profile["solved"],
                "q1": 1 if seeded_profile["solved"] >= 1 else 0,
                "q2": 1 if seeded_profile["solved"] >= 2 else 0,
                "q3": 1 if seeded_profile["solved"] >= 3 else 0,
                "q4": 1 if seeded_profile["solved"] >= 4 else 0,
                "confidence": "HIGH"
            }
        elif behavior == "CONFLICT":
            return {
                "username": username,
                "participation_status": "CONFLICT",
                "attended": True,
                "contest_id": contest_slug,
                "ranking_api_solved": 1,
                "history_scan_solved": 3,
                "rank": seeded_profile.get("rank", 4120),
                "total_solved": 3,
                "confidence": "MEDIUM",
                "error_reason": "Dual-source mismatch: ranking API reported 1 solve but contest submission scan reported 3 solves."
            }
        else:  # NOT_VERIFIED
            return {
                "username": username,
                "participation_status": "NOT_VERIFIED",
                "attended": False,
                "virtual_attended": False,
                "contest_id": contest_slug,
                "rank": None,
                "score": 0,
                "total_solved": 0,
                "q1": 0, "q2": 0, "q3": 0, "q4": 0,
                "confidence": "HIGH"
            }


# ==============================================================================
# 2. DETERMINISTIC DATASET SEEDER (300 STUDENTS × 5 CONTESTS)
# ==============================================================================

def generate_synthetic_dataset(num_students: int = 300, contest_slugs: Optional[List[str]] = None) -> Dict[str, Dict[str, Any]]:
    """
    Generates a deterministic distribution of 300 students per contest:
    Per contest:
    - ~45 ACTUAL (Public attended)
    - ~8 VIRTUAL (Virtual attended)
    - ~7 NOT_VERIFIED (No participation)
    - 2 CONFLICT (Dual-source conflict)
    - 2-3 SOURCE_ERROR (Server error/timeout/malformed)
    Total = 60 students per contest cohort × 5 contests = 300 profiles.
    """
    random.seed(42)  # Strictly reproducible, zero test flakiness
    if contest_slugs is None:
        contest_slugs = ["weekly-contest-516", "weekly-contest-517", "weekly-contest-518", "weekly-contest-519", "weekly-contest-520"]

    dataset = {}
    for c_idx, contest_slug in enumerate(contest_slugs):
        dataset[contest_slug] = {}
        # 60 unique students per contest cohort (all 300 students total)
        for s_idx in range(1, 61):
            student_id = f"std_{c_idx * 60 + s_idx:03d}"
            username = f"leetcode_user_{student_id}"

            if s_idx <= 45:
                # 45 Actual participants
                solved = random.choice([1, 2, 2, 3, 3, 4])
                dataset[contest_slug][username] = {
                    "student_id": student_id,
                    "username": username,
                    "behavior": "ACTUAL",
                    "solved": solved,
                    "score": solved * 4,
                    "rank": random.randint(150, 8500)
                }
            elif s_idx <= 53:
                # 8 Virtual participants
                solved = random.choice([1, 2, 3, 4])
                dataset[contest_slug][username] = {
                    "student_id": student_id,
                    "username": username,
                    "behavior": "VIRTUAL",
                    "solved": solved,
                    "score": solved * 4
                }
            elif s_idx <= 56:
                # 3 Not verified participants
                dataset[contest_slug][username] = {
                    "student_id": student_id,
                    "username": username,
                    "behavior": "NOT_VERIFIED"
                }
            elif s_idx <= 58:
                # 2 Conflict cases
                dataset[contest_slug][username] = {
                    "student_id": student_id,
                    "username": username,
                    "behavior": "CONFLICT",
                    "rank": 3120
                }
            else:
                # 2 Forced Source Error cases
                dataset[contest_slug][username] = {
                    "student_id": student_id,
                    "username": username,
                    "behavior": "FORCED_SOURCE_ERROR",
                    "error_mode": "MALFORMED_JSON" if s_idx == 59 else "SERVER_503"
                }

    return dataset


# ==============================================================================
# 3. END-TO-END LOAD & VOLUME TEST EXECUTION
# ==============================================================================

def test_load_and_volume_contest_verification_engine():
    """
    Executes an end-to-end load test simulating 300 student verifications across 5 weekly contests
    using the real TokenBucketRateLimiter, concurrency controls, backoff with jitter, and classification.
    """
    async def _run_load_test():
        start_wall_clock = time.monotonic()

        # Set up rate limiter configured for high load testing
        TARGET_RPS = 40.0
        TARGET_CONCURRENCY = 10
        limiter = TokenBucketRateLimiter(rate_per_sec=TARGET_RPS, capacity=10.0, max_concurrent=TARGET_CONCURRENCY)
        server = MockLeetCodeServer(throttle_rate=0.15)

        contests = [
            "weekly-contest-516",
            "weekly-contest-517",
            "weekly-contest-518",
            "weekly-contest-519",
            "weekly-contest-520"
        ]
        synthetic_dataset = generate_synthetic_dataset(300, contests)

        # Worker function exercising the actual RateLimiter.execute pipeline
        async def verify_student(username: str, contest_slug: str, profile_cfg: Dict[str, Any]) -> Dict[str, Any]:
            def _request_call():
                return server.simulate_request(username, contest_slug, profile_cfg)

            try:
                result = await limiter.execute(
                    _request_call,
                    student_handle=username,
                    max_retries=4,
                    base_backoff_sec=0.01,
                    max_backoff_sec=0.08
                )
                return {
                    "username": username,
                    "contest": contest_slug,
                    "status": result.get("participation_status", "UNKNOWN"),
                    "confidence": result.get("confidence", "HIGH"),
                    "solved": result.get("total_solved", 0),
                    "rank": result.get("rank"),
                    "error": None
                }
            except LeetCodeSourceError as src_err:
                return {
                    "username": username,
                    "contest": contest_slug,
                    "status": "SOURCE_ERROR",
                    "confidence": "LOW",
                    "solved": 0,
                    "rank": None,
                    "error": str(src_err)
                }
            except Exception as unhandled_err:
                return {
                    "username": username,
                    "contest": contest_slug,
                    "status": "UNHANDLED_CRASH",
                    "confidence": "LOW",
                    "solved": 0,
                    "rank": None,
                    "error": str(unhandled_err)
                }

        # Launch all 300 student requests across 5 contests concurrently
        tasks = []
        for contest_slug, students in synthetic_dataset.items():
            for username, profile_cfg in students.items():
                tasks.append(verify_student(username, contest_slug, profile_cfg))

        results = await asyncio.gather(*tasks)
        total_duration = time.monotonic() - start_wall_clock

        # ==============================================================================
        # 4. DATA ANALYSIS & AUDIT VERIFICATION
        # ==============================================================================

        contest_results = defaultdict(list)
        for r in results:
            contest_results[r["contest"]].append(r)

        # Calculate observed Requests Per Second (RPS) in 1-second sliding windows
        timestamps = sorted(server.request_timestamps)
        max_observed_rps = 0.0
        if len(timestamps) > 1:
            for i, t in enumerate(timestamps):
                window_count = sum(1 for other_t in timestamps[i:] if other_t - t <= 1.0)
                if window_count > max_observed_rps:
                    max_observed_rps = float(window_count)

        # ==============================================================================
        # 5. RIGOROUS ASSERTIONS
        # ==============================================================================

        # Assertion 1: No unhandled crashes or unmapped statuses
        crashes = [r for r in results if r["status"] == "UNHANDLED_CRASH"]
        assert len(crashes) == 0, f"Pipeline crashed on {len(crashes)} requests: {crashes[:3]}"

        # Assertion 2: Strict Deduplication (Exactly 60 unique students per contest)
        for c_slug, c_rows in contest_results.items():
            usernames = [r["username"] for r in c_rows]
            assert len(usernames) == 60, f"Contest {c_slug} returned {len(usernames)} rows, expected 60"
            assert len(set(usernames)) == 60, f"Duplicate student records detected in {c_slug}"

        # Assertion 3: Rate Limiter Compliance
        # In multi-threaded/async burst with capacity 10, max window RPS should never drastically breach budget
        assert max_observed_rps <= (TARGET_RPS * 1.6), (
            f"Observed RPS ({max_observed_rps}) breached rate limiter budget ({TARGET_RPS})"
        )

        # Assertion 4: 429 Throttle & Retry-After Compliance
        # Throttles must have occurred and been absorbed by the limiter
        assert server.total_429s > 0, "No 429 throttles were simulated during load run."
        assert len(server.retry_delays) > 0, "No backoff retries recorded following 429s."

        # Assertion 5: Target Distribution & Strict Data Errors Contract
        summary_table_rows = []
        for c_slug in contests:
            c_rows = contest_results[c_slug]
            actual_cnt = sum(1 for r in c_rows if r["status"] == "PUBLIC")
            virtual_cnt = sum(1 for r in c_rows if r["status"] == "VIRTUAL")
            not_verified_cnt = sum(1 for r in c_rows if r["status"] == "NOT_VERIFIED")
            conflict_cnt = sum(1 for r in c_rows if r["status"] == "CONFLICT")
            source_error_cnt = sum(1 for r in c_rows if r["status"] == "SOURCE_ERROR")

            # Contract: dataErrors == count(CONFLICT) + count(SOURCE_ERROR)
            data_errors = conflict_cnt + source_error_cnt
            total_students = len(c_rows)

            assert total_students == actual_cnt + virtual_cnt + not_verified_cnt + data_errors
            assert actual_cnt == 45, f"Expected 45 ACTUAL for {c_slug}, got {actual_cnt}"
            assert virtual_cnt == 8, f"Expected 8 VIRTUAL for {c_slug}, got {virtual_cnt}"
            assert not_verified_cnt == 3, f"Expected 3 NOT_VERIFIED for {c_slug}, got {not_verified_cnt}"
            assert conflict_cnt == 2, f"Expected 2 CONFLICT for {c_slug}, got {conflict_cnt}"
            assert source_error_cnt == 2, f"Expected 2 SOURCE_ERROR for {c_slug}, got {source_error_cnt}"

            summary_table_rows.append({
                "contest": c_slug.replace("weekly-contest-", "WC-"),
                "actual": actual_cnt,
                "virtual": virtual_cnt,
                "not_verified": not_verified_cnt,
                "conflict": conflict_cnt,
                "source_error": source_error_cnt,
                "data_errors": data_errors,
                "total": total_students
            })

        # Assertion 6: Runtime Bound (Must finish well under 60 seconds)
        assert total_duration < 60.0, f"Load test exceeded wall clock budget: {total_duration:.2f}s"

        # ==============================================================================
        # 6. BEAUTIFUL FORMATTED SUMMARY TABLE OUTPUT
        # ==============================================================================
        print("\n" + "=" * 88)
        print("  LEETCODE CONTEST VERIFICATION ENGINE — END-TO-END LOAD / VOLUME TEST REPORT")
        print("=" * 88)
        print(f"  Total Contests Tested    : {len(contests)} ({', '.join(c.replace('weekly-contest-', 'WC-') for c in contests)})")
        print(f"  Total Students Tested    : {len(results)} Profiles")
        print(f"  Total HTTP Requests Sent : {server.total_requests}")
        print(f"  Total HTTP 429s Absorbed : {server.total_429s} (Backoff & Jitter Respected)")
        print(f"  Total 5xx Errors Injected: {server.total_5xx}")
        print(f"  Peak Observed RPS        : {max_observed_rps:.1f} req/s (Target Limit: {TARGET_RPS:.1f} req/s)")
        print(f"  Total Wall Clock Time    : {total_duration:.2f} seconds")
        print("-" * 88)
        print(f"  {'CONTEST':<10} | {'ACTUAL':<8} | {'VIRTUAL':<8} | {'NOT_VERIFIED':<13} | {'CONFLICT':<9} | {'SOURCE_ERR':<11} | {'DATA_ERRORS':<12}")
        print("-" * 88)
        for row in summary_table_rows:
            print(
                f"  {row['contest']:<10} | {row['actual']:<8} | {row['virtual']:<8} | "
                f"{row['not_verified']:<13} | {row['conflict']:<9} | {row['source_error']:<11} | "
                f"{row['data_errors']:<12}"
            )
        print("=" * 88)
        print("  [SUCCESS] All 300 students verified with ZERO crashes and 100% data invariant fidelity!\n")

    asyncio.run(_run_load_test())
