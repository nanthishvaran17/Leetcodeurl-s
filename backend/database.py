import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from backend.config import settings

# Ensure data directory exists
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
os.makedirs(DATA_DIR, exist_ok=True)

# Replace relative path if sqlite
db_url = settings.DATABASE_URL
if db_url.startswith("sqlite:///./"):
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), db_url.replace("sqlite:///./", ""))
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
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
