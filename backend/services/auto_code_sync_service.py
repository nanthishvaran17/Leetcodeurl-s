"""
auto_code_sync_service.py
==========================
Automated Weekly Contest Verbatim Code Sync Engine.
Syncs all 3 pillars every week: COUNT, TIME, and 100% REAL VERBATIM CODE.
Fetches authentic submission source codes directly from LeetCode API and stores
them in `contest_submission_codes` for sub-millisecond retrieval.
"""

import os
import re
import json
import logging
import datetime
from typing import Dict, Any, List, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
import httpx
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.models import (
    Student, WeeklySession, WeeklyPublicResult, 
    PreviousWeekParticipationRecord, LeetCodeSubmission, 
    ContestSubmissionCode
)

logger = logging.getLogger(__name__)

def _get_leetcode_auth_headers_and_cookies() -> Tuple[Dict[str, str], Dict[str, str]]:
    session_cookie = os.environ.get("LEETCODE_SESSION", "").strip()
    cf_clearance = os.environ.get("LEETCODE_CF_CLEARANCE", "").strip()
    csrf_token = os.environ.get("LEETCODE_CSRF", "").strip()

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
        "Referer": "https://leetcode.com/contest/",
        "Accept": "application/json, text/plain, */*",
        "x-csrftoken": csrf_token or "EWmjwXVUeX84093oyY5WVIw8NmuLb8Wa"
    }
    cookies = {}
    if session_cookie:
        cookies["LEETCODE_SESSION"] = session_cookie
    if cf_clearance:
        cookies["cf_clearance"] = cf_clearance
    if csrf_token:
        cookies["csrftoken"] = csrf_token

    return headers, cookies


def fetch_submission_verbatim_from_api(submission_id: str) -> Optional[Dict[str, Any]]:
    """Fetches 100% verbatim submitted code from LeetCode REST API."""
    if not submission_id:
        return None
    headers, cookies = _get_leetcode_auth_headers_and_cookies()
    clean_sub_id = str(submission_id).strip()
    url = f"https://leetcode.com/api/submissions/{clean_sub_id}/"

    try:
        with httpx.Client(timeout=10, follow_redirects=True) as client:
            resp = client.get(url, headers=headers, cookies=cookies)
            if resp.status_code == 200:
                data = resp.json()
                if data and data.get("code"):
                    return {
                        "code": data.get("code"),
                        "lang": data.get("lang") or "code",
                        "submission_id": clean_sub_id,
                        "contest_submission": data.get("contest_submission")
                    }
    except Exception as e:
        logger.warning(f"[AUTO_CODE_SYNC] REST fetch error for sub {submission_id}: {e}")

    # Fallback to GraphQL submissionDetails
    try:
        sub_id_int = int(clean_sub_id)
        query = """
        query submissionDetails($submissionId: Int!) {
          submissionDetails(submissionId: $submissionId) {
            code
            timestamp
            statusCode
            lang {
              name
              verboseName
            }
          }
        }
        """
        with httpx.Client(timeout=10) as client:
            resp = client.post(
                "https://leetcode.com/graphql",
                json={"query": query, "variables": {"submissionId": sub_id_int}},
                headers=headers,
                cookies=cookies
            )
            if resp.status_code == 200:
                data = resp.json().get("data", {}).get("submissionDetails")
                if data and data.get("code"):
                    lang_name = (data.get("lang") or {}).get("verboseName") or (data.get("lang") or {}).get("name") or "code"
                    return {
                        "code": data.get("code"),
                        "lang": lang_name,
                        "submission_id": clean_sub_id,
                        "contest_submission": None
                    }
    except Exception as e:
        logger.warning(f"[AUTO_CODE_SYNC] GraphQL fallback error for sub {submission_id}: {e}")

    return None


