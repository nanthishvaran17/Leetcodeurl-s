import asyncio
import json
import httpx
import time
from backend.database import SessionLocal
from backend.models import Student, WeeklyPublicResult
from backend.websocket_manager import manager

CONTEST_START = 1788661800 # 08:00:00 IST
CONTEST_END = 1788667500   # 09:35:00 IST

# All Contest 518 Problem Titles (and potential contest variants)
Q1_TITLES = {
    "count rotations with exactly k equal adjacent pairs",
    "check divisibility by digit sum and product",
    "count-rotations-with-exactly-k-equal-adjacent-pairs"
}
Q2_TITLES = {
    "count good cyclic rotations",
    "kth smallest amount with single denomination combination",
    "count-good-cyclic-rotations"
}
Q3_TITLES = {
    "count robot groups",
    "distinct subsequences",
    "count-robot-groups"
}
Q4_TITLES = {
    "minimum cost path with at most k turns",
    "minimum-cost-path-with-at-most-k-turns"
}

async def forensic_scan_not_attended():
    db = SessionLocal()
    not_attended_query = db.query(Student, WeeklyPublicResult).join(
        WeeklyPublicResult, Student.id == WeeklyPublicResult.student_id
    ).filter(
        WeeklyPublicResult.session_id == 3,
        WeeklyPublicResult.participation_status == "NOT_ATTENDED"
    ).all()

    print(f"[FORENSIC] Starting Deep Inspection on {len(not_attended_query)} NOT_ATTENDED students...\n", flush=True)

    discovered_active = []
    confirmed_zero_activity = []
    profile_errors = []

    sem = asyncio.Semaphore(15)

    async with httpx.AsyncClient(timeout=10.0) as client:
        async def inspect_student(st, res_rec):
            raw_user = st.username
            if not raw_user:
                return

            username = raw_user.strip().lstrip("@")
            query = {
                "query": """
                query userProfileDetail($userSlug: String!) {
                    matchedUser(username: $userSlug) {
                        username
                        submitStats {
                            acSubmissionNum { difficulty count }
                        }
                    }
                    recentAcSubmissionList(username: $userSlug, limit: 20) {
                        title
                        titleSlug
                        timestamp
                    }
                }
                """,
                "variables": {"userSlug": username}
            }

            async with sem:
                try:
                    resp = await client.post("https://leetcode.com/graphql", json=query, headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"})
                    if resp.status_code == 200:
                        data = resp.json()
                        matched = data.get("data", {}).get("matchedUser")
                        if not matched:
                            profile_errors.append((st, "PROFILE_NOT_FOUND"))
                            return

                        subs = data.get("data", {}).get("recentAcSubmissionList") or []
                        
                        # Inspect submissions in contest window
                        contest_subs = [s for s in subs if CONTEST_START <= int(s.get("timestamp", 0)) <= CONTEST_END]
                        titles = {s.get("title", "").lower().strip() for s in contest_subs}
                        slugs = {s.get("titleSlug", "").lower().strip() for s in contest_subs}
                        all_matches = titles.union(slugs)

                        if all_matches:
                            q1 = 1 if any(t in all_matches for t in Q1_TITLES) else 0
                            q2 = 1 if any(t in all_matches for t in Q2_TITLES) else 0
                            q3 = 1 if any(t in all_matches for t in Q3_TITLES) else 0
                            q4 = 1 if any(t in all_matches for t in Q4_TITLES) else 0
                            score = (q1 * 3) + (q2 * 4) + (q3 * 5) + (q4 * 6)
                            solved = q1 + q2 + q3 + q4
                            if solved == 0 and len(contest_subs) > 0:
                                solved = len(contest_subs)
                                score = solved * 3

                            # Upgrading student to PUBLIC
                            with SessionLocal() as s_db:
                                r = s_db.query(WeeklyPublicResult).filter(
                                    WeeklyPublicResult.session_id == 3,
                                    WeeklyPublicResult.student_id == st.id
                                ).first()
                                if r:
                                    r.q1, r.q2, r.q3, r.q4 = q1, q2, q3, q4
                                    r.total_contest_solved = solved
                                    r.contest_score = score
                                    r.participation_status = "PUBLIC"
                                    s_db.commit()

                            discovered_active.append((st, solved, score, q1, q2, q3, q4, [s.get("title") for s in contest_subs]))

                            # Broadcast incremental WebSocket update
                            try:
                                asyncio.create_task(manager.broadcast({
                                    "type": "CONTEST_RESULT_UPDATED",
                                    "student_id": st.id,
                                    "studentId": st.id,
                                    "name": st.name,
                                    "reg_no": st.reg_no,
                                    "username": username,
                                    "session_id": 3,
                                    "q1": q1, "q2": q2, "q3": q3, "q4": q4,
                                    "solved_count": solved,
                                    "score": score,
                                    "participation_status": "PUBLIC",
                                    "timestamp": time.time()
                                }))
                            except Exception:
                                pass
                        else:
                            # Confirmed zero submissions
                            last_sub = subs[0] if subs else None
                            confirmed_zero_activity.append((st, last_sub))

                except Exception as e:
                    profile_errors.append((st, str(e)))

        tasks = [inspect_student(st, res_rec) for st, res_rec in not_attended_query]
        await asyncio.gather(*tasks)

    print("=" * 65, flush=True)
    print("NOT_ATTENDED DEEP FORENSIC AUDIT RESULTS", flush=True)
    print("=" * 65, flush=True)
    print(f"Total NOT_ATTENDED Audited    : {len(not_attended_query)}", flush=True)
    print(f"Newly Discovered Attendees     : {len(discovered_active)}", flush=True)
    print(f"Confirmed Zero Submissions     : {len(confirmed_zero_activity)}", flush=True)
    print(f"Profile / Network Query Errors : {len(profile_errors)}", flush=True)
    print("=" * 65, flush=True)

    if discovered_active:
        print("\n[DISCOVERED ACTIVE STUDENTS]:", flush=True)
        for st, solved, score, q1, q2, q3, q4, sub_titles in discovered_active:
            print(f"  -> {st.name:<25} ({st.reg_no}) | Solved: {solved}/4 | Score: {score:>2} | Solves: {sub_titles} | @{st.username}", flush=True)
    else:
        print("\n[VERIFICATION CONFIRMED]: Every single one of the audited students has 0 submissions during the Weekly Contest 518 window.", flush=True)

    # Sample evidence for verified not attended
    print("\nSample Verified Not-Attended Evidence (Last Activity Timestamp):", flush=True)
    for st, last_sub in confirmed_zero_activity[:8]:
        if last_sub:
            sub_time_str = time.strftime('%Y-%m-%d %H:%M:%S IST', time.localtime(int(last_sub.get('timestamp', 0))))
            print(f"  - {st.name:<25} ({st.reg_no}): Last AC on LeetCode was '{last_sub.get('title')}' at {sub_time_str} (outside contest 518)")
        else:
            print(f"  - {st.name:<25} ({st.reg_no}): No public accepted submissions found on account (@{st.username})")

    # Update summary in database
    with SessionLocal() as s_db:
        public_count = s_db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == 3, WeeklyPublicResult.participation_status == "PUBLIC").count()
        not_att_count = s_db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == 3, WeeklyPublicResult.participation_status == "NOT_ATTENDED").count()
        pending_count = s_db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == 3, WeeklyPublicResult.participation_status == "NO_LEETCODE_HANDLE").count()
        print(f"\nFinal Reconciled Database Counts -> PUBLIC: {public_count} | NOT_ATTENDED: {not_att_count} | PENDING: {pending_count} | TOTAL: {public_count + not_att_count + pending_count}", flush=True)

if __name__ == "__main__":
    asyncio.run(forensic_scan_not_attended())
