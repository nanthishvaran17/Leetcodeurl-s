import backend.database as db
import backend.models as m
from backend.seed import get_password_hash
from backend.routes.auth import verify_password

def update_admin():
    s = db.SessionLocal()
    try:
        admin_user = s.query(m.User).filter(
            (m.User.email == 'nanthishvaran17@gmail.com') | 
            (m.User.username == 'admin') | 
            (m.User.role == 'Admin')
        ).first()

        if not admin_user:
            admin_user = m.User(
                username='admin',
                email='nanthishvaran17@gmail.com',
                hashed_password=get_password_hash('AdminPass123!'),
                role='Admin',
                is_active=True
            )
            s.add(admin_user)
        else:
            admin_user.username = 'admin'
            admin_user.email = 'nanthishvaran17@gmail.com'
            admin_user.role = 'Admin'
            admin_user.is_active = True
            admin_user.hashed_password = get_password_hash('AdminPass123!')

        s.commit()
        s.refresh(admin_user)
        print(f"SUCCESS: Admin account updated.")
        print(f"ID: {admin_user.id}")
        print(f"Username: {admin_user.username}")
        print(f"Email: {admin_user.email}")
        print(f"Role: {admin_user.role}")
        print(f"Is Active: {admin_user.is_active}")
        print(f"Password 'AdminPass123!' Valid: {verify_password('AdminPass123!', admin_user.hashed_password)}")
    finally:
        s.close()

if __name__ == '__main__':
    update_admin()
