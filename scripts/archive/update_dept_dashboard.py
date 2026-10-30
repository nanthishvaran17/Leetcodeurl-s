with open('frontend/src/pages/DepartmentDashboard.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Import
old_imp = "import { filterAndSortStudents } from '../utils/filterUtils';"
new_imp = "import { filterAndSortStudents, normalizeDepartment, normalizeAcademicYear } from '../utils/filterUtils';"
code = code.replace(old_imp, new_imp, 1)

# Dept isSelected
old_dept = "const isSelected = selectedDept === d.id || (d.id === 'all' && (selectedDept === 'all' || selectedDept === 'ALL'));"
new_dept = """const isSelected = 
                selectedDept === d.id || 
                (d.id === 'all' && (selectedDept === 'all' || selectedDept === 'ALL')) ||
                normalizeDepartment(selectedDept) === normalizeDepartment(d.id);"""
code = code.replace(old_dept, new_dept, 1)

# Year isSelected
old_yr = "const isSelected = yearLevel === y.value;"
new_yr = """const isSelected = 
                yearLevel === y.value ||
                (y.value === 'all' && (yearLevel === 'all' || yearLevel === 'ALL')) ||
                normalizeAcademicYear(yearLevel) === normalizeAcademicYear(y.value);"""
code = code.replace(old_yr, new_yr, 1)

with open('frontend/src/pages/DepartmentDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated DepartmentDashboard.tsx successfully!")
