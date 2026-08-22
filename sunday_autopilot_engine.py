"""
sunday_autopilot_engine.py — Production Standalone Autopilot Daemon

Runs all 7 phases of Sunday LeetCode Weekly Contest Automation with zero manual intervention:
1. 07:55 AM IST — Pre-Flight Discovery & Roster Freeze
2. 08:00 AM IST — Baseline Snapshot & LIVE Mode Start
3. 08:00–09:30 AM IST — High-Concurrency Telemetry & Live Solves (Q1..Q4) Polling Cycle
4. 09:30 AM IST — Final Snapshot, 5-State Reconciliation & Data Immutability Lock
5. 09:35 AM IST — Multi-Format Report Generation (Excel, PDF, Word, Depts)
6. 09:40 AM IST — Automated Idempotent Email Dispatch to HODs/Management
7. 10:00 PM IST — Nightly Virtual Contest Sync & Final Daily Reconciliation
"""

import os
import sys
import time
import asyncio
import logging
import pytz
from datetime import datetime
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from backend.database import SessionLocal
from backend.services.sunday_autopilot import SundayAutopilotCoordinator

# Ensure reports/logs directory exists
os.makedirs("reports", exist_ok=True)

# Configure Logging
logging.basicConfig(
    filename="reports/sunday_autopilot_execution.log",
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
logging.getLogger().addHandler(console_handler)

IST = pytz.timezone("Asia/Kolkata")


def job_0755_preflight_discovery():
    logging.info("[07:55 AM IST] Starting Pre-Flight Discovery & Roster Freeze...")
    with SessionLocal() as db:
        res = SundayAutopilotCoordinator.phase_1_preflight_0755(db)
        logging.info(f"[07:55 AM IST] Pre-Flight completed: {res}")


def job_0800_baseline_snapshot():
    logging.info("[08:00 AM IST] Creating pre-contest baseline solved count snapshot...")
    with SessionLocal() as db:
        res = asyncio.run(SundayAutopilotCoordinator.phase_2_baseline_0800(db))
        logging.info(f"[08:00 AM IST] Baseline snapshot completed: {res}")


def job_0800_to_0930_live_sync_cycle():
    logging.info("[08:00-09:30 AM IST] Live Contest Polling Cycle Executing...")
    with SessionLocal() as db:
        res = asyncio.run(SundayAutopilotCoordinator.phase_3_live_monitoring_cycle(db))
        logging.info(f"[08:00-09:30 AM IST] Live Polling completed: {res}")


def job_0930_finalize_contest():
    logging.info("[09:30 AM IST] Stopping Live Tracking & Locking Finalized Contest Data...")
    with SessionLocal() as db:
        res = asyncio.run(SundayAutopilotCoordinator.phase_4_finalization_0930(db))
        logging.info(f"[09:30 AM IST] Finalization completed: {res}")


def job_0935_generate_reports():
    logging.info("[09:35 AM IST] Auto-Generating Multi-Format Institutional Reports...")
    with SessionLocal() as db:
        res = SundayAutopilotCoordinator.phase_5_report_generation_0935(db)
        logging.info(f"[09:35 AM IST] Reports generated successfully: {res}")


def job_0940_email_dispatch():
    logging.info("[09:40 AM IST] Dispatching Reports via Email to HODs and Management...")
    with SessionLocal() as db:
        res = SundayAutopilotCoordinator.phase_6_email_dispatch_0940(db)
        logging.info(f"[09:40 AM IST] Email dispatch result: {res}")


def job_0945_whatsapp_broadcast():
    logging.info("[09:45 AM IST] Dispatching Role-Scoped Contest Summaries via WhatsApp...")
    with SessionLocal() as db:
        res = SundayAutopilotCoordinator.phase_6b_whatsapp_broadcast_0945(db)
        logging.info(f"[09:45 AM IST] WhatsApp broadcast result: {res}")


def job_2200_virtual_contest_sync():
    logging.info("[10:00 PM IST] Running Nightly Virtual Contest Sync & Final Daily Summary...")
    with SessionLocal() as db:
        res = SundayAutopilotCoordinator.phase_7_virtual_sync_2200(db)
        logging.info(f"[10:00 PM IST] Virtual Sync completed: {res}")


def initialize_scheduler():
    scheduler = BlockingScheduler(timezone=IST)

    # Sunday-only Schedule Rules (day_of_week='sun')
    scheduler.add_job(job_0755_preflight_discovery, CronTrigger(day_of_week='sun', hour=7, minute=55, timezone=IST))
    scheduler.add_job(job_0800_baseline_snapshot, CronTrigger(day_of_week='sun', hour=8, minute=0, timezone=IST))
    
    # Live Polling every minute during contest hours (08:00 to 09:30 AM IST)
    scheduler.add_job(job_0800_to_0930_live_sync_cycle, CronTrigger(day_of_week='sun', hour=8, minute='*', timezone=IST))
    scheduler.add_job(job_0800_to_0930_live_sync_cycle, CronTrigger(day_of_week='sun', hour=9, minute='0-29', timezone=IST))
    
    scheduler.add_job(job_0930_finalize_contest, CronTrigger(day_of_week='sun', hour=9, minute=30, timezone=IST))
    scheduler.add_job(job_0935_generate_reports, CronTrigger(day_of_week='sun', hour=9, minute=35, timezone=IST))
    scheduler.add_job(job_0940_email_dispatch, CronTrigger(day_of_week='sun', hour=9, minute=40, timezone=IST))
    scheduler.add_job(job_0945_whatsapp_broadcast, CronTrigger(day_of_week='sun', hour=9, minute=45, timezone=IST))
    scheduler.add_job(job_2200_virtual_contest_sync, CronTrigger(day_of_week='sun', hour=22, minute=0, timezone=IST))

    logging.info("🚀 Sunday Contest Autopilot Engine Initialized & Waiting for Trigger...")
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logging.info("Autopilot Engine Stopped gracefully.")


if __name__ == "__main__":
    initialize_scheduler()
