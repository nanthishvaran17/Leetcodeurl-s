import os
import sys
from sqlalchemy import create_engine

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT_DIR)

from backend.models import Base

PG_URL = os.getenv("DATABASE_URL", "")
if not PG_URL:
    raise ValueError("DATABASE_URL environment variable is required.")

print(f"Connecting engine to Neon DB: {PG_URL.split('@')[-1]}")
engine = create_engine(PG_URL, pool_pre_ping=True)

print("Creating all tables from Base.metadata...")
Base.metadata.create_all(bind=engine)
print("Base.metadata.create_all finished successfully!")

# Run column migrations as well
from backend.database import run_migrations
print("Running database.py run_migrations()...")
# Temporarily mock or set engine in database.py
import backend.database as db_mod
db_mod.engine = engine
db_mod.db_url = PG_URL
db_mod.run_migrations()
print("All tables and column migrations created on Neon PostgreSQL successfully!")
