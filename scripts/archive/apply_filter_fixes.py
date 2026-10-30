with open('frontend/src/utils/filterUtils.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update normalizeDepartment object handling
old_obj_cs = """    if (dept.id === 1 || combined.includes('CYBER') || combined.includes('CSE(CS)') || combined.includes('CSE-CS') || combined.includes('CSE (CS)')) {
      return 'cse_cs';
    }"""

new_obj_cs = """    if (dept.id === 1 || combined.includes('CYBER') || combined.includes('CSE(CS)') || combined.includes('CSE-CS') || combined.includes('CSE_CS') || combined.includes('CSE (CS)')) {
      return 'cse_cs';
    }"""

old_str_cs = """    if (clean.includes('CYBER') || clean.includes('CSE(CS)') || clean.includes('CSE-CS') || clean.includes('CSE (CS)')) {
      return 'cse_cs';
    }"""

new_str_cs = """    if (clean.includes('CYBER') || clean.includes('CSE(CS)') || clean.includes('CSE-CS') || clean.includes('CSE_CS') || clean.includes('CSE (CS)') || clean === 'CS') {
      return 'cse_cs';
    }"""

# 2. Update deriveYearLevelFromRegNo
old_derive_yr = """export function deriveYearLevelFromRegNo(regNoStr?: string, currentYearVal?: any): 'I' | 'II' | 'III' | 'IV' {
  if (currentYearVal != null && currentYearVal !== '') {
    const valStr = String(currentYearVal).trim().toUpperCase();
    const clean = valStr.replace(/\\b(YEAR|YR|BATCH|ST|ND|RD|TH)\\b/gi, '').replace(/[\\s\\-\\_]+/g, '').trim();
    if (valStr === '1' || valStr === 'I' || clean === '1' || clean === 'I' || valStr.includes('1ST') || valStr.includes('FIRST') || valStr.includes('2030') || valStr.includes('2026-2030')) return 'I';
    if (valStr === '2' || valStr === 'II' || clean === '2' || clean === 'II' || valStr.includes('2ND') || valStr.includes('SECOND') || valStr.includes('2029') || valStr.includes('2025-2029')) return 'II';
    if (valStr === '3' || valStr === 'III' || clean === '3' || clean === 'III' || valStr.includes('3RD') || valStr.includes('THIRD') || valStr.includes('2028') || valStr.includes('2024-2028')) return 'III';
    if (valStr === '4' || valStr === 'IV' || clean === '4' || clean === 'IV' || valStr.includes('4TH') || valStr.includes('FOURTH') || valStr.includes('FINAL') || valStr.includes('2027') || valStr.includes('2023-2027')) return 'IV';
  }"""

new_derive_yr = """export function deriveYearLevelFromRegNo(regNoStr?: string, currentYearVal?: any): 'I' | 'II' | 'III' | 'IV' {
  if (currentYearVal != null && currentYearVal !== '') {
    const normYear = normalizeAcademicYear(currentYearVal);
    if (normYear === '1') return 'I';
    if (normYear === '2') return 'II';
    if (normYear === '3') return 'III';
    if (normYear === '4') return 'IV';
  }"""

# 3. Update normalizeAcademicYear
old_norm_yr = """export function normalizeAcademicYear(yr: any): NormalizedAcademicYear {
  if (!yr || yr === 'ALL' || yr === 'all' || yr === 'ALL YEARS' || yr === 'ALL_YEARS') {
    return 'all';
  }

  const raw = String(yr).trim().toUpperCase();
  const clean = raw.replace(/\\b(YEAR|YR|BATCH|ST|ND|RD|TH)\\b/gi, '').replace(/[\\s\\-\\_]+/g, '').trim();

  if (['I', '1', '1ST', 'FIRST', '2030'].includes(raw) || ['I', '1'].includes(clean)) return '1';
  if (['II', '2', '2ND', 'SECOND', '2029'].includes(raw) || ['II', '2'].includes(clean)) return '2';
  if (['III', '3', '3RD', 'THIRD', '2028'].includes(raw) || ['III', '3'].includes(clean)) return '3';
  if (['IV', '4', '4TH', 'FOURTH', 'FINAL', '2027', '2026'].includes(raw) || ['IV', '4'].includes(clean)) return '4';

  return clean || raw;
}"""

new_norm_yr = """export function normalizeAcademicYear(yr: any): NormalizedAcademicYear {
  if (!yr || yr === 'ALL' || yr === 'all' || yr === 'ALL YEARS' || yr === 'ALL_YEARS' || yr === 'ALL_YEAR') {
    return 'all';
  }

  const raw = String(yr).trim().toUpperCase();
  if (raw === 'ALL' || raw === 'ALL YEARS' || raw === 'ALL_YEARS' || raw === 'ALL COHORTS') return 'all';

  if (
    raw === 'Y4' ||
    raw.includes('IV') ||
    raw.includes('FINAL') ||
    raw.includes('FOURTH') ||
    /\\b4(TH)?\\b/.test(raw) ||
    raw.startsWith('4') ||
    raw.includes('2027') ||
    raw.includes('2023')
  ) {
    return '4';
  }

  if (
    raw === 'Y3' ||
    raw.includes('III') ||
    raw.includes('THIRD') ||
    /\\b3(RD)?\\b/.test(raw) ||
    raw.startsWith('3') ||
    raw.includes('2028') ||
    raw.includes('2024')
  ) {
    return '3';
  }

  if (
    raw === 'Y2' ||
    raw.includes('II') ||
    raw.includes('SECOND') ||
    /\\b2(ND)?\\b/.test(raw) ||
    raw.startsWith('2') ||
    raw.includes('2029') ||
    raw.includes('2025')
  ) {
    return '2';
  }

  if (
    raw === 'Y1' ||
    raw.includes('1ST') ||
    raw.includes('FIRST') ||
    /\\b1(ST)?\\b/.test(raw) ||
    raw.startsWith('1') ||
    raw === 'I' ||
    raw.includes('YEAR I') ||
    raw.includes('YEAR 1') ||
    raw.includes('I YEAR') ||
    raw.includes('2030') ||
    raw.includes('2026')
  ) {
    return '1';
  }

  const clean = raw.replace(/(YEAR|YR|BATCH|ST|ND|RD|TH)/gi, '').replace(/[\\s\\-\\_\\(\\)]+/g, '').trim();
  if (clean === '1' || clean === 'I') return '1';
  if (clean === '2' || clean === 'II') return '2';
  if (clean === '3' || clean === 'III') return '3';
  if (clean === '4' || clean === 'IV') return '4';

  return clean || raw;
}"""

# 4. Update matchesAcademicYear
old_matches_yr = """export function matchesAcademicYear(student: StudentData, selectedYear: string): boolean {
  const targetNorm = normalizeAcademicYear(selectedYear);
  if (targetNorm === 'all') return true;

  const derivedYear = deriveYearLevelFromRegNo(student.reg_no, student.year_level || (student as any).batch);
  const studentNorm = normalizeAcademicYear(derivedYear);
  if (studentNorm === targetNorm) return true;

  if (String((student as any).batch) === String(selectedYear)) return true;

  return false;
}"""

new_matches_yr = """export function matchesAcademicYear(student: StudentData, selectedYear: string): boolean {
  const targetNorm = normalizeAcademicYear(selectedYear);
  if (targetNorm === 'all') return true;

  const derivedYear = deriveYearLevelFromRegNo(student.reg_no, student.year_level || (student as any).batch);
  const studentNorm = normalizeAcademicYear(derivedYear);
  if (studentNorm === targetNorm) return true;

  if (student.year_level && normalizeAcademicYear(student.year_level) === targetNorm) return true;
  if ((student as any).batch && normalizeAcademicYear((student as any).batch) === targetNorm) return true;

  return false;
}"""

# 5. Update matchesDepartment
old_matches_dept = """export function matchesDepartment(student: StudentData, selectedDept: string | any): boolean {
  const targetNorm = normalizeDepartment(selectedDept);
  if (targetNorm === 'all') return true;

  if (typeof selectedDept === 'number' && student.department_id === selectedDept) {
    return true;
  }

  const studentNorm = normalizeDepartment(student.department ?? student.department_id);
  if (studentNorm === targetNorm) return true;

  const derivedDeptFromReg = deriveDepartmentFromRegNo(student.reg_no);
  if (derivedDeptFromReg && normalizeDepartment(derivedDeptFromReg) === targetNorm) {
    return true;
  }

  const deptStr = typeof student.department === 'string' ? student.department : (student.department?.name || student.department?.code || '');
  const selStr = typeof selectedDept === 'string' ? selectedDept : (selectedDept?.name || selectedDept?.code || '');
  if (deptStr && selStr && String(deptStr).trim().toLowerCase() === String(selStr).trim().toLowerCase()) {
    return true;
  }

  return false;
}"""

new_matches_dept = """export function matchesDepartment(student: StudentData, selectedDept: string | any): boolean {
  const targetNorm = normalizeDepartment(selectedDept);
  if (targetNorm === 'all') return true;

  if (typeof selectedDept === 'number' && student.department_id === selectedDept) {
    return true;
  }
  if (student.department_id != null && selectedDept != null && String(student.department_id) === String(selectedDept)) {
    return true;
  }
  if (student.department_id != null && selectedDept?.id != null && String(student.department_id) === String(selectedDept.id)) {
    return true;
  }

  const studentNorm = normalizeDepartment(student.department ?? student.department_id);
  if (studentNorm === targetNorm) return true;

  const derivedDeptFromReg = deriveDepartmentFromRegNo(student.reg_no);
  if (derivedDeptFromReg && normalizeDepartment(derivedDeptFromReg) === targetNorm) {
    return true;
  }

  const deptStr = typeof student.department === 'string' ? student.department : (student.department?.name || student.department?.code || '');
  const selStr = typeof selectedDept === 'string' ? selectedDept : (selectedDept?.name || selectedDept?.code || '');
  if (deptStr && selStr && String(deptStr).trim().toLowerCase() === String(selStr).trim().toLowerCase()) {
    return true;
  }

  return false;
}"""

assert old_obj_cs in content, "old_obj_cs not found"
content = content.replace(old_obj_cs, new_obj_cs, 1)

assert old_str_cs in content, "old_str_cs not found"
content = content.replace(old_str_cs, new_str_cs, 1)

assert old_derive_yr in content, "old_derive_yr not found"
content = content.replace(old_derive_yr, new_derive_yr, 1)

assert old_norm_yr in content, "old_norm_yr not found"
content = content.replace(old_norm_yr, new_norm_yr, 1)

assert old_matches_yr in content, "old_matches_yr not found"
content = content.replace(old_matches_yr, new_matches_yr, 1)

assert old_matches_dept in content, "old_matches_dept not found"
content = content.replace(old_matches_dept, new_matches_dept, 1)

with open('frontend/src/utils/filterUtils.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully applied all filterUtils fixes!")
