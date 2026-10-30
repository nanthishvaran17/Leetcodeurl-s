import { CANONICAL_ROSTER } from '../frontend/src/data/canonicalRoster';
import { normalizeDepartment, normalizeAcademicYear, deriveYearLevelFromRegNo, matchesDepartment, matchesAcademicYear } from '../frontend/src/utils/filterUtils';

console.log('Testing Canonical Roster (566 students) using live filterUtils.ts:');
for (const dept of ['CYBER', 'Cyber Security', 'CSE(CS)', 'cse_cs', '1', 1]) {
  const allCS = CANONICAL_ROSTER.filter(s => matchesDepartment(s as any, dept));
  const cs3 = CANONICAL_ROSTER.filter(s => matchesDepartment(s as any, dept) && matchesAcademicYear(s as any, '3rd Year'));
  const cs3_roman = CANONICAL_ROSTER.filter(s => matchesDepartment(s as any, dept) && matchesAcademicYear(s as any, 'III'));
  const cs3_num = CANONICAL_ROSTER.filter(s => matchesDepartment(s as any, dept) && matchesAcademicYear(s as any, '3'));
  const cs3_label = CANONICAL_ROSTER.filter(s => matchesDepartment(s as any, dept) && matchesAcademicYear(s as any, '3rd Year (III)'));
  const cs2 = CANONICAL_ROSTER.filter(s => matchesDepartment(s as any, dept) && matchesAcademicYear(s as any, '2nd Year'));
  const cs4 = CANONICAL_ROSTER.filter(s => matchesDepartment(s as any, dept) && matchesAcademicYear(s as any, '4th Year'));
  console.log(`Dept ${JSON.stringify(dept)}: All=${allCS.length}, 3rd Year=${cs3.length}, III=${cs3_roman.length}, 3=${cs3_num.length}, 3rd Year (III)=${cs3_label.length}, 2nd Year=${cs2.length}, 4th Year=${cs4.length}`);
}
