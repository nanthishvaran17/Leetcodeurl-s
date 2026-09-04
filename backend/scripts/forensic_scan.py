import asyncio
import httpx
from datetime import datetime, timezone, timedelta
from backend.database import SessionLocal
from backend.models import Student

ist_tz = timezone(timedelta(hours=5, minutes=30))
today_contest_start_ts = int(datetime(2026, 8, 23, 7, 30, 0, tzinfo=ist_tz).timestamp())

GRAPHQL_URL = 'https://leetcode.com/graphql'
QUERY = """
query getUserRecentSubmissions($username: String!) {
  recentAcSubmissionList(username: $username, limit: 15) {
    id
    title
    titleSlug
    timestamp
  }
}
"""

async def check_all():
    db = SessionLocal()
    students = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None))).all()
    print(f"Starting deep forensic scan across all {len(students)} students in DB...")
    print(f"Checking all AC submissions after today 07:30 AM IST (ts={today_contest_start_ts})...")
    
    today_active_students = []
    sem = asyncio.Semaphore(35)
    
    async with httpx.AsyncClient(timeout=12, limits=httpx.Limits(max_connections=70, max_keepalive_connections=35)) as client:
        async def fetch(s):
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
                        today_subs = []
                        for sub in subs:
                            sub_ts = int(sub.get('timestamp') or 0)
                            if sub_ts >= today_contest_start_ts:
                                dt = datetime.fromtimestamp(sub_ts, ist_tz).strftime('%H:%M:%S')
                                today_subs.append((sub.get('title'), dt))
                        if today_subs:
                            dept = s.department.code if s.department else 'CSE'
                            today_active_students.append({
                                'name': s.name,
                                'reg_no': s.reg_no,
                                'dept': dept,
                                'year': s.year_level,
                                'username': uname,
                                'subs': today_subs
                            })
                except Exception:
                    pass
        
        tasks = [fetch(s) for s in students]
        await asyncio.gather(*tasks)
        
    print("\n================================================================================")
    print(f"FORENSIC SCAN VERIFICATION AUDIT: TOTAL ACTIVE SOLVERS ON LEETCODE TODAY = {len(today_active_students)}")
    print("================================================================================")
    today_active_students.sort(key=lambda x: (x['dept'], -len(x['subs']), x['name']))
    for idx, st in enumerate(today_active_students, 1):
        titles = ', '.join([f"'{t}' at {time}" for t, time in st['subs']])
        print(f"{idx:2d}. {st['name']:<28} | {st['dept']:<8} | {st['year']:<3} Yr | {st['reg_no']:<12} | @{st['username']:<20} | {len(st['subs'])} Solves -> {titles}")

if __name__ == '__main__':
    asyncio.run(check_all())
