import sqlite3
import pandas as pd
conn = sqlite3.connect('E:/Leetcode Web/data/leetcode_tracker.db')
df = pd.read_sql_query('SELECT id, name, section_id, year_level, people_id, version FROM students LIMIT 10;', conn)
print(df)
df2 = pd.read_sql_query("SELECT COUNT(*) FROM students WHERE version=0.25;", conn)
print("version=0.25 count:", df2)
df3 = pd.read_sql_query("SELECT COUNT(*) FROM students WHERE section_id IN (SELECT id FROM sections WHERE name='0.25');", conn)
print("section=0.25 count:", df3)
df4 = pd.read_sql_query("SELECT COUNT(*) FROM students WHERE year_level='0.25';", conn)
print("year_level=0.25 count:", df4)
df5 = pd.read_sql_query("SELECT DISTINCT year_level FROM students;", conn)
print("distinct year_levels:", df5)
