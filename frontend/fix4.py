import re
with open('e:/Leetcode Web/frontend/src/components/PreviousWeekContestPanel.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("q1: (row.q1 === 1 || row.q1 === '1') ? 1 : 0,", "q1: Number(row.q1) || 0,")
text = text.replace("q2: (row.q2 === 1 || row.q2 === '1') ? 1 : 0,", "q2: Number(row.q2) || 0,")
text = text.replace("q3: (row.q3 === 1 || row.q3 === '1') ? 1 : 0,", "q3: Number(row.q3) || 0,")
text = text.replace("q4: (row.q4 === 1 || row.q4 === '1') ? 1 : 0,", "q4: Number(row.q4) || 0,")

with open('e:/Leetcode Web/frontend/src/components/PreviousWeekContestPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
