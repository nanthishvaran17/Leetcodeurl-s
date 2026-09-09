from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models import User
from backend.security import get_current_user_optional, require_security_access

client = TestClient(app)
db = SessionLocal()

user = db.query(User).filter(User.username == '732223CC025').first()

def mock_get_current_user():
    return user

def mock_require_security_access(resource_name, dept_scoped=False):
    def _mock():
        return user
    return _mock

app.dependency_overrides[get_current_user_optional] = mock_get_current_user
app.dependency_overrides[require_security_access] = mock_require_security_access

response = client.get("/api/analytics/contest/aggregate?period=30d")
print("Contest Status (NO STUDENT ID):", response.status_code)
print("Contest Body:", response.text)
