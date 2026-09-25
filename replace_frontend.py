import re

filepath = r"E:\Leetcode Web\frontend\src\components\ReportPreview.tsx"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace plain text and single quote versions
content = content.replace("Not Available", "—")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Replaced all Not Available in ReportPreview.tsx")
