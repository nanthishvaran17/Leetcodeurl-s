"""
reconcile_contest_scores.py
================================================================================
HISTORICAL DRY-RUN RECONCILIATION REPORT GENERATOR
================================================================================
Non-destructively audits historical contest results against evidence rules.

Generates dry-run report showing:
- Student Name, LeetCode Username, Contest ID
- Raw AC Count
- Verified Q1, Q2, Q3, Q4
- Verified Total vs Old Total
- Score Difference & Explanation
- Evidence Verification Status
"""

import argparse
import sys
import os
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.models import Student, WeeklyPublicResult, WeeklyVirtualResult, ContestParticipation
from backend.services.contest_problem_accuracy_engine import ContestProblemAccuracyEngine
from backend.services.contest_verification_engine import (
    ContestVerificationEngine, ContestProblemMapping, ProblemDefinition
)


def run_reconciliation(contest_number: int = 516, dry_run: bool = True) -> List[Dict[str, Any]]:
    db: Session = SessionLocal()
    results: List[Dict[str, Any]] = []

    try:
        contest_id = f"weekly-contest-{contest_number}"
        contest_name = f"Weekly Contest {contest_number}"

        # Resolve canonical problem set
        problem_set = ContestProblemAccuracyEngine.resolve_official_problem_set(contest_number=contest_number)
        mapping_problems = [
            ProblemDefinition(
                question_number=p.index,
                problem_id=p.problem_id,
                title_slug=p.title_slug,
                title=p.title,
                points=p.points
            )
            for p in problem_set.problems
        ]

        prob_mapping = ContestProblemMapping(
            contest_id=contest_id,
            contest_name=contest_name,
            contest_number=contest_number,
            problems=mapping_problems
        )

        students = db.query(Student).filter(Student.is_active == True).all()

        for student in students:
            # Fetch old recorded result
            p_res = db.query(WeeklyPublicResult).filter(
                WeeklyPublicResult.student_id == student.id
            ).first()

            v_res = db.query(WeeklyVirtualResult).filter(
                WeeklyVirtualResult.student_id == student.id
            ).first()

            old_total = 0
            participation_type = "NOT_VERIFIED"

            if p_res and p_res.participation_status in ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED"):
                old_total = p_res.total_contest_solved or 0
                participation_type = "ACTUAL"
            elif v_res and v_res.participation_status in ("VIRTUAL", "VIRTUAL_ATTENDED"):
                old_total = v_res.total_contest_solved or 0
                participation_type = "VIRTUAL_ATTENDED"

            # Gather raw submissions
            raw_submissions = []
            participations = db.query(ContestParticipation).filter(
                ContestParticipation.student_id == student.id
            ).all()

            for part in participations:
                if part.submission_times and isinstance(part.submission_times, list):
                    for sub in part.submission_times:
                        raw_submissions.append(sub)

            # Evaluate via ContestVerificationEngine
            ver = ContestVerificationEngine.verify_student_contest_participation(
                student_id=student.id,
                leetcode_username=student.username or "",
                contest_id=contest_id,
                participation_type=participation_type,
                problem_mapping=prob_mapping,
                raw_submissions=raw_submissions,
                evidence_source="RECONCILIATION_AUDIT"
            )

            diff = ver.verified_total - old_total
            reason = "EXACT_MATCH"
            if diff != 0:
                if participation_type != "ACTUAL":
                    reason = f"Participation state '{participation_type}' does not contribute to official Sunday contest score"
                elif ver.raw_ac_count < old_total:
                    reason = f"Recorded score ({old_total}) exceeded verified problem evidence count ({ver.verified_total})"
                elif ver.verified_total < old_total:
                    reason = "Positional/unverified questions removed based on problem mapping"
                else:
                    reason = "Verified evidence adjusted total"

            item = {
                "student_id": student.id,
                "name": student.name,
                "reg_no": student.reg_no,
                "username": student.username or "",
                "contest": contest_id,
                "raw_ac_count": ver.raw_ac_count,
                "participation_type": participation_type,
                "q1": ver.q1,
                "q2": ver.q2,
                "q3": ver.q3,
                "q4": ver.q4,
                "verified_total": ver.verified_total,
                "old_total": old_total,
                "difference": diff,
                "reason": reason,
                "evidence_status": ver.evidence_status
            }
            results.append(item)

        return results
    finally:
        db.close()


def print_reconciliation_summary(results: List[Dict[str, Any]]):
    total_students = len(results)
    exact_matches = sum(1 for r in results if r["difference"] == 0)
    mismatches = sum(1 for r in results if r["difference"] != 0)

    print("=========================================================")
    print("HISTORICAL RECONCILIATION DRY-RUN SUMMARY")
    print("=========================================================")
    print(f"Total Students Audited: {total_students}")
    print(f"Exact Matches:         {exact_matches}")
    print(f"Mismatches / Adjusted:  {mismatches}")
    print("---------------------------------------------------------")

    if mismatches > 0:
        print("\nMISMATCH DETAILS (TOP 10):")
        mismatch_items = [r for r in results if r["difference"] != 0][:10]
        for m in mismatch_items:
            print(f"- {m['name']} ({m['username']}): Old={m['old_total']} -> New={m['verified_total']} (Diff={m['difference']}) | Reason: {m['reason']}")

    print("=========================================================")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run non-destructive historical reconciliation audit.")
    parser.add_argument("--contest", type=int, default=516, help="Contest number (e.g. 516)")
    args = parser.parse_args()

    reconciliation_results = run_reconciliation(args.contest, dry_run=True)
    print_reconciliation_summary(reconciliation_results)
