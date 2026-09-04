import os
import re

files_to_fix = [
    'frontend/src/components/AdminStaffAllocationPanel.tsx',
    'frontend/src/components/CertificateManagementModal.tsx',
    'frontend/src/components/ImportModal.tsx',
    'frontend/src/components/StaffMentoringDetailModal.tsx',
    'frontend/src/components/admin/CreateStaffModal.tsx',
    'frontend/src/pages/AuditLogPage.tsx',
    'frontend/src/pages/HODCommandCenter.tsx',
    'frontend/src/pages/SettingsPage.tsx',
    'frontend/src/pages/WeeklyContestPage.tsx'
]

def replacer(match):
    tag_full = match.group(0)
    # if it has onClick, keep it
    if 'onClick=' in tag_full or 'onClick={' in tag_full:
        return tag_full
    # else remove cursor-pointer
    return re.sub(r'\s*cursor-pointer\b', '', tag_full)

for filepath in files_to_fix:
    if not os.path.exists(filepath):
        print(f'Missing {filepath}')
        continue
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = re.sub(r'<(button|label|input)\b[^>]*>', replacer, content)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Fixed {filepath}')
    else:
        print(f'No changes in {filepath}')
