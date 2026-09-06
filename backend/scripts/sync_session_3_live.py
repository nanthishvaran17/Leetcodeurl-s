import asyncio
import json
import urllib.request
import time
from backend.database import SessionLocal
from backend.models import Student, WeeklyPublicResult
from backend.websocket_manager import manager

CONTEST_START = 1788661800
CONTEST_END = 1788667200

Q1_TITLES = {"count rotations with exactly k equal adjacent pairs", "check divisibility by digit sum and product"}
Q2_TITLES = {"count good cyclic rotations", "kth smallest amount with single denomination combination"}
Q3_TITLES = {"count robot groups", "distinct subsequences"}
Q4_TITLES = {"minimum cost path with at most k turns"}

async def sync_live():
    db = SessionLocal()
    students = db.query(Student).filter(Student.is_active == True).all()
    print(f"Syncing live contest data for {len(students)} students...")

    public_attended = []
    not_attended = []
    pending_handles = []
    invalid_handles = []

    for st in students:
        raw_username = st.username
        if not raw_username or not raw_username.strip():
            pending_handles.append(st)
            rec = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == 3, WeeklyPublicResult.student_id == st.id).first()
            if rec:
                rec.participation_status = "NO_LEETCODE_HANDLE"
                rec.total_contest_solved = 0
                rec.contest_score = 0
            continue

        username = raw_username.strip().lstrip("@")
        query = {
            "query": "query userProfileUserQuestionProgressBySlug($userSlug: String!) { recentAcSubmissionList(username: $userSlug) { title timestamp } }",
            "variables": {"userSlug": username}
        }
        
        try:
            req = urllib.request.Request(
                "https://leetcode.com/graphql",
                data=json.dumps(query).encode("utf-8"),
                headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                subs = data.get("data", {}).get("recentAcSubmissionList", [])
                
                rec = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == 3, WeeklyPublicResult.student_id == st.id).first()
                if not rec:
                    continue

                if subs is None:
                    invalid_handles.append(st)
                    rec.participation_status = "INVALID_CONFIRMED"
                    rec.total_contest_solved = 0
                    rec.contest_score = 0
                    continue

                contest_subs = [s for s in subs if CONTEST_START <= int(s.get("timestamp", 0)) <= CONTEST_END]
                titles = {s.get("title", "").lower().strip() for s in contest_subs}

                if titles:
                    q1 = 1 if any(t in titles for t in Q1_TITLES) else 0
                    q2 = 1 if any(t in titles for t in Q2_TITLES) else 0
                    q3 = 1 if any(t in titles for t in Q3_TITLES) else 0
                    q4 = 1 if any(t in titles for t in Q4_TITLES) else 0
                    score = (q1 * 3) + (q2 * 4) + (q3 * 5) + (q4 * 6)
                    solved = q1 + q2 + q3 + q4
                    if solved == 0 and len(contest_subs) > 0:
                        solved = len(contest_subs)
                        score = solved * 3

                    rec.q1 = q1
                    rec.q2 = q2
                    rec.q3 = q3
                    rec.q4 = q4
                    rec.total_contest_solved = solved
                    rec.contest_score = score
                    rec.participation_status = "PUBLIC"
                    public_attended.append((st, solved, score, q1, q2, q3, q4))

                    # Broadcast real-time single student live event
                    try:
                        asyncio.create_task(manager.broadcast({
                            "type": "CONTEST_RESULT_UPDATED",
                            "student_id": st.id,
                            "studentId": st.id,
                            "name": st.name,
                            "reg_no": st.reg_no,
                            "username": username,
                            "session_id": 3,
                            "q1": q1,
                            "q2": q2,
                            "q3": q3,
                            "q4": q4,
                            "solved_count": solved,
                            "solved": solved,
                            "score": score,
                            "participation_status": "PUBLIC",
                            "timestamp": time.time()
                        }))
                    except Exception:
                        pass
                else:
                    rec.participation_status = "NOT_ATTENDED"
                    rec.total_contest_solved = 0
                    rec.contest_score = 0
                    rec.q1 = 0
                    rec.q2 = 0
                    rec.q3 = 0
                    rec.q4 = 0
                    not_attended.append(st)

        except Exception as err:
            pass

    db.commit()

    print("\n" + "=" * 60)
    print("318-STUDENT LIVE CONTEST 518 RECONCILIATION RESULT")
    print("=" * 60)
    print(f"PUBLIC ATTENDED (LIVE)  : {len(public_attended)}")
    print(f"NOT ATTENDED             : {len(not_attended)}")
    print(f"PENDING HANDLE           : {len(pending_handles)}")
    print(f"INVALID CONFIRMED        : {len(invalid_handles)}")
    print(f"TOTAL EVALUATED          : {len(public_attended) + len(not_attended) + len(pending_handles) + len(invalid_handles)} / {len(students)}")
    print("=" * 60)
    print("\nTop Active Students in Contest 518:")
    for st, solved, score, q1, q2, q3, q4 in sorted(public_attended, key=lambda x: -x[2])[:15]:
        print(f"  -> {st.name:<25} ({st.reg_no}) | Solved: {solved}/4 | Score: {score:>2} | Q1:{q1} Q2:{q2} Q3:{q3} Q4:{q4} | @{st.username}")

    db.close()

if __name__ == "__main__":
    asyncio.run(sync_live())
