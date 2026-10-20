"""
Maintenance proxy for backend.migrate_db.
Ensures backwards compatibility if scripts invoke backend.scripts.maintenance.migrate_db
while maintaining backend.migrate_db as the single source of truth.
"""
import sys
import os

# Ensure backend package can be discovered even if script executed standalone
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from backend.migrate_db import *
from backend.migrate_db import run_db_migrations

if __name__ == "__main__":
    run_db_migrations()
