import asyncio
import httpx
import datetime
from backend.database import SessionLocal
from backend.models import Student, LeetCodeSubmission
from backend.leetcode_fetcher import fetch_recent_submissions

async def populate_all_student_submissions():
    db = SessionLocal()
    students = db.query(Student).all()
    print(f"Found {len(students)} students in DB. Fetching real recent submissions from LeetCode GraphQL...")

    timeout_cfg = httpx.Timeout(15.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout_cfg, follow_redirects=True) as client:
        for idx, s in enumerate(students):
            username = s.username or s.primary_leetcode_id
            if not username:
                continue
            
            try:
                res = await fetch_recent_submissions(username, client=client, limit=20)
                if res.get("status") == "ok":
                    subs = res.get("data", {}).get("submissions", [])
                    added_count = 0
                    for sub in subs:
                        tslug = sub.get("title_slug")
                        if not tslug:
                            continue
                        raw_ts = sub.get("submission_timestamp")
                        dt_val = datetime.datetime.fromtimestamp(raw_ts) if (raw_ts and isinstance(raw_ts, int) and raw_ts > 0) else datetime.datetime.utcnow()
                        
                        existing = db.query(LeetCodeSubmission).filter(
                            LeetCodeSubmission.student_id == s.id,
                            LeetCodeSubmission.title_slug == tslug,
                            LeetCodeSubmission.submission_timestamp == dt_val
                        ).first()

                        if not existing:
                            new_sub = LeetCodeSubmission(
                                student_id=s.id,
                                title_slug=tslug,
                                title=sub.get("title"),
                                lang=sub.get("lang"),
                                status_display=sub.get("status_display") or "Accepted",
                                runtime_display=sub.get("runtime_display"),
                                memory_display=sub.get("memory_display"),
                                submission_timestamp=dt_val
                            )
                            db.add(new_sub)
                            added_count += 1
                    
                    db.commit()
                    print(f"[{idx+1}/{len(students)}] Student ID {s.id} ({username}): Fetched {len(subs)} submissions ({added_count} new saved)")
                else:
                    print(f"[{idx+1}/{len(students)}] Student ID {s.id} ({username}): Status {res.get('status')}")
            except Exception as e:
                print(f"[{idx+1}/{len(students)}] Error for {username}: {e}")
                db.rollback()
            
            await asyncio.sleep(0.1) # Smooth rate control

    db.close()
    print("Done populating student submissions!")

if __name__ == "__main__":
    asyncio.run(populate_all_student_submissions())
