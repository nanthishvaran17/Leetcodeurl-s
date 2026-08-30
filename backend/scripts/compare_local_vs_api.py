import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models import User, WeeklySession
from backend.routes.auth import create_access_token
import sqlite3

def compare():
    print("Testing API vs DB...")
    
    # 1. DB count
    conn = sqlite3.connect('E:\\Leetcode Web\\data\\leetcode_tracker.db')
    cur = conn.cursor()
    cur.execute('SELECT session_id, COUNT(*) FROM weekly_public_results WHERE total_contest_solved > 0 GROUP BY session_id')
    db_counts = cur.fetchall()
    print("DB > 0 solved counts:", db_counts)
    
    # 2. API counts
    client = TestClient(app)
    
    db = SessionLocal()
    admin_user = db.query(User).filter(User.role == 'Admin').first()
    if not admin_user:
        admin_user = db.query(User).first()
    token = create_access_token(data={"sub": admin_user.username, "role": admin_user.role, "user_id": admin_user.id})
    headers = {"Authorization": f"Bearer {token}"}
    
    sessions = db.query(WeeklySession).all()
    for session in sessions:
        print(f"\nChecking session {session.id} ({session.contest_name})")
        # 1. API: get_public_participants
        res = client.get(f"/api/weekly-contests/sessions/{session.id}/public-participants?page_size=200", headers=headers)
        if res.status_code == 200:
            data = res.json()
            print("API public-participants (Official API) count:", data.get('summary', {}).get('public_participants_count'))
        else:
            print("API public-participants error:", res.status_code)
            
        # 2. Check if there's an API that returns 128. Is it the /api/weekly-contests/sessions/{id} summary?
        res2 = client.get(f"/api/weekly-contests/sessions", headers=headers)
        if res2.status_code == 200:
            for s in res2.json():
                if s['id'] == session.id:
                    print("API /sessions summary official_participants:", s.get('official_participants'))

compare()
