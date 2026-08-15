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

RESERVED_USERNAMES = {
    'contest', 'problems', 'explore', 'discuss', 'interview',
    'store', 'signup', 'login', 'profile', 'account', 'problemset'
}

def extract_leetcode_username(url_or_username: Optional[str]) -> Tuple[Optional[str], Optional[str], str]:
    """
    Extract username and generate standardized profile URL from LeetCode URL or username string.
    Examples:
      - https://leetcode.com/u/john_doe/ -> ("john_doe", "https://leetcode.com/u/john_doe/", "OK")
      - https://leetcode.com/u/login/MADAN__200/ -> ("MADAN__200", "https://leetcode.com/u/MADAN__200/", "OK")
      - https://leetcode.com/john_doe -> ("john_doe", "https://leetcode.com/u/john_doe/", "OK")
      - john_doe -> ("john_doe", "https://leetcode.com/u/john_doe/", "OK")
    Returns (username, profile_url, status)
    """
    if not url_or_username or not str(url_or_username).strip():
        return None, None, "MISSING LINK"
    
    cleaned = str(url_or_username).strip()
    
    # Handle pure username string if given
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

USER_PROFILE_QUERY = """
query getUserProfile($username: String!) {
  matchedUser(username: $username) {
    username
    profile {
      ranking
      userAvatar
      realName
    }
    userCalendar(username: $username) {
      activeYears
      totalActiveDays
      streak
    }
    submitStats {
      acSubmissionNum {
        difficulty
        count
      }
    }
  }
}
"""

USER_CONTEST_QUERY = """
query getUserContest($username: String!) {
  userContestRanking(username: $username) {
    rating
    globalRanking
    attendedContestsCount
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
            "variables": {"username": username}
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
                await asyncio.sleep(0.3 * attempt)

        # Fallback APIs if GraphQL failed
        if not matched_user and "matchedUser is null" not in last_error_detail:
            fallback_urls = [
                f"https://leetcode-api-faisalshohag.vercel.app/{username}",
                f"https://alfa-leetcode-api.onrender.com/userProfile/{username}",
                f"https://alfa-leetcode-api.onrender.com/{username}/solved"
            ]

            for fb_url in fallback_urls:
                try:
                    fb_res = await client.get(fb_url, timeout=6.0)
                    if fb_res.status_code == 200:
                        fb_data = fb_res.json()
                        tot_s = fb_data.get("totalSolved") if fb_data.get("totalSolved") is not None else fb_data.get("solvedProblem")
                        if tot_s is not None:
                            duration = round(time.time() - start_time, 3)
                            ez_s = fb_data.get("easySolved") if fb_data.get("easySolved") is not None else fb_data.get("easySolvedCount", 0)
                            med_s = fb_data.get("mediumSolved") if fb_data.get("mediumSolved") is not None else fb_data.get("mediumSolvedCount", 0)
                            hd_s = fb_data.get("hardSolved") if fb_data.get("hardSolved") is not None else fb_data.get("hardSolvedCount", 0)
                            p_rank = fb_data.get("ranking")

                            is_valid_sum = (ez_s + med_s + hd_s == tot_s)
                            sync_status = "success" if is_valid_sum else "mismatch"
                            validation_status = "verified" if is_valid_sum else "mismatch"
                            error_detail = None if is_valid_sum else f"Difficulty sum mismatch in fallback: {ez_s} + {med_s} + {hd_s} != {tot_s}"
                            
                            result = {
                                "username": username,
                                "profile_url": profile_url,
                                "total_solved": tot_s,
                                "easy_solved": ez_s,
                                "medium_solved": med_s,
                                "hard_solved": hd_s,
                                "contest_rating": None,
                                "contest_global_rank": None,
                                "contest_global_ranking": None,
                                "leetcode_global_rank": p_rank,
                                "public_profile_ranking": p_rank,
                                "active_days": None,
                                "max_streak": None,
                                "recent_accepted": None,
                                "recent_contest_name": None,
                                "recent_contest_score": None,
                                "recent_contest_type": "UNKNOWN",
                                "contest_participations": [],
                                "status": "success" if is_valid_sum else "MISMATCH",
                                "sync_status": sync_status,
                                "validation_status": validation_status,
                                "error": error_detail,
                                "error_message": error_detail,
                                "fetch_duration": duration
                            }
                            _profile_cache[username] = {"timestamp": now, "data": result}
                            return result
                except Exception as fb_err:
                    logger.info(f"Fallback API ({fb_url}) note for '{username}': {fb_err}")

        # If user is not found or failed completely
        if not matched_user:
            duration = round(time.time() - start_time, 3)
            err_msg = f"Profile load failed: {last_error_detail}"
            status_code = "PROFILE NOT FOUND" if "matchedUser is null" in last_error_detail else "failed"

            result = {
                "username": username,
                "profile_url": profile_url,
                "total_solved":   None,  # Never claim fake zero
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
                "status": status_code,
                "sync_status": "failed",
                "validation_status": "pending",
                "error": err_msg,
                "error_message": err_msg,
                "fetch_duration": duration
            }
            _profile_cache[username] = {"timestamp": now, "data": result}
            return result

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
                "variables": {"username": username}
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
            "username": username,
            "profile_url": profile_url,
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

