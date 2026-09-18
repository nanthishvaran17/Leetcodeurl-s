import os
import psycopg2
import time

def explain_analyze(cursor, query, params=None):
    print(f"\n--- EXPLAIN ANALYZE ---")
    print(query)
    start = time.perf_counter()
    if params:
        cursor.execute(f"EXPLAIN (ANALYZE, BUFFERS) {query}", params)
    else:
        cursor.execute(f"EXPLAIN (ANALYZE, BUFFERS) {query}")
    duration = (time.perf_counter() - start) * 1000
    for row in cursor.fetchall():
        print(row[0])
    print(f"Total Execution Time: {duration:.2f} ms")
    print("-" * 25)

def main():
    # Use standard environment variables from GitHub Actions
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("Error: DATABASE_URL environment variable is required.")
        return
        
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Test 1: Leaderboard Query
        leaderboard_query = """
            SELECT s.register_number, s.name, s.department, s.leetcode_url, s.github_url,
                   p.total_solved, p.easy_solved, p.medium_solved, p.hard_solved, p.ranking,
                   h.global_ranking, h.contest_rating
            FROM students s
            LEFT JOIN leetcode_performance p ON s.id = p.student_id
            LEFT JOIN leetcode_history h ON s.id = h.student_id
            ORDER BY p.total_solved DESC NULLS LAST
            LIMIT 100
        """
        explain_analyze(cursor, leaderboard_query)
        
        # Test 2: HR Candidate Finder
        hr_query = """
            SELECT s.register_number, s.name, s.department
            FROM students s
            JOIN leetcode_performance p ON s.id = p.student_id
            WHERE p.total_solved > 100 AND p.medium_solved > 20
            ORDER BY p.total_solved DESC
            LIMIT 50
        """
        explain_analyze(cursor, hr_query)
        
        # Test 3: Dashboard Summary Stats
        stats_query = """
            SELECT COUNT(*), SUM(p.total_solved), AVG(h.contest_rating)
            FROM students s
            JOIN leetcode_performance p ON s.id = p.student_id
            LEFT JOIN leetcode_history h ON s.id = h.student_id
        """
        explain_analyze(cursor, stats_query)
        
        cursor.close()
        conn.close()
        print("\nDatabase Benchmark Complete.")
    except Exception as e:
        print(f"Database Benchmark Failed: {e}")

if __name__ == "__main__":
    main()
