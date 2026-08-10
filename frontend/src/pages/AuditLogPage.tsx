import React, { useState, useEffect } from 'react';
import { ShieldAlert, Clock } from 'lucide-react';
import api from '../services/api';

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await api.get('/audit');
      setLogs(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      
      <div>
        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Admin Activity Audit Log</h2>
        <p className="text-xs text-gray-500">Track all administrative actions, student profile edits, Excel imports, settings changes & session triggers</p>
      </div>

      <div className="glass-card p-6 rounded-3xl border space-y-4">
        {logs.length === 0 ? (
          <p className="text-xs text-gray-500 py-4 text-center">No audit log entries recorded yet.</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
            {logs.map((log) => (
              <div key={log.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-gray-900 dark:text-white">{log.action}</span>
                    <span className="text-gray-400">by <b>{log.user_name || 'System'}</b></span>
                  </div>
                  <p className="text-gray-500 mt-0.5">{log.details}</p>
                </div>
                <div className="text-right text-[11px] text-gray-400 font-mono">
                  {new Date(log.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
