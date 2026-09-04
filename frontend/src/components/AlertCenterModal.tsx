import React, { useState, useEffect } from 'react';
import { 
  Bell, AlertTriangle, ShieldAlert, CheckCircle2, Award, X, Check, ArrowRight, RefreshCw 
} from 'lucide-react';
import { getSystemAlerts, markAlertRead, markAlertResolve, SystemAlertItem } from '../services/intelligenceService';

interface AlertCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (tab: string) => void;
}

export const AlertCenterModal: React.FC<AlertCenterModalProps> = ({ isOpen, onClose, onNavigate }) => {
  const [alerts, setAlerts] = useState<SystemAlertItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<string>('ALL');

  useEffect(() => {
    if (isOpen) {
      loadAlerts();
    }
  }, [isOpen]);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await getSystemAlerts();
      setAlerts(data);
    } catch (err) {
      console.error("Failed to load alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id: number) => {
    await markAlertRead(id);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
  };

  const handleResolve = async (id: number) => {
    await markAlertResolve(id);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_resolved: true, is_read: true } : a));
  };

  if (!isOpen) return null;

  const filteredAlerts = alerts.filter(a => {
    if (filter === 'UNREAD') return !a.is_read;
    if (filter === 'CRITICAL') return a.alert_type === 'CRITICAL';
    return true;
  });

  const getAlertBadge = (type: string) => {
    switch (type) {
      case 'CRITICAL': return { bg: 'bg-rose-500/10 text-rose-600 border-rose-500/30', icon: ShieldAlert };
      case 'WARNING': return { bg: 'bg-orange-500/10 text-orange-600 border-orange-500/30', icon: AlertTriangle };
      case 'ATTENTION': return { bg: 'bg-amber-500/10 text-amber-600 border-amber-500/30', icon: Bell };
      default: return { bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30', icon: Award };
    }
  };

  return (
    <div className="modal-overlay-responsive animate-fade-in">
      <div className="modal-container-responsive max-w-2xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-lg flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-navy-950/50 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <Bell className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">Automated Priority Alert Center</h2>
              <p className="text-xs text-slate-500 font-bold">Institutional Anomalies, Critical Risk & Milestones</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-navy-950 text-xs font-bold text-slate-600 shrink-0">
          <div className="flex items-center space-x-2">
            {['ALL', 'UNREAD', 'CRITICAL'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-xl transition-colors cursor-pointer ${
                  filter === f 
                    ? 'bg-brand-600 text-white font-black' 
                    : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <button onClick={loadAlerts} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Alert Items List */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-10 text-slate-500 font-bold text-xs">
              No active alerts matching selected filter.
            </div>
          ) : (
            filteredAlerts.map(a => {
              const badge = getAlertBadge(a.alert_type);
              const Icon = badge.icon;
              return (
                <div 
                  key={a.id}
                  className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-4 ${
                    a.is_read 
                      ? 'bg-slate-50/50 dark:bg-navy-950/40 border-slate-200 dark:border-navy-800 opacity-80' 
                      : 'bg-white dark:bg-navy-950 border-brand-500/30 shadow-sm'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-xl border shrink-0 ${badge.bg}`}>
                      <Icon className="w-4 h-4 stroke-[2.5]" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${badge.bg}`}>
                          {a.alert_type}
                        </span>
                        <h4 className="text-xs font-black text-slate-900 dark:text-white">{a.title}</h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">{a.message}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end space-y-2 shrink-0">
                    {!a.is_resolved ? (
                      <button
                        onClick={() => handleResolve(a.id)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[11px] font-extrabold hover:bg-emerald-500/20 transition-colors cursor-pointer flex items-center space-x-1"
                      >
                        <Check className="w-3 h-3" />
                        <span>Resolve</span>
                      </button>
                    ) : (
                      <span className="text-[10px] font-black text-emerald-500 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                      </span>
                    )}

                    {a.action_route && onNavigate && (
                      <button
                        onClick={() => {
                          onNavigate('faculty-action-center');
                          onClose();
                        }}
                        className="text-[10px] font-black text-brand-600 dark:text-brand-400 flex items-center space-x-1 hover:underline cursor-pointer"
                      >
                        <span>{a.action_label || 'Take Action'}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};
