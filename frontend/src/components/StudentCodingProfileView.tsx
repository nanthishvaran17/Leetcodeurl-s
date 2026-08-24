import React, { useState, useEffect } from 'react';
import { 
  Award, Zap, CheckCircle2, AlertTriangle, TrendingUp, ShieldAlert, 
  BookOpen, Target, Calendar, Flame, Activity, ChevronRight, Sparkles, RefreshCw, BarChart2
} from 'lucide-react';
import { getStudentDigitalProfile, DigitalCodingProfile } from '../services/intelligenceService';

interface StudentCodingProfileViewProps {
  studentId: number;
  onOpenIntervention?: (studentId: number, name: string) => void;
}

export const StudentCodingProfileView: React.FC<StudentCodingProfileViewProps> = ({ 
  studentId,
  onOpenIntervention 
}) => {
  const [profile, setProfile] = useState<DigitalCodingProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, [studentId]);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStudentDigitalProfile(studentId);
      setProfile(data);
    } catch (err: any) {
      console.error("Failed to load student digital profile:", err);
      setError("Unable to load student intelligence profile. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center bg-white dark:bg-navy-900 rounded-3xl border border-gray-200 dark:border-gray-800 space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-brand-500" />
        <p className="text-sm font-bold text-gray-600 dark:text-gray-300">Evaluating AI Coding Intelligence & DSA Skill Map...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-6 text-center bg-rose-50 dark:bg-rose-950/40 rounded-3xl border border-rose-200 dark:border-rose-900 text-rose-600 font-bold text-sm">
        {error || 'No student profile data available.'}
      </div>
    );
  }

  const { risk_engine, contest_readiness, consistency_intelligence, dsa_topic_scores, learning_path } = profile;

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
      case 'HIGH': return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30';
      case 'MODERATE': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      default: return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    }
  };

  return (
    <div className="space-y-6">

      {/* ── 1. DIGITAL CODING PROFILE HEADER CARD ── */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white border border-navy-800 shadow-lg space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          
          {/* Identity & Level */}
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-500 to-indigo-600 flex items-center justify-center font-black text-2xl text-white shadow-xl shadow-brand-500/30 shrink-0">
              {profile.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">{profile.name}</h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>VERIFIED</span>
                </span>
              </div>
              <p className="text-xs font-mono font-bold text-slate-300 mt-0.5">
                {profile.reg_no}
              </p>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">
                {profile.department} • {profile.year_level} Year
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center">
              <span className="text-[10px] font-extrabold uppercase text-gray-400 block">Overall Score</span>
              <span className="text-xl font-black text-brand-400">{profile.overall_score}/100</span>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center">
              <span className="text-[10px] font-extrabold uppercase text-gray-400 block">Contest Skill</span>
              <span className="text-xl font-black text-indigo-400">{profile.contest_skill}</span>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center">
              <span className="text-[10px] font-extrabold uppercase text-gray-400 block">DSA Skill</span>
              <span className="text-xl font-black text-purple-400">{profile.dsa_skill}</span>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center">
              <span className="text-[10px] font-extrabold uppercase text-gray-400 block">Consistency</span>
              <span className="text-xl font-black text-emerald-400">{profile.consistency_score}%</span>
            </div>
          </div>

        </div>

        {/* Strong / Weak Summary Pills */}
        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/10 text-xs">
          <span className="font-bold text-gray-400">Strong Areas:</span>
          {profile.strong_areas.map(t => (
            <span key={t} className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {t}
            </span>
          ))}

          <span className="font-bold text-gray-400 ml-2">Weak Areas:</span>
          {profile.weak_areas.map(t => (
            <span key={t} className="px-2.5 py-1 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> {t}
            </span>
          ))}
        </div>
      </div>

      {/* ── 2. EXPLAINABLE AI RISK PREDICTION ENGINE PANEL ── */}
      <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <ShieldAlert className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">AI Risk Prediction & Early Disengagement Warning</h3>
              <p className="text-xs text-gray-500 font-bold">10-Signal Automated Risk Scoring & Explainable AI Diagnosis</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className={`px-3 py-1 rounded-xl text-xs font-black border ${getRiskBadgeColor(risk_engine.risk_level)}`}>
              RISK SCORE: {risk_engine.risk_score}/100 ({risk_engine.risk_level})
            </span>
            <span className="text-xs font-bold text-gray-500 bg-gray-100 dark:bg-navy-800 px-3 py-1 rounded-xl">
              Confidence: {risk_engine.confidence_pct}%
            </span>
          </div>
        </div>

        {/* Disengagement Alert Banner */}
        {risk_engine.is_silent_disengaged && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start space-x-3 text-amber-700 dark:text-amber-300 text-xs font-semibold">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-black text-sm text-amber-600 dark:text-amber-400">EARLY DISENGAGEMENT DETECTED</strong>
              Student problem-solving velocity dropped by -{risk_engine.disengagement_drop_pct}% over the previous 4 weeks. Early warning generated before critical failure.
            </div>
          </div>
        )}

        {/* Explainable AI Evidence & Explanation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-950/60 border border-gray-200 dark:border-navy-800 space-y-2">
            <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">Signals & Evidence Observed</h4>
            <ul className="space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
              {risk_engine.evidence.map((ev, i) => (
                <li key={i} className="flex items-start space-x-2">
                  <span className="text-brand-500 font-black">•</span>
                  <span>{ev}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-950/60 border border-gray-200 dark:border-navy-800 space-y-2">
            <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">AI Explanation & Recommended Action</h4>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              {risk_engine.explanation}
            </p>
            <div className="pt-2 border-t border-gray-200 dark:border-navy-800">
              <span className="text-[11px] font-black text-brand-600 dark:text-brand-400 block uppercase mb-1">Recommended Mentor Action:</span>
              <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                {risk_engine.recommended_action}
              </p>
            </div>
          </div>
        </div>

        {onOpenIntervention && risk_engine.risk_score >= 40 && (
          <div className="flex justify-end pt-2">
            <button
              onClick={() => onOpenIntervention(studentId, profile.name)}
              className="px-4 py-2 bg-gradient-to-r from-brand-600 to-indigo-600 text-white rounded-xl text-xs font-black shadow-md hover:from-brand-500 hover:to-indigo-500 transition-all cursor-pointer flex items-center space-x-2"
            >
              <Zap className="w-4 h-4" />
              <span>Create Faculty Intervention</span>
            </button>
          </div>
        )}
      </div>

      {/* ── 3. DSA SKILL KNOWLEDGE MAP (16 TOPICS) ── */}
      <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <BarChart2 className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">DSA Skill Knowledge Map (16 Topics)</h3>
              <p className="text-xs text-gray-500 font-bold">Topic-Level Accuracy & Problem-Solving Proficiency</p>
            </div>
          </div>

          <span className="text-xs font-black text-gray-500">
            Next Recommended: <strong className="text-brand-600 dark:text-brand-400">{profile.next_recommended_skill}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 pt-2">
          {Object.entries(dsa_topic_scores).map(([topic, score]) => {
            const isWeak = profile.weak_areas.includes(topic);
            const isStrong = profile.strong_areas.includes(topic);
            return (
              <div 
                key={topic}
                className={`p-3 rounded-2xl border text-center transition-all ${
                  isStrong 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                    : isWeak 
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400' 
                    : 'bg-gray-50 dark:bg-navy-950/60 border-gray-200 dark:border-navy-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                <span className="text-[10px] font-black uppercase truncate block">{topic}</span>
                <span className="text-base font-black mt-1 block">{score}%</span>
                <div className="w-full bg-gray-200 dark:bg-navy-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${isStrong ? 'bg-emerald-500' : isWeak ? 'bg-rose-500' : 'bg-brand-500'}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 4. CONTEST READINESS & CONSISTENCY INTELLIGENCE ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Contest Readiness Engine */}
        <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-xl space-y-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Zap className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 dark:text-white">Contest Readiness Engine</h3>
              <p className="text-xs text-gray-500 font-bold">Speed, Accuracy, Medium/Hard Progress & Status</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-brand-500/10 border border-amber-500/20">
            <div>
              <span className="text-[11px] font-black text-gray-500 uppercase block">Contest Readiness</span>
              <span className="text-2xl font-black text-gray-900 dark:text-white">{contest_readiness.contest_readiness_score}%</span>
            </div>
            <span className={`px-3 py-1.5 rounded-xl text-xs font-black border ${
              contest_readiness.status === 'READY' 
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30'
            }`}>
              STATUS: {contest_readiness.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-gray-50 dark:bg-navy-950/60 border border-gray-200 dark:border-navy-800">
              <span className="text-gray-500 font-bold">Speed Rating:</span>
              <strong className="block text-sm text-gray-900 dark:text-white mt-0.5">{contest_readiness.speed_score}%</strong>
            </div>
            <div className="p-3 rounded-2xl bg-gray-50 dark:bg-navy-950/60 border border-gray-200 dark:border-navy-800">
              <span className="text-gray-500 font-bold">Accuracy Rating:</span>
              <strong className="block text-sm text-gray-900 dark:text-white mt-0.5">{contest_readiness.accuracy_score}%</strong>
            </div>
            <div className="p-3 rounded-2xl bg-gray-50 dark:bg-navy-950/60 border border-gray-200 dark:border-navy-800">
              <span className="text-gray-500 font-bold">Medium Progress:</span>
              <strong className="block text-sm text-gray-900 dark:text-white mt-0.5">{contest_readiness.medium_problems_pct}%</strong>
            </div>
            <div className="p-3 rounded-2xl bg-gray-50 dark:bg-navy-950/60 border border-gray-200 dark:border-navy-800">
              <span className="text-gray-500 font-bold">Hard Progress:</span>
              <strong className="block text-sm text-gray-900 dark:text-white mt-0.5">{contest_readiness.hard_problems_pct}%</strong>
            </div>
          </div>

          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-navy-950/60 p-3 rounded-2xl border border-gray-200 dark:border-navy-800">
            💡 <strong>Recommendation:</strong> {contest_readiness.recommendation}
          </p>
        </div>

        {/* Coding Consistency Intelligence */}
        <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-xl space-y-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Flame className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 dark:text-white">Coding Consistency Intelligence</h3>
              <p className="text-xs text-gray-500 font-bold">Sustainable Learning Habits & Active Days</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-navy-950/60 border border-gray-200 dark:border-navy-800">
              <span className="text-gray-500 font-bold block">Active Days:</span>
              <span className="text-xl font-black text-emerald-500 block mt-1">{consistency_intelligence.active_days_label}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-navy-950/60 border border-gray-200 dark:border-navy-800">
              <span className="text-gray-500 font-bold block">Longest Streak:</span>
              <span className="text-xl font-black text-amber-500 block mt-1">{consistency_intelligence.longest_streak_days} Days</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-navy-950/60 border border-gray-200 dark:border-navy-800">
              <span className="text-gray-500 font-bold block">Weekly Avg Output:</span>
              <span className="text-xl font-black text-brand-500 block mt-1">{consistency_intelligence.weekly_average_problems} / week</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-navy-950/60 border border-gray-200 dark:border-navy-800">
              <span className="text-gray-500 font-bold block">Inactive Periods:</span>
              <span className="text-xl font-black text-rose-500 block mt-1">{consistency_intelligence.inactive_periods_count}</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── 5. PERSONALIZED 4-WEEK AI LEARNING PATH ── */}
      <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <BookOpen className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">{learning_path.title}</h3>
              <p className="text-xs text-gray-500 font-bold">Adaptive 4-Week Skill Roadmap Tailored to Student Weakness</p>
            </div>
          </div>

          <span className="px-3 py-1 rounded-xl text-xs font-black bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            WEEK {learning_path.current_week} OF 4 ACTIVE
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {learning_path.weeks.map((wk) => (
            <div 
              key={wk.week_number}
              className={`p-5 rounded-2xl border flex flex-col justify-between space-y-3 ${
                wk.week_number === learning_path.current_week
                  ? 'bg-brand-500/5 border-brand-500/40 shadow-md ring-1 ring-brand-500/20'
                  : 'bg-gray-50 dark:bg-navy-950/60 border-gray-200 dark:border-navy-800'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black px-2 py-0.5 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400">
                    WEEK {wk.week_number}
                  </span>
                  <span className="text-xs font-extrabold text-gray-500">
                    Target: {wk.target_problems.total} Problems
                  </span>
                </div>

                <h4 className="text-xs font-black text-gray-900 dark:text-white leading-snug">
                  {wk.title}
                </h4>

                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  {wk.goal}
                </p>
              </div>

              <div className="pt-2 border-t border-gray-200 dark:border-navy-800 text-[11px] space-y-1">
                <span className="font-bold text-gray-700 dark:text-gray-300 block">Target Breakdown:</span>
                <span className="text-gray-500 block">
                  • {wk.target_problems.easy} Easy, {wk.target_problems.medium} Medium, {wk.target_problems.hard} Hard
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
