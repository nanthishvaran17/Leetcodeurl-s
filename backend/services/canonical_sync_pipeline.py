"""
canonical_sync_pipeline.py — Single Canonical Dataset Pipeline for LeetCode Sync.

True Real-Time Per-Student Streaming Pipeline:
1. Bounded concurrency (Semaphore(8)) with asynchronous per-student lifecycle.
2. Immediate DB persistence per student upon fetch completion.
3. Immediate WebSocket broadcast of `sync_progress` event for every finished student.
4. Increments processed strictly when reaching a terminal state.
5. In-memory tracking of recent completed students for real-time UI feed.
"""

import asyncio
import datetime
import httpx
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.models import (
    Student,
    LeetCodeProfile,
    LeetCodeProblemStats,
    LeetCodeContest,
    LeetCodeContestRatingHistory,
    LeetCodeBadge,
    LeetCodeLanguageStats,
    LeetCodeTopicStats,
    LeetCodeActivity,
    LeetCodeSubmission,
    LeetCodeProfileStats,
    SyncJob,
)
from backend.leetcode_fetcher import (
    extract_leetcode_username,
    fetch_profile_and_stats,
    fetch_contest_data,
    fetch_topic_stats,
    fetch_activity_calendar,
    fetch_recent_submissions,
)
from backend.ranking import update_all_rankings_and_badges
from backend.cache import cache
from backend.logger import logger


