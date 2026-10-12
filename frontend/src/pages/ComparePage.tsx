import React, { useState, useEffect, useMemo } from 'react';
import {
  Swords, Trophy, Flame, Star, Award, Zap, ChevronRight, ChevronDown, Check, User, CheckCircle2,
  Search, Filter, RefreshCw, Building2, Users, BarChart3, TrendingUp, Sparkles,
  ArrowRightLeft, GraduationCap, School, Layers
} from 'lucide-react';
import PremiumDepartmentSelect from '../components/ui/PremiumDepartmentSelect';
import { GlobalFilter } from '../components/GlobalFilter';
import api from '../services/api';
import { StudentData } from '../components/LeaderboardTable';
import { getCachedStudents } from '../utils/rosterCache';
import { useDepartments } from '../contexts/DepartmentContext';
import { deriveYearLevelFromRegNo, normalizeAcademicYear } from '../utils/filterUtils';

export const ComparePage: React.FC = () => {
  // Mode: STUDENT vs GROUP
  const [compareMode, setCompareMode] = useState<'STUDENT' | 'GROUP'>('STUDENT');

  // Group Comparison Sub-Dimension: DEPT | DEPT_YEAR | YEAR | SECTION
  const [groupDimension, setGroupDimension] = useState<'DEPT' | 'DEPT_YEAR' | 'YEAR' | 'SECTION'>('DEPT_YEAR');

  // Custom Dropdown Open States
  const [deptOpen, setDeptOpen] = useState<boolean>(false);
  const [yearOpen, setYearOpen] = useState<boolean>(false);
  const [fighterAOpen, setFighterAOpen] = useState<boolean>(false);
  const [fighterBOpen, setFighterBOpen] = useState<boolean>(false);
  const [groupAOpen, setGroupAOpen] = useState<boolean>(false);
  const [groupBOpen, setGroupBOpen] = useState<boolean>(false);
  
  const { departments } = useDepartments();
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');

  const [allStudents, setAllStudents] = useState<StudentData[]>(() => getCachedStudents());
  const [students, setStudents] = useState<StudentData[]>(() => getCachedStudents());
  const [loading, setLoading] = useState<boolean>(false);

  // Student Battle Selection
  const [studentAId, setStudentAId] = useState<number | null>(null);
  const [studentBId, setStudentBId] = useState<number | null>(null);

  const [studentA, setStudentA] = useState<StudentData | null>(null);
  const [studentB, setStudentB] = useState<StudentData | null>(null);

  // Search states for Fighter A & Fighter B dropdowns
  const [searchA, setSearchA] = useState<string>('');
  const [searchB, setSearchB] = useState<string>('');

  // Mobile Viewport Detector
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Keyboard Escape listener to close dropdowns
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDeptOpen(false);
        setYearOpen(false);
        setFighterAOpen(false);
        setFighterBOpen(false);
        setGroupAOpen(false);
        setGroupBOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch full student cohort once to ensure accurate college-wide group analytics
  useEffect(() => {
    const fetchFullCohort = async () => {
      try {
        const res = await api.get('/students');
        const list = Array.isArray(res.data) ? res.data : (res.data?.items || []);
        if (list.length > 0) {
          const sorted = [...list].sort((a: StudentData, b: StudentData) => (b.stats?.total_solved || 0) - (a.stats?.total_solved || 0));
          setAllStudents(sorted);
        }
      } catch (err) {
        console.error('Failed to fetch full student cohort:', err);
      }
    };
    fetchFullCohort();
  }, []);

  // Group Comparison Selection keys
  const [groupAKey, setGroupAKey] = useState<string>('');
  const [groupBKey, setGroupBKey] = useState<string>('');

  useEffect(() => {
    fetchStudents();
  }, [selectedDept, selectedYear]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      let url = '/students?';
      const params = [];
      if (selectedDept !== 'ALL') {
        params.push(`dept_id=${selectedDept}`);
      }
      if (selectedYear !== 'ALL') {
        params.push(`year_level=${selectedYear}`);
      }
      url += params.join('&');

      const res = await api.get(url);
      const list = Array.isArray(res.data) ? res.data : (res.data?.items || []);
      const sorted = [...list].sort((a: StudentData, b: StudentData) => (b.stats?.total_solved || 0) - (a.stats?.total_solved || 0));
      setStudents(sorted);

      if (sorted.length >= 2) {
        if (!studentAId || !sorted.some(s => s.id === studentAId)) {
          setStudentAId(sorted[0].id);
          setStudentA(sorted[0]);
        }
        if (!studentBId || !sorted.some(s => s.id === studentBId)) {
          setStudentBId(sorted[1].id);
          setStudentB(sorted[1]);
        }
      } else if (sorted.length === 1) {
        setStudentAId(sorted[0].id);
        setStudentA(sorted[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to reliably extract student canonical academic year ('I' | 'II' | 'III' | 'IV')
  const getStudentYear = (s: StudentData): 'I' | 'II' | 'III' | 'IV' => {
    return deriveYearLevelFromRegNo(s.reg_no, s.year_level || (s as any).year);
  };

  // The cohort used for group comparisons is always the full college cohort
  const cohort = useMemo(() => {
    return allStudents.length > 0 ? allStudents : students;
  }, [allStudents, students]);

  // Build unique Group options dynamically based on current dimension
  const groupOptions = useMemo(() => {
    if (groupDimension === 'DEPT') {
      return departments.map(d => {
        const count = cohort.filter(s => Number(s.department_id || s.department?.id) === Number(d.id)).length;
        return {
          key: String(d.id),
          label: `${d.name} (${d.code}) — ${count} Students`,
          pillText: d.code,
          cleanLabel: `${d.name} (${d.code})`,
          studentCount: count
        };
      }).filter(item => item.studentCount > 0);
    } else if (groupDimension === 'DEPT_YEAR') {
      // Combined Department & Year Combo
      const list: { key: string; label: string; pillText: string; cleanLabel: string; studentCount: number }[] = [];
      const yearLabels: Record<string, string> = {
        'II': '2nd Yr',
        'III': '3rd Yr',
        'IV': 'Final Yr'
      };
      const years: ('II' | 'III' | 'IV')[] = ['II', 'III', 'IV'];

      departments.forEach(d => {
        years.forEach(yr => {
          const count = cohort.filter(s => {
            const dId = s.department_id || s.department?.id;
            return Number(dId) === Number(d.id) && getStudentYear(s) === yr;
          }).length;

          if (count > 0) {
            list.push({
              key: `${d.id}_${yr}`,
              label: `${d.code} • ${yearLabels[yr]} (${count} Students)`,
              pillText: `${d.code} • ${yr}`,
              cleanLabel: `${d.code} • ${yearLabels[yr]} (${d.name})`,
              studentCount: count
            });
          }
        });
      });
      return list;
    } else if (groupDimension === 'YEAR') {
      const yearDefs: { key: 'II' | 'III' | 'IV'; label: string; pillText: string; cleanLabel: string }[] = [
        { key: 'II', label: 'II Year (Batch 2025 – 2029)', pillText: '2ND YR', cleanLabel: 'II Year (Batch 2025 – 2029)' },
        { key: 'III', label: 'III Year (Batch 2024 – 2028)', pillText: '3RD YR', cleanLabel: 'III Year (Batch 2024 – 2028)' },
        { key: 'IV', label: 'IV Year (Batch 2023 – 2027)', pillText: '4TH YR', cleanLabel: 'IV Year (Batch 2023 – 2027)' },
      ];
      return yearDefs.map(y => {
        const count = cohort.filter(s => getStudentYear(s) === y.key).length;
        return {
          ...y,
          label: `${y.cleanLabel} — ${count} Students`,
          studentCount: count
        };
      }).filter(y => y.studentCount > 0);
    } else {
      // SECTION
      const secMap = new Map<string, { label: string; pillText: string; cleanLabel: string; studentCount: number }>();
      cohort.forEach(s => {
        const dId = s.department_id || s.department?.id || 1;
        const dCode = s.department?.code || 'DEPT';
        const dName = s.department?.name || dCode;
        const yr = getStudentYear(s);
        const secName = (s.section?.name || 'A').toUpperCase().trim();
        const key = `${dId}_${yr}_${secName}`;
        const existing = secMap.get(key);
        if (existing) {
          existing.studentCount += 1;
        } else {
          secMap.set(key, {
            label: `${dCode} - ${yr} Year (${secName})`,
            pillText: `${dCode} • Sec ${secName}`,
            cleanLabel: `${dCode} • ${yr} Year • Sec ${secName} (${dName})`,
            studentCount: 1
          });
        }
      });
      return Array.from(secMap.entries()).map(([key, item]) => ({
        key,
        ...item,
        label: `${item.label} — ${item.studentCount} Students`
      }));
    }
  }, [groupDimension, departments, cohort]);

  // Default Group A and Group B selection when options or dimension changes
  useEffect(() => {
    if (!groupOptions || groupOptions.length === 0) return;

    const hasA = groupOptions.some(g => g.key === groupAKey);
    const hasB = groupOptions.some(g => g.key === groupBKey);

    if (!hasA || !hasB || groupAKey === groupBKey) {
      if (groupOptions.length >= 2) {
        setGroupAKey(groupOptions[0].key);
        setGroupBKey(groupOptions[1].key);
      } else if (groupOptions.length === 1) {
        setGroupAKey(groupOptions[0].key);
        setGroupBKey(groupOptions[0].key);
      }
    }
  }, [groupDimension, groupOptions]);

  const handleDimensionChange = (dim: 'DEPT' | 'DEPT_YEAR' | 'YEAR' | 'SECTION') => {
    setGroupDimension(dim);
  };

  // Filtered lists for Student Search
  const filteredStudentsA = useMemo(() => {
    if (!searchA.trim()) return students;
    const q = searchA.toLowerCase().trim();
    return students.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.reg_no || '').toLowerCase().includes(q) ||
      (s.username || '').toLowerCase().includes(q) ||
      (s.department?.code || '').toLowerCase().includes(q) ||
      (s.department?.name || '').toLowerCase().includes(q)
    );
  }, [students, searchA]);

  const filteredStudentsB = useMemo(() => {
    if (!searchB.trim()) return students;
    const q = searchB.toLowerCase().trim();
    return students.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.reg_no || '').toLowerCase().includes(q) ||
      (s.username || '').toLowerCase().includes(q) ||
      (s.department?.code || '').toLowerCase().includes(q) ||
      (s.department?.name || '').toLowerCase().includes(q)
    );
  }, [students, searchB]);

  const handleSelectA = (id: number) => {
    setStudentAId(id);
    const found = students.find(s => s.id === id) || null;
    setStudentA(found);
  };

  const handleSelectB = (id: number) => {
    setStudentBId(id);
    const found = students.find(s => s.id === id) || null;
    setStudentB(found);
  };

  const getWinner = () => {
    if (!studentA || !studentB) return null;
    const solvedA = studentA.stats?.total_solved || 0;
    const solvedB = studentB.stats?.total_solved || 0;
    if (solvedA > solvedB) return { winner: 'A', margin: solvedA - solvedB };
    if (solvedB > solvedA) return { winner: 'B', margin: solvedB - solvedA };
    return { winner: 'TIE', margin: 0 };
  };

  const battleResult = getWinner();
  const roundOne = (num: number) => Math.round(num * 10) / 10;

  // Calculate stats for any Group (Dept, Dept+Year Combo, Year, Section)
  const getGroupMetrics = (key: string) => {
    if (!key) return null;
    let groupStudents: StudentData[] = [];

    if (groupDimension === 'DEPT') {
      const dId = Number(key);
      groupStudents = cohort.filter(s => Number(s.department_id || s.department?.id) === dId);
    } else if (groupDimension === 'DEPT_YEAR') {
      const [dIdStr, yr] = key.split('_');
      const dId = Number(dIdStr);
      groupStudents = cohort.filter(s => Number(s.department_id || s.department?.id) === dId && getStudentYear(s) === yr);
    } else if (groupDimension === 'YEAR') {
      groupStudents = cohort.filter(s => getStudentYear(s) === key);
    } else {
      // SECTION
      const [dIdStr, yr, secName] = key.split('_');
      const dId = Number(dIdStr);
      groupStudents = cohort.filter(s =>
        Number(s.department_id || s.department?.id) === dId &&
        getStudentYear(s) === yr &&
        (s.section?.name || 'A').toUpperCase().trim() === (secName || 'A').toUpperCase().trim()
      );
    }

    const total_students = groupStudents.length;
    if (total_students === 0) return null;

    const total_solved = groupStudents.reduce((acc, s) => acc + (s.stats?.total_solved || 0), 0);
    const avg_solved = roundOne(total_solved / total_students);

    const active_students = groupStudents.filter(s => (s.weekly_progress || 0) > 0 || (s.stats?.total_solved || 0) > 0).length;
    const participation_rate = roundOne((active_students / total_students) * 100);

    const top_students = [...groupStudents]
      .sort((a, b) => (b.stats?.total_solved || 0) - (a.stats?.total_solved || 0))
      .slice(0, 5);

    const top_student_name = top_students.length > 0 ? top_students[0].name : 'N/A';
    const labelObj = groupOptions.find(g => g.key === key);

    return {
      key,
      label: labelObj ? (labelObj.cleanLabel || labelObj.label) : key,
      total_students,
      total_solved,
      avg_solved,
      active_students,
      participation_rate,
      top_students,
      top_student_name
    };
  };

  const groupAData = getGroupMetrics(groupAKey);
  const groupBData = getGroupMetrics(groupBKey);

  const getGroupWinner = () => {
    if (!groupAData || !groupBData) return null;
    if (groupAData.avg_solved > groupBData.avg_solved) return { winner: 'A', margin: roundOne(groupAData.avg_solved - groupBData.avg_solved) };
    if (groupBData.avg_solved > groupAData.avg_solved) return { winner: 'B', margin: roundOne(groupBData.avg_solved - groupAData.avg_solved) };
    return { winner: 'TIE', margin: 0 };
  };

  const groupWinner = getGroupWinner();

  return (
    <div className="space-y-8 py-2">
      
      {/* Header Banner — Ultra-Modern Comparison Arena */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c1222] via-[#090d1a] to-[#05070e] text-white p-5 sm:p-7 md:p-8 shadow-2xl border border-indigo-500/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-gradient-to-br from-indigo-500/20 via-brand-500/15 to-transparent blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/15 border border-brand-400/30 text-brand-300 text-[11px] font-black uppercase tracking-wider shadow-sm">
                <Swords className="w-3.5 h-3.5 text-brand-400" />
                <span>Comparison Arena</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] text-slate-200 text-[11px] font-semibold border border-white/10">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{compareMode === 'STUDENT' ? 'Student Head-to-Head' : 'Cohort & Batch Telemetry'}</span>
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-display font-black tracking-tight text-white uppercase">
              {compareMode === 'STUDENT' ? (
                <>STUDENT <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-indigo-300 to-purple-400">VERSUS ARENA</span></>
              ) : (
                <>GROUP & BATCH <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-indigo-300 to-purple-400">ANALYTICS</span></>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium max-w-2xl">
              Side-by-side metric comparison, difficulty distribution, contest ratings, and weekly consistency streaks.
            </p>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="flex items-center p-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shrink-0 self-start md:self-center shadow-lg">
            <button
              onClick={() => setCompareMode('STUDENT')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                compareMode === 'STUDENT'
                  ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-900/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Student vs Student</span>
            </button>

            <button
              onClick={() => setCompareMode('GROUP')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                compareMode === 'GROUP'
                  ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-900/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Group & Batch</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mode 1: STUDENT VS STUDENT */}
      {compareMode === 'STUDENT' && (
        <div className="space-y-6">
          {/* Filter Controls Bar */}
          <div className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4 relative ${deptOpen || yearOpen ? 'z-50' : 'z-10'}`}>
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100 dark:border-navy-800">
              <h3 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white flex items-center space-x-2 uppercase tracking-wide">
                <Filter className="w-4 h-4 text-brand-500" />
                <span>Scope: Cohort Filter</span>
              </h3>
              <span className="text-[11px] font-bold text-slate-500 font-mono">
                {students.length} Candidates Available
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              
              {/* Department Filter — Premium Custom Dropdown */}
              <div className="z-20">
                <PremiumDepartmentSelect 
                  selectedDept={selectedDept}
                  onChange={setSelectedDept}
                  label="Select Department"
                />
              </div>

              {/* Year Filter — Premium Custom Dropdown */}
              <div>
                <label className="block text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Academic Year Level</label>
                <div className={`relative ${yearOpen ? 'z-30' : 'z-10'}`}>
                  <button
                    type="button"
                    onClick={() => { setYearOpen(p => !p); setDeptOpen(false); setFighterAOpen(false); setFighterBOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white dark:bg-navy-900 border text-left transition-all focus:outline-none shadow-xs ${
                      yearOpen ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200 dark:border-navy-700 hover:border-brand-400'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4 text-brand-500 shrink-0" />
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 text-brand-600 bg-brand-50 dark:bg-brand-950 dark:text-brand-300">
                      {selectedYear}
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate flex-1">
                      {selectedYear === 'ALL' ? 'All Academic Years' : selectedYear === '2' ? 'II Year (Batch 2025 - 2029)' : selectedYear === '3' ? 'III Year (Batch 2024 - 2028)' : 'IV Year (Batch 2023 - 2027)'}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${yearOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {yearOpen && (
                    <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                      {[
                        { value: 'ALL', code: 'ALL', label: 'All Academic Years' },
                        { value: '2',  code: 'II',  label: 'II Year (Batch 2025 - 2029)' },
                        { value: '3', code: 'III', label: 'III Year (Batch 2024 - 2028)' },
                        { value: '4',  code: 'IV',  label: 'IV Year (Batch 2023 - 2027)' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { setSelectedYear(opt.value); setYearOpen(false); }}
                          className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                            selectedYear === opt.value ? 'bg-brand-50 dark:bg-brand-950/60' : 'hover:bg-slate-50 dark:hover:bg-navy-900'
                          }`}
                        >
                          <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 text-brand-600 bg-brand-50 dark:bg-brand-950 dark:text-brand-300">{opt.code}</span>
                          <span className={`text-xs truncate flex-1 ${selectedYear === opt.value ? 'font-black text-brand-700 dark:text-brand-300' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>{opt.label}</span>
                          {selectedYear === opt.value && <Check className="w-3.5 h-3.5 text-brand-500 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Student Selectors (With Search Box for Fighter A & Fighter B) */}
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 relative ${fighterAOpen || fighterBOpen ? 'z-40' : 'z-10'}`}>
            
            {/* Select Student A */}
            <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-brand-500/40 bg-gradient-to-br from-brand-50/40 via-white to-indigo-50/30 dark:from-navy-950 dark:via-navy-900/60 dark:to-indigo-950/30 space-y-3 shadow-lg">
              <div className="flex items-center justify-between text-xs font-black text-brand-600 dark:text-brand-400 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                  Select Fighter 1 (Student A)
                </span>
                <span className="bg-brand-500/20 text-brand-600 dark:text-brand-300 px-2.5 py-0.5 rounded-full border border-brand-500/30 font-black text-[10px]">
                  FIGHTER A
                </span>
              </div>

              {/* Search Box Input */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Student A by Name, Reg No..."
                  value={searchA}
                  onChange={(e) => setSearchA(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs font-bold bg-white dark:bg-navy-950 text-slate-900 dark:text-white border-brand-300 dark:border-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none shadow-xs transition"
                />
              </div>

              {/* Custom Dropdown Fighter A */}
              <div className={`relative ${fighterAOpen ? 'z-30' : 'z-10'}`}>
                <button
                  type="button"
                  onClick={() => { setFighterAOpen(p => !p); setFighterBOpen(false); setDeptOpen(false); setYearOpen(false); }}
                  className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-white dark:bg-navy-900 border text-left transition-all focus:outline-none shadow-xs cursor-pointer ${
                    fighterAOpen ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200 dark:border-navy-700 hover:border-brand-400'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <User className="w-4 h-4 text-brand-500 shrink-0" />
                    {studentA ? (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0 truncate">
                          <span className="px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-300 font-mono font-black text-[10px] shrink-0">
                            #{studentA.college_rank || '—'}
                          </span>
                          <span className="text-xs font-black text-slate-900 dark:text-white truncate">{studentA.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">({studentA.reg_no})</span>
                        </div>
                        <div className="shrink-0 self-start sm:self-auto">
                          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                            {studentA.stats?.total_solved || 0} Solved
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs font-extrabold text-slate-400">Select Fighter A</span>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${fighterAOpen ? 'rotate-180' : ''}`} />
                </button>

                {fighterAOpen && (
                  <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-white dark:bg-navy-950 border border-brand-200 dark:border-navy-700 rounded-xl shadow-xl max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-navy-800">
                    {filteredStudentsA.length === 0 ? (
                      <div className="p-4 text-center text-xs font-bold text-slate-400">No matching student found</div>
                    ) : (
                      filteredStudentsA.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleSelectA(Number(s.id)); setFighterAOpen(false); }}
                          className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                            studentAId === s.id ? 'bg-brand-50/70 dark:bg-brand-950/60' : 'hover:bg-slate-50 dark:hover:bg-navy-900'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-300 font-mono font-black text-[10px] shrink-0">
                              #{s.college_rank || '—'}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className={`text-xs truncate ${studentAId === s.id ? 'font-black text-brand-700 dark:text-brand-300' : 'font-bold text-slate-900 dark:text-white'}`}>
                                {s.name}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono truncate">
                                {s.reg_no} • {s.department?.code || 'DEPT'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              {s.stats?.total_solved || 0} Solved
                            </span>
                            {studentAId === s.id && <Check className="w-3.5 h-3.5 text-brand-500 shrink-0" />}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Quick Select Preset Buttons */}
              <div className="flex items-center gap-1.5 pt-1 overflow-x-auto custom-scrollbar max-w-full pb-0.5">
                <span className="text-[10px] text-slate-400 font-bold shrink-0">Quick Select:</span>
                {students.slice(0, 3).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectA(Number(s.id))}
                    className="px-2.5 py-1 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-black border border-brand-500/20 hover:bg-brand-500 hover:text-white transition-all cursor-pointer flex items-center space-x-1 whitespace-nowrap shrink-0"
                  >
                    <span>{s.name} (#{s.college_rank || '—'})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Select Student B */}
            <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-indigo-500/40 bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/30 dark:from-navy-950 dark:via-navy-900/60 dark:to-purple-950/30 space-y-3 shadow-lg">
              <div className="flex items-center justify-between text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  Select Fighter 2 (Student B)
                </span>
                <span className="bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-500/30 font-black text-[10px]">
                  FIGHTER B
                </span>
              </div>

              {/* Search Box Input */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Student B by Name, Reg No..."
                  value={searchB}
                  onChange={(e) => setSearchB(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs font-bold bg-white dark:bg-navy-950 text-slate-900 dark:text-white border-indigo-300 dark:border-navy-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none shadow-xs transition"
                />
              </div>

              {/* Custom Dropdown Fighter B */}
              <div className={`relative ${fighterBOpen ? 'z-30' : 'z-10'}`}>
                <button
                  type="button"
                  onClick={() => { setFighterBOpen(p => !p); setFighterAOpen(false); setDeptOpen(false); setYearOpen(false); }}
                  className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-white dark:bg-navy-900 border text-left transition-all focus:outline-none shadow-xs cursor-pointer ${
                    fighterBOpen ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-navy-700 hover:border-indigo-400'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <User className="w-4 h-4 text-indigo-500 shrink-0" />
                    {studentB ? (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0 truncate">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-mono font-black text-[10px] shrink-0">
                            #{studentB.college_rank || '—'}
                          </span>
                          <span className="text-xs font-black text-slate-900 dark:text-white truncate">{studentB.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">({studentB.reg_no})</span>
                        </div>
                        <div className="shrink-0 self-start sm:self-auto">
                          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                            {studentB.stats?.total_solved || 0} Solved
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs font-extrabold text-slate-400">Select Fighter B</span>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${fighterBOpen ? 'rotate-180' : ''}`} />
                </button>

                {fighterBOpen && (
                  <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-white dark:bg-navy-950 border border-indigo-200 dark:border-navy-700 rounded-xl shadow-xl max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-navy-800">
                    {filteredStudentsB.length === 0 ? (
                      <div className="p-4 text-center text-xs font-bold text-slate-400">No matching student found</div>
                    ) : (
                      filteredStudentsB.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleSelectB(Number(s.id)); setFighterBOpen(false); }}
                          className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                            studentBId === s.id ? 'bg-indigo-50/70 dark:bg-indigo-950/60' : 'hover:bg-slate-50 dark:hover:bg-navy-900'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-mono font-black text-[10px] shrink-0">
                              #{s.college_rank || '—'}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className={`text-xs truncate ${studentBId === s.id ? 'font-black text-indigo-700 dark:text-indigo-300' : 'font-bold text-slate-900 dark:text-white'}`}>
                                {s.name}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono truncate">
                                {s.reg_no} • {s.department?.code || 'DEPT'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              {s.stats?.total_solved || 0} Solved
                            </span>
                            {studentBId === s.id && <Check className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Quick Select Preset Buttons */}
              <div className="flex items-center gap-1.5 pt-1 overflow-x-auto custom-scrollbar max-w-full pb-0.5">
                <span className="text-[10px] text-slate-400 font-bold shrink-0">Quick Select:</span>
                {students.slice(1, 4).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectB(Number(s.id))}
                    className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black border border-indigo-500/20 hover:bg-indigo-500 hover:text-white transition-all cursor-pointer flex items-center space-x-1 whitespace-nowrap shrink-0"
                  >
                    <span>{s.name} (#{s.college_rank || '—'})</span>
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Head-to-Head Visual Battle Cards */}
          {studentA && studentB ? (
            <div className="space-y-8">
              
              {/* Winner Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-400/15 to-amber-500/10 border border-amber-500/30 text-center space-y-1 shadow-sm">
                <div className="flex items-center justify-center space-x-2 text-amber-600 dark:text-amber-400 font-extrabold text-sm tracking-wide">
                  <Trophy className="w-5 h-5 text-amber-500 fill-amber-500" />
                  <span>
                    {battleResult?.winner === 'A'
                      ? `${studentA.name} leads the matchup (+${battleResult.margin} Solved)`
                      : battleResult?.winner === 'B'
                      ? `${studentB.name} leads the matchup (+${battleResult.margin} Solved)`
                      : 'Equal Total Solved Count'}
                  </span>
                </div>
              </div>

              {/* Cards Comparison Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 lg:gap-6 items-center relative">
                
                {/* Background ambient glow behind VS */}
                <div className="hidden lg:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-500/10 blur-[100px] rounded-full pointer-events-none z-0" />

                {/* Student A Card (3 cols) */}
                <div className={`lg:col-span-3 relative z-10 p-1 rounded-3xl transition-all duration-500 ${
                  battleResult?.winner === 'A'
                    ? 'bg-gradient-to-b from-amber-400 via-amber-600 to-amber-900 shadow-[0_0_40px_-10px_rgba(251,191,36,0.3)]'
                    : 'bg-gradient-to-b from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800'
                }`}>
                  <div className="h-full bg-white dark:bg-[#0f111a] rounded-[22px] p-6 lg:p-8 flex flex-col justify-between space-y-8 relative overflow-hidden group">
                    {/* Inner glowing orb */}
                    {battleResult?.winner === 'A' && (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[200px] bg-amber-500/20 blur-[50px] rounded-full pointer-events-none" />
                    )}
                    
                    <div className="flex items-center justify-between relative z-10">
                      <span className={`px-4 py-1.5 rounded-full text-xs font-black shadow-sm tracking-wide ${battleResult?.winner === 'A' ? 'bg-amber-500 text-white shadow-amber-500/30' : 'bg-brand-600 text-white'}`}>
                        Rank #{studentA.college_rank || '—'}
                      </span>
                      <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-mono font-bold text-xs border border-slate-200 dark:border-white/10 backdrop-blur-md">
                        {studentA.department?.code} • {studentA.year_level} Year
                      </span>
                    </div>

                    <div className="text-center space-y-4 relative z-10">
                      <div className="relative w-28 h-28 mx-auto">
                        <div className={`absolute inset-0 rounded-full blur-md opacity-60 group-hover:opacity-100 transition-opacity duration-500 ${battleResult?.winner === 'A' ? 'bg-gradient-to-tr from-amber-400 to-orange-600 animate-pulse' : 'bg-gradient-to-tr from-brand-400 to-indigo-600'}`} />
                        <div className={`relative w-full h-full rounded-full text-white font-black text-4xl flex items-center justify-center shadow-xl border-4 ${battleResult?.winner === 'A' ? 'bg-gradient-to-tr from-amber-500 to-orange-500 border-amber-200 dark:border-amber-900' : 'bg-gradient-to-tr from-brand-600 to-indigo-600 border-white dark:border-navy-800'}`}>
                          {studentA.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                      </div>
                      <div>
                        <h3 className="font-black text-xl text-slate-900 dark:text-white truncate max-w-[280px] mx-auto tracking-tight">
                          {studentA.name}
                        </h3>
                        <p className="text-xs text-brand-600 dark:text-brand-400 font-mono font-bold mt-1">
                          {studentA.reg_no}
                        </p>
                      </div>
                      {studentA.username && (
                        <a
                          href={`https://leetcode.com/u/${studentA.username}/`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center space-x-1.5 text-xs text-slate-500 hover:text-brand-500 transition-colors font-mono font-semibold bg-slate-50 dark:bg-white/5 px-3 py-1 rounded-full border border-slate-200 dark:border-white/10"
                        >
                          <span>@{studentA.username}</span>
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        </a>
                      )}
                    </div>

                    <div className="relative z-10">
                      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 text-center relative overflow-hidden group-hover:border-brand-500/30 transition-colors">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-emerald-600 opacity-80" />
                        <p className="text-xs text-slate-500 font-extrabold uppercase tracking-widest mt-1">Total Problems Solved</p>
                        <h4 className="text-4xl font-black text-slate-900 dark:text-white mt-2 tracking-tight">
                          {studentA.stats?.total_solved || 0}
                        </h4>
                      </div>
                    </div>

                    {/* Difficulty Stats Breakdown */}
                    <div className="grid grid-cols-3 gap-3 text-center text-xs relative z-10">
                      <div className="p-3 rounded-xl bg-white dark:bg-[#151822] border border-slate-200 dark:border-white/5 shadow-sm">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Easy</p>
                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{studentA.stats?.easy_solved || 0}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white dark:bg-[#151822] border border-slate-200 dark:border-white/5 shadow-sm">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Medium</p>
                        <p className="text-lg font-black text-amber-500">{studentA.stats?.medium_solved || 0}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white dark:bg-[#151822] border border-slate-200 dark:border-white/5 shadow-sm">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Hard</p>
                        <p className="text-lg font-black text-rose-500">{studentA.stats?.hard_solved || 0}</p>
                      </div>
                    </div>

                    {/* Extended Metrics: Contest Rating & Active Streak */}
                    <div className="grid grid-cols-2 gap-3 text-center text-xs relative z-10">
                      <div className="p-3 rounded-xl bg-white dark:bg-[#151822] border border-slate-200 dark:border-white/5 shadow-sm flex flex-col justify-center">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Contest Rating</p>
                        <p className="text-base font-black mt-1 text-indigo-600 dark:text-indigo-400 flex justify-center items-center gap-1">
                           <Star className="w-3.5 h-3.5 fill-indigo-500/20" />
                           {studentA.stats?.contest_rating && Math.round(studentA.stats.contest_rating) !== 1500 ? Math.round(studentA.stats.contest_rating) : 'Unrated'}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-white dark:bg-[#151822] border border-slate-200 dark:border-white/5 shadow-sm flex flex-col justify-center">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Weekly Progress</p>
                        <p className="text-base font-black mt-1 text-purple-600 dark:text-purple-400 flex justify-center items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5" />
                          +{studentA.weekly_progress || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* VS Center Emblem (1 col) */}
                <div className="lg:col-span-1 flex flex-col items-center justify-center space-y-3 py-6 lg:py-0 relative z-20">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-500 via-purple-500 to-indigo-500 rounded-full blur-xl opacity-50 group-hover:opacity-100 transition-opacity animate-pulse" />
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#0a0c10] border-4 border-slate-800 flex items-center justify-center shadow-2xl relative">
                       <span className="bg-gradient-to-br from-brand-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent font-black text-2xl sm:text-3xl italic tracking-tighter">
                         VS
                       </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-px bg-slate-300 dark:bg-slate-700" />
                    <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-[0.2em]">Matchup</span>
                    <div className="w-8 h-px bg-slate-300 dark:bg-slate-700" />
                  </div>
                </div>

                {/* Student B Card (3 cols) */}
                <div className={`lg:col-span-3 relative z-10 p-1 rounded-3xl transition-all duration-500 ${
                  battleResult?.winner === 'B'
                    ? 'bg-gradient-to-b from-amber-400 via-amber-600 to-amber-900 shadow-[0_0_40px_-10px_rgba(251,191,36,0.3)]'
                    : 'bg-gradient-to-b from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800'
                }`}>
                  <div className="h-full bg-white dark:bg-[#0f111a] rounded-[22px] p-6 lg:p-8 flex flex-col justify-between space-y-8 relative overflow-hidden group">
                    {/* Inner glowing orb */}
                    {battleResult?.winner === 'B' && (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[200px] bg-amber-500/20 blur-[50px] rounded-full pointer-events-none" />
                    )}
                    
                    <div className="flex items-center justify-between relative z-10">
                      <span className={`px-4 py-1.5 rounded-full text-xs font-black shadow-sm tracking-wide ${battleResult?.winner === 'B' ? 'bg-amber-500 text-white shadow-amber-500/30' : 'bg-indigo-600 text-white'}`}>
                        Rank #{studentB.college_rank || '—'}
                      </span>
                      <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-mono font-bold text-xs border border-slate-200 dark:border-white/10 backdrop-blur-md">
                        {studentB.department?.code} • {studentB.year_level} Year
                      </span>
                    </div>

                    <div className="text-center space-y-4 relative z-10">
                      <div className="relative w-28 h-28 mx-auto">
                        <div className={`absolute inset-0 rounded-full blur-md opacity-60 group-hover:opacity-100 transition-opacity duration-500 ${battleResult?.winner === 'B' ? 'bg-gradient-to-tr from-amber-400 to-orange-600 animate-pulse' : 'bg-gradient-to-tr from-indigo-400 to-purple-600'}`} />
                        <div className={`relative w-full h-full rounded-full text-white font-black text-4xl flex items-center justify-center shadow-xl border-4 ${battleResult?.winner === 'B' ? 'bg-gradient-to-tr from-amber-500 to-orange-500 border-amber-200 dark:border-amber-900' : 'bg-gradient-to-tr from-indigo-600 to-purple-600 border-white dark:border-navy-800'}`}>
                          {studentB.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                      </div>
                      <div>
                        <h3 className="font-black text-xl text-slate-900 dark:text-white truncate max-w-[280px] mx-auto tracking-tight">
                          {studentB.name}
                        </h3>
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 font-mono font-bold mt-1">
                          {studentB.reg_no}
                        </p>
                      </div>
                      {studentB.username && (
                        <a
                          href={`https://leetcode.com/u/${studentB.username}/`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center space-x-1.5 text-xs text-slate-500 hover:text-indigo-500 transition-colors font-mono font-semibold bg-slate-50 dark:bg-white/5 px-3 py-1 rounded-full border border-slate-200 dark:border-white/10"
                        >
                          <span>@{studentB.username}</span>
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        </a>
                      )}
                    </div>

                    <div className="relative z-10">
                      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 text-center relative overflow-hidden group-hover:border-indigo-500/30 transition-colors">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-emerald-600 opacity-80" />
                        <p className="text-xs text-slate-500 font-extrabold uppercase tracking-widest mt-1">Total Problems Solved</p>
                        <h4 className="text-4xl font-black text-slate-900 dark:text-white mt-2 tracking-tight">
                          {studentB.stats?.total_solved || 0}
                        </h4>
                      </div>
                    </div>

                    {/* Difficulty Stats Breakdown */}
                    <div className="grid grid-cols-3 gap-3 text-center text-xs relative z-10">
                      <div className="p-3 rounded-xl bg-white dark:bg-[#151822] border border-slate-200 dark:border-white/5 shadow-sm">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Easy</p>
                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{studentB.stats?.easy_solved || 0}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white dark:bg-[#151822] border border-slate-200 dark:border-white/5 shadow-sm">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Medium</p>
                        <p className="text-lg font-black text-amber-500">{studentB.stats?.medium_solved || 0}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white dark:bg-[#151822] border border-slate-200 dark:border-white/5 shadow-sm">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Hard</p>
                        <p className="text-lg font-black text-rose-500">{studentB.stats?.hard_solved || 0}</p>
                      </div>
                    </div>

                    {/* Extended Metrics: Contest Rating & Active Streak */}
                    <div className="grid grid-cols-2 gap-3 text-center text-xs relative z-10">
                      <div className="p-3 rounded-xl bg-white dark:bg-[#151822] border border-slate-200 dark:border-white/5 shadow-sm flex flex-col justify-center">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Contest Rating</p>
                        <p className="text-base font-black mt-1 text-indigo-600 dark:text-indigo-400 flex justify-center items-center gap-1">
                           <Star className="w-3.5 h-3.5 fill-indigo-500/20" />
                           {studentB.stats?.contest_rating && Math.round(studentB.stats.contest_rating) !== 1500 ? Math.round(studentB.stats.contest_rating) : 'Unrated'}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-white dark:bg-[#151822] border border-slate-200 dark:border-white/5 shadow-sm flex flex-col justify-center">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Weekly Progress</p>
                        <p className="text-base font-black mt-1 text-purple-600 dark:text-purple-400 flex justify-center items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5" />
                          +{studentB.weekly_progress || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Side-by-Side Metric Comparison Bars */}
              <div className="glass-card p-6 rounded-3xl border space-y-5 shadow-xl">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  <span>Head-to-Head Metric Distribution</span>
                </h3>

                <div className="space-y-4 text-xs font-bold">
                  
                  {/* Total Solved Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span>{studentA.name} ({studentA.stats?.total_solved || 0})</span>
                      <span className="uppercase text-slate-400 font-extrabold text-[10px]">Total Solved</span>
                      <span>{studentB.name} ({studentB.stats?.total_solved || 0})</span>
                    </div>
                    <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <div
                        style={{ width: `${((studentA.stats?.total_solved || 0) / Math.max((studentA.stats?.total_solved || 0) + (studentB.stats?.total_solved || 0), 1)) * 100}%` }}
                        className="bg-brand-500"
                      ></div>
                      <div
                        style={{ width: `${((studentB.stats?.total_solved || 0) / Math.max((studentA.stats?.total_solved || 0) + (studentB.stats?.total_solved || 0), 1)) * 100}%` }}
                        className="bg-indigo-500"
                      ></div>
                    </div>
                  </div>

                  {/* Contest Rating Bar */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span>Rating: {studentA.stats?.contest_rating && Math.round(studentA.stats.contest_rating) !== 1500 ? Math.round(studentA.stats.contest_rating) : 'Unrated'}</span>
                      <span className="uppercase text-indigo-500 font-extrabold text-[10px]">Contest Rating</span>
                      <span>Rating: {studentB.stats?.contest_rating && Math.round(studentB.stats.contest_rating) !== 1500 ? Math.round(studentB.stats.contest_rating) : 'Unrated'}</span>
                    </div>
                    <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <div
                        style={{ width: `${((studentA.stats?.contest_rating || 0) / Math.max((studentA.stats?.contest_rating || 0) + (studentB.stats?.contest_rating || 0), 1)) * 100}%` }}
                        className="bg-amber-500"
                      ></div>
                      <div
                        style={{ width: `${((studentB.stats?.contest_rating || 0) / Math.max((studentA.stats?.contest_rating || 0) + (studentB.stats?.contest_rating || 0), 1)) * 100}%` }}
                        className="bg-purple-500"
                      ></div>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          ) : null}

        </div>
      )}

      {/* MULTI-LEVEL GROUP COMPARISON MODE (DEPT + YEAR COMBO, DEPT, YEAR & SECTION) */}
      {compareMode === 'GROUP' && (
        <div className="space-y-8">

          {/* Group Dimension & Selector Bar */}
          <div className={`glass-card p-6 rounded-3xl border space-y-6 shadow-xl relative ${groupAOpen || groupBOpen ? 'z-50' : 'z-10'}`}>
            
            {/* Dimension Sub-Tabs (Department & Year Combo vs Department vs Year Level vs Section) */}
            <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center space-x-2">
                  <Building2 className="w-5 h-5 text-brand-500" />
                  <span>Choose Group Comparison Dimension</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Compare aggregate metrics across Departments, Academic Years, Batches, and Cohort Sections.</p>
              </div>

              {/* Sub-Dimension Tabs */}
              <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-navy-950 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex-wrap">
                
                <button
                  type="button"
                  onClick={() => handleDimensionChange('DEPT_YEAR')}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    groupDimension === 'DEPT_YEAR'
                      ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-500/25 ring-1 ring-brand-400/40'
                      : 'text-slate-600 dark:text-slate-300 hover:text-brand-500 hover:bg-slate-200/50 dark:hover:bg-white/5'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>By Dept & Year Batch</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDimensionChange('DEPT')}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    groupDimension === 'DEPT'
                      ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-500/25 ring-1 ring-brand-400/40'
                      : 'text-slate-600 dark:text-slate-300 hover:text-brand-500 hover:bg-slate-200/50 dark:hover:bg-white/5'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>By Dept (All Years)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDimensionChange('YEAR')}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    groupDimension === 'YEAR'
                      ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-500/25 ring-1 ring-brand-400/40'
                      : 'text-slate-600 dark:text-slate-300 hover:text-brand-500 hover:bg-slate-200/50 dark:hover:bg-white/5'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>By Academic Year</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDimensionChange('SECTION')}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    groupDimension === 'SECTION'
                      ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-500/25 ring-1 ring-brand-400/40'
                      : 'text-slate-600 dark:text-slate-300 hover:text-brand-500 hover:bg-slate-200/50 dark:hover:bg-white/5'
                  }`}
                >
                  <School className="w-3.5 h-3.5" />
                  <span>By Section</span>
                </button>
              </div>
            </div>

            {/* Select Group A vs Group B Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* Group A Selector — Premium Institutional GlobalFilter */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-black text-brand-600 dark:text-brand-400 uppercase tracking-wide">
                  Select {groupDimension === 'DEPT_YEAR' ? 'Dept & Year Batch' : groupDimension === 'DEPT' ? 'Department' : groupDimension === 'YEAR' ? 'Academic Year' : 'Section'} A
                </label>
                <GlobalFilter
                  value={groupAKey}
                  onChange={(val) => setGroupAKey(val)}
                  dropdownWidth="min-w-[440px]"
                  searchPlaceholder={`Search ${groupDimension === 'DEPT_YEAR' ? 'Dept & Year' : 'Group A'}...`}
                  options={groupOptions.map(g => ({
                    value: g.key,
                    label: g.cleanLabel || g.label,
                    pillText: g.pillText || 'GRP'
                  }))}
                  icon={<Building2 className="w-4 h-4 text-brand-500" />}
                />

                {groupDimension === 'DEPT_YEAR' && (
                  <div className="flex items-center space-x-2 pt-1 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-bold">Quick Pick:</span>
                    {groupOptions.slice(0, 3).map(opt => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setGroupAKey(opt.key)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          groupAKey === opt.key
                            ? 'bg-brand-500 text-white shadow-xs'
                            : 'bg-brand-500/10 text-brand-600 dark:text-brand-300 hover:bg-brand-500 hover:text-white'
                        }`}
                      >
                        {opt.pillText}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Group B Selector — Premium Institutional GlobalFilter */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                  Select {groupDimension === 'DEPT_YEAR' ? 'Dept & Year Batch' : groupDimension === 'DEPT' ? 'Department' : groupDimension === 'YEAR' ? 'Academic Year' : 'Section'} B
                </label>
                <GlobalFilter
                  value={groupBKey}
                  onChange={(val) => setGroupBKey(val)}
                  dropdownWidth="min-w-[440px]"
                  searchPlaceholder={`Search ${groupDimension === 'DEPT_YEAR' ? 'Dept & Year' : 'Group B'}...`}
                  options={groupOptions.map(g => ({
                    value: g.key,
                    label: g.cleanLabel || g.label,
                    pillText: g.pillText || 'GRP'
                  }))}
                  icon={<Building2 className="w-4 h-4 text-indigo-500" />}
                />

                {groupDimension === 'DEPT_YEAR' && (
                  <div className="flex items-center space-x-2 pt-1 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-bold">Quick Pick:</span>
                    {groupOptions.slice(1, 4).map(opt => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setGroupBKey(opt.key)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          groupBKey === opt.key
                            ? 'bg-indigo-500 text-white shadow-xs'
                            : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500 hover:text-white'
                        }`}
                      >
                        {opt.pillText}
                      </button>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Group Victory Banner & Cards */}
          {groupAData && groupBData ? (
            <div className="space-y-8">
              
              <div className="p-5 rounded-3xl bg-gradient-to-r from-amber-500/10 via-amber-400/20 to-amber-500/10 border border-amber-500/40 text-center space-y-1 shadow-xl">
                <div className="flex items-center justify-center space-x-2 text-amber-600 dark:text-amber-400 font-black text-sm uppercase tracking-wider">
                  <Trophy className="w-6 h-6 fill-amber-500 text-amber-500 animate-bounce" />
                  <span>
                    {groupWinner?.winner === 'A'
                      ? `${groupAData.label} Leads in Average Solved (+${groupWinner.margin} / student)`
                      : groupWinner?.winner === 'B'
                      ? `${groupBData.label} Leads in Average Solved (+${groupWinner.margin} / student)`
                      : 'Equal Group Average Solved Performance'}
                  </span>
                </div>
              </div>

              {/* Group Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Group A Card */}
                <div className={`glass-card p-6 rounded-3xl border-2 space-y-6 shadow-xl ${
                  groupWinner?.winner === 'A' ? 'border-amber-400 shadow-amber-500/10' : 'border-brand-500/30'
                }`}>
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                    <div>
                      <span className="px-3 py-1 rounded-full text-[10px] font-black bg-brand-500 text-white uppercase tracking-wider">
                        GROUP A
                      </span>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                        {groupAData.label}
                      </h3>
                    </div>
                    <Building2 className="w-7 h-7 text-brand-500" />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-4 rounded-2xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800">
                      <p className="text-xs text-brand-600 dark:text-brand-400 font-bold">Total Students</p>
                      <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{groupAData.total_students}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">Avg Solved / Student</p>
                      <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{groupAData.avg_solved}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">Active Participation</p>
                      <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{groupAData.participation_rate}%</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-bold">Top Ranker</p>
                      <p className="text-sm font-black text-amber-600 dark:text-amber-400 mt-1 truncate">{groupAData.top_student_name}</p>
                    </div>
                  </div>

                  {/* Top 5 Performers in Group A */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                      <Award className="w-4 h-4 text-brand-500" />
                      <span>Top Performers in Group A</span>
                    </h4>

                    <div className="space-y-2">
                      {groupAData.top_students.map((s, idx) => (
                        <div key={s.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-navy-950 border text-xs font-bold">
                          <div className="flex items-center space-x-3">
                            <span className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-600 dark:text-brand-400 font-black text-[10px] flex items-center justify-center">
                              #{idx + 1}
                            </span>
                            <span className="text-slate-900 dark:text-white font-extrabold">{s.name}</span>
                          </div>
                          <span className="text-emerald-600 dark:text-emerald-400 font-mono font-black">
                            {s.stats?.total_solved || 0} Solved
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Group B Card */}
                <div className={`glass-card p-6 rounded-3xl border-2 space-y-6 shadow-xl ${
                  groupWinner?.winner === 'B' ? 'border-amber-400 shadow-amber-500/10' : 'border-indigo-500/30'
                }`}>
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                    <div>
                      <span className="px-3 py-1 rounded-full text-[10px] font-black bg-indigo-600 text-white uppercase tracking-wider">
                        GROUP B
                      </span>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                        {groupBData.label}
                      </h3>
                    </div>
                    <Building2 className="w-7 h-7 text-indigo-500" />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">Total Students</p>
                      <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{groupBData.total_students}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">Avg Solved / Student</p>
                      <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{groupBData.avg_solved}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800">
                      <p className="text-xs text-brand-600 dark:text-brand-400 font-bold">Active Participation</p>
                      <p className="text-2xl font-black text-brand-600 dark:text-brand-400 mt-1">{groupBData.participation_rate}%</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-bold">Top Ranker</p>
                      <p className="text-sm font-black text-amber-600 dark:text-amber-400 mt-1 truncate">{groupBData.top_student_name}</p>
                    </div>
                  </div>

                  {/* Top 5 Performers in Group B */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                      <Award className="w-4 h-4 text-indigo-500" />
                      <span>Top Performers in Group B</span>
                    </h4>

                    <div className="space-y-2">
                      {groupBData.top_students.map((s, idx) => (
                        <div key={s.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-navy-950 border text-xs font-bold">
                          <div className="flex items-center space-x-3">
                            <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-black text-[10px] flex items-center justify-center">
                              #{idx + 1}
                            </span>
                            <span className="text-slate-900 dark:text-white font-extrabold">{s.name}</span>
                          </div>
                          <span className="text-emerald-600 dark:text-emerald-400 font-mono font-black">
                            {s.stats?.total_solved || 0} Solved
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

              {/* Side-by-Side Group Metric Bars */}
              <div className="glass-card p-6 rounded-3xl border space-y-5 shadow-xl">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-brand-500" />
                  <span>Side-by-Side Group Metric Comparison Bars</span>
                </h3>

                <div className="space-y-4 text-xs font-bold">
                  
                  {/* Average Solved Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-slate-600 dark:text-slate-300 truncate">
                      <span className="truncate max-w-[45%] font-extrabold text-brand-600 dark:text-brand-400">{groupAData.label} ({groupAData.avg_solved} / student)</span>
                      <span className="uppercase text-slate-400 font-extrabold">Avg Solved / Student</span>
                      <span className="truncate max-w-[45%] text-right font-extrabold text-indigo-600 dark:text-indigo-400">{groupBData.label} ({groupBData.avg_solved} / student)</span>
                    </div>
                    <div className="flex h-3.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 shadow-inner">
                      <div
                        style={{ width: `${(groupAData.avg_solved / Math.max(groupAData.avg_solved + groupBData.avg_solved, 1)) * 100}%` }}
                        className="bg-gradient-to-r from-brand-600 to-brand-400"
                      ></div>
                      <div
                        style={{ width: `${(groupBData.avg_solved / Math.max(groupAData.avg_solved + groupBData.avg_solved, 1)) * 100}%` }}
                        className="bg-gradient-to-r from-indigo-400 to-indigo-600"
                      ></div>
                    </div>
                  </div>

                  {/* Participation Rate Bar */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-slate-600 dark:text-slate-300 truncate">
                      <span className="truncate max-w-[45%] font-extrabold text-teal-600 dark:text-teal-400">{groupAData.label} ({groupAData.participation_rate}%)</span>
                      <span className="uppercase text-indigo-500 font-extrabold">Active Participation Rate</span>
                      <span className="truncate max-w-[45%] text-right font-extrabold text-purple-600 dark:text-purple-400">{groupBData.label} ({groupBData.participation_rate}%)</span>
                    </div>
                    <div className="flex h-3.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 shadow-inner">
                      <div
                        style={{ width: `${(groupAData.participation_rate / Math.max(groupAData.participation_rate + groupBData.participation_rate, 1)) * 100}%` }}
                        className="bg-gradient-to-r from-teal-600 to-teal-400"
                      ></div>
                      <div
                        style={{ width: `${(groupBData.participation_rate / Math.max(groupAData.participation_rate + groupBData.participation_rate, 1)) * 100}%` }}
                        className="bg-gradient-to-r from-purple-400 to-purple-600"
                      ></div>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          ) : (
            <div className="glass-card p-10 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-lg">
              <Building2 className="w-10 h-10 text-brand-500 mx-auto animate-pulse" />
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
                Select Cohort Groups to Compare
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Select two groups from the dropdowns above or use the Quick Pick buttons to view side-by-side metric distribution and leaderboards.
              </p>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
