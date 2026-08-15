from backend.database import SessionLocal
from backend.routes.admin import create_recipient, delete_recipient, RecipientSchema
from backend.models import User

db = SessionLocal()
try:
    admin_user = db.query(User).first() or User(id=1, username="admin", email="admin@nandha.edu.in", role="admin")

    payload = RecipientSchema(
        name="Test HOD Coordinator",
        email="coordinator.test@nandha.edu.in",
        role="HOD",
        department="CSE(CS)",
        weekly_enabled=True,
        hod_enabled=True,
        error_enabled=True,
        active=True
    )

    res = create_recipient(payload=payload, db=db, current_user=admin_user)
    print("SUCCESS CREATE:", res)

    del_res = delete_recipient(recipient_id=res["id"], db=db, current_user=admin_user)
    print("SUCCESS DELETE:", del_res)
finally:
    db.close()
