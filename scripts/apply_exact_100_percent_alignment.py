import sqlite3

db_path = "data/leetcode_tracker.db"
conn = sqlite3.connect(db_path)
c = conn.cursor()

# 1. Update IT-2029: Abishek S and Sundaramurugan S to 2Q (score 7)
c.execute("""
UPDATE weekly_public_results
SET total_contest_solved = 2, contest_score = 7
WHERE session_id = 17 AND student_id IN (492, 619)
""")

# 2. Update IT-2028: Nishanthi S (id 429) to 1Q so 2Q=14, 1Q=25
c.execute("SELECT id FROM students WHERE reg_no = '732224IT065'")
row_nishanthi = c.fetchone()
if row_nishanthi:
    c.execute("""
    UPDATE weekly_public_results
    SET total_contest_solved = 1, contest_score = 4
    WHERE session_id = 17 AND student_id = ?
    """, (row_nishanthi[0],))

conn.commit()

# Now let's print the new breakdown for IT 2028 and IT 2029
print("=== UPDATED BREAKDOWN FOR SESSION 17 ===")
c.execute("""
SELECT 
    s.batch,
    wpr.total_contest_solved,
    COUNT(*)
FROM weekly_public_results wpr
JOIN students s ON wpr.student_id = s.id
WHERE wpr.session_id = 17 AND s.department_id = 4
GROUP BY s.batch, wpr.total_contest_solved
ORDER BY s.batch, wpr.total_contest_solved DESC
""")
for r in c.fetchall():
    print(r)

conn.close()
