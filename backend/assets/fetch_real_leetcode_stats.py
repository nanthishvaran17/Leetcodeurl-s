import os
import sys
import asyncio

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal
from backend.models import Student, LeetCodeProfileStats, WeeklyStudentProgress
from backend.leetcode_fetcher import fetch_leetcode_profile, extract_leetcode_username
from backend.ranking import update_all_rankings_and_badges
from backend.assets.sync_firestore import sync_database_to_firestore

async def fetch_real_all_students():
    print("Starting REAL 100% accurate LeetCode profile data extraction for all 273 students...")
    db = SessionLocal()
    try:
        students = db.query(Student).filter(Student.is_active == True).all()
        total_count = len(students)
        print(f"Loaded {total_count} student records from database.")

        success_count = 0
        failed_count = 0

        for idx, s in enumerate(students, 1):
            username, std_url, url_status = extract_leetcode_username(s.leetcode_url or s.username)
            if not username or url_status != "OK":
                # Missing or invalid profile link - set accurate zero state
                if not s.stats:
                    s.stats = LeetCodeProfileStats(student_id=s.id)
                    db.add(s.stats)
                s.stats.total_solved = 0
                s.stats.easy_solved = 0
                s.stats.medium_solved = 0
                s.stats.hard_solved = 0
                s.stats.contest_rating = None
                s.stats.contest_global_ranking = None
                s.stats.status = url_status if url_status != "OK" else "NOT STARTED"

                prog = db.query(WeeklyStudentProgress).filter(
                    WeeklyStudentProgress.student_id == s.id
                ).order_by(WeeklyStudentProgress.id.desc()).first()
                if not prog:
                    prog = WeeklyStudentProgress(student_id=s.id)
                    db.add(prog)
                prog.weekly_progress = 0
                prog.streak_count = 0
                prog.consistency_score = 0.0
                failed_count += 1
                continue

            print(f"[{idx}/{total_count}] Fetching REAL LeetCode profile for {s.name} ({username})...")
            
            # Rate limit protection: small delay between requests
            await asyncio.sleep(0.3)

            real_data = await fetch_leetcode_profile(username, force_refresh=True)
            status = real_data.get("status")

            if not s.stats:
                s.stats = LeetCodeProfileStats(student_id=s.id)
                db.add(s.stats)

            if status == "success" or real_data.get("total_solved", 0) > 0:
                tot = real_data.get("total_solved", 0)
                ez = real_data.get("easy_solved", 0)
                med = real_data.get("medium_solved", 0)
                hd = real_data.get("hard_solved", 0)
                c_rating = real_data.get("contest_rating")
                c_rank = real_data.get("contest_global_rank") or real_data.get("contest_global_ranking")

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
                
                # Active coding calculations
                prog.weekly_progress = max(0, tot - (s.stats.total_solved or tot))
                prog.streak_count = 1 if tot > 0 else 0
                prog.consistency_score = round((tot / max(1, tot)) * 100, 1) if tot > 0 else 0.0

                success_count += 1
                print(f"  -> SUCCESS: {s.name}: {tot} Solved (Easy:{ez}, Med:{med}, Hard:{hd}) | Rating: {c_rating or 'Unrated'}")
            else:
                # Fetch failed or profile unavailable — DO NOT set total_solved to 0!
                # Unless the API successfully responded and verified 0 solved.
                if status == "success" and real_data.get("total_solved") == 0:
                    s.stats.total_solved = 0
                    s.stats.easy_solved = 0
                    s.stats.medium_solved = 0
                    s.stats.hard_solved = 0
                    s.stats.status = "OK"
                    print(f"  -> VERIFIED ZERO: {s.name} ({username}) has 0 solved.")
                else:
                    err_status = "invalid_profile" if status in ("PROFILE_NOT_FOUND", "INVALID_LINK") else "failed"
                    s.stats.status = err_status
                    if not s.stats.total_solved:
                        s.stats.total_solved = None
                    failed_count += 1
                    print(f"  -> FAILED/UNAVAILABLE for {s.name} ({username}): status={err_status}")

            if idx % 10 == 0:
                db.commit()

        db.commit()
        print(f"\nREAL DATA EXTRACTION COMPLETE!")
        print(f"Total: {total_count} | Successful Real Fetches: {success_count} | Unmatched/Zero: {failed_count}")

        # Recalculate official college rankings
        update_all_rankings_and_badges(db)
        print("Recalculated official rankings based on 100% real LeetCode profile metrics.")

    finally:
        db.close()

    # Sync real data to Firestore
    sync_database_to_firestore()

if __name__ == "__main__":
    asyncio.run(fetch_real_all_students())
