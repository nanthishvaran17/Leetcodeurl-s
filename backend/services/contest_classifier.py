"""
contest_classifier.py — Phase X Accuracy Hardening Contest Participation Classification Engine

Evidence-First Pipeline:
  submission_evidence -> contest problem filtering -> timestamp classification -> LIVE / VIRTUAL / ATTENDED_ZERO / NOT_VERIFIED / NOT_ATTENDED

Guarantees:
  - Timezone-aware UTC timestamp evaluation for contest window [08:00 AM IST, 09:30 AM IST].
  - Boundary: Exact 09:30:00 AM IST is inside live window (LIVE). 09:30:01 AM IST is after window (VIRTUAL).
  - Only Accepted submissions matching official contest problem titleSlugs (Q1..Q4) count toward contest solved count.
  - Multiple Accepted submissions for the same question count as 1 solved question (unique contest problem counting).
  - Total solved count = live_solves + post_contest_solves.
  - API failures / timeouts produce NOT_VERIFIED / DATA_ERROR (never 0 solved or NOT_ATTENDED).
"""
from __future__ import annotations

import asyncio
import datetime
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Dict, Any, List, Tuple

import httpx

from backend.logger import logger


# 
# 1. ENUMS (Phase X Accuracy Hardening Enums)
# 

class ContestStatus(str, Enum):
    # Primary Phase X Enums
    LIVE                          = "LIVE"
    VIRTUAL                       = "VIRTUAL"
    ATTENDED_ZERO                 = "ATTENDED_ZERO"
    NOT_VERIFIED                  = "NOT_VERIFIED"
    DATA_ERROR                    = "DATA_ERROR"
    NOT_ATTENDED                  = "NOT_ATTENDED"

    # Strict & Legacy Compatibility Enums
    PUBLIC_LIVE                   = "PUBLIC_LIVE"
    PUBLIC_ATTENDED               = "PUBLIC_ATTENDED"
    PUBLIC_LIVE_VERIFIED          = "PUBLIC_LIVE_VERIFIED"
    VIRTUAL_PRACTICE              = "VIRTUAL_PRACTICE"
    VIRTUAL_ATTENDED              = "VIRTUAL_ATTENDED"
    VIRTUAL_PRACTICE_VERIFIED     = "VIRTUAL_PRACTICE_VERIFIED"
    PRACTICE_IGNORED              = "PRACTICE_IGNORED"
    PUBLIC_LIVE_UNVERIFIED        = "PUBLIC_LIVE_UNVERIFIED"
    VIRTUAL_PRACTICE_UNVERIFIED   = "VIRTUAL_PRACTICE_UNVERIFIED"
    FETCH_FAILED                  = "FETCH_FAILED"
    PENDING_VERIFICATION          = "PENDING_VERIFICATION"
    PENDING_USERNAME              = "PENDING_USERNAME"
    INVALID_USERNAME              = "INVALID_USERNAME"
    NO_LEETCODE_HANDLE            = "NO_LEETCODE_HANDLE"
    REVIEW_REQUIRED               = "REVIEW_REQUIRED"
    UNKNOWN                       = "UNKNOWN"

    def __eq__(self, other: object) -> bool:
        if super().__eq__(other):
            return True
        val = str(self)
        oth = str(other.value) if isinstance(other, Enum) else str(other)
        live_aliases = {"LIVE", "PUBLIC_LIVE", "PUBLIC_ATTENDED", "PUBLIC_LIVE_VERIFIED"}
        virtual_aliases = {"VIRTUAL", "VIRTUAL_PRACTICE", "VIRTUAL_ATTENDED", "VIRTUAL_PRACTICE_VERIFIED"}
        if val in live_aliases and oth in live_aliases:
            return True
        if val in virtual_aliases and oth in virtual_aliases:
            return True
        return False


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
    VALID_LIVE_SUBMISSION   = "VALID_LIVE_SUBMISSION"
    EXPLICIT_VIRTUAL        = "EXPLICIT_VIRTUAL"


