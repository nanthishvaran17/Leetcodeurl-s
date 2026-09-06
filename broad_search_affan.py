import sqlite3
import glob

print('Searching for affan in all databases across all columns...')
for db_file in glob.glob('data/*.db') + glob.glob('data/backups/*.db'):
    try:
        conn = sqlite3.connect(db_file)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        
        for table in ['users', 'students']:
            try:
                cur.execute(f'PRAGMA table_info({table})')
                cols = [r[1] for r in cur.fetchall()]
                if not cols: continue
                
                query = f"SELECT * FROM {table} WHERE " + " OR ".join([f"{c} LIKE '%affan%'" for c in cols])
                cur.execute(query)
                res = cur.fetchall()
                if res:
                    print(f'\nFound in {db_file} -> {table}:')
                    for row in res: print(dict(row))
            except Exception as e:
                pass
        conn.close()
    except Exception:
        pass
