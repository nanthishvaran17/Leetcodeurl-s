import re
with open('e:/Leetcode Web/frontend/src/components/PreviousWeekContestPanel.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("onClick={() => setSelectedTypeFilter('PUBLIC')}", "onClick={() => setSelectedTypeFilter('ALL')}")

with open('e:/Leetcode Web/frontend/src/components/PreviousWeekContestPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
