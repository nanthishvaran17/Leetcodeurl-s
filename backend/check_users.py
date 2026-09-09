import sqlite3

conn = sqlite3.connect('data/leetcode_tracker.db')
c = conn.cursor()

print("=== All Users ===")
c.execute("SELECT id, username, role, department_id, is_active FROM users")
for row in c.fetchall():
    print(row)

print("\n=== Faculty/Staff Users ===")
c.execute("SELECT id, username, role, department_id, is_active FROM users WHERE lower(role) LIKE '%staff%' OR lower(role) LIKE '%faculty%'")
for row in c.fetchall():
    print(row)

print("\n=== Department Health Sample ===")
c.execute("SELECT COUNT(*) FROM students WHERE is_active=1")
print("Active students:", c.fetchone())
c.execute("SELECT AVG(total_solved) FROM leetcode_profile_stats l JOIN students s ON l.student_id=s.id WHERE s.is_active=1")
print("Avg solved:", c.fetchone())

conn.close()
