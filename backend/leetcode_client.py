"""
LeetCode Client compatibility wrapper.
Delegates core fetching and parsing to backend.leetcode_fetcher.
"""
from backend.leetcode_fetcher import (
    extract_leetcode_username,
    fetch_leetcode_profile,
    fetch_leetcode_profile_sync,
    _profile_cache,
    GRAPHQL_URL,
    USER_PROFILE_QUERY,
    USER_CONTEST_QUERY
)

__all__ = [
    "extract_leetcode_username",
    "fetch_leetcode_profile",
    "fetch_leetcode_profile_sync",
    "_profile_cache",
    "GRAPHQL_URL",
    "USER_PROFILE_QUERY",
    "USER_CONTEST_QUERY"
]
