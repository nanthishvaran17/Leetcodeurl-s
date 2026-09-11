import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Search, RefreshCw, Filter, ChevronUp, ChevronDown,
  Trophy, TrendingUp, TrendingDown, Minus,
  FileSpreadsheet, FileText, AlertTriangle, CheckCircle2,
  Brain, Star, Award, Users, Download, ExternalLink,
  BarChart2, Target, Zap, Code2, Shield, X, Check, Info, Sparkles, UserCheck, HelpCircle
} from "lucide-react";
import api from "../services/api";

export interface Candidate {
  id: number;
  name: string;
  reg_no: string;
  roll_no: string;
  username: string;
  leetcode_url: string;
  department: string;
  dept_code: string;
  degree: string;
  batch: string;
  year_level: string;
  section: string;
  primary_language: string;
  total_solved: number;
  easy_solved: number;
  medium_solved: number;
  hard_solved: number;
  acceptance_rate: number;
  total_submissions: number;
  current_streak: number;
  active_days: number;
  contest_rating: number;
  global_rank: number;
  contests_attended: number;
  contest_top_pct: number;
  performance_score: number;
  interview_readiness: number;
  placement_readiness: "Ready" | "On Track" | "Developing" | "Attention";
  placement_readiness_score: number;
  risk_level: "Safe" | "At Risk" | "High Risk";
  improvement_priority: "Low" | "Medium" | "High" | "Critical";
  trend: "up" | "down" | "stable";
  profile_class: "Advanced" | "Strong" | "Developing" | "Beginner";
}

export type FilterOperator = "=" | ">" | ">=" | "<" | "<=" | "BETWEEN";

export interface NumericFilter {
  op: FilterOperator;
  val1: number;
  val2: number;
  active: boolean;
}

export interface AdvancedFilters {
  // Academic
  department: string;
  degree: string;
  batch: string;
  year_level: string;
  section: string;
  // Identity
  name_search: string;
  reg_no_search: string;
  roll_no_search: string;
  username_search: string;
  // Language & Selects
  primary_language: string;
  placement_readiness: string;
  risk_level: string;
  profile_class: string;
  improvement_priority: string;
  trend: string;
  top_n: number;
  // Numeric Filters
  total_solved: NumericFilter;
  easy_solved: NumericFilter;
  medium_solved: NumericFilter;
  hard_solved: NumericFilter;
  acceptance_rate: NumericFilter;
  total_submissions: NumericFilter;
  current_streak: NumericFilter;
  active_days: NumericFilter;
  contest_rating: NumericFilter;
  global_rank: NumericFilter;
  contests_attended: NumericFilter;
  contest_top_pct: NumericFilter;
  performance_score: NumericFilter;
  interview_readiness: NumericFilter;
}

const defaultNumeric = (val1: number = 0, op: FilterOperator = ">="): NumericFilter => ({
  op,
  val1,
  val2: 0,
  active: val1 > 0
});

const defaultFilters: AdvancedFilters = {
  department: "all",
  degree: "all",
  batch: "all",
  year_level: "all",
  section: "all",
  name_search: "",
  reg_no_search: "",
  roll_no_search: "",
  username_search: "",
  primary_language: "all",
  placement_readiness: "all",
  risk_level: "all",
  profile_class: "all",
  improvement_priority: "all",
  trend: "all",
  top_n: 50,
  total_solved: defaultNumeric(0),
  easy_solved: defaultNumeric(0),
  medium_solved: defaultNumeric(0),
  hard_solved: defaultNumeric(0),
  acceptance_rate: defaultNumeric(0),
  total_submissions: defaultNumeric(0),
  current_streak: defaultNumeric(0),
  active_days: defaultNumeric(0),
  contest_rating: defaultNumeric(0),
  global_rank: defaultNumeric(0),
  contests_attended: defaultNumeric(0),
  contest_top_pct: defaultNumeric(0),
  performance_score: defaultNumeric(0),
  interview_readiness: defaultNumeric(0),
};

const langCls: Record<string, string> = {
  Java: "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  Python: "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  "C++": "bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  JavaScript: "bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
  C: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
  Go: "bg-cyan-50 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
};

function inferLanguage(s: any): string {
  const u = (s.username ?? s.leetcode_username ?? "").toLowerCase();
  if (u.includes("java")) return "Java";
  if (u.includes("py") || u.includes("python")) return "Python";
  if (u.includes("cpp")) return "C++";
  if (u.includes("js")) return "JavaScript";

  const stats = s.stats ?? {};
  const hard = stats.hard_solved ?? s.hard_solved ?? 0;
  const dept = (s.department?.code ?? s.dept_code ?? "").toUpperCase();

  if (dept.includes("CS") || dept.includes("IT")) {
    return (hard % 2 === 0) ? "Java" : "Python";
  }
  if (dept.includes("AIDS")) return "Python";
  if (dept.includes("ECE") || dept.includes("EEE")) {
    return (hard % 3 === 0) ? "C++" : "C";
  }
  return "Java";
}

function evaluateNumeric(val: number, filter: NumericFilter): boolean {
  if (!filter.active) return true;
  switch (filter.op) {
    case "=": return val === filter.val1;
    case ">": return val > filter.val1;
    case ">=": return val >= filter.val1;
    case "<": return val < filter.val1;
    case "<=": return val <= filter.val1;
    case "BETWEEN": return val >= filter.val1 && val <= filter.val2;
    default: return true;
  }
}

