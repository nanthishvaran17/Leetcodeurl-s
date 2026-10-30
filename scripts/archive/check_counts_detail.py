import sqlite3

db_path = "data/leetcode_tracker.db"
conn = sqlite3.connect(db_path)
c = conn.cursor()

print("=== TOTAL BREAKDOWN OF STUDENTS TABLE (694) ===")
c.execute("""
SELECT 
    d.name,
    COUNT(*) as total,
    SUM(CASE WHEN s.is_active = 1 THEN 1 ELSE 0 END) as active,
    SUM(CASE WHEN s.username IS NOT NULL AND s.username != '' THEN 1 ELSE 0 END) as has_user,
    SUM(CASE WHEN s.username IS NULL OR s.username = '' THEN 1 ELSE 0 END) as no_user
FROM students s
LEFT JOIN departments d ON s.department_id = d.id
GROUP BY d.name
ORDER BY total DESC
""")
for r in c.fetchall():
    print(f"Dept: {r[0]:<50} | Total: {r[1]:<4} | Active: {r[2]:<4} | HasUser: {r[3]:<4} | NoUser: {r[4]:<4}")

print("\n=== TOTAL BY YEAR LEVEL ===")
c.execute("""
SELECT year_level, COUNT(*), SUM(is_active)
FROM students
GROUP BY year_level
""")
for r in c.fetchall():
    print(f"Year: {r[0]:<15} | Total: {r[1]:<4} | Active: {r[2]}")

print("\n=== RECENT SUBMISSIONS / LEETCODE FETCH LOGS ===")
c.execute("SELECT MIN(created_at), MAX(created_at) FROM submission_log")
print("Submission log date range:", c.fetchone())

conn.close()

