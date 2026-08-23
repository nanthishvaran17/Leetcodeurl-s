from backend.database import SessionLocal
from backend.routes.reports import _get_dataset_for_id

db = SessionLocal()

tests = [
    ('CSE(CS)', 'ALL', 'ALL', 152, 54, 98),
    ('CSE(CS)', 'III', 'ALL', 63, 26, 37),
    ('CSE(CS)', 'II',  'ALL', 61, 20, 41),
    ('CSE(CS)', 'IV',  'ALL', 28, 8,  20),
    ('IT',      'III', 'ALL', 127, None, None),
]

all_pass = True
for dept, year, att, exp_total, exp_att, exp_not in tests:
    ds, _ = _get_dataset_for_id('Session_21', db, dept=dept, year=year, attendance=att)
    rows = ds.get('rows', [])
    att_rows = [r for r in rows if r.get('status','').upper() in ('PUBLIC','VIRTUAL','PUBLIC_ATTENDED','ATTENDED')]
    not_rows = [r for r in rows if r.get('status','').upper() not in ('PUBLIC','VIRTUAL','PUBLIC_ATTENDED','ATTENDED')]
    ok = len(rows) == exp_total
    all_pass = all_pass and ok
    status = "PASS" if ok else "FAIL"
    print(f"dept={dept:<8} year={year:<4} | total={len(rows):>4} (exp {exp_total:>4}) | att={len(att_rows):>3} | not={len(not_rows):>3} | {status}")

print()
print("OVERALL:", "ALL PASS" if all_pass else "SOME FAILED")
