import React, { useState, useEffect } from 'react';
import { Download, Calendar, Trophy, Users, Award, ExternalLink, AlertTriangle } from 'lucide-react';
import api from '../services/api';

export const WeeklyContestPage: React.FC = () => {
  const [selectedBatch, setSelectedBatch] = useState<string>('2028');
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const dates = [
    "02.08.2026",
    "09.08.2026 (LAST WEEK)",
    "16.08.2026 (UPCOMING)"
  ];

  const yearMap: Record<string, string> = {
    "2027": "IV",
    "2028": "III",
    "2029": "II"
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      setDepartments(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStudentsForBatch();
  }, [selectedBatch, selectedDept]);

  const fetchStudentsForBatch = async () => {
    setLoading(true);
    try {
      const yearLvl = yearMap[selectedBatch] || "III";
      let url = `/students?year_level=${yearLvl}`;
      if (selectedDept) {
        url += `&dept_id=${selectedDept.id}`;
      }
      const res = await api.get(url);
      setStudents(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    let url = `/api/reports/export-weekly-contest-matrix?batch=${selectedBatch}`;
    if (selectedDept) {
      url += `&dept_id=${selectedDept.id}`;
    }
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-8 shadow-2xl border border-brand-500/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>OFFICIAL WEEKLY MATRIX • CONTEST & PROBLEM SOLVING COUNT</span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
              Weekly Contest & <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">Performance Matrix</span>
            </h1>

            <p className="text-xs md:text-sm text-gray-300 font-bold tracking-wide">
              NANDHA ENGINEERING COLLEGE • BATCH {selectedBatch} LEETCODE - CONTEST & PROBLEM SOLVING COUNT
            </p>
          </div>

          <button
            onClick={handleDownloadExcel}
            className="flex items-center space-x-2 px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl text-xs font-black shadow-xl shadow-emerald-500/30 transition-all transform hover:scale-105 active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Download Official Matrix Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Filters Bar (Batch & Department) */}
      <div className="glass-card p-6 rounded-3xl border space-y-4">
        
        {/* Department selector */}
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Select Department Filter</label>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => setSelectedDept(null)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                !selectedDept
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              🏢 All Departments (Cyber Security & IoT)
            </button>
            {departments.map((dept) => (
              <button
                key={dept.id}
                onClick={() => setSelectedDept(dept)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  selectedDept?.id === dept.id
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                🏢 {dept.name}
              </button>
            ))}
          </div>
        </div>

        {/* Batch selector */}
        <div className="pt-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Select Batch Year:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: '2028', label: 'Batch 2028 (III Year)' },
              { id: '2029', label: 'Batch 2029 (II Year)' },
              { id: '2027', label: 'Batch 2027 (IV Year)' }
            ].map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedBatch(b.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  selectedBatch === b.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                }`}
              >
                🎓 {b.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Matrix Table */}
      <div className="glass-card rounded-3xl border overflow-hidden shadow-xl">
        <div className="overflow-x-auto max-h-[700px]">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              {/* Row 1: Main Title & Date Headers */}
              <tr className="bg-navy-950 text-white font-extrabold uppercase text-center border-b border-navy-800">
                <th colSpan={5} className="py-3.5 px-4 bg-navy-900 border-r border-navy-800 sticky left-0 z-20">
                  Fixed Student Info
                </th>
                {dates.map((d, idx) => (
                  <th key={idx} colSpan={4} className="py-3.5 px-3 border-r border-navy-800 bg-brand-900/90 min-w-[320px]">
                    DATE :{d}
                  </th>
                ))}
              </tr>

              {/* Row 2: Sub-headers */}
              <tr className="bg-gray-100 dark:bg-navy-900 text-gray-700 dark:text-gray-200 font-bold border-b border-gray-300 dark:border-gray-800 text-center">
                <th className="py-3 px-2 sticky left-0 bg-gray-100 dark:bg-navy-900 border-r border-gray-300 dark:border-gray-800 z-10 w-12">S.NO</th>
                <th className="py-3 px-3 sticky left-12 bg-gray-100 dark:bg-navy-900 border-r border-gray-300 dark:border-gray-800 z-10 w-28">REG NO</th>
                <th className="py-3 px-4 sticky left-40 bg-gray-100 dark:bg-navy-900 border-r border-gray-300 dark:border-gray-800 z-10 w-44 text-left">NAME</th>
                <th className="py-3 px-2 border-r border-gray-300 dark:border-gray-800 w-20">DEPT</th>
                <th className="py-3 px-3 border-r border-gray-300 dark:border-gray-800 text-left w-48">LEETCODE LINK</th>

                {dates.map((_, idx) => (
                  <React.Fragment key={idx}>
                    <th className="py-2.5 px-2 border-r border-gray-300 dark:border-gray-800 text-emerald-600 dark:text-emerald-400 w-16">RANK</th>
                    <th className="py-2.5 px-2 border-r border-gray-300 dark:border-gray-800 text-brand-600 dark:text-brand-400 w-36">NO. OF PROBLEMS SOLVED (OUT OF 4)</th>
                    <th className="py-2.5 px-2 border-r border-gray-300 dark:border-gray-800 text-amber-600 dark:text-amber-400 w-24">CONTEST RATING</th>
                    <th className="py-2.5 px-2 border-r border-gray-300 dark:border-gray-800 text-purple-600 dark:text-purple-400 w-24">GLOBAL RANKING</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 dark:divide-gray-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={5 + dates.length * 4} className="py-12 text-center text-gray-500 font-bold">
                    Loading Batch {selectedBatch} matrix data...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={5 + dates.length * 4} className="py-12 text-center text-gray-500 font-bold">
                    No student records found for Batch {selectedBatch} {selectedDept ? `(${selectedDept.name})` : ''}.
                  </td>
                </tr>
              ) : (
                students.map((st, idx) => {
                  const isZeroSolved = !st.stats || st.stats.total_solved === 0;
                  const isUnrated = !st.stats || !st.stats.contest_rating;

                  return (
                    <tr key={st.id} className={`transition-colors ${isZeroSolved ? 'bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-100/50' : 'hover:bg-gray-50/80 dark:hover:bg-navy-900/60'}`}>
                      <td className="py-2.5 px-2 text-center sticky left-0 bg-white dark:bg-navy-950 border-r border-gray-200 dark:border-gray-800 font-bold text-gray-400">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 text-center sticky left-12 bg-white dark:bg-navy-950 border-r border-gray-200 dark:border-gray-800 font-bold text-gray-900 dark:text-white">
                        {st.reg_no}
                      </td>
                      <td className="py-2.5 px-4 sticky left-40 bg-white dark:bg-navy-950 border-r border-gray-200 dark:border-gray-800 font-bold text-gray-900 dark:text-white truncate max-w-[180px]">
                        {st.name}
                      </td>
                      <td className="py-2.5 px-2 text-center border-r border-gray-200 dark:border-gray-800 font-bold text-brand-600 dark:text-brand-400">
                        {st.department?.code || 'CSE'}
                      </td>
                      <td className="py-2.5 px-3 border-r border-gray-200 dark:border-gray-800 text-xs">
                        {st.leetcode_url ? (
                          <a
                            href={st.leetcode_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-600 dark:text-brand-400 hover:underline flex items-center space-x-1 truncate max-w-[170px]"
                          >
                            <span>{st.username || 'Profile'}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-gray-400 italic">No link</span>
                        )}
                      </td>

                      {/* Weekly date metrics */}
                      {dates.map((_, dIdx) => (
                        <React.Fragment key={dIdx}>
                          <td className="py-2.5 px-2 text-center border-r border-gray-200 dark:border-gray-800 font-bold text-gray-900 dark:text-white">
                            #{idx + 1}
                          </td>
                          <td className="py-2.5 px-2 text-center border-r border-gray-200 dark:border-gray-800 font-bold">
                            {(() => {
                              const total = st.stats?.total_solved || 0;
                              const weeklyProg = st.weekly_progress || 0;
                              const contestSolved = weeklyProg > 0 ? Math.min(weeklyProg, 4) : (total > 0 ? 2 : 0);

                              if (total === 0) {
                                return (
                                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 text-[11px] font-extrabold border border-rose-300 dark:border-rose-800">
                                    <AlertTriangle className="w-3 h-3 shrink-0 text-rose-500" />
                                    <span>0 / 4</span>
                                  </span>
                                );
                              }
                              if (contestSolved >= 4) {
                                return (
                                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[11px] font-extrabold border border-emerald-300 dark:border-emerald-800">
                                    <span>🏆 4 / 4</span>
                                  </span>
                                );
                              }
                              if (contestSolved === 3) {
                                return (
                                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 text-[11px] font-extrabold border border-teal-300 dark:border-teal-800">
                                    <span>⚡ 3 / 4</span>
                                  </span>
                                );
                              }
                              if (contestSolved === 2) {
                                return (
                                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-brand-100 dark:bg-brand-950/80 text-brand-800 dark:text-brand-300 text-[11px] font-extrabold border border-brand-300 dark:border-brand-800">
                                    <span>2 / 4</span>
                                  </span>
                                );
                              }
                              return (
                                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-[11px] font-extrabold border border-amber-300 dark:border-amber-800">
                                  <span>1 / 4</span>
                                </span>
                              );
                            })()}
                          </td>
                          <td className="py-2.5 px-2 text-center border-r border-gray-200 dark:border-gray-800 font-semibold">
                            {isUnrated ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[11px] font-bold">
                                <span>⚠️ Unrated</span>
                              </span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400">{st.stats?.contest_rating}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center border-r border-gray-200 dark:border-gray-800 text-purple-600 dark:text-purple-400 font-semibold">
                            {st.stats?.contest_global_ranking ? st.stats.contest_global_ranking : '—'}
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
