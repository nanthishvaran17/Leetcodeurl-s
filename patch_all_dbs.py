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
                    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='weekly_public_results'")
                    if c.fetchone():
                        print(f"Found table in {db_path}, patching...")
                        for col, col_type in [
                            ('participant_entry_time', 'DATETIME'),
                            ('participant_entry_time_source', 'VARCHAR(50)'),
                            ('participant_entry_time_confidence', 'VARCHAR(20)'),
                            ('participant_entry_time_method', 'VARCHAR(50)'),
                            ('participant_entry_time_observed_at', 'DATETIME')
                        ]:
                            for table in ['weekly_public_results', 'weekly_session_snapshots']:
                                try:
                                    c.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
                                    print(f"  Added {col} to {table}")
                                except sqlite3.OperationalError as e:
                                    pass
                        conn.commit()
                    conn.close()
                except Exception as e:
                    pass

patch_all_dbs()
