with open('frontend/src/components/MobileFilterDrawer.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Add imports
old_imp = """import { useFilters } from '../context/FilterContext';
import { SwipeHandle } from './SwipeHandle';"""

new_imp = """import { useFilters } from '../context/FilterContext';
import { useDepartments } from '../context/DepartmentContext';
import { normalizeDepartment, normalizeAcademicYear } from '../utils/filterUtils';
import { SwipeHandle } from './SwipeHandle';"""

code = code.replace(old_imp, new_imp, 1)

# Update MobileFilterDrawer definition
old_fn = """export const MobileFilterDrawer: React.FC<MobileFilterDrawerProps> = ({
  isOpen,
  onClose,
  departments = [
    { code: 'ALL', name: 'All Departments' },
    { code: 'CSE', name: 'Computer Science' },
    { code: 'ECE', name: 'Electronics & Comm.' },
    { code: 'EEE', name: 'Electrical & Electronics' },
    { code: 'MECH', name: 'Mechanical Engg.' },
    { code: 'CIVIL', name: 'Civil Engg.' },
    { code: 'IT', name: 'Information Tech.' },
    { code: 'AIDS', name: 'AI & Data Science' },
    { code: 'AIML', name: 'AI & Machine Learning' },
    { code: 'CYBER', name: 'Cyber Security' }
  ]
}) => {"""

new_fn = """export const MobileFilterDrawer: React.FC<MobileFilterDrawerProps> = ({
  isOpen,
  onClose,
  departments: propDepartments
}) => {
  const { departments: ctxDepartments = [] } = useDepartments();
  const rawDepartments = (propDepartments && propDepartments.length > 0) ? propDepartments : ctxDepartments;

  const departments = React.useMemo(() => {
    const list: Array<{ code: string; name: string }> = [{ code: 'ALL', name: 'All Departments' }];
    const seen = new Set<string>(['ALL']);

    if (rawDepartments && rawDepartments.length > 0) {
      rawDepartments.forEach((d: any) => {
        const c = (d.code || d.department_code || '').trim();
        const n = (d.name || d.department_name || c).trim();
        if (!c || seen.has(c.toUpperCase())) return;
        seen.add(c.toUpperCase());
        list.push({ code: c, name: n });
      });
    }

    const core = [
      { code: 'CSE(CS)', name: 'Computer Science & Engineering (Cyber Security)' },
      { code: 'CSE(IOT)', name: 'Computer Science & Engineering (IoT)' },
      { code: 'IT', name: 'Information Technology' }
    ];
    for (const c of core) {
      if (!seen.has(c.code.toUpperCase())) {
        seen.add(c.code.toUpperCase());
        list.push(c);
      }
    }
    return list;
  }, [rawDepartments]);"""

code = code.replace(old_fn, new_fn, 1)

# Update years
old_years = """  const years = [
    { id: 'ALL', label: 'All Years' },
    { id: '1st Year', label: '1st Year (I)' },
    { id: '2nd Year', label: '2nd Year (II)' },
    { id: '3rd Year', label: '3rd Year (III)' },
    { id: '4th Year', label: '4th Year (IV)' }
  ];"""

new_years = """  const years = [
    { id: 'ALL', label: 'All Years' },
    { id: '1', label: '1st Year (I)' },
    { id: '2', label: '2nd Year (II)' },
    { id: '3', label: '3rd Year (III)' },
    { id: '4', label: '4th Year (IV)' }
  ];"""

code = code.replace(old_years, new_years, 1)

# Update dept isSelected
old_dept_sel = """              {departments.map((dept) => {
                const isSelected = department === dept.code;"""

new_dept_sel = """              {departments.map((dept) => {
                const isSelected = 
                  (dept.code === 'ALL' && (department === 'ALL' || !department || department === 'all')) ||
                  normalizeDepartment(department) === normalizeDepartment(dept.code);"""

code = code.replace(old_dept_sel, new_dept_sel, 1)

# Update year isSelected
old_yr_sel = """              {years.map((y) => {
                const isSelected = academicYear === y.id;"""

new_yr_sel = """              {years.map((y) => {
                const isSelected = 
                  (y.id === 'ALL' && (academicYear === 'ALL' || !academicYear || academicYear === 'all')) ||
                  normalizeAcademicYear(academicYear) === normalizeAcademicYear(y.id);"""

code = code.replace(old_yr_sel, new_yr_sel, 1)

with open('frontend/src/components/MobileFilterDrawer.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated MobileFilterDrawer.tsx successfully!")
