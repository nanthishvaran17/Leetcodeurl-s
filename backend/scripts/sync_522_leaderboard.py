import asyncio
import httpx
import json
import math
from backend.database import SessionLocal
from backend.models import WeeklyPublicResult, Student

HEADERS = {'User-Agent': 'Mozilla/5.0'}
BASE_URL = 'https://leetcode.com/contest/api/ranking/weekly-contest-522/?pagination={}&region=global'

async def fetch_page(client, page, sem):
    async with sem:
        for _ in range(3):
            try:
                resp = await client.get(BASE_URL.format(page))
                if resp.status_code == 200:
                    return resp.json()
            except:
                pass
            await asyncio.sleep(0.5)
        return None

async def main():
    print("Starting exact leaderboard sync...")
    
    # First, get total pages
    async with httpx.AsyncClient(headers=HEADERS, timeout=15.0) as client:
        resp = await client.get(BASE_URL.format(1))
        if resp.status_code != 200:
            print("Page 1 failed", resp.status_code)
            return
        data = resp.json()
        total_users = data.get('user_num', 0)
        total_pages = math.ceil(total_users / 25)
        print(f"Total users: {total_users}, Total pages: {total_pages}")
        
        # Get question mapping
        questions = data.get('questions', [])
        q_ids = [str(q['question_id']) for q in questions]
        print(f"Q IDs: {q_ids}")
        
        sem = asyncio.Semaphore(5)
        
        tasks = [fetch_page(client, p, sem) for p in range(1, total_pages + 1)]
        results = await asyncio.gather(*tasks)
        
        # Build map
        user_map = {}
        for res in results:
            if not res: continue
            ranks = res.get('total_rank', [])
            subs = res.get('submissions', [])
            for r, s in zip(ranks, subs):
                username = r.get('username')
                user_slug = r.get('user_slug')
                
                # Check which questions were solved
                q1 = 1 if q_ids[0] in s and s[q_ids[0]].get('status') == 10 else 0
                q2 = 1 if q_ids[1] in s and s[q_ids[1]].get('status') == 10 else 0
                q3 = 1 if q_ids[2] in s and s[q_ids[2]].get('status') == 10 else 0
                q4 = 1 if q_ids[3] in s and s[q_ids[3]].get('status') == 10 else 0
                
                if user_slug:
                    user_map[user_slug.lower()] = (q1, q2, q3, q4)
                if username:
                    user_map[username.lower()] = (q1, q2, q3, q4)

        print(f"Fetched {len(user_map)} users from leaderboard.")
        
        # Update DB
        db = SessionLocal()
        wrs = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == 20).all()
        updated = 0
        
        for wr in wrs:
            st = db.query(Student).get(wr.student_id)
            if not st or not st.username: continue
            
            uname = st.username.lower()
            if uname in user_map:
                q1, q2, q3, q4 = user_map[uname]
                solved = q1 + q2 + q3 + q4
                wr.q1 = q1
                wr.q2 = q2
                wr.q3 = q3
                wr.q4 = q4
                wr.total_contest_solved = solved
                wr.participation_status = "PUBLIC_ATTENDED" if solved > 0 else "PUBLIC_ATTENDED" # since they are in DB as PUBLIC
                print(f"Updated {uname}: {q1} {q2} {q3} {q4} (Solved: {solved})")
                updated += 1
            else:
                # If they didn't even submit anything during the contest, they wouldn't be on the leaderboard
                # or their score is 0.
                if wr.total_contest_solved > 0:
                    print(f"Warning: {uname} has >0 solved in DB but not found in leaderboard!")
                wr.q1 = 0
                wr.q2 = 0
                wr.q3 = 0
                wr.q4 = 0
                wr.total_contest_solved = 0
                wr.participation_status = "NOT_ATTENDED"
        
        db.commit()
        db.close()
        print(f"Successfully updated {updated} records.")

if __name__ == "__main__":
    asyncio.run(main())
