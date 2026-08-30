path = 'backend/exporters/excel_exporter.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace('ff"', 'f"')
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Fixed syntax error')
