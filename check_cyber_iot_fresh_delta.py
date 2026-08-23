# check_cyber_iot_fresh_delta.py
import os
import sys
import json
import time
import datetime
from zoneinfo import ZoneInfo
from concurrent.futures import ThreadPoolExecutor, as_completed
import pandas as pd

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from backend.leetcode_fetcher import fetch_leetcode_profile_sync

IST = ZoneInfo("Asia/Kolkata")
STUDENTS_EXCEL_PATH = os.path.abspath("students.xlsx")
CACHE_FILE = "cyber_iot_scan_cache.json"

def parse_year_num(val):
    if not val or str(val).strip() == "nan": return 3
    s = str(val).strip().upper()
    if s in ('I', '1'): return 1
    if s in ('II', '2'): return 2
    if s in ('III', '3'): return 3
    if s in ('IV', '4'): return 4
    digits = ''.join(filter(str.isdigit, s))
    return int(digits) if digits else 3

def load_roster():
    df = pd.read_excel(STUDENTS_EXCEL_PATH)
    students = []
    for idx, row in df.iterrows():
        name = str(row.get("Name", "") or "").strip()
        reg_no = str(row.get("RollNumber", "") or "").strip()
        dept_raw = str(row.get("Department", "") or "").strip().upper()
        year_num = parse_year_num(row.get("Year", 3))
        username = str(row.get("LeetCodeUsername", "") or "").strip()
        
        if "IOT" in dept_raw or "INTERNET" in dept_raw or "CI" in reg_no.upper():
            dept_code = "CSE(IOT)"
            dept_name = "IoT"
        elif "CS" in dept_raw or "CYBER" in dept_raw or "CC" in reg_no.upper():
            dept_code = "CSE(CS)"
            dept_name = "Cyber Security"
        else:
            continue # Only Cyber and IoT
            
        students.append({
            "id": idx + 1,
            "name": name,
            "reg_no": reg_no,
            "department": dept_code,
            "dept_name": dept_name,
            "year": year_num,
            "username": username if username != "nan" else "",
            "is_valid_user": bool(username and username != "nan" and len(username) > 1)
        })
    return students

def fetch_student(s):
    u = s["username"]
    if not s["is_valid_user"]:
        return {**s, "total_solved": 0, "easy_solved": 0, "medium_solved": 0, "hard_solved": 0, "rating": 0.0, "w516_solved": 0, "w516_status": "NOT_ATTENDED", "status": "MISSING_USER"}
    try:
        prof = fetch_leetcode_profile_sync(u, timeout=10, max_retries=2)
        if prof.get("status") == "success" and prof.get("total_solved") is not None:
            tot = int(prof.get("total_solved") or 0)
            easy = int(prof.get("easy_solved") or 0)
            med = int(prof.get("medium_solved") or 0)
            hard = int(prof.get("hard_solved") or 0)
            rating = round(float(prof.get("contest_rating") or 0.0), 1)
            
            parts = prof.get("contest_participations") or []
            w516_solved, w516_stat = 0, "NOT_ATTENDED"
            for p in parts:
                c_name = str(p.get("contest_name", ""))
                if "516" in c_name:
                    w516_solved = int(p.get("problems_solved") or 0)
                    w516_stat = p.get("participation_type", "OFFICIAL")
                    
            return {
                **s, "total_solved": tot, "easy_solved": easy, "medium_solved": med, "hard_solved": hard,
                "rating": rating, "w516_solved": w516_solved, "w516_status": w516_stat, "status": "VERIFIED"
            }
        return {**s, "total_solved": 0, "easy_solved": 0, "medium_solved": 0, "hard_solved": 0, "rating": 0.0, "w516_solved": 0, "w516_status": "NOT_ATTENDED", "status": "ZERO_SOLVED"}
    except Exception as e:
        return {**s, "total_solved": 0, "easy_solved": 0, "medium_solved": 0, "hard_solved": 0, "rating": 0.0, "w516_solved": 0, "w516_status": "NOT_ATTENDED", "status": "ERROR"}

