import re
import time
import asyncio
import httpx
from typing import Dict, Any, Tuple, Optional
from backend.config import settings
from backend.logger import logger

# In-memory cache: username -> { "timestamp": float, "data": dict }
_profile_cache: Dict[str, Dict[str, Any]] = {}

def extract_leetcode_username(url: Optional[str]) -> Tuple[Optional[str], str]:
    """
    Extract username from LeetCode URL reliably.
    Examples:
      - https://leetcode.com/u/john_doe/ -> john_doe
      - https://leetcode.com/u/login/MADAN__200/ -> MADAN__200
      - https://leetcode.com/john_doe -> john_doe
      - john_doe -> john_doe
    Returns (username, status)
    """
    if not url or not str(url).strip():
        return None, "MISSING LINK"
    
    cleaned = str(url).strip()
    
    # Handle pure username string if given
    if re.match(r'^[a-zA-Z0-9_-]{3,35}$', cleaned):
        if cleaned.lower() not in ['contest', 'problems', 'explore', 'discuss', 'interview', 'store', 'signup', 'login', 'profile', 'account']:
            return cleaned, "OK"

    # Strip domain and prefixes like /u/ or /login/ or /profile/
    cleaned_path = re.sub(r'^https?:\/\/(?:www\.)?leetcode\.com\/(?:u\/)?(?:login\/)?(?:profile\/)?', '', cleaned, flags=re.IGNORECASE)
    cleaned_path = cleaned_path.strip('/')
    
    match = re.match(r'^([a-zA-Z0-9_-]{3,35})', cleaned_path)
    if match:
        username = match.group(1)
        reserved = ['contest', 'problems', 'explore', 'discuss', 'interview', 'store', 'signup', 'login', 'profile', 'account']
        if username.lower() in reserved:
            return None, "INVALID LINK"
        return username, "OK"
    
    return None, "INVALID LINK"

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
    submitStatsGlobal {
      acSubmissionNum {
        difficulty
        count
      }
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
}
"""

def fetch_leetcode_profile_sync(url: Optional[str], force_refresh: bool = False) -> Dict[str, Any]:
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    return loop.run_until_complete(fetch_leetcode_profile(url, force_refresh=force_refresh))

async def fetch_leetcode_profile(url: Optional[str], force_refresh: bool = False) -> Dict[str, Any]:
    """
    Fetches publicly available LeetCode profile stats cleanly without fail.
    """
    username, status = extract_leetcode_username(url)
    if status != "OK" or not username:
        return {
            "username": username,
            "status": status,
            "total_solved": 0,
            "easy_solved": 0,
            "medium_solved": 0,
            "hard_solved": 0,
            "contest_rating": None,
            "contest_global_ranking": None,
            "public_profile_ranking": None,
            "error_message": f"URL status: {status}"
        }
    
    # Check Cache unless force_refresh
    now = time.time()
    cache_ttl = settings.CACHE_DURATION * 60
    if not force_refresh and username in _profile_cache:
        cached_item = _profile_cache[username]
        if now - cached_item["timestamp"] < cache_ttl:
            return cached_item["data"]

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        "Referer": f"https://leetcode.com/u/{username}/"
    }

    retries = 2
    timeout = 10.0

    async with httpx.AsyncClient(timeout=timeout) as client:
        # 1. Fetch Profile & Submission Stats
        payload_profile = {
            "query": USER_PROFILE_QUERY,
            "variables": {"username": username}
        }

        matched_user = None
        for attempt in range(retries):
            try:
                res = await client.post(GRAPHQL_URL, json=payload_profile, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    matched_user = data.get("data", {}).get("matchedUser")
                    if matched_user:
                        break
                await asyncio.sleep(0.3)
            except Exception as e:
                logger.warning(f"Error fetching profile for '{username}': {e}")
                await asyncio.sleep(0.3)

        if not matched_user:
            result = {
                "username": username,
                "status": "PROFILE NOT FOUND",
                "total_solved": 0,
                "easy_solved": 0,
                "medium_solved": 0,
                "hard_solved": 0,
                "contest_rating": None,
                "contest_global_ranking": None,
                "public_profile_ranking": None,
                "error_message": f"Profile for '{username}' not found on LeetCode."
            }
            _profile_cache[username] = {"timestamp": now, "data": result}
            return result

        # Parse submission stats
        submit_stats = (
            matched_user.get("submitStatsGlobal", {}).get("acSubmissionNum") or 
            matched_user.get("submitStats", {}).get("acSubmissionNum") or []
        )
        solved_map = {item.get("difficulty"): item.get("count", 0) for item in submit_stats}

        total_solved = solved_map.get("All", 0)
        easy_solved = solved_map.get("Easy", 0)
        medium_solved = solved_map.get("Medium", 0)
        hard_solved = solved_map.get("Hard", 0)
        profile_ranking = matched_user.get("profile", {}).get("ranking")

        # 2. Fetch Contest Ranking
        contest_rating = None
        contest_global_ranking = None
        try:
            payload_contest = {
                "query": USER_CONTEST_QUERY,
                "variables": {"username": username}
            }
            res_contest = await client.post(GRAPHQL_URL, json=payload_contest, headers=headers)
            if res_contest.status_code == 200:
                c_data = res_contest.json()
                contest_info = c_data.get("data", {}).get("userContestRanking")
                if contest_info:
                    c_rating = contest_info.get("rating")
                    if c_rating is not None:
                        contest_rating = round(float(c_rating), 1)
                    contest_global_ranking = contest_info.get("globalRanking")
        except Exception as e:
            logger.info(f"No contest ranking for '{username}': {e}")

        result = {
            "username": username,
            "status": "OK",
            "total_solved": total_solved,
            "easy_solved": easy_solved,
            "medium_solved": medium_solved,
            "hard_solved": hard_solved,
            "contest_rating": contest_rating,
            "contest_global_ranking": contest_global_ranking,
            "public_profile_ranking": profile_ranking,
            "error_message": None
        }

        _profile_cache[username] = {"timestamp": now, "data": result}
        return result
