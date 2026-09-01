import sys

file_path = r"e:\Leetcode Web\frontend\src\components\admin\StaffManagement.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Add import if not present
if "import { createPortal }" not in "".join(lines):
    lines.insert(1, "import { createPortal } from 'react-dom';\n")

start_idx = -1
for i, line in enumerate(lines):
    if "{showModal && (" in line:
        start_idx = i
        break

if start_idx == -1:
    print("Could not find start idx")
    sys.exit(1)

# Find the final </div> which is 2 lines before the end
end_idx = len(lines) - 1
while end_idx >= 0:
    if "</div>" in lines[end_idx] and ");" in lines[end_idx+1]:
        break
    end_idx -= 1

if end_idx < 0:
    print("Could not find end idx")
    sys.exit(1)

# Insert the end first (so indices don't shift for start)
lines.insert(end_idx, "        </>,\n        document.body\n      )}\n")
lines.insert(start_idx, "      {createPortal(\n        <>\n")

with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(lines)

print("Done")
