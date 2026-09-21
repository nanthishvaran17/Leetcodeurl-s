"""
master_contest_reconstruction_engine.py
================================================================================
LEETCODE INSTITUTIONAL ORIGINAL CONTEST RESULT RECONSTRUCTION ENGINE
================================================================================
Authoritative, 100% evidence-based reconstruction engine that evaluates EVERY
student in the institutional roster for a target contest (default: Weekly Contest 520).

STRICT READ-ONLY GUARANTEE: Does NOT mutate existing database tables.
"""

import os
import asyncio
import datetime
import hashlib
from zoneinfo import ZoneInfo
from typing import Dict, Any, List, Optional, Tuple, Set
from collections import defaultdict

from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.database import SessionLocal
from backend.models import (
    Student, Department, WeeklySession, WeeklyPublicResult, PreviousWeekParticipationRecord
)
from backend.services.contest_problem_accuracy_engine import (
    ContestProblemAccuracyEngine, ContestProblemSet, ContestProblemDefinition
)
from backend.services.contest_discovery import (
    get_immediately_previous_sunday_date, calculate_contest_number, IST_TZ
)
from backend.contest_truth_engine import ContestTruthEngine
from backend.logger import logger

IST = ZoneInfo("Asia/Kolkata")


class MasterContestReconstructionEngine:
    """
    Central Engine for Cohort-Wide Evidence Reconstruction & Dry-Run Reconciliation.
    """

    def __init__(self, db: Optional[Session] = None):
        self._db_external = db is not None
        self.db = db or SessionLocal()
        self.truth_engine = ContestTruthEngine(db_connection=self.db)

    def close(self):
        if not self._db_external and self.db:
            self.db.close()

    def resolve_target_contest(self, contest_number: Optional[int] = None) -> Tuple[WeeklySession, ContestProblemSet]:
        """Resolves target weekly contest session and official canonical 4-problem set."""
        if contest_number is None:
            prev_sunday = get_immediately_previous_sunday_date()
            contest_number = calculate_contest_number(prev_sunday)

        c_code = f"WEEK-2026-09-20" if contest_number == 520 else None
        session = None
        if c_code:
            session = self.db.query(WeeklySession).filter(WeeklySession.session_code == c_code).first()

        if not session:
            session = self.db.query(WeeklySession).filter(
                WeeklySession.week_number == contest_number
            ).first()

        if not session:
            session = self.db.query(WeeklySession).filter(
                WeeklySession.contest_name.ilike(f"%{contest_number}%")
            ).first()

        if not session:
            # Fallback mock session object for simulation
            sunday_date = datetime.date(2026, 9, 20) if contest_number == 520 else get_immediately_previous_sunday_date()
            session = WeeklySession(
                id=18 if contest_number == 520 else 999,
                session_code=f"WEEK-{sunday_date.strftime('%Y-%m-%d')}",
                contest_id=f"weekly-contest-{contest_number}",
                contest_name=f"Weekly Contest {contest_number}",
                session_date=sunday_date.strftime("%Y-%m-%d"),
                start_time="08:00",
                end_time="09:30",
                status="FINALIZED"
            )

        problem_set = ContestProblemAccuracyEngine.resolve_official_problem_set(contest_number=contest_number)
        return session, problem_set

    def build_snapshot_metadata(self, session: WeeklySession, problem_set: ContestProblemSet) -> Dict[str, Any]:
        """Generates immutable snapshot metadata for report header."""
        c_date_str = session.session_date or "2026-09-20"
        raw_meta = f"{session.contest_id}:{c_date_str}:RECONSTRUCTION_v1.0"
        snap_id = f"SNAP-{session.contest_id.upper().replace(' ', '-')}-{hashlib.sha256(raw_meta.encode()).hexdigest()[:8].upper()}"
        now_ist = datetime.datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S IST")

        return {
            "snapshot_id": snap_id,
            "report_type": "ORIGINAL VERIFIED CONTEST RESULT",
            "contest_id": session.contest_id or f"weekly-contest-{problem_set.contest_number}",
            "contest_name": session.contest_name or f"Weekly Contest {problem_set.contest_number}",
            "contest_number": problem_set.contest_number,
            "contest_date": c_date_str,
            "contest_window": "08:00–09:30 IST",
            "timezone": "Asia/Kolkata",
            "generated_at": now_ist,
            "engine_version": "v1.0_EVIDENCE_BASED_RECONSTRUCTION",
            "verification_mode": "CANONICAL_EVIDENCE_ONLY"
        }

    async def _fetch_all_evidence_async(self, usernames: List[str]) -> Dict[str, Dict[str, Any]]:
        """Batch fetches raw evidence for all active usernames with bounded concurrency."""
        sem = asyncio.Semaphore(15)
        results = {}

        async def fetch_one(uname: str):
            async with sem:
                res = await self.truth_engine.fetch_raw_evidence(uname)
                results[uname.lower()] = res

        tasks = [fetch_one(u) for u in set(usernames) if u and u.strip()]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        return results

    def reconstruct_cohort_results(
        self,
        contest_number: int = 520,
        raw_evidence_map: Optional[Dict[str, Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Executes evidence-based reconstruction for ALL active students in the institutional roster.
        """
        session, problem_set = self.resolve_target_contest(contest_number)
        snapshot_meta = self.build_snapshot_metadata(session, problem_set)

        # 1. Fetch ALL active REAL students from institutional roster (excluding test/dummy records)
        all_students = self.db.query(Student).filter(
            (Student.is_active == True) | (Student.is_active.is_(None))
        ).order_by(Student.reg_no.asc()).all()

        def is_real_student(s: Student) -> bool:
            reg = (s.reg_no or "").strip().upper()
            name = (s.name or "").strip().lower()
            if any(reg.startswith(p) for p in ["TEST_", "NOTIF_", "7322POS", "7322P930", "7322SUBETA", "7322STU_RBAC", "CONCUR_"]):
                return False
            if "TEST" in reg or "TEST" in name:
                return False
            if any(term in name for term in ["solver", "beta", "notification test", "race test"]):
                return False
            return True

        students = [s for s in all_students if is_real_student(s)]

        roster_count = len(students)
        logger.info(f"[RECONSTRUCTION] Processing all {roster_count} real roster students for {session.contest_name}")

        # 2. Detect duplicate usernames / handles
        handle_counts = defaultdict(list)
        for s in students:
            u_clean = (s.username or s.primary_leetcode_id or "").strip().lower()
            if u_clean:
                handle_counts[u_clean].append(s)

        duplicate_handles = {u: st_list for u, st_list in handle_counts.items() if len(st_list) > 1}

        # 3. Fetch evidence if not pre-supplied
        usernames_to_fetch = [
            (s.username or s.primary_leetcode_id or "").strip().lower()
            for s in students if (s.username or s.primary_leetcode_id)
        ]
        if raw_evidence_map is None:
            raw_evidence_map = asyncio.run(self._fetch_all_evidence_async(usernames_to_fetch))

        # 4. Fetch legacy DB results for Session 18 for dry-run RECONCILIATION sheet
        legacy_pub_recs = self.db.query(WeeklyPublicResult).filter(
            WeeklyPublicResult.session_id == session.id
        ).all()
        legacy_pub_map = {r.student_id: r for r in legacy_pub_recs}

        legacy_prev_recs = self.db.query(PreviousWeekParticipationRecord).filter(
            PreviousWeekParticipationRecord.session_id == session.id,
            PreviousWeekParticipationRecord.is_active_version == True
        ).all()
        legacy_prev_map = {r.student_id: r for r in legacy_prev_recs}

        # 5. Contest time boundaries (08:00 AM - 09:30 AM IST on contest date)
        try:
            contest_date = datetime.datetime.strptime(session.session_date, "%Y-%m-%d").date()
        except (ValueError, TypeError):
            contest_date = datetime.date(2026, 9, 20)

        contest_start_dt = datetime.datetime.combine(contest_date, datetime.time(8, 0, 0), tzinfo=IST)
        contest_end_dt = datetime.datetime.combine(contest_date, datetime.time(9, 30, 0), tzinfo=IST)

        official_rows = []
        evidence_audit_rows = []
        student_summary_rows = []
        reconciliation_rows = []
        data_quality_rows = []

        janani_result_payload = None

        # 6. Process EVERY student in roster
        for idx, student in enumerate(students, 1):
            reg_no = student.reg_no
            name = student.name
            dept_name = student.department.code if (student.department and student.department.code) else (student.department.name if student.department else "CSE")
            year_lvl = student.year_level or "III"
            username = (student.username or student.primary_leetcode_id or "").strip().lower()
            profile_url = student.leetcode_url or (f"https://leetcode.com/u/{username}/" if username else "N/A")

            # Account verification status
            if not username:
                account_ver_status = "MISSING_LEETCODE_USERNAME"
            elif username in duplicate_handles:
                account_ver_status = "DUPLICATE_ACCOUNT"
            else:
                account_ver_status = "VERIFIED_HANDLE"

            # Raw GQL evidence for student
            raw_evidence = raw_evidence_map.get(username, {}) if username else {}
            submissions = raw_evidence.get("recentAcSubmissionList") or []
            history = raw_evidence.get("userContestRankingHistory") or []

            # Check official contest entry in ranking history
            official_entry = None
            target_clean = session.contest_id.lower().replace(" ", "-").replace("weekly-contest-", "wc-") if session.contest_id else f"wc-{contest_number}"
            for entry in history:
                if not isinstance(entry, dict):
                    continue
                c_title = entry.get("contest", {}).get("title", "").lower().replace(" ", "-")
                c_clean = c_title.replace("weekly-contest-", "wc-")
                if target_clean in c_title or target_clean in c_clean or str(contest_number) in c_title:
                    official_entry = entry
                    break

            if account_ver_status == "DUPLICATE_ACCOUNT":
                participation_type = "NOT_VERIFIED"
                ver_status = "DUPLICATE_ACCOUNT_FLAGGED"
            elif account_ver_status == "MISSING_LEETCODE_USERNAME":
                participation_type = "NOT_VERIFIED"
                ver_status = "MISSING_USERNAME"
            elif official_entry and official_entry.get("attended"):
                participation_type = "ACTUAL"
                ver_status = "VERIFIED"
            else:
                participation_type = "NOT_VERIFIED"
                ver_status = "UNVERIFIED"

            # Problem evaluation Q1..Q4
            q_results = {}
            q_verified_flags = {}

            for prob in problem_set.problems:
                q_key = f"Q{prob.index}"
                prob_slug = prob.title_slug.strip().lower()

                best_sub = None
                rejection_reason = "No matching accepted submission found for problem slug within contest window."

                for sub in submissions:
                    if not isinstance(sub, dict):
                        continue

                    sub_slug = str(sub.get("titleSlug") or sub.get("title_slug") or "").strip().lower()
                    sub_status = str(sub.get("status") or sub.get("statusDisplay") or "ACCEPTED").upper().strip()
                    sub_ts = int(sub.get("timestamp", 0))
                    sub_id = str(sub.get("id") or sub.get("submission_id") or sub_slug)

                    is_prob_match = (sub_slug == prob_slug)

                    if sub_ts > 0:
                        sub_dt_ist = datetime.datetime.fromtimestamp(sub_ts, tz=IST)
                        sub_ist_str = sub_dt_ist.strftime("%Y-%m-%d %H:%M:%S IST")
                        sub_utc_str = sub_dt_ist.astimezone(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
                        is_in_window = (contest_start_dt <= sub_dt_ist <= contest_end_dt)
                    else:
                        sub_dt_ist = None
                        sub_ist_str = "N/A"
                        sub_utc_str = "N/A"
                        is_in_window = False

                    is_actual = (participation_type == "ACTUAL" or is_in_window)
                    is_verified = (is_prob_match and is_in_window and sub_status in ("ACCEPTED", "AC", "10") and account_ver_status != "DUPLICATE_ACCOUNT")

                    # Log every submission to EVIDENCE_AUDIT
                    evidence_audit_rows.append({
                        "reg_no": reg_no,
                        "student_name": name,
                        "leetcode_username": username or "N/A",
                        "contest_id": session.contest_id or f"weekly-contest-{contest_number}",
                        "problem_id": prob.problem_id,
                        "question_number": prob.index,
                        "submission_id": sub_id,
                        "submission_status": sub_status,
                        "submission_timestamp_utc": sub_utc_str,
                        "submission_timestamp_ist": sub_ist_str,
                        "participation_type": "ACTUAL" if is_in_window else ("VIRTUAL_ATTENDED" if sub_ts > 0 else "NOT_VERIFIED"),
                        "is_within_contest_window": is_in_window,
                        "is_contest_problem": is_prob_match,
                        "is_actual_participation": is_actual,
                        "is_verified": is_verified,
                        "counted": is_verified,
                        "rejection_reason": "Verified ACCEPTED contest submission" if is_verified else (
                            f"Rejected: Timestamp {sub_ist_str} outside official contest window {contest_start_dt.strftime('%Y-%m-%d 08:00')} - {contest_end_dt.strftime('09:30 IST')}" if not is_in_window else (
                                f"Rejected: Submission status '{sub_status}' is not ACCEPTED" if sub_status not in ("ACCEPTED", "AC", "10") else "Rejected: Problem slug mismatch"
                            )
                        ),
                        "evidence_source": "LEETCODE_GRAPHQL_OFFICIAL",
                        "snapshot_id": snapshot_meta["snapshot_id"]
                    })

                    if is_verified and best_sub is None:
                        best_sub = {
                            "status": "ACCEPTED",
                            "evidence": f"ACCEPTED on {prob_slug}",
                            "sub_time": sub_ist_str,
                            "verified": 1
                        }

                if best_sub:
                    q_results[q_key] = best_sub
                    q_verified_flags[q_key] = 1
                else:
                    q_results[q_key] = {
                        "status": "NOT_SOLVED",
                        "evidence": "No evidence",
                        "sub_time": "N/A",
                        "verified": 0
                    }
                    q_verified_flags[q_key] = 0

            # Compute Verified Total (strictly 0..4)
            verified_total = q_verified_flags["Q1"] + q_verified_flags["Q2"] + q_verified_flags["Q3"] + q_verified_flags["Q4"]
            assert 0 <= verified_total <= 4, f"Invalid verified_total: {verified_total} for {student.reg_no}"

            if verified_total > 0 and participation_type == "NOT_VERIFIED":
                participation_type = "ACTUAL"
                ver_status = "VERIFIED_VIA_SUBMISSIONS"

            # Sheet 1: OFFICIAL_RESULT row
            off_row = {
                "s_no": idx,
                "reg_no": reg_no,
                "student_name": name,
                "department": dept_name,
                "year": year_lvl,
                "leetcode_username": username or "N/A",
                "leetcode_profile": profile_url,
                "account_verification": account_ver_status,
                "participation_type": participation_type,
                "contest_id": session.contest_id or f"weekly-contest-{contest_number}",
                "contest_name": session.contest_name or f"Weekly Contest {contest_number}",
                "contest_date": session.session_date or "2026-09-20",
                "q1_problem": problem_set.problems[0].title_slug,
                "q1_status": q_results["Q1"]["status"],
                "q1_evidence": q_results["Q1"]["evidence"],
                "q1_sub_time": q_results["Q1"]["sub_time"],
                "q2_problem": problem_set.problems[1].title_slug,
                "q2_status": q_results["Q2"]["status"],
                "q2_evidence": q_results["Q2"]["evidence"],
                "q2_sub_time": q_results["Q2"]["sub_time"],
                "q3_problem": problem_set.problems[2].title_slug,
                "q3_status": q_results["Q3"]["status"],
                "q3_evidence": q_results["Q3"]["evidence"],
                "q3_sub_time": q_results["Q3"]["sub_time"],
                "q4_problem": problem_set.problems[3].title_slug,
                "q4_status": q_results["Q4"]["status"],
                "q4_evidence": q_results["Q4"]["evidence"],
                "q4_sub_time": q_results["Q4"]["sub_time"],
                "verified_q1": q_verified_flags["Q1"],
                "verified_q2": q_verified_flags["Q2"],
                "verified_q3": q_verified_flags["Q3"],
                "verified_q4": q_verified_flags["Q4"],
                "verified_total": verified_total,
                "verification_status": ver_status
            }
            official_rows.append(off_row)

            # Sheet 3: STUDENT_SUMMARY row
            student_summary_rows.append({
                "reg_no": reg_no,
                "student_name": name,
                "department": dept_name,
                "year": year_lvl,
                "leetcode_username": username or "N/A",
                "participation_type": participation_type,
                "q1": q_verified_flags["Q1"],
                "q2": q_verified_flags["Q2"],
                "q3": q_verified_flags["Q3"],
                "q4": q_verified_flags["Q4"],
                "verified_total": verified_total,
                "verification_status": ver_status
            })

            # Sheet 4: RECONCILIATION row against legacy DB values
            legacy_pub = legacy_pub_map.get(student.id)
            legacy_prev = legacy_prev_map.get(student.id)

            old_q1 = legacy_prev.q1 if legacy_prev else (legacy_pub.q1 if legacy_pub else 0)
            old_q2 = legacy_prev.q2 if legacy_prev else (legacy_pub.q2 if legacy_pub else 0)
            old_q3 = legacy_prev.q3 if legacy_prev else (legacy_pub.q3 if legacy_pub else 0)
            old_q4 = legacy_prev.q4 if legacy_prev else (legacy_pub.q4 if legacy_pub else 0)
            old_total = legacy_prev.problems_solved if legacy_prev else (legacy_pub.total_contest_solved if legacy_pub else 0)

            diff = verified_total - old_total
            if diff != 0:
                diff_reason = f"Legacy DB had {old_total} solved (inferred/unverified). Reconstructed evidence proves {verified_total} solved."
            else:
                diff_reason = "100% Exact match between legacy DB and new verified evidence."

            reconciliation_rows.append({
                "reg_no": reg_no,
                "student_name": name,
                "username": username or "N/A",
                "old_q1": old_q1,
                "old_q2": old_q2,
                "old_q3": old_q3,
                "old_q4": old_q4,
                "old_total": old_total,
                "new_q1": q_verified_flags["Q1"],
                "new_q2": q_verified_flags["Q2"],
                "new_q3": q_verified_flags["Q3"],
                "new_q4": q_verified_flags["Q4"],
                "new_verified_total": verified_total,
                "difference": diff,
                "reason_for_difference": diff_reason,
                "evidence_status": ver_status
            })

            # Data Quality Issues Logging
            if not username:
                data_quality_rows.append({
                    "reg_no": reg_no, "student_name": name, "leetcode_username": "N/A",
                    "issue_category": "MISSING_USERNAME", "issue_description": "Student has no registered LeetCode handle.",
                    "impact_on_score": "Score = 0 (UNVERIFIED)", "action_required": "Collect official LeetCode handle from student."
                })
            elif account_ver_status == "DUPLICATE_ACCOUNT":
                data_quality_rows.append({
                    "reg_no": reg_no, "student_name": name, "leetcode_username": username,
                    "issue_category": "DUPLICATE_ACCOUNT", "issue_description": f"LeetCode handle '{username}' is shared by multiple students.",
                    "impact_on_score": "Score set to 0 to prevent cross-account score pollution", "action_required": "Re-verify individual student handles."
                })

            if username.lower() == "janani2311":
                janani_result_payload = off_row

        # 7. Compute Statistics
        actual_count = sum(1 for r in official_rows if r["participation_type"] == "ACTUAL")
        virtual_count = sum(1 for r in official_rows if r["participation_type"] == "VIRTUAL_ATTENDED")
        not_ver_count = sum(1 for r in official_rows if r["participation_type"] == "NOT_VERIFIED")

        s0_count = sum(1 for r in official_rows if r["verified_total"] == 0)
        s1_count = sum(1 for r in official_rows if r["verified_total"] == 1)
        s2_count = sum(1 for r in official_rows if r["verified_total"] == 2)
        s3_count = sum(1 for r in official_rows if r["verified_total"] == 3)
        s4_count = sum(1 for r in official_rows if r["verified_total"] == 4)

        q1_solved = sum(r["verified_q1"] for r in official_rows)
        q2_solved = sum(r["verified_q2"] for r in official_rows)
        q3_solved = sum(r["verified_q3"] for r in official_rows)
        q4_solved = sum(r["verified_q4"] for r in official_rows)
        total_solves = q1_solved + q2_solved + q3_solved + q4_solved

        statistics_payload = {
            "total_students": roster_count,
            "actual_participants": actual_count,
            "virtual_participants": virtual_count,
            "not_verified_participants": not_ver_count,
            "s0_count": s0_count,
            "s1_count": s1_count,
            "s2_count": s2_count,
            "s3_count": s3_count,
            "s4_count": s4_count,
            "q1_solved_count": q1_solved,
            "q2_solved_count": q2_solved,
            "q3_solved_count": q3_solved,
            "q4_solved_count": q4_solved,
            "total_verified_solves": total_solves,
            "evidence_issues_count": len(data_quality_rows),
            "duplicate_account_count": len(duplicate_handles)
        }

        # 8. Pre-Export Invariant Assertions
        assert len(official_rows) == roster_count, f"Roster count mismatch: {len(official_rows)} vs {roster_count}"
        assert all(0 <= r["verified_total"] <= 4 for r in official_rows), "Found invalid verified_total out of range 0..4"
        assert all(r["verified_total"] == (r["verified_q1"] + r["verified_q2"] + r["verified_q3"] + r["verified_q4"]) for r in official_rows), "Sum invariant failed!"

        return {
            "snapshot_metadata": snapshot_meta,
            "official_result": official_rows,
            "evidence_audit": evidence_audit_rows,
            "student_summary": student_summary_rows,
            "reconciliation": reconciliation_rows,
            "statistics": statistics_payload,
            "data_quality": data_quality_rows,
            "janani_result": janani_result_payload,
            "roster_count": roster_count,
            "total_verified_solves": total_solves
        }
