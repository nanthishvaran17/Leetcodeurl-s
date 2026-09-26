import os
import sys
import psycopg2

PG_URL = os.getenv("DATABASE_URL", "postgresql://neondb_owner:npg_W0ihJ1PKujEx@ep-fragrant-boat-b5bjd6aw.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require")

print("Connecting to Neon Postgres DB...")
conn = psycopg2.connect(PG_URL)
conn.autocommit = True
cur = conn.cursor()

# 1. certificate_records missing columns
cert_cols = [
    ("contest_id", "VARCHAR(64)"),
    ("contest_name", "VARCHAR(128)"),
    ("sha_hash", "VARCHAR(128)"),
    ("leetcode_username", "VARCHAR(128)"),
    ("participation_status", "VARCHAR(64)"),
    ("problems_solved", "VARCHAR(64)"),
    ("contest_score", "VARCHAR(32)"),
    ("contest_rank", "VARCHAR(32)"),
    ("contest_rating", "VARCHAR(32)"),
    ("q1_score", "INTEGER DEFAULT 0"),
    ("q2_score", "INTEGER DEFAULT 0"),
    ("q3_score", "INTEGER DEFAULT 0"),
    ("q4_score", "INTEGER DEFAULT 0"),
    ("retrieved_timestamp", "VARCHAR(64)"),
    ("certificate_code", "VARCHAR(64)"),
    ("document_type", "VARCHAR(64) DEFAULT 'CERTIFICATE_OF_EXCELLENCE'"),
    ("status", "VARCHAR(32) DEFAULT 'VALID'"),
    ("principal_signature_version", "VARCHAR(32) DEFAULT 'v1'"),
    ("hod_signature_version", "VARCHAR(32) DEFAULT 'v1'"),
    ("verification_url", "VARCHAR(512)"),
    ("pdf_path", "VARCHAR(512)"),
    ("qr_path", "VARCHAR(512)"),
    ("qr_code_path", "VARCHAR(512)")
]

cur.execute("""
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'certificate_records';
""")
existing_cols = {row[0] for row in cur.fetchall()}
print(f"Existing columns in certificate_records ({len(existing_cols)}): {sorted(list(existing_cols))}")

for col_name, col_type in cert_cols:
    if col_name not in existing_cols:
        try:
            sql = f"ALTER TABLE certificate_records ADD COLUMN IF NOT EXISTS {col_name} {col_type};"
            cur.execute(sql)
            print(f"  [SUCCESS] Added column '{col_name}' to certificate_records")
        except Exception as e:
            print(f"  [ERROR] Failed adding '{col_name}': {e}")
    else:
        print(f"  [EXISTS] Column '{col_name}' already exists")

# 2. notification_files missing columns
cur.execute("""
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'notification_files';
""")
existing_notif_cols = {row[0] for row in cur.fetchall()}
print(f"\nExisting columns in notification_files ({len(existing_notif_cols)}): {sorted(list(existing_notif_cols))}")

notif_cols = [
    ("file_data", "TEXT")
]

for col_name, col_type in notif_cols:
    if col_name not in existing_notif_cols:
        try:
            sql = f"ALTER TABLE notification_files ADD COLUMN IF NOT EXISTS {col_name} {col_type};"
            cur.execute(sql)
            print(f"  [SUCCESS] Added column '{col_name}' to notification_files")
        except Exception as e:
            print(f"  [ERROR] Failed adding '{col_name}': {e}")
    else:
        print(f"  [EXISTS] Column '{col_name}' already exists")

cur.close()
conn.close()
print("\nMigration script complete!")
