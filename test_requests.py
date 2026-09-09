import requests
from backend.database import SessionLocal
from backend.models import User

def get_token():
    # Login via API
    resp = requests.post("http://127.0.0.1:8000/api/auth/login", json={"username": "732223CC025", "password": "password"})
    print("Login:", resp.status_code, resp.text)
    if resp.status_code == 200:
        return resp.json().get("access_token")
    return None

token = get_token()
if token:
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get("http://127.0.0.1:8000/api/analytics/contest/aggregate?period=30d&student_id=1408", headers=headers)
    print("Contest Status:", r.status_code)
    print("Contest Body:", r.text)
    
    r2 = requests.get("http://127.0.0.1:8000/api/analytics/activity/aggregate?period=30d&student_id=1408", headers=headers)
    print("Activity Status:", r2.status_code)
    print("Activity Body:", r2.text)
