/**
 * Staff Role Utilities for LeetCode Web
 * Determines mentee eligibility and leadership scope across the institution.
 */

/**
 * Determines whether a staff member's role qualifies for having assigned student mentees.
 * 
 * Rules:
 * - Executive / Leadership roles (Principal, Department HOD, Admin, Super Admin, Management, Director)
 *   do NOT mentor student cohorts. Assigned Mentees does not apply to them.
 * - Faculty, Faculty Mentors, Staff Mentors, Proctors, and Placement Coordinators ARE eligible for assigned mentees.
 */
export function isRoleEligibleForMentees(role?: string, mentoringRole?: string): boolean {
  const r = (role || '').trim().toLowerCase();
  const mr = (mentoringRole || '').trim().toLowerCase();

  if (!r && !mr) return false;

  // Non-mentoring administrative & leadership roles
  const nonMentoringKeywords = [
    'principal',
    'hod',
    'department hod',
    'admin',
    'administrator',
    'super admin',
    'super_admin',
    'management',
    'director',
    'trustee',
    'dean'
  ];

  if (nonMentoringKeywords.some(keyword => r === keyword || r.includes(keyword) || mr === keyword || mr.includes(keyword))) {
    return false;
  }

  // Eligible mentoring roles: Faculty, Mentors, Proctors, Placement Coordinators, Staff Mentors
  const mentoringKeywords = [
    'faculty',
    'mentor',
    'proctor',
    'placement',
    'plc',
    'staff'
  ];

  if (mentoringKeywords.some(keyword => r.includes(keyword) || mr.includes(keyword))) {
    return true;
  }

  return false;
}
