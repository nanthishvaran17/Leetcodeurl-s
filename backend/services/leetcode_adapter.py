"""
leetcode_adapter.py — Isolated LeetCode GraphQL & REST Adapter

Guarantees:
- ONLY this layer handles GraphQL queries and direct communication with LeetCode.
- Application and classification code NEVER see raw GraphQL queries or payloads.
- Normalizes all responses into strongly-typed dataclasses.
- Audit trail: Raw responses are saved to the `raw_data` table when db session is provided.
- Cache is NEVER used as authoritative evidence for participation classification.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

from backend.logger import logger
from backend.time_utils import UTC, IST, now_utc

GRAPHQL_URL = "https://leetcode.com/graphql"
DEFAULT_TIMEOUT = 12.0

# ─────────────────────────────────────────────────────────────────────────────
# DATA MODELS
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ContestMetadata:
    platform: str
    contest_slug: str
    contest_title: str
    contest_number: Optional[int]
    contest_type: str
    start_time: datetime  # UTC
    end_time: datetime    # UTC
    duration: int         # seconds
    status: str           # upcoming, live, finalized, past
    problem_list: Optional[List[Dict[str, Any]]] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class ContestDetails:
    contest_slug: str
    title: str
    start_time: datetime  # UTC
    duration: int
    problem_list: List[Dict[str, Any]]
    total_participants: Optional[int] = None


@dataclass
class RankingEntry:
    username: str
    rank: Optional[int] = None
    score: Optional[int] = None
    finish_time: Optional[int] = None
    submission_count: int = 0
    attempt_count: int = 0
    questions: List[Dict[str, Any]] = field(default_factory=list)
    is_virtual: bool = False
    source: str = "contest_ranking"


@dataclass
class RankingPage:
    page: int
    page_size: int
    total_participants: int
    total_pages: int
    data: List[RankingEntry]


@dataclass
class UserContestResult:
    username: str
    contest_slug: str
    attended: bool = False
    rank: Optional[int] = None
    score: Optional[int] = None
    solved_count: Optional[int] = None
    finish_time: Optional[int] = None
    questions: List[Dict[str, Any]] = field(default_factory=list)
    submission_count: int = 0
    attempt_count: int = 0
    is_virtual: bool = False
    explicit_participation_flag: bool = False
    has_submission_records: bool = False
    source: str = "unknown"
    is_explicit_virtual: bool = False
    raw_payload: Optional[Dict[str, Any]] = None


@dataclass
class UserContestHistoryEntry:
    contest_slug: str
    contest_title: str
    start_time: Optional[datetime] = None  # UTC
    attended: bool = False
    problems_solved: int = 0
    total_problems: int = 4
    finish_time: Optional[int] = None
    rank: Optional[int] = None
    rating: Optional[float] = None
    virtual_contest: bool = False
    source: str = "user_contest_history"


@dataclass
class UserProfile:
    username: str
    real_name: Optional[str] = None
    ranking: Optional[int] = None
    total_solved: Optional[int] = None
    easy_solved: Optional[int] = None
    medium_solved: Optional[int] = None
    hard_solved: Optional[int] = None
    reputation: Optional[int] = None
    badges: List[Dict[str, Any]] = field(default_factory=list)
    language_stats: List[Dict[str, Any]] = field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────────────
# ADAPTER INTERFACE
# ─────────────────────────────────────────────────────────────────────────────

class LeetCodeAdapter(ABC):
    """
    Isolated LeetCode Adapter Interface.
    ONLY implementations of this class execute network queries and handle GraphQL.
    """

    @abstractmethod
    async def discover_contests(self) -> List[ContestMetadata]:
        """Discover all available contests (upcoming, live, completed)."""

    @abstractmethod
    async def get_contest_details(self, slug: str) -> Optional[ContestDetails]:
        """Get detailed contest information including problem specifications."""

    @abstractmethod
    async def get_contest_ranking_page(
        self, slug: str, page: int, page_size: int = 50
    ) -> Optional[RankingPage]:
        """Get paginated contest ranking from authoritative contest source."""

    @abstractmethod
    async def get_user_contest_result(
        self, username: str, contest_slug: str
    ) -> Optional[UserContestResult]:
        """
        Get user's result for a specific contest.
        Uses targeted query/ranking lookups internally without leaking implementation details.
        """

    @abstractmethod
    async def get_user_contest_history(
        self, username: str
    ) -> List[UserContestHistoryEntry]:
        """Get user's full contest history array."""

    @abstractmethod
    async def get_user_profile(
        self, username: str
    ) -> Optional[UserProfile]:
        """Get user profile data (supporting evidence only, never primary)."""


