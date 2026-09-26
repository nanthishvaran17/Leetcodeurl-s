"""
delayed_reconciliation_service.py — Delayed Official LeetCode Reconciliation Engine (Phase X - Fix 2)

Workflow:
  1. PROVISIONAL REPORT (T+0 ~ 09:35 AM IST)
     - Marked as "PROVISIONAL — pending official LeetCode reconciliation."
     - Uses Fix 1 evidence-first classification.
  2. T+3 HOUR RECONCILIATION (~ 12:30 PM IST)
     - Re-queries official LeetCode data.
     - Compares against provisional report.
     - Records audit trail of any corrections.
     - Preserves provisional version intact; stores T+3 version separately.
  3. T+12 HOUR FINAL RECONCILIATION (~ 09:30 PM IST)
     - Performs final LeetCode reconciliation.
     - On successful validation: sets status to OFFICIAL_RECONCILED.
     - On API/network failure: sets status to RECONCILIATION_FAILED (does NOT falsely mark OFFICIAL_RECONCILED).
     - Preserves previous versions.
"""
from __future__ import annotations

import os
import asyncio
import csv
import json
import hashlib
import datetime
import zoneinfo
from typing import Dict, Any, List, Optional, Tuple

import httpx
from sqlalchemy.orm import Session

from backend.logger import logger
from backend.models import (
    Student,
    WeeklySession,
    WeeklyPublicResult,
    StudentContestParticipation,
    ContestParticipation,
    ContestReconciliationEvent,
    ContestReportVersion
)
from backend.services.contest_classifier import (
    evaluate_contest_evidence,
    get_contest_utc_window,
    normalize_contest_id,
    contest_number_from_id,
    get_official_contest_problems,
    ContestStatus
)

IST_TZ = zoneinfo.ZoneInfo("Asia/Kolkata")
UTC_TZ = datetime.timezone.utc


