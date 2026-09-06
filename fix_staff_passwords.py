import os
import sys

# Ensure backend modules can be imported
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.models import User
from backend.routes.auth import get_password_hash

def fix_staff_passwords():
    print("==================================================")
    print("    LIVE DB - STAFF PASSWORD RECOVERY SCRIPT      ")
    print("==================================================")
    
    # Prompt for the live Supabase Database URL
    db_url = input("Enter your Live Supabase DATABASE_URL (or press Enter to use local SQLite for testing):\n> ").strip()
    
    if not db_url:
        print("Using local SQLite database...")
        from backend.database import engine
    else:
        print("Connecting to live Supabase database...")
        # Handle Supabase connection strings (often start with postgres:// instead of postgresql://)
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
        engine = create_engine(db_url, pool_pre_ping=True)
        
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Get the new default password from the admin
        print("\nEnter a default password to set for existing staff accounts.")
        print("Staff will be forced to change this on their first login.")
        default_pwd = input("Default Password (e.g., Nandha@123): ").strip()
        
        if not default_pwd or len(default_pwd) < 6:
            print("Password must be at least 6 characters. Exiting.")
            return
            
        hashed_pwd = get_password_hash(default_pwd)
        
        # Identify staff accounts (exclude Students, exclude Super Admins if you want to be safe)
        staff_roles = ["Admin", "Faculty", "Staff", "HOD", "Faculty Mentor", "Staff Mentor", "Department HOD", "Administrator"]
        
        staff_users = db.query(User).filter(User.role.in_(staff_roles)).all()
        
        print(f"\nFound {len(staff_users)} staff accounts.")
        if len(staff_users) == 0:
            print("No staff accounts found to update.")
            return
            
        confirm = input(f"Are you sure you want to update the password for {len(staff_users)} accounts? (y/n): ").strip().lower()
        if confirm != 'y':
            print("Operation cancelled.")
            return
            
        updated_count = 0
        for user in staff_users:
            user.hashed_password = hashed_pwd
            user.require_password_change = True  # Force them to change it when they log in
            updated_count += 1
            print(f"Updated password for {user.username} ({user.email}) - Role: {user.role}")
            
        db.commit()
        print(f"\nSuccessfully updated passwords for {updated_count} staff accounts!")
        print(f"They can now login with: {default_pwd}")
        
    except Exception as e:
        db.rollback()
        print(f"An error occurred: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_staff_passwords()
