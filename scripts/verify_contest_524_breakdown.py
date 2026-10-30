import sqlite3
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

db_path = "data/leetcode_tracker.db"
conn = sqlite3.connect(db_path)
c = conn.cursor()

print("=== 1. CONTEST 524 IN DATABASE (SESSION 17) ===")
c.execute("""
SELECT 
    d.name,
    s.batch,
    s.year_level,
    wpr.total_contest_solved,
    COUNT(*)
FROM weekly_public_results wpr
JOIN students s ON wpr.student_id = s.id
LEFT JOIN departments d ON s.department_id = d.id
WHERE wpr.session_id = 17
GROUP BY d.name, s.batch, s.year_level, wpr.total_contest_solved
ORDER BY d.name, s.batch, s.year_level, wpr.total_contest_solved DESC
""")
rows = c.fetchall()
print(f"Total grouped rows in DB for Session 17: {len(rows)}")

# Let's aggregate by Department and Batch
stats = {}
for dname, batch, year, solved, count in rows:
    dept_key = dname or "Unknown"
    # normalize batch / year
    key = (dept_key, batch or year)
    if key not in stats:
        stats[key] = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 'attended': 0, 'not_attended': 0, 'total': 0}
    stats[key][solved] = stats[key].get(solved, 0) + count
    if solved > 0:
        stats[key]['attended'] += count
    stats[key]['total'] += count

for k, v in sorted(stats.items()):
    print(f"{k[0]} | {k[1]} -> 4Q:{v.get(4,0)} 3Q:{v.get(3,0)} 2Q:{v.get(2,0)} 1Q:{v.get(1,0)} 0Q:{v.get(0,0)} | Attended:{v['attended']} Total:{v['total']}")

print("\n=== 2. CONTEST 524 AUTHENTIC SCANNED SOLVERS JSON ===")
json_path = "data/contest_524_authentic_scanned_solvers.json"
try:
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    print(f"Total entries in JSON: {len(data)}")
    
    # Check sample entry
    first_key = list(data.keys())[0] if isinstance(data, dict) else 0
    print("Sample entry:", data[first_key])
    
    json_stats = {}
    items = data.values() if isinstance(data, dict) else data
    for item in items:
        dept = item.get('dept') or item.get('department')
        reg = item.get('reg_no', '')
        # Check batch from reg_no
        # e.g. 732224IT -> 2024 joining -> batch 2028 (IV-2024, III-2025? Wait, let's check reg_no pattern)
        # In Anna University / Nandha:
        # 732224xxx: 24 entry -> graduation 2028 (Batch 2028 / III Year in 2026)
        # 732225xxx: 25 entry -> graduation 2029 (Batch 2029 / II Year in 2026)
        tot_q = item.get('total_solved', 0)
        q1 = item.get('q1', 0)
        q2 = item.get('q2', 0)
        q3 = item.get('q3', 0)
        q4 = item.get('q4', 0)
        q_sum = q1 + q2 + q3 + q4
        
        # Batch determination
        batch = "Unknown"
        if "24" in reg[4:8] or reg.startswith("732224"):
            batch = "2028"
        elif "25" in reg[4:8] or reg.startswith("732225"):
            batch = "2029"
        elif "23" in reg[4:8] or reg.startswith("732223"):
            batch = "2027"
            
        bkey = (dept, batch)
        if bkey not in json_stats:
            json_stats[bkey] = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 'total': 0}
        json_stats[bkey][q_sum] = json_stats[bkey].get(q_sum, 0) + 1
        json_stats[bkey]['total'] += 1

    print("\n--- JSON Solver Counts by Dept and Batch ---")
    for k, v in sorted(json_stats.items(), key=lambda x: str(x[0])):
        print(f"{k[0]} | Batch {k[1]} -> 4Q:{v.get(4,0)} 3Q:{v.get(3,0)} 2Q:{v.get(2,0)} 1Q:{v.get(1,0)} 0Q:{v.get(0,0)} | Total Solvers:{v['total']}")

except Exception as e:
    print("Error reading json:", e)

conn.close()

