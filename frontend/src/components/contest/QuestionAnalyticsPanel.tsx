import React, { useState, useEffect } from 'react';
import { BarChart2, Star, TrendingUp, Users, Award, Zap } from 'lucide-react';
import api from '../../services/api';

interface QuestionData {
  questionIndex: number;
  label: string;
  difficulty: string;
  totalSolved: number;
  solvePercent: number;
  notSolvedByAttended: number;
  notAttempted: number;
  firstSolver?: { name: string; regNo: string; dept: string; year: string } | null;
  deptDistribution?: Record<string, number>;
  yearDistribution?: Record<string, number>;
  difficultyRank?: number;
}

interface QuestionAnalyticsData {
  sessionId: number;
  totalAttended: number;
  totalStudents: number;
  questions: QuestionData[];
  easiest?: string;
  hardest?: string;
}

interface QuestionAnalyticsPanelProps {
  sessionId: number | null;
  // Allow live telemetry to provide fallback question progress
  liveQuestionProgress?: {
    q1?: number; q2?: number; q3?: number; q4?: number;
    totalSolved?: number;
  };
  questionStats?: Record<string, { totalSolved: number; solvePercent: number; firstSolver?: string | null }>;
}

const difficultyConfig = {
  easy: { label: 'Easy', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', bar: 'bg-emerald-500' },
  medium: { label: 'Medium', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30', bar: 'bg-purple-500' },
  medium_hard: { label: 'Med-Hard', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/30', bar: 'bg-indigo-500' },
  hard: { label: 'Hard', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30', bar: 'bg-rose-500' },
};

export const QuestionAnalyticsPanel: React.FC<QuestionAnalyticsPanelProps> = ({
  sessionId,
  liveQuestionProgress,
  questionStats,
}) => {
  const [data, setData] = useState<QuestionAnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    api.get(`/contests/sessions/${sessionId}/question-analytics`)
      .then(res => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [sessionId]);

  // Build questions array — prefer DB data, supplement with live telemetry
  const questions: QuestionData[] = data?.questions || [1,2,3,4].map(idx => ({
    questionIndex: idx,
    label: ['Q1 (Easy)', 'Q2 (Medium)', 'Q3 (Med-Hard)', 'Q4 (Hard)'][idx-1],
    difficulty: ['easy', 'medium', 'medium_hard', 'hard'][idx-1],
    totalSolved: (liveQuestionProgress as any)?.[`q${idx}`] || (questionStats as any)?.[`q${idx}`]?.totalSolved || 0,
    solvePercent: (questionStats as any)?.[`q${idx}`]?.solvePercent || 0,
    notSolvedByAttended: 0,
    notAttempted: 0,
    firstSolver: (questionStats as any)?.[`q${idx}`]?.firstSolver ? { name: (questionStats as any)?.[`q${idx}`]?.firstSolver, regNo: '', dept: '', year: '' } : null,
  }));

  return (
    <div className="p-5 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-md space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-brand-500" />
          <span>Question Analytics</span>
        </h4>
        {data && (
          <span className="text-[10px] font-mono text-gray-400">
            {data.totalAttended} participants · {data.totalStudents} total
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-4">
          <div className="w-5 h-5 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {questions.map(q => {
          const cfg = difficultyConfig[q.difficulty as keyof typeof difficultyConfig] || difficultyConfig.easy;
          const maxPossible = data?.totalAttended || 1;
          const barWidth = Math.min(100, Math.round((q.totalSolved / maxPossible) * 100));

          return (
            <div key={q.questionIndex} className={`p-4 rounded-2xl border ${cfg.bg} space-y-2.5`}>
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-black uppercase tracking-wider ${cfg.color}`}>
                  {q.label}
                </span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${cfg.bg} ${cfg.color} border`}>
                  {cfg.label}
                </span>
              </div>

              {/* Solve count */}
              <div className="text-center">
                <span className={`text-3xl font-mono font-black ${cfg.color}`}>{q.totalSolved}</span>
                <span className="text-[10px] text-gray-400 block">solved</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${cfg.bar} transition-all duration-700`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <p className={`text-[10px] font-bold text-center ${cfg.color}`}>{q.solvePercent || barWidth}% solve rate</p>

              {/* First solver */}
              {q.firstSolver && (
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-black/10 dark:bg-white/5">
                  <Star className="w-3 h-3 text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-white block truncate">{q.firstSolver.name}</span>
                    {q.firstSolver.dept && (
                      <span className="text-[9px] text-gray-400">{q.firstSolver.dept} · {q.firstSolver.year} Yr</span>
                    )}
                  </div>
                </div>
              )}

              {/* Dept distribution (top 3) */}
              {q.deptDistribution && Object.keys(q.deptDistribution).length > 0 && (
                <div className="space-y-0.5">
                  {Object.entries(q.deptDistribution)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 2)
                    .map(([dept, cnt]) => (
                      <div key={dept} className="flex items-center justify-between text-[10px]">
                        <span className="text-gray-400 truncate">{dept}</span>
                        <span className={`font-bold ${cfg.color}`}>{cnt}</span>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary row */}
      {data && (data.easiest || data.hardest) && (
        <div className="flex items-center gap-4 flex-wrap pt-1">
          {data.easiest && (
            <span className="text-[11px] text-gray-400">
              <span className="text-emerald-400 font-bold">Easiest:</span> {data.easiest}
            </span>
          )}
          {data.hardest && (
            <span className="text-[11px] text-gray-400">
              <span className="text-rose-400 font-bold">Hardest:</span> {data.hardest}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
