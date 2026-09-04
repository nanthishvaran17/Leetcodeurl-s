import React, { useState, useEffect } from 'react';
import { ArrowLeft, ExternalLink, Trophy, Flame, Award, Lightbulb, RefreshCw, FileText, Edit3 } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import api from '../services/api';
import { SkillRadarChart } from '../components/SkillRadarChart';
import { BadgeShelf } from '../components/BadgeShelf';
import { IDCardGenerator } from '../components/IDCardGenerator';
import { StudentEditOverlay } from '../components/StudentEditOverlay';

interface StudentProfilePageProps {
  student: any;
  onBack: () => void;
}

import { useNotification } from '../context/NotificationContext';
import { triggerDownload } from '../utils/mobileDownload';

export const StudentProfilePage: React.FC<StudentProfilePageProps> = ({ student, onBack }) => {
  const { notify } = useNotification();
  const [detail, setDetail] = useState<any>(student);
  const [insights, setInsights] = useState<any>(null);
  const [isLiveFetching, setIsLiveFetching] = useState(false);
  const [liveFetchError, setLiveFetchError] = useState<string | null>(null);
  const [showEditOverlay, setShowEditOverlay] = useState(false);

  useEffect(() => {
    if (student?.id) {
      fetchStudentDetail();
    }
  }, [student]);

  const fetchStudentDetail = async () => {
    try {
      const [stRes, insRes] = await Promise.all([
        api.get(`/students/${student.id}`),
        api.get(`/analytics/compare-students?ids=${student.id}`)
      ]);
      setDetail(stRes.data);
      if (insRes.data && insRes.data.length > 0) {
        setInsights(insRes.data[0].insights);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const [downloadingCert, setDownloadingCert] = useState(false);
  const [downloadingForensic, setDownloadingForensic] = useState(false);

  const handleGenerateCert = async () => {
    if (!student?.id) return;
    setDownloadingCert(true);
    notify.info('Generating Certificate', 'Creating official performance certificate PDF...', { category: 'CERTIFICATE ENGINE' });
    try {
      const res = await api.post('/certificates/generate', {
        student_id: student.id,
        cert_type: "Top Performer"
      });
      const cleanReg = (student.reg_no || '').replace(/[^A-Za-z0-9]+/g, '').toUpperCase();
      const certId = res.data?.verification_id || `CERT-${cleanReg}-EXCELLENCE`;

      const response = await api.get(`/certificates/${encodeURIComponent(certId)}/download-pdf`, {
        responseType: 'blob'
      });

      if (response.data && response.data.type === 'application/json') {
        const text = await response.data.text();
        try {
          const errJson = JSON.parse(text);
          notify.error('Certificate Error', errJson.detail || 'Could not generate PDF.', { category: 'CERTIFICATE ENGINE' });
          return;
        } catch (e) {}
      }

      const blob = new Blob([response.data], { type: 'application/pdf' });
      let filename = `Certificate_${cleanReg || certId}.pdf`;
      const disposition = response.headers['content-disposition'] || response.headers['Content-Disposition'];
      if (disposition && disposition.includes('filename=')) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '').trim();
        }
      }
      await triggerDownload(blob, filename, 'application/pdf');
      notify.success('Certificate Downloaded', `Certificate ${filename} generated.`, { category: 'CERTIFICATE ENGINE' });
    } catch (err: any) {
      console.error("Certificate error:", err);
      const detailMsg = err.response?.data?.detail || err.message || "Failed to generate certificate.";
      notify.error('Certificate Error', detailMsg, { category: 'CERTIFICATE ENGINE' });
    } finally {
      setDownloadingCert(false);
    }
  };

  const handleDownloadForensicCert = async () => {
    if (!student?.id) return;
    setDownloadingForensic(true);
    notify.info('Generating Forensic Report', 'Compiling official contest forensic audit PDF...', { category: 'FORENSIC AUDIT' });
    try {
      const cleanReg = (student.reg_no || '').replace(/[^A-Za-z0-9]+/g, '').toUpperCase();
      const targetId = cleanReg ? `CERT-${cleanReg}-FORENSIC` : `CERT-${student.id}-FORENSIC`;
      const response = await api.get(`/certificates/${encodeURIComponent(targetId)}/download-forensic-pdf?student_id=${student.id}`, {
        responseType: 'blob'
      });

      if (response.data && response.data.type === 'application/json') {
        const text = await response.data.text();
        try {
          const errJson = JSON.parse(text);
          notify.error('Forensic Report Error', errJson.detail || 'Could not generate report.', { category: 'FORENSIC AUDIT' });
          return;
        } catch (e) {}
      }

      const blob = new Blob([response.data], { type: 'application/pdf' });
      let filename = `Forensic_Audit_Report_${targetId}.pdf`;
      const disposition = response.headers['content-disposition'] || response.headers['Content-Disposition'];
      if (disposition && disposition.includes('filename=')) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '').trim();
        }
      }
      await triggerDownload(blob, filename, 'application/pdf');
      notify.success('Forensic Report Downloaded', `Audit report ${filename} saved.`, { category: 'FORENSIC AUDIT' });
    } catch (err: any) {
      console.error("Forensic report error:", err);
      notify.error('Forensic Error', 'Failed to download Official LeetCode Contest Forensic Verification Audit Report.', { category: 'FORENSIC AUDIT' });
    } finally {
      setDownloadingForensic(false);
    }
  };

  const handleLiveFetch = async () => {
    if (!student?.id) {
      setLiveFetchError("No valid student record ID found.");
      return;
    }
    
    setIsLiveFetching(true);
    setLiveFetchError(null);
    try {
      await api.post(`/api/sync/student/${student.id}`);
      const refreshed = await api.get(`/students/${student.id}`);
      setDetail(refreshed.data);
    } catch (err: any) {
      console.error("Live fetch error:", err);
      setLiveFetchError(err.response?.data?.detail || err.response?.data?.message || "Failed to fetch live stats");
    } finally {
      setIsLiveFetching(false);
    }
  };

  const easy = detail?.stats?.easy_solved || 0;
  const medium = detail?.stats?.medium_solved || 0;
  const hard = detail?.stats?.hard_solved || 0;

  const pieData = [
    { name: 'Easy', value: easy, color: '#10B981' },
    { name: 'Medium', value: medium, color: '#F59E0B' },
    { name: 'Hard', value: hard, color: '#EF4444' },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden animate-fade-in bg-white dark:bg-navy-950 rounded-3xl">
      
      {/* Sticky Header Bar with Close Button & Actions */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 shrink-0 z-10 sticky top-0 shadow-xl">
        <div className="flex items-center space-x-4 w-full md:w-auto">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer flex items-center space-x-2 text-xs font-bold shadow-sm"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="flex-1">
            <h2 className="text-lg sm:text-xl font-black text-white">{detail?.name || student?.name}</h2>
            <p className="text-[10px] sm:text-xs text-brand-300 font-mono font-bold mt-0.5 truncate max-w-sm">
              {detail?.reg_no || student?.reg_no} • {detail?.department?.name || detail?.department?.code || student?.department?.code} {detail?.year_level ? `• ${detail.year_level} Year` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            {detail?.leetcode_url && (
              <a
                href={detail.leetcode_url}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-[10px] flex items-center space-x-1.5 shadow-md shadow-brand-600/30 transition-all hover:scale-105"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">LeetCode Profile</span>
              </a>
            )}

            <button
              onClick={() => setShowEditOverlay(true)}
              className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] flex items-center space-x-1.5 shadow-md transition-all hover:scale-105 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Edit Student</span>
            </button>

            <button
              onClick={handleLiveFetch}
              disabled={isLiveFetching}
              className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] flex items-center space-x-1.5 shadow-md shadow-indigo-600/30 transition-all hover:scale-105 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLiveFetching ? 'animate-spin' : ''}`} />
              <span className="hidden lg:inline">{isLiveFetching ? 'Fetching...' : 'Live Sync'}</span>
            </button>

            <button
              onClick={handleGenerateCert}
              disabled={downloadingCert}
              className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] flex items-center space-x-1.5 shadow-md shadow-amber-600/30 transition-all hover:scale-105 disabled:opacity-50 cursor-pointer"
            >
              <Award className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Gold Certificate</span>
            </button>

            <button
              onClick={handleDownloadForensicCert}
              disabled={downloadingForensic}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center space-x-1.5 shadow-md shadow-emerald-600/30 transition-all hover:scale-105 disabled:opacity-50 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Audit Report</span>
            </button>

          <button
            type="button"
            onClick={onBack}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-rose-500 text-white transition-all font-black text-[10px] flex items-center space-x-1 cursor-pointer"
            title="Close Modal"
          >
            <span className="text-sm leading-none"></span>
            <span className="hidden lg:inline">Close</span>
          </button>
        </div>
      </div>
      
      {liveFetchError && (
        <div className="mx-5 sm:mx-6 mt-4 text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/50 p-3 rounded-xl border border-rose-200 dark:border-rose-800 animate-fade-in shadow-sm">
          {liveFetchError}
        </div>
      )}

      {/* Scrollable Body Content */}
      <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex-1 min-h-0 space-y-6 custom-scrollbar pt-2">

      {/* Ranks & Streaks Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="glass-card p-5 rounded-2xl border text-center shadow-md">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">College Rank</p>
          <h3 className="text-2xl font-extrabold text-brand-600 dark:text-brand-400 mt-1">#{detail?.college_rank || '—'}</h3>
        </div>

        <div className="glass-card p-5 rounded-2xl border text-center shadow-md">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Department Rank</p>
          <h3 className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">#{detail?.dept_rank || '—'}</h3>
        </div>

        <div className="glass-card p-5 rounded-2xl border text-center shadow-md">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Weekly Progress</p>
          <h3 className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">+{detail?.weekly_progress || 0}</h3>
        </div>

        <div className="glass-card p-5 rounded-2xl border text-center shadow-md">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Streak</p>
          <h3 className="text-2xl font-extrabold text-amber-500 mt-1">{detail?.lc_activity?.current_streak || detail?.streak_count || 0} Days</h3>
        </div>

      </div>

      {/* Contest Performance Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-2xl border text-center shadow-md">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Official Contests</p>
          <h3 className="text-2xl font-extrabold text-brand-600 dark:text-brand-400 mt-1">{detail?.lc_contest_standing?.attended_count || detail?.stats?.official_contests || 0}</h3>
        </div>
        <div className="glass-card p-5 rounded-2xl border text-center shadow-md">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Virtual Contests</p>
          <div className="mt-1">
            <h3 className="text-2xl font-extrabold text-brand-600 dark:text-brand-400">
              {detail?.stats?.virtual_contests || (detail?.has_virtual ? 1 : 0)}
            </h3>
            <div className="mt-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                (detail?.stats?.virtual_contest_status === 'ATTENDED' || detail?.has_virtual || (detail?.stats?.virtual_contests && detail.stats.virtual_contests > 0))
                  ? 'bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300 border border-brand-400/30'
                  : 'bg-slate-100 text-slate-600 dark:bg-navy-950 dark:text-slate-400 border border-slate-300/30'
              }`}>
                {(detail?.stats?.virtual_contest_status === 'ATTENDED' || detail?.has_virtual || (detail?.stats?.virtual_contests && detail.stats.virtual_contests > 0))
                  ? 'Attended'
                  : 'Not Attended'}
              </span>
            </div>
          </div>
        </div>
        <div className="glass-card p-5 rounded-2xl border text-center shadow-md col-span-2 md:col-span-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Contest Rating</p>
          <h3 className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
            {(detail?.lc_contest_standing?.contest_rating || detail?.stats?.contest_rating) ? (detail.lc_contest_standing?.contest_rating || detail.stats?.contest_rating).toLocaleString('en-US', { minimumFractionDigits: 1 }) : 'Unrated'}
          </h3>
        </div>
      </div>

      {/* Skill Radar & Digital Student Pass */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SkillRadarChart totalSolved={detail?.stats?.total_solved || 0} />
        <IDCardGenerator
          studentName={detail?.name || ''}
          regNo={detail?.reg_no || ''}
          deptName={detail?.department?.name || 'CSE'}
          yearLevel={detail?.year_level || 'III'}
          totalSolved={detail?.stats?.total_solved || 0}
          collegeRank={detail?.college_rank || 1}
          streakCount={detail?.streak_count || 0}
        />
      </div>

      {/* Achievement Badge Shelf */}
      <BadgeShelf
        solvedCount={detail?.stats?.total_solved || 0}
        streakCount={detail?.streak_count || 0}
        rating={detail?.stats?.contest_rating || 0}
      />

      {/* Problem Distribution & AI Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Pie Chart */}
        <div className="glass-card p-6 rounded-3xl border space-y-4 shadow-xl">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Problem Difficulty Breakdown</h3>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 font-bold text-emerald-700 dark:text-emerald-300">
              Easy: {easy}
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 font-bold text-amber-700 dark:text-amber-300">
              Med: {medium}
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 font-bold text-rose-700 dark:text-rose-300">
              Hard: {hard}
            </div>
          </div>
        </div>

        {/* Weak Topic AI Insights */}
        <div className="glass-card p-6 rounded-3xl border space-y-4 bg-gradient-to-br from-amber-900/10 to-indigo-900/10 shadow-xl">
          <div className="flex items-center space-x-2 text-amber-500">
            <Lightbulb className="w-5 h-5" />
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">AI Focus Recommendation</h3>
          </div>

          {insights ? (
            <div className="space-y-3 text-xs">
              <div>
                <span className="font-bold text-slate-400 uppercase">Trajectory:</span>
                <span className="ml-2 font-bold px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {insights.trajectory}
                </span>
              </div>

              <div>
                <span className="font-bold text-slate-400 uppercase">Recommended Weak Focus Areas:</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {insights.focus_areas.map((area: string, i: number) => (
                    <span key={i} className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-bold">
                      {area}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-navy-950 text-slate-700 dark:text-slate-300 leading-relaxed">
                {insights.recommendation}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Loading topic insights...</p>
          )}
        </div>
      </div>

      <StudentEditOverlay
        isOpen={showEditOverlay}
        student={detail}
        onClose={() => setShowEditOverlay(false)}
        onSaveSuccess={(updated) => {
          setDetail(updated);
        }}
      />
    </div>
  </div>
);
};
