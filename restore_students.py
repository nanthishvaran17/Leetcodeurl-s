import sqlite3
import shutil

print('Backing up current DB before restore...')
shutil.copy('data/leetcode_tracker.db', 'data/leetcode_tracker_before_restore.db')

conn = sqlite3.connect('data/leetcode_tracker.db')
c = conn.cursor()
c.execute('ATTACH DATABASE "data/backups/baseline_production_verified_20260826_055556.db" AS backup_db')

# Insert missing students, excluding the fake ones
c.execute('''
    INSERT INTO students
    SELECT * FROM backup_db.students 
    WHERE reg_no NOT LIKE '732224%' 
      AND reg_no NOT LIKE 'TEST_ISOLATION_%'
      AND reg_no NOT LIKE 'REG%'
      AND reg_no NOT LIKE '7322STU%'
      AND reg_no != '23CC009'
      AND reg_no NOT IN (SELECT reg_no FROM students)
''')

inserted_students = c.rowcount
print(f'Inserted {inserted_students} students.')

# Also restore their stats if missing
c.execute('''
    INSERT INTO leetcode_profile_stats
    SELECT * FROM backup_db.leetcode_profile_stats
    WHERE student_id IN (
        SELECT id FROM backup_db.students 
        WHERE reg_no NOT LIKE '732224%' 
          AND reg_no NOT LIKE 'TEST_ISOLATION_%'
          AND reg_no NOT LIKE 'REG%'
          AND reg_no NOT LIKE '7322STU%'
          AND reg_no != '23CC009'
    )
    AND student_id NOT IN (SELECT student_id FROM leetcode_profile_stats)
''')

inserted_stats = c.rowcount
print(f'Inserted {inserted_stats} stats records.')

conn.commit()

c.execute('SELECT COUNT(*) FROM students')
print('Total students now:', c.fetchone()[0])
conn.close()
