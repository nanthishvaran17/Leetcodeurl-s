with open('e:/Leetcode Web/frontend/src/components/PreviousWeekContestPanel.tsx', 'r', encoding='utf-8') as f:
    t = f.read()

# Add q_timing passthrough
old = "              q4: Number(row.q4) || 0,\n              problems_solved: "
new = "              q4: Number(row.q4) || 0,\n              q_timing: row.q_timing || null,\n              problems_solved: "
if old in t:
    t = t.replace(old, new, 1)
    print('Patched q_timing passthrough')

with open('e:/Leetcode Web/frontend/src/components/PreviousWeekContestPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(t)
