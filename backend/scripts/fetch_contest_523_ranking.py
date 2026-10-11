"""
fetch_contest_523_ranking.py
============================
Uses browser cf_clearance cookie to fetch official LeetCode Contest 523
ranking pages and update DB directly via the backend API.

Run from LOCAL machine (same IP as browser):
  python backend/scripts/fetch_contest_523_ranking.py
"""

import asyncio
import httpx
import json
import sys
import os
import math

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

# ─── COOKIES from browser (fresh) ─────────────────────────────────────────────
CF_CLEARANCE = "0mTClp7v9mKUAvrEA9Lg0SYc2u.Gvlnw1gk44r1_Ucs-1791733420.4359639-1.0.1.1-jST3bB5WjbRf4sNlYMWLo9En4N8o4ZkoRIVDgBNbu4702XaBqeLLyZe_e6FgqHZyY5b68IyadxRrdSDj8rdu3Nr6_poFEreBdhfDMIviVQVDQf4PMmHpl7U3QxFln18cnlOTaO4eT76wb9I9myFB9uaAWcLYZaVoaCzLiZjXXcD97gFi_aUXtAoBgO89d3XsXQyyUnDm.ru4irr3D36onwQV5jekHZkdMufB9WACsSdCYr16yr4xXWzX1RbEYC.foJJLHvQ_dQ681GWCmOl0Z5VWV5bjLM1wbNCAhiYPmM2x9vN7d9.ctQotvGLNH7xqN7CFFrPWDjUkHC1kcv38wYwRzXG3R4MYn4cSFxuu7gfRZNk6Bko0fx5INwjW_s0J.F9iYpSQ7vuV2ux5dxVWNOqbWPD_oWbvLxkPHbl2hclS_JdbcLUirTfdIzijbvIK57z71tbmZgFOxV6fo6XJ0TreDu5qnstiMwlZb7c7ZnNsQN3JXbEllG9SrSXs48S8Ffu1VlseBDSaq7sCBGuy1Q"
CSRF_TOKEN   = "WbJABBfD9sy24iGZKDE0Xp9EXNImKro1"
CFUVID       = "ojnHsfBmy2a6hZN0VwLfcbHa.qOaQFK4gfVzxjugqoA-1791733420.4359639-1.0.1.1-NZouWfy8TJgClMMn2GI1XWOJVz6At8KpFaqnksyE61U"

CONTEST_SLUG = "weekly-contest-523"
CONTEST_NUMBER = 523
# Use region=global for questions, global_v2 for full pagination
BASE_URL_GLOBAL    = f"https://leetcode.com/contest/api/ranking/{CONTEST_SLUG}/?pagination={{page}}&region=global"
BASE_URL_GLOBAL_V2 = f"https://leetcode.com/contest/api/ranking/{CONTEST_SLUG}/?pagination={{page}}&region=global_v2"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Referer": f"https://leetcode.com/contest/{CONTEST_SLUG}/ranking/",
    "Accept": "application/json, text/plain, */*",
    "Cookie": f"cf_clearance={CF_CLEARANCE}; csrftoken={CSRF_TOKEN}; _cfuvid={CFUVID}",
}


