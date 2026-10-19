from backend.database import SessionLocal
from backend.models import Department, Student

db = SessionLocal()

try:
    print("Deactivating students not in CS/IoT from Neon DB...")
    res = db.query(Student).filter(Student.department_id.notin_([1, 2])).update({"is_active": False}, synchronize_session=False)
    
    db.commit()
    print(f"Successfully deactivated {res} students.")
except Exception as e:
    db.rollback()
    print(f"Error: {e}")
finally:
    db.close()
