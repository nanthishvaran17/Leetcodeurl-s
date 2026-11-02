import React from 'react';
import { 
  Code, Sparkles, ExternalLink 
} from 'lucide-react';

interface RecentSubmission {
  title: string;
  title_slug: string;
  lang: string;
  status: string;
  runtime?: string;
  memory?: string;
  date?: string;
  timestamp?: string;
}

interface StudentPlacementAndContestOverviewProps {
  totalSolved?: number;
  easySolved?: number;
  mediumSolved?: number;
  hardSolved?: number;
  contestRating?: number | null;
  recentSubmissions?: RecentSubmission[];
  studentName?: string;
}

export const StudentPlacementAndContestOverview: React.FC<StudentPlacementAndContestOverviewProps> = ({
  recentSubmissions = [],
}) => {
  return (
    <div className="space-y-6">
      {/* Recent Submissions Timeline */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-black/40 relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Code className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Recent Submissions
              </h3>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                Latest accepted algorithmic solutions verified from LeetCode
              </p>
            </div>
          </div>

          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {recentSubmissions.length} Recent Verified
          </span>
        </div>

        {recentSubmissions.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            <Sparkles className="w-6 h-6 mx-auto mb-1.5 opacity-30" />
            <p>No recent submissions synced yet. Click "Sync Live" to fetch latest activity.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {recentSubmissions.map((sub, idx) => (
              <a
                key={idx}
                href={`https://leetcode.com/problems/${sub.title_slug}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="group p-3 rounded-2xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5 hover:border-brand-500/40 hover:-translate-y-0.5 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-500/20">
                      {sub.status || 'Accepted'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300">
                      {sub.lang}
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-brand-500 transition-colors line-clamp-2">
                    {sub.title}
                  </h4>
                </div>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/60 dark:border-white/5 text-[10px] text-slate-400">
                  <span>{sub.date || 'Recent'}</span>
                  <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-brand-500 transition-colors" />
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentPlacementAndContestOverview;
