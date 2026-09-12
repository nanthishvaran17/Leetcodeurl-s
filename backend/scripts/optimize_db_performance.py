import sqlite3
import time
import os

DB_PATH = 'data/leetcode_tracker.db'

def optimize_database():
    if not os.path.exists(DB_PATH):
        print(f"Database file not found at {DB_PATH}")
        return

    print("==================================================")
    print("STARTING DATABASE PERFORMANCE OPTIMIZATION...")
    print("==================================================")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Benchmark query speed before indexes
    start_time = time.perf_counter()
    cursor.execute("""
        SELECT date(captured_at), SUM(total_solved), COUNT(DISTINCT student_id)
        FROM student_stat_snapshots
        GROUP BY date(captured_at)
        ORDER BY captured_at ASC
    """).fetchall()
    before_snapshot_query_ms = (time.perf_counter() - start_time) * 1000.0

    start_time_stud = time.perf_counter()
    cursor.execute("""
        SELECT s.id, s.name, s.department_id, s.year_level
        FROM students s
        WHERE (s.is_active = 1 OR s.is_active IS NULL)
        AND s.department_id = 1
        ORDER BY s.id ASC
    """).fetchall()
    before_student_query_ms = (time.perf_counter() - start_time_stud) * 1000.0

    print(f"[BEFORE] Snapshot Aggregation Query Time : {before_snapshot_query_ms:.2f} ms")
    print(f"[BEFORE] Department Student Query Time   : {before_student_query_ms:.2f} ms")
    print("--------------------------------------------------")

    # PRAGMA optimizations for SQLite
    cursor.execute("PRAGMA journal_mode = WAL;")
    cursor.execute("PRAGMA synchronous = NORMAL;")
    cursor.execute("PRAGMA cache_size = -64000;")  # 64MB cache
    cursor.execute("PRAGMA temp_store = MEMORY;")

    indexes_to_create = [
        ("idx_stat_snapshots_stud_captured", "CREATE INDEX IF NOT EXISTS idx_stat_snapshots_stud_captured ON student_stat_snapshots(student_id, captured_at);"),
        ("idx_lps_stud_solved_rating", "CREATE INDEX IF NOT EXISTS idx_lps_stud_solved_rating ON leetcode_profile_stats(student_id, total_solved, contest_rating);"),
        ("idx_students_active_dept_year", "CREATE INDEX IF NOT EXISTS idx_students_active_dept_year ON students(is_active, department_id, year_level);"),
        ("idx_contest_part_stud_status", "CREATE INDEX IF NOT EXISTS idx_contest_part_stud_status ON student_contest_participations(student_id, participation_mode, official_attendance_state);")
    ]

    for name, sql in indexes_to_create:
        t0 = time.perf_counter()
        cursor.execute(sql)
        dt = (time.perf_counter() - t0) * 1000.0
        print(f"Created/Verified index [{name}] in {dt:.2f} ms")

    conn.commit()

    # Benchmark query speed AFTER indexes
    start_time_after = time.perf_counter()
    cursor.execute("""
        SELECT date(captured_at), SUM(total_solved), COUNT(DISTINCT student_id)
        FROM student_stat_snapshots
        GROUP BY date(captured_at)
        ORDER BY captured_at ASC
    """).fetchall()
    after_snapshot_query_ms = (time.perf_counter() - start_time_after) * 1000.0

    start_time_stud_after = time.perf_counter()
    cursor.execute("""
        SELECT s.id, s.name, s.department_id, s.year_level
        FROM students s
        WHERE (s.is_active = 1 OR s.is_active IS NULL)
        AND s.department_id = 1
        ORDER BY s.id ASC
    """).fetchall()
    after_student_query_ms = (time.perf_counter() - start_time_stud_after) * 1000.0

    conn.close()

    print("--------------------------------------------------")
    print(f"[AFTER] Snapshot Aggregation Query Time  : {after_snapshot_query_ms:.2f} ms")
    print(f"[AFTER] Department Student Query Time    : {after_student_query_ms:.2f} ms")
    print("==================================================")
    print("DATABASE OPTIMIZATION COMPLETED SUCCESSFULLY!")
    print("==================================================")

if __name__ == '__main__':
    optimize_database()
