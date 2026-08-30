import re
path = 'backend/exporters/excel_exporter.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace header strings
content = re.sub(r'\"WEEKLY CONTEST 516 — (.*?)\"', r'f"{contest_name.upper()} — \1"', content)
content = re.sub(r'\"WEEKLY CONTEST 516 - (.*?)\"', r'f"{contest_name.upper()} - \1"', content)

# Replace evidence string
content = re.sub(r'\"NO_CONTEST_516_EVIDENCE\"', r'f"NO_{contest_name.upper().replace(\' \', \'_\')}_EVIDENCE"', content)

# Replace other strings
content = re.sub(r'\"Contest 516 Problem Set\"', r'f"{contest_name} Problem Set"', content)
content = re.sub(r'\"Contest516ReconciliationService', r'f"{contest_name.replace(\' \', \'\')}ReconciliationService', content)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Updated excel_exporter.py successfully')
