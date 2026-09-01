export interface StudentEntity {
  id: string | number;
  reg_no: string;
  name: string;
  leetcode_url?: string;
  username?: string;
  department_id?: number;
  department?: { id?: number; name: string; code: string };
  year_level: string;
  section?: { name: string };
  stats?: {
    total_solved: number | null;
    easy_solved?: number | null;
    medium_solved?: number | null;
    hard_solved?: number | null;
    contest_rating?: number | null;
    contest_global_ranking?: number | null;
    public_profile_ranking?: number | null;
    recent_contest_name?: string;
    recent_contest_score?: string;
    status?: string;
    sync_status?: string;
    last_verified_at?: string | null;
  };
  college_rank?: number;
  dept_rank?: number;
  year_rank?: number;
  section_rank?: number;
  version?: number;
  sync_state?: string;
  status?: string;
  contest_status?: string;
  public_contest_result?: {
    contest_name?: string;
    contest_number?: number;
    contest_date?: string;
    questions_solved?: number;
    questions_total?: number;
    score_display?: string;
    contest_rank?: number | null;
    contest_rating?: number | null;
    top_percentage?: number | null;
    status?: string;
    fetched_at?: string | null;
  };
  virtual_contest_result?: {
    contest_name?: string;
    contest_number?: number;
    contest_date?: string;
    questions_solved?: number;
    questions_total?: number;
    score_display?: string;
    contest_rank?: number | null;
    contest_rating?: number | null;
    top_percentage?: number | null;
    status?: string;
    fetched_at?: string | null;
  };
}

export interface NormalizedStudentState {
  byId: Record<string, StudentEntity>;
  allIds: string[];
}
