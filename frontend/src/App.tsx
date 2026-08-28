import React, { useState, useEffect, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { StudentMasterPage } from './pages/StudentMasterPage';
import { StudentProfilePage } from './pages/StudentProfilePage';
import { AlertCenterModal } from './components/AlertCenterModal';
import { ImportModal } from './components/ImportModal';
import { AccessRestrictedView } from './components/AccessRestrictedView';
import { AIAssistantWidget } from './components/AIAssistantWidget';
import { StudentData } from './components/LeaderboardTable';
import api, { logActivity } from './services/api';
import { getCachedSummary, saveCachedSummary } from './data/canonicalRoster';
import { useAuth } from './context/AuthContext';

// Lazy-loaded heavy page modules for 60%+ smaller initial bundle size & ultra-fast initial load
const ComparePage = lazy(() => import('./pages/ComparePage').then(m => ({ default: m.ComparePage })));
const DataQualityPage = lazy(() => import('./pages/DataQualityPage').then(m => ({ default: m.DataQualityPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const DepartmentDashboard = lazy(() => import('./pages/DepartmentDashboard').then(m => ({ default: m.DepartmentDashboard })));
const PublicLeaderboardPage = lazy(() => import('./pages/PublicLeaderboardPage').then(m => ({ default: m.PublicLeaderboardPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const AuditLogPage = lazy(() => import('./pages/AuditLogPage').then(m => ({ default: m.AuditLogPage })));
const WeeklyContestPage = lazy(() => import('./pages/WeeklyContestPage').then(m => ({ default: m.WeeklyContestPage })));
const StudentDashboardView = lazy(() => import('./pages/StudentDashboardView').then(m => ({ default: m.StudentDashboardView })));
const StaffDashboardView = lazy(() => import('./pages/StaffDashboardView').then(m => ({ default: m.StaffDashboardView })));
const GrowthIntelligencePage = lazy(() => import('./pages/GrowthIntelligencePage').then(m => ({ default: m.GrowthIntelligencePage })));
const SystemHealthPage = lazy(() => import('./pages/SystemHealthPage').then(m => ({ default: m.SystemHealthPage })));
const CertificateVerificationPage = lazy(() => import('./pages/CertificateVerificationPage').then(m => ({ default: m.CertificateVerificationPage })));
const AIControlCenterPage = lazy(() => import('./pages/AIControlCenterPage').then(m => ({ default: m.AIControlCenterPage })));
const HODCommandCenter = lazy(() => import('./pages/HODCommandCenter').then(m => ({ default: m.HODCommandCenter })));
const FacultyActionCenter = lazy(() => import('./pages/FacultyActionCenter').then(m => ({ default: m.FacultyActionCenter })));
const StudentDataIssuesPage = lazy(() => import('./pages/StudentDataIssuesPage').then(m => ({ default: m.StudentDataIssuesPage })));
const HallOfFameKioskPage = lazy(() => import('./pages/HallOfFameKioskPage').then(m => ({ default: m.HallOfFameKioskPage })));
const AccreditationStudioPage = lazy(() => import('./pages/AccreditationStudioPage').then(m => ({ default: m.AccreditationStudioPage })));
const AccessDeniedPage = lazy(() => import('./pages/AccessDeniedPage').then(m => ({ default: m.AccessDeniedPage })));

const PageSkeleton = () => (
  <div className="p-8 text-center py-20 text-brand-600 dark:text-brand-400 font-bold space-y-3 animate-pulse">
    <div className="w-8 h-8 mx-auto border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
    <p className="text-xs">Loading performance module...</p>
  </div>
);

export const App: React.FC = () => {
  // Direct Public Route Interceptors
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  if (pathname === '/hall-of-fame' || pathname === '/kiosk' || pathname === '/tv') {
    return <HallOfFameKioskPage />;
  }
  if (pathname === '/accreditation-studio' || pathname === '/accreditation' || pathname === '/naac-nba') {
    return <AccreditationStudioPage />;
  }

  const verifyPrefixes = ['/verify/', '/verify-certificate/', '/certificate/verify/', '/certificates/verify/', '/verify-contest/'];
  const matchedPrefix = verifyPrefixes.find(p => pathname.startsWith(p));
  if (matchedPrefix) {
    const rawCode = pathname.replace(matchedPrefix, '');
    const certId = decodeURIComponent(rawCode).split('/')[0].split('?')[0].trim();
    return <CertificateVerificationPage verificationId={certId} />;
  }

  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('landing');
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAlertCenterModal, setShowAlertCenterModal] = useState(false);
  const [summaryData, setSummaryData] = useState<any>(() => getCachedSummary());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);


  useEffect(() => {
    fetchSummary();
    const timer = setTimeout(() => {
      triggerCloudSync();
    }, 4000);

    return () => {
      clearTimeout(timer);
    };
  }, [isAuthenticated]);


  useEffect(() => {
    if (showLoginModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showLoginModal]);


  const fetchSummary = async () => {
    try {
      const res = await api.get('/sessions/dashboard-summary');
      if (res.data) {
        setSummaryData(res.data);
        saveCachedSummary(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const triggerCloudSync = async () => {
    try {
      const res = await api.get('/students');
      if (res.data && res.data.length > 0) {
        const { syncAllStudentsToFirestoreWeb } = await import('./services/firebaseSync');
        await syncAllStudentsToFirestoreWeb(res.data);
      }
    } catch (err) {
      console.warn("Auto Cloud Sync notice:", err);
    }
  };

  const TAB_DESCRIPTIONS: Record<string, string> = {
    landing: 'Visited Landing Page & College Leaderboard',
    dashboard: 'Visited Executive Dashboard & Performance Matrix',
    public: 'Visited Public Leaderboard',
    profile: 'Inspected Student Profile Details',
    compare: 'Opened Student Performance Comparison Tool',
    'audit-log': 'Inspected Admin Identity & Audit Logs',
    'ai-control-center': 'Opened AI Operations Control Center',
    'system-health': 'Visited System Health & Data Quality Board',
    reports: 'Opened Executive Reports & Data Exporters',
    'hod-command-center': 'Visited HOD Command Center',
    'faculty-action-center': 'Visited Faculty Action Center',
    'student-data-issues': 'Visited Student Data Issues & Reconciliation',
    certificates: 'Opened Certificate Verification Engine',
    settings: 'Visited Institutional System Settings'
  };

  const handleTabChange = (tab: string) => {
    const pageDesc = TAB_DESCRIPTIONS[tab] || `Visited ${tab.toUpperCase()} page`;
    logActivity('PAGE_NAVIGATE', pageDesc, { page: tab, role: user?.role });
    if (tab === 'alert-center') {
      setShowAlertCenterModal(true);
      return;
    }
    if (tab === 'login') {
      setShowLoginModal(true);
      return;
    }
    if (!isAuthenticated && tab !== 'landing' && tab !== 'public' && tab !== 'profile') {
      setShowLoginModal(true);
      return;
    }
    setActiveTab(tab);
    // Robust scroll-to-top: covers window, html, and any scrollable main container
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    // Also fire after React re-render / framer-motion animation starts
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  };

  const handleSelectStudent = (student: StudentData) => {
    if (!student) return;
    setSelectedStudent(student);
  };

  // Lock body scroll securely preserving exact viewport scroll position when selectedStudent modal is open
  useEffect(() => {
    if (selectedStudent) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const onKey = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape') setSelectedStudent(null);
      };
      window.addEventListener('keydown', onKey);

      return () => {
        document.body.style.overflow = prevOverflow || '';
        window.removeEventListener('keydown', onKey);
      };
    }
  }, [selectedStudent]);

  // Global Keyboard Shortcuts & Pro SaaS UX System
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Quick Search shortcut: '/' (when not typing in an input) or 'Ctrl+K' / 'Cmd+K'
      const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
      const isSearchShortcut = (e.key === '/' && !isInputFocused) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k');

      if (isSearchShortcut) {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[type="text"][placeholder*="search" i], input[type="text"][placeholder*="Search" i], input[type="text"][placeholder*="Register" i]'
        );
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      // 2. Global Escape key handler to dismiss active modals & dialogs
      if (e.key === 'Escape') {
        if (selectedStudent) setSelectedStudent(null);
        if (showLoginModal) setShowLoginModal(false);
        if (showImportModal) setShowImportModal(false);
        if (showAlertCenterModal) setShowAlertCenterModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedStudent, showLoginModal, showImportModal, showAlertCenterModal]);

  // Determine main dashboard component based on role
  const renderDashboardComponent = () => {
    const roleClean = (user?.role || '').trim().toLowerCase();
    if (roleClean === 'student') {
      return <StudentDashboardView />;
    }
    if (roleClean === 'staff' || roleClean === 'faculty') {
      return <StaffDashboardView />;
    }
    if (roleClean === 'hod') {
      return <HODCommandCenter />;
    }
    return (
      <DashboardPage
        onSelectStudent={handleSelectStudent}
        onOpenImport={() => setShowImportModal(true)}
        onNavigateTab={(tab) => handleTabChange(tab)}
      />
    );
  };

  // ─── CENTRALIZED ROLE PERMISSION MATRIX ────────────────────────────────────
  // Single source of truth for all role-based tab access.
  // NEVER duplicate this logic across components.
  const ROLE_PERMISSIONS: Record<string, string[]> = {
    // Super admin / admin: full access
    admin:        ['dashboard','landing','public','profile','students','hod-command-center','faculty-action-center','departments','compare','growth','quality','data-issues','weekly-contest','reports','audit','settings','system-health','ai-control','staff-dashboard','student-dashboard'],
    super_admin:  ['dashboard','landing','public','profile','students','hod-command-center','faculty-action-center','departments','compare','growth','quality','data-issues','weekly-contest','reports','audit','settings','system-health','ai-control','staff-dashboard','student-dashboard'],
    'super admin':['dashboard','landing','public','profile','students','hod-command-center','faculty-action-center','departments','compare','growth','quality','data-issues','weekly-contest','reports','audit','settings','system-health','ai-control','staff-dashboard','student-dashboard'],
    // HOD: command center + faculty tools; NO admin-only pages
    hod:          ['dashboard','landing','public','profile','hod-command-center','faculty-action-center','departments','compare','growth','quality','data-issues','weekly-contest','reports'],
    // FACULTY / STAFF: isolated to faculty portal only — NO HOD/Admin pages
    faculty:      ['dashboard','landing','public','faculty-action-center','weekly-contest','reports'],
    staff:        ['dashboard','landing','public','faculty-action-center','weekly-contest','reports'],
    professor:    ['dashboard','landing','public','faculty-action-center','weekly-contest','reports'],
    // Student: minimal access
    student:      ['dashboard','landing','public','profile'],
  };

  const isTabAllowed = (tab: string): boolean => {
    if (!isAuthenticated) return ['landing', 'public', 'profile'].includes(tab);
    const roleClean = (user?.role || '').trim().toLowerCase();
    const allowed = ROLE_PERMISSIONS[roleClean] || ROLE_PERMISSIONS['admin'];
    return allowed.includes(tab);
  };

  // Legacy compatibility — used by a few other components
  const isTabAuthorized = (allowedRoles: string[]): boolean => {
    if (!isAuthenticated) return false;
    const roleClean = (user?.role || '').trim().toLowerCase();
    if (roleClean === 'admin' || roleClean === 'super admin' || roleClean === 'super_admin') return true;
    return allowedRoles.some(r => r.toLowerCase() === roleClean);
  };

  const isFacultyRole = (): boolean => {
    const r = (user?.role || '').trim().toLowerCase();
    return r === 'faculty' || r === 'staff' || r === 'professor';
  };

  const renderAccessDenied = (resourceTitle: string) => (
    <AccessDeniedPage
      restrictedResource={resourceTitle}
      onGoBack={() => handleTabChange(isFacultyRole() ? 'faculty-action-center' : (isAuthenticated ? 'dashboard' : 'landing'))}
    />
  );

  // Full-screen login for unauthenticated users
  if (!isAuthenticated) {
    return (
      <LoginPage
        onSuccess={() => {
          // Role-aware redirect after login.
          // IMPORTANT: user state from useAuth() is async — it hasn't updated yet here.
          // Read role directly from localStorage where AuthContext writes it synchronously.
          let roleClean = '';
          try {
            const stored = localStorage.getItem('user');
            if (stored) {
              const parsed = JSON.parse(stored);
              roleClean = (parsed?.role || '').trim().toLowerCase();
            }
          } catch (_e) {}
          // Fallback to context if localStorage not yet written
          if (!roleClean) roleClean = (user?.role || '').trim().toLowerCase();

          if (roleClean === 'faculty' || roleClean === 'staff' || roleClean === 'professor') {
            setActiveTab('faculty-action-center');
          } else if (roleClean === 'hod') {
            setActiveTab('hod-command-center');
          } else if (roleClean === 'student') {
            setActiveTab('dashboard');
          } else {
            setActiveTab('dashboard');
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-navy-950 text-gray-900 dark:text-gray-100 flex flex-col font-sans transition-colors duration-200">
      
      {/* Top Navbar */}
      <Navbar
        currentSessionStatus={summaryData?.current_session?.status || "UPCOMING"}
        onOpenLogin={() => setShowLoginModal(true)}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      />

      <div className="flex-1 w-full py-4 sm:py-6 px-3 sm:px-5 lg:px-7 2xl:px-8 max-w-full mx-auto relative">
        
        {/* Slide-out Sidebar Drawer */}
        {isAuthenticated && (
          <Sidebar 
            activeTab={activeTab} 
            setActiveTab={(tab) => {
              handleTabChange(tab);
              setIsSidebarOpen(false);
            }} 
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main Content View Container with Framer Motion Transition */}
        <AnimatePresence mode="wait">
          <motion.main
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="min-w-0 w-full"
          >

          
            <Suspense fallback={<PageSkeleton />}>
              {activeTab === 'landing' && (
                <LandingPage
                  summaryData={summaryData}
                  onViewDashboard={() => handleTabChange('dashboard')}
                  onOpenLogin={() => setShowLoginModal(true)}
                  onSelectStudent={handleSelectStudent}
                />
              )}

              {activeTab === 'dashboard' && renderDashboardComponent()}

              {activeTab === 'hod-command-center' && (
                isTabAllowed('hod-command-center')
                  ? <HODCommandCenter />
                  : renderAccessDenied('HOD Command Center')
              )}

              {activeTab === 'faculty-action-center' && (
                isTabAllowed('faculty-action-center')
                  ? <FacultyActionCenter />
                  : renderAccessDenied('Faculty Action Center')
              )}

              {activeTab === 'growth' && (
                isTabAllowed('growth')
                  ? <GrowthIntelligencePage />
                  : renderAccessDenied('Growth Intelligence')
              )}

              {activeTab === 'student-dashboard' && <StudentDashboardView />}

              {activeTab === 'staff-dashboard' && <StaffDashboardView />}

              {activeTab === 'departments' && (
                isTabAllowed('departments')
                  ? <DepartmentDashboard onSelectStudent={handleSelectStudent} />
                  : renderAccessDenied('Department Analytics')
              )}

              {activeTab === 'weekly-contest' && (
                isTabAllowed('weekly-contest')
                  ? <WeeklyContestPage onSelectStudent={handleSelectStudent} />
                  : renderAccessDenied('Weekly Contest Tracker')
              )}

              {activeTab === 'students' && (
                isTabAllowed('students')
                  ? <StudentMasterPage onSelectStudent={handleSelectStudent} onOpenImport={() => setShowImportModal(true)} />
                  : renderAccessDenied('Student Master Management')
              )}

              {activeTab === 'profile' && selectedStudent && (
                <StudentProfilePage
                  student={selectedStudent}
                  onBack={() => setActiveTab(isAuthenticated ? 'dashboard' : 'landing')}
                />
              )}

              {activeTab === 'compare' && (
                isTabAllowed('compare')
                  ? <ComparePage />
                  : renderAccessDenied('Student Comparison')
              )}

              {activeTab === 'quality' && (
                isTabAllowed('quality')
                  ? <DataQualityPage onNavigateTab={handleTabChange} />
                  : renderAccessDenied('Data Quality Board')
              )}

              {(activeTab === 'data-issues' || activeTab === 'issues' || activeTab === 'not-started-issues') && (
                isTabAllowed('data-issues')
                  ? <StudentDataIssuesPage />
                  : renderAccessDenied('Student Data Issues & Recovery')
              )}

              {activeTab === 'system-health' && (
                isTabAllowed('system-health')
                  ? <SystemHealthPage onNavigateTab={setActiveTab} />
                  : renderAccessDenied('System Operations — Admin Only')
              )}

              {activeTab === 'reports' && (
                isTabAllowed('reports')
                  ? <ReportsPage />
                  : renderAccessDenied('Reports & Exports')
              )}

              {activeTab === 'public' && (
                <PublicLeaderboardPage onSelectStudent={handleSelectStudent} />
              )}

              {activeTab === 'settings' && (
                isTabAllowed('settings')
                  ? <SettingsPage />
                  : renderAccessDenied('Admin Settings — Admin Only')
              )}

              {activeTab === 'audit' && (
                isTabAllowed('audit')
                  ? <AuditLogPage />
                  : renderAccessDenied('Audit Log — Admin Only')
              )}

              {activeTab === 'ai-control' && (
                isTabAllowed('ai-control')
                  ? <AIControlCenterPage />
                  : renderAccessDenied('AI Control Center — Admin Only')
              )}
            </Suspense>
          </motion.main>
        </AnimatePresence>


      </div>

      {/* Login Modal (used for re-authentication when already inside the app) */}
      {showLoginModal && (
        <LoginPage
          onClose={() => setShowLoginModal(false)}
          onSuccess={() => { setShowLoginModal(false); setActiveTab('dashboard'); }}
        />
      )}


      {/* Import Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => { fetchSummary(); setActiveTab('students'); }}
      />

      {/* Automated Alert Center Modal */}
      <AlertCenterModal
        isOpen={showAlertCenterModal}
        onClose={() => setShowAlertCenterModal(false)}
        onNavigate={handleTabChange}
      />

      {/* Floating Global NEC Unified AI Widget */}
      <AIAssistantWidget onNavigateTab={handleTabChange} />

      {/* Viewport-Centered Student Profile Modal */}
      {selectedStudent && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Student profile for ${selectedStudent.name}`}
          className="modal-overlay-responsive animate-modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedStudent(null); }}
        >
          <div
            className="modal-container-responsive bg-white dark:bg-navy-900 rounded-3xl shadow-lg border border-gray-200 dark:border-gray-800 animate-modal-content max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <StudentProfilePage
              student={selectedStudent}
              onBack={() => setSelectedStudent(null)}
            />
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