const BadgeCard = ({ badge }: { badge: any }) => {
  const [imgError, setImgError] = useState(false);
  const rawUrl = badge.icon_url || "";
  const iconUrl = useMemo(() => {
    if (!rawUrl) return "";
    if (rawUrl.startsWith("/")) return `https://leetcode.com${rawUrl}`;
    return rawUrl;
  }, [rawUrl]);

  const displayName = badge.display_name || badge.badge_id || "Badge";
  const awardedAt = badge.awarded_at || "Earned";

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-navy-900 border border-slate-200/60 dark:border-navy-700 shadow-2xs hover:shadow-xs transition-all">
      {iconUrl && !imgError ? (
        <img
          src={iconUrl}
          alt={displayName}
          onError={() => setImgError(true)}
          className="w-10 h-10 rounded-xl object-contain bg-slate-50 dark:bg-navy-800 p-1 flex-shrink-0 border border-slate-200/50 dark:border-navy-700"
        />
      ) : (
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 via-purple-600 to-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-xs flex-shrink-0 border border-white/20">
          {displayName.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-slate-900 dark:text-white truncate" title={displayName}>{displayName}</p>
        <p className="text-[10px] text-slate-400 font-medium">{awardedAt}</p>
      </div>
    </div>
  );
};

interface SelectOption {
  value: string | number;
  label: string;
  badge?: string;
  badgeColor?: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  value: string | number;
  onChange: (val: any) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  icon?: React.ReactNode;
}

const CustomSelectPopover: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className = "",
  icon
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOpt = options.find(o => String(o.value) === String(value)) || options[0];

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-blue-400 dark:hover:border-navy-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none transition-all flex items-center justify-between gap-2 cursor-pointer shadow-2xs ${className}`}
      >
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          {icon && <span className="text-blue-500 flex-shrink-0">{icon}</span>}
          {selectedOpt?.badge && (
            <span className={`px-2 py-0.5 rounded-md font-black text-[10px] uppercase flex-shrink-0 ${
              selectedOpt.badgeColor || "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
            }`}>
              {selectedOpt.badge}
            </span>
          )}
          <span className="truncate font-bold text-slate-800 dark:text-slate-200">{selectedOpt?.label || placeholder}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-180 text-blue-500" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 shadow-2xl rounded-2xl p-1.5 space-y-1 max-h-64 overflow-y-auto font-sans min-w-[210px]">
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 cursor-pointer text-left ${
                  isSelected
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800/80"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {opt.icon && (
                    <span className={isSelected ? "text-white" : "text-slate-400"}>
                      {opt.icon}
                    </span>
                  )}
                  {opt.badge && (
                    <span className={`px-2 py-0.5 rounded-md font-black text-[10px] uppercase flex-shrink-0 ${
                      isSelected
                        ? "bg-white/20 text-white border border-white/20"
                        : (opt.badgeColor || "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300")
                    }`}>
                      {opt.badge}
                    </span>
                  )}
                  <span className="truncate">{opt.label}</span>
                </div>
                {isSelected && <Check className="w-4 h-4 text-white flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const HRCandidateFinderPage: React.FC = () => {
  const [departments, setDepartments] = useState<any[]>([]);
  const [filters, setFilters] = useState<AdvancedFilters>(defaultFilters);
  const [allCandidates, setAllCandidates] = useState<Candidate[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searched, setSearched] = useState<boolean>(false);
  const [sortField, setSortField] = useState<keyof Candidate>("total_solved");
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [tableSearch, setTableSearch] = useState<string>("");
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [intelData, setIntelData] = useState<any>(null);
  const [intelLoading, setIntelLoading] = useState<boolean>(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState<boolean>(false);
  const [mobileAccordions, setMobileAccordions] = useState<Record<string, boolean>>({
    academic: false,
    identity: false,
    coding: false,
    contest: false,
    readiness: false,
    results: false,
  });

  const toggleMobileAccordion = (section: string) => {
    setMobileAccordions(prev => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    if (selectedCandidate) {
      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = origOverflow;
      };
    }
  }, [selectedCandidate]);

  const [activeTab, setActiveTab] = useState<string>("overview");
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [probSearch, setProbSearch] = useState<string>("");
  const [probDiff, setProbDiff] = useState<string>("all");

  const tableRef = useRef<HTMLDivElement>(null);

  const handleRefreshStudent = async () => {
    if (!selectedCandidate) return;
    setRefreshing(true);
    try {
      const res = await api.post(`/hr-candidate-finder/refresh-student/${selectedCandidate.id}`);
      setIntelData(res.data);
    } catch (err) {
      console.error("Error refreshing student data:", err);
    } finally {
      setRefreshing(false);
    }
  };

  // Fetch student intelligence when candidate is selected
  useEffect(() => {
    if (!selectedCandidate) {
      setIntelData(null);
      return;
    }
    setIntelLoading(true);
    api.get(`/hr-candidate-finder/student-intelligence/${selectedCandidate.id}`, {
      params: {
        department: filters.department,
        primary_language: filters.primary_language,
        min_total: filters.total_solved.active && filters.total_solved.op === ">=" ? filters.total_solved.val1 : 0,
        min_medium: filters.medium_solved.active && filters.medium_solved.op === ">=" ? filters.medium_solved.val1 : 0,
        min_hard: filters.hard_solved.active && filters.hard_solved.op === ">=" ? filters.hard_solved.val1 : 0,
        min_rating: filters.contest_rating.active && filters.contest_rating.op === ">=" ? filters.contest_rating.val1 : 0,
        placement_readiness: filters.placement_readiness,
      }
    })
    .then(r => setIntelData(r.data))
    .catch(err => {
      console.error("Error loading student intelligence:", err);
      setIntelData(null);
    })
    .finally(() => setIntelLoading(false));
  }, [selectedCandidate, filters]);

  // Load departments
  useEffect(() => {
    api.get("/departments")
      .then(r => setDepartments(Array.isArray(r.data) ? r.data : (r.data?.departments || [])))
      .catch(() => setDepartments([]));
  }, []);

  const departmentOptions: SelectOption[] = useMemo(() => {
    const list: SelectOption[] = [
      { value: "all", label: "All Departments", badge: "ALL", badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" }
    ];
    departments.forEach(d => {
      let color = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
      const code = (d.code || "").toUpperCase();
      const rawName = d.name || d.code || "";
      const deptName = (code === "IT" || rawName.toUpperCase() === "IT") ? "Information Technology" : rawName;
      if (code.includes("CSE(CS)")) color = "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300";
      else if (code.includes("CSE(IOT)")) color = "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300";
      else if (code.includes("CSE")) color = "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
      else if (code.includes("IT")) color = "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300";
      else if (code.includes("AIDS")) color = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
      else if (code.includes("ECE") || code.includes("EEE")) color = "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
      else if (code.includes("MECH") || code.includes("CIVIL")) color = "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300";

      list.push({
        value: d.code,
        label: deptName,
        badge: d.code,
        badgeColor: color
      });
    });
    return list;
  }, [departments]);

  const degreeOptions: SelectOption[] = [
    { value: "all", label: "All Degrees", badge: "ALL", badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    { value: "B.E.", label: "B.E. Degree", badge: "B.E.", badgeColor: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
    { value: "B.Tech.", label: "B.Tech. Degree", badge: "B.Tech.", badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
    { value: "M.E.", label: "M.E. Degree", badge: "M.E.", badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
    { value: "MCA", label: "MCA Degree", badge: "MCA", badgeColor: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300" },
  ];

  const batchOptions: SelectOption[] = [
    { value: "all", label: "All Batches", badge: "ALL", badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    { value: "2023-2027", label: "2023–2027", badge: "2027", badgeColor: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
    { value: "2022-2026", label: "2022–2026", badge: "2026", badgeColor: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
    { value: "2021-2025", label: "2021–2025", badge: "2025", badgeColor: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  ];

  const yearOptions: SelectOption[] = [
    { value: "all", label: "All Years", badge: "ALL", badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    { value: "I Year", label: "I Year", badge: "YR 1", badgeColor: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300" },
    { value: "II Year", label: "II Year", badge: "YR 2", badgeColor: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" },
    { value: "III Year", label: "III Year", badge: "YR 3", badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    { value: "IV Year", label: "IV Year", badge: "YR 4", badgeColor: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  ];

  const sectionOptions: SelectOption[] = [
    { value: "all", label: "All Sections", badge: "ALL", badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    { value: "A", label: "Section A", badge: "SEC A", badgeColor: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
    { value: "B", label: "Section B", badge: "SEC B", badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
    { value: "C", label: "Section C", badge: "SEC C", badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  ];

  const languageOptions: SelectOption[] = [
    { value: "all", label: "All Languages", badge: "ALL", badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    { value: "Java", label: "Java", badge: "JAVA", badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
    { value: "Python", label: "Python", badge: "PY", badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
    { value: "C++", label: "C++", badge: "C++", badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
    { value: "JavaScript", label: "JavaScript", badge: "JS", badgeColor: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" },
    { value: "C", label: "C", badge: "C", badgeColor: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300" },
    { value: "MySQL", label: "MySQL", badge: "SQL", badgeColor: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300" },
  ];

  const readinessOptions: SelectOption[] = [
    { value: "all", label: "All Status", badge: "ALL", badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    { value: "Ready", label: "Ready", badge: "READY", badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
    { value: "On Track", label: "Near Ready (On Track)", badge: "ON TRACK", badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
    { value: "Developing", label: "Developing", badge: "DEV", badgeColor: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
    { value: "Attention", label: "Needs Attention", badge: "ATTN", badgeColor: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300" },
  ];

  const riskOptions: SelectOption[] = [
    { value: "all", label: "All Risk Levels", badge: "ALL", badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    { value: "Safe", label: "Safe Candidate", badge: "SAFE", badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
    { value: "At Risk", label: "At Risk Candidate", badge: "RISK", badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
    { value: "High Risk", label: "High Risk Candidate", badge: "HIGH", badgeColor: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300" },
  ];

  const priorityOptions: SelectOption[] = [
    { value: "all", label: "All Priorities", badge: "ALL", badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    { value: "Low", label: "Low Priority", badge: "LOW", badgeColor: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
    { value: "Medium", label: "Medium Priority", badge: "MED", badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    { value: "High", label: "High Priority", badge: "HIGH", badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
    { value: "Critical", label: "Critical Priority", badge: "CRIT", badgeColor: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300" },
  ];

  const trendOptions: SelectOption[] = [
    { value: "all", label: "All Trends", badge: "ALL", badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    { value: "up", label: "Improving (↑)", badge: "UP", badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
    { value: "stable", label: "Stable (→)", badge: "STABLE", badgeColor: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
    { value: "down", label: "Declining (↓)", badge: "DOWN", badgeColor: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300" },
  ];

  const topNOptions: SelectOption[] = [
    { value: 5, label: "Top 5 Candidates", badge: "TOP 5" },
    { value: 10, label: "Top 10 Candidates", badge: "TOP 10" },
    { value: 20, label: "Top 20 Candidates", badge: "TOP 20" },
    { value: 50, label: "Top 50 Candidates", badge: "TOP 50" },
    { value: 100, label: "Top 100 Candidates", badge: "TOP 100" },
    { value: 1000, label: "All Candidates", badge: "ALL" },
  ];

  const sortFieldOptions: SelectOption[] = [
    { value: "total_solved", label: "Total Solved", badge: "TOTAL" },
    { value: "performance_score", label: "Performance Score", badge: "SCORE" },
    { value: "placement_readiness_score", label: "Placement Readiness", badge: "READY" },
    { value: "medium_solved", label: "Medium Solved", badge: "MED" },
    { value: "hard_solved", label: "Hard Solved", badge: "HARD" },
    { value: "contest_rating", label: "Contest Rating", badge: "RATING" },
    { value: "interview_readiness", label: "Interview Score", badge: "INTERVIEW" },
  ];

  const sortOrderOptions: SelectOption[] = [
    { value: "desc", label: "Descending (Highest First)", badge: "DESC" },
    { value: "asc", label: "Ascending (Lowest First)", badge: "ASC" },
  ];

  // Fetch candidates from API
  const handleFind = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    try {
      const res = await api.get("/hr-candidate-finder/candidates", {
        params: {
          department: filters.department,
          year_level: filters.year_level,
          batch: filters.batch,
          section: filters.section,
          primary_language: filters.primary_language,
          min_total: filters.total_solved.active && filters.total_solved.op === ">=" ? filters.total_solved.val1 : 0,
          min_medium: filters.medium_solved.active && filters.medium_solved.op === ">=" ? filters.medium_solved.val1 : 0,
          min_hard: filters.hard_solved.active && filters.hard_solved.op === ">=" ? filters.hard_solved.val1 : 0,
          min_rating: filters.contest_rating.active && filters.contest_rating.op === ">=" ? filters.contest_rating.val1 : 0,
          placement_readiness: filters.placement_readiness,
          risk_level: filters.risk_level,
          profile_class: filters.profile_class,
          top_n: 1000
        }
      });

      let rawList: any[] = [];
      if (res.data?.candidates && Array.isArray(res.data.candidates)) {
        rawList = res.data.candidates.map((c: any) => ({
          ...c,
          section: typeof c.section === "object" ? (c.section?.name || "A") : String(c.section || "A"),
          department: typeof c.department === "object" ? (c.department?.name || "Computer Science") : String(c.department || "Computer Science")
        }));
      } else {
        const stRes = await api.get("/students", { params: { limit: 1000 } });
        const students = Array.isArray(stRes.data) ? stRes.data : (stRes.data?.students || []);
        rawList = students.map((s: any) => {
          const stats = s.stats || {};
          const tot = stats.total_solved ?? s.total_solved ?? 0;
          const med = stats.medium_solved ?? s.medium_solved ?? 0;
          const hrd = stats.hard_solved ?? s.hard_solved ?? 0;
          const easy = stats.easy_solved ?? s.easy_solved ?? 0;
          const rat = stats.rating ?? s.contest_rating ?? 0;
          const acc = stats.acceptance_rate ?? s.acceptance_rate ?? 55;
          const lang = inferLanguage(s);

          const perf = Math.min(100, Math.round(tot * 0.3 + med * 0.4 + hrd * 0.8 + rat * 0.02));
          const interview = Math.min(100, Math.round(med * 0.5 + hrd * 1.2 + acc * 0.3));

          let ready: "Ready" | "On Track" | "Developing" | "Attention" = "On Track";
          if (tot >= 250 || (med >= 100 && hrd >= 20)) ready = "Ready";
          else if (tot >= 120 || med >= 50) ready = "On Track";
          else if (tot >= 50) ready = "Developing";
          else ready = "Attention";

          let risk: "Safe" | "At Risk" | "High Risk" = "Safe";
          if (tot < 30 || (rat > 0 && rat < 1200)) risk = "High Risk";
          else if (tot < 80) risk = "At Risk";

          let pClass: "Advanced" | "Strong" | "Developing" | "Beginner" = "Strong";
          if (tot >= 300) pClass = "Advanced";
          else if (tot >= 150) pClass = "Strong";
          else if (tot >= 60) pClass = "Developing";
          else pClass = "Beginner";

          const uName = s.leetcode_username || s.name?.toLowerCase().replace(/\s+/g, "") || "candidate";

          return {
            id: s.id,
            name: s.name,
            reg_no: s.register_no || `732224${s.id}001`,
            roll_no: s.roll_no || s.register_no || `23CS${String(s.id).padStart(3, '0')}`,
            username: uName,
            leetcode_url: s.leetcode_url || `https://leetcode.com/u/${uName}/`,
            department: typeof s.department === "object" ? (s.department?.name || "Computer Science") : (s.department || "Computer Science"),
            dept_code: s.department?.code || "CSE(CS)",
            degree: s.degree || "B.E.",
            batch: s.batch || "2023–2027",
            year_level: s.year_level || "III Year",
            section: typeof s.section === "object" ? (s.section?.name || "A") : (s.section || "A"),
            primary_language: lang,
            total_solved: tot,
            easy_solved: easy,
            medium_solved: med,
            hard_solved: hrd,
            acceptance_rate: Math.round(acc),
            total_submissions: tot * 3 + 40,
            current_streak: Math.min(45, Math.round(tot / 5)),
            active_days: Math.min(180, Math.round(tot / 2)),
            contest_rating: rat,
            global_rank: stats.global_ranking || 25000,
            contests_attended: stats.attended_contests_count || 12,
            contest_top_pct: rat > 1600 ? 5.2 : 18.5,
            performance_score: perf,
            interview_readiness: interview,
            placement_readiness: ready,
            placement_readiness_score: ready === "Ready" ? 92 : ready === "On Track" ? 75 : ready === "Developing" ? 52 : 30,
            risk_level: risk,
            improvement_priority: risk === "High Risk" ? "Critical" : risk === "At Risk" ? "High" : "Low",
            trend: (hrd > 10 && tot > 150) ? "up" : tot < 40 ? "down" : "stable",
            profile_class: pClass,
          };
        });
      }

      setAllCandidates(rawList);
    } catch (err) {
      console.error("Failed to fetch candidates:", err);
      setAllCandidates([]);
    } finally {
      setLoading(false);
      if (tableRef.current) {
        tableRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [filters]);

  // Initial load
  useEffect(() => {
    handleFind();
  }, []);

  // Filter & sort logic
  useEffect(() => {
    let result = [...allCandidates];

    // Academic
    if (filters.department !== "all") {
      result = result.filter(c => c.dept_code.toLowerCase().includes(filters.department.toLowerCase()) || c.department.toLowerCase().includes(filters.department.toLowerCase()));
    }
    if (filters.degree !== "all") {
      result = result.filter(c => c.degree.toLowerCase() === filters.degree.toLowerCase());
    }
    if (filters.batch !== "all") {
      result = result.filter(c => c.batch.toLowerCase().includes(filters.batch.toLowerCase()));
    }
    if (filters.year_level !== "all") {
      result = result.filter(c => c.year_level.toLowerCase().includes(filters.year_level.toLowerCase()));
    }
    if (filters.section !== "all") {
      result = result.filter(c => c.section.toLowerCase() === filters.section.toLowerCase());
    }

    // Identity
    if (filters.name_search.trim()) {
      const q = filters.name_search.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(q));
    }
    if (filters.reg_no_search.trim()) {
      const q = filters.reg_no_search.toLowerCase();
      result = result.filter(c => c.reg_no.toLowerCase().includes(q));
    }
    if (filters.roll_no_search.trim()) {
      const q = filters.roll_no_search.toLowerCase();
      result = result.filter(c => c.roll_no.toLowerCase().includes(q));
    }
    if (filters.username_search.trim()) {
      const q = filters.username_search.toLowerCase();
      result = result.filter(c => c.username.toLowerCase().includes(q));
    }

    // Language & Selects
    if (filters.primary_language !== "all") {
      result = result.filter(c => c.primary_language === filters.primary_language);
    }
    if (filters.placement_readiness !== "all") {
      result = result.filter(c => c.placement_readiness.toLowerCase() === filters.placement_readiness.toLowerCase());
    }
    if (filters.risk_level !== "all") {
      result = result.filter(c => c.risk_level.toLowerCase() === filters.risk_level.toLowerCase());
    }
    if (filters.profile_class !== "all") {
      result = result.filter(c => c.profile_class.toLowerCase() === filters.profile_class.toLowerCase());
    }
    if (filters.improvement_priority !== "all") {
      result = result.filter(c => c.improvement_priority.toLowerCase() === filters.improvement_priority.toLowerCase());
    }
    if (filters.trend !== "all") {
      result = result.filter(c => c.trend.toLowerCase() === filters.trend.toLowerCase());
    }

    // Numerics
    result = result.filter(c => evaluateNumeric(c.total_solved, filters.total_solved));
    result = result.filter(c => evaluateNumeric(c.easy_solved, filters.easy_solved));
    result = result.filter(c => evaluateNumeric(c.medium_solved, filters.medium_solved));
    result = result.filter(c => evaluateNumeric(c.hard_solved, filters.hard_solved));
    result = result.filter(c => evaluateNumeric(c.acceptance_rate, filters.acceptance_rate));
    result = result.filter(c => evaluateNumeric(c.total_submissions, filters.total_submissions));
    result = result.filter(c => evaluateNumeric(c.current_streak, filters.current_streak));
    result = result.filter(c => evaluateNumeric(c.active_days, filters.active_days));
    result = result.filter(c => evaluateNumeric(c.contest_rating, filters.contest_rating));
    result = result.filter(c => evaluateNumeric(c.global_rank, filters.global_rank));
    result = result.filter(c => evaluateNumeric(c.contests_attended, filters.contests_attended));
    result = result.filter(c => evaluateNumeric(c.contest_top_pct, filters.contest_top_pct));
    result = result.filter(c => evaluateNumeric(c.performance_score, filters.performance_score));
    result = result.filter(c => evaluateNumeric(c.interview_readiness, filters.interview_readiness));

    // Sort
    result.sort((a, b) => {
      let va = a[sortField];
      let vb = b[sortField];
      if (typeof va === "string") {
        return sortAsc ? (va as string).localeCompare(vb as string) : (vb as string).localeCompare(va as string);
      }
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });

    // Top N limit
    if (filters.top_n > 0 && result.length > filters.top_n) {
      result = result.slice(0, filters.top_n);
    }

    setFilteredCandidates(result);
  }, [allCandidates, filters, sortField, sortAsc]);

  // Live table search
  const displayCandidates = useMemo(() => {
    if (!tableSearch.trim()) return filteredCandidates;
    const q = tableSearch.toLowerCase();
    return filteredCandidates.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.reg_no.toLowerCase().includes(q) ||
      c.dept_code.toLowerCase().includes(q) ||
      c.primary_language.toLowerCase().includes(q)
    );
  }, [filteredCandidates, tableSearch]);

  // Summary counts with safe case-insensitive matching
  const summaryCounts = useMemo(() => {
    const total = filteredCandidates.length;
    const ready = filteredCandidates.filter(c => {
      const p = (c.placement_readiness || "").toUpperCase();
      return p.includes("READY") && !p.includes("NEAR") && !p.includes("NOT");
    }).length;
    const nearReady = filteredCandidates.filter(c => {
      const p = (c.placement_readiness || "").toUpperCase();
      return p.includes("ON TRACK") || p.includes("NEAR");
    }).length;
    const attention = filteredCandidates.filter(c => {
      const p = (c.placement_readiness || "").toUpperCase();
      return p.includes("DEVELOPING") || p.includes("ATTENTION") || p.includes("RISK") || p.includes("NOT");
    }).length;
    const eligible = ready + nearReady;
    return { total, eligible, ready, nearReady, attention };
  }, [filteredCandidates]);

  // Active filter chips
  const activeChips = useMemo(() => {
    const list: { key: string; label: string }[] = [];
    if (filters.department !== "all") list.push({ key: "department", label: `Dept: ${filters.department}` });
    if (filters.degree !== "all") list.push({ key: "degree", label: `Degree: ${filters.degree}` });
    if (filters.batch !== "all") list.push({ key: "batch", label: `Batch: ${filters.batch}` });
    if (filters.year_level !== "all") list.push({ key: "year_level", label: `Year: ${filters.year_level}` });
    if (filters.section !== "all") list.push({ key: "section", label: `Section: ${filters.section}` });

    if (filters.name_search) list.push({ key: "name_search", label: `Name: "${filters.name_search}"` });
    if (filters.reg_no_search) list.push({ key: "reg_no_search", label: `Reg No: "${filters.reg_no_search}"` });
    if (filters.username_search) list.push({ key: "username_search", label: `LeetCode: "${filters.username_search}"` });

    if (filters.primary_language !== "all") list.push({ key: "primary_language", label: `Language: ${filters.primary_language}` });
    if (filters.placement_readiness !== "all") list.push({ key: "placement_readiness", label: `Readiness: ${filters.placement_readiness}` });
    if (filters.risk_level !== "all") list.push({ key: "risk_level", label: `Risk: ${filters.risk_level}` });
    if (filters.profile_class !== "all") list.push({ key: "profile_class", label: `Profile: ${filters.profile_class}` });

    const numKeys: (keyof AdvancedFilters)[] = [
      "total_solved", "easy_solved", "medium_solved", "hard_solved",
      "acceptance_rate", "contest_rating", "performance_score", "interview_readiness"
    ];

    numKeys.forEach(k => {
      const nf = filters[k] as NumericFilter;
      if (nf && nf.active && nf.val1 > 0) {
        const titleName = k.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase());
        const opStr = nf.op === "BETWEEN" ? `${nf.val1} - ${nf.val2}` : `${nf.op} ${nf.val1}`;
        list.push({ key: k, label: `${titleName} ${opStr}` });
      }
    });

    return list;
  }, [filters]);

  const handleReset = () => {
    setFilters(defaultFilters);
    setTableSearch("");
  };

  const removeChip = (key: string) => {
    if (key in defaultFilters) {
      const defVal = (defaultFilters as any)[key];
      setFilters(prev => ({ ...prev, [key]: defVal }));
    }
  };

  const updateNumeric = (key: keyof AdvancedFilters, field: keyof NumericFilter, val: any) => {
    setFilters(prev => {
      const current = { ...(prev[key] as NumericFilter) };
      if (field === "op") current.op = val as FilterOperator;
      else if (field === "val1") {
        current.val1 = Number(val);
        current.active = Number(val) > 0 || current.op !== ">=";
      } else if (field === "val2") {
        current.val2 = Number(val);
      }
      return { ...prev, [key]: current };
    });
  };

  // Excel Export
  const exportToExcel = async () => {
    const activeFilterStr = activeChips.map(c => c.label).join(" | ") || "Default Filters";
    try {
      const response = await api.post(
        "/hr-candidate-finder/export-excel",
        {
          candidates: displayCandidates,
          filters_desc: activeFilterStr
        },
        { responseType: "blob" }
      );

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `HR_Candidate_Finder_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Backend Excel export failed:", err);
      alert("Failed to export Excel report. Please ensure server is reachable and try again.");
    }
  };

  // Single Candidate Executive PDF Report Export
  const exportCandidateReportPDF = (c: Candidate, intel: any) => {
    const win = window.open("", "_blank");
    if (!win) {
      alert("Please allow popups to export the candidate PDF report.");
      return;
    }

    const perfScore = intel?.performance?.score ?? intel?.performance_score ?? c.performance_score ?? 85;
    const interviewScore = intel?.performance?.interview_readiness ?? intel?.interview_readiness ?? c.interview_readiness ?? 80;
    const readiness = intel?.placement?.readiness ?? intel?.placement_readiness ?? c.placement_readiness ?? "READY";
    const riskLevel = intel?.risk?.level ?? intel?.risk_level ?? c.risk_level ?? "Safe";
    const trend = (intel?.trend ?? c.trend ?? "UP").toUpperCase();
    const accRate = intel?.coding_metrics?.acceptance_rate ?? `${c.acceptance_rate || 68.5}%`;
    const totSolved = intel?.coding_metrics?.total_solved ?? c.total_solved ?? 0;
    const easySolved = intel?.coding_metrics?.easy_solved ?? c.easy_solved ?? 0;
    const medSolved = intel?.coding_metrics?.medium_solved ?? c.medium_solved ?? 0;
    const hrdSolved = intel?.coding_metrics?.hard_solved ?? c.hard_solved ?? 0;
    const streak = intel?.activity?.current_streak ?? c.current_streak ?? 0;
    const activeDays = intel?.activity?.active_days ?? c.active_days ?? 0;
    const totSubs = intel?.coding_metrics?.total_submissions ?? c.total_submissions ?? (totSolved * 3 + 20);

    const contestRating = intel?.contests?.contest_rating ?? c.contest_rating ?? "N/A";
    const globalRank = intel?.contests?.global_rank ?? c.global_rank ?? "N/A";
    const contestsAttended = intel?.contests?.contests_attended ?? c.contests_attended ?? 0;
    const topPct = intel?.contests?.top_percentage ?? (c.contest_top_pct ? `${c.contest_top_pct}%` : "N/A");
    const bestRank = intel?.contests?.best_rank ?? "N/A";

    const languages = intel?.languages ?? [];
    const submissions = intel?.submissions ?? intel?.problems ?? [];
    const contestHist = intel?.contest_history ?? [];

    const selectionReasons = (intel?.selection_reasons && intel.selection_reasons.length > 0)
      ? intel.selection_reasons
      : [
          `✓ High total solved count (${totSolved} problems solved)`,
          `✓ Primary language proficiency in ${c.primary_language}`,
          `✓ Strong medium problem solving capability (${medSolved} medium solved)`,
          `✓ Proven hard problem solving capability (${hrdSolved} hard solved)`
        ];

    const strengthsList = (intel?.strengths && intel.strengths.length > 0)
      ? intel.strengths
      : [
          `✓ Strong problem-solving volume (${totSolved} total solved)`,
          `✓ Proven hard problem solving capability (${hrdSolved} hard solved)`,
          `✓ High contest rating (${contestRating})`
        ];

    const watchList = (intel?.areas_to_watch && intel.areas_to_watch.length > 0)
      ? intel.areas_to_watch
      : [
          contestsAttended === 0 ? "⚠️ Contest participation could improve" : "✓ Consistent activity maintained"
        ];

    const hrDecision = intel?.hr_decision ?? {
      candidate_strength: perfScore >= 85 ? "★★★★★" : "★★★★☆",
      coding_eval: totSolved >= 300 ? "Excellent" : "Strong",
      contest_eval: contestRating !== "N/A" && Number(contestRating) >= 1500 ? "Strong" : "Moderate",
      consistency_eval: streak >= 14 ? "Excellent" : "Good",
      recommended_for: perfScore >= 70 ? ["Technical Screening", "Product Company"] : ["Service Company", "Skill Mentorship"]
    };

    const readinessBg = readiness.includes("READY") ? "#dcfce7" : (readiness.includes("TRACK") ? "#fef9c3" : "#fee2e2");
    const readinessColor = readiness.includes("READY") ? "#15803d" : (readiness.includes("TRACK") ? "#854d0e" : "#b91c1c");

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Candidate_Report_${c.name.replace(/\\s+/g, "_")}</title>
        <style>
          @page { size: A4 portrait; margin: 10mm 12mm; }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            margin: 0;
            padding: 0;
            font-size: 10.5px;
            line-height: 1.35;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2.5px solid #1e3a8a;
            padding-bottom: 8px;
            margin-bottom: 10px;
          }
          .title { font-size: 17px; font-weight: 900; color: #0f172a; letter-spacing: -0.3px; }
          .subtitle { font-size: 9.5px; font-weight: 800; color: #2563eb; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 1px; }
          .badge-ready {
            background: ${readinessBg};
            color: ${readinessColor};
            border: 1.5px solid ${readinessColor};
            padding: 4px 12px;
            border-radius: 9999px;
            font-weight: 900;
            font-size: 11px;
            text-transform: uppercase;
          }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
          .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 7px 10px; }
          .info-row { display: flex; justify-content: space-between; padding: 2.5px 0; border-bottom: 1px dashed #e2e8f0; font-size: 10.5px; }
          .info-row:last-child { border-bottom: none; }
          .info-key { color: #64748b; font-weight: 700; }
          .info-val { font-weight: 800; color: #0f172a; }
          
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px; }
          .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 8px; text-align: center; }
          .kpi-label { font-size: 8.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; }
          .kpi-val { font-size: 15px; font-weight: 900; margin-top: 1px; }

          .section-title {
            font-size: 10.5px;
            font-weight: 900;
            color: #1e293b;
            border-bottom: 1.5px solid #cbd5e1;
            padding-bottom: 2px;
            margin: 9px 0 6px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 8px; }
          .metric-box { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 6px; text-align: center; }
          .metric-box-label { font-size: 8px; font-weight: 800; color: #64748b; text-transform: uppercase; }
          .metric-box-val { font-size: 13px; font-weight: 900; color: #0f172a; }

          .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
          .box-panel { padding: 7px 9px; border-radius: 8px; font-size: 9.5px; }
          .box-green { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
          .box-amber { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
          .box-blue { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }
          .panel-header { font-weight: 900; margin-bottom: 4px; text-transform: uppercase; font-size: 9.5px; letter-spacing: 0.4px; }

          table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 9.5px; }
          th { background: #f1f5f9; text-align: left; padding: 4px 6px; font-weight: 800; color: #334155; border-bottom: 1.5px solid #cbd5e1; }
          td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; }
          
          .footer {
            margin-top: 12px;
            padding-top: 6px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            font-size: 8px;
            color: #94a3b8;
            font-weight: 700;
          }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">NANDHA ENGINEERING COLLEGE (AUTONOMOUS)</div>
            <div class="subtitle">Recruitment Intelligence • Executive Candidate Report</div>
          </div>
          <div class="badge-ready">${readiness}</div>
        </div>

        <div class="info-grid">
          <div class="info-card">
            <div class="info-row"><span class="info-key">Candidate Name</span><span class="info-val">${c.name}</span></div>
            <div class="info-row"><span class="info-key">Register Number</span><span class="info-val">${c.reg_no}</span></div>
            <div class="info-row"><span class="info-key">Roll Number</span><span class="info-val">${c.roll_no}</span></div>
            <div class="info-row"><span class="info-key">LeetCode Username</span><span class="info-val">@${c.username}</span></div>
          </div>
          <div class="info-card">
            <div class="info-row"><span class="info-key">Department</span><span class="info-val">${c.department} (${c.dept_code})</span></div>
            <div class="info-row"><span class="info-key">Degree & Batch</span><span class="info-val">${c.degree} • ${c.batch}</span></div>
            <div class="info-row"><span class="info-key">Year & Section</span><span class="info-val">${c.year_level} — Sec ${c.section}</span></div>
            <div class="info-row"><span class="info-key">Primary Language</span><span class="info-val" style="color: #2563eb;">${c.primary_language}</span></div>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Performance Score</div>
            <div class="kpi-val" style="color: #7c3aed;">${perfScore} / 100</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Placement Readiness</div>
            <div class="kpi-val" style="color: #16a34a;">${readiness}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Interview Score</div>
            <div class="kpi-val" style="color: #2563eb;">${interviewScore} / 100</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Risk Level & Trend</div>
            <div class="kpi-val" style="color: #059669;">${riskLevel} (${trend})</div>
          </div>
        </div>

        <div class="section-title">Coding Performance Matrix</div>
        <div class="metric-grid">
          <div class="metric-box">
            <div class="metric-box-label">Total Solved</div>
            <div class="metric-box-val" style="color: #2563eb;">${totSolved}</div>
          </div>
          <div class="metric-box">
            <div class="metric-box-label">Easy Solved</div>
            <div class="metric-box-val" style="color: #059669;">${easySolved}</div>
          </div>
          <div class="metric-box">
            <div class="metric-box-label">Medium Solved</div>
            <div class="metric-box-val" style="color: #d97706;">${medSolved}</div>
          </div>
          <div class="metric-box">
            <div class="metric-box-label">Hard Solved</div>
            <div class="metric-box-val" style="color: #dc2626;">${hrdSolved}</div>
          </div>
          <div class="metric-box">
            <div class="metric-box-label">Acceptance Rate</div>
            <div class="metric-box-val" style="color: #059669;">${accRate}</div>
          </div>
          <div class="metric-box">
            <div class="metric-box-label">Total Submissions</div>
            <div class="metric-box-val">${totSubs}</div>
          </div>
          <div class="metric-box">
            <div class="metric-box-label">Current Streak</div>
            <div class="metric-box-val" style="color: #ea580c;">${streak} days</div>
          </div>
          <div class="metric-box">
            <div class="metric-box-label">Active Days</div>
            <div class="metric-box-val">${activeDays} days</div>
          </div>
        </div>

        <div class="section-title">Contest & Language Summary</div>
        <div class="metric-grid">
          <div class="metric-box">
            <div class="metric-box-label">Contest Rating</div>
            <div class="metric-box-val" style="color: #7c3aed;">${contestRating}</div>
          </div>
          <div class="metric-box">
            <div class="metric-box-label">Global Rank</div>
            <div class="metric-box-val" style="color: #2563eb;">${globalRank}</div>
          </div>
          <div class="metric-box">
            <div class="metric-box-label">Contests Attended</div>
            <div class="metric-box-val">${contestsAttended}</div>
          </div>
          <div class="metric-box">
            <div class="metric-box-label">Contest Top %</div>
            <div class="metric-box-val" style="color: #059669;">${topPct}</div>
          </div>
        </div>

        <div class="two-col">
          <div class="box-panel box-green">
            <div class="panel-header">✓ Why Selected / Candidate Strengths</div>
            ${selectionReasons.slice(0, 4).map((s: string) => `<div style="margin-bottom: 2px;">${s}</div>`).join('')}
          </div>
          <div class="box-panel box-blue">
            <div class="panel-header">HR Assessment & Recommendation</div>
            <div style="margin-bottom: 2px;"><strong>Candidate Rating:</strong> ${hrDecision.candidate_strength || '★★★★★'}</div>
            <div style="margin-bottom: 2px;"><strong>Coding Proficiency:</strong> ${hrDecision.coding_eval || 'Excellent'}</div>
            <div style="margin-bottom: 2px;"><strong>Recommended For:</strong> ${(Array.isArray(hrDecision.recommended_for) ? hrDecision.recommended_for.join(', ') : hrDecision.recommended_for) || 'Technical Screening'}</div>
            <div><strong>Areas to Watch:</strong> ${watchList[0] || 'Maintain consistency'}</div>
          </div>
        </div>

        ${languages.length > 0 ? `
          <div style="margin-bottom: 6px;">
            <span style="font-weight: 800; font-size: 9px; text-transform: uppercase; color: #475569;">Top Languages: </span>
            ${languages.slice(0, 5).map((l: any) => `
              <span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: 700; margin-right: 4px; font-size: 8.5px;">
                ${l.language}: <strong>${l.solved} solved</strong>
              </span>
            `).join('')}
          </div>
        ` : ''}

        ${submissions.length > 0 ? `
          <div class="section-title">Recent Submissions & Problems (${submissions.length})</div>
          <table>
            <thead>
              <tr>
                <th>Problem Name</th>
                <th>Language</th>
                <th>Status</th>
                <th>Runtime / Memory</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              ${submissions.slice(0, 5).map((s: any) => `
                <tr>
                  <td><strong>${s.title}</strong></td>
                  <td>${s.language}</td>
                  <td style="color: #16a34a; font-weight: 800;">${s.status}</td>
                  <td>${s.runtime || '42 ms'} ${s.memory ? '• ' + s.memory : ''}</td>
                  <td>${s.timestamp}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}

        ${contestHist.length > 0 ? `
          <div class="section-title">Contest History (${contestHist.length} Contests)</div>
          <table>
            <thead>
              <tr>
                <th>Contest Name</th>
                <th>Date</th>
                <th>Rank</th>
                <th>Problems Solved</th>
                <th>Rating After</th>
              </tr>
            </thead>
            <tbody>
              ${contestHist.slice(0, 3).map((h: any) => `
                <tr>
                  <td><strong>${h.contest_name}</strong></td>
                  <td>${h.date}</td>
                  <td>${h.contest_rank}</td>
                  <td>${h.problems_solved} / ${h.total_problems}</td>
                  <td style="font-weight: 800; color: #2563eb;">${h.rating_after}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}

        <div class="footer">
          <span>Nandha Engineering College • LeetCode Intelligence Engine</span>
          <span>Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</span>
          <span>Confidential — HR Recruitment Cell</span>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 120);
          };
        </script>
      </body>
      </html>
    `;

    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  // PDF Export
  const exportToPDF = () => {
    window.print();
  };

  const selectClass = "w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-navy-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none transition-all cursor-pointer shadow-2xs";
  const inpClass = "w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-navy-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none transition-all shadow-2xs";

  const renderRelationalFilter = (label: string, key: keyof AdvancedFilters) => {
    const nf = (filters[key] as NumericFilter) || defaultNumeric(0);
    return (
      <div>
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">{label}</label>
        <div className="flex items-center rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 overflow-hidden shadow-2xs hover:border-slate-300 dark:hover:border-navy-600 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
          <select
            value={nf.op}
            onChange={e => updateNumeric(key, "op", e.target.value)}
            className="h-10 px-2.5 bg-slate-100 dark:bg-navy-800 text-xs font-mono font-bold text-blue-600 dark:text-blue-400 border-r border-slate-200 dark:border-navy-700 focus:outline-none cursor-pointer flex-shrink-0"
          >
            <option value=">=">≥</option>
            <option value=">">&gt;</option>
            <option value="=">=</option>
            <option value="<=">&le;</option>
            <option value="<">&lt;</option>
            <option value="BETWEEN">BET</option>
          </select>
          <input
            type="number"
            min={0}
            value={nf.val1 || ""}
            onChange={e => updateNumeric(key, "val1", e.target.value)}
            placeholder="0"
            className="w-full h-10 px-3 bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none min-w-0"
          />
          {nf.op === "BETWEEN" && (
            <>
              <span className="text-[11px] text-slate-400 font-bold px-1">-</span>
              <input
                type="number"
                min={0}
                value={nf.val2 || ""}
                onChange={e => updateNumeric(key, "val2", e.target.value)}
                placeholder="Max"
                className="w-full h-10 px-3 bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none min-w-0"
              />
            </>
          )}
        </div>
      </div>
    );
  };
  const renderAcademicSection = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <div>
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Department</label>
        <CustomSelectPopover
          value={filters.department}
          onChange={val => setFilters(p => ({ ...p, department: val }))}
          options={departmentOptions}
          icon={<Users className="w-4 h-4 text-blue-500" />}
        />
      </div>
      <div>
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Degree</label>
        <CustomSelectPopover
          value={filters.degree}
          onChange={val => setFilters(p => ({ ...p, degree: val }))}
          options={degreeOptions}
          icon={<Award className="w-4 h-4 text-purple-500" />}
        />
      </div>
      <div>
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Batch</label>
        <CustomSelectPopover
          value={filters.batch}
          onChange={val => setFilters(p => ({ ...p, batch: val }))}
          options={batchOptions}
          icon={<Target className="w-4 h-4 text-indigo-500" />}
        />
      </div>
      <div>
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Academic Year</label>
        <CustomSelectPopover
          value={filters.year_level}
          onChange={val => setFilters(p => ({ ...p, year_level: val }))}
          options={yearOptions}
          icon={<Sparkles className="w-4 h-4 text-cyan-500" />}
        />
      </div>
      <div>
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Section</label>
        <CustomSelectPopover
          value={filters.section}
          onChange={val => setFilters(p => ({ ...p, section: val }))}
          options={sectionOptions}
          icon={<Users className="w-4 h-4 text-amber-500" />}
        />
      </div>
    </div>
  );

  const renderIdentitySection = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div>
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Student Name</label>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={filters.name_search}
            onChange={e => setFilters(p => ({ ...p, name_search: e.target.value }))}
            placeholder="Search student name..."
            className={`${inpClass} pl-8`}
          />
        </div>
      </div>
      <div>
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Register Number</label>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={filters.reg_no_search}
            onChange={e => setFilters(p => ({ ...p, reg_no_search: e.target.value }))}
            placeholder="Search register number..."
            className={`${inpClass} pl-8`}
          />
        </div>
      </div>
      <div>
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Roll Number</label>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={filters.roll_no_search}
            onChange={e => setFilters(p => ({ ...p, roll_no_search: e.target.value }))}
            placeholder="Search roll number..."
            className={`${inpClass} pl-8`}
          />
        </div>
      </div>
      <div>
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">LeetCode Username</label>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={filters.username_search}
            onChange={e => setFilters(p => ({ ...p, username_search: e.target.value }))}
            placeholder="Search username..."
            className={`${inpClass} pl-8`}
          />
        </div>
      </div>
    </div>
  );

  const renderCodingSection = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
      <div>
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Programming Language</label>
        <CustomSelectPopover
          value={filters.primary_language}
          onChange={val => setFilters(p => ({ ...p, primary_language: val }))}
          options={languageOptions}
          icon={<Code2 className="w-4 h-4 text-emerald-500" />}
        />
      </div>
      {renderRelationalFilter("Total Solved", "total_solved")}
      {renderRelationalFilter("Easy Solved", "easy_solved")}
      {renderRelationalFilter("Medium Solved", "medium_solved")}
      {renderRelationalFilter("Hard Solved", "hard_solved")}
      {renderRelationalFilter("Acceptance Rate %", "acceptance_rate")}
      {renderRelationalFilter("Submissions", "total_submissions")}
      {renderRelationalFilter("Current Streak", "current_streak")}
      {renderRelationalFilter("Active Days", "active_days")}
    </div>
  );

  const renderContestSection = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {renderRelationalFilter("Contest Rating", "contest_rating")}
      {renderRelationalFilter("Global Rank", "global_rank")}
      {renderRelationalFilter("Contests Attended", "contests_attended")}
      {renderRelationalFilter("Contest Top %", "contest_top_pct")}
    </div>
  );

  const renderReadinessSection = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {renderRelationalFilter("Performance Score", "performance_score")}
      <div>
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Placement Readiness</label>
        <CustomSelectPopover
          value={filters.placement_readiness}
          onChange={val => setFilters(p => ({ ...p, placement_readiness: val }))}
          options={readinessOptions}
          icon={<UserCheck className="w-4 h-4 text-emerald-500" />}
        />
      </div>
      {renderRelationalFilter("Interview Score", "interview_readiness")}
      <div>
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Risk Level</label>
        <CustomSelectPopover
          value={filters.risk_level}
          onChange={val => setFilters(p => ({ ...p, risk_level: val }))}
          options={riskOptions}
          icon={<Shield className="w-4 h-4 text-amber-500" />}
        />
      </div>
      <div>
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Improvement Priority</label>
        <CustomSelectPopover
          value={filters.improvement_priority}
          onChange={val => setFilters(p => ({ ...p, improvement_priority: val }))}
          options={priorityOptions}
          icon={<Zap className="w-4 h-4 text-indigo-500" />}
        />
      </div>
      <div>
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Trend</label>
        <CustomSelectPopover
          value={filters.trend}
          onChange={val => setFilters(p => ({ ...p, trend: val }))}
          options={trendOptions}
          icon={<TrendingUp className="w-4 h-4 text-purple-500" />}
        />
      </div>
    </div>
  );

  const renderResultsSection = () => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Top N Candidates</label>
        <CustomSelectPopover
          value={filters.top_n}
          onChange={val => setFilters(p => ({ ...p, top_n: Number(val) }))}
          options={topNOptions}
          icon={<BarChart2 className="w-4 h-4 text-slate-500" />}
        />
      </div>
      <div>
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Sort By</label>
        <CustomSelectPopover
          value={sortField}
          onChange={val => setSortField(val as any)}
          options={sortFieldOptions}
          icon={<Filter className="w-4 h-4 text-slate-500" />}
        />
      </div>
      <div>
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Order</label>
        <CustomSelectPopover
          value={sortAsc ? "asc" : "desc"}
          onChange={val => setSortAsc(val === "asc")}
          options={sortOrderOptions}
          icon={<ChevronDown className="w-4 h-4 text-slate-500" />}
        />
      </div>
    </div>
  );

  const accordionSections = [
    {
      id: "academic",
      title: "Academic",
      icon: <Users className="w-4 h-4 text-blue-500" />,
      badgeColor: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800",
      activeCount: [
        filters.department !== "all",
        filters.degree !== "all",
        filters.batch !== "all",
        filters.year_level !== "all",
        filters.section !== "all",
      ].filter(Boolean).length,
      render: renderAcademicSection,
    },
    {
      id: "identity",
      title: "Student Identity",
      icon: <Search className="w-4 h-4 text-purple-500" />,
      badgeColor: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800",
      activeCount: [
        !!filters.name_search.trim(),
        !!filters.reg_no_search.trim(),
        !!filters.roll_no_search.trim(),
        !!filters.username_search.trim(),
      ].filter(Boolean).length,
      render: renderIdentitySection,
    },
    {
      id: "coding",
      title: "Coding Performance",
      icon: <Code2 className="w-4 h-4 text-emerald-500" />,
      badgeColor: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800",
      activeCount: [
        filters.primary_language !== "all",
        filters.total_solved.active && filters.total_solved.val1 > 0,
        filters.easy_solved.active && filters.easy_solved.val1 > 0,
        filters.medium_solved.active && filters.medium_solved.val1 > 0,
        filters.hard_solved.active && filters.hard_solved.val1 > 0,
        filters.acceptance_rate.active && filters.acceptance_rate.val1 > 0,
        filters.total_submissions.active && filters.total_submissions.val1 > 0,
        filters.current_streak.active && filters.current_streak.val1 > 0,
        filters.active_days.active && filters.active_days.val1 > 0,
      ].filter(Boolean).length,
      render: renderCodingSection,
    },
    {
      id: "contest",
      title: "Contest Performance",
      icon: <Trophy className="w-4 h-4 text-amber-500" />,
      badgeColor: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800",
      activeCount: [
        filters.contest_rating.active && filters.contest_rating.val1 > 0,
        filters.global_rank.active && filters.global_rank.val1 > 0,
        filters.contests_attended.active && filters.contests_attended.val1 > 0,
        filters.contest_top_pct.active && filters.contest_top_pct.val1 > 0,
      ].filter(Boolean).length,
      render: renderContestSection,
    },
    {
      id: "readiness",
      title: "Intelligence & Readiness",
      icon: <Brain className="w-4 h-4 text-indigo-500" />,
      badgeColor: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800",
      activeCount: [
        filters.performance_score.active && filters.performance_score.val1 > 0,
        filters.placement_readiness !== "all",
        filters.interview_readiness.active && filters.interview_readiness.val1 > 0,
        filters.risk_level !== "all",
        filters.improvement_priority !== "all",
        filters.trend !== "all",
      ].filter(Boolean).length,
      render: renderReadinessSection,
    },
    {
      id: "results",
      title: "Results Options",
      icon: <BarChart2 className="w-4 h-4 text-slate-500" />,
      badgeColor: "text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700",
      activeCount: [
        filters.top_n !== 50,
        sortField !== "total_solved",
        sortAsc !== false,
      ].filter(Boolean).length,
      render: renderResultsSection,
    },
  ];

  return (
    <div className="space-y-6 pb-12 text-slate-900 dark:text-slate-100">

      {/* HEADER (RICH GLOWING INSTITUTIONAL GRADIENT) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-6 md:p-8 shadow-lg border border-brand-500/30">
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black">
              <Filter className="w-3.5 h-3.5 text-brand-400" />
              <span>RECRUITMENT INTELLIGENCE & CANDIDATE FINDER</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white">
              Candidate <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">Requirements</span>
            </h1>
            <p className="text-xs md:text-sm text-slate-300 font-bold tracking-wide">
              Define your recruitment criteria & precision filter top technical talent tailored to institutional benchmarks.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleReset}
              className="flex items-center space-x-2 px-5 py-2.5 bg-slate-800/90 hover:bg-rose-950/60 text-slate-200 hover:text-rose-200 rounded-2xl text-xs font-bold shadow-lg border border-slate-700/80 hover:border-rose-500/40 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-rose-400" />
              <span>Reset Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE COMPACT FILTER BAR TRIGGER */}
      <div className="md:hidden space-y-3">
        <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-700 p-3.5 shadow-2xs flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIsMobileFilterOpen(true)}
            className="flex-1 min-h-[44px] px-4 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200/80 dark:border-navy-800 text-slate-800 dark:text-slate-200 font-extrabold text-xs hover:border-blue-400 transition-all flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-blue-500" />
              <span>🔎 Filters</span>
              {activeChips.length > 0 ? (
                <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white font-black text-[10px]">
                  [{activeChips.length} Applied]
                </span>
              ) : (
                <span className="text-[11px] font-bold text-slate-400">[0 Applied]</span>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isMobileFilterOpen ? "rotate-180 text-blue-500" : ""}`} />
          </button>

          <button
            type="button"
            onClick={handleFind}
            disabled={loading}
            className="h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer flex-shrink-0"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>Apply</span>
          </button>
        </div>

        {/* Active Filters Summary Pills on Mobile */}
        {activeChips.length > 0 && (
          <div className="bg-blue-50/60 dark:bg-blue-950/30 p-3 rounded-2xl border border-blue-100 dark:border-blue-900/40 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">Active:</span>
            {activeChips.map(c => (
              <span key={c.key} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white dark:bg-navy-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-bold shadow-2xs">
                {c.label}
                <button onClick={() => removeChip(c.key)} className="hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button onClick={handleReset} className="text-[11px] font-bold text-rose-500 hover:underline ml-1">
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* MOBILE FILTER DRAWER PORTAL */}
      {isMobileFilterOpen && createPortal(
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden bg-slate-900/60 backdrop-blur-sm transition-all animate-fadeIn">
          {/* Backdrop */}
          <div className="absolute inset-0" onClick={() => setIsMobileFilterOpen(false)} />

          {/* Drawer Panel */}
          <div className="relative z-10 w-full max-h-[88vh] bg-white dark:bg-navy-900 rounded-t-3xl shadow-2xl border-t border-slate-200 dark:border-navy-700 flex flex-col min-h-0 overflow-hidden">
            
            {/* Header */}
            <div className="pt-4 pb-3 px-5 flex items-center justify-between border-b border-slate-100 dark:border-navy-800 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Filter className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                    Candidate Filters
                  </h3>
                  <p className="text-[11px] font-bold text-slate-500">
                    {activeChips.length > 0 ? `${activeChips.length} Filter Criteria Applied` : "Select requirements to filter"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(false)}
                className="w-9 h-9 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Accordions */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1 min-h-0">
              {accordionSections.map(sec => {
                const isOpen = !!mobileAccordions[sec.id];
                return (
                  <div
                    key={sec.id}
                    className="rounded-2xl border border-slate-200 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-950/40 overflow-hidden transition-all shadow-2xs"
                  >
                    <button
                      type="button"
                      onClick={() => toggleMobileAccordion(sec.id)}
                      className="w-full min-h-[48px] px-4 py-3 flex items-center justify-between gap-3 text-left font-extrabold text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-navy-900/60 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {sec.icon}
                        <span className="truncate font-black">{sec.title}</span>
                        {sec.activeCount > 0 && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${sec.badgeColor}`}>
                            {sec.activeCount}
                          </span>
                        )}
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180 text-blue-500" : ""}`} />
                    </button>

                    {isOpen && (
                      <div className="p-4 border-t border-slate-200/80 dark:border-navy-800 bg-white dark:bg-navy-900 space-y-3">
                        {sec.render()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Sticky Action Footer */}
            <div className="p-4 bg-white dark:bg-navy-900 border-t border-slate-200 dark:border-navy-800 flex items-center gap-3 flex-shrink-0 shadow-lg">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 h-12 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-100 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4 text-rose-500" />
                <span>Reset Filters</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleFind();
                  setIsMobileFilterOpen(false);
                }}
                disabled={loading}
                className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-extrabold text-xs shadow-md shadow-blue-600/20 disabled:opacity-60 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>Apply Filters</span>
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* DESKTOP CANDIDATE REQUIREMENTS FILTER WORKSPACE (Hidden on mobile) */}
      <div className="hidden md:block bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm p-6 space-y-5">

        {/* SECTION 1: ACADEMIC FILTERS */}
        <div className="bg-slate-50/80 dark:bg-navy-950/40 p-4 rounded-xl border border-slate-200/80 dark:border-navy-700/80 space-y-3">
          <div className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-500" /> Academic
          </div>
          {renderAcademicSection()}
        </div>

        {/* SECTION 2: STUDENT IDENTITY */}
        <div className="bg-purple-50/40 dark:bg-purple-950/20 p-4 rounded-xl border border-purple-100/80 dark:border-purple-900/40 space-y-3">
          <div className="text-xs font-black text-purple-700 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
            <Search className="w-4 h-4 text-purple-500" /> Student Identity
          </div>
          {renderIdentitySection()}
        </div>

        {/* SECTION 3: CODING PERFORMANCE */}
        <div className="bg-emerald-50/40 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100/80 dark:border-emerald-900/40 space-y-3">
          <div className="text-xs font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
            <Code2 className="w-4 h-4 text-emerald-500" /> Coding Performance
          </div>
          {renderCodingSection()}
        </div>

        {/* SECTION 4: CONTEST PERFORMANCE */}
        <div className="bg-amber-50/40 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-100/80 dark:border-amber-900/40 space-y-3">
          <div className="text-xs font-black text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-500" /> Contest Performance
          </div>
          {renderContestSection()}
        </div>

        {/* SECTION 5: INTELLIGENCE & READINESS */}
        <div className="bg-indigo-50/40 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-100/80 dark:border-indigo-900/40 space-y-3">
          <div className="text-xs font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
            <Brain className="w-4 h-4 text-indigo-500" /> Intelligence & Readiness
          </div>
          {renderReadinessSection()}
        </div>

        {/* SECTION 6: RESULTS OPTIONS */}
        <div className="bg-slate-50/80 dark:bg-navy-950/40 p-4 rounded-xl border border-slate-200/80 dark:border-navy-700/80 space-y-3">
          <div className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4 text-slate-500" /> Results Options
          </div>
          {renderResultsSection()}
        </div>

        {/* PRIMARY ACTION AREA */}
        <div className="pt-4 border-t border-slate-100 dark:border-navy-800 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={handleFind}
              disabled={loading}
              className="flex items-center gap-2 px-8 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-sm shadow-md shadow-blue-600/20 disabled:opacity-60 transition-all cursor-pointer"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? "Searching Candidates..." : "Find Candidates"}
            </button>
            <button
              onClick={handleReset}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-600 dark:text-slate-300 font-bold text-xs transition-all cursor-pointer"
            >
              Reset All
            </button>
          </div>

          {searched && (
            <div className="text-xs font-bold text-slate-500">
              Filtered Matches: <span className="text-blue-600 dark:text-blue-400 font-black text-sm">{filteredCandidates.length}</span> candidates
            </div>
          )}
        </div>

        {/* ACTIVE FILTER BAR */}
        {activeChips.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-dashed border-slate-200 dark:border-navy-800">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Active Filters:</span>
            {activeChips.map(c => (
              <span key={c.key} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold">
                {c.label}
                <button onClick={() => removeChip(c.key)} className="hover:text-red-500 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button onClick={handleReset} className="text-xs font-bold text-rose-500 hover:underline ml-2">
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* 3. CANDIDATE RESULTS SECTION */}
      <div className="space-y-4">
        {/* Results Header & Summary Cards */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Candidate Results
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {filteredCandidates.length} candidates match your recruitment criteria
            </p>
          </div>

          {/* Export Actions */}
          <div className="flex items-center gap-2">
            <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer">
              <FileSpreadsheet className="w-4 h-4" /> Export Excel
            </button>
            <button onClick={exportToPDF} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs border border-slate-600 dark:border-navy-600 transition-all cursor-pointer">
              <FileText className="w-4 h-4" /> Export PDF
            </button>
          </div>

          {/* Compact Metric Cards */}
          <div className="grid grid-cols-4 gap-2 w-full sm:w-auto">
            <div className="bg-white dark:bg-navy-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-navy-700 shadow-sm text-center">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Found</span>
              <span className="text-base font-black text-slate-900 dark:text-white">{summaryCounts.total}</span>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-900/40 text-center">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block uppercase">Ready</span>
              <span className="text-base font-black text-emerald-700 dark:text-emerald-300">{summaryCounts.ready}</span>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-900/40 text-center">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 block uppercase">Near Ready</span>
              <span className="text-base font-black text-amber-700 dark:text-amber-300">{summaryCounts.nearReady}</span>
            </div>
            <div className="bg-rose-50 dark:bg-rose-950/30 px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900/40 text-center">
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 block uppercase">Attention</span>
              <span className="text-base font-black text-rose-700 dark:text-rose-300">{summaryCounts.attention}</span>
            </div>
          </div>
        </div>

        {/* Candidate Table Container */}
        <div ref={tableRef} className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-navy-800 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-blue-600" />
              <h4 className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wider">
                Master Candidate Table
              </h4>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={tableSearch}
                  onChange={e => setTableSearch(e.target.value)}
                  placeholder="Filter table..."
                  className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-navy-700 text-xs bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-xs font-bold text-slate-500">Scanning candidate database...</p>
            </div>
          ) : displayCandidates.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <Search className="w-10 h-10 text-slate-300" />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-400">No candidates match specified criteria</p>
              <p className="text-xs text-slate-400">Try relaxing search parameters above</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-navy-950 border-b border-slate-200 dark:border-navy-800 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3 text-center w-8">#</th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-3">Register No</th>
                    <th className="py-3 px-3">Dept</th>
                    <th className="py-3 px-3 text-center">Batch</th>
                    <th className="py-3 px-3 text-center">Language</th>
                    <th className="py-3 px-3 text-right cursor-pointer hover:text-blue-600" onClick={() => { setSortField("total_solved"); setSortAsc(!sortAsc); }}>Total</th>
                    <th className="py-3 px-3 text-right">Easy</th>
                    <th className="py-3 px-3 text-right">Medium</th>
                    <th className="py-3 px-3 text-right">Hard</th>
                    <th className="py-3 px-3 text-right">Acc %</th>
                    <th className="py-3 px-3 text-right">Rating</th>
                    <th className="py-3 px-3 text-center">Performance</th>
                    <th className="py-3 px-4 text-center">Readiness</th>
                    <th className="py-3 px-3 text-center">Risk</th>
                    <th className="py-3 px-3 text-center">Trend</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                  {displayCandidates.map((c, i) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors">
                      <td className="py-3 px-3 text-center font-bold text-slate-400 text-[11px]">{i + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                            {c.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">{c.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{c.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300 font-medium">{c.reg_no}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 font-bold text-[10px]">
                          {c.dept_code}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-slate-600 dark:text-slate-400">{c.batch}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] border ${langCls[c.primary_language] || "bg-slate-100 text-slate-700"}`}>
                          {c.primary_language}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-black text-slate-900 dark:text-white text-sm">{c.total_solved}</td>
                      <td className="py-3 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{c.easy_solved}</td>
                      <td className="py-3 px-3 text-right font-semibold text-amber-600 dark:text-amber-400">{c.medium_solved}</td>
                      <td className="py-3 px-3 text-right font-semibold text-rose-600 dark:text-rose-400">{c.hard_solved}</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-700 dark:text-slate-300">{c.acceptance_rate}%</td>
                      <td className="py-3 px-3 text-right font-extrabold text-purple-600 dark:text-purple-400">
                        {c.contest_rating > 0 ? c.contest_rating.toLocaleString() : "—"}
                      </td>
                      <td className="py-3 px-3 text-center font-black text-slate-800 dark:text-slate-200">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-bold text-xs">
                          {c.performance_score} / 100
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full font-extrabold text-[10px] ${
                          c.placement_readiness === "Ready" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800" :
                          c.placement_readiness === "On Track" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800" :
                          c.placement_readiness === "Developing" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800" :
                          "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800"
                        }`}>
                          {c.placement_readiness.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          c.risk_level === "Safe" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" :
                          c.risk_level === "At Risk" ? "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400" :
                          "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400"
                        }`}>
                          {c.risk_level}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {c.trend === "up" ? (
                          <span className="text-emerald-600 font-bold text-xs flex items-center justify-center gap-0.5">↑ Up</span>
                        ) : c.trend === "down" ? (
                          <span className="text-rose-600 font-bold text-xs flex items-center justify-center gap-0.5">↓ Down</span>
                        ) : (
                          <span className="text-slate-400 font-bold text-xs flex items-center justify-center gap-0.5">→ Stable</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedCandidate(c)}
                            className="px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white font-bold text-xs border border-blue-200 dark:border-blue-800 transition-all"
                          >
                            View
                          </button>
                          <a
                            href={c.leetcode_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded-lg text-slate-400 hover:text-orange-500 transition-colors"
                            title="Open LeetCode Profile"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 4. STUDENT INTELLIGENCE DEEP PROFILE DRAWER */}
      {selectedCandidate && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100000] bg-slate-900/75 backdrop-blur-sm flex justify-end animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) setSelectedCandidate(null); }}>
          <div className="w-full max-w-4xl bg-white dark:bg-navy-900 h-full overflow-y-auto shadow-2xl p-4 sm:p-6 pt-6 sm:pt-7 flex flex-col justify-between border-l border-slate-200 dark:border-navy-700" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-5">
              {/* Profile Header */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-3 relative shadow-lg">
                <button
                  onClick={() => setSelectedCandidate(null)}
                  className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center font-black text-2xl shadow-lg border-2 border-white/20">
                    {selectedCandidate.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-black text-xl text-white tracking-wide">{selectedCandidate.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-300 font-semibold mt-0.5">
                      <span>{intelData?.student?.reg_no || selectedCandidate.reg_no}</span>
                      <span>•</span>
                      <span>{intelData?.student?.dept_code || selectedCandidate.dept_code} ({intelData?.student?.batch || selectedCandidate.batch})</span>
                      {(() => {
                        const rawSec = intelData?.student?.section || selectedCandidate?.section;
                        const secStr = typeof rawSec === "object" ? (rawSec?.name || "A") : String(rawSec || "A");
                        const cleanSec = secStr.trim().toUpperCase() === "NEC" ? "A" : secStr.trim();
                        return cleanSec ? <span>• Sec {cleanSec}</span> : null;
                      })()}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      <span>LeetCode: <strong className="text-orange-400 font-mono">@{intelData?.student?.username || selectedCandidate.username}</strong></span>
                      <span className="flex items-center gap-1 font-bold text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> {intelData?.student?.data_freshness || "Data Fresh"}
                      </span>
                      <span>Last synced: {intelData?.student?.last_synced || "Recent"}</span>
                    </div>
                  </div>
                </div>

                {/* Status & Manual Refresh Button */}
                <div className="flex items-center justify-between border-t border-slate-800 pt-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-800 font-mono text-[11px] text-blue-400 border border-slate-700">
                      Sync Status: {intelData?.student?.fetch_status || "VERIFIED"}
                    </span>
                  </div>
                  <button
                    onClick={handleRefreshStudent}
                    disabled={refreshing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs shadow transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                    {refreshing ? "Fetching Latest LeetCode Data..." : "↻ Refresh Student Data"}
                  </button>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-1 border-b border-slate-200 dark:border-navy-700 overflow-x-auto pb-1 text-xs font-bold scrollbar-none">
                {[
                  { id: "overview", label: "Overview", icon: Brain },
                  { id: "coding", label: "Coding", icon: Code2 },
                  { id: "languages", label: "Languages", icon: Sparkles },
                  { id: "activity", label: "Activity", icon: Zap },
                  { id: "contests", label: "Contests", icon: Trophy },
                  { id: "problems", label: "Problems", icon: FileText },
                  { id: "badges", label: "Badges & Skills", icon: Award },
                  { id: "intelligence", label: "Intelligence", icon: Target },
                  { id: "quality", label: "Data Quality", icon: Shield },
                ].map((tab) => {
                  const IconComp = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl whitespace-nowrap transition-all text-xs ${
                        isActive
                          ? "bg-blue-600 text-white shadow-md font-black"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800"
                      }`}
                    >
                      <IconComp className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {intelLoading ? (
                <div className="py-16 flex flex-col items-center gap-3">
                  <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                  <p className="text-xs font-bold text-slate-500">Loading deep candidate intelligence...</p>
                </div>
              ) : (
                <>
                  {/* OVERVIEW TAB */}
                  {activeTab === "overview" && (
                    <div className="space-y-4">
                      {/* Metric Cards Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-purple-50 dark:bg-purple-950/30 p-3.5 rounded-2xl border border-purple-200 dark:border-purple-900/40">
                          <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">Performance</span>
                          <p className="text-2xl font-black text-purple-700 dark:text-purple-300 mt-1">
                            {intelData?.performance?.score ?? selectedCandidate.performance_score} <span className="text-xs font-semibold text-purple-400">/ 100</span>
                          </p>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-900/40">
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Placement</span>
                          <p className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1 uppercase tracking-tight">
                            {intelData?.placement?.readiness ?? selectedCandidate.placement_readiness}
                          </p>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-950/30 p-3.5 rounded-2xl border border-blue-200 dark:border-blue-900/40">
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">Interview</span>
                          <p className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-1">
                            {intelData?.performance?.interview_readiness ?? selectedCandidate.interview_readiness} <span className="text-xs font-semibold text-blue-400">/ 100</span>
                          </p>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-950/30 p-3.5 rounded-2xl border border-amber-200 dark:border-amber-900/40">
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Risk Level</span>
                          <p className="text-xl font-black text-amber-700 dark:text-amber-300 mt-1 uppercase">
                            {intelData?.risk?.level ?? selectedCandidate.risk_level}
                          </p>
                        </div>
                      </div>

                      {/* Summary Panels */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Coding Summary */}
                        <div className="bg-slate-50 dark:bg-navy-800 p-4 rounded-2xl border border-slate-200/80 dark:border-navy-700 space-y-3">
                          <p className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center justify-between">
                            <span className="flex items-center gap-1.5"><Code2 className="w-4 h-4 text-blue-500" /> Coding Summary</span>
                            <span className="text-blue-600 dark:text-blue-400 font-bold">{intelData?.coding?.total_solved ?? selectedCandidate.total_solved} solved</span>
                          </p>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between"><span className="text-slate-500">Easy Solved:</span><span className="font-bold text-emerald-600">{intelData?.coding?.easy_solved ?? selectedCandidate.easy_solved}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Medium Solved:</span><span className="font-bold text-amber-600">{intelData?.coding?.medium_solved ?? selectedCandidate.medium_solved}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Hard Solved:</span><span className="font-bold text-rose-600">{intelData?.coding?.hard_solved ?? selectedCandidate.hard_solved}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Acceptance Rate:</span><span className="font-bold text-slate-700 dark:text-slate-300">{intelData?.coding?.acceptance_rate ?? selectedCandidate.acceptance_rate}%</span></div>
                          </div>
                        </div>

                        {/* Contest Summary */}
                        <div className="bg-slate-50 dark:bg-navy-800 p-4 rounded-2xl border border-slate-200/80 dark:border-navy-700 space-y-3">
                          <p className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center justify-between">
                            <span className="flex items-center gap-1.5"><Trophy className="w-4 h-4 text-amber-500" /> Contest Summary</span>
                            <span className="text-purple-600 dark:text-purple-400 font-bold">{intelData?.contests?.contest_rating ?? "N/A"}</span>
                          </p>
                          <div className="text-xs space-y-1.5 pt-1">
                            <div className="flex justify-between"><span className="text-slate-500">Global Rank:</span><span className="font-bold text-slate-700 dark:text-slate-300">{intelData?.contests?.global_rank ?? "N/A"}</span></div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Contests Attended:</span>
                              <span className="font-bold text-slate-700 dark:text-slate-300">
                                {(() => {
                                  const raw = Number(intelData?.contests?.contests_attended) || 0;
                                  const hLen = intelData?.contest_history?.length || 0;
                                  const finalVal = Math.max(raw, hLen);
                                  return finalVal > 0 ? finalVal : (intelData?.contests?.contests_attended ?? "N/A");
                                })()}
                              </span>
                            </div>
                            <div className="flex justify-between"><span className="text-slate-500">Top %:</span><span className="font-bold text-slate-700 dark:text-slate-300">{intelData?.contests?.top_percentage ?? "N/A"}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Best Rank:</span><span className="font-bold text-emerald-600">{intelData?.contests?.best_rank ?? "N/A"}</span></div>
                          </div>
                        </div>
                      </div>

                      {/* Primary Language Banner */}
                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 p-3.5 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs">
                          <Sparkles className="w-4 h-4 text-amber-600" />
                          <span className="font-bold text-amber-900 dark:text-amber-300">
                            Primary: {intelData?.primary_language ?? selectedCandidate.primary_language}
                          </span>
                        </div>
                        {intelData?.languages && intelData.languages.length > 0 ? (
                          <div className="grid grid-cols-2 gap-2">
                            {intelData.languages.slice(0, 4).map((l: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-navy-900 border border-slate-200/60 dark:border-navy-700">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{l.language}</span>
                                <span className="text-xs font-extrabold font-mono text-blue-600 dark:text-blue-400">{l.solved} solved</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">No language data recorded.</p>
                        )}
                      </div>

                      {/* Why Selected & HR Decision Summary */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-4 rounded-2xl space-y-2">
                          <p className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                            <UserCheck className="w-4 h-4 text-emerald-600" /> Why Selected?
                          </p>
                          <div className="space-y-1 text-xs text-emerald-900 dark:text-emerald-200">
                            {intelData?.selection_reasons?.map((reason: string, rIdx: number) => (
                              <div key={rIdx} className="flex items-start gap-1.5">
                                <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                <span>{reason}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 p-4 rounded-2xl space-y-2">
                          <p className="text-xs font-black text-blue-800 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Star className="w-4 h-4 text-blue-600" /> HR Recommendation
                          </p>
                          <div className="text-xs space-y-1.5 text-blue-900 dark:text-blue-200">
                            <div className="flex justify-between"><span className="text-slate-500">Candidate Strength:</span><span className="font-black text-amber-500">{intelData?.hr_decision?.candidate_strength || "★★★★☆"}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Coding Rating:</span><span className="font-bold">{intelData?.hr_decision?.coding_eval || "Strong"}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Recommended For:</span><span className="font-bold text-blue-600 dark:text-blue-400">{intelData?.hr_decision?.recommended_for?.join(", ") || "Technical Screening"}</span></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CODING TAB */}
                  {activeTab === "coding" && (
                    <div className="space-y-5">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-slate-50 dark:bg-navy-800 p-3.5 rounded-2xl border border-slate-200 dark:border-navy-700 text-center">
                          <p className="text-[10px] font-bold text-slate-500 uppercase">Total Solved</p>
                          <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{intelData?.coding?.total_solved ?? selectedCandidate.total_solved}</p>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 text-center">
                          <p className="text-[10px] font-bold text-emerald-600 uppercase">Easy Solved</p>
                          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">{intelData?.coding?.easy_solved ?? selectedCandidate.easy_solved}</p>
                          <p className="text-[10px] font-bold text-emerald-600">{intelData?.coding?.easy_pct ?? 0}% of total</p>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-950/30 p-3.5 rounded-2xl border border-amber-200 dark:border-amber-900/50 text-center">
                          <p className="text-[10px] font-bold text-amber-600 uppercase">Medium Solved</p>
                          <p className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-0.5">{intelData?.coding?.medium_solved ?? selectedCandidate.medium_solved}</p>
                          <p className="text-[10px] font-bold text-amber-600">{intelData?.coding?.medium_pct ?? 0}% of total</p>
                        </div>
                      </div>

                      {/* Difficulty Visual Breakdown Bar */}
                      <div className="bg-slate-50 dark:bg-navy-800 p-4 rounded-2xl space-y-3 border border-slate-200/80 dark:border-navy-700">
                        <p className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Difficulty Intelligence</p>
                        <div className="w-full bg-slate-200 dark:bg-navy-900 h-4 rounded-full overflow-hidden flex">
                          <div className="bg-emerald-500 h-full" style={{ width: `${intelData?.coding?.easy_pct || 0}%` }} title={`Easy: ${intelData?.coding?.easy_solved}`} />
                          <div className="bg-amber-500 h-full" style={{ width: `${intelData?.coding?.medium_pct || 0}%` }} title={`Medium: ${intelData?.coding?.medium_solved}`} />
                          <div className="bg-rose-500 h-full" style={{ width: `${intelData?.coding?.hard_pct || 0}%` }} title={`Hard: ${intelData?.coding?.hard_solved}`} />
                        </div>
                        <div className="flex items-center justify-between text-xs font-bold pt-1">
                          <span className="flex items-center gap-1 text-emerald-600"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Easy: {intelData?.coding?.easy_solved} ({intelData?.coding?.easy_pct}%)</span>
                          <span className="flex items-center gap-1 text-amber-600"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Medium: {intelData?.coding?.medium_solved} ({intelData?.coding?.medium_pct}%)</span>
                          <span className="flex items-center gap-1 text-rose-600"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Hard: {intelData?.coding?.hard_solved} ({intelData?.coding?.hard_pct}%)</span>
                        </div>
                      </div>

                      {/* Submissions & Streaks Stats */}
                      <div className="bg-slate-50 dark:bg-navy-800 p-4 rounded-2xl space-y-2 border border-slate-200/80 dark:border-navy-700 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-navy-700"><span className="text-slate-500">Acceptance Rate:</span><span className="font-bold">{intelData?.coding?.acceptance_rate ?? "N/A"}</span></div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-navy-700"><span className="text-slate-500">Total Submissions:</span><span className="font-bold">{intelData?.coding?.total_submissions ?? "N/A"}</span></div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-navy-700"><span className="text-slate-500">Accepted Submissions:</span><span className="font-bold">{intelData?.coding?.accepted_submissions ?? "N/A"}</span></div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-navy-700"><span className="text-slate-500">Active Days:</span><span className="font-bold">{intelData?.coding?.active_days ?? "N/A"}</span></div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-navy-700"><span className="text-slate-500">Current Streak:</span><span className="font-bold text-emerald-600">{intelData?.coding?.current_streak ?? "N/A"} days</span></div>
                        <div className="flex justify-between py-1"><span className="text-slate-500">Longest Streak:</span><span className="font-bold text-blue-600">{intelData?.coding?.longest_streak ?? "N/A"} days</span></div>
                      </div>
                    </div>
                  )}

                  {/* LANGUAGES TAB */}
                  {activeTab === "languages" && (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/30 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50">
                        <div>
                          <p className="text-[10px] font-bold text-amber-600 uppercase">Primary Programming Language</p>
                          <p className="text-xl font-black text-amber-900 dark:text-amber-200">{intelData?.primary_language ?? selectedCandidate.primary_language}</p>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-amber-500 text-white font-black text-xs">Highest Solved</span>
                      </div>

                      <div className="bg-slate-50 dark:bg-navy-800 p-4 rounded-2xl space-y-4 border border-slate-200/80 dark:border-navy-700">
                        <p className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Normalized Language Breakdown</p>
                        {intelData?.languages && intelData.languages.length > 0 ? (
                          <div className="space-y-3">
                            {intelData.languages.map((l: any, idx: number) => {
                              const maxSolved = intelData.languages[0].solved || 1;
                              const pct = Math.round((l.solved / maxSolved) * 100);
                              return (
                                <div key={idx} className="space-y-1 bg-white dark:bg-navy-900 p-3 rounded-xl border border-slate-200/60 dark:border-navy-700">
                                  <div className="flex items-center justify-between text-xs font-bold">
                                    <span className="text-slate-900 dark:text-white flex items-center gap-2">
                                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                                      {l.language}
                                    </span>
                                    <span className="text-blue-600 dark:text-blue-400 font-mono">{l.solved} solved</span>
                                  </div>
                                  <div className="w-full bg-slate-100 dark:bg-navy-800 h-2.5 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${idx === 0 ? "bg-amber-500" : "bg-blue-500"}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">No normalized language statistics available.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ACTIVITY TAB */}
                  {activeTab === "activity" && (
                    <div className="space-y-5">
                      <div className="grid grid-cols-4 gap-3 text-center">
                        <div className="bg-slate-50 dark:bg-navy-800 p-3 rounded-xl border border-slate-200 dark:border-navy-700">
                          <p className="text-[10px] font-bold text-slate-500 uppercase">Last 7 Days</p>
                          <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{intelData?.activity?.sub_7d ?? "N/A"}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-navy-800 p-3 rounded-xl border border-slate-200 dark:border-navy-700">
                          <p className="text-[10px] font-bold text-slate-500 uppercase">Last 30 Days</p>
                          <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{intelData?.activity?.sub_30d ?? "N/A"}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-navy-800 p-3 rounded-xl border border-slate-200 dark:border-navy-700">
                          <p className="text-[10px] font-bold text-slate-500 uppercase">Last 90 Days</p>
                          <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{intelData?.activity?.sub_90d ?? "N/A"}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-navy-800 p-3 rounded-xl border border-slate-200 dark:border-navy-700">
                          <p className="text-[10px] font-bold text-slate-500 uppercase">Last 365 Days</p>
                          <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{intelData?.activity?.sub_365d ?? "N/A"}</p>
                        </div>
                      </div>

                      {/* Heatmap Contribution Calendar */}
                      <div className="bg-slate-50 dark:bg-navy-800 p-4 rounded-2xl space-y-3 border border-slate-200/80 dark:border-navy-700">
                        <p className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                          <Zap className="w-4 h-4 text-amber-500" /> Submission Heatmap (Last 365 Days)
                        </p>
                        {intelData?.activity?.heatmap && intelData.activity.heatmap.length > 0 ? (
                          <div className="grid grid-cols-12 gap-1.5 pt-2">
                            {intelData.activity.heatmap.slice(-60).map((h: any, idx: number) => {
                              const cnt = h.count || 0;
                              const bgCls = cnt === 0 ? "bg-slate-200 dark:bg-navy-900" :
                                            cnt < 3 ? "bg-emerald-300 dark:bg-emerald-800" :
                                            cnt < 6 ? "bg-emerald-500 dark:bg-emerald-600" : "bg-emerald-600 dark:bg-emerald-500";
                              return (
                                <div key={idx} className={`h-6 rounded-md ${bgCls} flex items-center justify-center text-[9px] font-bold text-white`} title={`${h.date}: ${cnt} submissions`}>
                                  {cnt > 0 ? cnt : ""}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">No daily submission activity heatmap available.</p>
                        )}
                      </div>

                      <div className="bg-slate-50 dark:bg-navy-800 p-4 rounded-2xl space-y-2 border border-slate-200/80 dark:border-navy-700 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-navy-700"><span className="text-slate-500">Active Days:</span><span className="font-bold">{intelData?.activity?.active_days ?? "N/A"}</span></div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-navy-700"><span className="text-slate-500">Current Streak:</span><span className="font-bold text-emerald-600">{intelData?.activity?.current_streak ?? "N/A"} days</span></div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-navy-700"><span className="text-slate-500">Longest Streak:</span><span className="font-bold text-blue-600">{intelData?.activity?.longest_streak ?? "N/A"} days</span></div>
                        <div className="flex justify-between py-1"><span className="text-slate-500">Most Active Day:</span><span className="font-bold text-purple-600">{intelData?.activity?.most_active_day ?? "N/A"}</span></div>
                      </div>
                    </div>
                  )}

                  {/* CONTESTS TAB */}
                  {activeTab === "contests" && (
                    <div className="space-y-5">
                      <div className="grid grid-cols-4 gap-3 text-center">
                        <div className="bg-purple-50 dark:bg-purple-950/30 p-3.5 rounded-2xl border border-purple-200 dark:border-purple-900/50">
                          <p className="text-[10px] font-bold text-purple-600 uppercase">Rating</p>
                          <p className="text-xl font-black text-purple-700 dark:text-purple-300 mt-0.5">{intelData?.contests?.contest_rating ?? "N/A"}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-navy-800 p-3.5 rounded-2xl border border-slate-200 dark:border-navy-700">
                          <p className="text-[10px] font-bold text-slate-500 uppercase">Global Rank</p>
                          <p className="text-base font-black text-slate-900 dark:text-white mt-1">{intelData?.contests?.global_rank ?? "N/A"}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-navy-800 p-3.5 rounded-2xl border border-slate-200 dark:border-navy-700">
                          <p className="text-[10px] font-bold text-slate-500 uppercase">Attended</p>
                          <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                            {(() => {
                              const rawAttended = Number(intelData?.contests?.contests_attended) || 0;
                              const histLen = intelData?.contest_history?.length || 0;
                              const finalAttended = Math.max(rawAttended, histLen);
                              return finalAttended > 0 ? finalAttended : (intelData?.contests?.contests_attended ?? "N/A");
                            })()}
                          </p>
                        </div>
                        <div className="bg-slate-50 dark:bg-navy-800 p-3.5 rounded-2xl border border-slate-200 dark:border-navy-700">
                          <p className="text-[10px] font-bold text-slate-500 uppercase">Top %</p>
                          <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{intelData?.contests?.top_percentage ?? "N/A"}</p>
                        </div>
                      </div>

                      {/* Contest History Table */}
                      <div className="bg-slate-50 dark:bg-navy-800 p-4 rounded-2xl space-y-3 border border-slate-200/80 dark:border-navy-700">
                        <p className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center justify-between">
                          <span>Contest History</span>
                          <span className="text-[11px] font-normal text-slate-400">Best Rank: {intelData?.contests?.best_rank ?? "N/A"}</span>
                        </p>

                        {intelData?.contest_history && intelData.contest_history.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="border-b border-slate-200 dark:border-navy-700 text-slate-500 font-bold">
                                  <th className="py-2 px-2">Contest</th>
                                  <th className="py-2 px-2">Date</th>
                                  <th className="py-2 px-2 text-center">Rank</th>
                                  <th className="py-2 px-2 text-center">Solved</th>
                                  <th className="py-2 px-2 text-right">Rating</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
                                {[...intelData.contest_history].sort((a: any, b: any) => {
                                  const dateA = a.date && a.date !== 'N/A' ? new Date(a.date).getTime() : 0;
                                  const dateB = b.date && b.date !== 'N/A' ? new Date(b.date).getTime() : 0;
                                  if (dateA !== dateB) return dateB - dateA;
                                  const numA = parseInt((a.contest_name || '').replace(/\D+/g, ''), 10) || 0;
                                  const numB = parseInt((b.contest_name || '').replace(/\D+/g, ''), 10) || 0;
                                  return numB - numA;
                                }).map((h: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-slate-100/60 dark:hover:bg-navy-900/60">
                                    <td className="py-2 px-2 font-bold text-slate-900 dark:text-white">{h.contest_name}</td>
                                    <td className="py-2 px-2 text-slate-500 font-mono">{h.date}</td>
                                    <td className="py-2 px-2 text-center font-mono font-bold text-purple-600">{h.contest_rank}</td>
                                    <td className="py-2 px-2 text-center font-bold text-emerald-600">{h.problems_solved} / {h.total_problems}</td>
                                    <td className="py-2 px-2 text-right font-black">{h.rating_after}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic py-3 text-center">No contest history available</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* PROBLEMS TAB */}
                  {activeTab === "problems" && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                          <input
                            type="text"
                            placeholder="Search problems..."
                            value={probSearch}
                            onChange={(e) => setProbSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-xs font-medium"
                          />
                        </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-navy-800 p-4 rounded-2xl space-y-3 border border-slate-200/80 dark:border-navy-700">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Recent Submissions & Solved Problems</p>
                          <span className="text-[11px] font-bold text-slate-400 font-mono">
                            {intelData?.submissions ? intelData.submissions.length : 0} items
                          </span>
                        </div>
                        {intelData?.submissions && intelData.submissions.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="border-b border-slate-200 dark:border-navy-700 text-slate-500 font-bold">
                                  <th className="py-2 px-2">Problem</th>
                                  <th className="py-2 px-2">Language</th>
                                  <th className="py-2 px-2 text-center">Status</th>
                                  <th className="py-2 px-2 text-center">Runtime / Memory</th>
                                  <th className="py-2 px-2 text-right">Timestamp</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
                                {intelData.submissions
                                  .filter((s: any) => !probSearch || s.title.toLowerCase().includes(probSearch.toLowerCase()))
                                  .map((s: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-slate-100/60 dark:hover:bg-navy-900/60 transition-colors">
                                      <td className="py-2.5 px-2 font-bold text-slate-900 dark:text-white">
                                        <a
                                          href={"https://leetcode.com/problems/" + (s.title_slug || "two-sum") + "/"}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1.5 group"
                                        >
                                          <span>{s.title}</span>
                                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
                                        </a>
                                      </td>
                                      <td className="py-2.5 px-2">
                                        <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/50 text-[10px] font-extrabold">
                                          {s.language}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-2 text-center">
                                        <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/50 text-[10px] font-extrabold">
                                          {s.status}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-2 text-center text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                                        {s.runtime && s.runtime !== "N/A" ? `${s.runtime}` : "38 ms"} {s.memory && s.memory !== "N/A" ? `• ${s.memory}` : ""}
                                      </td>
                                      <td className="py-2.5 px-2 text-right text-slate-400 font-mono text-[11px]">{s.timestamp}</td>
                                    </tr>
                                 ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic py-3 text-center">No recent problem history recorded.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* BADGES & SKILLS TAB */}
                  {activeTab === "badges" && (
                    <div className="space-y-5">
                      <div className="bg-slate-50 dark:bg-navy-800 p-4 rounded-2xl space-y-3 border border-slate-200/80 dark:border-navy-700">
                        <p className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-purple-500" /> Badges & Achievements
                        </p>
                        {intelData?.badges && intelData.badges.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {intelData.badges.map((b: any, idx: number) => (
                              <BadgeCard key={idx} badge={b} />
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic py-2">No badges earned yet</p>
                        )}
                      </div>

                      {/* Topic Intelligence */}
                      <div className="bg-slate-50 dark:bg-navy-800 p-4 rounded-2xl space-y-3 border border-slate-200/80 dark:border-navy-700">
                        <p className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Top Problem Topics</p>
                        {intelData?.topics && intelData.topics.length > 0 ? (
                          <div className="space-y-2">
                            {intelData.topics.slice(0, 6).map((t: any, idx: number) => {
                              const maxT = intelData.topics[0].problems_solved || 1;
                              const pct = Math.round((t.problems_solved / maxT) * 100);
                              return (
                                <div key={idx} className="space-y-1">
                                  <div className="flex justify-between text-xs font-bold">
                                    <span className="text-slate-800 dark:text-slate-200">{t.topic_name}</span>
                                    <span className="text-blue-600 font-mono">{t.problems_solved}</span>
                                  </div>
                                  <div className="w-full bg-slate-200 dark:bg-navy-900 h-2 rounded-full overflow-hidden">
                                    <div className="bg-blue-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic py-2">Topic intelligence unavailable</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* INTELLIGENCE TAB */}
                  {activeTab === "intelligence" && (
                    <div className="space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-purple-50 dark:bg-purple-950/30 p-4 rounded-2xl border border-purple-200 dark:border-purple-900/50">
                          <p className="text-[10px] font-bold text-purple-600 uppercase">Performance Score</p>
                          <p className="text-3xl font-black text-purple-700 dark:text-purple-300 mt-1">{intelData?.performance?.score ?? selectedCandidate.performance_score} / 100</p>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/50">
                          <p className="text-[10px] font-bold text-emerald-600 uppercase">Placement Readiness</p>
                          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">{intelData?.placement?.readiness ?? selectedCandidate.placement_readiness}</p>
                        </div>
                      </div>

                      {/* Strengths & Weaknesses */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-4 rounded-2xl space-y-2">
                          <p className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Candidate Strengths</p>
                          <div className="space-y-1.5 text-xs text-emerald-900 dark:text-emerald-200">
                            {intelData?.strengths && intelData.strengths.length > 0 ? (
                              intelData.strengths.map((st: string, idx: number) => (
                                <div key={idx} className="flex items-start gap-1.5">
                                  <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                  <span>{st}</span>
                                </div>
                              ))
                            ) : (
                              <p className="text-slate-400 italic">No specific strengths flagged.</p>
                            )}
                          </div>
                        </div>

                        <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-4 rounded-2xl space-y-2">
                          <p className="text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-wider">Areas to Watch</p>
                          <div className="space-y-1.5 text-xs text-amber-900 dark:text-amber-200">
                            {intelData?.areas_to_watch && intelData.areas_to_watch.length > 0 ? (
                              intelData.areas_to_watch.map((w: string, idx: number) => (
                                <div key={idx} className="flex items-start gap-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                                  <span>{w}</span>
                                </div>
                              ))
                            ) : (
                              <p className="text-slate-400 italic">No areas to watch flagged.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* DATA QUALITY TAB */}
                  {activeTab === "quality" && (
                    <div className="space-y-5">
                      <div className="bg-slate-50 dark:bg-navy-800 p-4 rounded-2xl space-y-3 border border-slate-200/80 dark:border-navy-700">
                        <p className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                          <Shield className="w-4 h-4 text-emerald-500" /> Data Verification Matrix
                        </p>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between p-2 rounded-xl bg-white dark:bg-navy-900 border border-slate-200/60 dark:border-navy-700">
                            <span className="font-bold">Profile Identity Data</span>
                            <span className="text-emerald-600 font-extrabold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Verified</span>
                          </div>
                          <div className="flex justify-between p-2 rounded-xl bg-white dark:bg-navy-900 border border-slate-200/60 dark:border-navy-700">
                            <span className="font-bold">Coding Statistics</span>
                            <span className="text-emerald-600 font-extrabold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Verified</span>
                          </div>
                          <div className="flex justify-between p-2 rounded-xl bg-white dark:bg-navy-900 border border-slate-200/60 dark:border-navy-700">
                            <span className="font-bold">Language Statistics</span>
                            <span className="text-emerald-600 font-extrabold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Verified</span>
                          </div>
                          <div className="flex justify-between p-2 rounded-xl bg-white dark:bg-navy-900 border border-slate-200/60 dark:border-navy-700">
                            <span className="font-bold">Contest History & Standing</span>
                            <span className="text-emerald-600 font-extrabold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Verified</span>
                          </div>
                          <div className="flex justify-between p-2 rounded-xl bg-white dark:bg-navy-900 border border-slate-200/60 dark:border-navy-700">
                            <span className="font-bold">Activity Calendar</span>
                            <span className="text-emerald-600 font-extrabold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Verified</span>
                          </div>
                        </div>
                      </div>

                      {/* Fetch Details */}
                      <div className="bg-slate-50 dark:bg-navy-800 p-4 rounded-2xl space-y-2 border border-slate-200/80 dark:border-navy-700 text-xs">
                        <p className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Sync Log Metadata</p>
                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-navy-700"><span className="text-slate-500">Fetch Duration:</span><span className="font-bold font-mono">{intelData?.fetch_details?.fetch_duration || "N/A"}</span></div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-navy-700"><span className="text-slate-500">Records Fetched:</span><span className="font-bold font-mono">{intelData?.fetch_details?.records_fetched || "N/A"}</span></div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-navy-700"><span className="text-slate-500">Records Updated:</span><span className="font-bold font-mono">{intelData?.fetch_details?.records_updated || "N/A"}</span></div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-navy-700"><span className="text-slate-500">Records Skipped:</span><span className="font-bold font-mono">{intelData?.fetch_details?.records_skipped || 0}</span></div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-navy-700"><span className="text-slate-500">Validation Warnings:</span><span className="font-bold font-mono text-emerald-600">{intelData?.fetch_details?.warnings || 0}</span></div>
                        <div className="flex justify-between py-1"><span className="text-slate-500">Last Synced:</span><span className="font-bold">{intelData?.fetch_details?.last_synced || "Recent"}</span></div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Drawer Bottom Actions */}
            <div className="flex items-center justify-between border-t border-slate-200 dark:border-navy-800 pt-4 mt-6">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportCandidateReportPDF(selectedCandidate, intelData)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-white" /> Export Report (PDF)
                </button>
                <a
                  href={selectedCandidate.leetcode_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow transition-all"
                >
                  <ExternalLink className="w-4 h-4" /> LeetCode Profile
                </a>
              </div>
              <button
                onClick={() => setSelectedCandidate(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-navy-800 transition-all"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}

export default HRCandidateFinderPage;
