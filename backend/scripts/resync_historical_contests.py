"""
resync_historical_contests.py
=============================================================
Async CLI & Admin API backfill script for Weekly Contests 510–515.

Resolves the "Total Students: 0" problem on finalized past sessions by:
1. Querying LeetCode GraphQL `userContestRankingHistory` for all active students.
2. Mapping each contest entry to the corresponding WeeklySession in the DB.
3. Bulk-inserting/upserting WeeklyPublicResult rows with full classification.
4. Updating WeeklySession aggregate counters.
5. Applying finalized state to ensure immutability.

Usage (CLI):
    python -m backend.scripts.resync_historical_contests

Usage (Admin API):
    POST /api/tracker/backfill-historical?from_contest=510&to_contest=515
"""

import asyncio
import datetime
import logging
import sys
from typing import Any, Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger("resync_historical")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)

# ── Contest range to backfill ─────────────────────────────────────────────────
DEFAULT_FROM_CONTEST = 510
DEFAULT_TO_CONTEST   = 515

# ── LeetCode GraphQL ──────────────────────────────────────────────────────────
GRAPHQL_URL = "https://leetcode.com/graphql"

CONTEST_HISTORY_QUERY = """
query userContestRankingInfo($username: String!) {
  userContestRankingHistory(username: $username) {
    attended
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

# ── Token-bucket rate limiter (shared with leetcode_tracker.py) ───────────────
import asyncio
import time


class _TokenBucket:
    def __init__(self, rate: float = 3.5, capacity: float = 7.0):
        self.rate = rate
        self.capacity = capacity
        self.tokens = capacity
        self.updated_at = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self):
        async with self._lock:
            now = time.monotonic()
            self.tokens = min(self.capacity, self.tokens + (now - self.updated_at) * self.rate)
            self.updated_at = now
            if self.tokens < 1.0:
                await asyncio.sleep((1.0 - self.tokens) / self.rate)
                self.tokens = 0.0
            else:
                self.tokens -= 1.0


_bucket = _TokenBucket()

_GQL_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Content-Type": "application/json",
    "Referer": "https://leetcode.com/",
}

_TIMEOUT = httpx.Timeout(connect=6.0, read=14.0, write=6.0, pool=6.0)


async def _fetch_contest_history(client: httpx.AsyncClient, username: str) -> List[Dict[str, Any]]:
    """Fetches userContestRankingHistory for a single username with retry + backoff."""
    payload = {
        "query": CONTEST_HISTORY_QUERY,
        "variables": {"username": username.strip().lower()},
        "operationName": "userContestRankingInfo",
    }
    for attempt in range(1, 5):
        await _bucket.acquire()
        try:
            resp = await client.post(GRAPHQL_URL, json=payload, headers=_GQL_HEADERS)
            if resp.status_code == 429:
                wait = 2.0 * attempt
                logger.warning(f"[BACKFILL] 429 on {username}, sleeping {wait:.1f}s (attempt {attempt})")
                await asyncio.sleep(wait)
                continue
            if resp.status_code == 200:
                data = resp.json().get("data", {})
                return data.get("userContestRankingHistory") or []
        except (httpx.ReadTimeout, httpx.ConnectTimeout, httpx.RemoteProtocolError) as exc:
            logger.warning(f"[BACKFILL] Timeout for {username} attempt {attempt}: {exc}")
            await asyncio.sleep(1.5 * attempt)
        except Exception as exc:
            logger.warning(f"[BACKFILL] Error for {username} attempt {attempt}: {exc}")
            await asyncio.sleep(1.0 * attempt)
    logger.error(f"[BACKFILL] All retries exhausted for username: {username}")
    return []


def _normalise_title(title: str) -> str:
    """Normalises 'Weekly Contest 515' or 'weekly-contest-515' → 'weekly-contest-515'."""
    return title.strip().lower().replace(" ", "-")


def _extract_contest_number(title: str) -> Optional[int]:
    """Returns the integer contest number from a normalised title."""
    import re
    m = re.search(r"weekly-contest-(\d+)", _normalise_title(title))
    return int(m.group(1)) if m else None


def _classify_entry(entry: Dict[str, Any]) -> str:
    """Maps a contest history entry to a participation status string."""
    if entry.get("attended") and (entry.get("problemsSolved", 0) >= 0):
        return "OFFICIAL_ATTENDED"
    return "ABSENT"


def _q_matrix(solved: int) -> Tuple[int, int, int, int]:
    return (
        1 if solved >= 1 else 0,
        1 if solved >= 2 else 0,
        1 if solved >= 3 else 0,
        1 if solved >= 4 else 0,
    )


# ── Main backfill engine ──────────────────────────────────────────────────────
async def backfill_historical(
    from_contest: int = DEFAULT_FROM_CONTEST,
    to_contest: int = DEFAULT_TO_CONTEST,
    concurrency: int = 8,
) -> Dict[str, Any]:
    """
    Main async backfill function.
    Safe to call from FastAPI endpoint or standalone CLI.
    Returns a structured result summary.
    """
    from backend.database import SessionLocal
    from backend.models import Student, WeeklySession, WeeklyPublicResult, Department

    db = SessionLocal()
    try:
        target_contests = list(range(from_contest, to_contest + 1))
        logger.info(f"[BACKFILL] Starting historical backfill for WC {from_contest}–{to_contest} ({len(target_contests)} contests)")

        # 1. Load all active students with LeetCode usernames
        students = (
            db.query(Student)
            .filter((Student.is_active == True) | (Student.is_active.is_(None)))
            .filter(Student.username.isnot(None))
            .filter(Student.username != "")
            .all()
        )
        logger.info(f"[BACKFILL] {len(students)} active students with usernames loaded.")

        # 2. Ensure WeeklySession stubs exist for each target contest
        session_map: Dict[int, WeeklySession] = {}
        for cn in target_contests:
            contest_id = f"weekly-contest-{cn}"
            session = (
                db.query(WeeklySession)
                .filter(
                    (WeeklySession.contest_id == contest_id)
                    | (WeeklySession.contest_name.ilike(f"%{cn}%"))
                )
                .first()
            )
            if not session:
                # Create stub — approximate Sunday date
                # WC 515 = 2026-08-17. Work backwards: each week = 7 days
                wc515_date = datetime.date(2026, 8, 17)
                offset = cn - 515
                approx_date = wc515_date + datetime.timedelta(weeks=offset)
                session = WeeklySession(
                    academic_year="2026-27",
                    week_number=cn,
                    session_code=f"WEEK-{approx_date.isoformat()}",
                    session_date=approx_date.isoformat(),
                    contest_id=contest_id,
                    contest_name=f"Weekly Contest {cn}",
                    start_time="08:00",
                    end_time="09:30",
                    status="FINALIZED",
                    total_students=len(students),
                )
                db.add(session)
                db.flush()
                logger.info(f"[BACKFILL] Created stub WeeklySession for WC {cn} (date: {approx_date})")
            else:
                logger.info(f"[BACKFILL] Found existing WeeklySession id={session.id} for WC {cn}")
            session_map[cn] = session

        db.commit()

        # 3. Fetch contest history for all students (semaphore-limited concurrency)
        semaphore = asyncio.Semaphore(concurrency)
        results: List[Tuple[Student, List[Dict[str, Any]]]] = []

        async def fetch_for_student(student: Student):
            async with semaphore:
                history = await _fetch_contest_history(client, student.username)
                return student, history

        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            tasks = [fetch_for_student(s) for s in students]
            done = await asyncio.gather(*tasks, return_exceptions=True)

        for item in done:
            if isinstance(item, Exception):
                logger.warning(f"[BACKFILL] Student task error: {item}")
                continue
            results.append(item)

        # 4. Build WeeklyPublicResult upserts per contest
        counters: Dict[int, Dict[str, int]] = {
            cn: {"official": 0, "absent": 0} for cn in target_contests
        }

        for student, history in results:
            dept_name = student.department.name if student.department else "CSE-CS"
            year = student.year_level or "III Year"

            # Index history by contest number
            history_map: Dict[int, Dict[str, Any]] = {}
            for entry in history:
                c_title = (entry.get("contest") or {}).get("title") or ""
                cn = _extract_contest_number(c_title)
                if cn is not None:
                    history_map[cn] = entry

            for cn in target_contests:
                session = session_map[cn]
                entry = history_map.get(cn)

                if entry:
                    status = _classify_entry(entry)
                    solved = entry.get("problemsSolved", 0)
                    finish_sec = entry.get("finishTimeInSeconds", 0)
                    rating = entry.get("rating")
                    rank = entry.get("ranking")
                    q1, q2, q3, q4 = _q_matrix(solved)
                    score = solved * 25
                else:
                    status = "ABSENT"
                    solved = 0
                    finish_sec = 0
                    rating = None
                    rank = None
                    q1 = q2 = q3 = q4 = 0
                    score = 0

                # Upsert WeeklyPublicResult
                rec = (
                    db.query(WeeklyPublicResult)
                    .filter(
                        WeeklyPublicResult.session_id == session.id,
                        WeeklyPublicResult.student_id == student.id,
                    )
                    .first()
                )
                if not rec:
                    rec = WeeklyPublicResult(
                        session_id=session.id,
                        student_id=student.id,
                        reg_no=student.reg_no,
                        name=student.name,
                        dept=dept_name,
                        year=year,
                    )
                    db.add(rec)

                rec.participation_status = status
                rec.state = "FINALIZED"
                rec.confidence = "VERIFIED"
                rec.total_contest_solved = solved
                rec.contest_score = score
                rec.q1 = q1
                rec.q2 = q2
                rec.q3 = q3
                rec.q4 = q4
                rec.contest_rating = float(rating) if rating else None
                rec.contest_rank = rank
                rec.fetch_status = "SUCCESS" if entry else "SUCCESS"
                rec.last_fetched_at = datetime.datetime.utcnow()

                if status == "OFFICIAL_ATTENDED":
                    counters[cn]["official"] += 1
                else:
                    counters[cn]["absent"] += 1

        db.commit()

        # 5. Update WeeklySession aggregate counters
        for cn, session in session_map.items():
            session.official_participants = counters[cn]["official"]
            session.not_participated = counters[cn]["absent"]
            session.total_students = counters[cn]["official"] + counters[cn]["absent"]
            session.status = "FINALIZED"
            session.last_synced = datetime.datetime.utcnow()

        db.commit()

        summary = {
            "status": "success",
            "students_processed": len(results),
            "contests_backfilled": target_contests,
            "per_contest": {
                f"WC-{cn}": {
                    "official_attended": counters[cn]["official"],
                    "absent": counters[cn]["absent"],
                    "total": counters[cn]["official"] + counters[cn]["absent"],
                }
                for cn in target_contests
            },
        }
        logger.info(f"[BACKFILL] Complete: {summary}")
        return summary

    except Exception as exc:
        logger.error(f"[BACKFILL] Fatal error: {exc}", exc_info=True)
        db.rollback()
        return {"status": "error", "detail": str(exc)}
    finally:
        db.close()


# ── CLI Entry Point ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Backfill LeetCode historical contest data (WC 510–515)")
    parser.add_argument("--from-contest", type=int, default=DEFAULT_FROM_CONTEST, help="Start contest number")
    parser.add_argument("--to-contest",   type=int, default=DEFAULT_TO_CONTEST,   help="End contest number (inclusive)")
    parser.add_argument("--concurrency",  type=int, default=8, help="Max concurrent student fetches")
    args = parser.parse_args()

    result = asyncio.run(
        backfill_historical(
            from_contest=args.from_contest,
            to_contest=args.to_contest,
            concurrency=args.concurrency,
        )
    )
    import json
    print(json.dumps(result, indent=2))
    sys.exit(0 if result.get("status") == "success" else 1)
