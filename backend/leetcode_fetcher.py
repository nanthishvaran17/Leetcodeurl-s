import re
import time
import datetime
import asyncio
import httpx
from typing import Dict, Any, Tuple, Optional
from backend.config import settings
from backend.logger import logger

# In-memory cache: username -> { "timestamp": float, "data": dict }
_profile_cache: Dict[str, Dict[str, Any]] = {}

LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql"
USER_CONTEST_QUERY = """
query userContestRankingInfo($username: String!) {
  userContestRanking(username: $username) {
    attendedContestsCount
    rating
    globalRanking
    totalParticipants
    topPercentage
    badge {
      name
    }
  }
  userContestRankingHistory(username: $username) {
    attended
    trendDirection
    problemsSolved
    totalProblems
    finishTimeInSeconds
    rating
    ranking
    contest {
      title
      startTime
    }
  }
}
"""

RESERVED_USERNAMES = {
    'contest', 'problems', 'explore', 'discuss', 'interview',
    'store', 'signup', 'login', 'profile', 'account', 'problemset'
}

def clear_leetcode_cache(username: Optional[str] = None):
    """Clears in-memory profile cache for a specific username or entire cache if None."""
    global _profile_cache
    if username:
        u_norm = username.strip().lower()
        _profile_cache.pop(u_norm, None)
    else:
        _profile_cache.clear()

def extract_leetcode_username(url_or_username: Optional[str]) -> Tuple[Optional[str], Optional[str], str]:
    """
    Extract username and generate standardized profile URL from LeetCode URL or username string.
    Normalizes URLs with trailing slashes, query parameters, or domain paths.
    Examples:
      - https://leetcode.com/u/john_doe/ -> ("john_doe", "https://leetcode.com/u/john_doe/", "OK")
      - https://leetcode.com/u/john_doe/?ref=123 -> ("john_doe", "https://leetcode.com/u/john_doe/", "OK")
      - https://leetcode.com/john_doe -> ("john_doe", "https://leetcode.com/u/john_doe/", "OK")
      - john_doe -> ("john_doe", "https://leetcode.com/u/john_doe/", "OK")
    Returns (username, profile_url, status)
    """
    if not url_or_username or not str(url_or_username).strip():
        return None, None, "MISSING LINK"
    
    cleaned = str(url_or_username).strip()

    # Strip query strings and URL fragments
    cleaned = cleaned.split('?')[0].split('#')[0].strip()

    # If full URL is provided, ensure domain is strictly leetcode.com
    if re.match(r'^https?:\/\/', cleaned, flags=re.IGNORECASE):
        if not re.match(r'^https?:\/\/(?:www\.)?leetcode\.com\/', cleaned, flags=re.IGNORECASE):
            return None, None, "INVALID LINK"
    
    # Handle pure username string if given (no protocol)
    if re.match(r'^[a-zA-Z0-9_-]{3,35}$', cleaned):
        if cleaned.lower() not in RESERVED_USERNAMES:
            std_url = f"https://leetcode.com/u/{cleaned}/"
            return cleaned, std_url, "OK"
        return None, None, "INVALID LINK"

    # Strip domain and prefixes like /u/, /login/, /profile/
    cleaned_path = re.sub(
        r'^https?:\/\/(?:www\.)?leetcode\.com\/(?:u\/)?(?:login\/)?(?:profile\/)?',
        '',
        cleaned,
        flags=re.IGNORECASE
    )
    cleaned_path = cleaned_path.strip('/')
    
    match = re.match(r'^([a-zA-Z0-9_-]{3,35})', cleaned_path)
    if match:
        username = match.group(1)
        if username.lower() in RESERVED_USERNAMES:
            return None, None, "INVALID LINK"
        std_url = f"https://leetcode.com/u/{username}/"
        return username, std_url, "OK"
    
    return None, None, "INVALID LINK"

GRAPHQL_URL = "https://leetcode.com/graphql"

# ── PROFILE + STATS + BADGES + LANGUAGES + CALENDAR (Phase A) ─────────────
USER_PROFILE_QUERY = """
query userPublicProfile($username: String!) {
  matchedUser(username: $username) {
    username
    profile {
      ranking
      userAvatar
      realName
      aboutMe
      school
      company
      countryName
      reputation
    }
    userCalendar {
      streak
      totalActiveDays
      submissionCalendar
    }
    submitStats: submitStatsGlobal {
      acSubmissionNum {
        difficulty
        count
      }
    }
    badges {
      id
      displayName
      icon
      creationDate
    }
    languageProblemCount {
      languageName
      problemsSolved
    }
  }
}
"""

# ── CONTEST RANKING + FULL HISTORY (Phase B) ────────────────────────────────

USER_CONTEST_QUERY = """
query userContestRankingInfo($username: String!) {
  userContestRanking(username: $username) {
    attendedContestsCount
    rating
    globalRanking
    totalParticipants
    topPercentage
  }
  userContestRankingHistory(username: $username) {
    attended
    trendDirection
    problemsSolved
    totalProblems
    finishTimeInSeconds
    rating
    ranking
    contest {
      title
      startTime
    }
  }
}
"""

