import asyncio
import datetime
from typing import Dict, Any, Tuple
from sqlalchemy.orm import Session
from backend.models import WeeklyPublicResult, WeeklyContestErrorLog, Student
from backend.leetcode_client import fetch_leetcode_profile

def merge_contest_fetch_results(existing: WeeklyPublicResult, new_data: Dict[str, Any]) -> Tuple[WeeklyPublicResult, bool]:
    """
    Field-Level Result Merger:
    Merges partial field successes across attempts.
    Priority: SUCCESS > PARTIAL_SUCCESS > FETCH_ERROR.
    A failed attempt will NEVER overwrite an already known successful value.
    """
    updated = False

    new_status = new_data.get("participation_status")
    if new_status and new_status != "PENDING" and existing.participation_status in ("PENDING", "DATA_ERROR"):
        existing.participation_status = new_status
        updated = True

    # Merge individual question solved flags
    for q_num in range(1, 5):
        key = f"q{q_num}"
        if key in new_data and new_data[key] is not None:
            new_val = int(new_data[key])
            old_val = getattr(existing, key, 0)
            if new_val > old_val or getattr(existing, key, None) is None:
                setattr(existing, key, new_val)
                updated = True

    # Recalculate total contest solved
    existing.total_contest_solved = (existing.q1 or 0) + (existing.q2 or 0) + (existing.q3 or 0) + (existing.q4 or 0)

    # Merge score, rank, rating if available
    if new_data.get("contest_rank") is not None and (existing.contest_rank is None or new_data["contest_rank"] < existing.contest_rank):
        existing.contest_rank = new_data["contest_rank"]
        updated = True

    if new_data.get("contest_rating") is not None and existing.contest_rating is None:
        existing.contest_rating = new_data["contest_rating"]
        updated = True

    if new_data.get("fetch_status") == "SUCCESS":
        existing.fetch_status = "SUCCESS"
        existing.error_reason = None
        updated = True
    elif new_data.get("fetch_status") == "FETCH_ERROR" and existing.fetch_status != "SUCCESS":
        existing.fetch_status = "FETCH_ERROR"
        existing.error_reason = new_data.get("error_reason", "FETCH_ERROR")

    existing.last_fetched_at = datetime.datetime.utcnow()
    return existing, updated

async def retry_failed_student_fetches(db: Session, session_id: int) -> Dict[str, Any]:
    """
    Retries unresolved/failed student fetches for a session concurrently with bounded concurrency.
    Pre-maps student entities in memory for SQLite thread safety and commits updates in one transaction.
    """
    failed_results = db.query(WeeklyPublicResult).filter(
        WeeklyPublicResult.session_id == session_id,
        WeeklyPublicResult.fetch_status.in_(["FETCH_ERROR", "PENDING"])
    ).all()

    if not failed_results:
        return {"retried_count": 0, "resolved_count": 0, "still_failing": 0}

    student_ids = [r.student_id for r in failed_results]
    students = db.query(Student).filter(Student.id.in_(student_ids)).all()
    student_map = {s.id: s for s in students}

    sem = asyncio.Semaphore(10)
    retried_count = 0
    resolved_count = 0

    async def _fetch_single(record, student):
        nonlocal retried_count, resolved_count
        if not student or not student.leetcode_url:
            return None

        record.retry_count += 1
        retried_count += 1

        # Fast path: check if student already has verified stats cached in DB
        if student.stats and student.stats.sync_status in ("success", "OK", "verified"):
            problems_solved = student.stats.total_solved or 0
            return {
                "record": record,
                "student": student,
                "is_ok": True,
                "data": {
                    "participation_status": "PUBLIC_ATTENDED" if problems_solved > 0 else "PUBLIC_NOT_ATTENDED",
                    "q1": 1 if problems_solved >= 1 else 0,
                    "q2": 1 if problems_solved >= 2 else 0,
                    "q3": 1 if problems_solved >= 3 else 0,
                    "q4": 1 if problems_solved >= 4 else 0,
                    "contest_rank": student.stats.contest_global_ranking,
                    "contest_rating": student.stats.contest_rating,
                    "fetch_status": "SUCCESS"
                }
            }

        async with sem:
            try:
                stats_dict = await fetch_leetcode_profile(student.leetcode_url)
                is_ok = stats_dict.get("validation_status") == "verified"
                if is_ok:
                    c_type = stats_dict.get("recent_contest_type", "UNKNOWN")
                    c_score = stats_dict.get("recent_contest_score")
                    problems_solved = 0
                    if c_score and "/" in str(c_score):
                        try:
                            problems_solved = int(str(c_score).split("/")[0].strip())
                        except Exception:
                            problems_solved = 0

                    return {
                        "record": record,
                        "student": student,
                        "is_ok": True,
                        "data": {
                            "participation_status": "PUBLIC_ATTENDED" if c_type == "OFFICIAL" else "PUBLIC_NOT_ATTENDED",
                            "q1": 1 if problems_solved >= 1 else 0,
                            "q2": 1 if problems_solved >= 2 else 0,
                            "q3": 1 if problems_solved >= 3 else 0,
                            "q4": 1 if problems_solved >= 4 else 0,
                            "contest_rank": stats_dict.get("contest_global_ranking"),
                            "contest_rating": stats_dict.get("contest_rating"),
                            "fetch_status": "SUCCESS"
                        }
                    }
                else:
                    return {
                        "record": record,
                        "student": student,
                        "is_ok": False,
                        "error_reason": stats_dict.get("error_code") or "PROFILE_NOT_VERIFIED"
                    }
            except Exception as e:
                return {
                    "record": record,
                    "student": student,
                    "is_ok": False,
                    "error_reason": "NETWORK_ERROR"
                }

    tasks = [_fetch_single(r, student_map.get(r.student_id)) for r in failed_results]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for item in results:
        if not isinstance(item, dict) or not item:
            continue
        rec = item["record"]
        st = item["student"]
        if item.get("is_ok"):
            merge_contest_fetch_results(rec, item["data"])
            resolved_count += 1
            err_log = db.query(WeeklyContestErrorLog).filter(
                WeeklyContestErrorLog.session_id == session_id,
                WeeklyContestErrorLog.student_id == st.id,
                WeeklyContestErrorLog.status == "UNRESOLVED"
            ).first()
            if err_log:
                err_log.status = "RESOLVED"
        else:
            rec.fetch_status = "FETCH_ERROR"
            rec.error_reason = item.get("error_reason", "FETCH_ERROR")

    db.commit()
    return {
        "retried_count": retried_count,
        "resolved_count": resolved_count,
        "still_failing": retried_count - resolved_count
    }
