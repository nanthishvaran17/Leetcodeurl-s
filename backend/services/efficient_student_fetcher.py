"""
efficient_student_fetcher.py — 3-Tier Targeted Fetching Engine

Guarantees:
1. Strategy 1 (Priority): Targeted user contest queries with concurrency semaphore (max 5).
2. Strategy 2 (Fallback): Paginated ranking for unresolved students.
3. Strategy 3 (Final fallback): User history query for remaining students.
4. Returns strongly-typed normalized results via LeetCodeAdapter.
"""
from __future__ import annotations

import asyncio
from typing import Dict, List, Optional, Set

from backend.logger import logger
from backend.services.leetcode_adapter import LeetCodeAdapter, UserContestResult


class EfficientStudentFetcher:
    """
    Optimized participant fetcher for cohort of students (e.g. 60–300 students).
    """

    def __init__(self, adapter: LeetCodeAdapter, max_concurrency: int = 5):
        self.adapter = adapter
        self.semaphore = asyncio.Semaphore(max_concurrency)

    async def fetch_all_participants(
        self,
        contest_slug: str,
        usernames: Set[str]
    ) -> Dict[str, UserContestResult]:
        """
        Fetch contest data for target students using 3-tier strategy:
        1. Targeted lookups (most efficient)
        2. Paginated ranking lookup (for unresolved)
        3. Full history lookup (final fallback)
        """
        results: Dict[str, UserContestResult] = {}
        remaining: Set[str] = {u.strip().lower() for u in usernames if u and str(u).strip()}

        if not remaining:
            return results

        logger.info(f"[FETCHER] Starting 3-tier fetch for {len(remaining)} students in {contest_slug}")

        # ── STRATEGY 1: Targeted lookups (Fastest for defined cohorts) ────────
        targeted_results = await self._fetch_targeted(contest_slug, remaining)
        for username, data in targeted_results.items():
            if username in remaining and data is not None:
                results[username] = data
                remaining.remove(username)

        if not remaining:
            logger.info(f"[FETCHER] All {len(results)} students resolved via Strategy 1 (Targeted).")
            return results

        logger.info(f"[FETCHER] Strategy 1 completed. Falling back to pagination for {len(remaining)} students...")

        # ── STRATEGY 2: Paginated ranking (Unresolved only) ───────────────────
        paginated_results = await self._fetch_paginated(contest_slug, remaining)
        for username, data in paginated_results.items():
            if username in remaining and data is not None:
                results[username] = data
                remaining.remove(username)

        if not remaining:
            logger.info(f"[FETCHER] All remaining students resolved via Strategy 2 (Paginated).")
            return results

        logger.info(f"[FETCHER] Strategy 2 completed. Checking history for {len(remaining)} remaining students...")

        # ── STRATEGY 3: History lookup (Final fallback) ───────────────────────
        history_results = await self._fetch_history(contest_slug, remaining)
        for username, data in history_results.items():
            if username in remaining and data is not None:
                results[username] = data
                remaining.remove(username)

        logger.info(f"[FETCHER] Completed fetching. Resolved: {len(results)}, Unresolved: {len(remaining)}")
        return results

    async def _fetch_targeted(
        self,
        contest_slug: str,
        usernames: Set[str]
    ) -> Dict[str, UserContestResult]:
        """Targeted lookup using user-specific contest queries with concurrency limit."""
        results: Dict[str, UserContestResult] = {}

        async def fetch_one(uname: str):
            async with self.semaphore:
                try:
                    data = await self.adapter.get_user_contest_result(uname, contest_slug)
                    if data:
                        return uname, data
                except Exception as e:
                    logger.debug(f"Targeted lookup failed for {uname}: {e}")
                return uname, None

        tasks = [fetch_one(u) for u in usernames]
        responses = await asyncio.gather(*tasks, return_exceptions=False)

        for uname, data in responses:
            if data:
                results[uname] = data

        return results

    async def _fetch_paginated(
        self,
        contest_slug: str,
        remaining: Set[str]
    ) -> Dict[str, UserContestResult]:
        """Fallback: Fetch ranking pages up to 50 pages or until remaining resolved."""
        results: Dict[str, UserContestResult] = {}
        page = 1
        max_pages = 50

        while remaining and page <= max_pages:
            try:
                page_data = await self.adapter.get_contest_ranking_page(contest_slug, page, 50)
                if not page_data or not page_data.data:
                    break

                for entry in page_data.data:
                    uname = entry.username.strip().lower()
                    if uname in remaining:
                        results[uname] = UserContestResult(
                            username=entry.username,
                            contest_slug=contest_slug,
                            attended=True,
                            rank=entry.rank,
                            score=entry.score,
                            solved_count=entry.submission_count,
                            finish_time=entry.finish_time,
                            questions=entry.questions,
                            submission_count=entry.submission_count,
                            attempt_count=entry.attempt_count,
                            is_virtual=entry.is_virtual,
                            explicit_participation_flag=True,
                            has_submission_records=entry.submission_count > 0,
                            source=entry.source,
                        )

                if page >= page_data.total_pages:
                    break
                page += 1
            except Exception as e:
                logger.warning(f"Error in paginated fetch page {page}: {e}")
                break

        return results

    async def _fetch_history(
        self,
        contest_slug: str,
        remaining: Set[str]
    ) -> Dict[str, UserContestResult]:
        """Final fallback: Query user contest history array."""
        results: Dict[str, UserContestResult] = {}

        async def fetch_history_one(uname: str):
            async with self.semaphore:
                try:
                    history = await self.adapter.get_user_contest_history(uname)
                    norm_target = contest_slug.replace("-", " ").strip().lower()
                    for entry in history:
                        entry_title = entry.contest_title.strip().lower()
                        entry_slug = entry.contest_slug.strip().lower()
                        if entry_slug == contest_slug.strip().lower() or entry_title == norm_target:
                            return uname, UserContestResult(
                                username=uname,
                                contest_slug=contest_slug,
                                attended=entry.attended,
                                rank=entry.rank,
                                score=entry.problems_solved,
                                solved_count=entry.problems_solved,
                                finish_time=entry.finish_time,
                                submission_count=entry.problems_solved,
                                attempt_count=entry.problems_solved,
                                is_virtual=entry.virtual_contest,
                                explicit_participation_flag=entry.attended,
                                has_submission_records=entry.problems_solved > 0,
                                source="user_contest_history",
                                is_explicit_virtual=entry.virtual_contest,
                            )
                except Exception as e:
                    logger.debug(f"History fetch failed for {uname}: {e}")
                return uname, None

        tasks = [fetch_history_one(u) for u in remaining]
        responses = await asyncio.gather(*tasks, return_exceptions=False)

        for uname, data in responses:
            if data:
                results[uname] = data

        return results