def resolve_contest_problem_slugs(session: WeeklySession) -> Dict[int, str]:
    """Resolves {q_idx: slug} for a given WeeklySession."""
    slugs = {}
    q_titles = {
        1: getattr(session, "q1_title", None),
        2: getattr(session, "q2_title", None),
        3: getattr(session, "q3_title", None),
        4: getattr(session, "q4_title", None),
    }

    for idx, title in q_titles.items():
        if title:
            # Clean title
            t_clean = re.sub(r'^Q\d+:\s*', '', title, flags=re.I).strip()
            slug = re.sub(r'[^a-z0-9]+', '-', t_clean.lower()).strip('-')
            if slug:
                slugs[idx] = slug

    # If titles missing, fetch from contest GraphQL
    if len(slugs) < 4:
        c_slug = getattr(session, "contest_slug", None) or ""
        if not c_slug and session.contest_name:
            m = re.search(r'(\d+)', session.contest_name)
            if m:
                c_slug = f"weekly-contest-{m.group(1)}"
        if c_slug:
            try:
                q = """
                query contestQuestions($titleSlug: String!) {
                  contest(titleSlug: $titleSlug) {
                    questions {
                      questionId
                      title
                      titleSlug
                    }
                  }
                }
                """
                with httpx.Client(timeout=8) as client:
                    r = client.post("https://leetcode.com/graphql", json={"query": q, "variables": {"titleSlug": c_slug}})
                    if r.status_code == 200:
                        qs = (r.json().get("data", {}) or {}).get("contest", {}).get("questions") or []
                        for i, q_item in enumerate(qs[:4], 1):
                            if q_item.get("titleSlug"):
                                slugs[i] = q_item["titleSlug"]
            except Exception as e:
                logger.warning(f"[AUTO_CODE_SYNC] Failed fetching contest question slugs: {e}")

    return slugs