def fetch_leetcode_profile_sync(
    url_or_username: Optional[str],
    force_refresh: bool = False,
    timeout: Optional[float] = None,
    max_retries: Optional[int] = None
) -> Dict[str, Any]:
    """Synchronous wrapper for fetch_leetcode_profile."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    return loop.run_until_complete(
        fetch_leetcode_profile(
            url_or_username=url_or_username,
            force_refresh=force_refresh,
            timeout=timeout,
            max_retries=max_retries
        )
    )

async def fetch_leetcode_profile(
    url_or_username: Optional[str],
    force_refresh: bool = False,
    timeout: Optional[float] = None,
    max_retries: Optional[int] = None
) -> Dict[str, Any]:
    """
    Fetches publicly available LeetCode profile statistics cleanly and safely.
    Strictly distinguishes Public Profile stats, Official Contest participation, and Virtual Contest participation.
    """
    start_time = time.time()
    req_timeout = timeout or float(settings.REQUEST_TIMEOUT)
    retries = max_retries or int(settings.MAX_RETRIES)

    username, profile_url, url_status = extract_leetcode_username(url_or_username)
    if url_status != "OK" or not username:
        duration = round(time.time() - start_time, 3)
        err_msg = f"Invalid or missing profile URL: {url_status}"
        return {
            "username": username,
            "profile_url": profile_url or (str(url_or_username) if url_or_username else ""),
            "total_solved":   None,  # Not fetched — never claim fake zero
            "easy_solved":    None,
            "medium_solved":  None,
            "hard_solved":    None,
            "contest_rating":         None,
            "contest_global_rank":     None,
            "contest_global_ranking":  None,
            "leetcode_global_rank":    None,
            "public_profile_ranking":  None,
            "active_days":             None,
            "max_streak":              None,
            "recent_accepted":         None,
            "recent_contest_name":     None,
            "recent_contest_score":    None,
            "recent_contest_type":     "UNKNOWN",
            "contest_participations":  [],
            "status": url_status,  # MISSING LINK or INVALID LINK
            "sync_status": "failed",
            "validation_status": "pending",
            "error": err_msg,
            "error_message": err_msg,
            "fetch_duration": duration
        }
    
    # Normalise username to lower-case so cache keys are always consistent
    username = username.lower()

    # Check in-memory cache
    now = time.time()
    cache_ttl = settings.CACHE_DURATION * 60
    if not force_refresh and username in _profile_cache:
        cached_item = _profile_cache[username]
        if now - cached_item["timestamp"] < cache_ttl:
            return cached_item["data"]

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": "https://leetcode.com",
        "Referer": f"https://leetcode.com/u/{username}/"
    }

    matched_user = None
    last_error_detail = ""

    # Fine-grained timeouts
    timeout_cfg = httpx.Timeout(connect=5.0, read=req_timeout, write=5.0, pool=5.0)
    limits_cfg = httpx.Limits(max_keepalive_connections=10, max_connections=20)

    async with httpx.AsyncClient(timeout=timeout_cfg, limits=limits_cfg, follow_redirects=True, http2=False) as client:
        # 1. Fetch Profile & Submission Stats
        payload_profile = {
            "query": USER_PROFILE_QUERY,
            "variables": {"username": username},
            "operationName": "userPublicProfile"
        }

        for attempt in range(1, retries + 1):
            try:
                res = await client.post(GRAPHQL_URL, json=payload_profile, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    gql_errors = data.get("errors")
                    if gql_errors and not data.get("data"):
                        last_error_detail = f"GraphQL Error: {gql_errors[0].get('message', 'Unknown GraphQL error')}"
                        logger.warning(f"GraphQL error for '{username}' (Attempt {attempt}/{retries}): {last_error_detail}")
                    else:
                        matched_user = data.get("data", {}).get("matchedUser")
                        if matched_user is not None:
                            break
                        else:
                            last_error_detail = f"User '{username}' does not exist on LeetCode (matchedUser is null)"
                            break
                else:
                    last_error_detail = f"HTTP {res.status_code} response from LeetCode"
                    logger.warning(f"LeetCode returned HTTP {res.status_code} for user '{username}' (Attempt {attempt}/{retries})")
            
            except httpx.TimeoutException:
                last_error_detail = "Network timeout"
                logger.warning(f"Timeout fetching profile for '{username}' (Attempt {attempt}/{retries})")
            except (httpx.RemoteProtocolError, httpx.ConnectError, httpx.NetworkError) as net_err:
                last_error_detail = f"Network connection drop ({type(net_err).__name__})"
                logger.warning(f"Connection issue for '{username}' (Attempt {attempt}/{retries}): {last_error_detail}")
            except Exception as e:
                last_error_detail = f"{type(e).__name__}: {str(e) or 'Request failed'}"
                logger.warning(f"Error fetching profile for '{username}' (Attempt {attempt}/{retries}): {last_error_detail}")

            if attempt < retries and matched_user is None and "matchedUser is null" not in last_error_detail:
                import random
                jitter = random.uniform(0.1, 0.5)
                await asyncio.sleep((1.5 ** attempt) + jitter)

        # Handle profile not found (404 / matchedUser is null) or network failures
        if not matched_user:
            duration = round(time.time() - start_time, 3)
            is_404 = "matchedUser is null" in last_error_detail
            status_code = "INVALID_USERNAME" if is_404 else "FETCH_FAILED"
            sync_code = "invalid_username" if is_404 else "fetch_failed"
            val_code = "invalid_username" if is_404 else "fetch_failed"
            err_msg = f"LeetCode profile not found (404)" if is_404 else f"Profile fetch failed: {last_error_detail}"

            result = {
                "username": username,
                "profile_url": None,  # Rule 2 & 15: profile_url = null when verification fails
                "total_solved": None,  # Rule 6: Never claim fake zero
                "easy_solved": None,
                "medium_solved": None,
                "hard_solved": None,
                "contest_rating": None,
                "contest_global_rank": None,
                "contest_global_ranking": None,
                "leetcode_global_rank": None,
                "public_profile_ranking": None,
                "active_days": None,
                "max_streak": None,
                "recent_accepted": None,
                "recent_contest_name": None,
                "recent_contest_score": None,
                "recent_contest_type": "UNKNOWN",
                "contest_participations": [],
                "status": status_code,
                "sync_status": sync_code,
                "validation_status": val_code,
                "error": err_msg,
                "error_message": err_msg,
                "fetch_duration": duration
            }
            _profile_cache[username] = {"timestamp": now, "data": result}
            return result

        # Rule 4: IDENTITY MATCHING — CRITICAL
        canonical_username = matched_user.get("username")
        if not canonical_username or canonical_username.lower() != username.lower():
            duration = round(time.time() - start_time, 3)
            err_msg = f"Identity mismatch: returned '{canonical_username}' != candidate '{username}'"
            logger.warning(f"[IDENTITY_MISMATCH] {err_msg}")
            result = {
                "username": username,
                "profile_url": None,
                "total_solved": None,
                "easy_solved": None,
                "medium_solved": None,
                "hard_solved": None,
                "contest_rating": None,
                "contest_global_rank": None,
                "contest_global_ranking": None,
                "leetcode_global_rank": None,
                "public_profile_ranking": None,
                "active_days": None,
                "max_streak": None,
                "recent_accepted": None,
                "recent_contest_name": None,
                "recent_contest_score": None,
                "recent_contest_type": "UNKNOWN",
                "contest_participations": [],
                "status": "IDENTITY_MISMATCH",
                "sync_status": "identity_mismatch",
                "validation_status": "identity_mismatch",
                "error": err_msg,
                "error_message": err_msg,
                "fetch_duration": duration
            }
            _profile_cache[username] = {"timestamp": now, "data": result}
            return result

        # Rule 2: Canonical profile URL generated ONLY after successful verification
        canonical_profile_url = f"https://leetcode.com/u/{canonical_username}/"

        # Parse submission stats
        submit_stats = (
            matched_user.get("submitStatsGlobal", {}).get("acSubmissionNum") or 
            matched_user.get("submitStats", {}).get("acSubmissionNum") or []
        )
        solved_map = {item.get("difficulty"): item.get("count", 0) for item in submit_stats if isinstance(item, dict)}

        total_solved = solved_map.get("All", 0)
        easy_solved = solved_map.get("Easy", 0)
        medium_solved = solved_map.get("Medium", 0)
        hard_solved = solved_map.get("Hard", 0)
        profile_ranking = matched_user.get("profile", {}).get("ranking")

        # Parse calendar info
        user_calendar = matched_user.get("userCalendar") or {}
        active_days = user_calendar.get("totalActiveDays")
        max_streak = user_calendar.get("streak")

        # 2. Fetch Contest Ranking & Detailed Contest History
        contest_rating = None
        contest_global_ranking = None
        recent_contest_name = None
        recent_contest_score = None
        recent_contest_type = "UNKNOWN"
        contest_participations = []

        try:
            payload_contest = {
                "query": USER_CONTEST_QUERY,
                "variables": {"username": username},
                "operationName": "userContestRankingInfo"
            }
            res_contest = await client.post(GRAPHQL_URL, json=payload_contest, headers=headers)
            if res_contest.status_code == 200:
                c_data = res_contest.json()
                contest_info = c_data.get("data", {}).get("userContestRanking")
                if isinstance(contest_info, dict):
                    c_rating = contest_info.get("rating")
                    if c_rating is not None:
                        contest_rating = round(float(c_rating), 1)
                    contest_global_ranking = contest_info.get("globalRanking")
                
                # Fetch recent contest history and separate OFFICIAL vs VIRTUAL
                contest_history = c_data.get("data", {}).get("userContestRankingHistory") or []
                if isinstance(contest_history, list):
                    for item in contest_history:
                        if not isinstance(item, dict):
                            continue
                        c_title = item.get("contest", {}).get("title") or "Weekly Contest"
                        c_start = item.get("contest", {}).get("startTime")
                        c_solved = item.get("problemsSolved", 0)
                        c_total = item.get("totalProblems", 4)
                        c_rank = item.get("ranking")
                        c_rating = item.get("rating")
                        is_attended = item.get("attended", False)

                        # Determine participation type strictly:
                        # OFFICIAL: attended == True with official rank/rating entry
                        # VIRTUAL: attended == False but problemsSolved > 0 or virtual contest score
                        if is_attended:
                            part_type = "OFFICIAL"
                        elif c_solved > 0:
                            part_type = "VIRTUAL"
                        else:
                            part_type = "UNKNOWN"

                        if part_type != "UNKNOWN":
                            contest_participations.append({
                                "contest_name": c_title,
                                "contest_date": datetime.datetime.fromtimestamp(c_start).strftime("%Y-%m-%d") if c_start else None,
                                "participation_type": part_type,
                                "registered": True,
                                "started": True,
                                "submitted": True if c_solved > 0 else False,
                                "problems_solved": c_solved,
                                "total_problems": c_total,
                                "contest_rank": c_rank if part_type == "OFFICIAL" else None,
                                "contest_rating_after": c_rating if part_type == "OFFICIAL" else None,
                                "source": "leetcode_graphql"
                            })

                    attended_contests = [c for c in contest_history if isinstance(c, dict) and (c.get("attended") or c.get("problemsSolved", 0) > 0)]
                    if attended_contests:
                        latest = attended_contests[-1]
                        recent_contest_name = latest.get("contest", {}).get("title")
                        solved = latest.get("problemsSolved", 0)
                        total = latest.get("totalProblems", 4)
                        recent_contest_score = f"{solved} / {total}"
                        recent_contest_type = "OFFICIAL" if latest.get("attended") else "VIRTUAL"
                        if latest.get("ranking") and latest.get("attended"):
                            contest_global_ranking = latest.get("ranking")
                        if latest.get("rating") and latest.get("attended"):
                            contest_rating = round(float(latest.get("rating")), 1)
        except Exception as e:
            logger.info(f"Contest stats skipped for '{username}': {e}")

        # Statistics Validation: easy + medium + hard == total_solved
        calculated_total = easy_solved + medium_solved + hard_solved
        if total_solved == 0 and calculated_total > 0:
            total_solved = calculated_total

        is_valid_sum = (easy_solved + medium_solved + hard_solved == total_solved)
        sync_status = "success" if is_valid_sum else "mismatch"
        error_detail = None if is_valid_sum else f"Difficulty sum mismatch: {easy_solved} + {medium_solved} + {hard_solved} != {total_solved}"
        if not is_valid_sum:
            logger.warning(f"CRITICAL STATS MISMATCH for user '{username}': {error_detail}")

        duration = round(time.time() - start_time, 3)
        verified_at = datetime.datetime.now(datetime.timezone.utc).isoformat()

        result = {
            "username": canonical_username,
            "profile_url": canonical_profile_url,
            "total_solved": total_solved,
            "easy_solved": easy_solved,
            "medium_solved": medium_solved,
            "hard_solved": hard_solved,
            "contest_rating": contest_rating,
            "contest_global_rank": contest_global_ranking,
            "contest_global_ranking": contest_global_ranking,
            "leetcode_global_rank": profile_ranking,
            "public_profile_ranking": profile_ranking,
            "active_days": active_days,
            "max_streak": max_streak,
            "recent_accepted": total_solved,
            "recent_contest_name": recent_contest_name,
            "recent_contest_score": recent_contest_score,
            "recent_contest_type": recent_contest_type,
            "contest_participations": contest_participations,
            "status": "success" if is_valid_sum else "MISMATCH",
            "sync_status": sync_status,
            "validation_status": "verified" if is_valid_sum else "mismatch",
            "source": "leetcode_public_profile",
            "last_verified_at": verified_at,
            "error": error_detail,
            "error_message": error_detail,
            "fetch_duration": duration
        }

        _profile_cache[username] = {"timestamp": now, "data": result}
        return result


# ─────────────────────────────────────────────────────────────────────────────
# NEW GRAPHQL QUERIES (Phase C, D, E)
# ─────────────────────────────────────────────────────────────────────────────

# Phase C — Topic stats
USER_TOPIC_QUERY = """
query userTagProblemCounts($username: String!) {
  matchedUser(username: $username) {
    tagProblemCounts {
      advanced     { tagName tagSlug problemsSolved }
      intermediate { tagName tagSlug problemsSolved }
      fundamental  { tagName tagSlug problemsSolved }
    }
  }
}
"""

# Phase D — Submission calendar
USER_CALENDAR_QUERY = """
query userCalendar($username: String!, $year: Int) {
  matchedUser(username: $username) {
    userCalendar(year: $year) {
      submissionCalendar
      totalActiveDays
      streak
    }
  }
}
"""

# Phase E — Recent accepted submissions (capped at 20 — NOT exhaustive history)
USER_RECENT_SUBMISSIONS_QUERY = """
query recentAcSubmissions($username: String!, $limit: Int!) {
  recentAcSubmissionList(username: $username, limit: $limit) {
    id
    title
    titleSlug
    timestamp
    statusDisplay
    lang
    runtime
    memory
  }
}
"""


# ─────────────────────────────────────────────────────────────────────────────
# TYPED ASYNC FETCH FUNCTIONS WITH EXPLICIT BACKOFF
# Return shape: {"status": "ok"|"rate_limited"|"timeout"|"not_found"|"identity_mismatch"|"error", "data": ...}
# ─────────────────────────────────────────────────────────────────────────────

def _make_headers(username: str) -> dict:
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Content-Type": "application/json",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": "https://leetcode.com",
        "Referer": f"https://leetcode.com/u/{username}/",
    }


import os
import random

_LEETCODE_MAX_CONCURRENCY = int(os.environ.get("LEETCODE_MAX_CONCURRENCY", 15))
_GQL_SEMAPHORE = asyncio.Semaphore(_LEETCODE_MAX_CONCURRENCY)

async def _gql_post(
    client: Any,
    query: str,
    variables: dict,
    operation: str,
    username: str,
    retries: int = 2,
    backoff_base: float = 1.5,
) -> Dict[str, Any]:
    """
    Single GraphQL POST with exponential backoff and randomized jitter.
    Strictly bounded by a global semaphore to prevent HTTP connection starvation.
    Handles 429 (rate limit), 5xx (server error), timeouts.
    Returns canonical result dict — never raises.
    """
    headers = _make_headers(username)
    payload = {"query": query, "variables": variables, "operationName": operation}

    for attempt in range(1, retries + 1):
        try:
            async with _GQL_SEMAPHORE:
                res = await client.post(GRAPHQL_URL, json=payload, headers=headers)

            if res.status_code == 429:
                wait = min(backoff_base ** attempt, 60.0) + random.uniform(0.0, 1.0)
                logger.warning(f"[RATE_LIMIT] {username}/{operation} attempt {attempt} — waiting {wait:.1f}s")
                if attempt < retries:
                    await asyncio.sleep(wait)
                    continue
                return {"status": "rate_limited", "data": None}

            if res.status_code >= 500:
                wait = min(backoff_base ** attempt, 30.0) + random.uniform(0.0, 1.0)
                logger.warning(f"[SERVER_ERROR] {username}/{operation} HTTP {res.status_code} attempt {attempt}")
                if attempt < retries:
                    await asyncio.sleep(wait)
                    continue
                return {"status": "error", "data": None, "detail": f"HTTP {res.status_code}"}

            if res.status_code != 200:
                return {"status": "error", "data": None, "detail": f"HTTP {res.status_code}"}

            body = res.json()
            gql_errors = body.get("errors")
            gql_data   = body.get("data", {})

            if gql_errors and not gql_data:
                msg = gql_errors[0].get("message", "") if gql_errors else ""
                return {"status": "error", "data": None, "detail": msg}

            return {"status": "ok", "data": gql_data}

        except httpx.TimeoutException:
            logger.warning(f"[TIMEOUT] {username}/{operation} attempt {attempt}")
            if attempt < retries:
                await asyncio.sleep((backoff_base ** attempt) + random.uniform(0.0, 1.0))
                continue
            return {"status": "timeout", "data": None}

        except (httpx.RemoteProtocolError, httpx.ConnectError, httpx.NetworkError) as net_err:
            logger.warning(f"[NETWORK] {username}/{operation} {type(net_err).__name__} attempt {attempt}")
            if attempt < retries:
                await asyncio.sleep((backoff_base ** attempt) + random.uniform(0.0, 1.0))
                continue
            return {"status": "error", "data": None, "detail": str(net_err)}

        except Exception as exc:
            logger.error(f"[UNEXPECTED] {username}/{operation}: {exc}")
            return {"status": "error", "data": None, "detail": str(exc)}

    return {"status": "error", "data": None, "detail": "Max retries exceeded"}


async def fetch_profile_and_stats(
    username: str,
    client: Any,
    retries: int = 3,
    backoff_base: float = 1.5,
) -> Dict[str, Any]:
    """
    Phase A fetch: profile identity + problem stats + badges + languages.
    Returns parsed dict or error status.
    """
    result = await _gql_post(
        client, USER_PROFILE_QUERY, {"username": username},
        "userPublicProfile", username, retries, backoff_base
    )
    if result["status"] != "ok":
        return result

    matched = result["data"].get("matchedUser")
    if matched is None:
        return {"status": "not_found", "data": None}

    # Identity check — required before storing anything
    canonical = matched.get("username", "")
    if canonical.lower() != username.lower():
        return {"status": "identity_mismatch", "data": None,
                "detail": f"returned '{canonical}' != requested '{username}'"}

    profile = matched.get("profile") or {}
    submit_stats = (
        matched.get("submitStatsGlobal", {}).get("acSubmissionNum") or
        matched.get("submitStats", {}).get("acSubmissionNum") or []
    )
    solved_map = {item["difficulty"]: item["count"] for item in submit_stats if isinstance(item, dict)}

    badges_raw = matched.get("badges") or []
    badges = []
    for b in badges_raw:
        if isinstance(b, dict):
            badges.append({
                "badge_id":     str(b.get("id", "")),
                "display_name": b.get("displayName"),
                "icon_url":     b.get("icon"),
                "awarded_at":   b.get("creationDate"),
            })

    languages_raw = matched.get("languageProblemCount") or []
    languages = [
        {"language_name": lp["languageName"], "problems_solved": lp["problemsSolved"]}
        for lp in languages_raw if isinstance(lp, dict)
    ]

    # Calendar & streak
    user_cal = matched.get("userCalendar") or {}
    cal_streak = user_cal.get("streak")
    cal_active_days = user_cal.get("totalActiveDays")
    cal_sub_raw = user_cal.get("submissionCalendar")
    cal_json_str = cal_sub_raw if isinstance(cal_sub_raw, str) else (json.dumps(cal_sub_raw) if cal_sub_raw else "{}")

    return {
        "status": "ok",
        "data": {
            "canonical_username":      canonical,
            "profile_url":            f"https://leetcode.com/u/{canonical}/",
            "real_name":              profile.get("realName"),
            "avatar_url":             profile.get("userAvatar"),
            "about_me":               profile.get("aboutMe"),
            "school":                 profile.get("school"),
            "company":                profile.get("company"),
            "country":                profile.get("countryName"),
            "reputation":             profile.get("reputation"),
            "profile_global_ranking": profile.get("ranking"),
            "total_solved":           solved_map.get("All"),
            "easy_solved":            solved_map.get("Easy"),
            "medium_solved":          solved_map.get("Medium"),
            "hard_solved":            solved_map.get("Hard"),
            "badges":                 badges,
            "languages":              languages,
            "streak":                 cal_streak,
            "max_streak":             cal_streak,
            "total_active_days":      cal_active_days,
            "submission_calendar_json": cal_json_str,
        }
    }


async def fetch_contest_data(
    username: str,
    client: Any,
    retries: int = 3,
    backoff_base: float = 1.5,
) -> Dict[str, Any]:
    """
    Phase B fetch: contest standing + full history.
    Weekly and Biweekly come from the SAME history array — filtered by title prefix.
    """
    result = await _gql_post(
        client, USER_CONTEST_QUERY, {"username": username},
        "userContestRankingInfo", username, retries, backoff_base
    )
    if result["status"] != "ok":
        return result

    data         = result["data"]
    ranking_info = data.get("userContestRanking") or {}
    history_raw  = data.get("userContestRankingHistory") or []

    history = []
    most_recent_name = None
    most_recent_type = None

    for item in reversed(history_raw):  # reversed = newest first
        if not isinstance(item, dict):
            continue
        c_info   = item.get("contest") or {}
        c_title  = c_info.get("title") or ""
        c_start  = c_info.get("startTime")
        attended = bool(item.get("attended", False))

        c_type = (
            "weekly"   if c_title.startswith("Weekly Contest") else
            "biweekly" if c_title.startswith("Biweekly Contest") else "other"
        )

        entry = {
            "contest_name":        c_title,
            "contest_type":        c_type,
            "contest_start_time":  datetime.datetime.utcfromtimestamp(c_start) if c_start else None,
            "attended":            attended,
            "problems_solved":     item.get("problemsSolved", 0),
            "total_problems":      item.get("totalProblems", 4),
            "finish_time_seconds": item.get("finishTimeInSeconds"),
            "contest_rank":        item.get("ranking") if attended else None,
            "rating_after":        item.get("rating"),
        }
        history.append(entry)

        if most_recent_name is None and attended:
            most_recent_name = c_title
            most_recent_type = c_type

    c_rating = ranking_info.get("rating")
    return {
        "status": "ok",
        "data": {
            "contest_rating":           round(float(c_rating), 1) if c_rating else None,
            "contest_global_ranking":   ranking_info.get("globalRanking"),
            "attended_count":           ranking_info.get("attendedContestsCount"),
            "top_percentage":           ranking_info.get("topPercentage"),
            "most_recent_contest_name": most_recent_name,
            "most_recent_contest_type": most_recent_type,
            "history":                  history,
        }
    }


async def fetch_topic_stats(
    username: str,
    client: Any,
    retries: int = 3,
    backoff_base: float = 2.0,
) -> Dict[str, Any]:
    """
    Phase C fetch: per-topic solved counts from tagProblemCounts.
    Real API data — do NOT fabricate skill percentages.
    """
    result = await _gql_post(
        client, USER_TOPIC_QUERY, {"username": username},
        "userTagProblemCounts", username, retries, backoff_base
    )
    if result["status"] != "ok":
        return result

    matched   = (result["data"] or {}).get("matchedUser") or {}
    tag_counts = matched.get("tagProblemCounts") or {}

    topics = []
    for tier in ("advanced", "intermediate", "fundamental"):
        for t in (tag_counts.get(tier) or []):
            if isinstance(t, dict):
                topics.append({
                    "topic_slug":      t.get("tagSlug", ""),
                    "topic_name":      t.get("tagName"),
                    "topic_tier":      tier,
                    "problems_solved": t.get("problemsSolved", 0),
                })

    return {"status": "ok", "data": {"topics": topics}}


async def fetch_activity_calendar(
    username: str,
    client: Any,
    year: Optional[int] = None,
    retries: int = 3,
    backoff_base: float = 2.0,
) -> Dict[str, Any]:
    """
    Phase D fetch: submission calendar + derived streaks.
    LeetCode returns submissionCalendar as a JSON string of {unix_ts: count}.
    Streaks are derived here — LeetCode does NOT return a reliable pre-computed streak.
    """
    import json as _json

    yr = year or datetime.datetime.utcnow().year
    result = await _gql_post(
        client, USER_CALENDAR_QUERY, {"username": username, "year": yr},
        "userCalendar", username, retries, backoff_base
    )
    if result["status"] != "ok":
        return result

    matched  = (result["data"] or {}).get("matchedUser") or {}
    cal_data = matched.get("userCalendar") or {}
    raw_cal  = cal_data.get("submissionCalendar") or "{}"

    try:
        cal_map = _json.loads(raw_cal) if isinstance(raw_cal, str) else raw_cal
    except Exception:
        cal_map = {}

    today_utc = datetime.datetime.utcnow().date()

    active_dates: set = set()
    for ts_str, count in cal_map.items():
        try:
            d = datetime.datetime.utcfromtimestamp(int(ts_str)).date()
            if count and int(count) > 0:
                active_dates.add(d)
        except Exception:
            continue

    total_active_days = len(active_dates)

    # Current streak: consecutive days ending today or yesterday
    current_streak = 0
    check = today_utc
    for _ in range(400):
        if check in active_dates:
            current_streak += 1
            check -= datetime.timedelta(days=1)
        elif check == today_utc:
            # allow streak that ended yesterday
            check -= datetime.timedelta(days=1)
            if check in active_dates:
                current_streak += 1
                check -= datetime.timedelta(days=1)
                continue
            break
        else:
            break

    # Longest streak
    longest_streak = 0
    if active_dates:
        sorted_dates = sorted(active_dates)
        run = 1
        for i in range(1, len(sorted_dates)):
            if (sorted_dates[i] - sorted_dates[i - 1]).days == 1:
                run += 1
                longest_streak = max(longest_streak, run)
            else:
                run = 1
        longest_streak = max(longest_streak, run)

    return {
        "status": "ok",
        "data": {
            "submission_calendar_json": _json.dumps(cal_map),
            "total_active_days":        total_active_days,
            "current_streak":           current_streak,
            "longest_streak":           longest_streak,
        }
    }


async def fetch_recent_submissions(
    username: str,
    client: Any,
    limit: int = 20,
    retries: int = 3,
    backoff_base: float = 2.0,
) -> Dict[str, Any]:
    """
    Phase E fetch: recent accepted submissions — capped at limit (default 20).
    NOT exhaustive — LeetCode exposes only the most recent ~20 accepted submissions.
    There is NO full submission history endpoint.
    """
    result = await _gql_post(
        client, USER_RECENT_SUBMISSIONS_QUERY, {"username": username, "limit": limit},
        "recentAcSubmissions", username, retries, backoff_base
    )
    if result["status"] != "ok":
        return result

    raw_list = (result["data"] or {}).get("recentAcSubmissionList") or []
    submissions = []
    for s in raw_list:
        if not isinstance(s, dict):
            continue
        ts = s.get("timestamp")
        dt_val = int(ts) if ts else None
        submissions.append({
            "title_slug":           s.get("titleSlug", ""),
            "title":                s.get("title"),
            "lang":                 s.get("lang"),
            "status_display":       s.get("statusDisplay"),
            "runtime_display":      s.get("runtime"),
            "memory_display":       s.get("memory"),
            "submission_timestamp": dt_val,
        })

    return {"status": "ok", "data": {"submissions": submissions}}


# ─────────────────────────────────────────────────────────────────────────────
# DYNAMIC CONTEST METADATA & MULTI-STAGE VERIFICATION PIPELINE
# ─────────────────────────────────────────────────────────────────────────────

CONTEST_METADATA_QUERY = """
query contestMetadata($vContestSlug: String!) {
  contest(contestSlug: $vContestSlug) {
    id
    title
    titleSlug
    startTime
    duration
    originStartTime
    isVirtual
    containsPremium
    questions {
      id
      questionId
      title
      titleSlug
    }
  }
}
"""

_contest_metadata_cache: Dict[str, Dict[str, Any]] = {}

async def fetch_contest_metadata(
    contest_slug: str,
    client: Optional[Any] = None,
    retries: int = 3
) -> Dict[str, Any]:
    """
    Fetches dynamic contest metadata (start/end times, dynamic problem count, problem slugs).
    Caches results in-memory to prevent redundant requests across student loops.
    """
    slug_clean = str(contest_slug).strip().lower()
    if slug_clean in _contest_metadata_cache:
        return _contest_metadata_cache[slug_clean]

    close_client = False
    if client is None:
        client = httpx.AsyncClient(timeout=httpx.Timeout(10.0), follow_redirects=True)
        close_client = True

    try:
        res = await _gql_post(
            client, CONTEST_METADATA_QUERY, {"vContestSlug": slug_clean},
            "contestMetadata", "system", retries=retries
        )
        if res.get("status") == "ok" and res.get("data", {}).get("contest"):
            c_info = res["data"]["contest"]
            questions = c_info.get("questions") or []
            prob_ids = [str(q.get("questionId") or q.get("id")) for q in questions if isinstance(q, dict)]
            prob_slugs = [q.get("titleSlug") for q in questions if isinstance(q, dict) and q.get("titleSlug")]
            start_ts = c_info.get("startTime") or c_info.get("originStartTime")
            duration = c_info.get("duration") or 5400  # Default 1.5h if missing
            end_ts = (start_ts + duration) if start_ts else None

            metadata = {
                "contestId": slug_clean,
                "contestSlug": slug_clean,
                "contestName": c_info.get("title") or f"Weekly Contest {slug_clean.split('-')[-1]}",
                "contestStartTime": datetime.datetime.utcfromtimestamp(start_ts) if start_ts else None,
                "contestEndTime": datetime.datetime.utcfromtimestamp(end_ts) if end_ts else None,
                "problemIds": prob_ids,
                "problemSlugs": prob_slugs,
                "totalProblems": len(prob_ids) if prob_ids else 4,
                "status": "VERIFIED"
            }
            _contest_metadata_cache[slug_clean] = metadata
            return metadata
    except Exception as exc:
        logger.warning(f"Failed to fetch contest metadata for {slug_clean}: {exc}")
    finally:
        if close_client and client:
            await client.aclose()

    fallback_num = re.search(r'\d+', slug_clean)
    num_str = fallback_num.group(0) if fallback_num else ""
    fallback = {
        "contestId": slug_clean,
        "contestSlug": slug_clean,
        "contestName": f"Weekly Contest {num_str}" if "weekly" in slug_clean else f"Biweekly Contest {num_str}",
        "contestStartTime": None,
        "contestEndTime": None,
        "problemIds": [],
        "problemSlugs": [],
        "totalProblems": 4,
        "status": "FALLBACK"
    }
    _contest_metadata_cache[slug_clean] = fallback
    return fallback


async def fetch_verified_student_contest_record(
    username: str,
    contest_slug: str,
    participation_mode: str = "PUBLIC",
    client: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Multi-stage verification pipeline for student contest participation.
    STRICT NON-ASSUMPTION POLICY: Never assumes solved count or problem statuses.

    Allowed participationStatus: PARTICIPATED, NOT_PARTICIPATED, SOURCE_UNAVAILABLE, UNKNOWN
    Allowed participationType: PUBLIC, VIRTUAL, UNKNOWN
    Allowed verificationLevel: DIRECT, CROSS_VERIFIED, PARTIAL, UNVERIFIED
    """
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    mode_clean = participation_mode.upper().strip()
    slug_clean = str(contest_slug).strip().lower()

    base_record = {
        "username": username,
        "contestId": slug_clean,
        "contestName": f"Weekly Contest {slug_clean.split('-')[-1]}",
        "participationStatus": "UNKNOWN",
        "participationType": mode_clean if mode_clean in ("PUBLIC", "VIRTUAL") else "UNKNOWN",
        "solvedCount": None,
        "totalProblems": 4,
        "solvedProblems": [],
        "rank": None,
        "score": None,
        "finishTime": None,
        "source": "leetcode_graphql",
        "sourceUrl": f"https://leetcode.com/u/{username}/",
        "verificationLevel": "UNVERIFIED",
        "confidence": 0.0,
        "lastChecked": now_iso,
        "error": None
    }

    if not username or len(username) < 2:
        base_record["error"] = "Invalid or empty username"
        return base_record

    close_client = False
    if client is None:
        client = httpx.AsyncClient(timeout=httpx.Timeout(12.0), follow_redirects=True)
        close_client = True

    try:
        # Fetch Contest Metadata first (dynamic totalProblems)
        meta = await fetch_contest_metadata(slug_clean, client=client)
        total_problems = meta.get("totalProblems", 4)
        base_record["totalProblems"] = total_problems
        base_record["contestName"] = meta.get("contestName", base_record["contestName"])
        prob_slugs = meta.get("problemSlugs", [])

        # Stage 1: Direct Official Contest History
        contest_res = await fetch_contest_data(username, client=client)
        if contest_res.get("status") in ("rate_limited", "timeout", "error"):
            base_record["participationStatus"] = "SOURCE_UNAVAILABLE"
            base_record["error"] = f"LeetCode GraphQL unavailable: {contest_res.get('status')}"
            return base_record

        if contest_res.get("status") != "ok" or not contest_res.get("data"):
            base_record["participationStatus"] = "UNKNOWN"
            base_record["error"] = f"Contest fetch returned status: {contest_res.get('status')}"
            return base_record

        history = contest_res["data"].get("history", [])
        target_num_match = re.search(r'\d+', slug_clean)
        target_num = int(target_num_match.group(0)) if target_num_match else None
        is_biweekly = "biweekly" in slug_clean

        matched_entry = None
        for item in history:
            c_name = item.get("contest_name", "")
            num_match = re.search(r'\d+', c_name)
            if not num_match or int(num_match.group(0)) != target_num:
                continue
            if ("Biweekly" in c_name) != is_biweekly:
                continue
            matched_entry = item
            break

        # Process PUBLIC mode
        if mode_clean == "PUBLIC":
            if matched_entry is None:
                # Student profile accessed cleanly, but contest is not in official contest history
                base_record["participationStatus"] = "NOT_PARTICIPATED"
                base_record["participationType"] = "PUBLIC"
                base_record["solvedCount"] = None
                base_record["verificationLevel"] = "DIRECT"
                base_record["confidence"] = 1.0
                return base_record

            attended = matched_entry.get("attended", False)
            if not attended:
                base_record["participationStatus"] = "NOT_PARTICIPATED"
                base_record["participationType"] = "PUBLIC"
                base_record["solvedCount"] = None
                base_record["verificationLevel"] = "DIRECT"
                base_record["confidence"] = 1.0
                return base_record

            # Student explicitly attended Public Contest
            solved_count = matched_entry.get("problems_solved")
            rank = matched_entry.get("contest_rank")
            finish_secs = matched_entry.get("finish_time_seconds")

            # Stage 2: Submission Verification for individual problem slugs
            verified_solved_problems = []
            level2_ran = False
            if prob_slugs:
                recent_subs_res = await fetch_recent_submissions(username, client=client, limit=20)
                if recent_subs_res.get("status") == "ok":
                    level2_ran = True
                    user_subs = recent_subs_res.get("data", {}).get("submissions", [])
                    contest_start = meta.get("contestStartTime")
                    contest_end = meta.get("contestEndTime")

                    for sub in user_subs:
                        tslug = sub.get("title_slug")
                        sub_dt = sub.get("submission_timestamp")
                        if tslug in prob_slugs and tslug not in verified_solved_problems:
                            # Check window if timestamps available
                            if contest_start and contest_end and sub_dt:
                                if contest_start <= sub_dt <= contest_end:
                                    verified_solved_problems.append(tslug)
                            else:
                                verified_solved_problems.append(tslug)

            # Stage 3: Cross-Verification & Verification Level Assessment
            base_record["participationStatus"] = "PARTICIPATED"
            base_record["participationType"] = "PUBLIC"
            base_record["solvedCount"] = solved_count
            base_record["rank"] = rank
            base_record["finishTime"] = finish_secs
            base_record["score"] = solved_count
            base_record["solvedProblems"] = verified_solved_problems

            if level2_ran and len(verified_solved_problems) == solved_count:
                base_record["verificationLevel"] = "CROSS_VERIFIED"
                base_record["confidence"] = 0.99
            elif solved_count is not None:
                base_record["verificationLevel"] = "DIRECT"
                base_record["confidence"] = 0.95
            else:
                base_record["verificationLevel"] = "PARTIAL"
                base_record["confidence"] = 0.70

            return base_record

        # Process VIRTUAL mode
        elif mode_clean == "VIRTUAL":
            # Check if student has explicit virtual participation evidence
            # Look at recent submissions for contest problems outside regular window or marked virtual
            recent_subs_res = await fetch_recent_submissions(username, client=client, limit=20)
            if recent_subs_res.get("status") == "ok" and prob_slugs:
                user_subs = recent_subs_res.get("data", {}).get("submissions", [])
                virt_solved = []
                for sub in user_subs:
                    tslug = sub.get("title_slug")
                    if tslug in prob_slugs and tslug not in virt_solved:
                        virt_solved.append(tslug)

                if virt_solved:
                    base_record["participationStatus"] = "PARTICIPATED"
                    base_record["participationType"] = "VIRTUAL"
                    base_record["solvedCount"] = len(virt_solved)
                    base_record["solvedProblems"] = virt_solved
                    base_record["score"] = len(virt_solved)
                    base_record["verificationLevel"] = "DIRECT"
                    base_record["confidence"] = 0.90
                    return base_record

            base_record["participationStatus"] = "NOT_PARTICIPATED"
            base_record["participationType"] = "VIRTUAL"
            base_record["solvedCount"] = None
            base_record["verificationLevel"] = "DIRECT"
            base_record["confidence"] = 0.90
            return base_record

    except Exception as exc:
        logger.error(f"Error in fetch_verified_student_contest_record for {username}/{contest_slug}: {exc}")
        base_record["participationStatus"] = "UNKNOWN"
        base_record["error"] = str(exc)
        base_record["verificationLevel"] = "UNVERIFIED"
        base_record["confidence"] = 0.0
        return base_record
    finally:
        if close_client and client:
            await client.aclose()

    return base_record

