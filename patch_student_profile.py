import pathlib
p = pathlib.Path(r"e:\Leetcode Web\frontend\src\pages\StudentProfilePage.tsx")
content = p.read_text(encoding="utf-8")

# 1. Add useAuth import
if "useAuth" not in content:
    content = content.replace(
        "import { useNotification } from '../context/NotificationContext';",
        "import { useNotification } from '../context/NotificationContext';\nimport { useAuth } from '../context/AuthContext';"
    )

# 2. Add useAuth hooks inside the component
if "const { user, isAuthenticated } = useAuth();" not in content:
    content = content.replace(
        "const { notify, confirmAction } = useNotification();",
        "const { notify, confirmAction } = useNotification();\n  const { user, isAuthenticated } = useAuth();\n  const isSuperAdmin = user?.role?.toLowerCase() === 'super admin' || user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'administrator';"
    )

# 3. Add handleDeleteStudent logic
if "const handleDeleteStudent" not in content:
    content = content.replace(
        "  // 2. EDIT BUTTON HANDLER",
        """  // 2. EDIT BUTTON HANDLER
  const handleDeleteStudent = async () => {
    const targetId = resolveTargetId();
    if (!targetId) return;
    
    confirmAction({
      title: 'Delete Student',
      message: `Are you sure you want to permanently delete this student record? This action cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete Student',
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          await api.post('/students/bulk-delete', { student_ids: [targetId], soft_delete: false });
          notify.success('Student Deleted', 'Student record has been permanently deleted from the database.', { category: 'STUDENT PROFILE' });
          onBack(); // Close modal
        } catch (err: any) {
          notify.error('Delete Failed', err.response?.data?.detail || 'Failed to delete student.', { category: 'STUDENT PROFILE' });
        } finally {
          setIsDeleting(false);
        }
      }
    });
  };

  // 2. EDIT BUTTON HANDLER"""
    )

# 4. Add the buttons next to Audit
buttons_html = """            {/* 3. AUDIT */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setShowAuditModal(true);
              }}
              className="min-h-[40px] px-2 sm:px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center space-x-1 sm:space-x-1.5 shadow-md shadow-emerald-600/30 transition-all active:scale-95 sm:hover:scale-105 min-w-0 cursor-pointer touch-manipulation select-none"
            >
              <FileText className="w-3.5 h-3.5 text-white shrink-0" />
              <span className="truncate">Audit</span>
            </button>
            
            {isAuthenticated && isSuperAdmin && (
              <>
                {/* 4. EDIT */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleOpenEditModal();
                  }}
                  className="min-h-[40px] px-2 sm:px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center space-x-1 sm:space-x-1.5 shadow-md shadow-blue-600/30 transition-all active:scale-95 sm:hover:scale-105 min-w-0 cursor-pointer touch-manipulation select-none"
                >
                  <Edit3 className="w-3.5 h-3.5 text-white shrink-0" />
                  <span className="truncate">Edit</span>
                </button>

                {/* 5. DELETE */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleDeleteStudent();
                  }}
                  disabled={isDeleting}
                  className="min-h-[40px] px-2 sm:px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center space-x-1 sm:space-x-1.5 shadow-md shadow-rose-600/30 transition-all active:scale-95 sm:hover:scale-105 min-w-0 disabled:opacity-50 cursor-pointer touch-manipulation select-none"
                >
                  <Trash2 className="w-3.5 h-3.5 text-white shrink-0" />
                  <span className="truncate">{isDeleting ? '...' : 'Delete'}</span>
                </button>
              </>
            )}"""

if "{/* 4. EDIT */}" not in content:
    old_audit_btn = """            {/* 3. AUDIT */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setShowAuditModal(true);
              }}
              className="min-h-[40px] px-2 sm:px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center space-x-1 sm:space-x-1.5 shadow-md shadow-emerald-600/30 transition-all active:scale-95 sm:hover:scale-105 min-w-0 cursor-pointer touch-manipulation select-none"
            >
              <FileText className="w-3.5 h-3.5 text-white shrink-0" />
              <span className="truncate">Audit</span>
            </button>"""
    
    content = content.replace(old_audit_btn, buttons_html)

p.write_text(content, encoding="utf-8")
print("Done patching StudentProfilePage.tsx")
