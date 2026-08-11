import os
import sys

# Add root directory to sys.path so backend module is discoverable by Vercel
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.seed import seed_database
from backend.main import app

# Guarantee DB is populated with all 221 students on Vercel serverless invocation
try:
    seed_database()
except Exception as _seed_err:
    pass

# Export ASGI app for Vercel Serverless Function
handler = app

