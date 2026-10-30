with open('frontend/src/pages/StudentMasterPage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Import
old_imp = "import { MobileFilterDrawer } from '../components/MobileFilterDrawer';"
new_imp = """import { MobileFilterDrawer } from '../components/MobileFilterDrawer';
import { normalizeDepartment, normalizeAcademicYear } from '../utils/filterUtils';"""
code = code.replace(old_imp, new_imp, 1)

# Dept and Year resolution in queryFn
old_block = """      // Map department CODE to ID
      const allDepts = departments.length > 0 ? departments : (ctxDepts.length > 0 ? ctxDepts : globalDepts);
      if (filters.department && filters.department !== 'ALL') {
        let deptIdToUse: number | undefined;
        if (allDepts.length > 0) {
          const found = allDepts.find((d: any) => 
            (d.code || d.department_code || '').toUpperCase() === filters.department.toUpperCase() || 
            (d.name || d.department_name || '').toUpperCase() === filters.department.toUpperCase()
          );
          if (found) deptIdToUse = found.id || found.department_id;
        }
        if (!deptIdToUse) {
          const deptMap: Record<string, number> = {
            'CSE(CS)': 1, 'CS': 1, 'CYBER': 1,
            'CSE(IOT)': 2, 'IOT': 2,
            'IT': 4,
            'CSE': 5,
            'AIDS': 10,
            'ECE': 12,
            'AGRI': 17,
            'MECH': 18,
            'CIVIL': 19,
            'EEE': 20
          };
          deptIdToUse = deptMap[filters.department.toUpperCase()];
        }
        if (deptIdToUse) params.dept_id = deptIdToUse;
        params.department = filters.department;
      }
      
      if (filters.academicYear && filters.academicYear !== 'ALL') {
        params.year_level = filters.academicYear;
      }"""

new_block = """      // Map department CODE to ID
      const allDepts = departments.length > 0 ? departments : (ctxDepts.length > 0 ? ctxDepts : globalDepts);
      if (filters.department && filters.department !== 'ALL') {
        let deptIdToUse: number | undefined;
        if (allDepts.length > 0) {
          const found = allDepts.find((d: any) => 
            (d.code || d.department_code || '').toUpperCase() === filters.department.toUpperCase() || 
            (d.name || d.department_name || '').toUpperCase() === filters.department.toUpperCase() ||
            normalizeDepartment(d) === normalizeDepartment(filters.department)
          );
          if (found) deptIdToUse = found.id || found.department_id;
        }
        if (!deptIdToUse) {
          const deptMap: Record<string, number> = {
            'CSE(CS)': 1, 'CS': 1, 'CYBER': 1, 'CSE_CS': 1, 'CYBER SECURITY': 1,
            'CSE(IOT)': 2, 'IOT': 2, 'CSE_IOT': 2,
            'IT': 4,
            'CSE': 5,
            'AIDS': 10,
            'ECE': 12,
            'AGRI': 17,
            'MECH': 18,
            'CIVIL': 19,
            'EEE': 20
          };
          deptIdToUse = deptMap[filters.department.toUpperCase()];
          if (!deptIdToUse) {
            const norm = normalizeDepartment(filters.department);
            if (norm === 'cse_cs') deptIdToUse = 1;
            else if (norm === 'cse_iot') deptIdToUse = 2;
            else if (norm === 'it') deptIdToUse = 4;
          }
        }
        if (deptIdToUse) params.dept_id = deptIdToUse;
        params.department = filters.department;
      }
      
      if (filters.academicYear && filters.academicYear !== 'ALL') {
        params.year_level = normalizeAcademicYear(filters.academicYear);
      }"""

code = code.replace(old_block, new_block, 1)

with open('frontend/src/pages/StudentMasterPage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated StudentMasterPage.tsx successfully!")
