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

def execute_phase(phase: str = "all") -> Dict[str, Any]:
    """
    Executes a specific phase or the full Sunday Autopilot pipeline.
    Supported phases:
      - 'all'
      - 'preflight_0755'
      - 'baseline_0800'
      - 'finalization_0930'
      - 'reports_0935'
      - 'virtual_sync_2200'
    """
    phase_key = (phase or "all").strip().lower()
    if phase_key == "all":
        return execute_full_sunday_pipeline()

    logger.info(f"[SUNDAY_RUNNER] Initiating targeted phase execution: '{phase_key}'...")
    db = SessionLocal()
    try:
        if phase_key in ("preflight_0755", "preflight", "phase_1"):
            res = sunday_autopilot.phase_1_preflight_0755(db)
            return {"success": True, "phase": phase_key, "result": res}
        elif phase_key in ("baseline_0800", "baseline", "phase_2"):
            res = asyncio.run(sunday_autopilot.phase_2_baseline_0800(db=db)) if asyncio.iscoroutinefunction(sunday_autopilot.phase_2_baseline_0800) else sunday_autopilot.phase_2_baseline_0800(db=db)
            return {"success": True, "phase": phase_key, "result": res}
        elif phase_key in ("finalization_0930", "finalization", "phase_4"):
            res = asyncio.run(sunday_autopilot.phase_4_finalization_0930(db=db)) if asyncio.iscoroutinefunction(sunday_autopilot.phase_4_finalization_0930) else sunday_autopilot.phase_4_finalization_0930(db=db)
            return {"success": True, "phase": phase_key, "result": res}
        elif phase_key in ("reports_0935", "reports", "phase_5"):
            res = sunday_autopilot.phase_5_report_generation_0935(db)
            return {"success": True, "phase": phase_key, "result": res}
        elif phase_key in ("virtual_sync_2200", "virtual_sync", "phase_7"):
            res = sunday_autopilot.phase_7_virtual_sync_2200(db)
            return {"success": True, "phase": phase_key, "result": res}
        else:
            logger.warning(f"[SUNDAY_RUNNER] Unrecognized phase '{phase_key}', falling back to full pipeline.")
            return execute_full_sunday_pipeline()
    except Exception as exc:
        logger.error(f"[SUNDAY_RUNNER] Error executing phase '{phase_key}': {exc}", exc_info=True)
        return {"success": False, "phase": phase_key, "error": str(exc)}
    finally:
        db.close()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Sunday Autopilot Pipeline Execution Runner")
    parser.add_argument("--phase", default=os.getenv("AUTOPILOT_PHASE", "all"), help="Phase to execute (all, preflight_0755, baseline_0800, finalization_0930, reports_0935, virtual_sync_2200)")
    args = parser.parse_args()
    
    print(f"🚀 Sunday Autopilot Runner starting with phase: {args.phase}")
    res = execute_phase(args.phase)
    print("Execution result:", res)
    if not res.get("success", False):
        sys.exit(1)
