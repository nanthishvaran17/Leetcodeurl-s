import React, { useState, useEffect } from 'react';
import { ArrowLeft, ExternalLink, Trophy, Flame, Award, Lightbulb, RefreshCw, FileText } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import api from '../services/api';
import { SkillRadarChart } from '../components/SkillRadarChart';
import { BadgeShelf } from '../components/BadgeShelf';
import { IDCardGenerator } from '../components/IDCardGenerator';

interface StudentProfilePageProps {
  student: any;
  onBack: () => void;
}

export const StudentProfilePage: React.FC<StudentProfilePageProps> = ({ student, onBack }) => {
  const [detail, setDetail] = useState<any>(student);
  const [insights, setInsights] = useState<any>(null);

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

  const handleGenerateCert = async () => {
    if (!student?.id) return;
    setDownloadingCert(true);
    try {
      const res = await api.post(`/reports/generate-certificate/${student.id}?cert_type=Top Performer`);
      const certCode = res.data.certificate_code;

      const pdfRes = await api.get(`/reports/certificate/${certCode}/pdf`, { responseType: 'blob' });
      const blob = new Blob([pdfRes.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Certificate_${student.reg_no || certCode}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Failed to generate and download certificate.");
    } finally {
      setDownloadingCert(false);
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
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-xs font-bold text-gray-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Student Master / Dashboard</span>
      </button>

      {/* Student Profile Header Banner */}
      <div className="glass-card p-6 rounded-3xl border space-y-4 bg-gradient-to-r from-brand-900/10 via-navy-900/10 to-indigo-900/10 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white">{detail?.name}</h2>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300 font-mono">
                {detail?.reg_no}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Department of <b>{detail?.department?.name}</b> • {detail?.year_level} Year
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {detail?.leetcode_url && (
              <a
                href={detail.leetcode_url}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-brand-600/30 transition-all hover:scale-105"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>LeetCode Profile</span>
              </a>
            )}

            <button
              onClick={handleGenerateCert}
              disabled={downloadingCert}
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-amber-600/30 transition-all hover:scale-105 disabled:opacity-50"
            >
              <Award className="w-3.5 h-3.5" />
              <span>{downloadingCert ? 'Downloading PDF...' : 'Issue Certificate'}</span>
            </button>
          </div>

        </div>
      </div>

      {/* Ranks & Streaks Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="glass-card p-5 rounded-2xl border text-center shadow-md">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">College Rank</p>
          <h3 className="text-2xl font-extrabold text-brand-600 dark:text-brand-400 mt-1">#{detail?.college_rank || '—'}</h3>
        </div>

        <div className="glass-card p-5 rounded-2xl border text-center shadow-md">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Department Rank</p>
          <h3 className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">#{detail?.dept_rank || '—'}</h3>
        </div>

        <div className="glass-card p-5 rounded-2xl border text-center shadow-md">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Weekly Progress</p>
          <h3 className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">+{detail?.weekly_progress || 0}</h3>
        </div>

        <div className="glass-card p-5 rounded-2xl border text-center shadow-md">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Streak</p>
          <h3 className="text-2xl font-extrabold text-amber-500 mt-1">🔥 {detail?.streak_count || 0} wks</h3>
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
          <h3 className="font-extrabold text-base text-gray-900 dark:text-white">Problem Difficulty Breakdown</h3>
          
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
            <h3 className="font-extrabold text-base text-gray-900 dark:text-white">AI Focus Recommendation</h3>
          </div>

          {insights ? (
            <div className="space-y-3 text-xs">
              <div>
                <span className="font-bold text-gray-400 uppercase">Trajectory:</span>
                <span className="ml-2 font-bold px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {insights.trajectory}
                </span>
              </div>

              <div>
                <span className="font-bold text-gray-400 uppercase">Recommended Weak Focus Areas:</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {insights.focus_areas.map((area: string, i: number) => (
                    <span key={i} className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-bold">
                      {area}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-gray-100 dark:bg-navy-900 text-gray-700 dark:text-gray-300 leading-relaxed">
                {insights.recommendation}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500">Loading topic insights...</p>
          )}
        </div>

      </div>

    </div>
  );
};
