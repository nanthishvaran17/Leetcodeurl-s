import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck } from 'lucide-react';
import api from '../services/api';

export const DataQualityPage: React.FC = () => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchQualityData();
  }, []);

  const fetchQualityData = async () => {
    try {
      const res = await api.get('/analytics/data-quality');
      setData(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      
      <div>
        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Data Quality & Profile Health Dashboard</h2>
        <p className="text-xs text-gray-500">Monitor missing links, invalid profile URLs, profile not found errors, and network anomalies</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl border text-center">
          <p className="text-xs font-semibold text-gray-400 uppercase">Health Score</p>
          <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{data?.health_score_percentage || 100}%</h3>
        </div>
        <div className="glass-card p-5 rounded-2xl border text-center">
          <p className="text-xs font-semibold text-gray-400 uppercase">Valid Profiles</p>
          <h3 className="text-3xl font-black text-gray-900 dark:text-white mt-1">{data?.valid_profiles || 0}</h3>
        </div>
        <div className="glass-card p-5 rounded-2xl border text-center">
          <p className="text-xs font-semibold text-gray-400 uppercase">Missing / Invalid Links</p>
          <h3 className="text-3xl font-black text-amber-500 mt-1">{(data?.missing_links || 0) + (data?.invalid_links || 0)}</h3>
        </div>
        <div className="glass-card p-5 rounded-2xl border text-center">
          <p className="text-xs font-semibold text-gray-400 uppercase">Not Found / Errors</p>
          <h3 className="text-3xl font-black text-rose-500 mt-1">{(data?.profile_not_found || 0) + (data?.data_unavailable || 0)}</h3>
        </div>
      </div>

      {/* Issues List */}
      <div className="glass-card p-6 rounded-3xl border space-y-4">
        <h3 className="font-bold text-base text-gray-900 dark:text-white">Profile Attention & Quality Issues List</h3>

        {data?.issues_list && data.issues_list.length > 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
            {data.issues_list.map((item: any, idx: number) => (
              <div key={idx} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900 dark:text-white">{item.name} ({item.reg_no})</p>
                  <p className="text-gray-500">{item.dept}</p>
                </div>
                <span className="px-3 py-1 rounded-full font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                  {item.issue}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-gray-500">
            🎉 All student profiles are verified OK with 100% clean data quality!
          </div>
        )}
      </div>

    </div>
  );
};
