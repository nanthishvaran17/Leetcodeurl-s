import React, { useState, useEffect } from 'react';
import { X, User, ExternalLink, CheckCircle2, XCircle, TrendingUp, TrendingDown, Minus, Shield, Clock, Award } from 'lucide-react';
import { GlobalModalBackdrop } from '../GlobalModalBackdrop';
import api from '../../services/api';

interface StudentDeepDiveDrawerProps {
  student: any | null;
  sessionId: number | null;
  contestName?: string;
  onClose: () => void;
}

const QBadge = ({ solved, q }: { solved: boolean; q: number }) => {
  const colors = ['emerald','purple','indigo','rose'];
  const c = colors[q-1] || 'gray';
  return solved
    ? <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-${c}-500/20 text-${c}-400 border border-${c}-500/30 text-[11px] font-bold`}><CheckCircle2 className="w-3 h-3" />Q{q}</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700 text-[11px] font-bold"><XCircle className="w-3 h-3" />Q{q}</span>;
};

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    PUBLIC: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    PUBLIC_ATTENDED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    ATTENDED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    VIRTUAL: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    VIRTUAL_ATTENDED: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    NOT_ATTENDED: 'bg-slate-800 text-slate-400 border-slate-700',
    DATA_ERROR: 'bg-red-500/20 text-red-400 border-red-500/30',
    PENDING: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  };
  return map[status] || 'bg-slate-800 text-slate-400 border-slate-700';
};

export const StudentDeepDiveDrawer: React.FC<StudentDeepDiveDrawerProps> = ({ student, sessionId, contestName, onClose }) => {
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [loadingComp, setLoadingComp] = useState(false);

  useEffect(() => {
    if (!student || !sessionId) return;
    setComparisonData(null);
    setLoadingComp(true);
    const stId = student?.student_id || student?.id;
    api.get(`/contests/sessions/${sessionId}/comparison?studentId=${stId}`)
      .then(res => setComparisonData(res.data))
      .catch(() => {})
      .finally(() => setLoadingComp(false));
  }, [student?.student_id || student?.id, sessionId]);

  if (!student) return null;

  const totalSolved = Number(student.total_solved || student.total_contest_solved) || 0;
  const q1 = Number(student.q1) > 0;
  const q2 = Number(student.q2) > 0;
  const q3 = Number(student.q3) > 0;
  const q4 = Number(student.q4) > 0;
  const status = student.participation_status || student.status || 'UNKNOWN';
  const isAttended = ['PUBLIC','PUBLIC_ATTENDED','ATTENDED','VIRTUAL','VIRTUAL_ATTENDED'].includes(status);
  const rank = student.rank || student.contest_rank;
  const rating = student.rating || student.contest_rating;

  // Week-over-week delta
  const prevWeekSolved = comparisonData?.previousWeek?.publicAttended != null
    ? null // participation, not individual
    : null;

  return (
    <GlobalModalBackdrop isOpen={true} onClose={onClose} className="flex justify-end">
      {/* Drawer */}
      <div className="h-full w-full max-w-md bg-slate-950 border-l border-white/10 shadow-2xl z-50 overflow-y-auto flex flex-col animate-slide-in-right relative" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-gradient-to-r from-slate-950 to-navy-950 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">{student.name}</h3>
              <p className="text-[11px] font-mono text-slate-400">{student.reg_no}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 p-6 space-y-5">
          {/* Student identity */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Student Profile</span>
              {student.username && (
                <a
                  href={student.profile_url || student.leetcode_url || `https://leetcode.com/u/${student.username}/`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-brand-400 hover:text-brand-300 font-bold"
                >
                  <ExternalLink className="w-3 h-3" />
                  LC: {student.username}
                </a>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-500 block">Department</span>
                <span className="text-indigo-300 font-bold">{student.dept || student.department || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Year</span>
                <span className="text-purple-300 font-bold">{student.year || student.year_level || '—'} Year</span>
              </div>
              {student.profile_rank && student.profile_rank !== '—' && (
                <div>
                  <span className="text-slate-500 block">LC Global Rank</span>
                  <span className="text-amber-300 font-bold">#{student.profile_rank}</span>
                </div>
              )}
              {student.profile_total_solved && (
                <div>
                  <span className="text-slate-500 block">Total LCProblems</span>
                  <span className="text-emerald-300 font-bold">{student.profile_total_solved}</span>
                </div>
              )}
            </div>
          </div>

          {/* Contest performance */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1">
                <Award className="w-3 h-3" /> {contestName || 'Contest'} Performance
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${statusBadge(status)}`}>
                {status.replace('_', ' ')}
              </span>
            </div>

            {isAttended ? (
              <>
                {/* Q1-Q4 badges */}
                <div className="flex flex-wrap gap-1.5">
                  <QBadge solved={q1} q={1} />
                  <QBadge solved={q2} q={2} />
                  <QBadge solved={q3} q={3} />
                  <QBadge solved={q4} q={4} />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="p-2 rounded-xl bg-black/30">
                    <span className="text-slate-500 block">Solved</span>
                    <span className="text-2xl font-mono font-black text-white">{totalSolved}<span className="text-slate-500 text-sm">/4</span></span>
                  </div>
                  <div className="p-2 rounded-xl bg-black/30">
                    <span className="text-slate-500 block">LC Rank</span>
                    <span className="text-lg font-mono font-black text-amber-400">{rank ? `#${rank}` : '—'}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-black/30">
                    <span className="text-slate-500 block">Rating</span>
                    <span className="text-lg font-mono font-black text-indigo-400">{rating || '—'}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Shield className="w-4 h-4 text-slate-600" />
                <span>{status === 'PENDING' ? 'Awaiting verification...' : 'Did not participate in this contest.'}</span>
              </div>
            )}
          </div>

          {/* Week comparison */}
          {comparisonData && (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Week-over-Week (Session Level)
              </span>
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <span className="text-slate-500 block">{comparisonData.previousWeek?.contestName || 'Prev Contest'}</span>
                  <span className="font-bold text-slate-300">{comparisonData.previousWeek?.publicAttended || 0} participated</span>
                </div>
                <div>
                  <span className="text-slate-500 block">{comparisonData.currentWeek?.contestName || 'This Contest'}</span>
                  <span className="font-bold text-slate-300">{comparisonData.currentWeek?.publicAttended || 0} participated</span>
                </div>
              </div>
              <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl ${
                comparisonData.comparison?.comparisonStatus === 'IMPROVED'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : comparisonData.comparison?.comparisonStatus === 'DECLINED'
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-slate-800 text-slate-400'
              }`}>
                {comparisonData.comparison?.comparisonStatus === 'IMPROVED' ? <TrendingUp className="w-3 h-3" />
                  : comparisonData.comparison?.comparisonStatus === 'DECLINED' ? <TrendingDown className="w-3 h-3" />
                    : <Minus className="w-3 h-3" />
                }
                {comparisonData.comparison?.status || 'NO CHANGE'}
              </div>
            </div>
          )}
          {loadingComp && (
            <div className="flex items-center gap-2 text-slate-500 text-xs">
              <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              Loading comparison...
            </div>
          )}

          {/* Source info */}
          <div className="p-3 rounded-xl bg-white/3 border border-white/5 text-[10px] text-slate-500 space-y-1 font-mono">
            <div className="flex justify-between">
              <span>Fetch Status</span>
              <span className={student.fetch_status === 'SUCCESS' ? 'text-emerald-400' : 'text-amber-400'}>
                {student.fetch_status || student.source_status || '—'}
              </span>
            </div>
            {student.error_reason && (
              <div className="flex justify-between">
                <span>Error</span>
                <span className="text-red-400 truncate max-w-[200px]">{student.error_reason}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </GlobalModalBackdrop>
  );
};
