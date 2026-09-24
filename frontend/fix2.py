import re
with open('e:/Leetcode Web/frontend/src/components/PreviousWeekContestPanel.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(r"setSelectedTypeFilter\('[^']+'\)(.*?selectedTypeFilter === '([^']+)')", r"setSelectedTypeFilter('\2')\1", text, flags=re.DOTALL)

with open('e:/Leetcode Web/frontend/src/components/PreviousWeekContestPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