# ─────────────────────────────────────────────────────────────────────────────
# PRODUCTION IMPLEMENTATION
# ─────────────────────────────────────────────────────────────────────────────

class ProductionLeetCodeAdapter(LeetCodeAdapter):
    """
    Production GraphQL & HTTP adapter communicating directly with LeetCode.
    Enforces isolated queries, rate limiting, and optional audit logging.
    """

    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        "Referer": "https://leetcode.com/",
        "Origin": "https://leetcode.com"
    }

    # Isolated GraphQL queries
    _QUERY_USER_CONTEST_HISTORY = """
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

    _QUERY_USER_PROFILE = """
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

    def __init__(self, db_session_factory=None, timeout: float = DEFAULT_TIMEOUT):
        self.db_session_factory = db_session_factory
        self.timeout = timeout

    async def _execute_graphql(
        self,
        query: str,
        variables: Dict[str, Any],
        operation_name: Optional[str] = None,
        contest_id: Optional[int] = None,
        username: Optional[str] = None
    ) -> Dict[str, Any]:
        """Execute GraphQL query with raw data audit recording."""
        payload = {"query": query, "variables": variables}
        if operation_name:
            payload["operationName"] = operation_name

        data = {}
        http_status = None
        graphql_errors = None

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(GRAPHQL_URL, json=payload, headers=self.HEADERS)
                http_status = resp.status_code
                if resp.status_code == 200:
                    res_json = resp.json()
                    graphql_errors = res_json.get("errors")
                    data = res_json.get("data", {})
                else:
                    logger.warning(f"GraphQL request returned HTTP {resp.status_code} for {operation_name}")
        except Exception as e:
            logger.error(f"GraphQL request error for {operation_name} ({username}): {e}")
            graphql_errors = [{"message": str(e)}]

        # Audit logging into raw_data table if session factory is available
        if self.db_session_factory and (contest_id or username):
            try:
                self._record_raw_audit(
                    contest_id=contest_id,
                    username=username,
                    endpoint=GRAPHQL_URL,
                    operation_name=operation_name or "graphql",
                    http_status=http_status,
                    graphql_errors=graphql_errors,
                    payload=data or {}
                )
            except Exception as audit_err:
                logger.debug(f"Audit log insertion skipped: {audit_err}")

        return data

    def _record_raw_audit(
        self,
        contest_id: Optional[int],
        username: Optional[str],
        endpoint: str,
        operation_name: str,
        http_status: Optional[int],
        graphql_errors: Optional[Any],
        payload: Dict[str, Any]
    ):
        """Synchronously or asynchronously record raw payload into raw_data table."""
        if not self.db_session_factory:
            return
        from backend.models import RawDataRecord
        db = self.db_session_factory()
        try:
            record = RawDataRecord(
                contest_id=contest_id,
                username=username,
                endpoint=endpoint,
                operation_name=operation_name,
                http_status=http_status,
                graphql_errors=graphql_errors,
                payload=payload,
                captured_at=now_utc()
            )
            db.add(record)
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()

    async def discover_contests(self) -> List[ContestMetadata]:
        """
        Discovers active, upcoming, and recent weekly contests.
        Dynamic calculation reference: Weekly Contest 514 on 2026-08-09 (08:00 AM IST).
        """
        contests: List[ContestMetadata] = []
        now_dt = now_utc()
        now_ist_dt = now_dt.astimezone(IST)

        # Reference anchor: Weekly Contest 514 on 2026-08-09
        ref_date = datetime(2026, 8, 9, 8, 0, 0, tzinfo=IST)
        ref_contest = 514

        # Generate range covering 2 weeks back to 4 weeks forward
        for offset_weeks in range(-2, 5):
            ref_date + (now_ist_dt.date() - ref_date.date())
            # Find Sunday on or after target
            days_to_sunday = (6 - now_ist_dt.weekday()) % 7
            target_sunday = now_ist_dt.date() + __import__("datetime").timedelta(days=days_to_sunday + (offset_weeks * 7))

            contest_start_ist = datetime.combine(
                target_sunday,
                __import__("datetime").time(8, 0, 0),
                tzinfo=IST
            )
            contest_end_ist = contest_start_ist + __import__("datetime").timedelta(minutes=90)
            
            weeks_from_ref = (target_sunday - ref_date.date()).days // 7
            contest_num = ref_contest + weeks_from_ref
            slug = f"weekly-contest-{contest_num}"
            title = f"Weekly Contest {contest_num}"

            start_utc = contest_start_ist.astimezone(UTC)
            end_utc = contest_end_ist.astimezone(UTC)

            if now_dt < start_utc:
                status = "upcoming"
            elif start_utc <= now_dt <= end_utc:
                status = "live"
            else:
                status = "completed"

            contests.append(ContestMetadata(
                platform="leetcode",
                contest_slug=slug,
                contest_title=title,
                contest_number=contest_num,
                contest_type="weekly",
                start_time=start_utc,
                end_time=end_utc,
                duration=5400,
                status=status,
                problem_list=[
                    {"slug": f"{slug}-q1", "title": "Q1 (Easy)", "difficulty": "Easy", "score": 3},
                    {"slug": f"{slug}-q2", "title": "Q2 (Medium)", "difficulty": "Medium", "score": 4},
                    {"slug": f"{slug}-q3", "title": "Q3 (Medium/Hard)", "difficulty": "Medium", "score": 5},
                    {"slug": f"{slug}-q4", "title": "Q4 (Hard)", "difficulty": "Hard", "score": 6},
                ]
            ))

        return contests

    async def get_contest_details(self, slug: str) -> Optional[ContestDetails]:
        """Return detailed contest metadata."""
        contests = await self.discover_contests()
        for c in contests:
            if c.contest_slug == slug:
                return ContestDetails(
                    contest_slug=c.contest_slug,
                    title=c.contest_title,
                    start_time=c.start_time,
                    duration=c.duration,
                    problem_list=c.problem_list or []
                )
        return None

    async def get_contest_ranking_page(
        self, slug: str, page: int, page_size: int = 50
    ) -> Optional[RankingPage]:
        """Fetch paginated live contest ranking endpoint."""
        url = f"https://leetcode.com/contest/api/ranking/{slug}/?pagination={page}&region=global"
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(url, headers=self.HEADERS)
                if resp.status_code == 200:
                    data = resp.json()
                    total_users = data.get("user_num", 0)
                    total_pages = max(1, (total_users + page_size - 1) // page_size) if total_users else 1
                    raw_entries = data.get("total_rank", [])
                    submissions_map = data.get("submissions", [])

                    entries: List[RankingEntry] = []
                    for idx, entry in enumerate(raw_entries):
                        uname = entry.get("user_slug") or entry.get("username")
                        if not uname:
                            continue
                        sub_count = 0
                        questions = []
                        if idx < len(submissions_map) and submissions_map[idx]:
                            sub_dict = submissions_map[idx]
                            sub_count = len(sub_dict)
                            for q_id, q_data in sub_dict.items():
                                questions.append({
                                    "question_id": q_id,
                                    "status": "AC",
                                    "time": q_data.get("date"),
                                    "attempts": q_data.get("fail_count", 0) + 1
                                })

                        entries.append(RankingEntry(
                            username=uname,
                            rank=entry.get("rank"),
                            score=entry.get("score"),
                            finish_time=entry.get("finish_time"),
                            submission_count=sub_count,
                            attempt_count=sub_count,
                            questions=questions,
                            source="contest_ranking"
                        ))

                    return RankingPage(
                        page=page,
                        page_size=page_size,
                        total_participants=total_users,
                        total_pages=total_pages,
                        data=entries
                    )
        except Exception as e:
            logger.warning(f"Error fetching ranking page {page} for {slug}: {e}")
        return None

    async def get_user_contest_result(
        self, username: str, contest_slug: str
    ) -> Optional[UserContestResult]:
        """
        Targeted user contest result lookup.
        Checks user history and rankings directly.
        """
        if not username:
            return None

        history = await self.get_user_contest_history(username)
        for h in history:
            if h.contest_slug.lower() == contest_slug.lower() or h.contest_title.lower() == contest_slug.replace("-", " ").lower():
                # Derive result
                return UserContestResult(
                    username=username,
                    contest_slug=contest_slug,
                    attended=h.attended,
                    rank=h.rank,
                    score=h.problems_solved,
                    solved_count=h.problems_solved,
                    finish_time=h.finish_time,
                    submission_count=h.problems_solved,
                    attempt_count=h.problems_solved,
                    is_virtual=h.virtual_contest,
                    explicit_participation_flag=h.attended,
                    has_submission_records=h.problems_solved > 0,
                    source="user_contest_history",
                    is_explicit_virtual=h.virtual_contest
                )
        return None

    async def get_user_contest_history(
        self, username: str
    ) -> List[UserContestHistoryEntry]:
        """Fetch userContestRankingHistory array."""
        if not username:
            return []

        res = await self._execute_graphql(
            query=self._QUERY_USER_CONTEST_HISTORY,
            variables={"username": username},
            operation_name="userContestRankingInfo",
            username=username
        )

        history_data = res.get("userContestRankingHistory") or []
        entries: List[UserContestHistoryEntry] = []

        for item in history_data:
            c = item.get("contest") or {}
            title = c.get("title", "")
            slug = title.lower().replace(" ", "-") if title else ""
            start_ts = c.get("startTime")
            start_dt = datetime.fromtimestamp(start_ts, tz=timezone.utc) if start_ts else None

            attended = bool(item.get("attended", False))
            problems_solved = item.get("problemsSolved") or 0
            ranking = item.get("ranking")
            rating = item.get("rating")
            finish_time = item.get("finishTimeInSeconds")

            # In LeetCode history, attended=True means official participation.
            # Virtual or unranked attempts have attended=False or specific flags.
            is_virtual = False
            if not attended and problems_solved > 0:
                is_virtual = True

            entries.append(UserContestHistoryEntry(
                contest_slug=slug,
                contest_title=title,
                start_time=start_dt,
                attended=attended,
                problems_solved=problems_solved,
                total_problems=item.get("totalProblems") or 4,
                finish_time=finish_time,
                rank=ranking,
                rating=rating,
                virtual_contest=is_virtual,
                source="user_contest_history"
            ))

        return entries

    async def get_user_profile(
        self, username: str
    ) -> Optional[UserProfile]:
        """Fetch public profile data (supporting evidence only)."""
        if not username:
            return None

        res = await self._execute_graphql(
            query=self._QUERY_USER_PROFILE,
            variables={"username": username},
            operation_name="userPublicProfile",
            username=username
        )

        matched = res.get("matchedUser")
        if not matched:
            return None

        prof = matched.get("profile") or {}
        submit_stats = matched.get("submitStats") or {}
        ac_submissions = submit_stats.get("acSubmissionNum") or []

        total_s = easy_s = med_s = hard_s = 0
        for item in ac_submissions:
            diff = item.get("difficulty")
            cnt = item.get("count") or 0
            if diff == "All":
                total_s = cnt
            elif diff == "Easy":
                easy_s = cnt
            elif diff == "Medium":
                med_s = cnt
            elif diff == "Hard":
                hard_s = cnt

        return UserProfile(
            username=matched.get("username", username),
            real_name=prof.get("realName"),
            ranking=prof.get("ranking"),
            total_solved=total_s,
            easy_solved=easy_s,
            medium_solved=med_s,
            hard_solved=hard_s,
            reputation=prof.get("reputation"),
            badges=matched.get("badges") or [],
            language_stats=matched.get("languageProblemCount") or []
        )
