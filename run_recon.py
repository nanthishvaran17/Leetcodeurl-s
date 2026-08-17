import sys, csv
from backend.database import SessionLocal
from backend.models import Student, WeeklyPublicResult, WeeklyVirtualResult
from backend.services.weekly_report_service import classify_public_contest_outcome, classify_virtual_contest_outcome
from collections import defaultdict

db = SessionLocal()
students = db.query(Student).order_by(Student.department_id, Student.reg_no).all()
pub_515 = {r.student_id: r for r in db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == 5).all()}
vir_515 = {r.student_id: r for r in db.query(WeeklyVirtualResult).filter(WeeklyVirtualResult.session_id == 5).all()}
pub_514 = {r.student_id: r for r in db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == 16).all()}

mismatches = defaultdict(list)
rows = []
SOLVED = frozenset({"1_SOLVED","2_SOLVED","3_SOLVED","4_SOLVED","0_SOLVED"})
NP = "NOT_PARTICIPATED"

for s in students:
    pub_r = pub_515.get(s.id)
    vir_r = vir_515.get(s.id)
    dept = s.department.code if s.department else "UNKNOWN"
    pub_status_db = getattr(pub_r, "participation_status", None)
    pub_fetch_db  = getattr(pub_r, "data_fetch_status", None)
    pub_solved_db = getattr(pub_r, "total_contest_solved", None)
    pub_outcome   = classify_public_contest_outcome(pub_r)
    vir_outcome   = classify_virtual_contest_outcome(vir_r)
    last_pub_out  = classify_public_contest_outcome(pub_514.get(s.id))

    if pub_r is None:                                        mismatches["K_missing"].append(s.reg_no)
    if not s.username or not str(s.username).strip():        mismatches["L_null_username"].append(s.reg_no)
    if pub_fetch_db in ("INVALID_USERNAME","USERNAME_NOT_FOUND"): mismatches["L2_bad_username"].append(s.reg_no)
    if pub_status_db == "PUBLIC" and pub_outcome == NP:      mismatches["A_participated_misclassified"].append(s.reg_no)
    if pub_solved_db and pub_solved_db > 0 and pub_outcome not in SOLVED:
        mismatches["B_C_solved_wrong_outcome"].append(f"{s.reg_no}:s={pub_solved_db}:o={pub_outcome}")
    rows.append({"reg_no": s.reg_no, "name": s.name, "dept": dept,
                 "year": s.year_level or "N/A", "username": s.username or "NULL",
                 "pub_status_db": pub_status_db or "MISSING",
                 "pub_fetch": pub_fetch_db or "MISSING",
                 "pub_solved_db": pub_solved_db,
                 "pub_q1": getattr(pub_r,"q1",None), "pub_q2": getattr(pub_r,"q2",None),
                 "pub_q3": getattr(pub_r,"q3",None), "pub_q4": getattr(pub_r,"q4",None),
                 "pub_outcome": pub_outcome,
                 "vir_status_db": getattr(vir_r,"participation_status",None),
                 "vir_solved_db": getattr(vir_r,"total_contest_solved",None),
                 "vir_outcome": vir_outcome,
                 "last_pub": last_pub_out})
db.close()

print("BEFORE (raw DB participation_status):")
bc = defaultdict(int)
for r in rows: bc[r["pub_status_db"]] += 1
for k,v in sorted(bc.items()): print("  %s: %d" % (k,v))
print("  TOTAL: %d" % sum(bc.values()))

print("\nAFTER (canonical classifier - all 302):")
ac = defaultdict(int)
for r in rows: ac[r["pub_outcome"]] += 1
for k,v in sorted(ac.items()): print("  %s: %d" % (k,v))
print("  TOTAL: %d" % sum(ac.values()))

print("\nMISMATCHES:")
for cat,lst in sorted(mismatches.items()):
    print("  %s: %d" % (cat, len(lst)))
    for x in lst[:3]: print("    -> %s" % x)
    if len(lst)>3: print("    ...+%d more" % (len(lst)-3))

print("\nDEPT BREAKDOWN:")
dr = defaultdict(list)
for r in rows: dr[r["dept"]].append(r)
for dept in sorted(dr.keys()):
    drows = dr[dept]
    c = defaultdict(int)
    for r in drows: c[r["pub_outcome"]] += 1
    p = sum(c[o] for o in ["4_SOLVED","3_SOLVED","2_SOLVED","1_SOLVED","0_SOLVED"])
    print("  %s total=%d: part=%d not_part=%d unk=%d 4Q=%d 3Q=%d 2Q=%d 1Q=%d" % (
        dept, len(drows), p, c["NOT_PARTICIPATED"], c["UNKNOWN"],
        c["4_SOLVED"], c["3_SOLVED"], c["2_SOLVED"], c["1_SOLVED"]))

print("\nBATCH BREAKDOWN:")
BM = [("I","2026-2030"),("II","2025-2029"),("III","2024-2028"),("IV","2023-2027")]
for yr,lbl in BM:
    brows = [r for r in rows if r["year"]==yr]
    c = defaultdict(int)
    for r in brows: c[r["pub_outcome"]] += 1
    p = sum(c[o] for o in ["4_SOLVED","3_SOLVED","2_SOLVED","1_SOLVED","0_SOLVED"])
    print("  %s (%s) total=%d: part=%d not_part=%d unk=%d 4Q=%d 3Q=%d 2Q=%d 1Q=%d" % (
        yr, lbl, len(brows), p, c["NOT_PARTICIPATED"], c["UNKNOWN"],
        c["4_SOLVED"], c["3_SOLVED"], c["2_SOLVED"], c["1_SOLVED"]))

with open("Contest515_Full_Reconciliation.csv","w",newline="",encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader(); w.writerows(rows)
print("\nSaved: Contest515_Full_Reconciliation.csv (%d rows)" % len(rows))