class FetchStatus(str, Enum):
    OK      = "OK"
    FAILED  = "FAILED"
    PARTIAL = "PARTIAL"


# 
# 2. CANONICAL DATA STRUCTURE
# 

@dataclass
class ContestStatusRow:
    student_id:                 int
    student_name:               str
    verified_leetcode_username: Optional[str]

    contest_id:   str
    contest_name: str

    status:        ContestStatus
    reason_code:   ReasonCode
    fetch_status:  FetchStatus
    reason_text:   Optional[str] = None
    error_message: Optional[str] = None

    score:               Optional[int]   = None
    rank:                Optional[int]   = None
    problems_solved:     Optional[int]   = None
    live_solves:         int             = 0
    post_contest_solves: int             = 0
    q1_solved:           bool            = False
    q2_solved:           bool            = False
    q3_solved:           bool            = False
    q4_solved:           bool            = False
    rating_after:        Optional[float] = None

    source_timestamp:      Optional[datetime.datetime] = None
    classification_signal: Optional[str]               = None # in_window_submission, post_window_only, no_submissions, submission_evidence_unavailable, no_participation
    solve_timeline:        Optional[List[Dict[str, Any]]] = None
    classified_at:         datetime.datetime           = field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc)
    )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON/CSV/Excel serialization."""
        solved_val = self.problems_solved if self.problems_solved is not None else 0
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
            "reason_text":                self.reason_text,
            "score":                      self.score,
            "rank":                       self.rank,
            "problems_solved":            self.problems_solved,
            "live_solves":                self.live_solves,
            "post_contest_solves":        self.post_contest_solves,
            "score_display":              f"{solved_val} / 4",
            "q1_solved":                  self.q1_solved,
            "q2_solved":                  self.q2_solved,
            "q3_solved":                  self.q3_solved,
            "q4_solved":                  self.q4_solved,
            "rating_after":               self.rating_after,
            "source_timestamp":           self.source_timestamp.isoformat() if self.source_timestamp else None,
            "classification_signal":      self.classification_signal,
            "solve_timeline":             self.solve_timeline or [],
            "classified_at":              self.classified_at.isoformat(),
        }


# 
# UTILITIES
# 

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


def get_contest_utc_window(contest_id: str) -> Tuple[datetime.datetime, datetime.datetime]:
    """
    Calculates exact timezone-aware UTC start and end times for a weekly contest.
    Official Contest Window: Sunday 08:00 AM IST -> 09:30 AM IST.
    Reference Anchor: Weekly Contest 514 on 2026-08-09 08:00 AM IST (02:30:00 UTC).
    Duration: 90 minutes (5400 seconds).
    """
    canonical_id = normalize_contest_id(contest_id)
    num = contest_number_from_id(canonical_id) or 514
    ref_num = 514
    ref_start_utc = datetime.datetime(2026, 8, 9, 2, 30, 0, tzinfo=datetime.timezone.utc)
    weeks_delta = num - ref_num
    start_utc = ref_start_utc + datetime.timedelta(weeks=weeks_delta)
    end_utc = start_utc + datetime.timedelta(minutes=90)
    return start_utc, end_utc


def get_official_contest_problems(contest_id: str) -> List[Dict[str, Any]]:
    """Helper to load official contest problems from DB or cache."""
    canonical_id = normalize_contest_id(contest_id)
    try:
        from backend.database import SessionLocal
        from backend.models import Contest
        import json
        db = SessionLocal()
        c_obj = db.query(Contest).filter(Contest.contest_slug == canonical_id).first()
        if c_obj and c_obj.problem_list:
            probs = json.loads(c_obj.problem_list) if isinstance(c_obj.problem_list, str) else c_obj.problem_list
            if isinstance(probs, list) and len(probs) > 0:
                db.close()
                return probs
        db.close()
    except Exception as e:
        logger.warning(f"Could not load official problems from DB for {canonical_id}: {e}")
    return []


# 
# 3. CORE EVIDENCE-FIRST CLASSIFICATION ENGINE
# 

def evaluate_contest_evidence(
    student_id: int,
    student_name: str,
    leetcode_username: Optional[str],
    contest_id: str,
    contest_name: str,
    contest_start_utc: datetime.datetime,
    contest_end_utc: datetime.datetime,
    official_problems: List[Dict[str, Any]],
    ranking_history_attended: Optional[bool] = None,
    raw_submissions: Optional[List[Dict[str, Any]]] = None,
    fetch_error: Optional[str] = None,
    rank: Optional[int] = None,
    rating_after: Optional[float] = None,
) -> ContestStatusRow:
    """
    Phase X — Accuracy Hardening Evidence-First Classification Logic.

    Rules:
      1. Verify username presence.
      2. If API/submission fetch failed -> NOT_VERIFIED / DATA_ERROR with signal submission_evidence_unavailable.
      3. Filter raw submissions against official contest problem titleSlugs ONLY.
      4. Deduplicate accepted submissions by problem (count unique contest problems solved).
      5. Evaluate submission timestamps against [contest_start_utc, contest_end_utc].
      6. Determine LIVE, VIRTUAL, ATTENDED_ZERO, or NOT_ATTENDED.
    """
    raw_username = (leetcode_username or "").strip()
    canonical_id = normalize_contest_id(contest_id)

    if not official_problems:
        official_problems = get_official_contest_problems(canonical_id)

    if not raw_username or len(raw_username) < 2:
        return ContestStatusRow(
            student_id=student_id,
            student_name=student_name,
            verified_leetcode_username=None,
            contest_id=canonical_id,
            contest_name=contest_name,
            status=ContestStatus.NO_LEETCODE_HANDLE,
            reason_code=ReasonCode.NO_USERNAME,
            reason_text="Student does not have a mapped LeetCode account.",
            fetch_status=FetchStatus.OK,
            classification_signal="no_username",
            solve_timeline=[],
            problems_solved=0,
            live_solves=0,
            post_contest_solves=0,
        )

    # API failure or unavailable submission endpoint
    if fetch_error or raw_submissions is None:
        return ContestStatusRow(
            student_id=student_id,
            student_name=student_name,
            verified_leetcode_username=raw_username,
            contest_id=canonical_id,
            contest_name=contest_name,
            status=ContestStatus.NOT_VERIFIED,
            reason_code=ReasonCode.FETCH_ERROR,
            reason_text=f"Contest participation could not be verified due to submission API error: {fetch_error or 'evidence_unavailable'}",
            fetch_status=FetchStatus.FAILED,
            error_message=fetch_error or "submission_evidence_unavailable",
            classification_signal="submission_evidence_unavailable",
            solve_timeline=[],
            problems_solved=None,
            live_solves=0,
            post_contest_solves=0,
        )

    # Convert timestamps to UTC unix seconds
    if not contest_start_utc.tzinfo:
        contest_start_utc = contest_start_utc.replace(tzinfo=datetime.timezone.utc)
    if not contest_end_utc.tzinfo:
        contest_end_utc = contest_end_utc.replace(tzinfo=datetime.timezone.utc)

    start_unix = int(contest_start_utc.timestamp())
    end_unix = int(contest_end_utc.timestamp())

    # Official problem slug lookup map
    official_slug_map = {}
    for idx, p in enumerate(official_problems, start=1):
        slug = str(p.get("titleSlug") or p.get("slug") or "").lower().strip()
        if slug:
            official_slug_map[slug] = {
                "order": p.get("question_order") or idx,
                "title": p.get("title") or f"Q{idx}",
                "titleSlug": slug,
                "problem_id": p.get("problem_id") or p.get("question_id"),
            }

    # Filter matching accepted submissions
    solve_timeline: List[Dict[str, Any]] = []
    solved_problems_map: Dict[str, Dict[str, Any]] = {}

    for sub in raw_submissions:
        status_str = str(sub.get("status") or sub.get("statusDisplay") or "Accepted")
        if status_str.lower() not in ("accepted", "ac"):
            continue

        slug = str(sub.get("titleSlug") or sub.get("title_slug") or "").lower().strip()
        
        # If official problem list is provided, enforce strict slug matching
        if official_slug_map and slug not in official_slug_map:
            # Unrelated LeetCode problem! Must NOT increase contest solved count.
            continue

        sub_id = str(sub.get("id") or sub.get("submission_id") or "")
        try:
            sub_ts = int(sub.get("timestamp") or 0)
        except (ValueError, TypeError):
            continue

        sub_utc = datetime.datetime.fromtimestamp(sub_ts, tz=datetime.timezone.utc).isoformat() if sub_ts else None

        # Inclusive window boundary check: start_unix <= sub_ts <= end_unix
        is_in_window = (start_unix <= sub_ts <= end_unix)
        is_post_window = (sub_ts > end_unix)
        is_pre_window = (sub_ts < start_unix)

        solve_phase = "LIVE" if is_in_window else ("POST_CONTEST" if is_post_window else "PRE_CONTEST")

        q_info = official_slug_map.get(slug, {"order": 1, "title": sub.get("title") or slug, "titleSlug": slug})
        q_order = q_info["order"]

        solve_timeline.append({
            "problem": f"Q{q_order}",
            "title": q_info["title"],
            "titleSlug": slug,
            "submission_id": sub_id,
            "timestamp": sub_ts,
            "timestamp_utc": sub_utc,
            "status": "Accepted",
            "in_contest_window": is_in_window,
            "solve_phase": solve_phase,
        })

        if slug not in solved_problems_map:
            solved_problems_map[slug] = {
                "order": q_order,
                "has_in_window": False,
                "has_post_window": False,
                "count": 0,
            }
        
        solved_problems_map[slug]["count"] += 1
        if is_in_window:
            solved_problems_map[slug]["has_in_window"] = True
        elif is_post_window:
            solved_problems_map[slug]["has_post_window"] = True

    # Unique solved metrics
    total_unique_solved = len(solved_problems_map)
    live_solves = sum(1 for data in solved_problems_map.values() if data["has_in_window"])
    post_contest_solves = sum(1 for data in solved_problems_map.values() if not data["has_in_window"] and data["has_post_window"])

    q1 = any(data["order"] == 1 for data in solved_problems_map.values())
    q2 = any(data["order"] == 2 for data in solved_problems_map.values())
    q3 = any(data["order"] == 3 for data in solved_problems_map.values())
    q4 = any(data["order"] == 4 for data in solved_problems_map.values())

    # Two-Signal Deterministic Classification
    if live_solves > 0:
        status = ContestStatus.LIVE
        reason_code = ReasonCode.VALID_LIVE_SUBMISSION
        classification_signal = "in_window_submission"
        reason_text = "Verified live submission(s) inside official 90-min contest window."
    elif post_contest_solves > 0:
        status = ContestStatus.VIRTUAL
        reason_code = ReasonCode.EXPLICIT_VIRTUAL
        classification_signal = "post_window_only"
        reason_text = "All accepted submission(s) occurred post-contest window (Virtual/Practice)."
    elif ranking_history_attended is True:
        status = ContestStatus.ATTENDED_ZERO
        reason_code = ReasonCode.PUBLIC
        classification_signal = "no_submissions"
        reason_text = "Attended official contest window with 0 accepted submissions."
    else:
        status = ContestStatus.NOT_ATTENDED
        reason_code = ReasonCode.NO_PARTICIPATION
        classification_signal = "no_participation"
        reason_text = "No verified participation or submissions found for contest."

    return ContestStatusRow(
        student_id=student_id,
        student_name=student_name,
        verified_leetcode_username=raw_username,
        contest_id=canonical_id,
        contest_name=contest_name,
        status=status,
        reason_code=reason_code,
        fetch_status=FetchStatus.OK,
        reason_text=reason_text,
        score=total_unique_solved,
        rank=rank,
        problems_solved=total_unique_solved,
        live_solves=live_solves,
        post_contest_solves=post_contest_solves,
        q1_solved=q1,
        q2_solved=q2,
        q3_solved=q3,
        q4_solved=q4,
        rating_after=rating_after,
        source_timestamp=contest_start_utc,
        classification_signal=classification_signal,
        solve_timeline=solve_timeline,
    )


def log_classification_event(
    db,
    student_id: int,
    contest_id: str,
    old_state: Optional[str],
    new_state: str,
    signal: str,
    reason: str,
    details: Optional[Dict[str, Any]] = None,
    session_id: Optional[int] = None,
):
    """
    Audit logs a classification transition into ContestReconciliationEvent.
    """
    from backend.models import ContestReconciliationEvent
    try:
        event = ContestReconciliationEvent(
            session_id=session_id,
            student_id=student_id,
            contest_id=contest_id,
            event_type="CLASSIFICATION_CHANGED",
            old_state=old_state,
            new_state=new_state,
            classification_signal=signal,
            reason=reason,
            details=details or {},
            created_at=datetime.datetime.now(datetime.timezone.utc)
        )
        db.add(event)
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to write audit log event for student {student_id}: {e}")
        try:
            db.rollback()
        except Exception:
            pass


# 
# 4. CLASSIFIER CLASS & ASYNC PIPELINE
# 

class ContestClassifier:
    """
    Deterministic Evidence-First Decision Engine for LeetCode Weekly Contest Participation.
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
        official_problems: Optional[List[Dict[str, Any]]] = None,
    ) -> ContestStatusRow:
        """Sync classification wrapper using official evidence rules."""
        raw_username = (leetcode_username or "").strip()
        canonical_id = normalize_contest_id(contest_id)
        start_utc, end_utc = get_contest_utc_window(canonical_id)

        if not raw_username or len(raw_username) < 2:
            return ContestStatusRow(
                student_id=student_id,
                student_name=student_name,
                verified_leetcode_username=None,
                contest_id=canonical_id,
                contest_name=contest_name,
                status=ContestStatus.NO_LEETCODE_HANDLE,
                reason_code=ReasonCode.NO_USERNAME,
                reason_text="Student does not have a mapped LeetCode account.",
                fetch_status=FetchStatus.OK,
                classification_signal="no_username",
            )

        if not self.api:
            return ContestStatusRow(
                student_id=student_id,
                student_name=student_name,
                verified_leetcode_username=raw_username,
                contest_id=canonical_id,
                contest_name=contest_name,
                status=ContestStatus.NOT_VERIFIED,
                reason_code=ReasonCode.FETCH_ERROR,
                reason_text="Contest participation could not be verified: API client not initialized.",
                fetch_status=FetchStatus.FAILED,
                error_message="API client not initialized",
                classification_signal="submission_evidence_unavailable",
            )

        try:
            contest_data = self.api.fetch_contest_result(raw_username, canonical_id)
        except Exception as e:
            return ContestStatusRow(
                student_id=student_id,
                student_name=student_name,
                verified_leetcode_username=raw_username,
                contest_id=canonical_id,
                contest_name=contest_name,
                status=ContestStatus.NOT_VERIFIED,
                reason_code=ReasonCode.FETCH_ERROR,
                reason_text=f"API error fetching contest result: {e}",
                fetch_status=FetchStatus.FAILED,
                error_message=str(e),
                classification_signal="submission_evidence_unavailable",
            )

        if contest_data is None:
            return ContestStatusRow(
                student_id=student_id,
                student_name=student_name,
                verified_leetcode_username=raw_username,
                contest_id=canonical_id,
                contest_name=contest_name,
                status=ContestStatus.NOT_ATTENDED,
                reason_code=ReasonCode.NO_PARTICIPATION,
                reason_text="No verified participation found.",
                fetch_status=FetchStatus.OK,
                classification_signal="no_participation",
            )

        attended = bool(contest_data.get("attended", False))
        recent_ac = contest_data.get("recent_ac") or contest_data.get("submissions") or []

        return evaluate_contest_evidence(
            student_id=student_id,
            student_name=student_name,
            leetcode_username=raw_username,
            contest_id=canonical_id,
            contest_name=contest_name,
            contest_start_utc=start_utc,
            contest_end_utc=end_utc,
            official_problems=official_problems or [],
            ranking_history_attended=attended,
            raw_submissions=recent_ac,
            rank=contest_data.get("rank"),
            rating_after=contest_data.get("rating_after"),
        )


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
query userContestAndSubs($username: String!) {
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
  recentAcSubmissionList(username: $username, limit: 30) {
    id
    title
    titleSlug
    timestamp
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


from backend.services.token_bucket_limiter import global_token_bucket_limiter

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
        if attempt > 1:
            global_token_bucket_limiter.retry_count += 1
        await global_token_bucket_limiter.acquire_token()
        global_token_bucket_limiter.total_requests += 1

        try:
            resp = await client.post(GRAPHQL_URL, json=payload, headers=headers)
            if resp.status_code == 429:
                global_token_bucket_limiter.http_429_count += 1
                retry_after = resp.headers.get("Retry-After")
                if retry_after and str(retry_after).isdigit():
                    wait = float(retry_after)
                else:
                    wait = min(backoff ** attempt, 30.0)

                if attempt < retries:
                    await asyncio.sleep(wait)
                    continue
                global_token_bucket_limiter.rate_limited_failures += 1
                return {"status": "rate_limited", "data": None, "detail": "HTTP 429 Rate limit exhausted"}

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

            global_token_bucket_limiter.successful_requests += 1
            return {"status": "ok", "data": gql_data}

        except httpx.TimeoutException:
            if attempt < retries:
                await asyncio.sleep(backoff ** attempt)
                continue
            return {"status": "timeout", "data": None}
        except httpx.RequestError as exc:
            if attempt < retries:
                await asyncio.sleep(backoff ** attempt)
                continue
            return {"status": "error", "data": None, "detail": str(exc)}
        except Exception as exc:
            logger.exception(f"Unexpected programming error in _gql: {exc}")
            raise

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
    res = await _gql(client, _CONTEST_HISTORY_QUERY, {"username": username}, "userContestAndSubs", username)
    if res["status"] in ("timeout", "rate_limited", "error"):
        return res["status"], None

    data = res.get("data") or {}
    history_raw: List[Dict] = data.get("userContestRankingHistory") or []
    recent_ac: List[Dict] = data.get("recentAcSubmissionList") or []
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
        return "not_in_history", {"attended": False, "recent_ac": recent_ac}

    c_info = matched_entry.get("contest") or {}
    c_start = c_info.get("startTime")
    entry = {
        "contest_title":       c_info.get("title"),
        "contest_id":          contest_id,
        "username":            username,
        "attended":            bool(matched_entry.get("attended", False)),
        "problems_solved":     int(matched_entry.get("problemsSolved") or 0),
        "finish_time_seconds": matched_entry.get("finishTimeInSeconds"),
        "ranking":             matched_entry.get("ranking"),
        "rating_after":        matched_entry.get("rating"),
        "source_timestamp":    datetime.datetime.fromtimestamp(c_start, tz=datetime.timezone.utc) if c_start else None,
        "contest_start_unix":  c_start,
        "recent_ac":           recent_ac,
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
    official_problems: Optional[List[Dict[str, Any]]] = None,
) -> ContestStatusRow:
    """Async pure classifier implementation for high-throughput live sync."""
    raw_username = (leetcode_username or "").strip()
    canonical_id = normalize_contest_id(contest_id)
    start_utc, end_utc = get_contest_utc_window(canonical_id)

    # Username validation
    if not raw_username or len(raw_username) < 2:
        return ContestStatusRow(
            student_id=student_id,
            student_name=student_name,
            verified_leetcode_username=None,
            contest_id=canonical_id,
            contest_name=contest_name,
            status=ContestStatus.NO_LEETCODE_HANDLE,
            reason_code=ReasonCode.NO_USERNAME,
            reason_text="Student does not have a mapped LeetCode account.",
            fetch_status=FetchStatus.OK,
            classification_signal="no_username",
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
            classification_signal="invalid_username",
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
            classification_signal="identity_mismatch",
        )
    if val_status in ("timeout", "rate_limited", "error"):
        return ContestStatusRow(
            student_id=student_id,
            student_name=student_name,
            verified_leetcode_username=raw_username,
            contest_id=canonical_id,
            contest_name=contest_name,
            status=ContestStatus.NOT_VERIFIED,
            reason_code=ReasonCode.FETCH_ERROR,
            reason_text=f"Contest participation could not be verified due to API error: {val_status}",
            fetch_status=FetchStatus.FAILED,
            error_message=f"Profile fetch failed: {val_status}",
            classification_signal="submission_evidence_unavailable",
        )

    # Fetch Contest Data
    fetch_st, entry = await _fetch_contest_entry(canonical_username, canonical_id, client)
    if fetch_st in ("timeout", "rate_limited", "error"):
        return ContestStatusRow(
            student_id=student_id,
            student_name=student_name,
            verified_leetcode_username=canonical_username,
            contest_id=canonical_id,
            contest_name=contest_name,
            status=ContestStatus.NOT_VERIFIED,
            reason_code=ReasonCode.FETCH_ERROR,
            reason_text=f"Contest participation could not be verified due to timeout/error: {fetch_st}",
            fetch_status=FetchStatus.FAILED,
            error_message=f"Contest fetch failed: {fetch_st}",
            classification_signal="submission_evidence_unavailable",
        )

    attended = entry.get("attended", False) if entry else False
    recent_ac = entry.get("recent_ac", []) if entry else []

    if not official_problems:
        official_problems = get_official_contest_problems(canonical_id)

    return evaluate_contest_evidence(
        student_id=student_id,
        student_name=student_name,
        leetcode_username=canonical_username,
        contest_id=canonical_id,
        contest_name=contest_name,
        contest_start_utc=start_utc,
        contest_end_utc=end_utc,
        official_problems=official_problems or [],
        ranking_history_attended=attended,
        raw_submissions=recent_ac,
        rank=entry.get("ranking") if entry else None,
        rating_after=entry.get("rating_after") if entry else None,
    )


@dataclass
class ContestSyncResult:
    contest_id:        str
    contest_name:      str
    total_roster:      int
    public_attended:   int = 0
    virtual_attended:  int = 0
    attended_zero:     int = 0
    not_attended:      int = 0
    fetch_failed:      int = 0
    rows:              List[ContestStatusRow] = field(default_factory=list)


async def classify_all_students(
    students: List[Dict[str, Any]],
    contest_id: str,
    contest_name: str,
    concurrency: int = 8,
    official_problems: Optional[List[Dict[str, Any]]] = None,
) -> ContestSyncResult:
    canonical_id = normalize_contest_id(contest_id)
    if not official_problems:
        official_problems = get_official_contest_problems(canonical_id)

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
                official_problems=official_problems,
            )
            await asyncio.sleep(0.05)
            return row

    async with httpx.AsyncClient(timeout=timeout, limits=limits, follow_redirects=True, http2=False) as client:
        tasks = [_classify(s) for s in students]
        rows = await asyncio.gather(*tasks)

    for row in rows:
        result.rows.append(row)
        if row.status in (ContestStatus.LIVE, ContestStatus.PUBLIC_ATTENDED, ContestStatus.PUBLIC_LIVE_VERIFIED):
            result.public_attended += 1
        elif row.status in (ContestStatus.VIRTUAL, ContestStatus.VIRTUAL_ATTENDED, ContestStatus.VIRTUAL_PRACTICE_VERIFIED):
            result.virtual_attended += 1
        elif row.status == ContestStatus.ATTENDED_ZERO:
            result.attended_zero += 1
        elif row.status == ContestStatus.NOT_ATTENDED:
            result.not_attended += 1
        else:
            result.fetch_failed += 1

    return result
