import sqlite3
c = sqlite3.connect('data/leetcode_tracker.db').cursor()
c.execute("SELECT recent_contest_name, recent_contest_score, contest_global_ranking, public_profile_ranking FROM leetcode_profile_stats INNER JOIN students ON students.id = leetcode_profile_stats.student_id WHERE students.username='Spidy_42'")
print(c.fetchone())
