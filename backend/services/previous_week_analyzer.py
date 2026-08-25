import asyncio
import datetime
import logging
import random
import uuid
from typing import Dict, List, Optional, Tuple, Any, Set
from datetime import timezone

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError

from backend.models import (
    WeeklySession, Student, Department, Section,
    PublicContestSyncAudit, PreviousWeekParticipationRecord,
    ForensicAuditRecord, OfficialPublicParticipant
)
from backend.services.contest_discovery import (
    get_current_ist_datetime, get_immediately_previous_sunday_date,
    discover_contest_metadata, IST_TZ
)
from backend.services.public_contest_engine import PublicContestEngine, get_single_flight_lock, _global_circuit_breaker
from backend.services.authorization_service import get_authorized_student_ids
from backend.logger import logger


class PreviousWeekAnalyzer:
    """
    Production-grade Previous Week LeetCode Contest Analyzer.
    Automatically calculates previous Sunday IST, validates exact contest identity,
    scrapes complete official live leaderboard, verifies non-public students for virtual participation,
    and publishes atomic role-scoped versioned datasets.
    """

    @staticmethod
    def get_previous_week_metadata(db: Session) -> Dict[str, Any]:
        """
        Calculates immediately previous Sunday IST and resolves dynamic contest identity.
        Validates contest_id, contest_slug, contest_title, start_time, and date.
        """
        now_ist = get_current_ist_datetime()
        prev_sunday_date = get_immediately_previous_sunday_date(now_ist)
        meta = discover_contest_metadata(prev_sunday_date)

        # Validate contest identity parameters
        contest_id = meta.get("contest_id")
        contest_name = meta.get("contest_name")
        session_code = meta.get("session_code")

        if not contest_id or not contest_name:
            return {
                "status": "CONTEST_NOT_FOUND",
                "error": "Unable to discover exact Weekly Contest metadata for target date.",
                "target_date": prev_sunday_date.strftime("%Y-%m-%d")
            }

        # Check/create session record in DB
        session = db.query(WeeklySession).filter(WeeklySession.session_code == session_code).first()
        if not session:
            session = WeeklySession(
                academic_year="2026-27",
                week_number=meta["contest_number"],
                session_code=session_code,
                session_date=meta["session_date"],
                contest_id=contest_id,
                contest_name=contest_name,
                start_time="08:00",
                end_time="09:30",
                status="FINALIZED",
                total_students=db.query(Student).filter(Student.is_active == True).count()
            )
            db.add(session)
            db.commit()
            db.refresh(session)

        return {
            "status": "VERIFIED",
            "session_id": session.id,
            "session_code": session_code,
            "contest_id": contest_id,
            "contest_slug": contest_id.lower().strip(),
            "contest_title": contest_name,
            "contest_number": meta["contest_number"],
            "target_date": prev_sunday_date.strftime("%Y-%m-%d"),
            "session_date": meta["session_date"],
            "start_time_ist": meta["start_time_ist"],
            "end_time_ist": meta["end_time_ist"]
        }

    @classmethod
    async def sync_previous_week_contest(
        cls,
        db: Session,
        force_resync: bool = False
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Executes single-flight, fail-closed Previous Week synchronization lifecycle:
        1. Calculate previous Sunday & validate contest identity.
        2. Check process-local + DB lease lock.
        3. Fetch complete official public leaderboard.
        4. Perform exact normalized username matching for PUBLIC.
        5. For non-public students, perform exact virtual history verification (VIRTUAL vs NOT_PARTICIPATED vs NOT_VERIFIED).
        6. Atomic versioned dataset swap.
        """
        meta_info = cls.get_previous_week_metadata(db)
        if meta_info.get("status") not in ("VERIFIED", "FINALIZED"):
            return False, meta_info

        session_id = meta_info["session_id"]
        contest_slug = meta_info["contest_slug"]
        contest_title = meta_info["contest_title"]

        session = db.query(WeeklySession).filter(WeeklySession.id == session_id).first()
        if not session:
            return False, {"error": "WeeklySession record missing."}

        worker_id = f"worker_prev_{uuid.uuid4().hex[:8]}"
        now_utc = datetime.datetime.now(timezone.utc)

        # Single-flight process-local lock
        lock_key = f"prev_week_sync_{contest_slug}"
        lock = await get_single_flight_lock(lock_key)

        async with lock:
            sync_id = f"sync_pw_{uuid.uuid4().hex[:12]}"
            started_at = datetime.datetime.now(timezone.utc)

            # Check existing verified dataset & freshness (< 1h)
            existing_audit = db.query(PublicContestSyncAudit).filter(
                PublicContestSyncAudit.session_id == session_id,
                PublicContestSyncAudit.validation_status == "VERIFIED"
            ).order_by(PublicContestSyncAudit.id.desc()).first()

            if existing_audit and not force_resync:
                time_since_sync = (datetime.datetime.now(timezone.utc) - existing_audit.started_at.replace(tzinfo=timezone.utc)).total_seconds()
                if time_since_sync < 3600:
                    logger.info(f"[PreviousWeekAnalyzer] Reusing FRESH verified snapshot for {contest_slug}")
                    return True, {
                        "sync_id": existing_audit.sync_id,
                        "session_id": session_id,
                        "contest_slug": contest_slug,
                        "cache_state": "FRESH",
                        "status": "VERIFIED",
                        "publish_status": "PUBLISHED"
                    }

            # Create in-progress DB audit lock entry
            in_progress_audit = PublicContestSyncAudit(
                sync_id=sync_id,
                session_id=session_id,
                contest_id=str(session.id),
                contest_slug=contest_slug,
                contest_title=contest_title,
                started_at=started_at,
                source="official_leetcode_leaderboard",
                sync_owner=worker_id,
                heartbeat_at=started_at,
                circuit_breaker_state=_global_circuit_breaker.state,
                cache_state="FRESH",
                validation_status="SYNC_IN_PROGRESS",
                publish_status="DO_NOT_PUBLISH"
            )
            db.add(in_progress_audit)
            db.commit()

            # Step 1: Fetch Complete Official Public Leaderboard
            logger.info(f"[PreviousWeekAnalyzer] Fetching complete official leaderboard for {contest_slug}...")
            fetch_success, leaderboard_entries, meta_fetch = await PublicContestEngine.fetch_complete_validated_leaderboard(contest_slug)

            completed_at = datetime.datetime.now(timezone.utc)

            in_progress_audit.completed_at = completed_at
            in_progress_audit.pages_requested = meta_fetch.get("pages_requested", 1)
            in_progress_audit.pages_successfully_fetched = meta_fetch.get("pages_successfully_fetched", 1)
            in_progress_audit.total_reported = meta_fetch.get("total_reported", len(leaderboard_entries))
            in_progress_audit.total_fetched = meta_fetch.get("total_fetched", len(leaderboard_entries))
            in_progress_audit.unique_usernames = meta_fetch.get("unique_usernames", len(leaderboard_entries))
            in_progress_audit.duplicate_count = meta_fetch.get("duplicate_count", 0)
            in_progress_audit.retry_count = meta_fetch.get("retry_count", 0)

            if not fetch_success:
                in_progress_audit.validation_status = meta_fetch["validation_status"]
                in_progress_audit.publish_status = "KPT_LAST_VERIFIED"
                in_progress_audit.failure_reason = meta_fetch.get("failure_reason")
                db.commit()
                logger.error(f"[PreviousWeekAnalyzer] Leaderboard fetch failed for {contest_slug}: {meta_fetch.get('failure_reason')}. Preserving last snapshot.")
                return False, {
                    "sync_id": sync_id,
                    "session_id": session_id,
                    "contest_slug": contest_slug,
                    "status": meta_fetch["validation_status"],
                    "publish_status": "KPT_LAST_VERIFIED",
                    "error": meta_fetch.get("failure_reason")
                }

            # Step 2: Exact Username Matching for PUBLIC
            students = db.query(Student).filter(Student.is_active == True).all()
            leaderboard_map = {
                entry.get("normalized_username", entry.get("username", "").strip().lower()): entry
                for entry in leaderboard_entries if entry.get("username")
            }

            # Determine next version number
            max_ver = db.query(func.max(PreviousWeekParticipationRecord.dataset_version)).filter(
                PreviousWeekParticipationRecord.session_id == session_id
            ).scalar() or 0
            next_version = max_ver + 1

            records_to_insert: List[PreviousWeekParticipationRecord] = []
            public_count = 0
            virtual_count = 0
            not_participated_count = 0
            not_verified_count = 0
            missing_username_count = 0

            # Query forensic audit records for virtual verification
            forensic_rows = db.query(ForensicAuditRecord).filter(
                ForensicAuditRecord.contest_id == contest_slug
            ).all()
            forensic_map = {f.student_id: f for f in forensic_rows}

            for st in students:
                raw_user = st.username
                norm_user = PublicContestEngine.normalize_username(raw_user)

                if not norm_user:
                    missing_username_count += 1
                    records_to_insert.append(PreviousWeekParticipationRecord(
                        session_id=session_id,
                        contest_id=str(session.id),
                        contest_slug=contest_slug,
                        contest_title=contest_title,
                        student_id=st.id,
                        leetcode_username=None,
                        participation_type="MISSING_LEETCODE_USERNAME",
                        verification_status="UNVERIFIED",
                        dataset_version=next_version,
                        is_active_version=True,
                        sync_id=sync_id
                    ))
                    continue

                # Rule 1: Found in complete verified official leaderboard -> PUBLIC
                if norm_user in leaderboard_map:
                    entry = leaderboard_map[norm_user]
                    public_count += 1
                    records_to_insert.append(PreviousWeekParticipationRecord(
                        session_id=session_id,
                        contest_id=str(session.id),
                        contest_slug=contest_slug,
                        contest_title=contest_title,
                        student_id=st.id,
                        leetcode_username=raw_user,
                        participation_type="PUBLIC",
                        official_rank=entry["rank"],
                        official_score=entry["score"],
                        problems_solved=entry["problems_solved"],
                        finish_time=entry["finish_time"],
                        source="official_leetcode_leaderboard",
                        verification_status="VERIFIED",
                        dataset_version=next_version,
                        is_active_version=True,
                        sync_id=sync_id
                    ))
                    continue

                # Rule 2: Not in Public -> Check Virtual Evidence
                forensic_rec = forensic_map.get(st.id)
                has_virtual_evidence = (forensic_rec is not None and forensic_rec.verification_status == "VERIFIED_ATTENDED")

                if has_virtual_evidence:
                    virtual_count += 1
                    records_to_insert.append(PreviousWeekParticipationRecord(
                        session_id=session_id,
                        contest_id=str(session.id),
                        contest_slug=contest_slug,
                        contest_title=contest_title,
                        student_id=st.id,
                        leetcode_username=raw_user,
                        participation_type="VIRTUAL",
                        problems_solved=forensic_rec.problems_solved if (forensic_rec and forensic_rec.problems_solved) else 1,
                        source="leetcode_contest_history",
                        verification_status="VERIFIED",
                        dataset_version=next_version,
                        is_active_version=True,
                        sync_id=sync_id
                    ))
                    continue

                # Rule 3: Confirmed Verified Absent -> NOT_PARTICIPATED
                if forensic_rec and forensic_rec.verification_status == "VERIFIED_ABSENT":
                    not_participated_count += 1
                    records_to_insert.append(PreviousWeekParticipationRecord(
                        session_id=session_id,
                        contest_id=str(session.id),
                        contest_slug=contest_slug,
                        contest_title=contest_title,
                        student_id=st.id,
                        leetcode_username=raw_user,
                        participation_type="NOT_PARTICIPATED",
                        source="leetcode_contest_history",
                        verification_status="VERIFIED",
                        dataset_version=next_version,
                        is_active_version=True,
                        sync_id=sync_id
                    ))
                    continue

                # Rule 4: Otherwise -> NOT_VERIFIED
                not_verified_count += 1
                records_to_insert.append(PreviousWeekParticipationRecord(
                    session_id=session_id,
                    contest_id=str(session.id),
                    contest_slug=contest_slug,
                    contest_title=contest_title,
                    student_id=st.id,
                    leetcode_username=raw_user,
                    participation_type="NOT_VERIFIED",
                    source="unverified_status",
                    verification_status="VERIFICATION_REQUIRED",
                    dataset_version=next_version,
                    is_active_version=True,
                    sync_id=sync_id
                ))

            # Step 3: Atomic Versioned Dataset Swap
            try:
                # Mark previous dataset version records as superseded
                db.query(PreviousWeekParticipationRecord).filter(
                    PreviousWeekParticipationRecord.session_id == session_id,
                    PreviousWeekParticipationRecord.is_active_version == True
                ).update({"is_active_version": False}, synchronize_session=False)

                # Bulk insert new active version records
                if records_to_insert:
                    db.bulk_save_objects(records_to_insert)

                in_progress_audit.matched_students = public_count
                in_progress_audit.missing_username_count = missing_username_count
                in_progress_audit.validation_status = "VERIFIED"
                in_progress_audit.publish_status = "PUBLISHED"
                in_progress_audit.dataset_version = next_version

                db.commit()
                logger.info(f"[PreviousWeekAnalyzer] Successfully published Previous Week Version {next_version} (Public: {public_count}, Virtual: {virtual_count}, Not Participated: {not_participated_count}, Not Verified: {not_verified_count}, Missing Username: {missing_username_count}).")

                return True, {
                    "sync_id": sync_id,
                    "session_id": session_id,
                    "contest_slug": contest_slug,
                    "dataset_version": next_version,
                    "validation_status": "VERIFIED",
                    "publish_status": "PUBLISHED",
                    "total_students": len(students),
                    "public_count": public_count,
                    "virtual_count": virtual_count,
                    "not_participated_count": not_participated_count,
                    "not_verified_count": not_verified_count,
                    "missing_username_count": missing_username_count
                }
            except SQLAlchemyError as e:
                db.rollback()
                logger.error(f"[PreviousWeekAnalyzer] DB Error during atomic versioned publishing: {e}")
                in_progress_audit.publish_status = "DO_NOT_PUBLISH"
                in_progress_audit.validation_status = "VERIFICATION_REQUIRED"
                in_progress_audit.failure_reason = f"Database transaction failed: {e}"
                db.add(in_progress_audit)
                db.commit()
                return False, {"error": f"Database transaction failed: {e}"}

    @classmethod
    def get_previous_week_participation_role_scoped(
        cls,
        db: Session,
        current_user: Any,
        participation_type: Optional[str] = None,
        department_id: Optional[int] = None,
        year_level: Optional[str] = None,
        section_id: Optional[int] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 50
    ) -> Dict[str, Any]:
        """
        Role-scoped server-side query for Previous Week Participation records (Active Version Only).
        Enforces server-side authorization:
        - Staff: Assigned students ONLY.
        - HOD: Authorized department ONLY.
        - Student: Self ONLY.
        - Admin / Principal: Authorized institutional access.
        """
        meta_info = cls.get_previous_week_metadata(db)
        session_id = meta_info.get("session_id")
        if not session_id:
            return {"total": 0, "page": page, "page_size": page_size, "records": []}

        authorized_ids = get_authorized_student_ids(db, current_user) if current_user else None

        query = db.query(PreviousWeekParticipationRecord).join(
            Student, PreviousWeekParticipationRecord.student_id == Student.id
        ).filter(
            PreviousWeekParticipationRecord.session_id == session_id,
            PreviousWeekParticipationRecord.is_active_version == True
        )

        if authorized_ids is not None:
            if not authorized_ids:
                return {"total": 0, "page": page, "page_size": page_size, "records": []}
            query = query.filter(PreviousWeekParticipationRecord.student_id.in_(authorized_ids))

        if participation_type:
            query = query.filter(PreviousWeekParticipationRecord.participation_type == participation_type.strip().upper())

        if department_id:
            query = query.filter(Student.department_id == department_id)
        if year_level:
            query = query.filter(Student.year_level == year_level)
        if section_id:
            query = query.filter(Student.section_id == section_id)

        if search and search.strip():
            s = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Student.name.ilike(s),
                    Student.reg_no.ilike(s),
                    Student.username.ilike(s)
                )
            )

        total_count = query.count()
        offset = (page - 1) * page_size
        results = query.order_by(
            PreviousWeekParticipationRecord.official_rank.asc().nulls_last(),
            Student.name.asc()
        ).offset(offset).limit(page_size).all()

        records = []
        for rec in results:
            records.append({
                "id": rec.id,
                "student_id": rec.student_id,
                "reg_no": rec.student.reg_no,
                "student_name": rec.student.name,
                "department": rec.student.department.code if rec.student.department else "N/A",
                "year_level": rec.student.year_level,
                "leetcode_username": rec.leetcode_username or rec.student.username,
                "participation_type": rec.participation_type,
                "official_rank": rec.official_rank,
                "official_score": rec.official_score,
                "q1": rec.q1 or 0,
                "q2": rec.q2 or 0,
                "q3": rec.q3 or 0,
                "q4": rec.q4 or 0,
                "problems_solved": rec.problems_solved,
                "finish_time": rec.finish_time,
                "source": rec.source,
                "verification_status": rec.verification_status,
                "verified_at": rec.verified_at.isoformat() + "Z" if rec.verified_at else None
            })

        return {
            "meta": meta_info,
            "total": total_count,
            "page": page,
            "page_size": page_size,
            "records": records
        }

    @classmethod
    def get_previous_week_summary_role_scoped(
        cls,
        db: Session,
        current_user: Any
    ) -> Dict[str, Any]:
        """
        Generates role-scoped summary statistics for Previous Week Contest.
        Guarantees mathematical reconciliation:
        PUBLIC + VIRTUAL + NOT_PARTICIPATED + NOT_VERIFIED + MISSING_LEETCODE_USERNAME == AUTHORIZED_STUDENTS
        """
        meta_info = cls.get_previous_week_metadata(db)
        session_id = meta_info.get("session_id")
        if not session_id:
            return {"error": "Previous week session not found."}

        authorized_ids = get_authorized_student_ids(db, current_user) if current_user else None

        base_query = db.query(PreviousWeekParticipationRecord).join(
            Student, PreviousWeekParticipationRecord.student_id == Student.id
        ).filter(
            PreviousWeekParticipationRecord.session_id == session_id,
            PreviousWeekParticipationRecord.is_active_version == True
        )

        if authorized_ids is not None:
            if not authorized_ids:
                return {
                    "meta": meta_info,
                    "total_students": 0,
                    "public": 0,
                    "virtual": 0,
                    "not_participated": 0,
                    "not_verified": 0,
                    "missing_username": 0,
                    "department_breakdown": []
                }
            base_query = base_query.filter(PreviousWeekParticipationRecord.student_id.in_(authorized_ids))

        all_recs = base_query.all()

        public_c = sum(1 for r in all_recs if r.participation_type == "PUBLIC")
        virtual_c = sum(1 for r in all_recs if r.participation_type == "VIRTUAL")
        not_part_c = sum(1 for r in all_recs if r.participation_type == "NOT_PARTICIPATED")
        not_ver_c = sum(1 for r in all_recs if r.participation_type == "NOT_VERIFIED")
        missing_u_c = sum(1 for r in all_recs if r.participation_type == "MISSING_LEETCODE_USERNAME")

        # Group by department & year
        dept_map: Dict[str, Dict[str, Any]] = {}
        for r in all_recs:
            dept_code = r.student.department.code if (r.student and r.student.department) else "OTHER"
            year = r.student.year_level or "N/A"
            key = f"{dept_code} | Year {year}"

            if key not in dept_map:
                dept_map[key] = {
                    "group": key,
                    "department": dept_code,
                    "year_level": year,
                    "total": 0,
                    "public": 0,
                    "virtual": 0,
                    "not_participated": 0,
                    "not_verified": 0,
                    "missing_username": 0
                }

            dept_map[key]["total"] += 1
            pt = r.participation_type
            if pt == "PUBLIC":
                dept_map[key]["public"] += 1
            elif pt == "VIRTUAL":
                dept_map[key]["virtual"] += 1
            elif pt == "NOT_PARTICIPATED":
                dept_map[key]["not_participated"] += 1
            elif pt == "NOT_VERIFIED":
                dept_map[key]["not_verified"] += 1
            elif pt == "MISSING_LEETCODE_USERNAME":
                dept_map[key]["missing_username"] += 1

        return {
            "meta": meta_info,
            "total_students": len(all_recs),
            "public": public_c,
            "virtual": virtual_c,
            "not_participated": not_part_c,
            "not_verified": not_ver_c,
            "missing_username": missing_u_c,
            "department_breakdown": list(dept_map.values())
        }
