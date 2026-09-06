import requests

API_URL = "https://leetcodeurl-s-3mig.onrender.com/api"

def main():
    resp = requests.post(f"{API_URL}/auth/login", json={"username": "admin", "password": "admin123"})
    token = resp.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Try to find an endpoint that triggers reconciliation or updates the session
    # Or just check the session details
    resp = requests.get(f"{API_URL}/sessions/dashboard-summary", headers=headers)
    print("Dashboard Summary:")
    print(resp.json())

if __name__ == "__main__":
    main()
