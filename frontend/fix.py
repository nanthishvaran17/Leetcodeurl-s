import re
with open('e:/Leetcode Web/frontend/src/components/PreviousWeekContestPanel.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

filters = ['PUBLIC', 'VIRTUAL', 'NOT_PARTICIPATED', 'NOT_VERIFIED', 'MISSING_LEETCODE_USERNAME']
for f_val in filters:
    text = re.sub(
        r"setSelectedTypeFilter\('_SET_ME_'\)(.*?)selectedTypeFilter === '" + f_val + "'",
        f"setSelectedTypeFilter('{f_val}'){chr(92)}1selectedTypeFilter === '{f_val}'",
        text,
        flags=re.DOTALL
    )

with open('e:/Leetcode Web/frontend/src/components/PreviousWeekContestPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
