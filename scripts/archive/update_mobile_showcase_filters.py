with open('frontend/src/components/mobile/MobileStudentShowcaseFilters.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Import
old_imp = "import { DropdownOption } from '../CustomDropdown';"
new_imp = """import { DropdownOption } from '../CustomDropdown';
import { normalizeDepartment, normalizeAcademicYear } from '../../utils/filterUtils';"""

code = code.replace(old_imp, new_imp, 1)

# Dept selection
old_dept = """                    {deptList.map((dept) => {
                      const isSelected = selectedDept.toLowerCase() === dept.value.toLowerCase() ||
                        (selectedDept === 'all' && dept.value === 'all');"""

new_dept = """                    {deptList.map((dept) => {
                      const isSelected = 
                        (selectedDept === 'all' && dept.value === 'all') ||
                        selectedDept.toLowerCase() === dept.value.toLowerCase() ||
                        normalizeDepartment(selectedDept) === normalizeDepartment(dept.value);"""

code = code.replace(old_dept, new_dept, 1)

# Year selection
old_year = """                    {yearOptions.map((opt) => {
                      const isSelected = yearLevel === opt.value;"""

new_year = """                    {yearOptions.map((opt) => {
                      const isSelected = 
                        (yearLevel === 'all' && opt.value === 'all') ||
                        yearLevel === opt.value ||
                        normalizeAcademicYear(yearLevel) === normalizeAcademicYear(opt.value);"""

code = code.replace(old_year, new_year, 1)

with open('frontend/src/components/mobile/MobileStudentShowcaseFilters.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated MobileStudentShowcaseFilters.tsx successfully!")
