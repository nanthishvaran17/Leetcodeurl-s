from backend.database import SessionLocal
from backend.models import User

db = SessionLocal()
user = db.query(User).filter(User.email == "nanthishvaran17@gmail.com").first()
if user:
    user.role = "super admin"
    db.commit()
    print("Updated role to super admin for:", user.email)
else:
    print("User not found.")
db.close()
