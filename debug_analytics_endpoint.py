import sys
sys.path.append('.')
from backend.database import SessionLocal
from backend.routes.analytics import get_individual_analytics
import json

db = SessionLocal()
res = get_individual_analytics(student_id=476, period="30d", db=db, current_user=None)
print("Result:")
print(json.dumps(res, indent=2, default=str))
db.close()
