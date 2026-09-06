import sqlite3
import argparse
import sys
import os

CURRENT_DB = "data/leetcode_tracker.db"
OLD_DB = "data/backups/baseline_production_verified_20260826_055556.db"

def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

def migrate(dry_run=True):
    print(f"==================================================")
    print(f"PHASE 8 - SAFE STAFF ACCOUNT MIGRATION")
    print(f"Mode: {'DRY RUN' if dry_run else 'REAL MIGRATION'}")
    print(f"==================================================\n")
    
    if not os.path.exists(CURRENT_DB):
        print(f"Error: Current DB {CURRENT_DB} not found.")
        sys.exit(1)
        
    if not os.path.exists(OLD_DB):
        print(f"Error: Old DB {OLD_DB} not found.")
        sys.exit(1)

    try:
        # Connect to both DBs
        old_conn = sqlite3.connect(OLD_DB)
        old_conn.row_factory = dict_factory
        old_cur = old_conn.cursor()

        cur_conn = sqlite3.connect(CURRENT_DB)
        cur_conn.row_factory = dict_factory
        cur_cur = cur_conn.cursor()
        
        # Start transaction on current DB
        cur_conn.execute("BEGIN TRANSACTION")

        # Fetch old staff
        old_cur.execute("SELECT * FROM users WHERE role != 'Student' AND role != 'student' AND role != 'Deleted_Staff'")
        old_staff = old_cur.fetchall()
        
        matched = 0
        updated = 0
        created = 0
        skipped = 0
        duplicates = 0
        errors = 0
        
        print(f"Found {len(old_staff)} staff accounts in OLD database.")
        
        for staff in old_staff:
            old_id = staff.get('id')
            username = staff.get('username')
            email = staff.get('email')
            hashed_password = staff.get('hashed_password')
            role = staff.get('role')
            is_active = staff.get('is_active')
            
            # Find in current DB
            cur_cur.execute("SELECT * FROM users WHERE username = ? OR email = ?", (username, email))
            current_matches = cur_cur.fetchall()
            
            if len(current_matches) > 1:
                print(f"[MANUAL REVIEW] Multiple matches found for {username} / {email}. Skipping.")
                duplicates += 1
                continue
                
            elif len(current_matches) == 1:
                matched += 1
                current = current_matches[0]
                
                # Update logic
                changes = []
                if current['hashed_password'] != hashed_password:
                    changes.append("password")
                if current['role'] != role:
                    changes.append("role")
                if current['is_active'] != is_active:
                    changes.append("is_active")
                    
                if changes:
                    cur_cur.execute(
                        "UPDATE users SET hashed_password = ?, role = ?, is_active = ? WHERE id = ?",
                        (hashed_password, role, is_active, current['id'])
                    )
                    updated += 1
                    print(f"[UPDATE] {username} ({email}) - Updated: {', '.join(changes)}")
                else:
                    skipped += 1
                    print(f"[SKIP] {username} ({email}) - Up to date.")
                    
            else:
                # Need to create
                # Ensure we have required fields
                try:
                    cur_cur.execute("""
                        INSERT INTO users (
                            username, email, hashed_password, role, is_active, 
                            full_name, designation, institutional_id, department_id, section_id,
                            phone_number, whatsapp_verified, date_of_birth, last_activity,
                            academic_year, mentoring_role, require_password_change
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        username, 
                        email, 
                        hashed_password, 
                        role, 
                        is_active,
                        staff.get('full_name'),
                        staff.get('designation'),
                        staff.get('institutional_id'),
                        staff.get('department_id'),
                        staff.get('section_id'),
                        staff.get('phone_number'),
                        staff.get('whatsapp_verified', 0),
                        staff.get('date_of_birth'),
                        staff.get('last_activity'),
                        staff.get('academic_year'),
                        staff.get('mentoring_role'),
                        staff.get('require_password_change', 0)
                    ))
                    created += 1
                    print(f"[CREATE] {username} ({email}) - Role: {role}")
                except Exception as e:
                    errors += 1
                    print(f"[ERROR] Failed to insert {username}: {str(e)}")
                    
        # Always rollback dry-runs, otherwise commit real runs
        if dry_run:
            cur_conn.rollback()
            print(f"\n--- DRY RUN COMPLETE --- (Rolled back)")
        else:
            cur_conn.commit()
            print(f"\n--- MIGRATION COMPLETE --- (Committed)")
            
        print("\n==================================================")
        print("MIGRATION REPORT")
        print("==================================================")
        print(f"Matched:    {matched}")
        print(f"Updated:    {updated}")
        print(f"Created:    {created}")
        print(f"Skipped:    {skipped}")
        print(f"Duplicates: {duplicates}")
        print(f"Errors:     {errors}")
        print(f"Total Old:  {len(old_staff)}")
        print("==================================================")
            
    except Exception as e:
        print(f"Fatal Error during migration: {e}")
        if 'cur_conn' in locals():
            cur_conn.rollback()
        sys.exit(1)
    finally:
        if 'old_conn' in locals():
            old_conn.close()
        if 'cur_conn' in locals():
            cur_conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate Staff Accounts safely.")
    parser.add_argument("--dry-run", action="store_true", help="Perform a dry run without committing.")
    args = parser.parse_args()
    
    migrate(dry_run=args.dry_run)