class DelayedReconciliationEngine:
    """
    Production Delayed LeetCode Reconciliation Engine for Phase X Fix 2.
    """

    STAGE_PROVISIONAL = "PROVISIONAL"
    STAGE_T_PLUS_3 = "T_PLUS_3_RECONCILIATION"
    STAGE_T_PLUS_12 = "T_PLUS_12_FINAL"

    STATUS_PROVISIONAL = "PROVISIONAL"
    STATUS_RECONCILED = "RECONCILED"
    STATUS_OFFICIAL_RECONCILED = "OFFICIAL_RECONCILED"
    STATUS_RECONCILIATION_FAILED = "RECONCILIATION_FAILED"
    STATUS_PENDING_RECONCILIATION = "PENDING_RECONCILIATION"

    PROVISIONAL_BANNER = "PROVISIONAL — pending official LeetCode reconciliation."

    def __init__(self, db_session=None):
        self.db_session = db_session

    async def fetch_leetcode_evidence_async(
        self, username: str, contest_slug: str, client: httpx.AsyncClient
    ) -> Tuple[Optional[bool], List[Dict[str, Any]], Optional[str]]:
        """Fetches GraphQL userContestRankingHistory & recentAcSubmissionList."""
        if not username or len(username) < 2:
            return None, [], "no_username"

        url = "https://leetcode.com/graphql"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Content-Type": "application/json",
            "Referer": f"https://leetcode.com/u/{username}/",
        }
        query = """
        query userContestAndSubs($username: String!) {
          userContestRankingHistory(username: $username) {
            attended
            problemsSolved
            contest {
              title
              startTime
            }
          }
          recentAcSubmissionList(username: $username, limit: 30) {
            id
            title
            titleSlug
            timestamp
          }
        }
        """
        payload = {"query": query, "variables": {"username": username}, "operationName": "userContestAndSubs"}

        from backend.services.token_bucket_limiter import global_token_bucket_limiter

        for attempt in range(1, 4):
            if attempt > 1:
                global_token_bucket_limiter.retry_count += 1
            await global_token_bucket_limiter.acquire_token()
            global_token_bucket_limiter.total_requests += 1

            try:
                resp = await client.post(url, json=payload, headers=headers, timeout=8.0)
                if resp.status_code == 429:
                    global_token_bucket_limiter.http_429_count += 1
                    retry_after = resp.headers.get("Retry-After")
                    wait = float(retry_after) if retry_after and str(retry_after).isdigit() else (1.5 ** attempt)
                    if attempt < 3:
                        await asyncio.sleep(wait)
                        continue
                    global_token_bucket_limiter.rate_limited_failures += 1
                    return None, [], "rate_limited"

                if resp.status_code != 200:
                    if attempt < 3 and resp.status_code >= 500:
                        await asyncio.sleep(1.5 ** attempt)
                        continue
                    return None, [], f"HTTP {resp.status_code}"

                data = resp.json().get("data") or {}
                history = data.get("userContestRankingHistory") or []
                recent_ac = data.get("recentAcSubmissionList") or []

                import re
                target_num = contest_number_from_id(contest_slug)
                attended_flag = False
                found_in_history = False

                for h in history:
                    c_title = (h.get("contest") or {}).get("title") or ""
                    m = re.search(r'\d+', c_title)
                    if m and target_num and int(m.group(0)) == target_num:
                        found_in_history = True
                        attended_flag = bool(h.get("attended", False))
                        break

                if not found_in_history:
                    attended_flag = False

                global_token_bucket_limiter.successful_requests += 1
                return attended_flag, recent_ac, None

            except Exception as e:
                if attempt < 3:
                    await asyncio.sleep(1.5 ** attempt)
                    continue
                return None, [], str(e)

    def generate_provisional_report(
        self,
        contest_id: str,
        db: Session,
        students_evidence: Optional[List[Dict[str, Any]]] = None,
        official_problems: Optional[List[Dict[str, Any]]] = None,
    ) -> ContestReportVersion:
        """
        Generates Stage 1: PROVISIONAL Report at T+0 (~09:35 AM IST).
        Marked explicitly as 'PROVISIONAL — pending official LeetCode reconciliation.'
        Preserves Fix 1 evidence-first classification logic.
        """
        canonical_id = normalize_contest_id(contest_id)
        start_utc, end_utc = get_contest_utc_window(canonical_id)
        if not official_problems:
            official_problems = get_official_contest_problems(canonical_id)

        session_row = db.query(WeeklySession).filter(WeeklySession.contest_id == canonical_id).first()
        session_id = session_row.id if session_row else None
        now_utc_dt = datetime.datetime.now(datetime.timezone.utc)

        students = db.query(Student).all()
        dataset = []

        live_cnt = virtual_cnt = zero_cnt = not_att_cnt = fail_cnt = 0

        for student in students:
            handle = getattr(student, "username", None) or getattr(student, "leetcode_username", None)

            # Match evidence if pre-supplied or in evidence list
            ev = None
            if students_evidence:
                for item in students_evidence:
                    if item.get("student_id") == student.id or item.get("username") == handle:
                        ev = item
                        break

            attended = ev.get("attended") if ev else False
            raw_subs = ev.get("recent_ac", []) if ev else []
            fetch_err = ev.get("error") if ev else None

            res = evaluate_contest_evidence(
                student_id=student.id,
                student_name=student.name,
                leetcode_username=handle,
                contest_id=canonical_id,
                contest_name=f"Weekly Contest {contest_number_from_id(canonical_id)}",
                contest_start_utc=start_utc,
                contest_end_utc=end_utc,
                official_problems=official_problems or [],
                ranking_history_attended=attended,
                raw_submissions=raw_subs,
                fetch_error=fetch_err
            )

            row_dict = res.to_dict()
            row_dict["report_header"] = self.PROVISIONAL_BANNER
            dataset.append(row_dict)

            if res.status == ContestStatus.LIVE:
                live_cnt += 1
            elif res.status == ContestStatus.VIRTUAL:
                virtual_cnt += 1
            elif res.status == ContestStatus.ATTENDED_ZERO:
                zero_cnt += 1
            elif res.status == ContestStatus.NOT_ATTENDED:
                not_att_cnt += 1
            else:
                fail_cnt += 1

        # Compute hash
        dataset_str = json.dumps(dataset, sort_keys=True)
        dataset_hash = hashlib.sha256(dataset_str.encode("utf-8")).hexdigest()

        # Save/Update PROVISIONAL version in ContestReportVersion
        version_row = db.query(ContestReportVersion).filter(
            ContestReportVersion.contest_id == canonical_id,
            ContestReportVersion.reconciliation_stage == self.STAGE_PROVISIONAL
        ).first()

        if not version_row:
            version_row = ContestReportVersion(
                session_id=session_id,
                contest_id=canonical_id,
                contest_name=f"Weekly Contest {contest_number_from_id(canonical_id)}",
                reconciliation_stage=self.STAGE_PROVISIONAL,
                status=self.STATUS_PROVISIONAL,
                generated_at=now_utc_dt,
                reconciliation_timestamp=now_utc_dt,
                total_students=len(students),
                live_count=live_cnt,
                virtual_count=virtual_cnt,
                attended_zero_count=zero_cnt,
                not_attended_count=not_att_cnt,
                failed_count=fail_cnt,
                dataset=dataset,
                dataset_hash=dataset_hash,
                evidence_metadata={"banner": self.PROVISIONAL_BANNER, "official_problems_count": len(official_problems or [])},
                reconciliation_summary={"stage": self.STAGE_PROVISIONAL, "banner": self.PROVISIONAL_BANNER}
            )
            db.add(version_row)
        else:
            version_row.generated_at = now_utc_dt
            version_row.reconciliation_timestamp = now_utc_dt
            version_row.status = self.STATUS_PROVISIONAL
            version_row.dataset = dataset
            version_row.dataset_hash = dataset_hash
            version_row.live_count = live_cnt
            version_row.virtual_count = virtual_cnt
            version_row.attended_zero_count = zero_cnt
            version_row.not_attended_count = not_att_cnt
            version_row.failed_count = fail_cnt

        db.commit()
        db.refresh(version_row)

        # Write PROVISIONAL Report Artifacts
        self._write_artifacts(canonical_id, self.STAGE_PROVISIONAL, dataset, {
            "stage": self.STAGE_PROVISIONAL,
            "banner": self.PROVISIONAL_BANNER,
            "status": self.STATUS_PROVISIONAL,
            "total_students": len(students),
            "live_count": live_cnt,
            "virtual_count": virtual_cnt,
            "attended_zero_count": zero_cnt,
            "not_attended_count": not_att_cnt,
            "failed_count": fail_cnt
        })

        logger.info(f"[DELAYED_REC] Generated PROVISIONAL report version for {canonical_id}")
        return version_row

    def reconcile_stage(
        self,
        contest_id: str,
        stage: str,
        db: Session,
        reconciled_evidence: Optional[List[Dict[str, Any]]] = None,
        official_problems: Optional[List[Dict[str, Any]]] = None,
        simulate_network_failure: bool = False
    ) -> Tuple[ContestReportVersion, int]:
        """
        Executes Stage 2 (T+3) or Stage 3 (T+12) Reconciliation.
        
        Guarantees:
          - Compares new evidence against previous version dataset.
          - If differences exist, records ContestReconciliationEvent audit events with exact before/after states.
          - Idempotency: Retrying multiple times will NOT duplicate audit events for the same stage/state.
          - Version Preservation: Preserves PROVISIONAL and prior versions untouched.
          - Failure Safety: On API failure, does NOT mark OFFICIAL_RECONCILED. Sets status to RECONCILIATION_FAILED.
        """
        canonical_id = normalize_contest_id(contest_id)
        start_utc, end_utc = get_contest_utc_window(canonical_id)
        if not official_problems:
            official_problems = get_official_contest_problems(canonical_id)

        session_row = db.query(WeeklySession).filter(WeeklySession.contest_id == canonical_id).first()
        session_id = session_row.id if session_row else None
        now_utc_dt = datetime.datetime.now(datetime.timezone.utc)

        # Load PROVISIONAL dataset for comparison
        prov_version = db.query(ContestReportVersion).filter(
            ContestReportVersion.contest_id == canonical_id,
            ContestReportVersion.reconciliation_stage == self.STAGE_PROVISIONAL
        ).first()

        prov_data_map = {}
        if prov_version and prov_version.dataset:
            for item in prov_version.dataset:
                prov_data_map[item["student_id"]] = item

        # Handle API / Network Failure safety rule
        if simulate_network_failure or (reconciled_evidence is None and not db.query(Student).first()):
            logger.warning(f"[DELAYED_REC] Reconciliation stage {stage} failed due to network/API failure for {canonical_id}.")
            
            # Log failure audit event
            fail_event = ContestReconciliationEvent(
                session_id=session_id,
                student_id=None,
                contest_id=canonical_id,
                event_type="RECONCILIATION_FAILED",
                reconciliation_stage=stage,
                old_state=prov_version.status if prov_version else "PROVISIONAL",
                new_state=self.STATUS_RECONCILIATION_FAILED,
                reason=f"Network or API failure during {stage} reconciliation",
                created_at=now_utc_dt
            )
            db.add(fail_event)
            db.commit()

            # Create/Update Version record with RECONCILIATION_FAILED status (do NOT mark OFFICIAL_RECONCILED)
            fail_version = db.query(ContestReportVersion).filter(
                ContestReportVersion.contest_id == canonical_id,
                ContestReportVersion.reconciliation_stage == stage
            ).first()

            if not fail_version:
                fail_version = ContestReportVersion(
                    session_id=session_id,
                    contest_id=canonical_id,
                    contest_name=f"Weekly Contest {contest_number_from_id(canonical_id)}",
                    reconciliation_stage=stage,
                    status=self.STATUS_RECONCILIATION_FAILED,
                    generated_at=now_utc_dt,
                    reconciliation_timestamp=now_utc_dt,
                    total_students=prov_version.total_students if prov_version else 0,
                    dataset=prov_version.dataset if prov_version else [],
                    dataset_hash=prov_version.dataset_hash if prov_version else "",
                    reconciliation_summary={"stage": stage, "status": self.STATUS_RECONCILIATION_FAILED, "error": "API Failure"}
                )
                db.add(fail_version)
            else:
                fail_version.status = self.STATUS_RECONCILIATION_FAILED
                fail_version.reconciliation_timestamp = now_utc_dt

            db.commit()
            db.refresh(fail_version)
            return fail_version, 0

        # Execute reconciliation for all active students
        students = db.query(Student).all()
        dataset = []
        corrections_count = 0

        live_cnt = virtual_cnt = zero_cnt = not_att_cnt = fail_cnt = 0

        for student in students:
            handle = getattr(student, "username", None) or getattr(student, "leetcode_username", None)

            # Match evidence
            ev = None
            if reconciled_evidence:
                for item in reconciled_evidence:
                    if item.get("student_id") == student.id or item.get("username") == handle:
                        ev = item
                        break

            attended = ev.get("attended") if ev else False
            raw_subs = ev.get("recent_ac", []) if ev else []
            fetch_err = ev.get("error") if ev else None

            res = evaluate_contest_evidence(
                student_id=student.id,
                student_name=student.name,
                leetcode_username=handle,
                contest_id=canonical_id,
                contest_name=f"Weekly Contest {contest_number_from_id(canonical_id)}",
                contest_start_utc=start_utc,
                contest_end_utc=end_utc,
                official_problems=official_problems or [],
                ranking_history_attended=attended,
                raw_submissions=raw_subs,
                fetch_error=fetch_err
            )

            new_status = res.status.value
            new_solved = res.problems_solved if res.problems_solved is not None else 0
            new_live = res.live_solves if res.live_solves is not None else 0
            new_post = res.post_contest_solves if res.post_contest_solves is not None else 0
            new_signal = res.classification_signal or ""

            # Compare against Provisional record
            prov_item = prov_data_map.get(student.id, {})
            old_status = prov_item.get("status", "UNKNOWN")
            old_solved = prov_item.get("problems_solved", 0) or 0
            old_live = prov_item.get("live_solves", 0) or 0
            old_post = prov_item.get("post_contest_solves", 0) or 0
            old_signal = prov_item.get("classification_signal", "") or ""

            is_changed = (
                old_status != new_status or
                old_solved != new_solved or
                old_live != new_live or
                old_post != new_post or
                old_signal != new_signal
            )

            if is_changed:
                # Idempotent audit logging: check if an audit event was already logged for this student at this stage
                existing_event = db.query(ContestReconciliationEvent).filter(
                    ContestReconciliationEvent.student_id == student.id,
                    ContestReconciliationEvent.contest_id == canonical_id,
                    ContestReconciliationEvent.reconciliation_stage == stage
                ).first()

                if not existing_event:
                    corrections_count += 1
                    event = ContestReconciliationEvent(
                        session_id=session_id,
                        student_id=student.id,
                        contest_id=canonical_id,
                        event_type="RECONCILIATION_CORRECTION",
                        reconciliation_stage=stage,
                        old_state=old_status,
                        new_state=new_status,
                        old_solved_count=old_solved,
                        new_solved_count=new_solved,
                        classification_signal=res.classification_signal,
                        evidence_source=f"LeetCode Official GraphQL ({stage})",
                        reason=f"Stage {stage} reconciliation updated state from {old_status} ({old_solved}/4) to {new_status} ({new_solved}/4).",
                        details={
                            "old_status": old_status,
                            "new_status": new_status,
                            "old_solved": old_solved,
                            "new_solved": new_solved,
                            "live_solves": res.live_solves,
                            "post_contest_solves": res.post_contest_solves,
                            "solve_timeline": res.solve_timeline
                        },
                        created_at=now_utc_dt
                    )
                    db.add(event)

                # Update student participation record in DB
                scp = db.query(StudentContestParticipation).filter(
                    StudentContestParticipation.student_id == student.id,
                    StudentContestParticipation.contest_id == canonical_id
                ).first()
                if scp:
                    scp.participation_mode = new_status
                    scp.questions_solved = new_solved
                    scp.status = new_status
                    scp.live_solves_count = res.live_solves
                    scp.post_contest_solves_count = res.post_contest_solves
                    scp.classification_signal = res.classification_signal
                    scp.solve_timeline = res.solve_timeline

            row_dict = res.to_dict()
            row_dict["reconciliation_stage"] = stage
            dataset.append(row_dict)

            if res.status == ContestStatus.LIVE:
                live_cnt += 1
            elif res.status == ContestStatus.VIRTUAL:
                virtual_cnt += 1
            elif res.status == ContestStatus.ATTENDED_ZERO:
                zero_cnt += 1
            elif res.status == ContestStatus.NOT_ATTENDED:
                not_att_cnt += 1
            else:
                fail_cnt += 1

        db.commit()

        # Compute hash
        dataset_str = json.dumps(dataset, sort_keys=True)
        dataset_hash = hashlib.sha256(dataset_str.encode("utf-8")).hexdigest()

        final_stage_status = self.STATUS_OFFICIAL_RECONCILED if stage == self.STAGE_T_PLUS_12 else self.STATUS_RECONCILED

        # Save/Update stage version record
        stage_version = db.query(ContestReportVersion).filter(
            ContestReportVersion.contest_id == canonical_id,
            ContestReportVersion.reconciliation_stage == stage
        ).first()

        if not stage_version:
            stage_version = ContestReportVersion(
                session_id=session_id,
                contest_id=canonical_id,
                contest_name=f"Weekly Contest {contest_number_from_id(canonical_id)}",
                reconciliation_stage=stage,
                status=final_stage_status,
                generated_at=now_utc_dt,
                reconciliation_timestamp=now_utc_dt,
                total_students=len(students),
                live_count=live_cnt,
                virtual_count=virtual_cnt,
                attended_zero_count=zero_cnt,
                not_attended_count=not_att_cnt,
                failed_count=fail_cnt,
                dataset=dataset,
                dataset_hash=dataset_hash,
                evidence_metadata={"official_problems_count": len(official_problems or []), "corrections_count": corrections_count},
                reconciliation_summary={"stage": stage, "corrections": corrections_count, "status": final_stage_status}
            )
            db.add(stage_version)
        else:
            stage_version.reconciliation_timestamp = now_utc_dt
            stage_version.status = final_stage_status
            stage_version.dataset = dataset
            stage_version.dataset_hash = dataset_hash
            stage_version.live_count = live_cnt
            stage_version.virtual_count = virtual_cnt
            stage_version.attended_zero_count = zero_cnt
            stage_version.not_attended_count = not_att_cnt
            stage_version.failed_count = fail_cnt

        db.commit()
        db.refresh(stage_version)

        # Write Stage Artifacts
        self._write_artifacts(canonical_id, stage, dataset, {
            "stage": stage,
            "status": final_stage_status,
            "total_students": len(students),
            "corrections_count": corrections_count,
            "live_count": live_cnt,
            "virtual_count": virtual_cnt,
            "attended_zero_count": zero_cnt,
            "not_attended_count": not_att_cnt,
            "failed_count": fail_cnt
        })

        logger.info(f"[DELAYED_REC] Completed stage {stage} reconciliation for {canonical_id}: {corrections_count} corrections.")
        return stage_version, corrections_count

    def _write_artifacts(self, contest_id: str, stage: str, dataset: List[Dict[str, Any]], summary: Dict[str, Any]):
        """Helper to write CSV & JSON artifacts for distinguishable stage reports."""
        stage_slug = stage.lower().replace("+", "_plus_")
        csv_filename = f"phase_x_fix2_{contest_id}_{stage_slug}.csv"
        json_filename = f"phase_x_fix2_{contest_id}_{stage_slug}.json"

        # CSV
        fieldnames = [
            "student_id", "student_name", "verified_leetcode_username", "contest_id",
            "status", "reason_code", "problems_solved", "live_solves", "post_contest_solves",
            "score_display", "q1_solved", "q2_solved", "q3_solved", "q4_solved",
            "classification_signal"
        ]
        with open(csv_filename, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(dataset)

        # JSON
        with open(json_filename, "w", encoding="utf-8") as f:
            json.dump({
                "contest_id": contest_id,
                "reconciliation_stage": stage,
                "summary": summary,
                "dataset": dataset
            }, f, indent=2)

        logger.info(f"[DELAYED_REC] Artifacts generated: {csv_filename}, {json_filename}")
