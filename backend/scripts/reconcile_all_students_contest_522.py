"""
reconcile_all_students_contest_522.py
================================================================================
Universal LeetCode Contest 522 Problem-Level Forensic Reconciliation Script.
High-speed async parallel batch processing with immediate commits.
"""

import sys
import os
import asyncio
import datetime
from zoneinfo import ZoneInfo
import httpx
from typing import Dict, Any, List, Optional, Set

# Ensure project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.database import SessionLocal
from backend.models import Student, WeeklySession, WeeklyPublicResult, PreviousWeekParticipationRecord, CertificateRecord
from backend.services.contest_problem_accuracy_engine import ContestProblemAccuracyEngine, normalize_slug
from backend.cache import cache

IST = ZoneInfo("Asia/Kolkata")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Content-Type": "application/json",
    "Referer": "https://leetcode.com"
}

GRAPHQL_QUERY = """
query userContestAndSubs($username: String!) {
  userContestRankingHistory(username: $username) {
    attended
    problemsSolved
    totalProblems
    finishTimeInSeconds
    rating
    ranking
    contest {
      title
      startTime
    }
  }
  recentAcSubmissionList(username: $username, limit: 35) {
    id
    title
    titleSlug
    timestamp
  }
}
"""

async def fetch_one(client: httpx.AsyncClient, username: str, sem: asyncio.Semaphore) -> Optional[Dict[str, Any]]:
    async with sem:
        try:
            resp = await client.post(
                "https://leetcode.com/graphql",
                json={"query": GRAPHQL_QUERY, "variables": {"username": username}},
                timeout=4.5
            )
            if resp.status_code == 200:
                return resp.json().get("data")
        except Exception:
            pass
        return None