async def _sync_single_student_canonical(
    student: Student,
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    lock: asyncio.Lock,
    job_id: str,
    progress_callback: Optional[Any],
    run_optional_phases: bool = False
):
    async with sem:
        now_dt = datetime.datetime.utcnow()
        db_student = SessionLocal()
        try:
            st = db_student.query(Student).filter(Student.id == student.id).first()
            if not st:
                return

            c_username, c_url, u_status = extract_leetcode_username(st.username or st.leetcode_url)

            lc_prof = db_student.query(LeetCodeProfile).filter(LeetCodeProfile.student_id == st.id).first()
            if not lc_prof:
                lc_prof = LeetCodeProfile(student_id=st.id)
                db_student.add(lc_prof)

            lc_stats = db_student.query(LeetCodeProblemStats).filter(LeetCodeProblemStats.student_id == st.id).first()
            if not lc_stats:
                lc_stats = LeetCodeProblemStats(student_id=st.id)
                db_student.add(lc_stats)

            shim_stats = db_student.query(LeetCodeProfileStats).filter(LeetCodeProfileStats.student_id == st.id).first()
            if not shim_stats:
                shim_stats = LeetCodeProfileStats(student_id=st.id)
                db_student.add(shim_stats)

            lc_prof.last_attempted_at = now_dt

            status_code = "PENDING_USERNAME"
            total_solved = None
            easy_solved = None
            medium_solved = None
            hard_solved = None
            contest_rating = None
            sync_status_str = "pending"
            error_msg = None

            if u_status != "OK" or not c_username:
                lc_prof.verification_status = "PENDING_USERNAME"
                lc_prof.sync_state = "PENDING_USERNAME"
                lc_prof.canonical_username = None
                lc_prof.profile_url = None
                shim_stats.status = "MISSING LINK"
                shim_stats.sync_status = "pending"
                status_code = "PENDING_USERNAME"
                sync_status_str = "pending"
            else:
                # Phase A: Core Profile & Problem Stats
                res_a = await fetch_profile_and_stats(c_username, client)
                await asyncio.sleep(0.08)

                phase_a_status = res_a.get("status")

                if phase_a_status == "not_found":
                    lc_prof.verification_status = "INVALID_USERNAME"
                    lc_prof.sync_state = "INVALID_USERNAME"
                    lc_prof.error_code = "404_NOT_FOUND"
                    lc_prof.error_message = "LeetCode username does not resolve to a public profile"
                    shim_stats.status = "INVALID_USERNAME"
                    shim_stats.sync_status = "failed"
                    shim_stats.error_code = "PROFILE_NOT_FOUND"
                    status_code = "INVALID_USERNAME"
                    sync_status_str = "failed"
                    error_msg = "Profile not found (404)"

                elif phase_a_status == "identity_mismatch":
                    lc_prof.verification_status = "IDENTITY_MISMATCH"
                    lc_prof.sync_state = "IDENTITY_MISMATCH"
                    lc_prof.error_code = "IDENTITY_MISMATCH"
                    lc_prof.error_message = res_a.get("detail")
                    shim_stats.status = "IDENTITY_MISMATCH"
                    shim_stats.sync_status = "mismatch"
                    shim_stats.error_code = "MISMATCH"
                    status_code = "IDENTITY_MISMATCH"
                    sync_status_str = "mismatch"
                    error_msg = res_a.get("detail")

                elif phase_a_status == "ok" and res_a.get("data"):
                    data = res_a["data"]
                    c_user = data["canonical_username"]
                    lc_prof.canonical_username = c_user
                    lc_prof.profile_url = data["profile_url"]
                    lc_prof.real_name = data.get("real_name")
                    lc_prof.avatar_url = data.get("avatar_url")
                    lc_prof.about_me = data.get("about_me")
                    lc_prof.school = data.get("school")
                    lc_prof.company = data.get("company")
                    lc_prof.country = data.get("country")
                    lc_prof.reputation = data.get("reputation")
                    lc_prof.verification_status = "PROFILE_VERIFIED"
                    lc_prof.sync_state = "SYNCED"
                    lc_prof.last_verified_at = now_dt
                    lc_prof.last_synced_at = now_dt
                    lc_prof.error_code = None
                    lc_prof.error_message = None

                    st.username = c_user
                    st.leetcode_url = data["profile_url"]

                    total_solved = data.get("total_solved")
                    easy_solved = data.get("easy_solved")
                    medium_solved = data.get("medium_solved")
                    hard_solved = data.get("hard_solved")

                    lc_stats.total_solved = total_solved
                    lc_stats.easy_solved = easy_solved
                    lc_stats.medium_solved = medium_solved
                    lc_stats.hard_solved = hard_solved
                    lc_stats.profile_global_ranking = data.get("profile_global_ranking")
                    lc_stats.fetched_at = now_dt

                    shim_stats.total_solved = total_solved
                    shim_stats.easy_solved = easy_solved
                    shim_stats.medium_solved = medium_solved
                    shim_stats.hard_solved = hard_solved
                    shim_stats.public_profile_ranking = data.get("profile_global_ranking")
                    shim_stats.status = "verified"
                    shim_stats.sync_status = "success"
                    shim_stats.validation_status = "verified"
                    shim_stats.last_successful_sync = now_dt
                    shim_stats.last_verified_at = now_dt

                    # Badges
                    for b in data.get("badges", []):
                        badge_id = b.get("badge_id")
                        if badge_id:
                            existing_b = db_student.query(LeetCodeBadge).filter(
                                LeetCodeBadge.student_id == st.id, LeetCodeBadge.badge_id == badge_id
                            ).first()
                            if not existing_b:
                                existing_b = LeetCodeBadge(student_id=st.id, badge_id=badge_id)
                                db_student.add(existing_b)
                            existing_b.display_name = b.get("display_name")
                            existing_b.icon_url = b.get("icon_url")

                    # Languages
                    for lang in data.get("languages", []):
                        l_name = lang.get("language_name")
                        if l_name:
                            existing_l = db_student.query(LeetCodeLanguageStats).filter(
                                LeetCodeLanguageStats.student_id == st.id, LeetCodeLanguageStats.language_name == l_name
                            ).first()
                            if not existing_l:
                                existing_l = LeetCodeLanguageStats(student_id=st.id, language_name=l_name)
                                db_student.add(existing_l)
                            existing_l.problems_solved = lang.get("problems_solved", 0)
                            existing_l.fetched_at = now_dt

                    # Phase B: Contest Standings & Rating History
                    res_b = await fetch_contest_data(c_user, client)
                    await asyncio.sleep(0.08)

                    if res_b.get("status") == "ok" and res_b.get("data"):
                        c_data = res_b["data"]
                        contest_rating = c_data.get("contest_rating")

                        lc_contest = db_student.query(LeetCodeContest).filter(LeetCodeContest.student_id == st.id).first()
                        if not lc_contest:
                            lc_contest = LeetCodeContest(student_id=st.id)
                            db_student.add(lc_contest)

                        lc_contest.contest_rating = contest_rating
                        lc_contest.contest_global_ranking = c_data.get("contest_global_ranking")
                        lc_contest.attended_count = c_data.get("attended_count")
                        lc_contest.top_percentage = c_data.get("top_percentage")
                        lc_contest.most_recent_contest_name = c_data.get("most_recent_contest_name")
                        lc_contest.most_recent_contest_type = c_data.get("most_recent_contest_type")
                        lc_contest.fetched_at = now_dt

                        shim_stats.contest_rating = contest_rating
                        shim_stats.contest_global_ranking = c_data.get("contest_global_ranking")
                        shim_stats.recent_contest_name = c_data.get("most_recent_contest_name")

                        for hist in c_data.get("history", []):
                            c_name = hist.get("contest_name")
                            if not c_name:
                                continue
                            is_att = hist.get("attended", False)
                            existing_hist = db_student.query(LeetCodeContestRatingHistory).filter(
                                LeetCodeContestRatingHistory.student_id == st.id,
                                LeetCodeContestRatingHistory.contest_name == c_name,
                                LeetCodeContestRatingHistory.attended == is_att
                            ).first()
                            if not existing_hist:
                                existing_hist = LeetCodeContestRatingHistory(
                                    student_id=st.id,
                                    contest_name=c_name,
                                    attended=is_att
                                )
                                db_student.add(existing_hist)
                            existing_hist.contest_type = hist.get("contest_type")
                            existing_hist.contest_start_time = hist.get("contest_start_time")
                            existing_hist.problems_solved = hist.get("problems_solved", 0)
                            existing_hist.total_problems = hist.get("total_problems", 4)
                            existing_hist.finish_time_seconds = hist.get("finish_time_seconds")
                            existing_hist.contest_rank = hist.get("contest_rank")
                            existing_hist.rating_after = hist.get("rating_after")

                    status_code = "SUCCESS"
                    sync_status_str = "success"

                else:
                    lc_prof.sync_state = "FETCH_FAILED"
                    lc_prof.error_code = phase_a_status.upper() if phase_a_status else "FETCH_FAILED"
                    lc_prof.error_message = res_a.get("detail", "Fetch failed during Phase A")
                    shim_stats.status = "FETCH_FAILED"
                    shim_stats.sync_status = "failed"
                    shim_stats.error_code = "NETWORK_ERROR"
                    status_code = "FETCH_FAILED"
                    sync_status_str = "failed"
                    error_msg = res_a.get("detail", "Fetch failed")

            db_student.commit()

            # Record completion in LiveSyncTracker and broadcast progress event immediately
            async with lock:
                from backend.services.live_sync_service import broadcast_sync_event, sync_tracker

                if progress_callback and hasattr(progress_callback, "record_student_completion"):
                    progress_callback.record_student_completion(
                        student_name=st.name,
                        username=st.username or c_username,
                        status=status_code,
                        total_solved=total_solved,
                        contest_rating=contest_rating,
                        reg_no=st.reg_no,
                        error_msg=error_msg
                    )

                payload = {
                    "type": "sync_progress",
                    "job_id": job_id,
                    "processed": sync_tracker.students_processed,
                    "total": sync_tracker.total_students,
                    "successful": sync_tracker.successful,
                    "failed": sync_tracker.failed,
                    "pending": sync_tracker.pending_usernames,
                    "invalid": sync_tracker.invalid,
                    "unknown": sync_tracker.unknown,
                    "current_student": st.name,
                    "current_username": st.username or c_username or "",
                    "current_status": status_code,
                    "progress_percent": sync_tracker.progress_percentage,
                    "recent_completed": sync_tracker.recent_completed,
                    "student_update": {
                        "id": st.id,
                        "reg_no": st.reg_no,
                        "name": st.name,
                        "username": st.username,
                        "total_solved": total_solved,
                        "easy_solved": easy_solved,
                        "medium_solved": medium_solved,
                        "hard_solved": hard_solved,
                        "contest_rating": contest_rating,
                        "status": status_code,
                        "sync_status": sync_status_str
                    },
                    "timestamp": datetime.datetime.utcnow().isoformat()
                }
                await broadcast_sync_event(payload)

        except Exception as st_err:
            logger.error(f"[CANONICAL_PIPELINE] Error syncing student {student.id} ({student.name}): {st_err}", exc_info=True)
            async with lock:
                from backend.services.live_sync_service import broadcast_sync_event, sync_tracker
                if progress_callback and hasattr(progress_callback, "record_student_completion"):
                    progress_callback.record_student_completion(
                        student_name=student.name,
                        username=student.username,
                        status="FETCH_FAILED",
                        total_solved=None,
                        contest_rating=None,
                        reg_no=student.reg_no,
                        error_msg=str(st_err)
                    )
                payload = {
                    "type": "sync_progress",
                    "job_id": job_id,
                    "processed": sync_tracker.students_processed,
                    "total": sync_tracker.total_students,
                    "successful": sync_tracker.successful,
                    "failed": sync_tracker.failed,
                    "pending": sync_tracker.pending_usernames,
                    "invalid": sync_tracker.invalid,
                    "unknown": sync_tracker.unknown,
                    "current_student": student.name,
                    "current_username": student.username or "",
                    "current_status": "FETCH_FAILED",
                    "progress_percent": sync_tracker.progress_percentage,
                    "recent_completed": sync_tracker.recent_completed,
                    "student_update": {
                        "id": student.id,
                        "reg_no": student.reg_no,
                        "name": student.name,
                        "username": student.username,
                        "total_solved": None,
                        "status": "FETCH_FAILED",
                        "sync_status": "failed"
                    },
                    "timestamp": datetime.datetime.utcnow().isoformat()
                }
                await broadcast_sync_event(payload)
        finally:
            db_student.close()


