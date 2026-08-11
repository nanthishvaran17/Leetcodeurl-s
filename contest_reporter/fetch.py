"""
fetch.py — LeetCode GraphQL API client.
All queries go through a single _gql() helper with retry/backoff.
"""
import time
import logging
import requests
from datetime import datetime, timezone, timedelta
from typing import Optional

log = logging.getLogger(__name__)

GRAPHQL_URL = "https://leetcode.com/graphql"
HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (compatible; NEC-LeetCode-Reporter/1.0)",
    "Referer": "https://leetcode.com",
}

# ─── Core HTTP helper ─────────────────────────────────────────────────────────

def _gql(query: str, variables: dict, retries: int = 3) -> dict:
    """Execute a GraphQL query with exponential backoff on failure."""
    payload = {"query": query, "variables": variables}
    delay = 2.0
    for attempt in range(1, retries + 1):
        try:
            resp = requests.post(GRAPHQL_URL, json=payload, headers=HEADERS, timeout=20)
            resp.raise_for_status()
            data = resp.json()
            if "errors" in data:
                raise ValueError(f"GraphQL errors: {data['errors']}")
            return data.get("data", {})
        except Exception as exc:
            log.warning(f"[FETCH] Attempt {attempt}/{retries} failed: {exc}")
            if attempt < retries:
                time.sleep(delay)
                delay *= 2
    raise RuntimeError(f"[FETCH] All {retries} attempts failed for GraphQL query.")


# ─── Queries ──────────────────────────────────────────────────────────────────

_Q_CONTEST_RANKING = """
query userContestRanking($username: String!) {
  userContestRanking(username: $username) {
    attendedContestsCount
    rating
    globalRanking
    totalParticipants
    topPercentage
    badge { name }
  }
}
"""

_Q_CONTEST_HISTORY = """
query userContestRankingHistory($username: String!, $attended: Boolean!) {
  userContestRankingHistory(username: $username, attended: $attended) {
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

_Q_RECENT_SUBMISSIONS = """
query recentAcSubmissions($username: String!, $limit: Int!) {
  recentAcSubmissionList(username: $username, limit: $limit) {
    title
    titleSlug
    timestamp
    lang
  }
}
"""

_Q_PROBLEM_DETAILS = """
query problemDetails($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    title
    difficulty
    topicTags { name }
  }
}
"""


# ─── Public fetch functions ────────────────────────────────────────────────────

def fetch_contest_ranking(username: str) -> dict:
    """Overall rating, global rank, attended count."""
    data = _gql(_Q_CONTEST_RANKING, {"username": username})
    return data.get("userContestRanking") or {}


def fetch_contest_history(username: str, attended_only: bool = True) -> list[dict]:
    """Full contest history list, most recent first."""
    data = _gql(_Q_CONTEST_HISTORY, {"username": username, "attended": attended_only})
    history = data.get("userContestRankingHistory") or []
    # Sort descending by startTime
    return sorted(history, key=lambda x: x["contest"]["startTime"], reverse=True)


def fetch_recent_submissions(username: str, limit: int = 20) -> list[dict]:
    data = _gql(_Q_RECENT_SUBMISSIONS, {"username": username, "limit": limit})
    return data.get("recentAcSubmissionList") or []


def fetch_problem_details(title_slug: str) -> dict:
    data = _gql(_Q_PROBLEM_DETAILS, {"titleSlug": title_slug})
    return data.get("question") or {}


# ─── Rating-settled check ──────────────────────────────────────────────────────

def _last_expected_weekly_start() -> datetime:
    """
    Returns the UTC start time of the most recently completed LeetCode weekly contest.
    Weekly contests: Sunday 14:30 UTC (8:00 PM IST).
    Contest duration: 1.5 hours → finished by 16:00 UTC.
    Rating is usually settled 30–60 min after contest ends → 16:30–17:00 UTC.
    We check that the user's latest history entry is for a contest started
    on or after this timestamp.
    """
    now = datetime.now(timezone.utc)
    # Find last Sunday
    days_since_sunday = (now.weekday() + 1) % 7  # Mon=0 … Sun=6
    last_sunday = now - timedelta(days=days_since_sunday)
    expected = last_sunday.replace(hour=14, minute=30, second=0, microsecond=0)
    # If that would be in the future (i.e., we're running before Sunday contest),
    # go back another week
    if expected > now:
        expected -= timedelta(days=7)
    return expected


def is_rating_settled(username: str) -> tuple[bool, Optional[str]]:
    """
    Polls userContestRankingHistory and checks whether the most recent entry
    corresponds to the latest expected weekly contest.

    Returns (settled: bool, latest_contest_title: str | None)
    """
    try:
        history = fetch_contest_history(username, attended_only=True)
        if not history:
            log.warning("[SETTLED] No contest history found — treating as not settled.")
            return False, None

        latest = history[0]
        latest_start_ts = latest["contest"]["startTime"]
        latest_start_utc = datetime.fromtimestamp(latest_start_ts, tz=timezone.utc)
        latest_title = latest["contest"]["title"]

        expected_start = _last_expected_weekly_start()

        log.info(
            f"[SETTLED] Latest history entry: '{latest_title}' @ {latest_start_utc.isoformat()}"
        )
        log.info(f"[SETTLED] Expected latest contest start: {expected_start.isoformat()}")

        settled = latest_start_utc >= expected_start
        if settled:
            log.info(f"[SETTLED] ✅ Rating settled for contest: {latest_title}")
        else:
            log.warning(
                f"[SETTLED] ⏳ Rating NOT settled yet. Latest entry is "
                f"{(expected_start - latest_start_utc).days + 1} week(s) behind."
            )
        return settled, latest_title

    except Exception as exc:
        log.error(f"[SETTLED] Error during settled check: {exc}")
        return False, None


def build_contest_record(username: str, contest_entry: dict) -> dict:
    """
    Build a clean dict for database.insert_contest() from a history entry.
    """
    c = contest_entry["contest"]
    return {
        "contest_title":   c["title"],
        "contest_start":   c["startTime"],
        "rating":          contest_entry.get("rating"),
        "ranking":         contest_entry.get("ranking"),
        "problems_solved": contest_entry.get("problemsSolved"),
        "total_problems":  contest_entry.get("totalProblems"),
        "finish_time_s":   contest_entry.get("finishTimeInSeconds"),
        "trend_direction": contest_entry.get("trendDirection"),
    }
