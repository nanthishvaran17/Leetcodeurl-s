import sqlite3

conn = sqlite3.connect('data/leetcode_tracker.db')
c = conn.cursor()

c.execute("SELECT id, username, role, department_id FROM users WHERE is_active=1 AND (lower(role) LIKE '%staff%' OR lower(role) LIKE '%faculty%')")
rows = c.fetchall()
print(f'Faculty/Staff users found: {len(rows)}')
for r in rows:
    print(' ', r)

c.execute("SELECT d.code, COUNT(s.id) FROM departments d JOIN students s ON s.department_id=d.id WHERE s.is_active=1 AND d.code IN ('CSE(CS)','CSE(IOT)') GROUP BY d.code")
print('Dept student counts:', c.fetchall())

c.execute("SELECT COUNT(*) FROM students WHERE is_active=1")
print('Total active students:', c.fetchone()[0])

conn.close()
print('Verification complete.')
