import React, { useState, useEffect } from 'react';
import { Search, UserPlus, Edit2, Shield, Ban, CheckCircle, RefreshCcw, UserX } from 'lucide-react';
import api from '../../services/api';
import { useNotification } from '../../context/NotificationContext';

export const StaffManagement: React.FC = () => {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { notify } = useNotification();

  const [formData, setFormData] = useState({
    institutional_id: '',
    username: '',
    email: '',
    password: '',
    role: 'Staff',
    department_id: '',
  });

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/staff-list');
      if (res.data) {
        setStaffList(res.data);
      }
    } catch (err) {
      notify.error('Failed to load staff list.', '', { category: 'ADMIN' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/staff', {
        institutional_id: formData.institutional_id || undefined,
        username: formData.username,
        email: formData.email,
        password: formData.password || 'Staff@123',
        role: formData.role,
        department_id: formData.department_id ? parseInt(formData.department_id) : null
      });
      notify.success('Staff Member Created Successfully.', '', { category: 'ADMIN' });
      setShowModal(false);
      fetchStaff();
    } catch (err: any) {
      notify.error(err.response?.data?.detail || 'Failed to create staff account.', '', { category: 'ADMIN' });
    }
  };

  const handleToggleStatus = async (staffId: number, currentStatus: boolean) => {
    try {
      await api.patch(`/admin/staff/${staffId}`, { is_active: !currentStatus });
      notify.success(`Staff account ${currentStatus ? 'deactivated' : 'activated'}.`, '', { category: 'ADMIN' });
      fetchStaff();
    } catch (err: any) {
      notify.error(err.response?.data?.detail || 'Failed to update status.', '', { category: 'ADMIN' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Staff Management</h2>
          <p className="text-sm text-gray-500">Manage institutional staff accounts and roles.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 font-bold text-sm shadow-sm transition-all"
        >
          <UserPlus className="w-4 h-4" /> Add Staff Member
        </button>
      </div>

      <div className="bg-white dark:bg-navy-800 rounded-2xl border border-gray-200 dark:border-navy-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 dark:bg-navy-900/50 text-gray-600 dark:text-gray-400 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-6 py-4">Institutional ID</th>
                <th className="px-6 py-4">Username / Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-700">
              {staffList.map((staff) => (
                <tr key={staff.id} className="hover:bg-gray-50 dark:hover:bg-navy-750/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs font-bold text-gray-700 dark:text-gray-300">
                    {staff.institutional_id || 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900 dark:text-white">{staff.username}</div>
                    <div className="text-xs text-gray-500">{staff.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
                      {staff.role || 'Staff'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {staff.is_active ? (
                      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                        <CheckCircle className="w-3.5 h-3.5" /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-rose-500 dark:text-rose-400 text-xs font-bold">
                        <Ban className="w-3.5 h-3.5" /> Suspended
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => handleToggleStatus(staff.id, staff.is_active)}
                      className={`p-2 rounded-lg transition-colors ${staff.is_active ? 'hover:bg-rose-100 hover:text-rose-600 text-gray-400' : 'hover:bg-emerald-100 hover:text-emerald-600 text-gray-400'}`}
                      title={staff.is_active ? "Suspend Account" : "Activate Account"}
                    >
                      {staff.is_active ? <UserX className="w-4 h-4" /> : <RefreshCcw className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))}
              {staffList.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 text-sm">
                    No staff members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-navy-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-200 dark:border-navy-700">
            <div className="p-6 border-b border-gray-100 dark:border-navy-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-brand-500" /> Create Staff Account
              </h3>
            </div>
            <form onSubmit={handleCreateStaff} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Institutional ID (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. NEC-CSE-STF-001"
                  value={formData.institutional_id}
                  onChange={(e) => setFormData({ ...formData, institutional_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-gray-50 dark:bg-navy-900 text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Username *</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-gray-50 dark:bg-navy-900 text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-gray-50 dark:bg-navy-900 text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-gray-50 dark:bg-navy-900 text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  >
                    <option value="Staff">Staff</option>
                    <option value="Faculty">Faculty</option>
                    <option value="Admin">Admin</option>
                    <option value="Super Admin">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Initial Password</label>
                  <input
                    type="text"
                    placeholder="Staff@123"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-gray-50 dark:bg-navy-900 text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  />
                </div>
              </div>
              
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl font-bold text-sm bg-gray-100 dark:bg-navy-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-navy-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-xl font-bold text-sm bg-brand-600 text-white hover:bg-brand-700 transition-colors"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
