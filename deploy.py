import os
import sys
import subprocess

def run_step(cmd, cwd=None, description=""):
    print(f"\n🚀 {description}...")
    try:
        res = subprocess.run(cmd, shell=True, cwd=cwd, check=True)
        print(f"✅ {description} completed successfully!")
    except subprocess.CalledProcessError as e:
        print(f"❌ Error during {description}: {e}")
        sys.exit(1)

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(root_dir, "frontend")

    print("=================================================================")
    print("🏛️ NANDHA ENGINEERING COLLEGE — LEETCODE PLATFORM DEPLOYMENT BUILD")
    print("=================================================================")

    # 1. Install frontend dependencies
    run_step("npm install", cwd=frontend_dir, description="Installing Frontend Dependencies")

    # 2. Build Frontend Production Bundle
    run_step("npm run build", cwd=frontend_dir, description="Building Production React Frontend Bundle (frontend/dist)")

    # 3. Seed Database & Test Backend Setup
    run_step(f"{sys.executable} -c \"from backend.seed import seed_database; seed_database()\"", cwd=root_dir, description="Seeding SQLite Database with 221 Enrolled Students")

    print("\n🎉 PRODUCTION BUILD COMPLETE!")
    print("-----------------------------------------------------------------")
    print("To launch the live production server on single port 8000, run:")
    print("👉 python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000")
    print("Or for Docker deployment, run:")
    print("👉 docker-compose up --build -d")
    print("=================================================================")

if __name__ == "__main__":
    main()
