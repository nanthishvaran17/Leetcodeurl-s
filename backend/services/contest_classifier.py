"""
contest_classifier.py — Production Deterministic Contest Participation Classification Engine

Critical Refinements:
  - Refinement A: VIRTUAL_ATTENDED clarification:
      if contest_data is None:
          status = NOT_ATTENDED
      elif attended == True:
          status = PUBLIC_ATTENDED
      elif attended == False:
          status = VIRTUAL_ATTENDED (irrespective of problems_solved count)
  - Refinement B: Strict distinction between FETCH_FAILED (network/API error)
    and UNKNOWN (data returned but ambiguous or identity mismatched).
  - Refinement C: Clear separation of source_timestamp (LeetCode timestamp) vs
    classified_at (decision generation timestamp).
"""
from __future__ import annotations

import asyncio
import datetime
import re
import json
import logging
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Optional, Dict, Any, List, Tuple

import httpx

from backend.logger import logger


# ─────────────────────────────────────────────────────────────────────────────
# 1. ENUMS (Strict 7-Enum System)
# ─────────────────────────────────────────────────────────────────────────────

class ContestStatus(str, Enum):
    PUBLIC_ATTENDED   = "PUBLIC_ATTENDED"
    VIRTUAL_ATTENDED  = "VIRTUAL_ATTENDED"
    NOT_ATTENDED      = "NOT_ATTENDED"
    FETCH_FAILED      = "FETCH_FAILED"
    PENDING_USERNAME  = "PENDING_USERNAME"
    INVALID_USERNAME  = "INVALID_USERNAME"
    UNKNOWN           = "UNKNOWN"


class ReasonCode(str, Enum):
    PUBLIC                  = "PUBLIC"
    VIRTUAL                 = "VIRTUAL"
    NO_PARTICIPATION        = "NO_PARTICIPATION"
    FETCH_ERROR             = "FETCH_ERROR"
    NO_USERNAME             = "NO_USERNAME"
    INVALID_PROFILE         = "INVALID_PROFILE"
    IDENTITY_MISMATCH       = "IDENTITY_MISMATCH"
    AMBIGUOUS_TYPE          = "AMBIGUOUS_TYPE"
    AMBIGUOUS_PARTICIPATION = "AMBIGUOUS_PARTICIPATION"
    RATE_LIMITED            = "RATE_LIMITED"


class FetchStatus(str, Enum):
    OK      = "OK"
    FAILED  = "FAILED"
    PARTIAL = "PARTIAL"


