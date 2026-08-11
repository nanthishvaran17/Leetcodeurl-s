"""
main.py — Orchestrator for the LeetCode Weekly Contest Reporter.

Usage:
    python main.py                # Full pipeline (check settled → fetch → analyze → report → email)
    python main.py --dry-run      # Run pipeline with MOCK data, no email sent
    python main.py --test-email   # Full pipeline, email only to first recipient
    python main.py --force        # Skip idempotency check (re-run for same contest)
"""

import argparse
import logging
import sys
import time
from datetime import datetime
from pathlib import Path

# ─── Logging setup (before any imports that log) ──────────────────────────────
LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
today_log = LOG_DIR / f"{datetime.now().strftime('%Y-%m-%d')}.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    handlers=[
        logging.FileHandler(today_log, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("main")

# ─── Project modules ──────────────────────────────────────────────────────────
import config
import database
import fetch as lc_fetch
import analyze
import report_excel
import report_pdf
import mailer

OUTPUT_DIR = Path(__file__).parent / "output"


# ─── Mock data (for --dry-run) ────────────────────────────────────────────────
MOCK_HISTORY = [
    {"contest_title": "Weekly Contest 399", "contest_start": 1718001000, "rating": 1550.0,
     "ranking": 12000, "problems_solved": 2, "total_problems": 4, "finish_time_s": 2400, "trend_direction": "UP"},
    {"contest_title": "Weekly Contest 400", "contest_start": 1718606400, "rating": 1592.5,
     "ranking": 9800,  "problems_solved": 3, "total_problems": 4, "finish_time_s": 3100, "trend_direction": "UP"},
    {"contest_title": "Weekly Contest 401", "contest_start": 1719211200, "rating": 1627.0,
     "ranking": 8200,  "problems_solved": 3, "total_problems": 4, "finish_time_s": 2900, "trend_direction": "UP"},
]
MOCK_PROBLEMS = [
    {"contest_title": "Weekly Contest 401", "problem_title": "Two Sum Variant",  "difficulty": "Easy",
     "accepted": 1, "wrong_attempts": 0, "time_taken_s": 180,  "tags": '["Array","Hash Table"]'},
    {"contest_title": "Weekly Contest 401", "problem_title": "Graph Path",       "difficulty": "Medium",
     "accepted": 1, "wrong_attempts": 1, "time_taken_s": 1200, "tags": '["Graph","BFS"]'},
    {"contest_title": "Weekly Contest 401", "problem_title": "DP Subsequence",   "difficulty": "Medium",
     "accepted": 1, "wrong_attempts": 2, "time_taken_s": 1400, "tags": '["Dynamic Programming","Array"]'},
    {"contest_title": "Weekly Contest 401", "problem_title": "Tree Rebuild",     "difficulty": "Hard",
     "accepted": 0, "wrong_attempts": 3, "time_taken_s": None, "tags": '["Tree","Recursion"]'},
]
MOCK_RANKING = {"rating": 1627.0, "globalRanking": 8200, "attendedContestsCount": 3}


def _parse_args():
    p = argparse.ArgumentParser(description="NEC LeetCode Contest Reporter")
    p.add_argument("--dry-run",     action="store_true", help="Use mock data, skip email")
    p.add_argument("--test-email",  action="store_true", help="Send only to first recipient")
    p.add_argument("--force",       action="store_true", help="Re-run even if email already sent")
    return p.parse_args()


def run(dry_run: bool = False, test_email: bool = False, force: bool = False) -> int:
    """
    Main pipeline. Returns 0 on success, 1 on failure.
    """
    log.info("=" * 60)
    log.info("NEC LeetCode Contest Reporter — Starting pipeline")
    log.info(f"Mode: {'DRY RUN' if dry_run else 'LIVE'} | test_email={test_email} | force={force}")

    # 1. Config validation
    if not dry_run:
        config.validate_config()
    settings    = config.SETTINGS
    recipients  = config.load_recipients()
    username    = config.LEETCODE_USERNAME

    log.info(f"LeetCode username: {username}")
    log.info(f"Recipients: {[r.get('email') for r in recipients]}")

    # 2. Init database
    database.init_db()

    # 3. Rating-settled check (skip in dry-run)
    if dry_run:
        log.info("[SETTLED] Dry run — skipping rating-settled check.")
        latest_title = MOCK_HISTORY[-1]["contest_title"]
    else:
        settled, latest_title = _wait_for_settled(username)
        if not settled:
            log.error("[MAIN] Rating not settled after retries. Aborting to avoid stale report.")
            return 1

    # 4. Idempotency check
    if not force and database.email_already_sent(latest_title):
        log.info(f"[MAIN] Email already sent for '{latest_title}'. Use --force to resend. Exiting.")
        return 0

    # 5. Fetch & store data
    if dry_run:
        log.info("[MAIN] Using mock data.")
        history_raw  = MOCK_HISTORY
        all_problems = MOCK_PROBLEMS
    else:
        history_raw, all_problems = _fetch_and_store(username, latest_title)

    if not history_raw:
        log.error("[MAIN] No contest history found. Aborting.")
        return 1

    # 6. Analyze
    milestones = settings.get("rating_milestones", [1400, 1600, 1800, 2000])
    analysis   = analyze.build_analysis(history_raw, all_problems, milestones)
    log.info(f"[MAIN] Analysis complete: rating={analysis.get('current_rating')}, "
             f"delta={analysis.get('rating_delta')}, streak={analysis.get('streak')}")

    # 7. Generate reports
    excel_path = report_excel.generate_excel(history_raw, analysis, settings, OUTPUT_DIR)
    pdf_path   = report_pdf.generate_pdf(analysis, settings, OUTPUT_DIR)

    if dry_run:
        log.info(f"[MAIN] Dry run complete. Files saved — no email sent.")
        log.info(f"  Excel: {excel_path}")
        log.info(f"  PDF:   {pdf_path}")
        return 0

    # 8. Send email
    if not recipients:
        log.warning("[MAIN] No recipients configured in config/recipients.yaml — skipping email.")
        return 0

    sent_to = mailer.send_report(
        analysis, settings, excel_path, pdf_path, recipients, test_only=test_email
    )

    # 9. Mark as sent (idempotency)
    if sent_to:
        database.mark_email_sent(latest_title, sent_to)
        log.info(f"[MAIN] ✅ Pipeline complete. Report sent for '{latest_title}'.")
    else:
        log.warning("[MAIN] No emails were sent successfully.")
        return 1

    return 0


# ─── Settled check with retry ──────────────────────────────────────────────────

def _wait_for_settled(username: str) -> tuple[bool, str | None]:
    """
    Polls rating-settled check. If not settled, waits RATING_SETTLED_WAIT_MINUTES
    and retries once (as configured).
    """
    max_retries = config.RATING_SETTLED_RETRIES
    wait_min    = config.RATING_SETTLED_WAIT_MINUTES

    for attempt in range(1, max_retries + 2):  # +1 for initial attempt
        settled, latest_title = lc_fetch.is_rating_settled(username)
        if settled:
            return True, latest_title
        if attempt <= max_retries:
            log.warning(
                f"[SETTLED] Not settled on attempt {attempt}. "
                f"Waiting {wait_min} min before retry..."
            )
            time.sleep(wait_min * 60)
        else:
            log.error("[SETTLED] Rating still not settled after all retries.")
            return False, latest_title

    return False, None


# ─── Fetch + store ─────────────────────────────────────────────────────────────

def _fetch_and_store(username: str, latest_title: str) -> tuple[list[dict], list[dict]]:
    log.info(f"[FETCH] Fetching contest history for @{username}...")
    history_api = lc_fetch.fetch_contest_history(username)

    # Store new contests (idempotent)
    for entry in history_api:
        record = lc_fetch.build_contest_record(username, entry)
        if not database.contest_exists(record["contest_title"]):
            database.insert_contest(record)
            log.info(f"[DB] Stored new contest: {record['contest_title']}")

    # Store problem attempts for latest contest (we skip sub-problem fetching
    # here since LeetCode doesn't expose per-problem timing in history)
    history_db = database.fetch_history(limit=20)
    all_problems = _fetch_all_stored_problems(history_db)

    return history_db, all_problems


def _fetch_all_stored_problems(history_db: list[dict]) -> list[dict]:
    all_problems = []
    for contest in history_db:
        probs = database.fetch_problems_for_contest(contest["contest_title"])
        all_problems.extend(probs)
    return all_problems


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    args = _parse_args()
    exit_code = run(
        dry_run    = args.dry_run,
        test_email = args.test_email,
        force      = args.force,
    )
    log.info(f"[MAIN] Exit code: {exit_code}")
    sys.exit(exit_code)
