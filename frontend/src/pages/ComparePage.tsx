import React, { useState, useEffect } from 'react';
import {
  Swords, Trophy, Flame, Star, Award, Zap, ChevronRight, User, CheckCircle2, Search, Filter, RefreshCw
} from 'lucide-react';
import api from '../services/api';
import { StudentData } from '../components/LeaderboardTable';

export const ComparePage: React.FC = () => {
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');

  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [studentAId, setStudentAId] = useState<number | null>(null);
  const [studentBId, setStudentBId] = useState<number | null>(null);

  const [studentA, setStudentA] = useState<StudentData | null>(null);
  const [studentB, setStudentB] = useState<StudentData | null>(null);

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

  return (
    <div className="space-y-8 py-2">
      
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-8 shadow-2xl border border-brand-500/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black">
            <Swords className="w-3.5 h-3.5 text-amber-400" />
            <span>HEAD-TO-HEAD BATTLE ARENA • STUDENT PERFORMANCE COMPARISON</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-black tracking-tight">
            Student Head-to-Head <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">Comparison Arena</span>
          </h1>

          <p className="text-xs md:text-sm text-gray-300 max-w-2xl leading-relaxed font-medium">
            Analyze side-by-side performance metrics, total problem counts, difficulty breakdown, contest ratings, and weekly streaks across departments and year levels.
          </p>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="glass-card p-6 rounded-3xl border space-y-4 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-gray-200 dark:border-gray-800 pb-3">
          <h3 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center space-x-2">
            <Filter className="w-4 h-4 text-brand-500" />
            <span>Filter Students by Department & Academic Year</span>
          </h3>
          <span className="text-xs text-gray-500 font-medium">
            Found <b className="text-brand-600 dark:text-brand-400 font-bold">{students.length}</b> eligible students for comparison
          </span>
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
              <option value="ALL">🏢 All Departments (Cyber Security & IoT)</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>🏢 {d.name} ({d.code})</option>
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
              <option value="ALL">🎓 All Academic Years (II, III & IV Year)</option>
              <option value="II">🎓 II Year (Batch 2025 - 2029)</option>
              <option value="III">🎓 III Year (Batch 2024 - 2028)</option>
              <option value="IV">🎓 IV Year (Batch 2023 - 2027)</option>
            </select>
          </div>

        </div>
      </div>

      {/* Student Selectors (Student A vs Student B) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Select Student A */}
        <div className="glass-card p-5 rounded-3xl border border-brand-500/30 space-y-3 bg-brand-50/20 dark:bg-brand-950/20">
          <div className="flex items-center justify-between text-xs font-extrabold text-brand-600 dark:text-brand-400 uppercase tracking-wider">
            <span>Select Fighter 1 (Student A)</span>
            <span className="bg-brand-500/20 px-2.5 py-0.5 rounded-full border border-brand-500/30">Fighter A</span>
          </div>

          <select
            value={studentAId || ''}
            onChange={(e) => handleSelectA(Number(e.target.value))}
            className="w-full px-4 py-3 rounded-2xl border text-xs font-extrabold bg-white dark:bg-navy-900 text-gray-900 dark:text-white border-brand-400/40 shadow-sm outline-none"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                #{s.college_rank || '—'} • {s.name} ({s.reg_no}) — {s.stats?.total_solved || 0} Solved [{s.department?.code}]
              </option>
            ))}
          </select>
        </div>

        {/* Select Student B */}
        <div className="glass-card p-5 rounded-3xl border border-indigo-500/30 space-y-3 bg-indigo-50/20 dark:bg-indigo-950/20">
          <div className="flex items-center justify-between text-xs font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            <span>Select Fighter 2 (Student B)</span>
            <span className="bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30">Fighter B</span>
          </div>

          <select
            value={studentBId || ''}
            onChange={(e) => handleSelectB(Number(e.target.value))}
            className="w-full px-4 py-3 rounded-2xl border text-xs font-extrabold bg-white dark:bg-navy-900 text-gray-900 dark:text-white border-indigo-400/40 shadow-sm outline-none"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                #{s.college_rank || '—'} • {s.name} ({s.reg_no}) — {s.stats?.total_solved || 0} Solved [{s.department?.code}]
              </option>
            ))}
          </select>
        </div>

      </div>

      {/* Head-to-Head Visual Battle Cards */}
      {studentA && studentB ? (
        <div className="space-y-8">
          
          {/* Winner Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-400/20 to-amber-500/10 border border-amber-500/40 text-center space-y-1 shadow-md">
            <div className="flex items-center justify-center space-x-2 text-amber-600 dark:text-amber-400 font-black text-sm uppercase tracking-wider">
              <Trophy className="w-5 h-5 fill-amber-500 text-amber-500 animate-bounce" />
              <span>
                {battleResult?.winner === 'A'
                  ? `🏆 ${studentA.name} Leads the Battle (+${battleResult.margin} Solved)`
                  : battleResult?.winner === 'B'
                  ? `🏆 ${studentB.name} Leads the Battle (+${battleResult.margin} Solved)`
                  : '🤝 Perfect Tie / Equal Solved Count'}
              </span>
            </div>
          </div>

          {/* Cards Comparison Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-6 items-center">
            
            {/* Student A Card (3 cols) */}
            <div className={`lg:col-span-3 glass-card p-6 rounded-3xl border-2 transition-all space-y-5 ${
              battleResult?.winner === 'A'
                ? 'border-amber-400 shadow-2xl shadow-amber-500/20 bg-gradient-to-b from-amber-500/10 via-white to-white dark:via-navy-950 dark:to-navy-950'
                : 'border-brand-500/30'
            }`}>
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-xs font-black bg-brand-500 text-white shadow-md">
                  #{studentA.college_rank || '—'} Rank
                </span>
                <span className="px-3 py-1 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300 font-mono font-bold text-xs border border-brand-500/20">
                  {studentA.department?.code} • {studentA.year_level} Yr
                </span>
              </div>

              <div className="text-center space-y-2">
                <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-black text-2xl flex items-center justify-center shadow-lg border-2 border-white/20">
                  {studentA.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <h3 className="font-extrabold text-lg text-gray-900 dark:text-white truncate max-w-[240px] mx-auto">
                  {studentA.name}
                </h3>
                <p className="text-xs text-brand-600 dark:text-brand-400 font-mono font-bold">
                  {studentA.reg_no}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-center">
                <p className="text-xs text-emerald-700 dark:text-emerald-300 font-extrabold uppercase tracking-wider">Total Problems Solved</p>
                <h4 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {studentA.stats?.total_solved || 0}
                </h4>
              </div>

              {/* Difficulty Stats */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold">
                  <p className="text-[10px] uppercase">Easy</p>
                  <p className="text-base font-black mt-0.5">{studentA.stats?.easy_solved || 0}</p>
                </div>
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-extrabold">
                  <p className="text-[10px] uppercase">Med</p>
                  <p className="text-base font-black mt-0.5">{studentA.stats?.medium_solved || 0}</p>
                </div>
                <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-extrabold">
                  <p className="text-[10px] uppercase">Hard</p>
                  <p className="text-base font-black mt-0.5">{studentA.stats?.hard_solved || 0}</p>
                </div>
              </div>
            </div>

            {/* VS Emblem (1 col) */}
            <div className="lg:col-span-1 flex flex-col items-center justify-center space-y-2 py-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-r from-brand-600 via-indigo-600 to-amber-500 text-white font-black text-xl flex items-center justify-center shadow-2xl animate-pulse border-4 border-white dark:border-navy-950">
                VS
              </div>
              <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">BATTLE</span>
            </div>

            {/* Student B Card (3 cols) */}
            <div className={`lg:col-span-3 glass-card p-6 rounded-3xl border-2 transition-all space-y-5 ${
              battleResult?.winner === 'B'
                ? 'border-amber-400 shadow-2xl shadow-amber-500/20 bg-gradient-to-b from-amber-500/10 via-white to-white dark:via-navy-950 dark:to-navy-950'
                : 'border-indigo-500/30'
            }`}>
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-600 text-white shadow-md">
                  #{studentB.college_rank || '—'} Rank
                </span>
                <span className="px-3 py-1 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-mono font-bold text-xs border border-indigo-500/20">
                  {studentB.department?.code} • {studentB.year_level} Yr
                </span>
              </div>

              <div className="text-center space-y-2">
                <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-black text-2xl flex items-center justify-center shadow-lg border-2 border-white/20">
                  {studentB.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <h3 className="font-extrabold text-lg text-gray-900 dark:text-white truncate max-w-[240px] mx-auto">
                  {studentB.name}
                </h3>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                  {studentB.reg_no}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-center">
                <p className="text-xs text-emerald-700 dark:text-emerald-300 font-extrabold uppercase tracking-wider">Total Problems Solved</p>
                <h4 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {studentB.stats?.total_solved || 0}
                </h4>
              </div>

              {/* Difficulty Stats */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold">
                  <p className="text-[10px] uppercase">Easy</p>
                  <p className="text-base font-black mt-0.5">{studentB.stats?.easy_solved || 0}</p>
                </div>
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-extrabold">
                  <p className="text-[10px] uppercase">Med</p>
                  <p className="text-base font-black mt-0.5">{studentB.stats?.medium_solved || 0}</p>
                </div>
                <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-extrabold">
                  <p className="text-[10px] uppercase">Hard</p>
                  <p className="text-base font-black mt-0.5">{studentB.stats?.hard_solved || 0}</p>
                </div>
              </div>
            </div>

          </div>

          {/* Metric Bar Comparison Chart Table */}
          <div className="glass-card p-6 rounded-3xl border space-y-5 shadow-xl">
            <h3 className="font-extrabold text-base text-gray-900 dark:text-white flex items-center space-x-2">
              <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
              <span>Side-by-Side Metric Comparison Bars</span>
            </h3>

            <div className="space-y-4 text-xs font-bold">
              
              {/* Total Solved Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-gray-600 dark:text-gray-300">
                  <span>{studentA.name} ({studentA.stats?.total_solved || 0})</span>
                  <span className="uppercase text-gray-400 font-extrabold">Total Solved</span>
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
                  <span className="uppercase text-amber-500 font-extrabold">Contest Rating ⭐</span>
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
  );
};
