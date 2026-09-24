with open('e:/Leetcode Web/backend/services/canonical_contest_engine.py', 'r', encoding='utf-8') as f:
    t = f.read()

# Add local import for _build_q_timing
if '_build_q_timing' not in t:
    t = t.replace(
        '"q4": q4_val,',
        '"q4": q4_val,\n            "q_timing": __import__("backend.routes.weekly_contests", fromlist=["_build_q_timing"])._build_q_timing(p_res) if p_res else None,'
    )
    print('Injected q_timing into canonical engine')
    with open('e:/Leetcode Web/backend/services/canonical_contest_engine.py', 'w', encoding='utf-8') as f:
        f.write(t)
else:
    print('Already injected')
