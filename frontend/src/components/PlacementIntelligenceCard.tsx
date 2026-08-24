import React from "react";
import { Briefcase, CheckCircle2, AlertTriangle, ArrowRight, Target, Sparkles, Building2 } from "lucide-react";

interface PlacementEvaluation {
  tier: string;
  tier_label: string;
  readiness_score: number;
  badge_color: string;
  target_companies: string[];
  expected_salary_range: string;
  gap_analysis: string[];
  is_eligible_for_placements: boolean;
}

interface PlacementIntelligenceCardProps {
  evaluation?: PlacementEvaluation;
  studentName?: string;
}

export const PlacementIntelligenceCard: React.FC<PlacementIntelligenceCardProps> = ({
  evaluation,
  studentName
}) => {
  if (!evaluation) {
    evaluation = {
      tier: "TIER_2_SAAS",
      tier_label: "Tier-2 Mid-Product & SaaS",
      readiness_score: 78,
      badge_color: "sky",
      target_companies: ["Zoho", "Freshworks", "Juspay", "Postman", "Chargebee"],
      expected_salary_range: "₹8 – ₹18 LPA",
      gap_analysis: ["Solve 15 more Hard problems to enter Tier-1 Product tier", "Target 1800+ Contest Rating in Sunday Contests"],
      is_eligible_for_placements: true
    };
  }

  const getTierBadgeClass = (color: string) => {
    switch (color) {
      case "emerald":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "sky":
        return "bg-sky-500/10 text-sky-400 border-sky-500/30";
      case "amber":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      default:
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden shadow-xl">
      {/* Background Accent Glow */}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 p-0.5 shadow-md shadow-indigo-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                AI PREDICTIVE PLACEMENT
              </span>
            </div>
            <h3 className="text-lg font-bold text-white">Career Placement Eligibility</h3>
          </div>
        </div>

        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${getTierBadgeClass(evaluation.badge_color)}`}>
          {evaluation.tier_label}
        </span>
      </div>

      {/* Readiness Gauge */}
      <div className="my-5 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-indigo-400" /> Placement Readiness Index
          </span>
          <span className="text-sm font-black text-white">{evaluation.readiness_score}%</span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
          <div 
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 transition-all duration-1000"
            style={{ width: `${evaluation.readiness_score}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1.5">
          <span>Foundation</span>
          <span>IT Services</span>
          <span>Mid-Product/SaaS</span>
          <span>Tier-1 FAANG</span>
        </div>
      </div>

      {/* Target Companies Matrix */}
      <div className="mb-4">
        <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-cyan-400" /> Matched Target Companies ({evaluation.expected_salary_range})
        </div>
        <div className="flex flex-wrap gap-2">
          {evaluation.target_companies.map((comp) => (
            <span key={comp} className="text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-200 border border-slate-700/60">
              {comp}
            </span>
          ))}
        </div>
      </div>

      {/* Actionable Gap Analysis */}
      <div className="pt-4 border-t border-slate-800/80">
        <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Next Milestone Recommendations
        </div>
        <ul className="space-y-1.5">
          {evaluation.gap_analysis.map((gap, i) => (
            <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
              <span className="text-amber-400 font-bold">•</span>
              <span>{gap}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
