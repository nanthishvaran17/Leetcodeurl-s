import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('backend/services/sunday_autopilot.py', 'r', encoding='utf-8') as f:
    text = f.read()

import re

# Find queries for students in sunday_autopilot.py
queries = re.findall(r'db\.query\(Student\).*', text)
print("Student queries in sunday_autopilot.py:")
for q in queries[:10]:
    print(" ", q)

# Check how students are queried in contest discovery / monitoring
idx = text.find('def phase_2_start_live_monitoring')
if idx != -1:
    print("\n--- phase_2_start_live_monitoring snippet ---")
    print(text[idx:idx+1500])

idx3 = text.find('def phase_3_live_monitoring_cycle')
if idx3 != -1:
    print("\n--- phase_3_live_monitoring_cycle snippet ---")
    print(text[idx3:idx3+1500])