async def fetch_question_ids_via_graphql() -> list:
    """Fallback: fetch contest question IDs via LeetCode GraphQL (no Cloudflare block)"""
    query = """
    query contestInfo($titleSlug: String!) {
      contest(titleSlug: $titleSlug) {
        questions { questionId title titleSlug }
      }
    }"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                "https://leetcode.com/graphql",
                json={"query": query, "variables": {"titleSlug": CONTEST_SLUG}},
                headers={"User-Agent": "Mozilla/5.0", "Content-Type": "application/json"}
            )
            if r.status_code == 200:
                qs = (r.json().get("data") or {}).get("contest") or {}
                questions = qs.get("questions") or []
                q_ids = [str(q["questionId"]) for q in questions]
                print(f"[GraphQL] Got question IDs: {q_ids}")
                print(f"[GraphQL] Questions: {[q['title'] for q in questions]}")
                return q_ids
    except Exception as e:
        print(f"[GraphQL] Failed: {e}")
    return []


async def fetch_all_pages():
    print(f"[INFO] Fetching official ranking for {CONTEST_SLUG}...")
    
    async with httpx.AsyncClient(headers=HEADERS, timeout=15.0, follow_redirects=True) as client:
        # Test page 1 with region=global (returns questions array)
        r1 = await client.get(BASE_URL_GLOBAL.format(page=1))
        if r1.status_code != 200:
            print(f"[ERROR] Status {r1.status_code} — cf_clearance expired or IP mismatch!")
            print("  → Open Chrome DevTools → Application → Cookies → leetcode.com")
            print("  → Copy fresh cf_clearance value and update CF_CLEARANCE in this script")
            return None
        
        d1 = r1.json()
        total_users = d1.get("user_num", 0)
        total_pages = math.ceil(total_users / 25)
        questions   = d1.get("questions") or []
        q_ids       = [str(q.get("question_id") or q.get("id") or "") for q in questions if q.get("question_id") or q.get("id")]
        contest_start_ts = (d1.get("contest") or {}).get("start_time", 0)
        
        print(f"[OK] Total participants: {total_users} | Pages: {total_pages} | region=global questions: {q_ids}")
        
        # Fallback: get question IDs via GraphQL if still empty
        if not q_ids:
            print("[WARN] Questions empty from ranking API — trying GraphQL fallback...")
            q_ids = await fetch_question_ids_via_graphql()
        
        if not contest_start_ts:
            contest_start_ts = 1791685800  # Contest 523: Oct 5 2026 08:00 AM IST
            print(f"[WARN] Using hardcoded contest_start_ts: {contest_start_ts}")
        
        print(f"[INFO] Final question IDs: {q_ids} | start_ts: {contest_start_ts}")
        
        # Fetch all pages concurrently with global_v2 (better submission data)
        sem = asyncio.Semaphore(15)
        all_ranks = []
        all_subs  = []

        async def fetch_page(page):
            async with sem:
                for attempt in range(3):
                    try:
                        r = await client.get(BASE_URL_GLOBAL_V2.format(page=page))
                        if r.status_code == 200:
                            d = r.json()
                            return d.get("total_rank", []), d.get("submissions", [])
                        await asyncio.sleep(0.5 * (attempt + 1))
                    except Exception:
                        await asyncio.sleep(0.5)
                return [], []

        print(f"[INFO] Fetching all {total_pages} pages (this may take 2-5 minutes)...")
        tasks = [fetch_page(p) for p in range(1, total_pages + 1)]
        results = await asyncio.gather(*tasks)
        
        for ranks, subs in results:
            all_ranks.extend(ranks)
            all_subs.extend(subs)
        
        print(f"[INFO] Fetched {len(all_ranks)} total ranking entries")
        return all_ranks, all_subs, q_ids, contest_start_ts


def build_solver_map(all_ranks, all_subs, q_ids, contest_start_ts):
    """Build {username_lower: {q1,q2,q3,q4,rank,score,finish_time}} map"""
    solver_map = {}
    
    for idx, entry in enumerate(all_ranks):
        slug  = (entry.get("user_slug") or "").strip().lower()
        uname = (entry.get("username") or "").strip().lower()
        
        sub_dict = entry.get("submissions") or {}
        if not sub_dict and idx < len(all_subs):
            sub_dict = all_subs[idx] or {}
        
        q_solves = [0, 0, 0, 0]
        q_secs   = [None, None, None, None]
        
        for q_idx, q_key in enumerate(q_ids[:4]):
            if q_key in sub_dict:
                q_solves[q_idx] = 1
                if "date" in sub_dict[q_key] and contest_start_ts:
                    q_secs[q_idx] = sub_dict[q_key]["date"] - contest_start_ts
        
        record = {
            "q1": q_solves[0], "q2": q_solves[1],
            "q3": q_solves[2], "q4": q_solves[3],
            "total_solved": sum(q_solves),
            "rank": entry.get("rank"),
            "score": entry.get("score"),
            "finish_time": entry.get("finish_time"),
            "q1_secs": q_secs[0], "q2_secs": q_secs[1],
            "q3_secs": q_secs[2], "q4_secs": q_secs[3],
        }
        
        if slug:
            solver_map[slug] = record
        if uname and uname != slug:
            solver_map[uname] = record
    
    return solver_map


def match_students_and_update(solver_map):
    """Match against DB students and update records"""
    from backend.database import SessionLocal
    from backend.models import Student, WeeklySession, WeeklyPublicResult, PreviousWeekParticipationRecord
    from backend.cache import cache
    
    db = SessionLocal()
    try:
        session = db.query(WeeklySession).filter(
            WeeklySession.contest_name.ilike(f"%{CONTEST_NUMBER}%")
        ).first()
        
        if not session:
            print(f"[ERROR] Session for Contest {CONTEST_NUMBER} not found in DB!")
            return
        
        print(f"[INFO] Found session: {session.contest_name} (ID: {session.id})")
        
        students = db.query(Student).filter(
            Student.is_active == True,
            Student.username.isnot(None)
        ).all()
        
        matched = 0
        not_found = 0
        
        for st in students:
            uname_lower = (st.username or "").strip().lower()
            if not uname_lower:
                continue
            
            data = solver_map.get(uname_lower)
            if not data:
                continue
            
            # Update WeeklyPublicResult
            wpr = db.query(WeeklyPublicResult).filter(
                WeeklyPublicResult.session_id == session.id,
                WeeklyPublicResult.student_id == st.id
            ).first()
            
            if wpr:
                wpr.q1 = data["q1"]
                wpr.q2 = data["q2"]
                wpr.q3 = data["q3"]
                wpr.q4 = data["q4"]
                wpr.total_contest_solved = data["total_solved"]
                if data["score"] is not None:
                    wpr.contest_score = data["score"]
                if data["rank"] is not None:
                    wpr.contest_rank = data["rank"]
                wpr.participation_status = "PUBLIC_ATTENDED"
                wpr.confidence = "VERIFIED"
                wpr.fetch_status = "SUCCESS"
                matched += 1
                print(f"  ✓ {st.name} (@{st.username}) → Q{data['q1']}/{data['q2']}/{data['q3']}/{data['q4']} | Rank #{data['rank']}")
            else:
                not_found += 1
        
        db.commit()
        
        try:
            cache.clear()
        except Exception:
            pass
        
        print(f"\n{'='*70}")
        print(f"DONE: {matched} students matched & updated | {not_found} students had no WPR record")
        print(f"{'='*70}")
        
    finally:
        db.close()


async def main():
    result = await fetch_all_pages()
    if result is None:
        return
    
    all_ranks, all_subs, q_ids, contest_start_ts = result
    
    print(f"\n[INFO] Building solver map from {len(all_ranks)} entries...")
    solver_map = build_solver_map(all_ranks, all_subs, q_ids, contest_start_ts)
    print(f"[INFO] Solver map has {len(solver_map)} unique usernames")
    
    # Save solver_map to JSON for EC2 upload
    import json as _json
    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "contest_523_solver_map.json")
    with open(out_path, "w", encoding="utf-8") as f:
        _json.dump(solver_map, f, ensure_ascii=False, indent=2)
    print(f"\n[SAVED] Solver map saved to: {out_path}")
    print(f"[NEXT] Upload this file to EC2 and run:")
    print(f"  scp backend/scripts/contest_523_solver_map.json ubuntu@13.53.231.6:/var/www/leetcode-tracker/backend/scripts/")
    print(f"  Then on EC2:")
    print(f"  cd /var/www/leetcode-tracker")
    print(f"  /var/www/leetcode-tracker/.venv/bin/python3 backend/scripts/apply_contest_523_from_json.py")
    
    print(f"\n[INFO] Also updating LOCAL DB for verification...")
    match_students_and_update(solver_map)


if __name__ == "__main__":
    asyncio.run(main())
