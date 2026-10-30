"""
diagnose_contest_truth.py
================================================================================
READ-ONLY DIAGNOSTIC COMMAND FOR CONTEST TRUTH ENGINE
================================================================================
Evaluates submission evidence for a given user (default: janani2311) and contest
(default: currently finalized Sunday contest).

STRICT GUARANTEE: READ-ONLY. NO DB INSERT, UPDATE, OR DELETE OPERATIONS.
"""

import sys
import argparse
import asyncio
import datetime
from zoneinfo import ZoneInfo
from typing import Dict, Any, List, Optional

from backend.contest_truth_engine import ContestTruthEngine
from backend.services.contest_problem_accuracy_engine import ContestProblemAccuracyEngine, ContestProblemSet
from backend.services.contest_discovery import get_immediately_previous_sunday_date, calculate_contest_number

IST = ZoneInfo("Asia/Kolkata")


async def run_diagnostic(username: str = "janani2311", contest_num: Optional[int] = None):
    truth_engine = ContestTruthEngine()

    # 1. Resolve currently finalized Sunday contest if not specified
    if contest_num is None:
        prev_sunday = get_immediately_previous_sunday_date()
        contest_num = calculate_contest_number(prev_sunday)

    contest_id = f"weekly-contest-{contest_num}"
    contest_name = f"Weekly Contest {contest_num}"

    # Resolve official 4-problem set
    problem_set: ContestProblemSet = ContestProblemAccuracyEngine.resolve_official_problem_set(contest_number=contest_num)

    # Fetch raw evidence from LeetCode GraphQL (READ-ONLY network call)
    raw_data = await truth_engine.fetch_raw_evidence(username)

    submissions = raw_data.get("recentAcSubmissionList") or []
    history = raw_data.get("userContestRankingHistory") or []

    # Check official participation entry in ranking history
    official_entry = None
    target_clean = contest_id.lower().replace(" ", "-").replace("weekly-contest-", "wc-")
    for entry in history:
        if not isinstance(entry, dict):
            continue
        c_title = entry.get("contest", {}).get("title", "").lower().replace(" ", "-")
        c_clean = c_title.replace("weekly-contest-", "wc-")
        if target_clean in c_title or target_clean in c_clean or c_clean in target_clean or str(contest_num) in c_title:
            official_entry = entry
            break

    participation_type = "ACTUAL" if (official_entry and official_entry.get("attended")) else "UNVERIFIED"

    raw_accepted_count = len(submissions)

    # Detailed problem evaluation for Q1, Q2, Q3, Q4
    q_verifications = {}
    
    # Contest start/end boundary datetimes for target contest date (08:00 AM - 09:30 AM IST)
    contest_date = prev_sunday
    contest_start_dt = datetime.datetime.combine(contest_date, datetime.time(8, 0, 0), tzinfo=IST)
    contest_end_dt = datetime.datetime.combine(contest_date, datetime.time(9, 30, 0), tzinfo=IST)

    for prob in problem_set.problems:
        q_key = f"Q{prob.index}"
        prob_slug = prob.title_slug.strip().lower()
        
        best_sub = None
        rejection_reason = "No matching accepted submission found for problem slug within contest window."
        
        matching_subs = []
        for sub in submissions:
            if not isinstance(sub, dict):
                continue

            sub_slug = str(sub.get("titleSlug") or sub.get("title_slug") or "").strip().lower()
            sub_status = str(sub.get("status") or sub.get("statusDisplay") or "ACCEPTED").upper().strip()
            sub_ts = int(sub.get("timestamp", 0))
            sub_id = str(sub.get("id") or sub.get("submission_id") or sub_slug)

            # Exact problem slug match (avoiding 'pairs-i' matching 'pairs-ii')
            is_prob_match = (sub_slug == prob_slug)
            
            # Convert timestamp to IST
            if sub_ts > 0:
                sub_dt_ist = datetime.datetime.fromtimestamp(sub_ts, tz=IST)
                sub_ist_str = sub_dt_ist.strftime("%Y-%m-%d %H:%M:%S IST")
                
                # Check exact contest date and window 08:00 AM - 09:30 AM IST
                is_in_window = (contest_start_dt <= sub_dt_ist <= contest_end_dt)
            else:
                sub_dt_ist = None
                sub_ist_str = "N/A"
                is_in_window = False

            is_actual = (participation_type == "ACTUAL" or is_in_window)

            matching_subs.append({
                "sub_id": sub_id,
                "status": sub_status,
                "timestamp_raw": sub_ts,
                "timestamp_ist": sub_ist_str,
                "is_prob_match": is_prob_match,
                "is_in_window": is_in_window,
                "is_actual": is_actual
            })

            if is_prob_match:
                if sub_status not in ("ACCEPTED", "AC", "10"):
                    rejection_reason = f"Rejected: Submission status '{sub_status}' is not ACCEPTED."
                elif not is_in_window:
                    rejection_reason = f"Rejected: Timestamp {sub_ist_str} outside official contest window {contest_start_dt.strftime('%Y-%m-%d 08:00')} - {contest_end_dt.strftime('09:30 IST')}."
                else:
                    best_sub = {
                        "sub_id": sub_id,
                        "status": sub_status,
                        "timestamp_raw": sub_ts,
                        "timestamp_ist": sub_ist_str,
                        "is_prob_match": True,
                        "is_in_window": True,
                        "is_actual": is_actual,
                        "counted": True,
                        "reason": f"Verified ACCEPTED submission inside 08:00–09:30 IST window on official contest slug '{prob_slug}'."
                    }

        if best_sub:
            q_verifications[q_key] = best_sub
        else:
            # Re-examine first matching problem sub if any for detailed rejection report
            first_prob_match = next((s for s in matching_subs if s["is_prob_match"]), None)
            if first_prob_match:
                q_verifications[q_key] = {
                    "sub_id": first_prob_match["sub_id"],
                    "status": first_prob_match["status"],
                    "timestamp_raw": first_prob_match["timestamp_raw"],
                    "timestamp_ist": first_prob_match["timestamp_ist"],
                    "is_prob_match": True,
                    "is_in_window": first_prob_match["is_in_window"],
                    "is_actual": first_prob_match["is_actual"],
                    "counted": False,
                    "reason": rejection_reason
                }
            else:
                q_verifications[q_key] = {
                    "sub_id": "NONE",
                    "status": "NONE",
                    "timestamp_raw": 0,
                    "timestamp_ist": "N/A",
                    "is_prob_match": False,
                    "is_in_window": False,
                    "is_actual": False,
                    "counted": False,
                    "reason": rejection_reason
                }

    # Print READ-ONLY Diagnostic Output
    print("=" * 80)
    print(f"READ-ONLY CONTEST TRUTH DIAGNOSTIC REPORT: {username.upper()}")
    print(f"Target Contest: {contest_name} ({contest_id})")
    print(f"Participation Type: {participation_type}")
    print("=" * 80)

    verified_total = 0

    for idx in range(1, 5):
        q_key = f"Q{idx}"
        prob = problem_set.problems[idx - 1]
        v = q_verifications[q_key]
        
        is_verified = v["counted"]
        if is_verified:
            verified_total += 1

        print(f"\n--- {q_key} DIAGNOSTIC DETAILS ---")
        print(f"  contest_id:                       {contest_id}")
        print(f"  problem_id:                       {q_key}")
        print(f"  problem_slug:                     {prob.title_slug}")
        print(f"  submission_id:                    {v['sub_id']}")
        print(f"  submission status:                {v['status']}")
        print(f"  submission timestamp:             {v['timestamp_raw']}")
        print(f"  timestamp converted to Asia/Kolkata: {v['timestamp_ist']}")
        print(f"  participation type:               {participation_type if v['is_actual'] else 'VIRTUAL_OR_PRACTICE'}")
        print(f"  actual contest submission:        {v['is_actual']}")
        print(f"  inside 08:00-09:30 IST:           {v['is_in_window']}")
        print(f"  problem matches current contest:   {v['is_prob_match']}")
        print(f"  whether it was counted:           {v['counted']}")
        print(f"  exact reason:                     {v['reason']}")

    print("\n" + "=" * 80)
    print("FINAL CONTEST TRUTH SUMMARY")
    print("=" * 80)
    print(f"RAW ACCEPTED SUBMISSIONS: {raw_accepted_count}")
    print(f"VERIFIED Q1: {'VERIFIED' if q_verifications['Q1']['counted'] else 'NOT_VERIFIED'}")
    print(f"VERIFIED Q2: {'VERIFIED' if q_verifications['Q2']['counted'] else 'NOT_VERIFIED'}")
    print(f"VERIFIED Q3: {'VERIFIED' if q_verifications['Q3']['counted'] else 'NOT_VERIFIED'}")
    print(f"VERIFIED Q4: {'VERIFIED' if q_verifications['Q4']['counted'] else 'NOT_VERIFIED'}")
    print(f"VERIFIED TOTAL: {verified_total}")
    print("=" * 80)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="READ-ONLY Diagnostic Command for Contest Truth Engine")
    parser.add_argument("--username", type=str, default="janani2311", help="Target LeetCode username")
    parser.add_argument("--contest", type=int, default=None, help="Target Weekly Contest integer number (e.g. 520)")
    args = parser.parse_args()

    asyncio.run(run_diagnostic(username=args.username, contest_num=args.contest))
