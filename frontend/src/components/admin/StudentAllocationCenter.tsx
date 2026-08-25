import React, { useState, useEffect } from 'react';
import { Search, UserCheck, ShieldAlert, ArrowRightLeft, Users } from 'lucide-react';
import api from '../../services/api';
import { useNotification } from '../../context/NotificationContext';

export const StudentAllocationCenter: React.FC = () => {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [unassignedStudents, setUnassignedStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const { notify, confirmAction } = useNotification();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [staffRes, studentsRes] = await Promise.all([
        api.get('/admin/staff-list'),
        api.get('/admin/unassigned-students')
      ]);
      setStaffList(staffRes.data || []);
      setUnassignedStudents(studentsRes.data?.students || []);
    } catch (err) {
      notify.error('Failed to load allocation data.', '', { category: 'ALLOCATION' });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAssign = async () => {
    if (!selectedStaff || selectedStudents.length === 0) {
      notify.error('Please select both staff and students.', '', { category: 'ALLOCATION' });
      return;
    }

    const isConfirmed = await confirmAction({
      title: 'Confirm Assignment',
      message: `You are about to assign ${selectedStudents.length} students to the selected staff member. Proceed?`,
      confirmLabel: 'Assign Students',
      variant: 'info',
    });

    if (isConfirmed) {
      try {
        await api.post('/admin/bulk-assign', {
          staff_id: parseInt(selectedStaff),
          student_ids: selectedStudents.map(id => parseInt(id))
        });
        notify.success('Students successfully assigned.', '', { category: 'ALLOCATION' });
        setSelectedStudents([]);
        fetchData();
      } catch (err: any) {
        notify.error(err.response?.data?.detail || 'Assignment failed.', '', { category: 'ALLOCATION' });
      }
    }
  };

  const toggleStudent = (id: string) => {
    setSelectedStudents(prev => 
      prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Student Allocation Center</h2>
        <p className="text-sm text-gray-500">Assign unassigned students to active faculty and mentors.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Pane: Unassigned Students */}
        <div className="bg-white dark:bg-navy-800 rounded-2xl border border-gray-200 dark:border-navy-700 p-5 flex flex-col h-[500px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-500" /> Unassigned Students
              <span className="bg-gray-100 dark:bg-navy-700 text-xs px-2 py-0.5 rounded-full">
                {unassignedStudents.length}
              </span>
            </h3>
            <button
              onClick={() => setSelectedStudents(unassignedStudents.map(s => String(s.id)))}
              className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
            >
              Select All
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {unassignedStudents.length === 0 && !loading && (
              <div className="text-center py-10 text-gray-500 text-sm">
                No unassigned students found.
              </div>
            )}
            {unassignedStudents.map(student => (
              <div
                key={student.id}
                onClick={() => toggleStudent(String(student.id))}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedStudents.includes(String(student.id))
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                    : 'border-gray-200 dark:border-navy-600 hover:border-gray-300 dark:hover:border-navy-500'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedStudents.includes(String(student.id))}
                      onChange={() => {}}
                      className="w-4 h-4 text-brand-600 rounded"
                    />
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{student.name || student.username}</p>
                      <p className="text-xs text-gray-500">{student.reg_no} • {student.department}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Pane: Staff Selection */}
        <div className="bg-white dark:bg-navy-800 rounded-2xl border border-gray-200 dark:border-navy-700 p-5 flex flex-col h-[500px]">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <UserCheck className="w-4 h-4 text-emerald-500" /> Target Staff Member
          </h3>
          
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {staffList.filter(s => s.is_active).map(staff => (
              <div
                key={staff.id}
                onClick={() => setSelectedStaff(String(staff.id))}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedStaff === String(staff.id)
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'border-gray-200 dark:border-navy-600 hover:border-gray-300 dark:hover:border-navy-500'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    selectedStaff === String(staff.id) ? 'border-emerald-500' : 'border-gray-300'
                  }`}>
                    {selectedStaff === String(staff.id) && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{staff.username}</p>
                    <p className="text-xs text-gray-500">{staff.role} • {staff.email}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-navy-700">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-500">Selected Students:</span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">{selectedStudents.length}</span>
            </div>
            <button
              onClick={handleBulkAssign}
              disabled={selectedStudents.length === 0 || !selectedStaff}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              Confirm Assignment <ArrowRightLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