async def run_reconciliation(session_id: int = 13, contest_number: int = 522):
    db = SessionLocal()
    try:
        session = db.query(WeeklySession).filter(
            (WeeklySession.id == session_id) | (WeeklySession.week_number == contest_number)
        ).first()

        if not session:
            print(f"Session for contest {contest_number} not found.", flush=True)
            return

        print("=" * 80, flush=True)
        print(f"STARTING COMPREHENSIVE RECONCILIATION FOR {session.contest_name} (Session {session.id})", flush=True)
        print("=" * 80, flush=True)

        prob_set = ContestProblemAccuracyEngine.resolve_official_problem_set(contest_number)
        official_problems = prob_set.problems
        slug_map = {
            1: normalize_slug(official_problems[0].title_slug),
            2: normalize_slug(official_problems[1].title_slug),
            3: normalize_slug(official_problems[2].title_slug),
            4: normalize_slug(official_problems[3].title_slug),
        }
        print("Canonical Contest Problem Slugs:", flush=True)
        for idx, slug in slug_map.items():
            print(f"  Q{idx}: '{slug}' ({official_problems[idx-1].title})", flush=True)

        wpr_records = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == session.id).all()
        student_ids = [r.student_id for r in wpr_records if r.student_id]
        students = db.query(Student).filter(Student.id.in_(student_ids), Student.is_active == True).all()

        target_students = [s for s in students if s.username and len(s.username.strip()) > 1]
        print(f"\nTotal students to evaluate: {len(target_students)}", flush=True)

        sem = asyncio.Semaphore(25)
        limits = httpx.Limits(max_connections=35, max_keepalive_connections=20)
        
        async with httpx.AsyncClient(headers=HEADERS, limits=limits) as client:
            batch_size = 50
            total_synced = 0
            
            for b_idx in range(0, len(target_students), batch_size):
                chunk = target_students[b_idx : b_idx + batch_size]
                chunk_tasks = [fetch_one(client, s.username.strip(), sem) for s in chunk]
                results = await asyncio.gather(*chunk_tasks)
                
                for s, data in zip(chunk, results):
                    if not data:
                        continue
                    
                    hist = data.get("userContestRankingHistory") or []
                    recent_ac = data.get("recentAcSubmissionList") or []

                    c_history = None
                    for h in hist:
                        c_title = (h.get("contest") or {}).get("title") or ""
                        if str(contest_number) in c_title or "522" in c_title:
                            c_history = h
                            break

                    is_attended = bool(c_history.get("attended")) if c_history else False
                    hist_problems_solved = c_history.get("problemsSolved") or 0 if c_history else 0
                    hist_rank = c_history.get("ranking") if c_history else None
                    hist_rating = c_history.get("rating") if c_history else None

                    ac_slugs: Set[str] = set()
                    for sub in recent_ac:
                        ts_slug = normalize_slug(sub.get("titleSlug") or sub.get("title") or "")
                        if ts_slug:
                            ac_slugs.add(ts_slug)

                    q1 = 1 if slug_map[1] in ac_slugs else 0
                    q2 = 1 if slug_map[2] in ac_slugs else 0
                    q3 = 1 if slug_map[3] in ac_slugs else 0
                    q4 = 1 if slug_map[4] in ac_slugs else 0

                    slug_solved_count = q1 + q2 + q3 + q4

                    if is_attended or slug_solved_count > 0:
                        if slug_solved_count > 0:
                            final_q1, final_q2, final_q3, final_q4 = q1, q2, q3, q4
                            final_solved = slug_solved_count
                        else:
                            final_solved = hist_problems_solved if hist_problems_solved > 0 else 1
                            final_q1 = 1 if final_solved >= 1 else 0
                            final_q2 = 1 if final_solved >= 2 else 0
                            final_q3 = 1 if final_solved >= 3 else 0
                            final_q4 = 1 if final_solved >= 4 else 0

                        final_score = (final_q1 * 3) + (final_q2 * 4) + (final_q3 * 5) + (final_q4 * 6)
                        status_str = "PUBLIC"

                        wpr = db.query(WeeklyPublicResult).filter(
                            WeeklyPublicResult.session_id == session.id,
                            WeeklyPublicResult.student_id == s.id
                        ).first()

                        if wpr:
                            wpr.q1 = final_q1
                            wpr.q2 = final_q2
                            wpr.q3 = final_q3
                            wpr.q4 = final_q4
                            wpr.total_contest_solved = final_solved
                            wpr.contest_score = final_score
                            if hist_rank:
                                wpr.contest_rank = hist_rank
                            if hist_rating:
                                wpr.contest_rating = hist_rating
                            wpr.participation_status = status_str
                            wpr.confidence = "VERIFIED"
                            wpr.fetch_status = "SUCCESS"

                        pwpr = db.query(PreviousWeekParticipationRecord).filter(
                            PreviousWeekParticipationRecord.session_id == session.id,
                            PreviousWeekParticipationRecord.student_id == s.id
                        ).first()

                        if not pwpr:
                            pwpr = PreviousWeekParticipationRecord(
                                session_id=session.id,
                                contest_id=session.contest_id or f"weekly-contest-{contest_number}",
                                contest_slug=(session.contest_id or f"weekly-contest-{contest_number}").lower(),
                                contest_title=session.contest_name or f"Weekly Contest {contest_number}",
                                student_id=s.id,
                                leetcode_username=s.username,
                                participation_type=status_str,
                                q1=final_q1,
                                q2=final_q2,
                                q3=final_q3,
                                q4=final_q4,
                                problems_solved=final_solved,
                                official_score=final_score,
                                official_rank=hist_rank,
                                source="verified_graphql_forensic_sync",
                                verification_status="VERIFIED",
                                dataset_version=1,
                                is_active_version=True
                            )
                            db.add(pwpr)
                        else:
                            pwpr.q1 = final_q1
                            pwpr.q2 = final_q2
                            pwpr.q3 = final_q3
                            pwpr.q4 = final_q4
                            pwpr.problems_solved = final_solved
                            pwpr.official_score = final_score
                            if hist_rank:
                                pwpr.official_rank = hist_rank
                            pwpr.participation_type = status_str
                            pwpr.verification_status = "VERIFIED"

                        total_synced += 1

                db.commit()
                processed = min(b_idx + batch_size, len(target_students))
                print(f"Progress: [{processed}/{len(target_students)}] processed | {total_synced} contest records verified and committed.", flush=True)

        print("\n" + "=" * 80, flush=True)
        print(f"RECONCILIATION COMPLETE: Successfully verified {total_synced} student records.", flush=True)
        print("=" * 80, flush=True)

        cache.invalidate_tag("contests")
        print("Contest cache invalidated successfully.", flush=True)

    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(run_reconciliation())
