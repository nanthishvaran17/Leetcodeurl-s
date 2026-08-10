import React, { useState, useEffect } from 'react';
import { Trophy, Award, CheckCircle2, AlertTriangle, Layers, Calendar, UserCheck } from 'lucide-react';
import api from '../services/api';

export interface BatchMatrixRow {
  batch: string;
  total_count: number;
  above_500: number | string;
  range_250_500: number | string;
  less_than_250: number | string;
  less_than_100: number | string;
  not_yet_started: number | string;
  q4_solved: number | string;
  q3_solved: number | string;
  q2_solved: number | string;
  q1_solved: number | string;
  rating_above_1500?: number | string;
  ranking_below_20000?: number | string;
}

export const BatchPerformanceMatrix: React.FC = () => {
  const [matrixData, setMatrixData] = useState<BatchMatrixRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchMatrix();
  }, []);

  const fetchMatrix = async () => {
    try {
      const res = await api.get('/analytics/batch-matrix');
      setMatrixData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card rounded-3xl border p-6 space-y-6 shadow-xl">
      
      {/* Official Academic Header Banner */}
      <div className="bg-gradient-to-r from-navy-950 via-slate-900 to-navy-950 p-5 rounded-2xl text-white border border-navy-800 shadow-md space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-gray-300 border-b border-white/10 pb-2">
          <span className="font-mono font-bold text-emerald-400">Date: 10.08.2026</span>
          <span className="font-black tracking-wider text-amber-400 uppercase">NANDHA ENGINEERING COLLEGE (AUTONOMOUS)</span>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-black tracking-tight text-white flex items-center space-x-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <span>Leetcode Performance - Weekly Report</span>
            </h2>
            <p className="text-xs text-brand-300 font-semibold mt-0.5">
              Comprehensive Multi-Batch Performance & Contest Ranking Analysis
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs bg-white/10 px-3.5 py-1.5 rounded-xl border border-white/20">
            <UserCheck className="w-4 h-4 text-cyan-300" />
            <span className="font-medium text-gray-200">
              Name & Designation of the Academic Coordinator: <b className="text-white font-bold">HOD / Academic Lead (CSE)</b>
            </span>
          </div>
        </div>
      </div>

      {/* Grid Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800 shadow-inner">
        <table className="w-full text-xs text-center border-collapse">
          <thead>
            {/* Header Row 1 */}
            <tr className="bg-navy-950 text-white font-extrabold uppercase text-center border-b border-navy-800">
              <th rowSpan={2} className="py-3.5 px-4 bg-navy-900 border-r border-navy-800 text-left min-w-[210px]">
                Batch
              </th>
              <th rowSpan={2} className="py-3.5 px-3 bg-navy-900/90 border-r border-navy-800 w-28">
                Number of Students<br />(Total Count)
              </th>
              <th colSpan={5} className="py-2.5 px-3 bg-brand-950 border-r border-brand-900">
                Number of Problems Solved
              </th>
              <th colSpan={4} className="py-2.5 px-3 bg-indigo-950 border-r border-indigo-900">
                Weekly Contest Attended: (give the count here)
              </th>
              <th colSpan={2} className="py-2.5 px-3 bg-purple-950">
                Leetcode Contest Rating and Ranking
              </th>
            </tr>

            {/* Header Row 2 */}
            <tr className="bg-gray-100 dark:bg-navy-900 text-gray-700 dark:text-gray-200 font-extrabold text-[11px] border-b border-gray-300 dark:border-gray-800">
              {/* Problem solved columns */}
              <th className="py-2 px-3 border-r border-gray-300 dark:border-gray-800 text-emerald-600 dark:text-emerald-400">Above 500</th>
              <th className="py-2 px-3 border-r border-gray-300 dark:border-gray-800 text-teal-600 dark:text-teal-400">250 - 500</th>
              <th className="py-2 px-3 border-r border-gray-300 dark:border-gray-800 text-brand-600 dark:text-brand-400">Less than 250</th>
              <th className="py-2 px-3 border-r border-gray-300 dark:border-gray-800 text-amber-600 dark:text-amber-400">Less than 100</th>
              <th className="py-2 px-3 border-r border-gray-300 dark:border-gray-800 text-rose-600 dark:text-rose-400">Not yet started</th>

              {/* Contest Attended columns */}
              <th className="py-2 px-3 border-r border-gray-300 dark:border-gray-800 text-emerald-600 dark:text-emerald-400">4 Q Solved</th>
              <th className="py-2 px-3 border-r border-gray-300 dark:border-gray-800 text-teal-600 dark:text-teal-400">3 Q Solved</th>
              <th className="py-2 px-3 border-r border-gray-300 dark:border-gray-800 text-brand-600 dark:text-brand-400">2 Q Solved</th>
              <th className="py-2 px-3 border-r border-gray-300 dark:border-gray-800 text-amber-600 dark:text-amber-400">1 Q Solved</th>

              {/* Contest Rating & Ranking columns */}
              <th className="py-2 px-3 border-r border-gray-300 dark:border-gray-800 text-purple-600 dark:text-purple-400">Rating: Above 1500</th>
              <th className="py-2 px-3 text-indigo-600 dark:text-indigo-400">Ranking: Below 20000</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 dark:divide-gray-800 font-semibold">
            {loading ? (
              <tr>
                <td colSpan={13} className="py-8 text-center text-gray-500 font-bold">
                  Loading Executive Batch Matrix...
                </td>
              </tr>
            ) : matrixData.length === 0 ? (
              <tr>
                <td colSpan={13} className="py-8 text-center text-gray-500 font-bold">
                  No batch matrix data available.
                </td>
              </tr>
            ) : (
              matrixData.map((row, idx) => {
                const isCurrentWeek = row.batch.includes('(Current Week)');

                return (
                  <tr
                    key={idx}
                    className={`transition-colors ${
                      isCurrentWeek
                        ? 'bg-brand-50/40 dark:bg-brand-950/20 font-bold text-gray-900 dark:text-white'
                        : 'bg-white dark:bg-navy-950 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <td className="py-3 px-4 text-left font-black border-r border-gray-200 dark:border-gray-800">
                      {row.batch}
                    </td>

                    <td className="py-3 px-3 font-black text-center border-r border-gray-200 dark:border-gray-800 text-brand-600 dark:text-brand-400">
                      {row.total_count}
                    </td>

                    {/* Solve Counts */}
                    <td className="py-3 px-3 border-r border-gray-200 dark:border-gray-800 font-black text-emerald-600 dark:text-emerald-400">
                      {row.above_500 || '—'}
                    </td>
                    <td className="py-3 px-3 border-r border-gray-200 dark:border-gray-800 font-black text-teal-600 dark:text-teal-400">
                      {row.range_250_500 || '—'}
                    </td>
                    <td className="py-3 px-3 border-r border-gray-200 dark:border-gray-800 font-bold text-brand-600 dark:text-brand-400">
                      {row.less_than_250 || '—'}
                    </td>
                    <td className="py-3 px-3 border-r border-gray-200 dark:border-gray-800 font-bold text-amber-600 dark:text-amber-400">
                      {row.less_than_100 || '—'}
                    </td>
                    <td className="py-3 px-3 border-r border-gray-200 dark:border-gray-800 font-bold text-rose-500">
                      {row.not_yet_started || '—'}
                    </td>

                    {/* Contest Counts */}
                    <td className="py-3 px-3 border-r border-gray-200 dark:border-gray-800 font-black text-emerald-600 dark:text-emerald-400">
                      {row.q4_solved || '—'}
                    </td>
                    <td className="py-3 px-3 border-r border-gray-200 dark:border-gray-800 font-black text-teal-600 dark:text-teal-400">
                      {row.q3_solved || '—'}
                    </td>
                    <td className="py-3 px-3 border-r border-gray-200 dark:border-gray-800 font-bold text-brand-600 dark:text-brand-400">
                      {row.q2_solved || '—'}
                    </td>
                    <td className="py-3 px-3 border-r border-gray-200 dark:border-gray-800 font-bold text-amber-600 dark:text-amber-400">
                      {row.q1_solved || '—'}
                    </td>

                    {/* Contest Rating & Ranking */}
                    <td className="py-3 px-3 border-r border-gray-200 dark:border-gray-800 font-black text-purple-600 dark:text-purple-400">
                      {row.rating_above_1500 || '—'}
                    </td>
                    <td className="py-3 px-3 font-black text-indigo-600 dark:text-indigo-400">
                      {row.ranking_below_20000 || '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};
