lines = open('backend/services/student_report_service.py').read().split('\n')
out = []
in_try = False
for l in lines: 
    if l == '    finally:': 
        in_try = False
    
    if in_try and not l.startswith('    finally:'): 
        out.append('    ' + l if l.strip() else l) 
    else: 
        out.append(l) 
        
    if l == '    try:': 
        in_try = True 

open('backend/services/student_report_service.py', 'w').write('\n'.join(out))
