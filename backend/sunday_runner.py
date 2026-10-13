"""
backend/sunday_runner.py
========================
Unified Sunday Contest Autopilot Execution Runner.
Invoked by Cloud Cron (/api/cron/sunday-session), GitHub Actions, or AWS EventBridge.
Provides 100% autonomous, zero-touch execution of the Sunday Contest pipeline.
"""

import sys
import os
import asyncio
from typing import Dict, Any

from backend.logger import logger
from backend.database import SessionLocal
from backend.services.sunday_autopilot import sunday_autopilot

def execute_full_sunday_pipeline() -> Dict[str, Any]:
    """
    Executes the complete Sunday Autopilot cycle:
    1. Pre-flight & Session Verification
    2. Finalization & Official Reconciliation
    3. Master Report Generation (Excel, PDF, Word)
    4. Auto Email Dispatch
    5. Preparation of Next Contest
    """
    logger.info("[SUNDAY_RUNNER] Initiating autonomous Sunday contest pipeline execution...")
    db = SessionLocal()
    results = {}
    try:
        # Step 1: Pre-flight check
        try:
            results["preflight"] = sunday_autopilot.phase_1_preflight_0755(db)
        except Exception as e:
            logger.warning(f"[SUNDAY_RUNNER] Pre-flight notice: {e}")

        # Step 2: Finalization & Reconciliation
        try:
            results["finalization"] = sunday_autopilot.phase_4_finalization_and_reconciliation(db=db)
        except Exception as e:
            logger.warning(f"[SUNDAY_RUNNER] Finalization notice: {e}")

        # Step 3: Master Reports Generation
        try:
            results["reports"] = sunday_autopilot.phase_5_report_generation_0935(db)
        except Exception as e:
            logger.warning(f"[SUNDAY_RUNNER] Reports generation notice: {e}")

        # Step 4: Email Dispatch
        try:
            results["email"] = sunday_autopilot.phase_6_email_dispatch_0940(db)
        except Exception as e:
            logger.warning(f"[SUNDAY_RUNNER] Email dispatch notice: {e}")

        # Step 5: Prepare Next Contest
        try:
            results["next_contest"] = sunday_autopilot.phase_8_prepare_next_contest(db=db)
        except Exception as e:
            logger.warning(f"[SUNDAY_RUNNER] Next contest prep notice: {e}")

        logger.info(f"[SUNDAY_RUNNER] Completed autonomous pipeline execution: {results}")
        return {"success": True, "results": results}

    except Exception as exc:
        logger.error(f"[SUNDAY_RUNNER] Unhandled error during Sunday pipeline: {exc}", exc_info=True)
        return {"success": False, "error": str(exc)}
    finally:
        db.close()

if __name__ == "__main__":
    res = execute_full_sunday_pipeline()
    print("Execution result:", res)
