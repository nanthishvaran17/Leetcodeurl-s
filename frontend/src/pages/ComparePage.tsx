import React, { useState, useEffect, useMemo } from 'react';
import {
  Swords, Trophy, Flame, Star, Award, Zap, ChevronRight, User, CheckCircle2,
  Search, Filter, RefreshCw, Building2, Users, BarChart3, TrendingUp, Sparkles,
  ArrowRightLeft, GraduationCap, School, Layers
} from 'lucide-react';
import api from '../services/api';
import { StudentData } from '../components/LeaderboardTable';

export const ComparePage: React.FC = () => {
  // Mode: STUDENT vs GROUP
  const [compareMode, setCompareMode] = useState<'STUDENT' | 'GROUP'>('STUDENT');

  // Group Comparison Sub-Dimension: DEPT | DEPT_YEAR | YEAR | SECTION
  const [groupDimension, setGroupDimension] = useState<'DEPT' | 'DEPT_YEAR' | 'YEAR' | 'SECTION'>('DEPT_YEAR');

  // Filters for Student Comparison
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');

  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Student Battle Selection
  const [studentAId, setStudentAId] = useState<number | null>(null);
  const [studentBId, setStudentBId] = useState<number | null>(null);

  const [studentA, setStudentA] = useState<StudentData | null>(null);
  const [studentB, setStudentB] = useState<StudentData | null>(null);

  // Search states for Fighter A & Fighter B dropdowns
  const [searchA, setSearchA] = useState<string>('');
  const [searchB, setSearchB] = useState<string>('');

  // Group Comparison Selection keys
  const [groupAKey, setGroupAKey] = useState<string>('');
  const [groupBKey, setGroupBKey] = useState<string>('');

  useEffect(() => {
    fetchDepartments();
    fetchStudents();
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [selectedDept, selectedYear]);

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      setDepartments(res.data);
    } catch (err) {
      console.error(err);
    }
  };

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
      const sorted = res.data.sort((a: StudentData, b: StudentData) => (b.stats?.total_solved || 0) - (a.stats?.total_solved || 0));
      setStudents(sorted);

      if (sorted.length >= 2) {
        if (!studentAId) setStudentAId(sorted[0].id);
        if (!studentBId) setStudentBId(sorted[1].id);
        setStudentA(sorted[0]);
        setStudentB(sorted[1]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Build unique Group options dynamically based on current dimension
  const groupOptions = useMemo(() => {
    if (groupDimension === 'DEPT') {
      return departments.map(d => ({
        key: String(d.id),
        label: `${d.name} (${d.code}) - All Years`
      }));
    } else if (groupDimension === 'DEPT_YEAR') {
      // Combined Department & Year Combo e.g. 2nd Year Cyber Security vs 2nd Year IoT
      const list: { key: string; label: string }[] = [];
      const yearLabels: Record<string, string> = {
        'II': '2nd Year (II)',
        'III': '3rd Year (III)',
        'IV': '4th Year (IV)'
      };
      const years = ['II', 'III', 'IV'];

      years.forEach(yr => {
        departments.forEach(d => {
          list.push({
            key: `${d.id}_${yr}`,
            label: `${yearLabels[yr]} ${d.code} — ${d.name}`
          });
        });
      });
      return list;
    } else if (groupDimension === 'YEAR') {
      return [
        { key: 'II', label: 'II Year (Batch 2025 - 2029)' },
        { key: 'III', label: 'III Year (Batch 2024 - 2028)' },
        { key: 'IV', label: 'IV Year (Batch 2023 - 2027)' },
      ];
    } else {
      // SECTION
      const secMap = new Map<string, string>();
      students.forEach(s => {
        const dId = s.department_id || s.department?.id || 1;
        const dCode = s.department?.code || 'DEPT';
        const yr = s.year_level || 'III';
        const secName = s.section?.name || 'A';
        const key = `${dId}_${yr}_${secName}`;
        const label = `${dCode} - ${yr} Year (${secName})`;
        if (!secMap.has(key)) {
          secMap.set(key, label);
        }
      });
      return Array.from(secMap.entries()).map(([key, label]) => ({ key, label }));
    }
  }, [groupDimension, departments, students]);

  // Default Group A and Group B selection when options change
  // Always ensure A != B to prevent identical group display
  useEffect(() => {
    if (groupDimension === 'DEPT_YEAR' && departments.length >= 2) {
      // Default: II Year CSE(CS) vs II Year CSE(IOT)
      const dept1 = departments[0];
      const dept2 = departments[1];
      if (dept1 && dept2) {
        setGroupAKey(`${dept1.id}_II`);
        setGroupBKey(`${dept2.id}_II`);
        return;
      }
    }
    if (groupOptions.length >= 2) {
      setGroupAKey(groupOptions[0].key);
      setGroupBKey(groupOptions[1].key);
    } else if (groupOptions.length === 1) {
      setGroupAKey(groupOptions[0].key);
      setGroupBKey(groupOptions[0].key);
    }
  }, [groupDimension, groupOptions]);

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
      groupStudents = students.filter(s => (s.department_id || s.department?.id) === dId);
    } else if (groupDimension === 'DEPT_YEAR') {
      const [dIdStr, yr] = key.split('_');
      const dId = Number(dIdStr);
      groupStudents = students.filter(s => (s.department_id || s.department?.id) === dId && s.year_level === yr);
    } else if (groupDimension === 'YEAR') {
      groupStudents = students.filter(s => s.year_level === key);
    } else {
      // SECTION
      const [dId, yr, secName] = key.split('_');
      groupStudents = students.filter(s =>
        String(s.department_id || s.department?.id) === dId &&
        s.year_level === yr &&
        (s.section?.name || 'A') === secName
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
      label: labelObj ? labelObj.label : key,
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
      
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-8 shadow-2xl border border-brand-500/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black">
              <Swords className="w-4 h-4 text-amber-400" />
              <span>HEAD-TO-HEAD COMPARISON ARENA • STUDENT, DEPT, YEAR & BATCH ANALYTICS</span>
            </div>

            {/* Mode Switcher Buttons */}
            <div className="flex items-center p-1 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
              <button
                onClick={() => setCompareMode('STUDENT')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  compareMode === 'STUDENT'
                    ? 'bg-gradient-to-r from-brand-500 to-indigo-600 text-white shadow-lg scale-105'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Student vs Student</span>
              </button>

              <button
                onClick={() => setCompareMode('GROUP')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  compareMode === 'GROUP'
                    ? 'bg-gradient-to-r from-brand-500 to-indigo-600 text-white shadow-lg scale-105'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Group & Batch Comparison</span>
              </button>
            </div>
          </div>

          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
              {compareMode === 'STUDENT' ? 'Student Head-to-Head Comparison Arena' : 'Group & Batch Aggregate Analytics'}
            </h1>
            <p className="text-xs md:text-sm text-gray-300 font-bold mt-1">
              Analyze side-by-side performance metrics, total problem counts, difficulty breakdown, contest ratings, and weekly streaks across students.
            </p>
          </div>
        </div>
      </div>

      {/* Mode 1: STUDENT VS STUDENT */}
      {compareMode === 'STUDENT' && (
        <div className="space-y-6">
                {/* Filter Controls Bar */}
          <div className="glass-card p-6 rounded-3xl border space-y-4 shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-3 border-b border-gray-200 dark:border-gray-800 pb-3">
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center space-x-2">
                <Filter className="w-4 h-4 text-brand-500" />
                <span>Filter Students by Department & Academic Year</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Department Filter */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Select Department</label>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border text-xs font-bold bg-white dark:bg-navy-900 text-gray-900 dark:text-white border-gray-200 dark:border-gray-800 focus:ring-2 focus:ring-brand-500 outline-none"
                >
                  <option value="ALL">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>

              {/* Year Filter */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Select Academic Year Level</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border text-xs font-bold bg-white dark:bg-navy-900 text-gray-900 dark:text-white border-gray-200 dark:border-gray-800 focus:ring-2 focus:ring-brand-500 outline-none"
                >
                  <option value="ALL">All Academic Years</option>
                  <option value="II">II Year (Batch 2025 - 2029)</option>
                  <option value="III">III Year (Batch 2024 - 2028)</option>
                  <option value="IV">IV Year (Batch 2023 - 2027)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Student Selectors (With Search Box for Fighter A & Fighter B) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Select Student A */}
            <div className="glass-card p-5 rounded-3xl border border-brand-500/30 space-y-3 bg-brand-50/20 dark:bg-brand-950/20 shadow-md">
              <div className="flex items-center justify-between text-xs font-extrabold text-brand-600 dark:text-brand-400 uppercase tracking-wider">
                <span>Select Fighter 1 (Student A)</span>
                <span className="bg-brand-500/20 px-2.5 py-0.5 rounded-full border border-brand-500/30">Fighter A</span>
              </div>

              {/* Search Box Input */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search Student A by Name, Reg No, or Handle..."
                  value={searchA}
                  onChange={(e) => setSearchA(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border text-xs font-bold bg-white dark:bg-navy-900 text-gray-900 dark:text-white border-brand-400/40 focus:ring-2 focus:ring-brand-500 outline-none shadow-inner"
                />
              </div>

              <select
                value={studentAId || ''}
                onChange={(e) => handleSelectA(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-2xl border text-xs font-extrabold bg-white dark:bg-navy-900 text-gray-900 dark:text-white border-brand-400/40 shadow-sm outline-none"
              >
                {filteredStudentsA.length === 0 ? (
                  <option value="">No matching student found</option>
                ) : (
                  filteredStudentsA.map((s) => (
                    <option key={s.id} value={s.id}>
                      #{s.college_rank || '—'} • {s.name} ({s.reg_no}) — {s.stats?.total_solved || 0} Solved [{s.department?.code}]
                    </option>
                  ))
                )}
              </select>

              {/* Quick Select Preset Buttons */}
              <div className="flex items-center space-x-2 pt-1">
                <span className="text-[10px] text-gray-400 font-bold">Quick Select:</span>
                {students[0] && (
                  <button
                    onClick={() => handleSelectA(students[0].id)}
                    className="px-2.5 py-1 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-black border border-brand-500/20 hover:bg-brand-500 hover:text-white transition-all cursor-pointer flex items-center space-x-1"
                  >
                    <span>{students[0].name} (#1)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Select Student B */}
            <div className="glass-card p-5 rounded-3xl border border-indigo-500/30 space-y-3 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-md">
              <div className="flex items-center justify-between text-xs font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                <span>Select Fighter 2 (Student B)</span>
                <span className="bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30">Fighter B</span>
              </div>

              {/* Search Box Input */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search Student B by Name, Reg No, or Handle..."
                  value={searchB}
                  onChange={(e) => setSearchB(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border text-xs font-bold bg-white dark:bg-navy-900 text-gray-900 dark:text-white border-indigo-400/40 focus:ring-2 focus:ring-indigo-500 outline-none shadow-inner"
                />
              </div>

              <select
                value={studentBId || ''}
                onChange={(e) => handleSelectB(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-2xl border text-xs font-extrabold bg-white dark:bg-navy-900 text-gray-900 dark:text-white border-indigo-400/40 shadow-sm outline-none"
              >
                {filteredStudentsB.length === 0 ? (
                  <option value="">No matching student found</option>
                ) : (
                  filteredStudentsB.map((s) => (
                    <option key={s.id} value={s.id}>
                      #{s.college_rank || '—'} • {s.name} ({s.reg_no}) — {s.stats?.total_solved || 0} Solved [{s.department?.code}]
                    </option>
                  ))
                )}
              </select>

              {/* Quick Select Preset Buttons */}
              <div className="flex items-center space-x-2 pt-1">
                <span className="text-[10px] text-gray-400 font-bold">Quick Select:</span>
                {students.length > 1 && students[1] && (
                  <button
                    onClick={() => handleSelectB(students[1].id)}
                    className="px-2.5 py-1 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black border border-indigo-500/20 hover:bg-indigo-500 hover:text-white transition-all cursor-pointer flex items-center space-x-1"
                  >
                    <span>{students[1].name} (#2)</span>
                  </button>
                )}
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
              <div className="grid grid-cols-1 lg:grid-cols-7 gap-6 items-stretch">
                
                {/* Student A Card (3 cols) */}
                <div className={`lg:col-span-3 glass-card p-6 rounded-3xl border-2 transition-all space-y-5 flex flex-col justify-between ${
                  battleResult?.winner === 'A'
                    ? 'border-amber-400/70 shadow-xl shadow-amber-500/10 bg-gradient-to-b from-amber-500/5 via-white to-white dark:via-navy-950 dark:to-navy-950'
                    : 'border-gray-200 dark:border-gray-800'
                }`}>
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-brand-600 text-white shadow-sm">
                        Rank #{studentA.college_rank || '—'}
                      </span>
                      <span className="px-3 py-1 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300 font-mono font-bold text-xs border border-brand-500/20">
                        {studentA.department?.code} • {studentA.year_level} Year
                      </span>
                    </div>

                    <div className="text-center space-y-2">
                      <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-black text-2xl flex items-center justify-center shadow-lg border-2 border-white/20">
                        {studentA.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <h3 className="font-extrabold text-lg text-gray-900 dark:text-white truncate max-w-[260px] mx-auto">
                        {studentA.name}
                      </h3>
                      <p className="text-xs text-brand-600 dark:text-brand-400 font-mono font-bold">
                        {studentA.reg_no}
                      </p>
                      {studentA.username && (
                        <a
                          href={`https://leetcode.com/u/${studentA.username}/`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center space-x-1 text-[11px] text-gray-500 hover:text-brand-500 transition-colors font-mono font-semibold"
                        >
                          <span>@{studentA.username}</span>
                          <Sparkles className="w-3 h-3 text-amber-500" />
                        </a>
                      )}
                    </div>

                    <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 text-center">
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-extrabold uppercase tracking-wider">Total Problems Solved</p>
                      <h4 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                        {studentA.stats?.total_solved || 0}
                      </h4>
                    </div>

                    {/* Difficulty Stats Breakdown */}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">Easy</p>
                        <p className="text-base font-black mt-0.5">{studentA.stats?.easy_solved || 0}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-extrabold">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">Medium</p>
                        <p className="text-base font-black mt-0.5">{studentA.stats?.medium_solved || 0}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-extrabold">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">Hard</p>
                        <p className="text-base font-black mt-0.5">{studentA.stats?.hard_solved || 0}</p>
                      </div>
                    </div>

                    {/* Extended Metrics: Contest Rating & Active Streak */}
                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                        <p className="text-[10px] uppercase font-bold text-gray-500">Contest Rating</p>
                        <p className="text-sm font-black mt-0.5">{studentA.stats?.contest_rating ? Math.round(studentA.stats.contest_rating) : 'Unrated'}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">
                        <p className="text-[10px] uppercase font-bold text-gray-500">Weekly Progress</p>
                        <p className="text-sm font-black mt-0.5">+{studentA.weekly_progress || 0}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* VS Center Emblem (1 col) */}
                <div className="lg:col-span-1 flex flex-col items-center justify-center space-y-2 py-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 text-white font-black text-base flex items-center justify-center shadow-xl border-2 border-white dark:border-navy-900">
                    VS
                  </div>
                  <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">MATCHUP</span>
                </div>

                {/* Student B Card (3 cols) */}
                <div className={`lg:col-span-3 glass-card p-6 rounded-3xl border-2 transition-all space-y-5 flex flex-col justify-between ${
                  battleResult?.winner === 'B'
                    ? 'border-amber-400/70 shadow-xl shadow-amber-500/10 bg-gradient-to-b from-amber-500/5 via-white to-white dark:via-navy-950 dark:to-navy-950'
                    : 'border-gray-200 dark:border-gray-800'
                }`}>
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-600 text-white shadow-sm">
                        Rank #{studentB.college_rank || '—'}
                      </span>
                      <span className="px-3 py-1 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-mono font-bold text-xs border border-indigo-500/20">
                        {studentB.department?.code} • {studentB.year_level} Year
                      </span>
                    </div>

                    <div className="text-center space-y-2">
                      <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-black text-2xl flex items-center justify-center shadow-lg border-2 border-white/20">
                        {studentB.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <h3 className="font-extrabold text-lg text-gray-900 dark:text-white truncate max-w-[260px] mx-auto">
                        {studentB.name}
                      </h3>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                        {studentB.reg_no}
                      </p>
                      {studentB.username && (
                        <a
                          href={`https://leetcode.com/u/${studentB.username}/`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center space-x-1 text-[11px] text-gray-500 hover:text-indigo-500 transition-colors font-mono font-semibold"
                        >
                          <span>@{studentB.username}</span>
                          <Sparkles className="w-3 h-3 text-amber-500" />
                        </a>
                      )}
                    </div>

                    <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 text-center">
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-extrabold uppercase tracking-wider">Total Problems Solved</p>
                      <h4 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                        {studentB.stats?.total_solved || 0}
                      </h4>
                    </div>

                    {/* Difficulty Stats Breakdown */}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">Easy</p>
                        <p className="text-base font-black mt-0.5">{studentB.stats?.easy_solved || 0}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-extrabold">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">Medium</p>
                        <p className="text-base font-black mt-0.5">{studentB.stats?.medium_solved || 0}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-extrabold">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">Hard</p>
                        <p className="text-base font-black mt-0.5">{studentB.stats?.hard_solved || 0}</p>
                      </div>
                    </div>

                    {/* Extended Metrics: Contest Rating & Active Streak */}
                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                        <p className="text-[10px] uppercase font-bold text-gray-500">Contest Rating</p>
                        <p className="text-sm font-black mt-0.5">{studentB.stats?.contest_rating ? Math.round(studentB.stats.contest_rating) : 'Unrated'}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">
                        <p className="text-[10px] uppercase font-bold text-gray-500">Weekly Progress</p>
                        <p className="text-sm font-black mt-0.5">+{studentB.weekly_progress || 0}</p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Side-by-Side Metric Comparison Bars */}
              <div className="glass-card p-6 rounded-3xl border space-y-5 shadow-xl">
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  <span>Head-to-Head Metric Distribution</span>
                </h3>

                <div className="space-y-4 text-xs font-bold">
                  
                  {/* Total Solved Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-gray-600 dark:text-gray-300">
                      <span>{studentA.name} ({studentA.stats?.total_solved || 0})</span>
                      <span className="uppercase text-gray-400 font-extrabold text-[10px]">Total Solved</span>
                      <span>{studentB.name} ({studentB.stats?.total_solved || 0})</span>
                    </div>
                    <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
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
                    <div className="flex justify-between text-gray-600 dark:text-gray-300">
                      <span>Rating: {studentA.stats?.contest_rating ? Math.round(studentA.stats.contest_rating) : 'Unrated'}</span>
                      <span className="uppercase text-indigo-500 font-extrabold text-[10px]">Contest Rating</span>
                      <span>Rating: {studentB.stats?.contest_rating ? Math.round(studentB.stats.contest_rating) : 'Unrated'}</span>
                    </div>
                    <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
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
          <div className="glass-card p-6 rounded-3xl border space-y-6 shadow-xl">
            
            {/* Dimension Sub-Tabs (Department & Year Combo vs Department vs Year Level vs Section) */}
            <div className="flex items-center justify-between flex-wrap gap-3 border-b border-gray-200 dark:border-gray-800 pb-4">
              <div>
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white flex items-center space-x-2">
                  <Building2 className="w-5 h-5 text-brand-500" />
                  <span>Choose Group Comparison Dimension</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Compare performance by Dept & Year Batch (e.g. 2nd Yr Cyber vs 2nd Yr IoT), Department, Year, or Section</p>
              </div>

              {/* Sub-Dimension Tabs */}
              <div className="flex items-center space-x-2 bg-gray-100 dark:bg-navy-900 p-1.5 rounded-2xl border flex-wrap gap-1">
                
                <button
                  onClick={() => setGroupDimension('DEPT_YEAR')}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                    groupDimension === 'DEPT_YEAR'
                      ? 'bg-gradient-to-r from-brand-500 to-indigo-600 text-white shadow-md'
                      : 'text-gray-600 dark:text-gray-300 hover:text-brand-500'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span>By Dept & Year Batch (e.g. 2nd Cyber vs 2nd IoT)</span>
                </button>

                <button
                  onClick={() => setGroupDimension('DEPT')}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                    groupDimension === 'DEPT'
                      ? 'bg-brand-500 text-white shadow-md'
                      : 'text-gray-600 dark:text-gray-300 hover:text-brand-500'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>By Dept (All Years)</span>
                </button>

                <button
                  onClick={() => setGroupDimension('YEAR')}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                    groupDimension === 'YEAR'
                      ? 'bg-brand-500 text-white shadow-md'
                      : 'text-gray-600 dark:text-gray-300 hover:text-brand-500'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>By Academic Year</span>
                </button>

                <button
                  onClick={() => setGroupDimension('SECTION')}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                    groupDimension === 'SECTION'
                      ? 'bg-brand-500 text-white shadow-md'
                      : 'text-gray-600 dark:text-gray-300 hover:text-brand-500'
                  }`}
                >
                  <School className="w-3.5 h-3.5" />
                  <span>By Section</span>
                </button>
              </div>
            </div>

            {/* Select Group A vs Group B Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* Group A Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider">
                  Select {groupDimension === 'DEPT_YEAR' ? 'Dept & Year Batch' : groupDimension === 'DEPT' ? 'Department' : groupDimension === 'YEAR' ? 'Academic Year' : 'Section'} A
                </label>
                <select
                  value={groupAKey}
                  onChange={(e) => setGroupAKey(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border text-xs font-extrabold bg-white dark:bg-navy-900 text-gray-900 dark:text-white border-brand-400/40 shadow-sm focus:ring-2 focus:ring-brand-500 outline-none"
                >
                  {groupOptions.map((g) => (
                    <option key={g.key} value={g.key}>{g.label}</option>
                  ))}
                </select>

                {groupDimension === 'DEPT_YEAR' && (
                  <div className="flex items-center space-x-2 pt-1">
                    <span className="text-[10px] text-gray-400 font-bold">Quick Pick A:</span>
                    <button
                      onClick={() => {
                        const opt = groupOptions.find(g => g.key.includes('2') || g.key.includes('II'));
                        if (opt) setGroupAKey(opt.key);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-300 text-[10px] font-bold"
                    >
                      ⚡ 2nd Year CSE(CS)
                    </button>
                  </div>
                )}
              </div>

              {/* Group B Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  Select {groupDimension === 'DEPT_YEAR' ? 'Dept & Year Batch' : groupDimension === 'DEPT' ? 'Department' : groupDimension === 'YEAR' ? 'Academic Year' : 'Section'} B
                </label>
                <select
                  value={groupBKey}
                  onChange={(e) => setGroupBKey(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border text-xs font-extrabold bg-white dark:bg-navy-900 text-gray-900 dark:text-white border-indigo-400/40 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {groupOptions.map((g) => (
                    <option key={g.key} value={g.key}>{g.label}</option>
                  ))}
                </select>

                {groupDimension === 'DEPT_YEAR' && (
                  <div className="flex items-center space-x-2 pt-1">
                    <span className="text-[10px] text-gray-400 font-bold">Quick Pick B:</span>
                    <button
                      onClick={() => {
                        const opt = groupOptions.find(g => g.key.endsWith('II') && g.key.startsWith('2'));
                        if (opt) setGroupBKey(opt.key);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 text-[10px] font-bold"
                    >
                      ⚡ 2nd Year CSE(IOT)
                    </button>
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
                  <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-4">
                    <div>
                      <span className="px-3 py-1 rounded-full text-[10px] font-black bg-brand-500 text-white uppercase tracking-wider">
                        GROUP A
                      </span>
                      <h3 className="text-lg font-black text-gray-900 dark:text-white mt-1">
                        {groupAData.label}
                      </h3>
                    </div>
                    <Building2 className="w-7 h-7 text-brand-500" />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-4 rounded-2xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800">
                      <p className="text-xs text-brand-600 dark:text-brand-400 font-bold">Total Students</p>
                      <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">{groupAData.total_students}</p>
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
                    <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider flex items-center space-x-1.5">
                      <Award className="w-4 h-4 text-brand-500" />
                      <span>Top Performers in Group A</span>
                    </h4>

                    <div className="space-y-2">
                      {groupAData.top_students.map((s, idx) => (
                        <div key={s.id} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-navy-900 border text-xs font-bold">
                          <div className="flex items-center space-x-3">
                            <span className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-600 dark:text-brand-400 font-black text-[10px] flex items-center justify-center">
                              #{idx + 1}
                            </span>
                            <span className="text-gray-900 dark:text-white font-extrabold">{s.name}</span>
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
                  <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-4">
                    <div>
                      <span className="px-3 py-1 rounded-full text-[10px] font-black bg-indigo-600 text-white uppercase tracking-wider">
                        GROUP B
                      </span>
                      <h3 className="text-lg font-black text-gray-900 dark:text-white mt-1">
                        {groupBData.label}
                      </h3>
                    </div>
                    <Building2 className="w-7 h-7 text-indigo-500" />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">Total Students</p>
                      <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">{groupBData.total_students}</p>
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
                    <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider flex items-center space-x-1.5">
                      <Award className="w-4 h-4 text-indigo-500" />
                      <span>Top Performers in Group B</span>
                    </h4>

                    <div className="space-y-2">
                      {groupBData.top_students.map((s, idx) => (
                        <div key={s.id} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-navy-900 border text-xs font-bold">
                          <div className="flex items-center space-x-3">
                            <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-black text-[10px] flex items-center justify-center">
                              #{idx + 1}
                            </span>
                            <span className="text-gray-900 dark:text-white font-extrabold">{s.name}</span>
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
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-brand-500" />
                  <span>Side-by-Side Group Metric Comparison Bars</span>
                </h3>

                <div className="space-y-4 text-xs font-bold">
                  
                  {/* Average Solved Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-gray-600 dark:text-gray-300 truncate">
                      <span className="truncate max-w-[45%] font-extrabold text-brand-600 dark:text-brand-400">{groupAData.label} ({groupAData.avg_solved} / student)</span>
                      <span className="uppercase text-gray-400 font-extrabold">Avg Solved / Student</span>
                      <span className="truncate max-w-[45%] text-right font-extrabold text-indigo-600 dark:text-indigo-400">{groupBData.label} ({groupBData.avg_solved} / student)</span>
                    </div>
                    <div className="flex h-3.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 shadow-inner">
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
                    <div className="flex justify-between text-gray-600 dark:text-gray-300 truncate">
                      <span className="truncate max-w-[45%] font-extrabold text-teal-600 dark:text-teal-400">{groupAData.label} ({groupAData.participation_rate}%)</span>
                      <span className="uppercase text-indigo-500 font-extrabold">Active Participation Rate</span>
                      <span className="truncate max-w-[45%] text-right font-extrabold text-purple-600 dark:text-purple-400">{groupBData.label} ({groupBData.participation_rate}%)</span>
                    </div>
                    <div className="flex h-3.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 shadow-inner">
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
          ) : null}

        </div>
      )}

    </div>
  );
};
