import sys

file_path = r'e:\Leetcode Web\backend\exporters\excel_exporter.py'
with open(file_path, 'r') as f:
    content = f.read()

target = '''    tot_students = len(rows)
    attended_rows = [r for r in rows if r["is_att"]]
    tot_attended = len(attended_rows)
    tot_not_attended = tot_students - tot_attended
    att_pct = (tot_attended / tot_students * 100) if tot_students > 0 else 0.0'''

replacement = '''    tot_students = len(rows)
    attended_rows = [r for r in rows if r["is_att"]]
    tot_attended = len(attended_rows)
    
    tot_data_errors = sum(1 for r in rows if str(r.get("status") or "").upper() in ("USERNAME_NOT_FOUND", "INVALID_USERNAME", "PENDING_USERNAME", "UNLINKED", "ERROR", "DATA_ERROR", "FETCH_FAILED", "FETCH_ERROR"))
    tot_not_attended = tot_students - tot_attended - tot_data_errors
    if tot_not_attended < 0:
        tot_not_attended = 0
        
    att_pct = (tot_attended / tot_students * 100) if tot_students > 0 else 0.0'''

if target in content:
    content = content.replace(target, replacement)
    
target2 = '''    kpis = [
        ("TOTAL SCOPE ROSTER", f"{tot_students:,}", "A", "B", "1B365D"),
        ("OFFICIAL CONTEST ATTENDANCE", f"{tot_attended:,} ({att_pct:.1f}%)", "C", "E", "059669"),
        ("NOT ATTENDED / NO EVIDENCE", f"{tot_not_attended:,}", "F", "G", "DC2626"),
        ("TOTAL CONTEST SOLVES", f"{total_solves:,}", "H", "J", "2E5B88"),
    ]'''

replacement2 = '''    kpis = [
        ("TOTAL SCOPE ROSTER", f"{tot_students:,}", "A", "B", "1B365D"),
        ("OFFICIAL ATTENDANCE", f"{tot_attended:,} ({att_pct:.1f}%)", "C", "D", "059669"),
        ("NOT ATTENDED", f"{tot_not_attended:,}", "E", "F", "DC2626"),
        ("DATA ERRORS", f"{tot_data_errors:,}", "G", "H", "B45309"),
        ("TOTAL SOLVES", f"{total_solves:,}", "I", "J", "2E5B88"),
    ]'''

if target2 in content:
    content = content.replace(target2, replacement2)
    with open(file_path, 'w') as f:
        f.write(content)
    print('SUCCESS')
else:
    print('TARGET2 NOT FOUND')