def main():
    print("=" * 80)
    print("RE-SCAN & DELTA VERIFICATION — CYBER SECURITY & IOT ONLY")
    print(f"Timestamp: {datetime.datetime.now(IST).strftime('%Y-%m-%d %H:%M:%S IST')}")
    print("=" * 80)
    
    # 1. Load previous baseline from cache
    prev_map = {}
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                prev_list = json.load(f)
                for item in prev_list:
                    uname = item.get("username", "")
                    if uname:
                        prev_map[uname] = item
            print(f"Loaded previous baseline ({len(prev_map)} profiles) from {CACHE_FILE}")
        except Exception:
            pass

    # 2. Load roster
    students = load_roster()
    cs_students = [s for s in students if s["department"] == "CSE(CS)"]
    iot_students = [s for s in students if s["department"] == "CSE(IOT)"]
    print(f"Targeting: {len(cs_students)} Cyber Security + {len(iot_students)} IoT = {len(students)} Students")

    # 3. Live Concurrent Rescan
    print("\nScanning all Cyber Security & IoT student profiles live...")
    t0 = time.time()
    fresh_results = []
    with ThreadPoolExecutor(max_workers=15) as executor:
        futures = {executor.submit(fetch_student, s): s for s in students}
        done = 0
        for f in as_completed(futures):
            res = f.result()
            fresh_results.append(res)
            done += 1
            if done % 50 == 0 or done == len(students):
                print(f"  -> Scanned [{done}/{len(students)}]...")
                
    elapsed = round(time.time() - t0, 2)
    print(f"✅ Completed fresh live re-scan in {elapsed}s.")

    # 4. Compare Deltas
    added_solves_students = []
    for cur in fresh_results:
        u = cur["username"]
        prev = prev_map.get(u, {})
        prev_tot = prev.get("total_solved", 0)
        cur_tot = cur.get("total_solved", 0)
        delta = cur_tot - prev_tot
        
        prev_w516 = prev.get("w516_solved", 0)
        cur_w516 = cur.get("w516_solved", 0)
        w516_delta = cur_w516 - prev_w516
        
        if delta != 0 or w516_delta != 0:
            added_solves_students.append({
                "name": cur["name"],
                "reg_no": cur["reg_no"],
                "dept": cur["department"],
                "username": u,
                "prev_total": prev_tot,
                "new_total": cur_tot,
                "delta": delta,
                "prev_w516": prev_w516,
                "new_w516": cur_w516,
                "w516_delta": w516_delta
            })

    # Sort fresh results
    fresh_results.sort(key=lambda x: (x["total_solved"], x["rating"]), reverse=True)

    # 5. Overwrite cache with fresh results
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(fresh_results, f, indent=2)

    # 6. Aggregates
    cs_fresh = [s for s in fresh_results if s["department"] == "CSE(CS)"]
    iot_fresh = [s for s in fresh_results if s["department"] == "CSE(IOT)"]

    cs_prev_tot = sum(prev_map.get(s["username"], {}).get("total_solved", 0) for s in cs_students)
    cs_cur_tot = sum(s["total_solved"] for s in cs_fresh)
    cs_act = sum(1 for s in cs_fresh if s["total_solved"] > 0)

    iot_prev_tot = sum(prev_map.get(s["username"], {}).get("total_solved", 0) for s in iot_students)
    iot_cur_tot = sum(s["total_solved"] for s in iot_fresh)
    iot_act = sum(1 for s in iot_fresh if s["total_solved"] > 0)

    print("\n" + "=" * 80)
    print("📊 FRESH RE-SCAN RESULTS & DELTA SUMMARY:")
    print("=" * 80)
    print(f"Cyber Security [CSE(CS)] (159 students):")
    print(f"  - Active Solvers:  {cs_act} / 159 ({round(cs_act/159*100, 1)}%)")
    print(f"  - Total Solved:    {cs_cur_tot:,} problems (Previous: {cs_prev_tot:,} | Delta: {cs_cur_tot - cs_prev_tot:+d})")
    
    print(f"\nIoT [CSE(IOT)] (140 students):")
    print(f"  - Active Solvers:  {iot_act} / 140 ({round(iot_act/140*100, 1)}%)")
    print(f"  - Total Solved:    {iot_cur_tot:,} problems (Previous: {iot_prev_tot:,} | Delta: {iot_cur_tot - iot_prev_tot:+d})")
    
    print(f"\nCombined (299 students):")
    print(f"  - Total Solved:    {cs_cur_tot + iot_cur_tot:,} problems (Delta: {(cs_cur_tot + iot_cur_tot) - (cs_prev_tot + iot_prev_tot):+d})")
    print(f"  - Newly Added/Changed Solves Count: {len(added_solves_students)} students")

    if added_solves_students:
        print("\n🔥 STUDENTS WITH NEW SOLVES / UPDATES:")
        for s in added_solves_students:
            print(f"  * {s['name']} ({s['dept']} • {s['reg_no']}): Total Solved {s['prev_total']} -> {s['new_total']} ({s['delta']:+d}), W516: {s['prev_w516']} -> {s['new_w516']}")
    else:
        print("\n✨ All student solve counts are identical & 100% stable (No new submissions detected between runs).")

if __name__ == "__main__":
    main()
