from backend.database import SessionLocal
from backend.models import Department, Student

db = SessionLocal()

try:
    print("Deleting students not in CS/IoT from Neon DB...")
    db.query(Student).filter(Student.department_id.notin_([1, 2])).delete(synchronize_session=False)
    
    print("Deleting departments not in CS/IoT from Neon DB...")
    db.query(Department).filter(Department.id.notin_([1, 2])).delete(synchronize_session=False)
    
    db.commit()
    print("Successfully deleted other departments and students.")
except Exception as e:
    db.rollback()
    print(f"Error: {e}")
finally:
    db.close()
