import React, { useState } from 'react';
import axios from 'axios';
import { getApiUrl, getAuthHeaders } from '../../services/api';
import { Sparkles, CheckCircle2, ShieldAlert, ArrowRight, RefreshCw, Send, Users, AlertTriangle } from 'lucide-react';

interface ActionTrigger {
  label: string;
  action: string;
  params: Record<string, any>;
}

interface QueryResult {
  query: string;
  answer: string;
  evidence: string[];
  actions: ActionTrigger[];
  dataConfidence: string;
}

export const AskInstitutionPanel: React.FC<{
  onActionTrigger?: (action: ActionTrigger) => void;
}> = ({ onActionTrigger }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const presetQueries = [
    'Who is inactive this week?',
    'Who missed the last contest?',
    'Which students improved most?',
    'Which topics are difficult?'
  ];

  const handleSearch = async (queryText: string) => {
    if (!queryText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post(
        getApiUrl('/messaging/ask-institution'),
        { query: queryText },
        { headers: getAuthHeaders() }
      );
      if (res.data?.success && res.data?.result) {
        setResult(res.data.result);
      } else {
        setError('Failed to retrieve verified institutional response.');
      }
    } catch (err: any) {
      console.error('Ask Institution query error:', err);
      setError(err.response?.data?.detail || 'Error executing query against institutional database.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl max-w-4xl mx-auto my-4 text-slate-100">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-4">
        <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
          <Sparkles className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Ask Institution Intelligence</h2>
          <p className="text-xs text-slate-400">
            RBAC-enforced natural language query engine grounded strictly in verified institutional database records.
          </p>
        </div>
      </div>

      {/* Query Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch(query);
        }}
        className="flex items-center space-x-2 mb-4"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything (e.g. 'Who is inactive this week?', 'Who missed the last contest?')..."
            className="w-full bg-slate-800/80 border border-slate-700 focus:border-indigo-500 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-5 py-3 rounded-lg text-sm flex items-center space-x-2 transition shadow-md hover:shadow-indigo-500/20"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <span>Query</span>
              <Send className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Presets */}
      <div className="flex flex-wrap gap-2 mb-6">
        <span className="text-xs text-slate-400 self-center font-medium mr-1">Suggested:</span>
        {presetQueries.map((preset, idx) => (
          <button
            key={idx}
            onClick={() => {
              setQuery(preset);
              handleSearch(preset);
            }}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-full transition hover:text-white"
          >
            {preset}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-950/50 border border-red-800/60 rounded-lg text-red-200 text-sm flex items-center space-x-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Result Card */}
      {result && (
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-5 space-y-4 shadow-inner">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Query: <span className="text-slate-200">{result.query}</span>
            </span>
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{result.dataConfidence || 'VERIFIED'}</span>
            </span>
          </div>

          {/* Natural Answer */}
          <div className="text-base text-slate-100 font-medium leading-relaxed">
            {result.answer}
          </div>

          {/* Evidence Trace */}
          {result.evidence && result.evidence.length > 0 && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 text-xs space-y-1.5">
              <div className="font-semibold text-indigo-400 flex items-center space-x-1.5 mb-1">
                <ShieldAlert className="w-4 h-4 text-indigo-400" />
                <span>Verified Evidence Trace</span>
              </div>
              <ul className="space-y-1 text-slate-300 list-disc list-inside pl-1">
                {result.evidence.map((ev, i) => (
                  <li key={i}>{ev}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Triggers */}
          {result.actions && result.actions.length > 0 && (
            <div className="pt-2">
              <div className="text-xs font-semibold text-slate-400 mb-2">Recommended Institutional Actions:</div>
              <div className="flex flex-wrap gap-2">
                {result.actions.map((act, i) => (
                  <button
                    key={i}
                    onClick={() => onActionTrigger && onActionTrigger(act)}
                    className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-indigo-200 border border-indigo-500/40 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition"
                  >
                    <span>{act.label}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
