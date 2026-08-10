import React, { useState } from 'react';
import { BarChart3, Users, ArrowRight } from 'lucide-react';
import api from '../services/api';

export const ComparePage: React.FC = () => {
  const [ids, setIds] = useState('1, 2');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleCompare = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/analytics/compare-students?ids=${ids}`);
      setData(res.data);
    } catch (err: any) {
      alert("Failed to compare students");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      <div>
        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Student Performance Comparison</h2>
        <p className="text-xs text-gray-500">Compare total solved problems, contest ratings, streaks, and ranks side-by-side</p>
      </div>

      <div className="glass-card p-4 rounded-2xl border flex items-center space-x-3">
        <input
          type="text"
          value={ids}
          onChange={(e) => setIds(e.target.value)}
          placeholder="Enter student IDs separated by comma (e.g. 1, 2, 3)"
          className="flex-1 px-4 py-2.5 rounded-xl border text-sm bg-white dark:bg-navy-900"
        />
        <button
          onClick={handleCompare}
          className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs"
        >
          Compare Students
        </button>
      </div>

      {data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.map((item, idx) => {
            const s = item.student;
            return (
              <div key={idx} className="glass-card p-6 rounded-3xl border space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h3 className="font-extrabold text-lg text-gray-900 dark:text-white">{s.name}</h3>
                    <p className="text-xs text-gray-500">{s.reg_no} • {s.department?.code} ({s.year_level} Yr)</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300">
                    College Rank #{s.college_rank || '—'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40">
                    <p className="text-gray-400 font-semibold">Total Solved</p>
                    <h4 className="text-xl font-bold text-gray-900 dark:text-white mt-1">{s.stats?.total_solved || 0}</h4>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40">
                    <p className="text-gray-400 font-semibold">Contest Rating</p>
                    <h4 className="text-xl font-bold text-gray-900 dark:text-white mt-1">{s.stats?.contest_rating || '—'}</h4>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40">
                    <p className="text-gray-400 font-semibold">Weekly Progress</p>
                    <h4 className="text-xl font-bold text-emerald-600 mt-1">+{s.weekly_progress || 0}</h4>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40">
                    <p className="text-gray-400 font-semibold">Active Streak</p>
                    <h4 className="text-xl font-bold text-amber-500 mt-1">🔥 {s.streak_count || 0}w</h4>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
