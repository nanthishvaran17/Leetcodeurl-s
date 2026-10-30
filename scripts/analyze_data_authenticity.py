import sqlite3
import os

db_path = "data/leetcode_tracker.db"
conn = sqlite3.connect(db_path)
c = conn.cursor()

print("--- 1. DATABASE RECORD COUNTS ---")
c.execute("SELECT COUNT(*) FROM students")
total_students = c.fetchone()[0]
print(f"Total students in students table: {total_students}")

c.execute("SELECT COUNT(*) FROM students WHERE is_active = 1")
active_students = c.fetchone()[0]
print(f"Active students (is_active=1): {active_students}")

c.execute("SELECT COUNT(*) FROM students WHERE is_active = 0")
inactive_students = c.fetchone()[0]
print(f"Inactive students (is_active=0): {inactive_students}")

print("\n--- 2. BREAKDOWN BY DEPARTMENT & YEAR ---")
query = """
SELECT COALESCE(d.name, 'No Dept') as dept_name, s.year_level, s.is_active, COUNT(*)
FROM students s
LEFT JOIN departments d ON s.department_id = d.id
GROUP BY dept_name, s.year_level, s.is_active
ORDER BY dept_name, s.year_level
"""
c.execute(query)
for row in c.fetchall():
    print(f"Dept: {row[0]:<15} | Year: {row[1]:<5} | Active: {row[2]} | Count: {row[3]}")

print("\n--- 3. LEETCODE USERNAME AVAILABILITY ---")
c.execute("SELECT COUNT(*) FROM students WHERE username IS NOT NULL AND username != ''")
with_username = c.fetchone()[0]
print(f"Students with LeetCode username: {with_username}")

c.execute("SELECT COUNT(*) FROM students WHERE username IS NULL OR username = ''")
without_username = c.fetchone()[0]
print(f"Students WITHOUT LeetCode username: {without_username}")

print("\n--- 4. LC_PROFILES STATS ---")
c.execute("SELECT COUNT(*) FROM lc_profiles")
total_profiles = c.fetchone()[0]
print(f"Total rows in lc_profiles: {total_profiles}")

c.execute("PRAGMA table_info(lc_profiles)")
cols = [r[1] for r in c.fetchall()]
print(f"Columns in lc_profiles: {cols}")

c.execute("SELECT MIN(total_solved), MAX(total_solved), AVG(total_solved) FROM lc_profiles")
solv_stats = c.fetchone()
print(f"Total Solved stats: Min={solv_stats[0]}, Max={solv_stats[1]}, Avg={solv_stats[2]:.1f}")

c.execute("SELECT COUNT(*) FROM lc_profiles WHERE total_solved = 0")
zero_solvers = c.fetchone()[0]
print(f"Profiles with total_solved = 0: {zero_solvers}")

print("\n--- 5. CONTEST SESSIONS & PARTICIPATIONS ---")
c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%contest%'")
contest_tables = [r[0] for r in c.fetchall()]
print(f"Contest tables: {contest_tables}")

for t in contest_tables:
    c.execute(f"SELECT COUNT(*) FROM {t}")
    print(f"Count in {t}: {c.fetchone()[0]}")

conn.close()

