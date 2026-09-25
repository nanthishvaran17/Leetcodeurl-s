import os

def replace_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    new_content = content.replace('"Not Available"', '"—"')
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Replaced in {filepath}")

if __name__ == "__main__":
    files = [
        r"E:\Leetcode Web\backend\services\contest_performance_service.py",
        r"E:\Leetcode Web\backend\services\master_institutional_report_service.py",
        r"E:\Leetcode Web\frontend\src\components\ReportPreview.tsx"
    ]
    for f in files:
        replace_in_file(f)
