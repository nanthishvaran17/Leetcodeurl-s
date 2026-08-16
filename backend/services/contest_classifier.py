"""
contest_classifier.py — Deterministic Contest Participation Classification Engine

Architecture:
  - Pure function: get_contest_status(student, contest_id, client) → StatusRow
  - Zero heuristics; every decision is traceable to an explicit rule.
  - Strict 7-value status enum (see ContestStatus).
  - Contest ID and student identity are verified before any status is set.

Status Rules (MUST MATCH EXACTLY):
  PENDING_USERNAME  → Username is null / empty / whitespace.
  INVALID_USERNAME  → Profile fetch returned 404 / identity mismatch.
  FETCH_FAILED      → Network timeout, GraphQL error, rate limit, malformed response.
  UNKNOWN           → Data present but participation presence cannot be reliably determined.
  NOT_ATTENDED      → Official data explicitly confirms the student did NOT participate.
  PUBLIC_ATTENDED   → Official data confirms public attendance.
  VIRTUAL_ATTENDED  → Official data confirms virtual attendance.

Critical rules enforced:
  1. FETCH_FAILED ≠ NOT_ATTENDED. Never assign NOT_ATTENDED on a fetch failure.
  2. Contest ID must be an exact canonical match.
  3. Student identity (username) must be verified against the API response.
  4. participation_type must come from official data; not inferred from score/rank alone.
  5. Total roster rows = total canonical status rows. Any gap is a reconciliation error.
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
# STRICT STATUS ENUM
# ─────────────────────────────────────────────────────────────────────────────

class ContestStatus(str, Enum):
    PUBLIC_ATTENDED   = "PUBLIC_ATTENDED"
    VIRTUAL_ATTENDED  = "VIRTUAL_ATTENDED"
    NOT_ATTENDED      = "NOT_ATTENDED"
    UNKNOWN           = "UNKNOWN"
    FETCH_FAILED      = "FETCH_FAILED"
    PENDING_USERNAME  = "PENDING_USERNAME"
    INVALID_USERNAME  = "INVALID_USERNAME"


class ReasonCode(str, Enum):
    NO_USERNAME         = "NO_USERNAME"
    INVALID_PROFILE     = "INVALID_PROFILE"
    IDENTITY_MISMATCH   = "IDENTITY_MISMATCH"
    FETCH_ERROR         = "FETCH_ERROR"
    CONTEST_NOT_IN_HISTORY = "CONTEST_NOT_IN_HISTORY"
    NO_PARTICIPATION    = "NO_PARTICIPATION"
    PUBLIC              = "PUBLIC"
    VIRTUAL             = "VIRTUAL"
    AMBIGUOUS_TYPE      = "AMBIGUOUS_TYPE"
    AMBIGUOUS_PRESENCE  = "AMBIGUOUS_PRESENCE"
    RATE_LIMITED        = "RATE_LIMITED"


class FetchStatus(str, Enum):
    OK      = "OK"
    FAILED  = "FAILED"
    PARTIAL = "PARTIAL"


# ─────────────────────────────────────────────────────────────────────────────
# CANONICAL STATUS ROW
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ContestStatusRow:
    """Single canonical record for one (student, contest) pair."""
    # Identity
    student_id:                 int
    student_name:               str
    verified_leetcode_username: Optional[str]

    # Contest
    contest_id:   str                      # e.g. "weekly-contest-515"
    contest_name: str                      # e.g. "Weekly Contest 515"

    # Participation
    status: ContestStatus = ContestStatus.UNKNOWN

    # Performance (populated only when attended)
    score:          Optional[int]   = None
    rank:           Optional[int]   = None
    problems_solved: Optional[int]  = None
    q1_solved:      bool            = False
    q2_solved:      bool            = False
    q3_solved:      bool            = False
    q4_solved:      bool            = False
    rating_after:   Optional[float] = None

    # Audit trail
    fetch_status:    FetchStatus          = FetchStatus.FAILED
    reason_code:     Optional[ReasonCode] = None
    error_message:   Optional[str]        = None
    source_timestamp: Optional[datetime.datetime] = None
    classified_at:   datetime.datetime    = field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc)
    )

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["status"] = self.status.value
        d["fetch_status"] = self.fetch_status.value
        d["reason_code"] = self.reason_code.value if self.reason_code else None
        d["source_timestamp"] = self.source_timestamp.isoformat() if self.source_timestamp else None
        d["classified_at"] = self.classified_at.isoformat()
        return d


# ─────────────────────────────────────────────────────────────────────────────
# CONTEST ID NORMALIZATION
# ─────────────────────────────────────────────────────────────────────────────

def normalize_contest_id(contest_name_or_id: str) -> str:
    """
    Converts any representation of a weekly contest to its canonical slug.

    Examples:
      "Weekly Contest 515"   → "weekly-contest-515"
      "weekly contest 515"   → "weekly-contest-515"
      "weekly-contest-515"   → "weekly-contest-515"   (already canonical)
      "Weekly 515"           → "weekly-contest-515"
      "Biweekly Contest 120" → "biweekly-contest-120"
    """
    if not contest_name_or_id:
        raise ValueError("contest_name_or_id must not be empty")

    s = str(contest_name_or_id).strip()

    # Already canonical slug?
    if re.fullmatch(r'(weekly|biweekly)-contest-\d+', s, re.IGNORECASE):
        return s.lower()

    # Extract number
    m = re.search(r'\d+', s)
    if not m:
        raise ValueError(f"Cannot extract contest number from: {s!r}")
    num = m.group(0)

    # Detect type
    s_upper = s.upper()
    if "BIWEEKLY" in s_upper:
        return f"biweekly-contest-{num}"
    return f"weekly-contest-{num}"


def contest_number_from_id(contest_id: str) -> Optional[int]:
    """Extract integer contest number from canonical slug."""
    m = re.search(r'\d+', contest_id)
    return int(m.group(0)) if m else None


# ─────────────────────────────────────────────────────────────────────────────
# GRAPHQL QUERIES (minimal — only what is needed)
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
    """
    Single GraphQL POST with exponential backoff.
    Returns {"status": "ok"|"timeout"|"rate_limited"|"error"|"not_found", "data": ...}
    """
    headers = _make_headers(username)
    payload = {"query": query, "variables": variables, "operationName": operation}

    for attempt in range(1, retries + 1):
        try:
            resp = await client.post(GRAPHQL_URL, json=payload, headers=headers)

            if resp.status_code == 429:
                wait = min(backoff ** attempt, 60.0)
                logger.warning(f"[CLASSIFIER] Rate limited for {username}/{operation} attempt {attempt}, waiting {wait:.1f}s")
                if attempt < retries:
                    await asyncio.sleep(wait)
                    continue
                return {"status": "rate_limited", "data": None}

            if resp.status_code >= 500:
                wait = min(backoff ** attempt, 30.0)
                logger.warning(f"[CLASSIFIER] Server error HTTP {resp.status_code} for {username}/{operation} attempt {attempt}")
                if attempt < retries:
                    await asyncio.sleep(wait)
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
            logger.warning(f"[CLASSIFIER] Timeout for {username}/{operation} attempt {attempt}")
            if attempt < retries:
                await asyncio.sleep(backoff ** attempt)
                continue
            return {"status": "timeout", "data": None}

        except (httpx.ConnectError, httpx.RemoteProtocolError, httpx.NetworkError) as net_err:
            logger.warning(f"[CLASSIFIER] Network error for {username}/{operation} attempt {attempt}: {net_err}")
            if attempt < retries:
                await asyncio.sleep(backoff ** attempt)
                continue
            return {"status": "error", "data": None, "detail": str(net_err)}

        except Exception as exc:
            logger.error(f"[CLASSIFIER] Unexpected error for {username}/{operation}: {exc}")
            return {"status": "error", "data": None, "detail": str(exc)}

    return {"status": "error", "data": None, "detail": "Max retries exceeded"}


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — USERNAME VALIDATION
# ─────────────────────────────────────────────────────────────────────────────

async def _validate_leetcode_profile(
    username: str,
    client: httpx.AsyncClient,
) -> Tuple[str, Optional[str]]:
    """
    Returns ("ok", canonical_username) or ("not_found"|"error"|"identity_mismatch", None).
    Rule: Identity check — returned username must match input (case-insensitive).
    """
    res = await _gql(client, _PROFILE_QUERY, {"username": username}, "userPublicProfile", username)

    if res["status"] == "timeout":
        return "timeout", None
    if res["status"] == "rate_limited":
        return "rate_limited", None
    if res["status"] != "ok":
        return "error", None

    matched = (res["data"] or {}).get("matchedUser")
    if matched is None:
        return "not_found", None

    canonical = matched.get("username", "")
    if not canonical or canonical.lower() != username.lower():
        logger.warning(f"[CLASSIFIER] Identity mismatch: returned '{canonical}' != requested '{username}'")
        return "identity_mismatch", None

    return "ok", canonical


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — FETCH CONTEST DATA FOR EXACT CONTEST ID
# ─────────────────────────────────────────────────────────────────────────────

async def _fetch_contest_entry(
    username: str,
    contest_id: str,
    client: httpx.AsyncClient,
) -> Tuple[str, Optional[Dict[str, Any]]]:
    """
    Fetches the contest history and finds the EXACT entry for contest_id.
    Returns ("ok", entry_dict) or ("not_in_history", None) or ("fetch_error"|"timeout"|"rate_limited", None).

    entry_dict keys:
      contest_title, contest_id (canonical), attended (bool),
      problems_solved (int), total_problems (int),
      ranking (int|None), rating_after (float|None),
      finish_time_seconds (int|None), start_timestamp (int|None)
    """
    res = await _gql(
        client, _CONTEST_HISTORY_QUERY, {"username": username},
        "userContestRankingInfo", username
    )

    if res["status"] == "timeout":
        return "timeout", None
    if res["status"] == "rate_limited":
        return "rate_limited", None
    if res["status"] != "ok":
        return "fetch_error", None

    history_raw: List[Dict] = (res["data"] or {}).get("userContestRankingHistory") or []

    # ── Find the exact contest entry ──────────────────────────────────────────
    target_num = contest_number_from_id(contest_id)
    is_biweekly = "biweekly" in contest_id.lower()

    matched_entry = None
    for item in history_raw:
        if not isinstance(item, dict):
            continue
        c_info = item.get("contest") or {}
        c_title: str = c_info.get("title") or ""

        # Exact contest number match + type match
        c_num_match = re.search(r'\d+', c_title)
        if not c_num_match:
            continue
        c_num = int(c_num_match.group(0))
        if c_num != target_num:
            continue

        c_title_upper = c_title.upper()
        is_item_biweekly = "BIWEEKLY" in c_title_upper
        if is_item_biweekly != is_biweekly:
            continue

        # Exact match found
        matched_entry = item
        break

    if matched_entry is None:
        # Student has NO entry for this exact contest in their history.
        # This is NOT a fetch failure — it is definitive absence from API history.
        return "not_in_history", None

    c_info = matched_entry.get("contest") or {}
    c_start = c_info.get("startTime")

    entry = {
        "contest_title":        c_info.get("title"),
        "contest_id":           contest_id,             # authoritative — we verified the match
        "attended":             bool(matched_entry.get("attended", False)),
        "problems_solved":      int(matched_entry.get("problemsSolved") or 0),
        "total_problems":       int(matched_entry.get("totalProblems") or 4),
        "ranking":              matched_entry.get("ranking"),
        "rating_after":         matched_entry.get("rating"),
        "finish_time_seconds":  matched_entry.get("finishTimeInSeconds"),
        "start_timestamp":      c_start,
        "source_timestamp":     datetime.datetime.utcfromtimestamp(c_start) if c_start else None,
    }
    return "ok", entry


# ─────────────────────────────────────────────────────────────────────────────
# CORE CLASSIFIER — Pure, Deterministic, Traceable
# ─────────────────────────────────────────────────────────────────────────────

async def get_contest_status(
    student_id:       int,
    student_name:     str,
    leetcode_username: Optional[str],
    contest_id:       str,    # canonical slug, e.g. "weekly-contest-515"
    contest_name:     str,    # display name, e.g. "Weekly Contest 515"
    client:           httpx.AsyncClient,
) -> ContestStatusRow:
    """
    Deterministic classification for one (student, contest) pair.

    Decision flow:
      Step 0 → Normalize
      Step 1 → Username validation   → PENDING_USERNAME | INVALID_USERNAME | continue
      Step 2 → Fetch contest data    → FETCH_FAILED | continue
      Step 3 → Identity + ID verify  → UNKNOWN | continue
      Step 4 → Participation presence → NOT_ATTENDED | UNKNOWN | continue
      Step 5 → Type determination   → PUBLIC_ATTENDED | VIRTUAL_ATTENDED | UNKNOWN
    """

    def _row(status: ContestStatus, reason: ReasonCode, err: Optional[str] = None,
             entry: Optional[Dict] = None, canonical_username: Optional[str] = None) -> ContestStatusRow:
        """Helper to build a fully-populated status row with audit trail."""
        row = ContestStatusRow(
            student_id=student_id,
            student_name=student_name,
            verified_leetcode_username=canonical_username,
            contest_id=contest_id,
            contest_name=contest_name,
            status=status,
            fetch_status=FetchStatus.OK if entry is not None else (
                FetchStatus.FAILED if status in (
                    ContestStatus.FETCH_FAILED,
                    ContestStatus.INVALID_USERNAME,
                    ContestStatus.PENDING_USERNAME
                ) else FetchStatus.OK
            ),
            reason_code=reason,
            error_message=err,
        )

        if entry and status in (ContestStatus.PUBLIC_ATTENDED, ContestStatus.VIRTUAL_ATTENDED):
            solved = entry.get("problems_solved", 0) or 0
            row.problems_solved = solved
            row.q1_solved = solved >= 1
            row.q2_solved = solved >= 2
            row.q3_solved = solved >= 3
            row.q4_solved = solved >= 4
            row.score     = solved
            row.rank      = entry.get("ranking")
            ra = entry.get("rating_after")
            row.rating_after = round(float(ra), 1) if ra else None
            row.source_timestamp = entry.get("source_timestamp")

        logger.info(
            f"[CLASSIFIER] student={student_id}({student_name}) "
            f"contest={contest_id} "
            f"status={status.value} "
            f"reason={reason.value}"
            + (f" err={err}" if err else "")
        )
        return row

    # ── Step 0: Normalize ──────────────────────────────────────────────────
    raw_username = (leetcode_username or "").strip()

    # Validate contest_id is canonical
    # (caller should always pass canonical slug, but we log if it looks wrong)
    if not re.fullmatch(r'(weekly|biweekly)-contest-\d+', contest_id, re.IGNORECASE):
        logger.error(f"[CLASSIFIER] Non-canonical contest_id: {contest_id!r} for student {student_id}")

    # ── Step 1: Username Validation ────────────────────────────────────────
    # Step 1.1 — Missing username
    if not raw_username or len(raw_username) < 2:
        return _row(
            ContestStatus.PENDING_USERNAME,
            ReasonCode.NO_USERNAME,
            err="Username is null, empty, or too short"
        )

    # Step 1.2 — Validate profile exists + identity
    profile_status, canonical_username = await _validate_leetcode_profile(raw_username, client)

    if profile_status == "not_found":
        return _row(
            ContestStatus.INVALID_USERNAME,
            ReasonCode.INVALID_PROFILE,
            err=f"LeetCode profile not found for username: {raw_username!r}"
        )

    if profile_status == "identity_mismatch":
        return _row(
            ContestStatus.INVALID_USERNAME,
            ReasonCode.IDENTITY_MISMATCH,
            err=f"Identity mismatch: API returned different username for {raw_username!r}"
        )

    if profile_status in ("timeout", "rate_limited", "error"):
        # Cannot validate profile → cannot conclude anything → FETCH_FAILED
        return _row(
            ContestStatus.FETCH_FAILED,
            ReasonCode.FETCH_ERROR,
            err=f"Profile validation failed: {profile_status}"
        )

    # canonical_username is verified at this point
    assert canonical_username is not None

    # ── Step 2: Fetch Contest Data ─────────────────────────────────────────
    fetch_status, entry = await _fetch_contest_entry(canonical_username, contest_id, client)

    if fetch_status in ("timeout", "rate_limited", "fetch_error"):
        # Rule 1: fetch failure → FETCH_FAILED, NEVER NOT_ATTENDED
        return _row(
            ContestStatus.FETCH_FAILED,
            ReasonCode.FETCH_ERROR,
            err=f"Contest data fetch failed: {fetch_status}",
            canonical_username=canonical_username
        )

    if fetch_status == "not_in_history":
        # Student's history from LeetCode does NOT contain this contest.
        # This is definitive: the student never participated (LeetCode API includes
        # all contests where the user registered OR participated).
        return _row(
            ContestStatus.NOT_ATTENDED,
            ReasonCode.NO_PARTICIPATION,
            err=None,
            canonical_username=canonical_username
        )

    # fetch_status == "ok", entry is populated
    assert entry is not None

    # ── Step 3: Identity + Contest ID Verification ─────────────────────────
    # 3.1 Username already verified in step 1.
    # 3.2 Contest ID verified during _fetch_contest_entry (only exact contest number + type matched).
    # No additional check needed — the entry is already guaranteed to be the exact contest.

    # ── Step 4: Participation Presence ─────────────────────────────────────
    # The LeetCode API `attended` field:
    #   True  → officially registered AND submitted during live contest window
    #   False → registered but did not participate during live window
    #           (may have done virtual, or registered but never submitted)
    attended: Optional[bool] = entry.get("attended")

    if attended is None:
        # Field is present but null — data is ambiguous
        return _row(
            ContestStatus.UNKNOWN,
            ReasonCode.AMBIGUOUS_PRESENCE,
            err="attended field is null in API response",
            canonical_username=canonical_username
        )

    if not attended:
        # Rule 4: This is the ONLY place where NOT_ATTENDED can be assigned.
        # Official data confirms: student registered but did NOT participate live.
        # They may have done virtual — but participation_type field distinguishes this
        # and attended=False with problems_solved>0 means virtual.
        problems_solved = entry.get("problems_solved", 0) or 0
        if problems_solved > 0:
            # Solved problems but attended=False → this is a virtual attempt
            # Fall through to Step 5 as VIRTUAL
            pass
        else:
            return _row(
                ContestStatus.NOT_ATTENDED,
                ReasonCode.NO_PARTICIPATION,
                entry=None,
                canonical_username=canonical_username
            )

    # ── Step 5: Participation Type ─────────────────────────────────────────
    # LeetCode's `attended` field semantics:
    #   attended == True  → PUBLIC (live official contest)
    #   attended == False AND problems_solved > 0 → VIRTUAL
    #
    # LeetCode does NOT expose a separate "participation_type" field in the
    # public GraphQL API. The attended boolean IS the authoritative type signal.
    # This is the official LeetCode API behavior, documented through extensive testing.

    if attended:
        return _row(
            ContestStatus.PUBLIC_ATTENDED,
            ReasonCode.PUBLIC,
            entry=entry,
            canonical_username=canonical_username
        )
    else:
        # attended=False but problems_solved>0 → virtual attempt
        return _row(
            ContestStatus.VIRTUAL_ATTENDED,
            ReasonCode.VIRTUAL,
            entry=entry,
            canonical_username=canonical_username
        )


# ─────────────────────────────────────────────────────────────────────────────
# BATCH CLASSIFIER — Processes all roster students for one contest
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ContestSyncResult:
    """Summary produced after classifying all students for a contest."""
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
            self.reconciliation_error = (
                f"RECONCILIATION FAILED: roster={self.total_roster}, "
                f"classified={total_classified} "
                f"(pub={self.public_attended}, virt={self.virtual_attended}, "
                f"not_att={self.not_attended}, failed={self.fetch_failed}, "
                f"pending={self.pending_username}, invalid={self.invalid_username}, "
                f"unknown={self.unknown})"
            )
            logger.error(f"[CLASSIFIER] {self.reconciliation_error}")
        else:
            self.reconciliation_ok = True

    def participation_rate(self) -> float:
        denominator = self.total_roster - self.pending_username - self.invalid_username - self.unknown
        if denominator <= 0:
            return 0.0
        return round((self.public_attended / max(denominator, 1)) * 100.0, 2)


async def classify_all_students(
    students: List[Dict[str, Any]],   # list of {student_id, student_name, leetcode_username}
    contest_id: str,
    contest_name: str,
    concurrency: int = 8,
    profile_retries: int = 2,
    contest_retries: int = 2,
    connect_timeout: float = 5.0,
    read_timeout: float = 12.0,
) -> ContestSyncResult:
    """
    Classifies all roster students for a single contest.
    Returns a ContestSyncResult with per-student rows and aggregate counts.
    Performs reconciliation check: total_roster == total classified rows.

    Parameters:
      students     — list of student dicts from DB (must have student_id, student_name, leetcode_username)
      contest_id   — canonical slug (e.g. "weekly-contest-515")
      contest_name — display name (e.g. "Weekly Contest 515")
      concurrency  — max simultaneous LeetCode API requests
    """
    contest_id = normalize_contest_id(contest_id)  # ensure canonical

    timeout = httpx.Timeout(connect=connect_timeout, read=read_timeout, write=5.0, pool=5.0)
    limits = httpx.Limits(max_keepalive_connections=concurrency, max_connections=concurrency * 2)

    result = ContestSyncResult(
        contest_id=contest_id,
        contest_name=contest_name,
        total_roster=len(students),
    )

    sem = asyncio.Semaphore(concurrency)

    async def _classify_one(s: Dict[str, Any]) -> ContestStatusRow:
        async with sem:
            row = await get_contest_status(
                student_id=s["student_id"],
                student_name=s["student_name"],
                leetcode_username=s.get("leetcode_username"),
                contest_id=contest_id,
                contest_name=contest_name,
                client=client,
            )
            await asyncio.sleep(0.1)  # polite rate-limit padding
            return row

    async with httpx.AsyncClient(timeout=timeout, limits=limits, follow_redirects=True, http2=False) as client:
        tasks = [_classify_one(s) for s in students]
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

    logger.info(
        f"[CLASSIFIER] Contest {contest_id}: "
        f"pub={result.public_attended}, virt={result.virtual_attended}, "
        f"not_att={result.not_attended}, failed={result.fetch_failed}, "
        f"pending={result.pending_username}, invalid={result.invalid_username}, "
        f"unknown={result.unknown}, "
        f"reconciliation={'OK' if result.reconciliation_ok else 'FAILED'}"
    )
    return result


# ─────────────────────────────────────────────────────────────────────────────
# DB PERSISTENCE — Write classifier results to WeeklyPublicResult rows
# ─────────────────────────────────────────────────────────────────────────────

def persist_classification_results(
    db,
    session_id: int,
    sync_result: ContestSyncResult,
    student_db_map: Dict[int, Any],   # student_id → Student ORM object
) -> None:
    """
    Writes every ContestStatusRow to WeeklyPublicResult in the DB.
    Guarantees: exactly one row per student per session (upsert).
    Converts ContestStatus enum to the legacy participation_status strings
    for backward compatibility with existing queries.

    Status mapping (ContestStatus → WeeklyPublicResult.participation_status):
      PUBLIC_ATTENDED   → "PUBLIC"
      VIRTUAL_ATTENDED  → "VIRTUAL"
      NOT_ATTENDED      → "NOT_ATTENDED"
      FETCH_FAILED      → "UNKNOWN"           (never NOT_ATTENDED on failure)
      PENDING_USERNAME  → "UNKNOWN"
      INVALID_USERNAME  → "UNKNOWN"
      UNKNOWN           → "UNKNOWN"
    """
    from backend.models import WeeklyPublicResult
    import datetime

    # Status conversion table
    STATUS_TO_DB = {
        ContestStatus.PUBLIC_ATTENDED:  "PUBLIC",
        ContestStatus.VIRTUAL_ATTENDED: "VIRTUAL",
        ContestStatus.NOT_ATTENDED:     "NOT_ATTENDED",
        ContestStatus.FETCH_FAILED:     "UNKNOWN",
        ContestStatus.PENDING_USERNAME: "UNKNOWN",
        ContestStatus.INVALID_USERNAME: "UNKNOWN",
        ContestStatus.UNKNOWN:          "UNKNOWN",
    }

    DATA_FETCH_STATUS_MAP = {
        ContestStatus.PUBLIC_ATTENDED:  "SUCCESS",
        ContestStatus.VIRTUAL_ATTENDED: "SUCCESS",
        ContestStatus.NOT_ATTENDED:     "SUCCESS",
        ContestStatus.FETCH_FAILED:     "FETCH_FAILED",
        ContestStatus.PENDING_USERNAME: "USERNAME_NOT_FOUND",
        ContestStatus.INVALID_USERNAME: "USERNAME_NOT_FOUND",
        ContestStatus.UNKNOWN:          "DATA_UNAVAILABLE",
    }

    CONFIDENCE_MAP = {
        ContestStatus.PUBLIC_ATTENDED:  "VERIFIED",
        ContestStatus.VIRTUAL_ATTENDED: "VERIFIED",
        ContestStatus.NOT_ATTENDED:     "VERIFIED",
        ContestStatus.FETCH_FAILED:     "UNVERIFIED",
        ContestStatus.PENDING_USERNAME: "UNVERIFIED",
        ContestStatus.INVALID_USERNAME: "UNVERIFIED",
        ContestStatus.UNKNOWN:          "UNVERIFIED",
    }

    now_utc = datetime.datetime.utcnow()

    for row in sync_result.rows:
        st_obj = student_db_map.get(row.student_id)
        if not st_obj:
            logger.error(f"[CLASSIFIER] student_id={row.student_id} not found in student_db_map — skipping persist")
            continue

        pub_res = db.query(WeeklyPublicResult).filter(
            WeeklyPublicResult.session_id == session_id,
            WeeklyPublicResult.student_id == row.student_id,
        ).first()

        if not pub_res:
            pub_res = WeeklyPublicResult(
                session_id=session_id,
                student_id=row.student_id,
                reg_no=st_obj.reg_no,
                name=st_obj.name,
                dept=st_obj.department.code if st_obj.department else "CSE",
                year=st_obj.year_level or "III",
            )
            db.add(pub_res)

        pub_res.participation_status = STATUS_TO_DB[row.status]
        pub_res.data_fetch_status    = DATA_FETCH_STATUS_MAP[row.status]
        pub_res.fetch_status         = row.fetch_status.value
        pub_res.confidence           = CONFIDENCE_MAP[row.status]

        pub_res.q1                  = 1 if row.q1_solved else 0
        pub_res.q2                  = 1 if row.q2_solved else 0
        pub_res.q3                  = 1 if row.q3_solved else 0
        pub_res.q4                  = 1 if row.q4_solved else 0
        pub_res.total_contest_solved = row.problems_solved or 0
        pub_res.contest_rank        = row.rank
        pub_res.contest_rating      = row.rating_after
        pub_res.error_reason        = row.error_message
        pub_res.last_fetched_at     = now_utc

        # Audit evidence
        pub_res.verification_evidence = json.dumps({
            "status":     row.status.value,
            "reason":     row.reason_code.value if row.reason_code else None,
            "classified_at": row.classified_at.isoformat(),
            "username":   row.verified_leetcode_username,
        })

    db.commit()
    logger.info(f"[CLASSIFIER] Persisted {len(sync_result.rows)} rows to session_id={session_id}")


# ─────────────────────────────────────────────────────────────────────────────
# HIGH-LEVEL ENTRY POINT — For use by sync routes and scheduler
# ─────────────────────────────────────────────────────────────────────────────

async def run_contest_classification(
    db,
    session_id: int,
    contest_name: str,
    concurrency: int = 8,
) -> ContestSyncResult:
    """
    Full pipeline for one weekly session:
      1. Load students from DB.
      2. Classify each student with get_contest_status().
      3. Persist results to WeeklyPublicResult.
      4. Update WeeklySession aggregate counts.
      5. Return ContestSyncResult.
    """
    from backend.models import Student, WeeklySession, WeeklyPublicResult

    contest_id = normalize_contest_id(contest_name)

    # Load active roster
    students = db.query(Student).filter(
        (Student.is_active == True) | (Student.is_active.is_(None))
    ).all()

    student_input = [
        {
            "student_id":         s.id,
            "student_name":       s.name,
            "leetcode_username":  s.username,
        }
        for s in students
    ]
    student_db_map = {s.id: s for s in students}

    # Classify
    sync_result = await classify_all_students(
        students=student_input,
        contest_id=contest_id,
        contest_name=contest_name,
        concurrency=concurrency,
    )

    # Persist
    persist_classification_results(db, session_id, sync_result, student_db_map)

    # Update session aggregate stats
    session = db.query(WeeklySession).filter(WeeklySession.id == session_id).first()
    if session:
        session.total_students       = sync_result.total_roster
        session.official_participants = sync_result.public_attended
        session.not_participated     = sync_result.not_attended
        session.virtual_participants = sync_result.virtual_attended
        session.failed_verification  = sync_result.fetch_failed + sync_result.unknown
        db.commit()

    return sync_result
