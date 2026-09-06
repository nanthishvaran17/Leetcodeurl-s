import re
import os

files_to_clean = [
    r"e:\Leetcode Web\backend\services\whatsapp_query_engine.py",
    r"e:\Leetcode Web\backend\services\bot_notification_service.py",
    r"e:\Leetcode Web\backend\services\ast_anti_cheat_engine.py",
    r"e:\Leetcode Web\backend\services\live_sync_service.py",
    r"e:\Leetcode Web\backend\services\proactive_intel_service.py",
    r"e:\Leetcode Web\backend\services\notification_outbox_worker.py",
]

# Regex pattern for emojis
emoji_pattern = re.compile(
    "["
    "\U0001F1E0-\U0001F1FF"  # flags (iOS)
    "\U0001F300-\U0001F5FF"  # symbols & pictographs
    "\U0001F600-\U0001F64F"  # emoticons
    "\U0001F680-\U0001F6FF"  # transport & map symbols
    "\U0001F700-\U0001F77F"  # alchemical symbols
    "\U0001F780-\U0001F7FF"  # Geometric Shapes Extended
    "\U0001F800-\U0001F8FF"  # Supplemental Arrows-C
    "\U0001F900-\U0001F9FF"  # Supplemental Symbols and Pictographs
    "\U0001FA00-\U0001FA6F"  # Chess Symbols
    "\U0001FA70-\U0001FAFF"  # Symbols and Pictographs Extended-A
    "\U00002702-\U000027B0"  # Dingbats
    "\U000024C2-\U0001F251"
    "\U00002600-\U000026FF"  # Miscellaneous Symbols
    "]+",
    flags=re.UNICODE
)

for file_path in files_to_clean:
    if not os.path.exists(file_path):
        print(f"Skipping non-existent: {file_path}")
        continue
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Clean emojis
    cleaned = emoji_pattern.sub("", content)
    
    # Clean up double spaces created by emoji stripping
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    # Fix python indentation if affected
    lines = content.splitlines(keepends=True)
    cleaned_lines = []
    for line in lines:
        cleaned_line = emoji_pattern.sub("", line)
        # Strip trailing spaces before newline but preserve indentation
        indent = len(cleaned_line) - len(cleaned_line.lstrip(" \t"))
        cleaned_line_clean = cleaned_line[:indent] + re.sub(r" +", " ", cleaned_line[indent:])
        cleaned_lines.append(cleaned_line_clean)
        
    final_content = "".join(cleaned_lines)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(final_content)
    print(f"Cleaned: {file_path}")

print("All target backend services cleaned.")
