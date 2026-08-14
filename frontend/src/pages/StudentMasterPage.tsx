import React, { useState, useEffect } from 'react';
import { Search, Plus, UploadCloud, RefreshCw, UserPlus, List, LayoutGrid } from 'lucide-react';
import api from '../services/api';
import { LeaderboardTable, StudentData } from '../components/LeaderboardTable';
import { StudentFlipCard } from '../components/StudentFlipCard';
import { collection, getDocs } from 'firebase/firestore';
import { getOrInitDb } from '../services/firebase';

import { CANONICAL_ROSTER } from '../data/canonicalRoster';

interface StudentMasterPageProps {
  onSelectStudent: (student: StudentData) => void;
  onOpenImport: () => void;
}

export const StudentMasterPage: React.FC<StudentMasterPageProps> = ({
  onSelectStudent,
  onOpenImport
}) => {
  const [students, setStudents] = useState<StudentData[]>(CANONICAL_ROSTER);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);


  // New Student Form State
  const [regNo, setRegNo] = useState('');
  const [name, setName] = useState('');
  const [deptId, setDeptId] = useState<number>(1);
  const [yearLevel, setYearLevel] = useState('III');
  const [email, setEmail] = useState('');
  const [leetcodeUrl, setLeetcodeUrl] = useState('');

  const [departments, setDepartments] = useState<any[]>([]);

  useEffect(() => {
    fetchStudents();
    fetchDepartments();
  }, [search]);

  const fetchStudents = async () => {
    let loadedFromApi = false;
    try {
      const res = await api.get(`/students?search=${search}`);
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setStudents(res.data);
        loadedFromApi = true;
      }

    } catch (err) {
      console.warn("REST API request delayed or offline, falling back to Cloud Firestore direct read...", err);
    }

    if (!loadedFromApi) {
      try {
        const firestoreDb = getOrInitDb();
        const studSnap = await getDocs(collection(firestoreDb, "students"));
        const statsSnap = await getDocs(collection(firestoreDb, "leetcodeStats"));

        const statsMap = new Map();
        statsSnap.forEach(docSnap => {
          statsMap.set(docSnap.id, docSnap.data());
        });

        const list: StudentData[] = [];
        studSnap.forEach(docSnap => {
          const sData = docSnap.data();
          const sStats = statsMap.get(docSnap.id) || {};
          const syncStatus = sStats.syncStatus || 'pending';
          const isVerified = syncStatus === 'success' || syncStatus === 'OK';
          const totSolved = isVerified ? (sStats.totalSolved ?? 0) : null;

          list.push({
            id: sData.id || Number(docSnap.id),
            reg_no: sData.registerNo || '',
            name: sData.name || '',
            email: sData.email || '',
            department: { name: sData.departmentName || sData.department || 'GEN', code: sData.department || 'GEN' },
            year_level: sData.year || 'III',
            section: { name: sData.section || 'A' },
            leetcode_url: sData.leetcodeProfileUrl || '',
            username: sData.leetcodeUsername || '',
            college_rank: sStats.collegeRank ?? undefined,
            weekly_progress: sStats.weeklySolved ?? 0,
            streak_count: sStats.streakCount ?? 0,
            consistency_score: sStats.consistencyScore ?? 0,
            stats: {
              total_solved: totSolved,
              easy_solved: isVerified ? (sStats.easySolved ?? 0) : null,
              medium_solved: isVerified ? (sStats.mediumSolved ?? 0) : null,
              hard_solved: isVerified ? (sStats.hardSolved ?? 0) : null,
              contest_rating: sStats.contestRating ?? null,
              contest_global_ranking: sStats.globalRanking ?? null,
              public_profile_ranking: sStats.profileRanking ?? sStats.globalRanking ?? null,
              recent_contest_name: sStats.recentContestName || 'Weekly Contest',
              recent_contest_score: sStats.recentContestScore || (isVerified ? 'Not Attended' : '—'),
              status: sStats.status || (isVerified ? 'OK' : 'pending'),
              sync_status: syncStatus,
              last_verified_at: sStats.lastVerifiedAt ?? null
            }
          });
        });

        let filtered = list;
        if (search) {
          const q = search.toLowerCase();
          filtered = list.filter(s =>
            s.name.toLowerCase().includes(q) ||
            s.reg_no.toLowerCase().includes(q) ||
            (s.username && s.username.toLowerCase().includes(q))
          );
        }

        filtered.sort((a, b) => {
          if (a.college_rank && b.college_rank) return a.college_rank - b.college_rank;
          return (b.stats?.total_solved ?? 0) - (a.stats?.total_solved ?? 0);
        });

        setStudents(filtered);
      } catch (fsErr) {
        console.error("Firestore student fetch error:", fsErr);
      }
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      setDepartments(res.data);
      if (res.data.length > 0) setDeptId(res.data[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/students', {
        reg_no: regNo,
        name,
        department_id: deptId,
        year_level: yearLevel,
        email: email || undefined,
        leetcode_url: leetcodeUrl
      });
      alert("Student added successfully!");
      setShowAddModal(false);
      setRegNo('');
      setName('');
      setLeetcodeUrl('');
      fetchStudents();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to add student.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStudent = async (student: StudentData) => {
    if (!confirm(`Are you sure you want to delete student "${student.name}" (${student.reg_no})? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/students/${student.id}`);
      alert(`Student "${student.name}" deleted successfully!`);
      fetchStudents();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to delete student record.");
    }
  };

  const handleBulkDeleteStudents = async (studentIds: number[]) => {
    if (!confirm(`Are you sure you want to delete ${studentIds.length} selected student records? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await api.post('/students/bulk-delete', { student_ids: studentIds });
      alert(`✅ Successfully deleted ${res.data.count || studentIds.length} student records!`);
      fetchStudents();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to bulk delete student records.");
    }
  };

  const handleSyncSingleStudent = async (studentId: number) => {
    try {
      const res = await api.post(`/students/${studentId}/refresh`);
      alert(`✓ ${res.data?.message || 'Student profile synced successfully!'}`);
      fetchStudents();
    } catch (err: any) {
      alert(`❌ Sync Failed: ${err.response?.data?.detail || err.message || 'Unable to fetch LeetCode profile statistics.'}`);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-8 shadow-2xl border border-brand-500/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black">
              <UserPlus className="w-3.5 h-3.5 text-amber-400" />
              <span>STUDENT REPOSITORY • {students.length} ENROLLED STUDENTS</span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
              Student Master <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">Management Registry</span>
            </h1>

            <p className="text-xs md:text-sm text-gray-300 font-bold tracking-wide">
              Manage student profiles across Cyber Security & IoT, LeetCode profile links, and live sync status
            </p>
          </div>

          <div className="flex items-center space-x-2.5 flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex items-center space-x-1 p-1.5 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-md">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                  viewMode === 'table'
                    ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/40'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                  viewMode === 'cards'
                    ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/40'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>3D Cards</span>
              </button>
            </div>

            <button
              onClick={onOpenImport}
              className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-black text-xs flex items-center space-x-2 backdrop-blur-md transition-all transform hover:scale-105"
            >
              <UploadCloud className="w-4 h-4 text-emerald-400" />
              <span>Bulk Excel Import</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-3 rounded-2xl bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-600 hover:to-indigo-700 text-white font-black text-xs shadow-xl shadow-brand-500/30 flex items-center space-x-2 transition-all transform hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              <span>Add Single Student</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by student name, register number or LeetCode username..."
          className="w-full pl-10 pr-24 py-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-navy-900 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none glass-card"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-2.5 text-xs font-bold px-3 py-1 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-300 transition-colors"
          >
            ✕ Clear Search
          </button>
        )}
      </div>

      {/* Leaderboard / Student Master Table / Flip Cards */}
      {viewMode === 'table' ? (
        <LeaderboardTable
          students={students}
          onSelectStudent={onSelectStudent}
          onRefreshStudent={handleSyncSingleStudent}
          onDeleteStudent={handleDeleteStudent}
          onBulkDeleteStudents={handleBulkDeleteStudents}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">


          {students.map((st) => (
            <StudentFlipCard
              key={st.id}
              student={st}
              onSelectStudent={onSelectStudent}
              onDeleteStudent={handleDeleteStudent}
            />
          ))}
        </div>
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md glass-card rounded-3xl p-6 border space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Add New Student Record</h3>

            <form onSubmit={handleCreateStudent} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Register Number</label>
                <input
                  type="text"
                  value={regNo}
                  onChange={(e) => setRegNo(e.target.value)}
                  placeholder="e.g. 732224CC001"
                  required
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-navy-900"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Student Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. AJAY A"
                  required
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-navy-900"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Department</label>
                <select
                  value={deptId}
                  onChange={(e) => setDeptId(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-navy-900"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Year Level</label>
                <select
                  value={yearLevel}
                  onChange={(e) => setYearLevel(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-navy-900"
                >
                  <option value="II">II Year</option>
                  <option value="III">III Year</option>
                  <option value="IV">IV Year</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">LeetCode Profile Link</label>
                <input
                  type="text"
                  value={leetcodeUrl}
                  onChange={(e) => setLeetcodeUrl(e.target.value)}
                  placeholder="e.g. https://leetcode.com/u/ajay_a/"
                  required
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-navy-900"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-gray-500 font-bold hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-brand-600 text-white font-bold shadow-md shadow-brand-600/30"
                >
                  {loading ? 'Adding...' : 'Save Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
