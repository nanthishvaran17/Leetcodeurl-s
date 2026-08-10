import os
import sys

# Add root directory to sys.path so backend module is discoverable by Vercel
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app

# Export ASGI app for Vercel Serverless Function
handler = app
