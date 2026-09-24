with open('e:/Leetcode Web/backend/routes/weekly_contests.py', 'r', encoding='utf-8') as f:
    t = f.read()

# Fix schema and pass-through
t = t.replace('q1_observed_active_seconds', 'q1_observed_seconds')
t = t.replace('q2_observed_active_seconds', 'q2_observed_seconds')
t = t.replace('q3_observed_active_seconds', 'q3_observed_seconds')
t = t.replace('q4_observed_active_seconds', 'q4_observed_seconds')

# Fix ingestion engine pass-through
import re
t = re.sub(r'q1_observed_seconds=req\.q1_observed_seconds,', 'q1_observed_seconds=req.q1_observed_seconds,', t)

# Now update the q1/q2 row mapping to produce structured q_timing
# Replace the two raw getattr patterns with structured output
# Pattern 1 (live list):
old1 = '''            "q1": getattr(r, "q1_observed_seconds", None) or r.q1,
            "q2": getattr(r, "q2_observed_seconds", None) or r.q2,
            "q3": getattr(r, "q3_observed_seconds", None) or r.q3,
            "q4": getattr(r, "q4_observed_seconds", None) or r.q4,'''
new1 = '''            "q1": getattr(r, "q1_observed_seconds", None) or r.q1,
            "q2": getattr(r, "q2_observed_seconds", None) or r.q2,
            "q3": getattr(r, "q3_observed_seconds", None) or r.q3,
            "q4": getattr(r, "q4_observed_seconds", None) or r.q4,
            "q_timing": _build_q_timing(r),'''
if old1 in t:
    t = t.replace(old1, new1)
    print('Patched live list row')

# Pattern 2 (regNo/dept/year row):
old2 = '''            "q1": getattr(r, "q1_observed_seconds", None) or getattr(r, "q1", 0) or 0,
            "q2": getattr(r, "q2_observed_seconds", None) or getattr(r, "q2", 0) or 0,
            "q3": getattr(r, "q3_observed_seconds", None) or getattr(r, "q3", 0) or 0,
            "q4": getattr(r, "q4_observed_seconds", None) or getattr(r, "q4", 0) or 0,'''
new2 = '''            "q1": getattr(r, "q1_observed_seconds", None) or getattr(r, "q1", 0) or 0,
            "q2": getattr(r, "q2_observed_seconds", None) or getattr(r, "q2", 0) or 0,
            "q3": getattr(r, "q3_observed_seconds", None) or getattr(r, "q3", 0) or 0,
            "q4": getattr(r, "q4_observed_seconds", None) or getattr(r, "q4", 0) or 0,
            "q_timing": _build_q_timing(r),'''
if old2 in t:
    t = t.replace(old2, new2)
    print('Patched regNo row')

with open('e:/Leetcode Web/backend/routes/weekly_contests.py', 'w', encoding='utf-8') as f:
    f.write(t)
print('Done')
