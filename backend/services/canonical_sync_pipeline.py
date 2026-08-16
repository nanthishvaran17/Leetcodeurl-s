"""
canonical_sync_pipeline.py — Single Canonical Dataset Pipeline for LeetCode Sync.

Architecture:
1. Batched processing across data types (Phases A -> B -> C -> D -> E).
2. Rate-limit aware with httpx async client & semaphore bounds.
3. State machine per student:
   PENDING_USERNAME -> VERIFYING -> PROFILE_VERIFIED -> SYNCING -> SYNCED / PARTIAL_SYNC / FETCH_FAILED / INVALID_USERNAME / IDENTITY_MISMATCH
4. Writes to normalized database tables (lc_profiles, lc_problem_stats, lc_contest_standing,
   lc_contest_rating_history, lc_badges, lc_language_stats, lc_topic_stats, lc_activity, lc_submissions)
   AND updates compatibility shim LeetCodeProfileStats.
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


async def run_full_pipeline(
    job_id: Optional[str] = None,
    student_ids: Optional[List[int]] = None,
    progress_callback: Optional[Any] = None,
    run_optional_phases: bool = True
) -> Dict[str, Any]:
    """
    Executes the full canonical sync pipeline for all active students (or specified student_ids).
    Returns comprehensive summary dict for audit and logging.
    """
    start_time = datetime.datetime.utcnow()
    db = SessionLocal()

    try:
        # Load students
        query = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None)))
        if student_ids:
            query = query.filter(Student.id.in_(student_ids))
        students = query.all()

        total_students = len(students)
        logger.info(f"[CANONICAL_PIPELINE] Starting full pipeline for {total_students} students (Job ID: {job_id or 'manual'})")

        if progress_callback and hasattr(progress_callback, "start"):
            progress_callback.start(job_id or f"canonical-{int(start_time.timestamp())}", total_students)

        timeout_cfg = httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=5.0)
        limits_cfg = httpx.Limits(max_keepalive_connections=15, max_connections=30)

        async with httpx.AsyncClient(timeout=timeout_cfg, limits=limits_cfg, follow_redirects=True, http2=False) as client:

            # ── PHASE A: Identity Verification & Core Stats (All Students) ────────────────
            logger.info("[CANONICAL_PIPELINE] Phase A: Verifying profile identities and fetching problem stats...")
            phase_a_results = {}
            sem_a = asyncio.Semaphore(15)

            async def _process_phase_a(student: Student):
                async with sem_a:
                    c_username, c_url, u_status = extract_leetcode_username(student.username or student.leetcode_url)
                    if u_status != "OK" or not c_username:
                        return student.id, {"status": "pending_username", "username": None, "detail": u_status}

                    res = await fetch_profile_and_stats(c_username, client)
                    await asyncio.sleep(0.15) # Rate limit padding
                    return student.id, res

            tasks_a = [_process_phase_a(s) for s in students]
            raw_a = await asyncio.gather(*tasks_a)
            for st_id, res in raw_a:
                phase_a_results[st_id] = res

            # Persist Phase A to DB
            verified_students = []
            now_dt = datetime.datetime.utcnow()

            for student in students:
                st_id = student.id
                res = phase_a_results.get(st_id, {})
                status = res.get("status")

                lc_prof = db.query(LeetCodeProfile).filter(LeetCodeProfile.student_id == st_id).first()
                if not lc_prof:
                    lc_prof = LeetCodeProfile(student_id=st_id)
                    db.add(lc_prof)

                lc_stats = db.query(LeetCodeProblemStats).filter(LeetCodeProblemStats.student_id == st_id).first()
                if not lc_stats:
                    lc_stats = LeetCodeProblemStats(student_id=st_id)
                    db.add(lc_stats)

                # Compatibility shim update
                shim_stats = db.query(LeetCodeProfileStats).filter(LeetCodeProfileStats.student_id == st_id).first()
                if not shim_stats:
                    shim_stats = LeetCodeProfileStats(student_id=st_id)
                    db.add(shim_stats)

                lc_prof.last_attempted_at = now_dt

                if status == "pending_username":
                    lc_prof.verification_status = "PENDING_USERNAME"
                    lc_prof.sync_state = "PENDING_USERNAME"
                    lc_prof.canonical_username = None
                    lc_prof.profile_url = None
                    shim_stats.status = "MISSING LINK"
                    shim_stats.sync_status = "pending"

                elif status == "not_found":
                    lc_prof.verification_status = "INVALID_USERNAME"
                    lc_prof.sync_state = "INVALID_USERNAME"
                    lc_prof.error_code = "404_NOT_FOUND"
                    lc_prof.error_message = "LeetCode username does not resolve to a public profile"
                    shim_stats.status = "INVALID_USERNAME"
                    shim_stats.sync_status = "failed"
                    shim_stats.error_code = "PROFILE_NOT_FOUND"

                elif status == "identity_mismatch":
                    lc_prof.verification_status = "IDENTITY_MISMATCH"
                    lc_prof.sync_state = "IDENTITY_MISMATCH"
                    lc_prof.error_code = "IDENTITY_MISMATCH"
                    lc_prof.error_message = res.get("detail")
                    shim_stats.status = "IDENTITY_MISMATCH"
                    shim_stats.sync_status = "mismatch"
                    shim_stats.error_code = "MISMATCH"

                elif status == "ok" and res.get("data"):
                    data = res["data"]
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
                    lc_prof.sync_state = "SYNCING"
                    lc_prof.last_verified_at = now_dt
                    lc_prof.error_code = None
                    lc_prof.error_message = None

                    # Update student.username and leetcode_url if canonical username updated
                    student.username = c_user
                    student.leetcode_url = data["profile_url"]

                    # Update Problem Stats
                    lc_stats.total_solved = data.get("total_solved")
                    lc_stats.easy_solved = data.get("easy_solved")
                    lc_stats.medium_solved = data.get("medium_solved")
                    lc_stats.hard_solved = data.get("hard_solved")
                    lc_stats.profile_global_ranking = data.get("profile_global_ranking")
                    lc_stats.fetched_at = now_dt

                    # Update Compatibility Shim
                    shim_stats.total_solved = data.get("total_solved")
                    shim_stats.easy_solved = data.get("easy_solved")
                    shim_stats.medium_solved = data.get("medium_solved")
                    shim_stats.hard_solved = data.get("hard_solved")
                    shim_stats.public_profile_ranking = data.get("profile_global_ranking")
                    shim_stats.status = "verified"
                    shim_stats.sync_status = "success"
                    shim_stats.validation_status = "verified"
                    shim_stats.last_successful_sync = now_dt
                    shim_stats.last_verified_at = now_dt

                    # Persist Badges
                    for b in data.get("badges", []):
                        badge_id = b["badge_id"]
                        if not badge_id:
                            continue
                        existing_badge = db.query(LeetCodeBadge).filter(
                            LeetCodeBadge.student_id == st_id, LeetCodeBadge.badge_id == badge_id
                        ).first()
                        if not existing_badge:
                            existing_badge = LeetCodeBadge(student_id=st_id, badge_id=badge_id)
                            db.add(existing_badge)
                        existing_badge.display_name = b.get("display_name")
                        existing_badge.icon_url = b.get("icon_url")

                    # Persist Languages
                    for lang in data.get("languages", []):
                        l_name = lang["language_name"]
                        if not l_name:
                            continue
                        existing_lang = db.query(LeetCodeLanguageStats).filter(
                            LeetCodeLanguageStats.student_id == st_id, LeetCodeLanguageStats.language_name == l_name
                        ).first()
                        if not existing_lang:
                            existing_lang = LeetCodeLanguageStats(student_id=st_id, language_name=l_name)
                            db.add(existing_lang)
                        existing_lang.problems_solved = lang.get("problems_solved", 0)
                        existing_lang.fetched_at = now_dt

                    verified_students.append(student)
                else:
                    lc_prof.sync_state = "FETCH_FAILED"
                    lc_prof.error_code = status.upper() if status else "FETCH_FAILED"
                    lc_prof.error_message = res.get("detail", "Fetch failed during Phase A")
                    shim_stats.status = "FETCH_FAILED"
                    shim_stats.sync_status = "failed"
                    shim_stats.error_code = "NETWORK_ERROR"

            db.commit()
            logger.info(f"[CANONICAL_PIPELINE] Phase A complete: {len(verified_students)} verified profiles ready for Phase B.")

            # ── PHASE B: Contest Standing & Rating History (Verified Students Only) ───────
            logger.info("[CANONICAL_PIPELINE] Phase B: Fetching contest standings and rating history...")
            phase_b_results = {}
            sem_b = asyncio.Semaphore(12)

            async def _process_phase_b(student: Student):
                async with sem_b:
                    lc_prof = db.query(LeetCodeProfile).filter(LeetCodeProfile.student_id == student.id).first()
                    username = lc_prof.canonical_username if lc_prof else student.username
                    if not username:
                        return student.id, {"status": "error", "data": None}
                    res = await fetch_contest_data(username, client)
                    await asyncio.sleep(0.2)
                    return student.id, res

            tasks_b = [_process_phase_b(s) for s in verified_students]
            raw_b = await asyncio.gather(*tasks_b)
            for st_id, res in raw_b:
                phase_b_results[st_id] = res

            # Persist Phase B
            for student in verified_students:
                st_id = student.id
                res = phase_b_results.get(st_id, {})
                status = res.get("status")

                lc_contest = db.query(LeetCodeContest).filter(LeetCodeContest.student_id == st_id).first()
                if not lc_contest:
                    lc_contest = LeetCodeContest(student_id=st_id)
                    db.add(lc_contest)

                shim_stats = db.query(LeetCodeProfileStats).filter(LeetCodeProfileStats.student_id == st_id).first()

                if status == "ok" and res.get("data"):
                    data = res["data"]
                    lc_contest.contest_rating = data.get("contest_rating")
                    lc_contest.contest_global_ranking = data.get("contest_global_ranking")
                    lc_contest.attended_count = data.get("attended_count")
                    lc_contest.top_percentage = data.get("top_percentage")
                    lc_contest.most_recent_contest_name = data.get("most_recent_contest_name")
                    lc_contest.most_recent_contest_type = data.get("most_recent_contest_type")
                    lc_contest.fetched_at = now_dt

                    if shim_stats:
                        shim_stats.contest_rating = data.get("contest_rating")
                        shim_stats.contest_global_ranking = data.get("contest_global_ranking")

                    # Append Rating History
                    for hist in data.get("history", []):
                        c_name = hist["contest_name"]
                        if not c_name:
                            continue
                        is_att = hist["attended"]
                        existing_hist = db.query(LeetCodeContestRatingHistory).filter(
                            LeetCodeContestRatingHistory.student_id == st_id,
                            LeetCodeContestRatingHistory.contest_name == c_name,
                            LeetCodeContestRatingHistory.attended == is_att
                        ).first()
                        if not existing_hist:
                            existing_hist = LeetCodeContestRatingHistory(
                                student_id=st_id,
                                contest_name=c_name,
                                attended=is_att
                            )
                            db.add(existing_hist)
                        existing_hist.contest_type = hist.get("contest_type")
                        existing_hist.contest_start_time = hist.get("contest_start_time")
                        existing_hist.problems_solved = hist.get("problems_solved", 0)
                        existing_hist.total_problems = hist.get("total_problems", 4)
                        existing_hist.finish_time_seconds = hist.get("finish_time_seconds")
                        existing_hist.contest_rank = hist.get("contest_rank")
                        existing_hist.rating_after = hist.get("rating_after")

            db.commit()
            logger.info("[CANONICAL_PIPELINE] Phase B complete: Contest standing and history persisted.")

            # ── PHASES C, D, E: Optional / Volatile Datasets ─────────────────────────────
            if run_optional_phases and verified_students:
                logger.info("[CANONICAL_PIPELINE] Phases C, D, E: Fetching topic stats, activity calendar, and recent submissions...")

                sem_opt = asyncio.Semaphore(5)

                async def _process_optional(student: Student):
                    async with sem_opt:
                        lc_prof = db.query(LeetCodeProfile).filter(LeetCodeProfile.student_id == student.id).first()
                        username = lc_prof.canonical_username if lc_prof else student.username
                        if not username:
                            return student.id, None, None, None

                        topic_res = await fetch_topic_stats(username, client, retries=2, backoff_base=1.2)
                        await asyncio.sleep(0.1)

                        cal_res = await fetch_activity_calendar(username, client, retries=2, backoff_base=1.2)
                        await asyncio.sleep(0.1)

                        sub_res = await fetch_recent_submissions(username, client, limit=20, retries=2, backoff_base=1.2)
                        await asyncio.sleep(0.1)

                        return student.id, topic_res, cal_res, sub_res

                opt_tasks = [_process_optional(s) for s in verified_students]
                opt_raw = await asyncio.gather(*opt_tasks, return_exceptions=True)

                for item in opt_raw:
                    if isinstance(item, Exception) or not isinstance(item, tuple) or len(item) != 4:
                        continue
                    st_id, topic_res, cal_res, sub_res = item
                    # Persist Topics (Phase C)
                    if isinstance(topic_res, dict) and topic_res.get("status") == "ok":
                        for top in topic_res.get("data", {}).get("topics", []):
                            t_slug = top["topic_slug"]
                            if not t_slug:
                                continue
                            existing_top = db.query(LeetCodeTopicStats).filter(
                                LeetCodeTopicStats.student_id == st_id, LeetCodeTopicStats.topic_slug == t_slug
                            ).first()
                            if not existing_top:
                                existing_top = LeetCodeTopicStats(student_id=st_id, topic_slug=t_slug)
                                db.add(existing_top)
                            existing_top.topic_name = top.get("topic_name")
                            existing_top.topic_tier = top.get("topic_tier")
                            existing_top.problems_solved = top.get("problems_solved", 0)
                            existing_top.fetched_at = now_dt

                    # Persist Activity & Calendar (Phase D)
                    if isinstance(cal_res, dict) and cal_res.get("status") == "ok":
                        cal_data = cal_res.get("data", {})
                        lc_act = db.query(LeetCodeActivity).filter(LeetCodeActivity.student_id == st_id).first()
                        if not lc_act:
                            lc_act = LeetCodeActivity(student_id=st_id)
                            db.add(lc_act)
                        lc_act.submission_calendar_json = cal_data.get("submission_calendar_json")
                        lc_act.total_active_days = cal_data.get("total_active_days")
                        lc_act.current_streak = cal_data.get("current_streak")
                        lc_act.longest_streak = cal_data.get("longest_streak")
                        lc_act.fetched_at = now_dt

                        shim_stats = db.query(LeetCodeProfileStats).filter(LeetCodeProfileStats.student_id == st_id).first()
                        if shim_stats:
                            shim_stats.active_days = cal_data.get("total_active_days")
                            shim_stats.max_streak = cal_data.get("longest_streak")

                    # Persist Recent Submissions (Phase E)
                    if isinstance(sub_res, dict) and sub_res.get("status") == "ok":
                        for sub in sub_res.get("data", {}).get("submissions", []):
                            t_slug = sub["title_slug"]
                            sub_ts = sub.get("submission_timestamp")
                            if not t_slug or not sub_ts:
                                continue
                            existing_sub = db.query(LeetCodeSubmission).filter(
                                LeetCodeSubmission.student_id == st_id,
                                LeetCodeSubmission.title_slug == t_slug,
                                LeetCodeSubmission.submission_timestamp == sub_ts
                            ).first()
                            if not existing_sub:
                                existing_sub = LeetCodeSubmission(
                                    student_id=st_id,
                                    title_slug=t_slug,
                                    submission_timestamp=sub_ts
                                )
                                db.add(existing_sub)
                            existing_sub.title = sub.get("title")
                            existing_sub.lang = sub.get("lang")
                            existing_sub.status_display = sub.get("status_display")
                            existing_sub.runtime_display = sub.get("runtime_display")
                            existing_sub.memory_display = sub.get("memory_display")

                db.commit()
                logger.info("[CANONICAL_PIPELINE] Phases C, D, E complete: Optional datasets persisted.")

        # ── FINAL STATE EVALUATION & RANKINGS REFRESH ─────────────────────────────────
        synced_count = 0
        partial_count = 0
        failed_count = 0
        invalid_count = 0
        pending_count = 0
        mismatch_count = 0

        for student in students:
            lc_prof = db.query(LeetCodeProfile).filter(LeetCodeProfile.student_id == student.id).first()
            if not lc_prof:
                continue

            status = lc_prof.verification_status
            if status == "PENDING_USERNAME":
                pending_count += 1
            elif status == "INVALID_USERNAME":
                invalid_count += 1
            elif status == "IDENTITY_MISMATCH":
                mismatch_count += 1
            elif status == "PROFILE_VERIFIED":
                # Check if core problem stats present
                p_stats = db.query(LeetCodeProblemStats).filter(LeetCodeProblemStats.student_id == student.id).first()
                if p_stats and p_stats.total_solved is not None:
                    lc_prof.sync_state = "SYNCED"
                    lc_prof.last_synced_at = datetime.datetime.utcnow()
                    synced_count += 1
                else:
                    lc_prof.sync_state = "PARTIAL_SYNC"
                    partial_count += 1
            else:
                failed_count += 1

        db.commit()

        # Recalculate institutional rankings
        logger.info("[CANONICAL_PIPELINE] Recalculating college/department/year rankings...")
        update_all_rankings_and_badges(db)

        # Clear global caches to ensure instant UI freshness
        cache.clear()

        end_time = datetime.datetime.utcnow()
        duration_sec = round((end_time - start_time).total_seconds(), 2)

        summary = {
            "job_id": job_id,
            "total_students": total_students,
            "profile_verified": len(verified_students),
            "full_dataset_synced": synced_count,
            "partial_sync": partial_count,
            "pending_username": pending_count,
            "invalid_username": invalid_count,
            "identity_mismatch": mismatch_count,
            "fetch_failed": failed_count,
            "duration_seconds": duration_sec,
            "completed_at": end_time.isoformat()
        }

        if progress_callback and hasattr(progress_callback, "finish"):
            progress_callback.finish("COMPLETED")

        logger.info(f"[CANONICAL_PIPELINE] Sync complete in {duration_sec}s. Synced={synced_count}, Invalid={invalid_count}, Pending={pending_count}, Failed={failed_count}")
        return summary

    except Exception as exc:
        logger.error(f"[CANONICAL_PIPELINE] Critical pipeline error: {exc}", exc_info=True)
        if progress_callback and hasattr(progress_callback, "finish"):
            progress_callback.finish("FAILED", str(exc))
        raise
    finally:
        db.close()
