import os
import sys
import asyncio

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal
from backend.models import Student, LeetCodeProfileStats, WeeklyStudentProgress
from backend.leetcode_fetcher import fetch_leetcode_profile, extract_leetcode_username
from backend.ranking import update_all_rankings_and_badges

async def fast_sync_all_students():
    print("Starting FAST Parallel Sync for all active students...")
    db = SessionLocal()
    try:
        students = db.query(Student).filter(Student.is_active == True).all()
        print(f"Loaded {len(students)} active student records.")

        sem = asyncio.Semaphore(15)
        success_count = 0
        failed_count = 0

        async def sync_one(s):
            nonlocal success_count, failed_count
            username, _, url_status = extract_leetcode_username(s.leetcode_url or s.username)
            if not username or url_status != "OK":
                failed_count += 1
                return

            async with sem:
                try:
                    real_data = await fetch_leetcode_profile(username, force_refresh=True)
                    status = real_data.get("status")

                    tot = real_data.get("total_solved") or 0
                    ez = real_data.get("easy_solved") or 0
                    med = real_data.get("medium_solved") or 0
                    hd = real_data.get("hard_solved") or 0
                    c_rating = real_data.get("contest_rating")
                    c_rank = real_data.get("contest_global_rank") or real_data.get("contest_global_ranking")

                    if status == "success" or tot > 0:
                        if not s.stats:
                            s.stats = LeetCodeProfileStats(student_id=s.id)
                            db.add(s.stats)

                        old_total = s.stats.total_solved or 0

                        s.stats.total_solved = tot
                        s.stats.easy_solved = ez
                        s.stats.medium_solved = med
                        s.stats.hard_solved = hd
                        s.stats.contest_rating = c_rating
                        s.stats.contest_global_ranking = c_rank
                        s.stats.status = "OK"

                        prog = db.query(WeeklyStudentProgress).filter(
                            WeeklyStudentProgress.student_id == s.id
                        ).order_by(WeeklyStudentProgress.id.desc()).first()
                        if not prog:
                            prog = WeeklyStudentProgress(student_id=s.id)
                            db.add(prog)

                        prog.weekly_progress = max(0, tot - old_total)
                        prog.streak_count = 1 if tot > 0 else 0
                        prog.consistency_score = round((tot / max(1, tot)) * 100, 1) if tot > 0 else 0.0

                        success_count += 1
                        print(f"  [SUCCESS] {s.name} ({username}): {tot} solved (E:{ez} M:{med} H:{hd}) | Rating: {c_rating or 'Unrated'}")
                    else:
                        failed_count += 1
                except Exception as e:
                    failed_count += 1
                    print(f"  [ERROR] Syncing {s.name}: {e}")

        await asyncio.gather(*[sync_one(s) for s in students])

        db.commit()
        print(f"\nFAST SYNC COMPLETE!")
        print(f"Successfully updated: {success_count} students | Unchanged/Failed: {failed_count}")

        # Recalculate rankings
        print("Recalculating all college rankings & badges...")
        update_all_rankings_and_badges(db)
        print("Rankings & badges successfully updated!")

    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(fast_sync_all_students())
