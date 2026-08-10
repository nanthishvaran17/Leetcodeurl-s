import React, { useState, useEffect } from 'react';
import { Search, Plus, UploadCloud, RefreshCw, UserPlus } from 'lucide-react';
import api from '../services/api';
import { LeaderboardTable, StudentData } from '../components/LeaderboardTable';

interface StudentMasterPageProps {
  onSelectStudent: (student: StudentData) => void;
  onOpenImport: () => void;
}

export const StudentMasterPage: React.FC<StudentMasterPageProps> = ({
  onSelectStudent,
  onOpenImport
}) => {
  const [students, setStudents] = useState<StudentData[]>([]);
  const [search, setSearch] = useState('');
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
    try {
      const res = await api.get(`/students?search=${search}`);
      setStudents(res.data);
    } catch (err) {
      console.error(err);
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
        email,
        leetcode_url: leetcodeUrl
      });
      alert("Student record created!");
      setShowAddModal(false);
      fetchStudents();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to create student");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Student Master Data</h2>
          <p className="text-xs text-gray-500">Manage 150+ student records, LeetCode profile links, and live sync status</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onOpenImport}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center space-x-1.5"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Excel Import</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md shadow-brand-600/30 flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Single Student</span>
          </button>
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
          className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-navy-900 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none glass-card"
        />
      </div>

      {/* Leaderboard / Student Master Table */}
      <LeaderboardTable
        students={students}
        onSelectStudent={onSelectStudent}
        onRefreshStudent={() => fetchStudents()}
      />

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
                  placeholder="312822101001"
                  required
                  className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-navy-900"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Student Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Arun Kumar"
                  required
                  className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-navy-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Department</label>
                  <select
                    value={deptId}
                    onChange={(e) => setDeptId(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-navy-900"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Year</label>
                  <select
                    value={yearLevel}
                    onChange={(e) => setYearLevel(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-navy-900"
                  >
                    <option value="II">II Year</option>
                    <option value="III">III Year</option>
                    <option value="IV">IV Year</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="arun@college.edu"
                  className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-navy-900"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">LeetCode Profile Link</label>
                <input
                  type="url"
                  value={leetcodeUrl}
                  onChange={(e) => setLeetcodeUrl(e.target.value)}
                  placeholder="https://leetcode.com/u/username/"
                  required
                  className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-navy-900"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-brand-600 text-white font-bold"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
