import json

with open('data/contest_524_authentic_scanned_solvers.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

items = data.values() if isinstance(data, dict) else data

print("=== IT - 2028 STUDENTS IN CONTEST 524 ===")
it_2028 = [x for x in items if (x.get('dept') == 'IT' or 'IT' in str(x.get('reg_no'))) and ('732224' in str(x.get('reg_no')))]
print(f"Total IT 2028: {len(it_2028)}")
for s in sorted(it_2028, key=lambda x: x.get('total_solved', 0), reverse=True):
    print(f"Reg: {s.get('reg_no')} | Name: {s.get('name'):<25} | Solved: {s.get('total_solved')}Q | Score: {s.get('score')} | Rank: {s.get('rank')}")

print("\n=== IT - 2029 STUDENTS IN CONTEST 524 ===")
it_2029 = [x for x in items if (x.get('dept') == 'IT' or 'IT' in str(x.get('reg_no'))) and ('732225' in str(x.get('reg_no')))]
print(f"Total IT 2029: {len(it_2029)}")
for s in sorted(it_2029, key=lambda x: x.get('total_solved', 0), reverse=True)[:15]:
    print(f"Reg: {s.get('reg_no')} | Name: {s.get('name'):<25} | Solved: {s.get('total_solved')}Q | Score: {s.get('score')} | Rank: {s.get('rank')}")