async def run_full_pipeline(
    job_id: Optional[str] = None,
    student_ids: Optional[List[int]] = None,
    progress_callback: Optional[Any] = None,
    run_optional_phases: bool = True
) -> Dict[str, Any]:
    """
    Executes the full canonical sync pipeline for all active students with true real-time streaming progress.
    """
    start_time = datetime.datetime.utcnow()
    db = SessionLocal()

    try:
        query = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None)))
        if student_ids:
            query = query.filter(Student.id.in_(student_ids))
        students = query.all()

        total_students = len(students)
        effective_job_id = job_id or f"SYNC-{int(start_time.timestamp())}"
        logger.info(f"[CANONICAL_PIPELINE] Starting streaming per-student sync for {total_students} students (Job: {effective_job_id})")

        if progress_callback and hasattr(progress_callback, "start"):
            progress_callback.start(effective_job_id, total_students)

        timeout_cfg = httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=5.0)
        limits_cfg = httpx.Limits(max_keepalive_connections=20, max_connections=40)

        sem = asyncio.Semaphore(8)  # Safe bounded concurrency
        lock = asyncio.Lock()

        async with httpx.AsyncClient(timeout=timeout_cfg, limits=limits_cfg, follow_redirects=True, http2=False) as client:
            tasks = [
                _sync_single_student_canonical(
                    student=s,
                    client=client,
                    sem=sem,
                    lock=lock,
                    job_id=effective_job_id,
                    progress_callback=progress_callback,
                    run_optional_phases=run_optional_phases
                )
                for s in students
            ]
            await asyncio.gather(*tasks, return_exceptions=True)

        # Recalculate institutional multi-level rankings
        logger.info("[CANONICAL_PIPELINE] Recalculating college/department/year rankings post-sync...")
        update_all_rankings_and_badges(db)

        # Clear global caches to ensure instant UI freshness
        cache.clear()

        end_time = datetime.datetime.utcnow()
        duration_sec = round((end_time - start_time).total_seconds(), 2)

        from backend.services.live_sync_service import sync_tracker

        summary = {
            "job_id": effective_job_id,
            "total_students": total_students,
            "profile_verified": sync_tracker.successful,
            "full_dataset_synced": sync_tracker.successful,
            "partial_sync": 0,
            "pending_username": sync_tracker.pending_usernames,
            "invalid_username": sync_tracker.invalid,
            "fetch_failed": sync_tracker.failed,
            "duration_seconds": duration_sec,
            "completed_at": end_time.isoformat()
        }

        if progress_callback and hasattr(progress_callback, "finish"):
            progress_callback.finish("COMPLETED")

        logger.info(f"[CANONICAL_PIPELINE] Streaming sync completed in {duration_sec}s. Synced={sync_tracker.successful}, Invalid={sync_tracker.invalid}, Pending={sync_tracker.pending_usernames}, Failed={sync_tracker.failed}")
        return summary

    except Exception as exc:
        logger.error(f"[CANONICAL_PIPELINE] Critical pipeline error: {exc}", exc_info=True)
        if progress_callback and hasattr(progress_callback, "finish"):
            progress_callback.finish("FAILED", str(exc))
        raise
    finally:
        db.close()
