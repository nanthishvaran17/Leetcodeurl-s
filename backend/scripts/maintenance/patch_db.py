import sqlite3

def patch_db(db_path):
    print(f"Patching {db_path}")
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    tables = ['weekly_public_results', 'weekly_session_snapshots']
    columns = [
        ('participant_entry_time', 'DATETIME'),
        ('participant_entry_time_source', 'VARCHAR(50)'),
        ('participant_entry_time_confidence', 'VARCHAR(20)'),
        ('participant_entry_time_method', 'VARCHAR(50)'),
        ('participant_entry_time_observed_at', 'DATETIME')
    ]

    for table in tables:
        for col, col_type in columns:
            try:
                c.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
                print(f"Added {col} to {table}")
            except sqlite3.OperationalError as e:
                if "duplicate column name" in str(e):
                    print(f"Column {col} already exists in {table}")
                else:
                    print(f"Error adding {col} to {table}: {e}")

    conn.commit()
    conn.close()

patch_db(r"E:\Leetcode Web\data\leetcode_tracker.db")
patch_db(r"E:\Leetcode Web\leetcode_tracker.db")
