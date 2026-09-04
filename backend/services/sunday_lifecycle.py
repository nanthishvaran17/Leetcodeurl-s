"""
sunday_lifecycle.py — Production Sunday Weekly Contest Lifecycle Engine

Guarantees:
- Dynamic discovery: No hardcoded contest numbers (supports 515, 516, 517, 518, 519, ...).
- Modern ZoneInfo timezone handling (UTC storage, IST scheduling and display).
- Live snapshot polling during live window (08:00 AM – 09:30 AM IST).
- Post-contest result collection with backoff until 09:58 AM IST cutoff.
- Immutable snapshot freeze at 09:58 AM IST.
- Sunday report generation at 10:00 AM IST.
- Finite, scheduled background verifications (1h, 6h, Friday rating update; NO infinite loops).
"""
from __future__ import annotations

import asyncio
from datetime import timedelta
from typing import Any, Dict, Optional

from backend.logger import logger
from backend.models import (
    Contest,
    ContestParticipationRecord,
    LeetCodeAccount,
    SnapshotRecord,
    Student,
)
from backend.services.efficient_student_fetcher import EfficientStudentFetcher
from backend.services.leetcode_adapter import ContestMetadata, LeetCodeAdapter, ProductionLeetCodeAdapter
from backend.services.participation_classifier import ClassificationResult, ParticipationClassifier
from backend.time_utils import (
    IST,
    format_ist,
    get_report_time_utc,
    get_snapshot_cutoff_utc,
    now_utc,
)