def sync_contest_submission_codes_for_session(
    session_id: int, 
    db: Optional[Session] = None,
    concurrency: int = 10,
    force_refresh: bool = False,
    limit_solvers: Optional[int] = None
) -> Dict[str, Any]:
    """
    Main entry point: Automatically syncs 100% Real Verbatim Code for all students
    who solved problems in a weekly contest session.
    """
    close_db_on_exit = False
    if db is None:
        db = SessionLocal()
        close_db_on_exit = True

    try:
        session = db.query(WeeklySession).filter(WeeklySession.id == session_id).first()
        if not session:
            return {"status": "error", "message": f"Session {session_id} not found"}

        slug_map = resolve_contest_problem_slugs(session)
        logger.info(f"[AUTO_CODE_SYNC] Starting code sync for session {session_id} ({session.session_code}). Problem slugs: {slug_map}")

        # Find all solvers: check PreviousWeekParticipationRecord first, fallback to WeeklyPublicResult
        query_pwr = db.query(PreviousWeekParticipationRecord).filter(
            PreviousWeekParticipationRecord.session_id == session_id,
            PreviousWeekParticipationRecord.problems_solved > 0
        )
        if limit_solvers:
            query_pwr = query_pwr.limit(limit_solvers)
        solvers = query_pwr.all()

        if not solvers:
            query_wpr = db.query(WeeklyPublicResult).filter(
                WeeklyPublicResult.session_id == session_id,
                WeeklyPublicResult.total_contest_solved > 0
            )
            if limit_solvers:
                query_wpr = query_wpr.limit(limit_solvers)
            solvers = query_wpr.all()

        total_solvers = len(solvers)
        logger.info(f"[AUTO_CODE_SYNC] Found {total_solvers} participating students who solved questions.")

        synced_count = 0
        skipped_count = 0
        failed_count = 0

        # Build list of (student, q_idx, problem_slug) to sync
        sync_tasks = []
        for r in solvers:
            st = db.query(Student).filter(Student.id == r.student_id).first()
            if not st or not st.username:
                continue

            for q_idx in range(1, 5):
                q_solved = getattr(r, f"q{q_idx}", 0) or 0
                if q_solved == 1:
                    slug = slug_map.get(q_idx)
                    if not slug:
                        continue

                    # Check if already in DB
                    existing = db.query(ContestSubmissionCode).filter(
                        ContestSubmissionCode.session_id == session_id,
                        ContestSubmissionCode.student_id == st.id,
                        ContestSubmissionCode.q_idx == q_idx
                    ).first()

                    if existing and not force_refresh and existing.code and "return true" not in existing.code:
                        skipped_count += 1
                        continue

                    q_sec = getattr(r, f"q{q_idx}_observed_seconds", None)
                    sync_tasks.append((st, q_idx, slug, q_sec))

        logger.info(f"[AUTO_CODE_SYNC] {len(sync_tasks)} question codes need syncing ({skipped_count} already cached).")

        def process_single_task(task_item):
            student, q_idx, slug, q_sec = task_item
            t_db = SessionLocal()
            try:
                # 1. Resolve submission ID
                sub_id = None
                detected_lang = None
                runtime_disp = None
                memory_disp = None

                # First try local LeetCodeSubmission in DB with thread-safe session
                try:
                    local_sub = t_db.query(LeetCodeSubmission).filter(
                        LeetCodeSubmission.student_id == int(student.id),
                        (LeetCodeSubmission.title_slug == str(slug)) | (LeetCodeSubmission.title_slug.like(f"%{slug}%"))
                    ).order_by(LeetCodeSubmission.id.desc()).first()

                    if local_sub:
                        detected_lang = local_sub.lang
                        runtime_disp = local_sub.runtime_display
                        memory_disp = local_sub.memory_display
                except Exception:
                    pass

                # Next query LeetCode GraphQL recentAcSubmissionList for exact submission_id
                try:
                    q = """
                    query userRecentAc($username: String!) {
                      recentAcSubmissionList(username: $username, limit: 30) {
                        id
                        titleSlug
                        timestamp
                      }
                    }
                    """
                    with httpx.Client(timeout=8, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}) as client:
                        r = client.post("https://leetcode.com/graphql", json={"query": q, "variables": {"username": student.username}})
                        if r.status_code == 200:
                            subs = r.json().get("data", {}).get("recentAcSubmissionList") or []
                            for s in subs:
                                tslug = (s.get("titleSlug") or "").strip().lower()
                                if tslug == slug or slug in tslug or tslug in slug:
                                    sub_id = s.get("id")
                                    break
                except Exception:
                    pass

                if not sub_id:
                    return False, student.reg_no, q_idx, "Submission ID not found in LeetCode history"

                # 2. Fetch verbatim code from LeetCode API
                verbatim_data = fetch_submission_verbatim_from_api(sub_id)
                if not verbatim_data or not verbatim_data.get("code"):
                    return False, student.reg_no, q_idx, "Failed to extract code from LeetCode API"

                code_str = verbatim_data["code"]
                lang_str = verbatim_data.get("lang") or detected_lang or "java"
                contest_sub = verbatim_data.get("contest_submission")

                # 3. Save to database using this thread's isolated session
                row = t_db.query(ContestSubmissionCode).filter(
                    ContestSubmissionCode.session_id == session_id,
                    ContestSubmissionCode.student_id == student.id,
                    ContestSubmissionCode.q_idx == q_idx
                ).first()

                if not row:
                    row = ContestSubmissionCode(
                        session_id=session_id,
                        student_id=student.id,
                        reg_no=student.reg_no,
                        username=student.username,
                        q_idx=q_idx,
                        problem_slug=slug,
                        submission_id=str(sub_id),
                        contest_submission_id=str(contest_sub) if contest_sub else None,
                        lang=lang_str,
                        code=code_str,
                        runtime_display=runtime_disp,
                        memory_display=memory_disp,
                        time_seconds=q_sec,
                        status_display="Accepted"
                    )
                    t_db.add(row)
                else:
                    row.submission_id = str(sub_id)
                    row.contest_submission_id = str(contest_sub) if contest_sub else row.contest_submission_id
                    row.lang = lang_str
                    row.code = code_str
                    row.runtime_display = runtime_disp or row.runtime_display
                    row.memory_display = memory_disp or row.memory_display
                    row.time_seconds = q_sec or row.time_seconds
                    row.updated_at = datetime.datetime.now(datetime.timezone.utc)

                t_db.commit()
                return True, student.reg_no, q_idx, "Success"
            except Exception as e:
                t_db.rollback()
                return False, student.reg_no, q_idx, str(e)
            finally:
                t_db.close()

        # Run concurrent batch fetch
        with ThreadPoolExecutor(max_workers=min(concurrency, 15)) as executor:
            future_to_task = {executor.submit(process_single_task, item): item for item in sync_tasks}
            for future in as_completed(future_to_task):
                try:
                    success, reg_no, q_idx, msg = future.result()
                    if success:
                        synced_count += 1
                    else:
                        failed_count += 1
                except Exception as e:
                    failed_count += 1
                    logger.warning(f"[AUTO_CODE_SYNC] Worker error: {e}")

        logger.info(f"[AUTO_CODE_SYNC] Completed code sync for session {session_id}: {synced_count} synced, {skipped_count} cached, {failed_count} failed.")

        return {
            "status": "success",
            "session_id": session_id,
            "total_solvers": total_solvers,
            "synced_count": synced_count,
            "skipped_count": skipped_count,
            "failed_count": failed_count
        }

    except Exception as e:
        logger.error(f"[AUTO_CODE_SYNC] Critical error in session {session_id}: {e}")
        return {"status": "error", "message": str(e)}
    finally:
        if close_db_on_exit:
            db.close()
