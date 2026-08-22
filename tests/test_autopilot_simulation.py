"""
test_autopilot_simulation.py — Fast-Forward 60-Second Sunday Autopilot Simulation Test

Executes all 7 Sunday Autopilot phases in sequential fast-forward simulation:
1. 07:55 AM IST — Pre-Flight Discovery & Roster Freeze
2. 08:00 AM IST — Baseline Snapshot & LIVE Mode Activation
3. 08:00–09:30 AM IST — Live Solve Telemetry Cycle
4. 09:30 AM IST — Final Snapshot & SHA-256 Immutability Lock
5. 09:35 AM IST — Multi-Format Report Generation (Excel/PDF/Word)
6. 09:40 AM IST — Automated Email Dispatch
7. 10:00 PM IST — Nightly Virtual Contest Sync & Reconciliation
"""

import os
import sys
import asyncio
import pytest

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.database import SessionLocal
from backend.services.sunday_autopilot import SundayAutopilotCoordinator


def test_full_sunday_contest_autopilot_workflow():
    """ Fast-forward simulation test of the entire Sunday contest pipeline """
    with SessionLocal() as db:
        print("\n[Simulated Test] 07:55 AM IST - Pre-Flight Discovery")
        res_p1 = SundayAutopilotCoordinator.phase_1_preflight_0755(db)
        assert res_p1["success"] is True
        print(f"  + Phase 1 Success: Active Students = {res_p1.get('active_students')}, Valid = {res_p1.get('valid_usernames')}")

        print("[Simulated Test] 08:00 AM IST - Baseline Snapshot")
        res_p2 = asyncio.run(SundayAutopilotCoordinator.phase_2_baseline_0800(db))
        assert res_p2["success"] is True
        print(f"  + Phase 2 Success: Status = {res_p2.get('status')}")

        print("[Simulated Test] 08:00-09:30 AM IST - Live Sync Loop Execution")
        res_p3 = asyncio.run(SundayAutopilotCoordinator.phase_3_live_monitoring_cycle(db))
        assert res_p3["success"] is True
        print(f"  + Phase 3 Success: Retried = {res_p3.get('retried_count')}")

        print("[Simulated Test] 09:30 AM IST - Finalize Contest & Lock Data")
        res_p4 = asyncio.run(SundayAutopilotCoordinator.phase_4_finalization_0930(db))
        assert res_p4["success"] is True
        print(f"  + Phase 4 Success: Final Status = {res_p4.get('status')}")

        print("[Simulated Test] 09:35 AM IST - Report Generation (Excel/PDF/Word)")
        res_p5 = SundayAutopilotCoordinator.phase_5_report_generation_0935(db)
        assert res_p5["success"] is True
        assert os.path.exists(res_p5["excel_path"])
        assert os.path.exists(res_p5["pdf_path"])
        assert os.path.exists(res_p5["word_path"])
        print(f"  + Phase 5 Success: Excel = {res_p5['excel_bytes_len']} B, PDF = {res_p5['pdf_bytes_len']} B, Word = {res_p5['word_bytes_len']} B")

        print("[Simulated Test] 09:40 AM IST - Report Dispatch via Email")
        res_p6 = SundayAutopilotCoordinator.phase_6_email_dispatch_0940(db)
        assert res_p6["success"] is True
        print(f"  + Phase 6 Success: Dispatch Result = {res_p6.get('result')}")

        print("[Simulated Test] 10:00 PM IST - Virtual Contest Sync")
        res_p7 = SundayAutopilotCoordinator.phase_7_virtual_sync_2200(db)
        assert res_p7["success"] is True
        print(f"  + Phase 7 Success: Virtual Summary = {res_p7.get('result', {}).get('virtual_summary')}")

        print("\nAll 7 Sunday Autopilot Stages Passed Simulation Successfully!")


if __name__ == "__main__":
    test_full_sunday_contest_autopilot_workflow()

