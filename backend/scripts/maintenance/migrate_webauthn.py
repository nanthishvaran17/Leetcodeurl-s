import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "leetcode_tracker.db")

def migrate():
    if not os.path.exists(DB_PATH):
        # Fallback to current dir
        DB_PATH_FALLBACK = os.path.join(os.path.dirname(__file__), "leetcode_tracker.db")
        if os.path.exists(DB_PATH_FALLBACK):
            db_file = DB_PATH_FALLBACK
        else:
            print("DB not found")
            return
    else:
        db_file = DB_PATH
        
    print(f"Using DB at {db_file}")
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN webauthn_challenge VARCHAR(255)")
        print("Added webauthn_challenge to users")
    except sqlite3.OperationalError as e:
        print("Column webauthn_challenge might already exist:", e)
        
    try:
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_passkeys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            credential_id VARCHAR(255) NOT NULL UNIQUE,
            public_key TEXT NOT NULL,
            sign_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_user_passkeys_user_id ON user_passkeys(user_id)")
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_user_passkeys_credential_id ON user_passkeys(credential_id)")
        print("Created user_passkeys table")
    except sqlite3.OperationalError as e:
        print("Error creating user_passkeys:", e)
        
    conn.commit()
    conn.close()

if __name__ == "__main__":
    migrate()
