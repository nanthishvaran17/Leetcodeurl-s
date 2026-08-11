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

# Replace relative path if sqlite or handle Render postgres:// connection strings
db_url = os.environ.get("DATABASE_URL", settings.DATABASE_URL)

if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)
elif is_vercel:
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

def run_migrations():
    """Apply any missing column migrations to the existing SQLite database."""
    if "sqlite" not in db_url:
        return  # Only needed for local SQLite; production uses Render Postgres which auto-migrates via Base.metadata.create_all
    try:
        with engine.connect() as conn:
            # Get existing columns
            result = conn.execute(
                __import__('sqlalchemy').text("PRAGMA table_info(leetcode_profile_stats)")
            )
            existing_cols = {row[1] for row in result}

            migrations = [
                ("sync_status",     "ALTER TABLE leetcode_profile_stats ADD COLUMN sync_status VARCHAR DEFAULT 'success'"),
                ("source",          "ALTER TABLE leetcode_profile_stats ADD COLUMN source VARCHAR DEFAULT 'leetcode_public_profile'"),
                ("last_verified_at","ALTER TABLE leetcode_profile_stats ADD COLUMN last_verified_at DATETIME"),
            ]
            for col_name, sql in migrations:
                if col_name not in existing_cols:
                    conn.execute(__import__('sqlalchemy').text(sql))
                    conn.commit()
                    print(f"[DB Migration] Added column: {col_name}")
    except Exception as e:
        print(f"[DB Migration] Warning: {e}")
