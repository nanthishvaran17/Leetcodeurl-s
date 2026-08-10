import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from backend.config import settings

# Ensure data directory exists
is_vercel = os.environ.get("VERCEL") == "1" or os.environ.get("VERCEL_ENV")
if is_vercel:
    DATA_DIR = "/tmp/data"
else:
    DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")

try:
    os.makedirs(DATA_DIR, exist_ok=True)
except Exception:
    DATA_DIR = "/tmp"

# Replace relative path if sqlite
db_url = settings.DATABASE_URL
if is_vercel:
    db_url = "sqlite:////tmp/leetcode_tracker.db"
elif db_url.startswith("sqlite:///./"):
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), db_url.replace("sqlite:///./", ""))
    try:
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
    except Exception:
        pass
    db_url = f"sqlite:///{db_path}"

engine = create_engine(
    db_url,
    connect_args={"check_same_thread": False} if "sqlite" in db_url else {},
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
