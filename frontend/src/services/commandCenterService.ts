/**
 * commandCenterService.ts
 * ─────────────────────────────────────────────────────────────────
 * TypeScript API client for the Command Center Operations & Scoped Analytics.
 * All endpoints backed by real-time SQLite database data.
 */

import api from './api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DeptHealth {
  health_score: number;
  participation_score: number;
  consistency_score: number;
  growth_score: number;
  contest_performance_score: number;
  difficulty_progress_score: number;
  total_students: number;
  active_this_week: number;
  inactive_count: number;
  at_risk_count: number;
  improving_count: number;
  avg_rating: number;
  avg_solved: number;
}

export interface ExecutiveBrief {
  improved: string;
  attention: string;
  skill: string;
  action: string;
}

export interface NeedsAttentionMetrics {
  inactive_count: number;
  declining_count: number;
  contest_verification_count: number;
  improving_count: number;
}

export interface DeptBenchmark {
  department_id: number;
  department_name: string;
  department_code: string;
  student_count: number;
  active_count: number;
  inactive_count?: number;
  improving_count?: number;
  avg_rating: number;
  avg_solved: number;
  participation_rate_pct: number;
  health_score: number;
  growth_rate_pct: string;
  rank?: number;
  active_score?: number;
  coding_engagement?: string;
  completion_rate?: number;
  at_risk_students?: number;
  faculty_mentors?: number;
  performance_trend?: string;
  health_status?: string;
}

export interface DepartmentIntelligenceDetails {
  top_performers: {
    rank: number;
    student_id: number;
    name: string;
    register_number: string;
    total_solved: number;
    last_active: string | null;
  }[];
  at_risk_students: {
    student_id: number;
    name: string;
    register_number: string;
    risk_level: string;
    risk_score: number;
    explanation: string;
    total_solved: number;
    last_active: string | null;
  }[];
}

export interface YearBenchmark {
  year: string;
  year_level: string;
  student_count: number;
  active_count: number;
  inactive_count?: number;
  avg_rating: number;
  avg_solved: number;
  participation_pct: number;
  health_score: number;
}

export interface StaffRecord {
  id: number;
  username: string;
  email: string;
  department_id?: number;
  department_code?: string;
  assigned_count: number;
  active_count?: number;
  max_allowed?: number;
  workload_status?: string;
  role?: string;
  is_active?: boolean;
  joined_date?: string;
  last_active?: string;
  coding_activity?: number;
}

export interface FacultyWorkloadItem {
  faculty_id: number;
  faculty_name: string;
  email: string;
  department_id?: number;
  department_code?: string;
  assigned_students: number;
  active_students: number;
  max_capacity: number;
  workload_status: string;
  students?: Array<{
    id: number;
    reg_no: string;
    name: string;
    year_level: string;
    total_solved: number;
    is_active: boolean;
  }>;
}

export interface CommandCenterSummary {
  department_health: DeptHealth;
  executive_brief?: ExecutiveBrief;
  needs_attention?: NeedsAttentionMetrics;
  benchmarks: {
    department_matrix: DeptBenchmark[];
    year_matrix: YearBenchmark[];
  };
  staff_list?: StaffRecord[];
  unassigned_student_count?: number;
  refreshed_at: string;
}

export interface StudentRecord {
  id: number;
  reg_no: string;
  name: string;
  year_level: string;
  department_id: number;
  department_name: string;
  department_code: string;
  leetcode_username: string;
  email: string;
  is_active: boolean;
  total_solved: number;
  weekly_change?: string;
  contest_standing?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'IMPROVING' | 'DECLINING';
  assigned_staff?: string;
  assigned_faculty_id?: number | null;
  contest_rating: number;
  easy_solved: number;
  medium_solved: number;
  hard_solved: number;
  last_updated: string;
}

export interface StudentListResponse {
  total: number;
  page: number;
  page_size: number;
  students: StudentRecord[];
}

export interface StudentAddPayload {
  reg_no: string;
  name: string;
  department_id: number;
  year_level: string;
  leetcode_username: string;
  email?: string;
  section_id?: number;
}

export interface StudentUpdatePayload {
  name?: string;
  department_id?: number;
  year_level?: string;
  leetcode_username?: string;
  email?: string;
  section_id?: number;
}

export interface DepartmentRecord {
  id: number;
  name: string;
  code: string;
  student_count: number;
}

// ── API Functions ─────────────────────────────────────────────────────────────

export async function getCommandCenterSummary(params?: {
  dept_id?: number;
  staff_id?: number;
  year_level?: string;
  section_id?: number;
}): Promise<CommandCenterSummary> {
  const res = await api.get<CommandCenterSummary>('/command-center/summary', { params });
  return res.data;
}

export async function getCommandCenterStudents(params: {
  page?: number;
  page_size?: number;
  search?: string;
  dept_id?: number;
  staff_id?: number;
  year_level?: string;
  section_id?: number;
  status_filter?: string;
  allocation_filter?: string;
  include_inactive?: boolean;
}): Promise<StudentListResponse> {
  const res = await api.get<StudentListResponse>('/command-center/students', { params });
  return res.data;
}

export async function getFacultyWorkload(dept_id?: number): Promise<{ total_faculty: number; faculty_workload: FacultyWorkloadItem[] }> {
  const res = await api.get('/command-center/faculty/workload', { params: { dept_id } });
  return res.data;
}

export async function assignStudentsBatch(faculty_id: number, student_ids: number[]): Promise<any> {
  const res = await api.post('/command-center/faculty/assign-batch', { faculty_id, student_ids });
  return res.data;
}

export async function unassignStudentsBatch(faculty_id: number, student_ids: number[]): Promise<any> {
  const res = await api.post('/command-center/faculty/unassign-batch', { faculty_id, student_ids });
  return res.data;
}

export async function autoDistributeDepartment(department_id: number): Promise<any> {
  const res = await api.post('/command-center/faculty/auto-distribute', { department_id });
  return res.data;
}

export async function getReportData(report_type: string, dept_id?: number): Promise<any> {
  const res = await api.get('/command-center/reports/data', { params: { report_type, dept_id } });
  return res.data;
}

export async function addStudent(payload: StudentAddPayload): Promise<{ success: boolean; student_id: number; message: string }> {
  const res = await api.post('/command-center/students/add', payload);
  return res.data;
}

export async function updateStudent(regNo: string, payload: StudentUpdatePayload): Promise<{ success: boolean; message: string }> {
  const res = await api.put(`/command-center/students/${encodeURIComponent(regNo)}`, payload);
  return res.data;
}

export async function deleteStudent(regNo: string): Promise<{ success: boolean; message: string }> {
  const res = await api.delete(`/command-center/students/${encodeURIComponent(regNo)}`);
  return res.data;
}

export async function getCommandCenterDepartments(): Promise<DepartmentRecord[]> {
  const res = await api.get<DepartmentRecord[]>('/command-center/departments');
  return res.data;
}

export async function getYearMatrix() {
  const res = await api.get('/command-center/year-matrix');
  return res.data;
}

export async function getDepartmentIntelligenceDetails(deptId: number): Promise<DepartmentIntelligenceDetails> {
  const res = await api.get(`/command-center/department/${deptId}/details`);
  return res.data;
}

export async function askCommandCenterAI(query: string): Promise<any> {
  const res = await api.post('/command-center/ai-query', { query });
  return res.data;
}
