import React, { useState, useEffect, useMemo } from 'react';
import { Search, UserCheck, Users, RefreshCw, Filter, GraduationCap, Building2, CheckSquare, Square, ArrowRightLeft, Sparkles, X } from 'lucide-react';
import api from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { AllocationConfirmationModal } from './AllocationConfirmationModal';

export const StudentAllocationCenter: React.FC = () => {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [unassignedStudents, setUnassignedStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // Filters
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const { notify, confirmAction } = useNotification();

  useEffect(() => {
    fetchData();
    const handleStaffUpdate = () => {
      fetchData();
    };
    window.addEventListener('nec_staff_updated', handleStaffUpdate);
    return () => {
      window.removeEventListener('nec_staff_updated', handleStaffUpdate);
    };
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

  // Exact helper to normalize year string with strict priority order
  const formatYear = (y: string | undefined | null) => {
    if (!y) return 'N/A';
    const clean = String(y).toUpperCase().trim();
    if (clean === 'IV' || clean === '4' || clean.startsWith('IV')) return 'IV Year';
    if (clean === 'III' || clean === '3' || clean.startsWith('III')) return 'III Year';
    if (clean === 'II' || clean === '2' || clean.startsWith('II')) return 'II Year';
    if (clean === 'I' || clean === '1' || clean.startsWith('I')) return 'I Year';
    return y;
  };

  // Helper to match department safely
  const matchDept = (studentDept: string | undefined | null, target: string) => {
    if (target === 'ALL') return true;
    if (!studentDept) return false;
    const clean = studentDept.toUpperCase().replace(/[\s\(\)-]/g, '');
    if (target === 'CSE(CS)') {
      return clean === 'CSECS' || clean.includes('CYBER') || (clean.includes('CS') && !clean.includes('IOT'));
    }
    if (target === 'CSE(IOT)') {
      return clean === 'CSEIOT' || clean.includes('IOT') || clean.includes('INTERNET');
    }
    return clean.includes(target.toUpperCase().replace(/[\s\(\)-]/g, ''));
  };

  // Filtered students computation
  const filteredStudents = useMemo(() => {
    return unassignedStudents.filter((student) => {
      // Department filter
      if (!matchDept(student.department, selectedDept)) {
        return false;
      }

      // Year filter
      if (selectedYear !== 'ALL') {
        const yr = formatYear(student.year_level);
        if (yr !== selectedYear) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (student.name || '').toLowerCase().includes(q);
        const regMatch = (student.reg_no || '').toLowerCase().includes(q);
        const userMatch = (student.username || '').toLowerCase().includes(q);
        if (!nameMatch && !regMatch && !userMatch) return false;
      }

      return true;
    });
  }, [unassignedStudents, selectedDept, selectedYear, searchQuery]);

  // Accurate Counts for Department Tabs
  const deptCounts = useMemo(() => {
    let cyber = 0;
    let iot = 0;
    unassignedStudents.forEach(s => {
      if (matchDept(s.department, 'CSE(CS)')) cyber++;
      else if (matchDept(s.department, 'CSE(IOT)')) iot++;
    });
    return { all: unassignedStudents.length, cyber, iot };
  }, [unassignedStudents]);

  // Accurate Year Counts (scoped dynamically to selected Department)
  const yearCounts = useMemo(() => {
    const pool = unassignedStudents.filter(s => matchDept(s.department, selectedDept));
    let y2 = 0;
    let y3 = 0;
    let y4 = 0;
    pool.forEach(s => {
      const yr = formatYear(s.year_level);
      if (yr === 'II Year') y2++;
      else if (yr === 'III Year') y3++;
      else if (yr === 'IV Year') y4++;
    });
    return { all: pool.length, y2, y3, y4 };
  }, [unassignedStudents, selectedDept]);

  const handleBulkAssign = () => {
    if (!selectedStaff || selectedStudents.length === 0) {
      notify.error('Please select both a staff member and at least one student.', '', { category: 'ALLOCATION' });
      return;
    }
    setShowConfirmModal(true);
  };

  const executeConfirmAllocation = async () => {
    const staffObj = staffList.find(s => String(s.id) === selectedStaff);
    const staffName = staffObj ? staffObj.username : 'the selected staff';

    await api.post('/admin/bulk-assign', {
      staff_id: parseInt(selectedStaff),
      student_ids: selectedStudents.map(id => parseInt(id))
    });
    notify.success(`Successfully assigned ${selectedStudents.length} students to ${staffName}!`, '', { category: 'ALLOCATION' });
    setSelectedStudents([]);
    await fetchData();
    window.dispatchEvent(new CustomEvent('nec_staff_updated'));
  };

  const toggleStudent = (id: string) => {
    setSelectedStudents(prev => 
      prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    const visibleIds = filteredStudents.map(s => String(s.id));
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedStudents.includes(id));
    if (allSelected) {
      setSelectedStudents(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedStudents(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const clearSelection = () => {
    setSelectedStudents([]);
  };

  const isAllVisibleSelected = filteredStudents.length > 0 && filteredStudents.every(s => selectedStudents.includes(String(s.id)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-500" /> Student Allocation Center
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Filter by Department &amp; Academic Year to accurately assign unallocated students to faculty mentors.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>{unassignedStudents.length} Unallocated Students</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Pane: Unassigned Students with Year & Department Filters */}
        <div className="lg:col-span-7 bg-white dark:bg-navy-800 rounded-3xl border border-gray-200 dark:border-navy-700 p-5 flex flex-col h-[650px] shadow-sm">
          
          {/* Department Filters */}
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-500" /> Department Scope
              </span>
              <span className="text-[10px] text-gray-400">
                Showing {filteredStudents.length} of {unassignedStudents.length}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedDept('ALL')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  selectedDept === 'ALL'
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                    : 'bg-gray-100 dark:bg-navy-900 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-navy-700'
                }`}
              >
                <span>All Depts</span>
                <span className="px-1.5 py-0.2 rounded-md text-[10px] bg-black/10 dark:bg-white/10">{deptCounts.all}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDept('CSE(CS)')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  selectedDept === 'CSE(CS)'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                    : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 hover:bg-purple-500/20'
                }`}
              >
                <span>CSE (CS)</span>
                <span className="px-1.5 py-0.2 rounded-md text-[10px] bg-purple-500/20">{deptCounts.cyber}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDept('CSE(IOT)')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  selectedDept === 'CSE(IOT)'
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/20'
                    : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20'
                }`}
              >
                <span>CSE (IoT)</span>
                <span className="px-1.5 py-0.2 rounded-md text-[10px] bg-cyan-500/20">{deptCounts.iot}</span>
              </button>
            </div>

            {/* Academic Year Cohort Tabs */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-emerald-500" /> Academic Year Cohort
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setSelectedYear('ALL')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                  selectedYear === 'ALL'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-navy-900 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-navy-700'
                }`}
              >
                All ({yearCounts.all})
              </button>
              <button
                type="button"
                onClick={() => setSelectedYear('II Year')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                  selectedYear === 'II Year'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                }`}
              >
                II Year ({yearCounts.y2})
              </button>
              <button
                type="button"
                onClick={() => setSelectedYear('III Year')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                  selectedYear === 'III Year'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                }`}
              >
                III Year ({yearCounts.y3})
              </button>
              <button
                type="button"
                onClick={() => setSelectedYear('IV Year')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                  selectedYear === 'IV Year'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                }`}
              >
                IV Year ({yearCounts.y4})
              </button>
            </div>

            {/* Search Input & Select All Controls */}
            <div className="flex items-center gap-2 pt-1">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by name, roll no, or section..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-9 pr-8 text-xs font-medium rounded-xl border border-gray-200 dark:border-navy-700 bg-gray-50 dark:bg-navy-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={selectAllFiltered}
                className="px-3 h-9 rounded-xl text-xs font-bold bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 border border-brand-500/20 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                {isAllVisibleSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                <span>{isAllVisibleSelected ? 'Deselect View' : `Select (${filteredStudents.length})`}</span>
              </button>
            </div>
          </div>
          
          {/* Students Scrollable List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {filteredStudents.length === 0 && !loading && (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400 text-xs space-y-2">
                <Users className="w-8 h-8 mx-auto text-gray-300 dark:text-navy-600" />
                <p className="font-bold">No unassigned students match this filter.</p>
                <button
                  onClick={() => { setSelectedDept('ALL'); setSelectedYear('ALL'); setSearchQuery(''); }}
                  className="text-brand-600 dark:text-brand-400 hover:underline font-bold text-xs"
                >
                  Reset all filters
                </button>
              </div>
            )}

            {filteredStudents.map((student) => {
              const isSelected = selectedStudents.includes(String(student.id));
              const isCyber = (student.department || '').toUpperCase().includes('CS');
              const yearBadge = formatYear(student.year_level);

              return (
                <div
                  key={student.id}
                  onClick={() => toggleStudent(String(student.id))}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50/70 dark:bg-brand-950/30 shadow-sm'
                      : 'border-gray-200/80 dark:border-navy-700/80 hover:border-gray-300 dark:hover:border-navy-600 bg-white dark:bg-navy-900/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="w-4 h-4 text-brand-600 rounded cursor-pointer shrink-0"
                    />
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-gray-900 dark:text-white truncate">
                          {student.name || student.username}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-gray-500">
                        <span className="font-mono font-bold text-gray-600 dark:text-gray-400">{student.reg_no}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pl-2">
                    {/* Department Badge */}
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                      isCyber 
                        ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' 
                        : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
                    }`}>
                      {student.department || (isCyber ? 'CSE(CS)' : 'CSE(IOT)')}
                    </span>

                    {/* Year Badge */}
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      {yearBadge}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Pane: Target Staff Selection */}
        <div className="lg:col-span-5 bg-white dark:bg-navy-800 rounded-3xl border border-gray-200 dark:border-navy-700 p-5 flex flex-col h-[650px] shadow-sm justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-500" /> Target Staff Member
              </h3>
              <button
                onClick={fetchData}
                className="text-xs font-bold text-gray-400 hover:text-emerald-500 flex items-center gap-1 transition-colors cursor-pointer"
                title="Refresh staff list"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <p className="text-[11px] text-gray-400 mb-3">
              Select an active mentor to assign the selected students.
            </p>
            
            <div className="max-h-[380px] overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
              {staffList.filter(s => s.is_active).length === 0 && !loading && (
                <div className="text-center py-12 text-gray-400 text-xs">
                  No active staff members found. Add staff in Staff Management above.
                </div>
              )}
              {staffList.filter(s => s.is_active).map((staff) => {
                const isSelected = selectedStaff === String(staff.id);
                return (
                  <div
                    key={staff.id}
                    onClick={() => setSelectedStaff(String(staff.id))}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 shadow-sm ring-2 ring-emerald-500/20'
                        : 'border-gray-200 dark:border-navy-700 hover:border-gray-300 dark:hover:border-navy-600 bg-white dark:bg-navy-900/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-emerald-500' : 'border-gray-300 dark:border-navy-600'
                        }`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                        </div>
                        <div>
                          <p className="text-xs font-black text-gray-900 dark:text-white">{staff.username}</p>
                          <p className="text-[10px] text-gray-400">{staff.email}</p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                          {staff.role || 'Faculty'}
                        </span>
                        <span className="text-[10px] font-bold text-gray-500">
                          {staff.assigned_count || 0} / {staff.max_capacity || 30} Allocated
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Allocation Action Summary Card */}
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-navy-700 space-y-3">
            <div className="p-3 bg-gray-50 dark:bg-navy-900/60 rounded-2xl border border-gray-200/60 dark:border-navy-700 space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-medium">Selected for Allocation:</span>
                <span className="font-black text-brand-600 dark:text-brand-400 text-sm">
                  {selectedStudents.length} Student{selectedStudents.length !== 1 ? 's' : ''}
                </span>
              </div>
              {selectedStaff && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">Assignee:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {staffList.find(s => String(s.id) === selectedStaff)?.username}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {selectedStudents.length > 0 && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="px-3.5 py-3 rounded-2xl font-bold text-xs bg-gray-100 dark:bg-navy-900 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-navy-700 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={handleBulkAssign}
                disabled={selectedStudents.length === 0 || !selectedStaff}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>Confirm &amp; Allocate ({selectedStudents.length})</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Premium Institutional Allocation Confirmation Modal */}
      <AllocationConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={executeConfirmAllocation}
        targetStaff={staffList.find(s => String(s.id) === selectedStaff) || null}
        selectedCount={selectedStudents.length}
      />
    </div>
  );
};
