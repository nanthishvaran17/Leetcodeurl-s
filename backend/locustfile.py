from locust import HttpUser, task, between
import random

class StaffUserBehavior(HttpUser):
    wait_time = between(1, 5)
    
    def on_start(self):
        """Simulate staff login and obtain token"""
        self.department_id = random.choice([1, 2, 3, 4, 5])
        self.year = random.choice(["II", "III", "IV"])

    @task(3)
    def dashboard_load(self):
        """Simulate loading the main dashboard"""
        self.client.get("/api/admin/data-health")
        self.client.get("/api/public/stats")

    @task(5)
    def view_students(self):
        """Simulate roaming the student list with pagination and filters"""
        page = random.randint(1, 5)
        self.client.get(f"/api/students/leaderboard-fast?dept_id={self.department_id}&year_level={self.year}&limit=50")

    @task(2)
    def view_reports(self):
        """Simulate generating or viewing reports"""
        self.client.get("/api/reports/history?limit=10")
        
    @task(1)
    def view_audit_logs(self):
        """Simulate viewing admin audit logs"""
        self.client.get("/api/admin/audit-logs?limit=25")

# To run:
# pip install locust
# locust -f locustfile.py --host=http://localhost:8000
