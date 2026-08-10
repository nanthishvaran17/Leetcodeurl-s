import React, { useState, useEffect } from 'react';
import { Settings, Save, Database, Clock, Mail, ShieldAlert } from 'lucide-react';
import api from '../services/api';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<any>({});
  const [backups, setBackups] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchBackups();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      setSettings(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBackups = async () => {
    try {
      const res = await api.get('/settings/backups');
      setBackups(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/settings', settings);
      alert("Settings updated successfully!");
    } catch (err: any) {
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      const res = await api.post('/settings/backup');
      alert(`Backup created: ${res.data.filename}`);
      fetchBackups();
    } catch (err) {
      alert("Backup creation failed");
    }
  };

  return (
    <div className="space-y-6">
      
      <div>
        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Admin System Settings & Configuration</h2>
        <p className="text-xs text-gray-500">Configure weekly Sunday session times, SMTP email settings, thresholds, and SQLite database backup/restore</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Session Time Settings */}
        <div className="glass-card p-6 rounded-3xl border space-y-4">
          <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center space-x-2">
            <Clock className="w-5 h-5 text-brand-500" />
            <span>Weekly Sunday Session Schedule (IST)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Start Time (24h)</label>
              <input
                type="text"
                value={settings.SESSION_START || '08:00'}
                onChange={(e) => setSettings({ ...settings, SESSION_START: e.target.value })}
                className="w-full p-2.5 rounded-xl border bg-white dark:bg-navy-900"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">End Time (24h)</label>
              <input
                type="text"
                value={settings.SESSION_END || '09:30'}
                onChange={(e) => setSettings({ ...settings, SESSION_END: e.target.value })}
                className="w-full p-2.5 rounded-xl border bg-white dark:bg-navy-900"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Progress Threshold</label>
              <input
                type="number"
                value={settings.PROGRESS_THRESHOLD || 1}
                onChange={(e) => setSettings({ ...settings, PROGRESS_THRESHOLD: e.target.value })}
                className="w-full p-2.5 rounded-xl border bg-white dark:bg-navy-900"
              />
            </div>
          </div>
        </div>

        {/* Email Settings */}
        <div className="glass-card p-6 rounded-3xl border space-y-4">
          <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center space-x-2">
            <Mail className="w-5 h-5 text-indigo-500" />
            <span>Email Report Dispatch Configuration</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Recipient Email Addresses (Comma Separated)</label>
              <input
                type="text"
                value={settings.REPORT_RECIPIENT_EMAILS || ''}
                onChange={(e) => setSettings({ ...settings, REPORT_RECIPIENT_EMAILS: e.target.value })}
                placeholder="hod.cyber@college.edu, hod.iot@college.edu"
                className="w-full p-2.5 rounded-xl border bg-white dark:bg-navy-900"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md shadow-brand-600/30 flex items-center space-x-2"
        >
          <Save className="w-4 h-4" />
          <span>Save Settings</span>
        </button>

      </form>

      {/* Database Backup Card */}
      <div className="glass-card p-6 rounded-3xl border space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center space-x-2">
            <Database className="w-5 h-5 text-emerald-500" />
            <span>Database Backup & Snapshots</span>
          </h3>

          <button
            onClick={handleCreateBackup}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-600/30"
          >
            Create Snapshot Backup Now
          </button>
        </div>

        <div className="text-xs space-y-2">
          <p className="font-semibold text-gray-400">Available Backup Snapshots:</p>
          {backups.length === 0 ? (
            <p className="text-gray-500">No backup files created yet.</p>
          ) : (
            <div className="space-y-1">
              {backups.map((b, idx) => (
                <div key={idx} className="p-2 rounded-lg bg-gray-50 dark:bg-navy-900 font-mono text-gray-700 dark:text-gray-300">
                  📦 {b}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
