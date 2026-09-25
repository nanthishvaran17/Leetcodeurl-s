import sqlite3
import os

def patch_all_dbs():
    for root, dirs, files in os.walk(r"E:\Leetcode Web"):
        for file in files:
            if file.endswith(".db"):
                db_path = os.path.join(root, file)
                try:
                    conn = sqlite3.connect(db_path)
                    c = conn.cursor()
                    
                    columns = [
                        ('participant_entry_time', 'DATETIME'),
                        ('participant_entry_time_source', 'VARCHAR(50)'),
                        ('participant_entry_time_confidence', 'VARCHAR(20)'),
                        ('participant_entry_time_method', 'VARCHAR(50)'),
                        ('participant_entry_time_observed_at', 'DATETIME'),
                        ('q1_observed_seconds', 'INTEGER'),
                        ('q2_observed_seconds', 'INTEGER'),
                        ('q3_observed_seconds', 'INTEGER'),
                        ('q4_observed_seconds', 'INTEGER'),
                        ('q1_estimated_seconds', 'INTEGER'),
                        ('q2_estimated_seconds', 'INTEGER'),
                        ('q3_estimated_seconds', 'INTEGER'),
                        ('q4_estimated_seconds', 'INTEGER'),
                        ('q1_time_source', 'VARCHAR(50)'),
                        ('q2_time_source', 'VARCHAR(50)'),
                        ('q3_time_source', 'VARCHAR(50)'),
                        ('q4_time_source', 'VARCHAR(50)'),
                        ('timing_calculation_version', 'VARCHAR(50)'),
                        ('timing_calculated_at', 'DATETIME'),
                        ('timing_confidence', 'VARCHAR(50)')
                    ]
                    
                    tables_to_patch = [
                        'weekly_public_results', 
                        'weekly_session_snapshots',
                        'weekly_virtual_results',
                        'student_results',
                        'student_records',
                        'virtual_results',
                        'daily_snapshots'
                    ]
                    
                    patched_something = False
                    for table in tables_to_patch:
                        c.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
                        if c.fetchone():
                            for col, col_type in columns:
                                try:
                                    c.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
                                    print(f"Added {col} to {table} in {db_path}")
                                    patched_something = True
                                except sqlite3.OperationalError as e:
                                    pass
                    
                    if patched_something:
                        conn.commit()
                    conn.close()
                except Exception as e:
                    pass

patch_all_dbs()
