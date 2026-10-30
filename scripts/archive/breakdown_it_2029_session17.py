import sqlite3

db_path = "data/leetcode_tracker.db"
conn = sqlite3.connect(db_path)
c = conn.cursor()

c.execute("""
SELECT s.reg_no, s.name, wpr.total_contest_solved, wpr.participation_status, wpr.contest_score
FROM weekly_public_results wpr
JOIN students s ON wpr.student_id = s.id
WHERE wpr.session_id = 17 AND s.reg_no LIKE '732225IT%'
ORDER BY wpr.total_contest_solved DESC, s.reg_no
""")
rows = c.fetchall()
print(f"Total rows in Session 17 for IT-2029: {len(rows)}")

solvers_3 = [r for r in rows if r[2] == 3]
solvers_2 = [r for r in rows if r[2] == 2]
solvers_1 = [r for r in rows if r[2] == 1]
solvers_0 = [r for r in rows if r[2] == 0 and r[3] != 'ABSENT']
absent = [r for r in rows if r[3] == 'ABSENT']

print(f"3Q solvers: {len(solvers_3)}")
print(f"2Q solvers: {len(solvers_2)}")
print(f"1Q solvers: {len(solvers_1)}")
print(f"0Q attended: {len(solvers_0)}")
print(f"Absent: {len(absent)}")

print("\n--- 2Q Solvers in our system (11 students) ---")
for r in solvers_2:
    print(r)

print("\n--- 0Q Attended in our system (7 students) ---")
for r in solvers_0:
    print(r)

conn.close()

