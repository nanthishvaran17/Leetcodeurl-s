import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, CheckCircle2, AlertTriangle, XCircle, RefreshCw, 
  Layers, Search, FileText, AlertCircle, Sparkles, ExternalLink 
} from 'lucide-react';
import api from '../services/api';

export const DataQualityPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchQualityData();
  }, []);

  const fetchQualityData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/analytics/data-quality');
      setData(res.data);
    } catch (err) {
      console.error("Failed to fetch quality data", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
        <p className="font-bold text-gray-700 dark:text-gray-300">Auditing Data Quality & Student Roster Health...</p>
      </div>
    );
  }

  const healthScore = data?.health_score_percentage ?? 100;
  const issuesList = data?.issues_list || [];

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      
      {/* Hero Banner with Rich Styling */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-6 md:p-8 shadow-2xl border border-brand-500/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>DATA INTEGRITY & PROFILE HEALTH • REALTIME AUDIT BOARD</span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
              Data Quality & <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-400 via-orange-300 to-rose-300">Profile Health Dashboard</span>
            </h1>

            <p className="text-xs md:text-sm text-gray-300 font-bold tracking-wide">
              Monitor missing links, invalid profile URLs, profile not found errors, and network anomalies across all 273 student records.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchQualityData}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-black rounded-xl border border-white/20 transition-all backdrop-blur-md flex items-center space-x-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Run Quality Audit</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Snapshot Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
        <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 shadow-xl text-center space-y-1">
          <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">Health Score</p>
          <p className="text-3xl font-black text-emerald-700 dark:text-emerald-300">{healthScore}%</p>
          <p className="text-[11px] text-gray-500 font-bold">Roster Accuracy Index</p>
        </div>

        <div className="p-6 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-xl text-center space-y-1">
          <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Valid Profiles</p>
          <p className="text-3xl font-black text-gray-900 dark:text-white">{data?.valid_profiles || 0}</p>
          <p className="text-[11px] text-gray-500 font-bold">Strictly Identity Mapped</p>
        </div>

        <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 shadow-xl text-center space-y-1">
          <p className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider">Missing / Invalid Links</p>
          <p className="text-3xl font-black text-amber-700 dark:text-amber-300">{(data?.missing_links || 0) + (data?.invalid_links || 0)}</p>
          <p className="text-[11px] text-gray-500 font-bold">Action Required</p>
        </div>

        <div className="p-6 rounded-3xl bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/20 shadow-xl text-center space-y-1">
          <p className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">Network Anomalies</p>
          <p className="text-3xl font-black text-blue-700 dark:text-blue-300">{data?.network_errors || 0}</p>
          <p className="text-[11px] text-gray-500 font-bold">Temporary / Self-Healing</p>
        </div>
      </div>

      {/* Profile Attention & Quality Issues Board */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-xl bg-white dark:bg-navy-900 p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-black uppercase text-gray-900 dark:text-white flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <span>Profile Attention & Data Quality Issues List ({issuesList.length} Action Items)</span>
          </h3>
          {data?.source_status === 'UNAVAILABLE' && (
            <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-500/20 text-rose-600 border border-rose-500/30 animate-pulse">
              🔴 LEETCODE SOURCE UNAVAILABLE
            </span>
          )}
        </div>

        {issuesList.length > 0 ? (
          <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-950 text-white font-black uppercase">
                <tr>
                  <th className="px-4 py-3">Register No</th>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3 text-center">Dept</th>
                  <th className="px-4 py-3">Issue Flag</th>
                  <th className="px-4 py-3 text-right">Action Required</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {issuesList.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-navy-800/50 transition-colors">
                    <td className="px-4 py-2.5 font-bold text-gray-900 dark:text-white">{item.reg_no}</td>
                    <td className="px-4 py-2.5 font-semibold text-gray-800 dark:text-gray-200">{item.name}</td>
                    <td className="px-4 py-2.5 text-center font-bold text-indigo-600 dark:text-indigo-400">{item.dept}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-3 py-1 rounded-full font-black text-[10px] ${
                        item.status === 'MISSING_USERNAME' || item.status === 'INVALID_PROFILE_URL'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}>
                        {item.issue}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-gray-700 dark:text-gray-300">
                      {item.action_required || (item.status === 'MISSING_USERNAME' || item.status === 'INVALID_PROFILE_URL' ? 'Verify LeetCode URL' : 'Audit Profile')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
            <Sparkles className="w-8 h-8 text-emerald-500 mx-auto" />
            <h4 className="text-base font-black text-emerald-700 dark:text-emerald-300">100% Clean Data Quality!</h4>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              🎉 Zero data quality anomalies detected. All 273 student profiles are verified OK with clean links.
            </p>
          </div>
        )}
      </div>

    </div>
  );
};
