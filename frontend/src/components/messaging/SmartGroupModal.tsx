import React, { useState } from 'react';
import axios from 'axios';
import { getApiUrl, getAuthHeaders } from '../../services/api';
import { X, Users, Sparkles, AlertCircle } from 'lucide-react';

export const SmartGroupModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: (group: any) => void;
}> = ({ isOpen, onClose, onGroupCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [groupType, setGroupType] = useState('INTERVENTION');
  const [isDynamic, setIsDynamic] = useState(true);
  const [ruleType, setRuleType] = useState('INACTIVE_STUDENTS');
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const payload = {
        name,
        description,
        group_type: groupType,
        is_dynamic: isDynamic,
        rule_type: isDynamic ? ruleType : null,
        rule_criteria: isDynamic ? { days } : {}
      };

      const res = await axios.post(getApiUrl('/messaging/smart-groups'), payload, {
        headers: getAuthHeaders()
      });

      if (res.data?.success && res.data?.group) {
        onGroupCreated(res.data.group);
        onClose();
      } else {
        setError('Failed to create smart group.');
      }
    } catch (err: any) {
      console.error('Group creation error:', err);
      setError(err.response?.data?.detail || 'Error creating smart group.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg shadow-2xl text-slate-100 p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-5">
          <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Create Smart Group</h3>
            <p className="text-xs text-slate-400">Institutional group with transparent criteria and server-side RBAC.</p>
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 bg-red-950/60 border border-red-800 text-red-200 text-xs rounded-lg flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Group Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Intervention: Inactive Week 35"
              className="w-full bg-slate-900/50 hover:bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Targeted intervention group for students needing practice follow-up..."
              className="w-full bg-slate-900/50 hover:bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Group Type</label>
              <select
                value={groupType}
                onChange={(e) => setGroupType(e.target.value)}
                className="w-full bg-slate-900/50 hover:bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer appearance-none"
                style={{ backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
              >
                <option value="INTERVENTION">Intervention</option>
                <option value="ACADEMIC">Academic</option>
                <option value="BATCH">Batch</option>
                <option value="CONTEST">Contest</option>
                <option value="FACULTY">Faculty</option>
                <option value="MENTOR">Mentor</option>
                <option value="PROJECT">Project</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>

            <div className="flex items-center pt-6">
              <label className="inline-flex items-center cursor-pointer space-x-2">
                <input
                  type="checkbox"
                  checked={isDynamic}
                  onChange={(e) => setIsDynamic(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-medium text-slate-200">Dynamic Rule Group</span>
              </label>
            </div>
          </div>

          {isDynamic && (
            <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-4 space-y-4">
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-indigo-400">
                <Sparkles className="w-4 h-4" />
                <span>Dynamic Criteria Rules</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Rule Type</label>
                <select
                  value={ruleType}
                  onChange={(e) => setRuleType(e.target.value)}
                  className="w-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer appearance-none"
                  style={{ backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2rem' }}
                >
                  <option value="INACTIVE_STUDENTS">Students with zero submissions in X days</option>
                  <option value="MISSED_CONTEST">Students who missed latest contest session</option>
                  <option value="DEPARTMENT_BATCH">Department & Year Roster</option>
                </select>
              </div>

              {ruleType === 'INACTIVE_STUDENTS' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Inactivity Duration (Days)</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    className="w-24 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-800/80 hover:bg-slate-700 text-slate-300 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-500/20 active:scale-95"
            >
              {loading ? 'Creating...' : 'Create Smart Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
