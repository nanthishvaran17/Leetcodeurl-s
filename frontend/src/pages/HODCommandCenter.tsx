import React, { useState, useEffect } from 'react';
import { 
  Building2, Activity, Award, TrendingUp, Search, Send, Sparkles, Sliders, 
  CheckCircle2, AlertTriangle, FileText, Download, ShieldAlert, BarChart3, RefreshCw
} from 'lucide-react';
import { 
  getHODCommandCenterData, getInstitutionalBenchmarks, 
  simulateWhatIfScenario, askAIDepartmentQuery 
} from '../services/intelligenceService';

export const HODCommandCenter: React.FC = () => {
  const [commandData, setCommandData] = useState<any>(null);
  const [benchmarks, setBenchmarks] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // What-If Scenario Simulator State
  const [targetPartPct, setTargetPartPct] = useState<number>(87);
  const [scenarioResult, setScenarioResult] = useState<any>(null);

  // AI Department Query State
  const [queryInput, setQueryInput] = useState<string>('');
  const [queryResponse, setQueryResponse] = useState<any>(null);
  const [queryLoading, setQueryLoading] = useState<boolean>(false);

  useEffect(() => {
    loadHODData();
  }, []);

  const loadHODData = async () => {
    setLoading(true);
    try {
      const [cmd, bench] = await Promise.all([
        getHODCommandCenterData(),
        getInstitutionalBenchmarks()
      ]);
      setCommandData(cmd);
      setBenchmarks(bench);

      // Run initial simulation
      const currentPart = cmd?.department_health?.participation_score || 72;
      const currentAtRisk = cmd?.department_health?.at_risk_count || 12;
      const sim = await simulateWhatIfScenario(currentPart, targetPartPct, currentAtRisk);
      setScenarioResult(sim);
    } catch (err) {
      console.error("Failed to load HOD Command Center data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunSimulation = async (newVal: number) => {
    setTargetPartPct(newVal);
    if (!commandData) return;
    const currentPart = commandData.department_health.participation_score || 72;
    const currentAtRisk = commandData.department_health.at_risk_count || 12;
    const sim = await simulateWhatIfScenario(currentPart, newVal, currentAtRisk);
    setScenarioResult(sim);
  };

  const handleAskAIQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryInput.trim()) return;

    setQueryLoading(true);
    try {
      const res = await askAIDepartmentQuery(queryInput);
      setQueryResponse(res);
    } catch (err) {
      console.error("AI Department Query failed:", err);
    } finally {
      setQueryLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center bg-white dark:bg-navy-900 rounded-3xl border border-gray-200 dark:border-gray-800 space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-brand-500" />
        <p className="text-sm font-bold text-gray-600 dark:text-gray-300">Computing Department Coding Health & Executive Intelligence...</p>
      </div>
    );
  }

  const health = commandData?.department_health || {};
  const summary = commandData?.executive_summary || {};

  return (
    <div className="space-y-6">

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <Building2 className="w-7 h-7 text-brand-500 stroke-[2.5]" />
            <span>Department Coding Command Center & Executive Hub</span>
          </h1>
          <p className="text-xs text-gray-500 font-bold mt-0.5">
            Coding Health Score (0-100) • Institutional Benchmarking • What-If Simulator • AI Query
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadHODData}
            className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-navy-800 transition-colors cursor-pointer"
            title="Refresh Intelligence Data"
          >
            <RefreshCw className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      </div>

      {/* ── 1. DEPARTMENT CODING HEALTH SCORE (0-100) HERO CARD ── */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white border border-navy-800 shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          
          <div className="space-y-1">
            <span className="px-3 py-1 rounded-xl text-xs font-black bg-brand-500/20 text-brand-400 border border-brand-500/30 uppercase tracking-wider">
              NANDHA ENGINEERING COLLEGE • CODING HEALTH SCORE
            </span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight pt-1">
              {health.health_score} <span className="text-xl text-gray-400 font-bold">/ 100</span>
            </h2>
            <p className="text-xs font-bold text-gray-300">
              Department Coding Health evaluated across 5 core institutional quality dimensions.
            </p>
          </div>

          {/* Key Executive Counts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 text-center">
              <span className="text-[10px] font-extrabold uppercase text-gray-400 block">Total Students</span>
              <span className="text-xl font-black text-white">{health.total_students}</span>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 text-center">
              <span className="text-[10px] font-extrabold uppercase text-gray-400 block">Active This Week</span>
              <span className="text-xl font-black text-emerald-400">{health.active_this_week}</span>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 text-center">
              <span className="text-[10px] font-extrabold uppercase text-gray-400 block">At-Risk Count</span>
              <span className="text-xl font-black text-rose-400">{health.at_risk_count}</span>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 text-center">
              <span className="text-[10px] font-extrabold uppercase text-gray-400 block">Improving</span>
              <span className="text-xl font-black text-indigo-400">{health.improving_count}</span>
            </div>
          </div>

        </div>

        {/* 5 Component Breakdown Progress Bars */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 pt-4 border-t border-white/10 text-xs">
          <div>
            <div className="flex justify-between font-bold text-gray-300 mb-1">
              <span>Participation</span>
              <strong className="text-brand-400">{health.participation_score}%</strong>
            </div>
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
              <div className="bg-brand-500 h-full rounded-full" style={{ width: `${health.participation_score}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between font-bold text-gray-300 mb-1">
              <span>Consistency</span>
              <strong className="text-emerald-400">{health.consistency_score}%</strong>
            </div>
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${health.consistency_score}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between font-bold text-gray-300 mb-1">
              <span>Growth</span>
              <strong className="text-indigo-400">{health.growth_score}%</strong>
            </div>
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
              <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${health.growth_score}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between font-bold text-gray-300 mb-1">
              <span>Contest Perf.</span>
              <strong className="text-purple-400">{health.contest_performance_score}%</strong>
            </div>
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
              <div className="bg-purple-500 h-full rounded-full" style={{ width: `${health.contest_performance_score}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between font-bold text-gray-300 mb-1">
              <span>Difficulty</span>
              <strong className="text-amber-400">{health.difficulty_progress_score}%</strong>
            </div>
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
              <div className="bg-amber-500 h-full rounded-full" style={{ width: `${health.difficulty_progress_score}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. EXECUTIVE "WHAT IS HAPPENING?" SUMMARY PANEL ── */}
      <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-xl space-y-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Sparkles className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white">{summary.executive_title}</h2>
            <p className="text-xs text-gray-500 font-bold">Automated Executive Intelligence Answers • {summary.timestamp}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
            <span className="font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">What Improved?</span>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed font-semibold">{summary.what_improved}</p>
          </div>

          <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-1">
            <span className="font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider block">What Declined?</span>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed font-semibold">{summary.what_declined}</p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-1">
            <span className="font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Weakest Skill Gap</span>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed font-semibold">{summary.weakest_skill}</p>
          </div>

          <div className="p-4 rounded-2xl bg-brand-500/5 border border-brand-500/20 space-y-1">
            <span className="font-black text-brand-600 dark:text-brand-400 uppercase tracking-wider block">Recommended Intervention</span>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed font-semibold">{summary.recommended_intervention}</p>
          </div>
        </div>
      </div>

      {/* ── 3. NATURAL-LANGUAGE AI DEPARTMENT QUERY INTERFACE ── */}
      <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-xl space-y-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Search className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white">Natural-Language AI Department Query</h2>
            <p className="text-xs text-gray-500 font-bold">Ask any academic/performance question — Zero Hallucination, Database-Backed Insights</p>
          </div>
        </div>

        <form onSubmit={handleAskAIQuery} className="flex gap-3">
          <input
            type="text"
            placeholder="e.g. 'Which students need attention this week?' or 'Which section improved the most?'"
            value={queryInput}
            onChange={e => setQueryInput(e.target.value)}
            className="flex-1 px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-navy-950 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-brand-500 shadow-inner"
          />
          <button
            type="submit"
            disabled={queryLoading}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-black text-xs shadow-md transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            {queryLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>Ask AI</span>
          </button>
        </form>

        {queryResponse && (
          <div className="p-5 rounded-2xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white space-y-3 shadow-xl">
            <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
              <span className="font-bold text-brand-400">Query: "{queryResponse.query}"</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-extrabold text-[10px]">
                Data Confidence: {queryResponse.data_confidence}
              </span>
            </div>

            <p className="text-xs leading-relaxed font-medium text-gray-200 whitespace-pre-line">
              {queryResponse.answer}
            </p>

            {queryResponse.traceable_metrics && queryResponse.traceable_metrics.length > 0 && (
              <div className="pt-2 border-t border-white/10 text-[11px] space-y-1 text-gray-300">
                <span className="font-bold text-gray-400 block">Traceable Database Metrics:</span>
                {queryResponse.traceable_metrics.map((m: string, i: number) => (
                  <span key={i} className="block">• {m}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 4. WHAT-IF SCENARIO SIMULATOR (HOD / MANAGEMENT ONLY) ── */}
      <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Sliders className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white">What-If Scenario Simulator</h2>
              <p className="text-xs text-gray-500 font-bold">Simulate Participation & Growth Policy Adjustments (HOD / Management Only)</p>
            </div>
          </div>

          <span className="px-3 py-1 rounded-xl text-[10px] font-black bg-amber-500/10 text-amber-600 border border-amber-500/20 uppercase">
            {scenarioResult?.disclaimer || 'Scenario Estimate'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Slider Control */}
          <div className="space-y-4 p-5 rounded-2xl bg-gray-50 dark:bg-navy-950/60 border border-gray-200 dark:border-navy-800">
            <div className="flex justify-between items-center text-xs font-extrabold">
              <span className="text-gray-700 dark:text-gray-300">Simulated Target Participation Rate:</span>
              <span className="text-brand-500 text-base font-black">{targetPartPct}%</span>
            </div>

            <input
              type="range"
              min="50"
              max="100"
              value={targetPartPct}
              onChange={e => handleRunSimulation(Number(e.target.value))}
              className="w-full accent-brand-500 cursor-pointer"
            />

            <div className="flex justify-between text-[10px] font-bold text-gray-400">
              <span>Baseline: 72%</span>
              <span>Target: 87%</span>
              <span>Maximum: 100%</span>
            </div>
          </div>

          {/* Estimated Projected Outcome */}
          {scenarioResult && (
            <div className="p-5 rounded-2xl bg-gradient-to-r from-navy-950 to-indigo-950 text-white space-y-3">
              <span className="text-[11px] font-black uppercase text-amber-400 block">Projected Academic Outcome</span>
              
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-gray-400 block">Growth Boost:</span>
                  <span className="text-lg font-black text-emerald-400">{scenarioResult.estimated_growth_boost_pct}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Avg Rating Boost:</span>
                  <span className="text-lg font-black text-brand-400">{scenarioResult.estimated_avg_rating_boost}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 text-xs">
                <span className="text-gray-400 block font-bold">At-Risk Reduction Projection:</span>
                <span className="text-sm font-black text-white">{scenarioResult.risk_reduction_label}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 5. INSTITUTIONAL BENCHMARKING MATRIX ── */}
      {benchmarks && (
        <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-xl space-y-4">
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white">Institutional Benchmarking Matrix</h2>
            <p className="text-xs text-gray-500 font-bold">Department vs Department & Year Level Performance Matrix</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-[11px] font-black text-gray-400 uppercase tracking-wider bg-gray-50/50 dark:bg-navy-950/50">
                  <th className="p-3.5">Department</th>
                  <th className="p-3.5">Students</th>
                  <th className="p-3.5">Avg Rating</th>
                  <th className="p-3.5">Avg Solved</th>
                  <th className="p-3.5">Participation %</th>
                  <th className="p-3.5">Health Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs font-semibold">
                {benchmarks.department_matrix.map((d: any) => (
                  <tr key={d.department_id} className="hover:bg-gray-50/80 dark:hover:bg-navy-800/40 transition-colors">
                    <td className="p-3.5 font-extrabold text-gray-900 dark:text-white">
                      {d.department_name} ({d.department_code})
                    </td>
                    <td className="p-3.5 text-gray-600 dark:text-gray-300">{d.student_count}</td>
                    <td className="p-3.5 font-black text-indigo-500">{d.avg_rating}</td>
                    <td className="p-3.5 font-black text-brand-500">{d.avg_solved}</td>
                    <td className="p-3.5 text-gray-600 dark:text-gray-300">{d.participation_rate_pct}%</td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 font-black">
                        {d.health_score} / 100
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
