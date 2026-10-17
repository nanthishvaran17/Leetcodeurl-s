import sqlite3

def bump_version():
    conn = sqlite3.connect(r"E:\Leetcode Web\data\leetcode_tracker.db")
    c = conn.cursor()
    c.execute("SELECT value FROM system_settings WHERE key='global_data_version_counter'")
    row = c.fetchone()
    
    if row is None:
        c.execute("INSERT INTO system_settings (key, value) VALUES ('global_data_version_counter', '1001')")
    else:
        new_val = str(int(row[0]) + 1)
        c.execute("UPDATE system_settings SET value=? WHERE key='global_data_version_counter'", (new_val,))
    
    conn.commit()
    conn.close()
    print("Bumped global_data_version_counter successfully.")

if __name__ == "__main__":
    bump_version()
