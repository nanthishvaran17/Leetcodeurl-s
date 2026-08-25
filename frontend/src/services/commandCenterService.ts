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
  assigned_count: number;
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
  include_inactive?: boolean;
}): Promise<StudentListResponse> {
  const res = await api.get<StudentListResponse>('/command-center/students', { params });
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

export async function askCommandCenterAI(query: string): Promise<any> {
  const res = await api.post('/command-center/ai-query', { query });
  return res.data;
}
