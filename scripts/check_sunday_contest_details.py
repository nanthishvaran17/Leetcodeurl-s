import sqlite3
import sys

sys.stdout.reconfigure(encoding='utf-8')

db_path = "data/leetcode_tracker.db"
conn = sqlite3.connect(db_path)
c = conn.cursor()

print("=== 1. ALL WEEKLY SESSIONS IN DB ===")
c.execute("""
SELECT id, contest_name, session_date, start_time, end_time, status, sync_status, pipeline_state
FROM weekly_sessions
ORDER BY id DESC
""")
for r in c.fetchall():
    print(r)

print("\n=== 2. WEEKLY PUBLIC RESULTS / PARTICIPATION COUNTS BY SESSION ===")
c.execute("""
SELECT 
    session_id,
    COUNT(*) as total_records,
    SUM(CASE WHEN participation_status = 'ATTENDED' OR participation_status = 'PARTICIPATED' THEN 1 ELSE 0 END) as attended,
    SUM(CASE WHEN total_contest_solved > 0 THEN 1 ELSE 0 END) as solvers,
    SUM(CASE WHEN total_contest_solved = 0 AND (participation_status = 'ATTENDED' OR participation_status = 'PARTICIPATED') THEN 1 ELSE 0 END) as zero_solvers,
    SUM(CASE WHEN participation_status = 'NOT_ATTENDED' OR participation_status = 'ABSENT' THEN 1 ELSE 0 END) as absent
FROM weekly_public_results
GROUP BY session_id
ORDER BY session_id DESC
""")
for r in c.fetchall():
    print(f"Session {r[0]}: Total={r[1]}, Attended={r[2]}, Solvers={r[3]}, ZeroSolvers={r[4]}, Absent={r[5]}")

print("\n=== 3. CONTEST PARTICIPATIONS TABLE ===")
c.execute("""
SELECT contest_name, COUNT(*), SUM(CASE WHEN problems_solved > 0 THEN 1 ELSE 0 END), SUM(CASE WHEN problems_solved = 0 THEN 1 ELSE 0 END)
FROM contest_participations
GROUP BY contest_name
ORDER BY contest_name DESC
""")
for r in c.fetchall():
    print(r)

conn.close()
