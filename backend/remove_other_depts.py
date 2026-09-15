from backend.database import SessionLocal
from backend.models import Department, Student

db = SessionLocal()

try:
    # Get students not in CS/IoT
    other_students = db.query(Student).filter(Student.department_id.notin_([1, 2])).all()
    print(f"Found {len(other_students)} students to delete.")
    
    # Delete them
    db.query(Student).filter(Student.department_id.notin_([1, 2])).delete(synchronize_session=False)
    
    # Delete other departments
    other_depts = db.query(Department).filter(Department.id.notin_([1, 2])).all()
    print(f"Found {len(other_depts)} departments to delete.")
    db.query(Department).filter(Department.id.notin_([1, 2])).delete(synchronize_session=False)
    
    db.commit()
    print("Successfully deleted other departments and students.")
except Exception as e:
    db.rollback()
    print(f"Error: {e}")
finally:
    db.close()
