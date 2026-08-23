import asyncio
import httpx
from datetime import datetime, timezone, timedelta
from backend.database import SessionLocal
from backend.models import Student, WeeklyPublicResult, WeeklySession

ist_tz = timezone(timedelta(hours=5, minutes=30))
today_start_ts = int(datetime(2026, 8, 23, 7, 30, 0, tzinfo=ist_tz).timestamp())

GRAPHQL_URL = 'https://leetcode.com/graphql'
QUERY = """
query getUserRecentSubmissions($username: String!) {
  recentAcSubmissionList(username: $username, limit: 15) {
    id
    title
    timestamp
  }
}
"""

async def super_turbo_fetch():
    db = SessionLocal()
    session = db.query(WeeklySession).filter(WeeklySession.id == 21).first()
    students = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None))).all()
    print(f"TURBO ENGINE: Sweeping {len(students)} students with 60 parallel async workers...")
    
    results = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == 21).all()
    res_map = {r.student_id: r for r in results}
    
    sem = asyncio.Semaphore(60)
    attended_count = 0
    now_dt = datetime.now()
    
    async with httpx.AsyncClient(timeout=10, limits=httpx.Limits(max_connections=120, max_keepalive_connections=60)) as client:
        async def fetch_student(s):
            nonlocal attended_count
            uname = s.username
            if not uname or len(uname.strip()) < 2:
                return
            async with sem:
                try:
                    resp = await client.post(
                        GRAPHQL_URL, 
                        json={'query': QUERY, 'variables': {'username': uname.strip()}}, 
                        headers={'User-Agent': 'Mozilla/5.0'}
                    )
                    if resp.status_code == 200:
                        data = resp.json().get('data', {})
                        subs = data.get('recentAcSubmissionList') or []
                        today_subs = [sub for sub in subs if int(sub.get('timestamp') or 0) >= today_start_ts]
                        
                        r = res_map.get(s.id)
                        if not r:
                            dept_val = s.department.code if s.department else 'CSE'
                            r = WeeklyPublicResult(
                                session_id=21, 
                                student_id=s.id, 
                                reg_no=s.reg_no, 
                                name=s.name, 
                                dept=dept_val, 
                                year=s.year_level or 'III'
                            )
                            db.add(r)
                            res_map[s.id] = r
                        
                        if today_subs:
                            count = len(today_subs)
                            r.participation_status = 'PUBLIC'
                            r.fetch_status = 'SUCCESS'
                            r.q1 = 1
                            r.q2 = 1 if count >= 2 else 0
                            r.q3 = 1 if count >= 3 else 0
                            r.q4 = 1 if count >= 4 else 0
                            r.total_contest_solved = min(4, count)
                            r.contest_score = (r.q1 * 3) + (r.q2 * 4) + (r.q3 * 5) + (r.q4 * 6)
                            r.last_fetched_at = now_dt
                            attended_count += 1
                        else:
                            if r.participation_status != 'PUBLIC':
                                r.participation_status = 'NOT_ATTENDED'
                                r.fetch_status = 'SUCCESS'
                                r.last_fetched_at = now_dt
                except Exception:
                    pass
        
        await asyncio.gather(*[fetch_student(s) for s in students])
        
    db.commit()
    print(f"TURBO SWEEP COMPLETE: Total Public Attendees Committed = {attended_count} / {len(students)}")

if __name__ == '__main__':
    asyncio.run(super_turbo_fetch())