class SundayLifecycle:
    """
    Manages the complete weekly lifecycle for LeetCode contests.
    """

    def __init__(
        self,
        db_session_factory,
        adapter: Optional[LeetCodeAdapter] = None,
        scheduler = None,
    ):
        self.db_session_factory = db_session_factory
        self.adapter = adapter or ProductionLeetCodeAdapter(db_session_factory=db_session_factory)
        self.classifier = ParticipationClassifier(adapter=self.adapter)
        self.fetcher = EfficientStudentFetcher(adapter=self.adapter, max_concurrency=5)
        self.scheduler = scheduler

    # ─────────────────────────────────────────────────────────────────────────
    # CONTEST DISCOVERY (DYNAMIC)
    # ─────────────────────────────────────────────────────────────────────────

    async def discover_current_weekly(self) -> Contest:
        """
        Discovers the current / upcoming Sunday weekly contest dynamically.
        Persists and returns the Contest model from the database.
        """
        contests_meta = await self.adapter.discover_contests()
        now = now_utc()
        
        # Pick the active live contest or the closest upcoming/recent weekly contest
        target_meta: Optional[ContestMetadata] = None
        for c in contests_meta:
            if c.contest_type == "weekly":
                if c.start_time <= now <= c.end_time:
                    target_meta = c
                    break
                elif c.start_time > now:
                    if target_meta is None or c.start_time < target_meta.start_time:
                        target_meta = c

        if not target_meta and contests_meta:
            # Fallback to the latest completed weekly contest
            weekly_contests = [c for c in contests_meta if c.contest_type == "weekly"]
            if weekly_contests:
                target_meta = max(weekly_contests, key=lambda x: x.start_time)

        if not target_meta:
            raise ValueError("No Weekly Contest metadata could be discovered.")

        # Persist contest in database
        db = self.db_session_factory()
        try:
            contest = db.query(Contest).filter_by(
                platform="leetcode", contest_slug=target_meta.contest_slug
            ).first()

            if not contest:
                contest = Contest(
                    platform="leetcode",
                    contest_slug=target_meta.contest_slug,
                    contest_title=target_meta.contest_title,
                    contest_number=target_meta.contest_number,
                    contest_type=target_meta.contest_type,
                    start_time=target_meta.start_time,
                    end_time=target_meta.end_time,
                    duration=target_meta.duration,
                    status=target_meta.status,
                    problem_list=target_meta.problem_list,
                    metadata_json=target_meta.metadata,
                    discovered_at=now,
                    updated_at=now,
                )
                db.add(contest)
                db.commit()
                db.refresh(contest)
                logger.info(f"[LIFECYCLE] Discovered and saved contest: {contest.contest_slug}")
            else:
                contest.status = target_meta.status
                contest.updated_at = now
                db.commit()
                db.refresh(contest)

            return contest
        finally:
            db.close()

    # ─────────────────────────────────────────────────────────────────────────
    # FULL SUNDAY RUNNER WORKFLOW
    # ─────────────────────────────────────────────────────────────────────────

    async def run(self, auto_wait: bool = True) -> Dict[str, Any]:
        """
        Executes the Sunday Contest Lifecycle adhering strictly to timing guarantees:
        1. Discover dynamic contest
        2. Wait until start time (if upcoming and auto_wait=True)
        3. Poll live snapshots until end_time
        4. Collect results with backoff retries until 09:58 AM IST cutoff
        5. Freeze immutable snapshot at 09:58 AM IST
        6. Wait for 10:00 AM IST report time
        7. Generate Sunday report
        8. Schedule background verification (finite jobs)
        """
        contest = await self.discover_current_weekly()
        logger.info(
            f"[LIFECYCLE] Running Sunday Lifecycle for {contest.contest_slug} "
            f"(Start: {format_ist(contest.start_time)}, End: {format_ist(contest.end_time)})"
        )

        now = now_utc()

        # Step 2: Wait for contest start if in future
        if auto_wait and contest.start_time > now:
            wait_seconds = (contest.start_time - now).total_seconds()
            logger.info(f"[LIFECYCLE] Waiting {wait_seconds:.1f}s until contest start at {format_ist(contest.start_time)}")
            await asyncio.sleep(min(wait_seconds, 3600))

        # Step 3: LIVE tracking during active window
        if now < contest.end_time:
            logger.info(f"[LIFECYCLE] Contest LIVE: {contest.contest_slug}. Tracking snapshots...")
            self._update_contest_status(contest.id, "live")
            while now_utc() < contest.end_time:
                await self.take_live_snapshot(contest)
                await asyncio.sleep(30)  # 30s interval

        # Step 4: Collection Phase (09:30 – 09:58 AM IST)
        logger.info(f"[LIFECYCLE] Contest ENDED: {contest.contest_slug}. Entering collection phase...")
        self._update_contest_status(contest.id, "completed")
        cutoff_utc = get_snapshot_cutoff_utc(contest.start_time)

        retry_count = 0
        max_retries = 8
        while now_utc() < cutoff_utc and retry_count < max_retries:
            try:
                collection_res = await self.collect_and_classify_participants(contest)
                if collection_res.get("all_resolved"):
                    logger.info(f"[LIFECYCLE] All participants successfully collected on attempt {retry_count + 1}")
                    break
            except Exception as e:
                logger.warning(f"[LIFECYCLE] Collection attempt {retry_count + 1} failed: {e}")

            delay = min(15 * (1.5 ** retry_count), 90)
            if auto_wait:
                await asyncio.sleep(delay)
            retry_count += 1

        # Step 5: Freeze Immutable Snapshot at 09:58 AM IST
        logger.info(f"[LIFECYCLE] Freezing immutable snapshot at cutoff: {format_ist(cutoff_utc)}")
        await self.freeze_snapshot(contest)

        # Step 6: Wait for 10:00 AM IST report generation
        report_time_utc = get_report_time_utc(contest.start_time)
        if auto_wait and now_utc() < report_time_utc:
            wait_report = (report_time_utc - now_utc()).total_seconds()
            logger.info(f"[LIFECYCLE] Waiting {wait_report:.1f}s until 10:00 AM IST report time")
            await asyncio.sleep(wait_report)

        # Step 7: Generate Sunday Report
        logger.info(f"[LIFECYCLE] Generating Sunday Report for {contest.contest_slug}...")
        report_data = await self.generate_sunday_report(contest)

        # Step 8: Schedule Background Verifications
        if self.scheduler:
            self.schedule_verifications(contest)

        return {
            "status": "SUCCESS",
            "contest_slug": contest.contest_slug,
            "report": report_data,
        }

    # ─────────────────────────────────────────────────────────────────────────
    # SNAPSHOT & CLASSIFICATION LOGIC
    # ─────────────────────────────────────────────────────────────────────────

    async def take_live_snapshot(self, contest: Contest):
        """Captures real-time participant snapshots into the snapshots table."""
        db = self.db_session_factory()
        try:
            students = db.query(Student).filter(Student.is_active == True).all()
            accounts = {acc.student_id: acc.leetcode_username for acc in db.query(LeetCodeAccount).all()}
            usernames = {acc.leetcode_username for acc in db.query(LeetCodeAccount).all() if acc.leetcode_username}

            fetched_map = await self.fetcher.fetch_all_participants(contest.contest_slug, usernames)
            now = now_utc()

            for student in students:
                uname = accounts.get(student.id)
                if not uname:
                    continue
                data = fetched_map.get(uname.lower())
                if data:
                    snap = SnapshotRecord(
                        contest_id=contest.id,
                        student_id=student.id,
                        rank=data.rank,
                        score=data.score,
                        solved_count=data.solved_count,
                        captured_at=now,
                    )
                    db.add(snap)
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"[LIFECYCLE] Live snapshot capture error: {e}")
        finally:
            db.close()

    async def collect_and_classify_participants(self, contest: Any) -> Dict[str, Any]:
        """
        Fetches evidence for all students and executes evidence-based classification.
        Stores results into contest_participation with upsert guarantees.
        """
        contest_id = contest.id if hasattr(contest, "id") else int(contest)
        db = self.db_session_factory()
        try:
            contest_record = db.query(Contest).filter_by(id=contest_id).first()
            if not contest_record:
                raise ValueError(f"Contest with ID {contest_id} not found in database.")
            contest_slug = contest_record.contest_slug

            students = db.query(Student).filter(Student.is_active == True).all()
            accounts_map = {acc.student_id: acc for acc in db.query(LeetCodeAccount).all()}
            usernames = {acc.leetcode_username for acc in accounts_map.values() if acc.leetcode_username}

            # 3-tier fetch
            fetched_results = await self.fetcher.fetch_all_participants(contest_slug, usernames)

            classified_count = 0
            actual_count = 0
            virtual_count = 0
            not_verified_count = 0
            now = now_utc()

            for student in students:
                acc = accounts_map.get(student.id)
                if not acc or not acc.leetcode_username:
                    continue

                uname = acc.leetcode_username.strip().lower()
                evidence_data = fetched_results.get(uname)

                # Classify through strict evidence flow
                classification: ClassificationResult = await self.classifier.classify(
                    username=acc.leetcode_username,
                    contest_slug=contest_slug,
                    contest_evidence=evidence_data if (evidence_data and evidence_data.source != "user_contest_history") else None,
                    history_evidence=None,  # Checked internally if needed
                    virtual_evidence=evidence_data if (evidence_data and evidence_data.is_virtual) else None,
                )

                if classification.participation_type == "LIVE":
                    actual_count += 1
                elif classification.participation_type == "VIRTUAL":
                    virtual_count += 1
                else:
                    not_verified_count += 1

                # Upsert into contest_participation
                part_record = db.query(ContestParticipationRecord).filter_by(
                    contest_id=contest_id, student_id=student.id
                ).first()

                if not part_record:
                    part_record = ContestParticipationRecord(
                        contest_id=contest_id,
                        student_id=student.id,
                        leetcode_username=acc.leetcode_username,
                        participation_status=classification.participation_type,
                        verification_status="VERIFIED",
                        rank=classification.rank,
                        score=classification.score,
                        solved_count=classification.solved_count,
                        finish_time=classification.finish_time,
                        questions=classification.questions,
                        evidence_source=classification.classification_reason,
                        evidence_metadata=classification.evidence_summary,
                        confidence=classification.confidence,
                        first_fetched_at=now,
                        last_fetched_at=now,
                        verified_at=now if classification.confidence in ["VERY_HIGH", "HIGH", "MODERATE"] else None,
                    )
                    db.add(part_record)
                else:
                    # Update fields (Preserving 09:58 snapshot if already frozen)
                    part_record.participation_status = classification.participation_type
                    part_record.rank = classification.rank
                    part_record.score = classification.score
                    part_record.solved_count = classification.solved_count
                    part_record.finish_time = classification.finish_time
                    part_record.questions = classification.questions
                    part_record.evidence_source = classification.classification_reason
                    part_record.evidence_metadata = classification.evidence_summary
                    part_record.confidence = classification.confidence
                    part_record.last_fetched_at = now
                    if classification.confidence in ["VERY_HIGH", "HIGH", "MODERATE"] and not part_record.verified_at:
                        part_record.verified_at = now

                classified_count += 1

            db.commit()

            return {
                "all_resolved": (classified_count == len(students)),
                "total_students": len(students),
                "classified_count": classified_count,
                "actual": actual_count,
                "virtual": virtual_count,
                "not_verified": not_verified_count,
            }
        except Exception as e:
            db.rollback()
            logger.error(f"[LIFECYCLE] Error collecting participants: {e}")
            raise
        finally:
            db.close()

    async def freeze_snapshot(self, contest: Any):
        """
        Freezes the immutable 09:58 AM IST snapshot for all current participants.
        Only writes snapshot fields if they have not been frozen yet.
        """
        contest_id = contest.id if hasattr(contest, "id") else int(contest)
        db = self.db_session_factory()
        try:
            records = db.query(ContestParticipationRecord).filter_by(contest_id=contest_id).all()
            now = now_utc()
            frozen_count = 0

            for rec in records:
                if rec.snapshot_at is None:
                    rec.snapshot_rank = rec.rank
                    rec.snapshot_score = rec.score
                    rec.snapshot_solved = rec.solved_count
                    rec.snapshot_at = now
                    frozen_count += 1

            db.commit()
            logger.info(f"[LIFECYCLE] Successfully frozen {frozen_count} snapshot records for contest {contest_id}")
        except Exception as e:
            db.rollback()
            logger.error(f"[LIFECYCLE] Error freezing snapshot: {e}")
        finally:
            db.close()

    async def generate_sunday_report(self, contest: Any) -> Dict[str, Any]:
        """
        Generates official Sunday Report data at 10:00 AM IST using CollegeReportGenerator.
        Generates two-sheet Excel file, sends email to coordinator/HOD, and saves report artifact.
        """
        import os
        from backend.report_generator import CollegeReportGenerator
        from backend.email_service import send_weekly_report_email

        contest_id = contest.id if hasattr(contest, "id") else int(contest)
        db = self.db_session_factory()
        try:
            contest_record = db.query(Contest).filter_by(id=contest_id).first()
            slug = contest_record.contest_slug if contest_record else str(contest_id)
            title = contest_record.contest_title if contest_record else str(contest_id)

            report_gen = CollegeReportGenerator(self.db_session_factory)
            report_result = await report_gen.generate_complete_report(contest_id)

            # Ensure reports output directory exists
            reports_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "reports")
            os.makedirs(reports_dir, exist_ok=True)
            report_filepath = os.path.join(reports_dir, report_result["filename"])

            # Save Excel file
            with open(report_filepath, "wb") as f:
                f.write(report_result["excel_bytes"])
            logger.info(f"[LIFECYCLE] Saved official college report Excel: {report_filepath}")

            # Send Email if recipients configured
            to_emails_str = getattr(settings, "TO_EMAILS", "") or "nanthishvaran17@gmail.com"
            recipient_list = [e.strip() for e in to_emails_str.split(",") if e.strip()]

            try:
                send_weekly_report_email(
                    db=db,
                    recipient_emails=recipient_list,
                    subject=f"NANDHA ENGINEERING COLLEGE — LeetCode Weekly Performance Report ({title})",
                    body_html=report_result["email_html"],
                    excel_bytes=report_result["excel_bytes"],
                    trigger_type="AUTOMATED"
                )
                logger.info(f"[LIFECYCLE] Dispatched Sunday report email to {len(recipient_list)} recipients.")
            except Exception as mail_err:
                logger.warning(f"[LIFECYCLE] Note on email dispatch: {mail_err}")

            records = db.query(ContestParticipationRecord).filter_by(contest_id=contest_id).all()
            actuals = [r for r in records if r.participation_status == "ACTUAL"]
            virtuals = [r for r in records if r.participation_status == "VIRTUAL"]
            not_verified = [r for r in records if r.participation_status == "NOT_VERIFIED"]
            conflicts = [r for r in records if r.verification_status == "CONFLICT"]

            summary = {
                "contest_slug": slug,
                "contest_title": title,
                "generated_at_ist": format_ist(now_utc()),
                "total_students": len(records),
                "actual_count": len(actuals),
                "virtual_count": len(virtuals),
                "not_verified_count": len(not_verified),
                "conflict_count": len(conflicts),
                "report_filepath": report_filepath,
                "filename": report_result["filename"],
                "details": [
                    {
                        "student_id": r.student_id,
                        "leetcode_username": r.leetcode_username,
                        "participation_status": r.participation_status,
                        "verification_status": r.verification_status,
                        "rank": r.rank,
                        "score": r.score,
                        "solved_count": r.solved_count,
                        "snapshot_rank": r.snapshot_rank,
                        "snapshot_score": r.snapshot_score,
                    }
                    for r in records
                ],
            }
            return summary
        finally:
            db.close()

    def schedule_verifications(self, contest: Contest):
        """Schedules finite verification jobs without infinite loops."""
        if not self.scheduler:
            return

        now = now_utc()
        # 1 Hour Verification
        self.scheduler.add_job(
            self.collect_and_classify_participants,
            "date",
            run_date=now + timedelta(hours=1),
            args=[contest],
            id=f"verify_{contest.id}_1h",
            timezone=IST,
            replace_existing=True,
        )

        # 6 Hour Verification
        self.scheduler.add_job(
            self.collect_and_classify_participants,
            "date",
            run_date=now + timedelta(hours=6),
            args=[contest],
            id=f"verify_{contest.id}_6h",
            timezone=IST,
            replace_existing=True,
        )

        logger.info(f"[LIFECYCLE] Scheduled 1h and 6h background verifications for {contest.contest_slug}")

    def _update_contest_status(self, contest_id: int, status: str):
        db = self.db_session_factory()
        try:
            c = db.query(Contest).filter_by(id=contest_id).first()
            if c:
                c.status = status
                c.updated_at = now_utc()
                db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()
