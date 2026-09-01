import sys

file_path = r"e:\Leetcode Web\frontend\src\components\admin\StaffManagement.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

start_idx = -1
for i, line in enumerate(lines):
    if "{showModal && (" in line:
        start_idx = i
        break

if start_idx == -1:
    print("Could not find start idx")
    sys.exit(1)

end_idx = len(lines) - 3 # before last </div> and ); }

# Replace
lines.insert(start_idx, "      {createPortal(\n        <>\n")

# Re-calculate end_idx after insert
end_idx = len(lines) - 2

lines.insert(end_idx, "        </>,\n        document.body\n      )}\n")

with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(lines)

print("Done")
