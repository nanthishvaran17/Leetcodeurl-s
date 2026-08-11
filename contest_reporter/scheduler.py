"""
scheduler.py — APScheduler local scheduler.
Run: python scheduler.py
Alternatively, use GitHub Actions (see .github/workflows/weekly_report.yml).
"""
import logging
import sys
from pathlib import Path

log = logging.getLogger("scheduler")

try:
    from apscheduler.schedulers.blocking import BlockingScheduler
    from apscheduler.triggers.cron import CronTrigger
    APSCHEDULER_AVAILABLE = True
except ImportError:
    APSCHEDULER_AVAILABLE = False


def scheduled_job():
    """Called by the scheduler. Runs the full pipeline."""
    import main
    log.info("[SCHEDULER] Triggered weekly contest reporter job.")
    exit_code = main.run(dry_run=False, test_email=False, force=False)
    if exit_code != 0:
        log.error(f"[SCHEDULER] Pipeline returned exit code {exit_code}")
    else:
        log.info("[SCHEDULER] ✅ Job completed successfully.")


def start():
    if not APSCHEDULER_AVAILABLE:
        print("APScheduler not installed. Run: pip install APScheduler")
        print("Or use GitHub Actions for scheduling (recommended).")
        sys.exit(1)

    scheduler = BlockingScheduler(timezone="Asia/Kolkata")

    # Monday 09:30 AM IST — contests end Sunday 9:30 PM IST, rating settles by Monday morning
    # The pipeline's own rating-settled check will retry if needed.
    scheduler.add_job(
        scheduled_job,
        CronTrigger(day_of_week="mon", hour=9, minute=30),
        id="weekly_contest_report",
        name="LeetCode Weekly Contest Reporter",
        misfire_grace_time=3600,  # 1-hour grace window
        coalesce=True,            # Only run once even if multiple firings were missed
    )

    log.info("[SCHEDULER] Starting APScheduler — will trigger Monday 09:30 AM IST.")
    log.info("[SCHEDULER] Press Ctrl+C to stop.")
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        log.info("[SCHEDULER] Stopped.")


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )
    start()