# ─────────────────────────────────────────────────────────────────────────────
# 2. CANONICAL DATA STRUCTURE
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ContestStatusRow:
    # 1. Identity
    student_id:                 int
    student_name:               str
    verified_leetcode_username: Optional[str]

    # 2. Contest Metadata
    contest_id:   str                      # e.g., "weekly-contest-515"
    contest_name: str                      # e.g., "Weekly Contest 515"

    # 3. Status & Audit
    status:        ContestStatus
    reason_code:   ReasonCode
    fetch_status:  FetchStatus
    error_message: Optional[str] = None

    # 4. Performance Metrics (Populated if Attended)
    score:           Optional[int]   = None
    rank:            Optional[int]   = None
    problems_solved: Optional[int]   = None
    q1_solved:       bool            = False
    q2_solved:       bool            = False
    q3_solved:       bool            = False
    q4_solved:       bool            = False
    rating_after:    Optional[float] = None

    # 5. Timestamps (Refinement C: strict separation)
    source_timestamp: Optional[datetime.datetime] = None
    classified_at:    datetime.datetime = field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc)
    )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON/CSV/Excel serialization."""
        return {
            "student_id":                 self.student_id,
            "student_name":               self.student_name,
            "verified_leetcode_username": self.verified_leetcode_username,
            "contest_id":                 self.contest_id,
            "contest_name":               self.contest_name,
            "status":                     self.status.value,
            "reason_code":                self.reason_code.value,
            "fetch_status":               self.fetch_status.value,
            "error_message":              self.error_message,
            "score":                      self.score,
            "rank":                       self.rank,
            "problems_solved":            self.problems_solved,
            "q1_solved":                  self.q1_solved,
            "q2_solved":                  self.q2_solved,
            "q3_solved":                  self.q3_solved,
            "q4_solved":                  self.q4_solved,
            "rating_after":               self.rating_after,
            "source_timestamp":           self.source_timestamp.isoformat() if self.source_timestamp else None,
            "classified_at":              self.classified_at.isoformat(),
        }


# ─────────────────────────────────────────────────────────────────────────────
# SLUG UTILITIES
# ─────────────────────────────────────────────────────────────────────────────

def normalize_contest_id(contest_name_or_id: str) -> str:
    """Converts any contest name or slug to its canonical slug."""
    if not contest_name_or_id:
        raise ValueError("contest_name_or_id must not be empty")

    s = str(contest_name_or_id).strip()
    if re.fullmatch(r'(weekly|biweekly)-contest-\d+', s, re.IGNORECASE):
        return s.lower()

    m = re.search(r'\d+', s)
    if not m:
        raise ValueError(f"Cannot extract contest number from: {s!r}")
    num = m.group(0)

    if "BIWEEKLY" in s.upper():
        return f"biweekly-contest-{num}"
    return f"weekly-contest-{num}"


def contest_number_from_id(contest_id: str) -> Optional[int]:
    m = re.search(r'\d+', contest_id)
    return int(m.group(0)) if m else None


# ─────────────────────────────────────────────────────────────────────────────
# 3. CORE CLASSIFIER CLASS (Sync Interface)
# ─────────────────────────────────────────────────────────────────────────────

class ContestClassifier:
    """
    Deterministic, O(1) decision engine for LeetCode Weekly Contest participation.
    """

    def __init__(self, leetcode_api_client=None):
        self.api = leetcode_api_client

    def classify_student_contest(
        self,
        student_id: int,
        student_name: str,
        leetcode_username: Optional[str],
        contest_id: str,
        contest_name: str,
    ) -> ContestStatusRow:
        """
        Classifies a single student's contest participation status.
        """
        # Step 0: Normalize inputs
        raw_username = (leetcode_username or "").strip()
        canonical_contest_id = normalize_contest_id(contest_id)

        # Step 1: Username validation
        if not raw_username or len(raw_username) < 2:
            return ContestStatusRow(
                student_id=student_id,
                student_name=student_name,
                verified_leetcode_username=None,
                contest_id=canonical_contest_id,
                contest_name=contest_name,
                status=ContestStatus.PENDING_USERNAME,
                reason_code=ReasonCode.NO_USERNAME,
                fetch_status=FetchStatus.OK,
            )

        if not self.api:
            return ContestStatusRow(
                student_id=student_id,
                student_name=student_name,
                verified_leetcode_username=raw_username,
                contest_id=canonical_contest_id,
                contest_name=contest_name,
                status=ContestStatus.FETCH_FAILED,
                reason_code=ReasonCode.FETCH_ERROR,
                fetch_status=FetchStatus.FAILED,
                error_message="API client not initialized",
            )

        # Validate Profile
        try:
            profile_data = self.api.validate_profile(raw_username)
        except Exception as e:
            logger.warning(f"Profile validation failed for {raw_username}: {e}")
            return ContestStatusRow(
                student_id=student_id,
                student_name=student_name,
                verified_leetcode_username=raw_username,
                contest_id=canonical_contest_id,
                contest_name=contest_name,
                status=ContestStatus.FETCH_FAILED,
                reason_code=ReasonCode.FETCH_ERROR,
                fetch_status=FetchStatus.FAILED,
                error_message=str(e),
            )

        if profile_data is None:
            return ContestStatusRow(
                student_id=student_id,
                student_name=student_name,
                verified_leetcode_username=raw_username,
                contest_id=canonical_contest_id,
                contest_name=contest_name,
                status=ContestStatus.INVALID_USERNAME,
                reason_code=ReasonCode.INVALID_PROFILE,
                fetch_status=FetchStatus.OK,
            )

        verified_username = profile_data.get("username", raw_username)

        # Step 2: Fetch Contest Data
        try:
            contest_data = self.api.fetch_contest_result(verified_username, canonical_contest_id)
        except Exception as e:
            logger.warning(f"Contest fetch failed for {verified_username}/{canonical_contest_id}: {e}")
            return ContestStatusRow(
                student_id=student_id,
                student_name=student_name,
                verified_leetcode_username=verified_username,
                contest_id=canonical_contest_id,
                contest_name=contest_name,
                status=ContestStatus.FETCH_FAILED,
                reason_code=ReasonCode.FETCH_ERROR,
                fetch_status=FetchStatus.FAILED,
                error_message=str(e),
            )

        # Step 2.1: Check if contest entry exists in history
        if contest_data is None:
            return ContestStatusRow(
                student_id=student_id,
                student_name=student_name,
                verified_leetcode_username=verified_username,
                contest_id=canonical_contest_id,
                contest_name=contest_name,
                status=ContestStatus.NOT_ATTENDED,
                reason_code=ReasonCode.NO_PARTICIPATION,
                fetch_status=FetchStatus.OK,
            )

        # Step 3: Identity & Contest Slug Verification
        returned_username = contest_data.get("username", "").lower()
        if returned_username and returned_username != verified_username.lower():
            return ContestStatusRow(
                student_id=student_id,
                student_name=student_name,
                verified_leetcode_username=verified_username,
                contest_id=canonical_contest_id,
                contest_name=contest_name,
                status=ContestStatus.UNKNOWN,
                reason_code=ReasonCode.IDENTITY_MISMATCH,
                fetch_status=FetchStatus.PARTIAL,
                error_message=f"Username mismatch: {returned_username} != {verified_username}",
            )

        returned_contest_id = contest_data.get("contest_id")
        if returned_contest_id and normalize_contest_id(returned_contest_id) != canonical_contest_id:
            return ContestStatusRow(
                student_id=student_id,
                student_name=student_name,
                verified_leetcode_username=verified_username,
                contest_id=canonical_contest_id,
                contest_name=contest_name,
                status=ContestStatus.UNKNOWN,
                reason_code=ReasonCode.IDENTITY_MISMATCH,
                fetch_status=FetchStatus.PARTIAL,
                error_message=f"Contest ID mismatch: {returned_contest_id} != {canonical_contest_id}",
            )

        # Step 4 & 5: Presence & Type Evaluation (Strict Non-Assumption)
        attended = bool(contest_data.get("attended", False))
        problems_solved = contest_data.get("problems_solved")
        score = contest_data.get("score") if contest_data.get("score") is not None else problems_solved
        rank = contest_data.get("rank")
        rating_after = contest_data.get("rating_after")
        source_ts = contest_data.get("source_timestamp")

        # Q1-Q4 flags are strictly set ONLY if explicitly verified in submission evidence, never guessed
        q1 = bool(contest_data.get("q1_solved", False))
        q2 = bool(contest_data.get("q2_solved", False))
        q3 = bool(contest_data.get("q3_solved", False))
        q4 = bool(contest_data.get("q4_solved", False))

        if attended:
            return ContestStatusRow(
                student_id=student_id,
                student_name=student_name,
                verified_leetcode_username=verified_username,
                contest_id=canonical_contest_id,
                contest_name=contest_name,
                status=ContestStatus.PUBLIC_ATTENDED,
                reason_code=ReasonCode.PUBLIC,
                fetch_status=FetchStatus.OK,
                score=score,
                rank=rank,
                problems_solved=problems_solved,
                q1_solved=q1,
                q2_solved=q2,
                q3_solved=q3,
                q4_solved=q4,
                rating_after=rating_after,
                source_timestamp=source_ts,
            )
        else:
            # attended == False -> Confirmed virtual participation
            return ContestStatusRow(
                student_id=student_id,
                student_name=student_name,
                verified_leetcode_username=verified_username,
                contest_id=canonical_contest_id,
                contest_name=contest_name,
                status=ContestStatus.VIRTUAL_ATTENDED,
                reason_code=ReasonCode.VIRTUAL,
                fetch_status=FetchStatus.OK,
                score=score,
                rank=rank,
                problems_solved=problems_solved,
                q1_solved=q1,
                q2_solved=q2,
                q3_solved=q3,
                q4_solved=q4,
                rating_after=rating_after,
                source_timestamp=source_ts,
            )

    def classify_batch(
        self,
        students: List[Dict[str, Any]],
        contest_id: str,
        contest_name: str,
    ) -> List[ContestStatusRow]:
        """Classifies multiple students with invariant reconciliation check."""
        results = []
        for s in students:
            row = self.classify_student_contest(
                student_id=s["student_id"],
                student_name=s["student_name"],
                leetcode_username=s.get("leetcode_username"),
                contest_id=contest_id,
                contest_name=contest_name,
            )
            results.append(row)

        if len(results) != len(students):
            raise RuntimeError(
                f"Reconciliation failed: expected {len(students)} rows, got {len(results)}"
            )
        return results


# ─────────────────────────────────────────────────────────────────────────────
# 4. ASYNC BATCH PIPELINE (High-Concurrency Network Engine)
# ─────────────────────────────────────────────────────────────────────────────

GRAPHQL_URL = "https://leetcode.com/graphql"

_PROFILE_QUERY = """
query userPublicProfile($username: String!) {
  matchedUser(username: $username) {
    username
    profile { ranking }
  }
}
"""

_CONTEST_HISTORY_QUERY = """
query userContestRankingInfo($username: String!) {
  userContestRankingHistory(username: $username) {
    attended
    problemsSolved
    totalProblems
    ranking
    rating
    finishTimeInSeconds
    contest {
      title
      startTime
    }
  }
}
"""

def _make_headers(username: str) -> dict:
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Content-Type": "application/json",
        "Accept": "*/*",
        "Origin": "https://leetcode.com",
        "Referer": f"https://leetcode.com/u/{username}/",
    }

async def _gql(
    client: httpx.AsyncClient,
    query: str,
    variables: dict,
    operation: str,
    username: str,
    retries: int = 3,
    backoff: float = 1.5,
) -> Dict[str, Any]:
    headers = _make_headers(username)
    payload = {"query": query, "variables": variables, "operationName": operation}

    for attempt in range(1, retries + 1):
        try:
            resp = await client.post(GRAPHQL_URL, json=payload, headers=headers)
            if resp.status_code == 429:
                wait = min(backoff ** attempt, 30.0)
                if attempt < retries:
                    await asyncio.sleep(wait)
                    continue
                return {"status": "rate_limited", "data": None}

            if resp.status_code >= 500:
                if attempt < retries:
                    await asyncio.sleep(backoff ** attempt)
                    continue
                return {"status": "error", "data": None, "detail": f"HTTP {resp.status_code}"}

            if resp.status_code != 200:
                return {"status": "error", "data": None, "detail": f"HTTP {resp.status_code}"}

            body = resp.json()
            gql_errors = body.get("errors")
            gql_data = body.get("data") or {}

            if gql_errors and not gql_data:
                msg = gql_errors[0].get("message", "") if gql_errors else ""
                return {"status": "error", "data": None, "detail": msg}

            return {"status": "ok", "data": gql_data}

        except httpx.TimeoutException:
            if attempt < retries:
                await asyncio.sleep(backoff ** attempt)
                continue
            return {"status": "timeout", "data": None}
        except Exception as exc:
            if attempt < retries:
                await asyncio.sleep(backoff ** attempt)
                continue
            return {"status": "error", "data": None, "detail": str(exc)}

    return {"status": "error", "data": None, "detail": "Max retries exceeded"}


async def _validate_leetcode_profile(username: str, client: httpx.AsyncClient) -> Tuple[str, Optional[str]]:
    res = await _gql(client, _PROFILE_QUERY, {"username": username}, "userPublicProfile", username)
    if res["status"] in ("timeout", "rate_limited", "error"):
        return res["status"], None
    matched = (res["data"] or {}).get("matchedUser")
    if matched is None:
        return "not_found", None
    canonical = matched.get("username", "")
    if not canonical or canonical.lower() != username.lower():
        return "identity_mismatch", None
    return "ok", canonical


async def _fetch_contest_entry(username: str, contest_id: str, client: httpx.AsyncClient) -> Tuple[str, Optional[Dict[str, Any]]]:
    res = await _gql(client, _CONTEST_HISTORY_QUERY, {"username": username}, "userContestRankingInfo", username)
    if res["status"] in ("timeout", "rate_limited", "error"):
        return res["status"], None

    history_raw: List[Dict] = (res["data"] or {}).get("userContestRankingHistory") or []
    target_num = contest_number_from_id(contest_id)
    is_biweekly = "biweekly" in contest_id.lower()

    matched_entry = None
    for item in history_raw:
        if not isinstance(item, dict):
            continue
        c_info = item.get("contest") or {}
        c_title: str = c_info.get("title") or ""
        c_num_match = re.search(r'\d+', c_title)
        if not c_num_match or int(c_num_match.group(0)) != target_num:
            continue
        if ("BIWEEKLY" in c_title.upper()) != is_biweekly:
            continue
        matched_entry = item
        break

    if matched_entry is None:
        return "not_in_history", None

    c_info = matched_entry.get("contest") or {}
    c_start = c_info.get("startTime")
    entry = {
        "contest_title":       c_info.get("title"),
        "contest_id":          contest_id,
        "username":            username,
        "attended":            bool(matched_entry.get("attended", False)),
        "problems_solved":     int(matched_entry.get("problemsSolved") or 0),
        "ranking":             matched_entry.get("ranking"),
        "rating_after":        matched_entry.get("rating"),
        "source_timestamp":    datetime.datetime.utcfromtimestamp(c_start) if c_start else None,
        "contest_slug":        contest_id,
    }
    return "ok", entry


async def get_contest_status(
    student_id:        int,
    student_name:      str,
    leetcode_username: Optional[str],
    contest_id:        str,
    contest_name:      str,
    client:            httpx.AsyncClient,
) -> ContestStatusRow:
    """Async pure classifier implementation for high-throughput live sync."""
    raw_username = (leetcode_username or "").strip()
    canonical_id = normalize_contest_id(contest_id)

    # Step 1: Username validation
    if not raw_username or len(raw_username) < 2:
        return ContestStatusRow(
            student_id=student_id,
            student_name=student_name,
            verified_leetcode_username=None,
            contest_id=canonical_id,
            contest_name=contest_name,
            status=ContestStatus.PENDING_USERNAME,
            reason_code=ReasonCode.NO_USERNAME,
            fetch_status=FetchStatus.OK,
        )

    val_status, canonical_username = await _validate_leetcode_profile(raw_username, client)
    if val_status == "not_found":
        return ContestStatusRow(
            student_id=student_id,
            student_name=student_name,
            verified_leetcode_username=raw_username,
            contest_id=canonical_id,
            contest_name=contest_name,
            status=ContestStatus.INVALID_USERNAME,
            reason_code=ReasonCode.INVALID_PROFILE,
            fetch_status=FetchStatus.OK,
        )
    if val_status == "identity_mismatch":
        return ContestStatusRow(
            student_id=student_id,
            student_name=student_name,
            verified_leetcode_username=raw_username,
            contest_id=canonical_id,
            contest_name=contest_name,
            status=ContestStatus.UNKNOWN,
            reason_code=ReasonCode.IDENTITY_MISMATCH,
            fetch_status=FetchStatus.PARTIAL,
            error_message="Identity mismatch from LeetCode GraphQL",
        )
    if val_status in ("timeout", "rate_limited", "error"):
        return ContestStatusRow(
            student_id=student_id,
            student_name=student_name,
            verified_leetcode_username=raw_username,
            contest_id=canonical_id,
            contest_name=contest_name,
            status=ContestStatus.FETCH_FAILED,
            reason_code=ReasonCode.FETCH_ERROR,
            fetch_status=FetchStatus.FAILED,
            error_message=f"Profile fetch failed: {val_status}",
        )

    # Step 2: Fetch Contest Data
    fetch_st, entry = await _fetch_contest_entry(canonical_username, canonical_id, client)
    if fetch_st in ("timeout", "rate_limited", "error"):
        return ContestStatusRow(
            student_id=student_id,
            student_name=student_name,
            verified_leetcode_username=canonical_username,
            contest_id=canonical_id,
            contest_name=contest_name,
            status=ContestStatus.FETCH_FAILED,
            reason_code=ReasonCode.FETCH_ERROR,
            fetch_status=FetchStatus.FAILED,
            error_message=f"Contest fetch failed: {fetch_st}",
        )

    if fetch_st == "not_in_history":
        return ContestStatusRow(
            student_id=student_id,
            student_name=student_name,
            verified_leetcode_username=canonical_username,
            contest_id=canonical_id,
            contest_name=contest_name,
            status=ContestStatus.NOT_ATTENDED,
            reason_code=ReasonCode.NO_PARTICIPATION,
            fetch_status=FetchStatus.OK,
        )

    # Step 4 & 5: Evaluate Participation Type (Strict Non-Assumption)
    attended = entry.get("attended", False)
    solved = entry.get("problems_solved")
    score = entry.get("score", solved)
    rank = entry.get("ranking")
    rating_after = entry.get("rating_after")
    source_ts = entry.get("source_timestamp")

    q1 = bool(entry.get("q1_solved", False))
    q2 = bool(entry.get("q2_solved", False))
    q3 = bool(entry.get("q3_solved", False))
    q4 = bool(entry.get("q4_solved", False))

    if attended:
        return ContestStatusRow(
            student_id=student_id,
            student_name=student_name,
            verified_leetcode_username=canonical_username,
            contest_id=canonical_id,
            contest_name=contest_name,
            status=ContestStatus.PUBLIC_ATTENDED,
            reason_code=ReasonCode.PUBLIC,
            fetch_status=FetchStatus.OK,
            score=score,
            rank=rank,
            problems_solved=solved,
            q1_solved=q1,
            q2_solved=q2,
            q3_solved=q3,
            q4_solved=q4,
            rating_after=rating_after,
            source_timestamp=source_ts,
        )
    else:
        # attended == False -> Confirmed virtual participation
        return ContestStatusRow(
            student_id=student_id,
            student_name=student_name,
            verified_leetcode_username=canonical_username,
            contest_id=canonical_id,
            contest_name=contest_name,
            status=ContestStatus.VIRTUAL_ATTENDED,
            reason_code=ReasonCode.VIRTUAL,
            fetch_status=FetchStatus.OK,
            score=score,
            rank=rank,
            problems_solved=solved,
            q1_solved=q1,
            q2_solved=q2,
            q3_solved=q3,
            q4_solved=q4,
            rating_after=rating_after,
            source_timestamp=source_ts,
        )


@dataclass
class ContestSyncResult:
    contest_id:        str
    contest_name:      str
    total_roster:      int
    public_attended:   int = 0
    virtual_attended:  int = 0
    not_attended:      int = 0
    fetch_failed:      int = 0
    pending_username:  int = 0
    invalid_username:  int = 0
    unknown:           int = 0
    rows:              List[ContestStatusRow] = field(default_factory=list)
    reconciliation_ok: bool = True
    reconciliation_error: Optional[str] = None

    def validate_reconciliation(self):
        total_classified = (
            self.public_attended + self.virtual_attended + self.not_attended +
            self.fetch_failed + self.pending_username + self.invalid_username + self.unknown
        )
        if total_classified != self.total_roster:
            self.reconciliation_ok = False
            self.reconciliation_error = f"Reconciliation error: expected {self.total_roster}, got {total_classified}"
        else:
            self.reconciliation_ok = True


async def classify_all_students(
    students: List[Dict[str, Any]],
    contest_id: str,
    contest_name: str,
    concurrency: int = 8,
) -> ContestSyncResult:
    canonical_id = normalize_contest_id(contest_id)
    result = ContestSyncResult(
        contest_id=canonical_id,
        contest_name=contest_name,
        total_roster=len(students),
    )

    timeout = httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=5.0)
    limits = httpx.Limits(max_keepalive_connections=concurrency, max_connections=concurrency * 2)
    sem = asyncio.Semaphore(concurrency)

    async def _classify(s: Dict[str, Any]) -> ContestStatusRow:
        async with sem:
            row = await get_contest_status(
                student_id=s["student_id"],
                student_name=s["student_name"],
                leetcode_username=s.get("leetcode_username"),
                contest_id=canonical_id,
                contest_name=contest_name,
                client=client,
            )
            await asyncio.sleep(0.05)
            return row

    async with httpx.AsyncClient(timeout=timeout, limits=limits, follow_redirects=True, http2=False) as client:
        tasks = [_classify(s) for s in students]
        rows = await asyncio.gather(*tasks)

    for row in rows:
        result.rows.append(row)
        if row.status == ContestStatus.PUBLIC_ATTENDED:
            result.public_attended += 1
        elif row.status == ContestStatus.VIRTUAL_ATTENDED:
            result.virtual_attended += 1
        elif row.status == ContestStatus.NOT_ATTENDED:
            result.not_attended += 1
        elif row.status == ContestStatus.FETCH_FAILED:
            result.fetch_failed += 1
        elif row.status == ContestStatus.PENDING_USERNAME:
            result.pending_username += 1
        elif row.status == ContestStatus.INVALID_USERNAME:
            result.invalid_username += 1
        else:
            result.unknown += 1

    result.validate_reconciliation()
    return result
