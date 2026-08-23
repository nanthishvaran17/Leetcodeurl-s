import urllib.request
import json
import time
import datetime
import zoneinfo
from backend.database import SessionLocal
from backend.models import Student

db = SessionLocal()
students = db.query(Student).filter(Student.leetcode_url.isnot(None), Student.leetcode_url != '').all()
print(f"Total students with URLs: {len(students)}")

ist_tz = zoneinfo.ZoneInfo("Asia/Kolkata")
today_start_ts = int(datetime.datetime(2026, 8, 23, 0, 0, 0, tzinfo=ist_tz).timestamp())
contest_start_ts = int(datetime.datetime(2026, 8, 23, 8, 0, 0, tzinfo=ist_tz).timestamp())

query = """
query userSubs($u: String!) {
  recentAcSubmissionList(username: $u, limit: 10) {
    id
    title
    timestamp
  }
}
""".replace("$u", "$username")

today_solvers = []
checked = 0

for st in students[:100]:
    u = st.username or st.leetcode_url.strip("/").split("/")[-1]
    if not u or len(u) < 2:
        continue
    checked += 1
    req = urllib.request.Request(
        "https://leetcode.com/graphql",
        data=json.dumps({"query": query, "variables": {"username": u}}).encode("utf-8"),
        headers={"User-Agent": "Mozilla/5.0", "Content-Type": "application/json", "Referer": "https://leetcode.com"}
    )
    try:
        with urllib.request.urlopen(req, timeout=4) as res:
            data = json.loads(res.read().decode("utf-8"))
            subs = data.get("data", {}).get("recentAcSubmissionList", [])
            for s in subs:
                ts = int(s.get("timestamp", 0))
                if ts >= today_start_ts:
                    today_solvers.append({
                        "name": st.name,
                        "reg_no": st.reg_no,
                        "dept": st.department.code if st.department else "CSE",
                        "handle": u,
                        "title": s.get("title"),
                        "timestamp": ts,
                        "time_str": time.ctime(ts),
                        "is_in_contest_window": ts >= contest_start_ts
                    })
    except Exception:
        pass

print(f"Checked {checked} students. Found {len(today_solvers)} AC submissions today:")
for sol in today_solvers:
    print(f"  - {sol['name']} ({sol['dept']} - {sol['handle']}): {sol['title']} at {sol['time_str']} (In Window: {sol['is_in_contest_window']})")
