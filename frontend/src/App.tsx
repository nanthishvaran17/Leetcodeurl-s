import React, { useState, useEffect, lazy, Suspense, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { StudentData } from './components/LeaderboardTable';
import api, { logActivity } from './services/api';
import { getCachedSummary, saveCachedSummary } from './data/canonicalRoster';
import { useAuth } from './context/AuthContext';
import { useKeyboardContext } from './context/KeyboardContext';
import { CommandPalette } from './components/CommandPalette';
import { useGlobalKeyboardShortcuts } from './hooks/useGlobalKeyboardShortcuts';
import { useCapacitorPush } from './hooks/useCapacitorPush';
import { initPushNotifications } from './services/pushNotifications';
// Critical-path pages (always needed within 1 navigation) — keep synchronous
const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const StudentMasterPage = lazy(() => import('./pages/StudentMasterPage').then(m => ({ default: m.StudentMasterPage })));
const StudentProfilePage = lazy(() => import('./pages/StudentProfilePage').then(m => ({ default: m.StudentProfilePage })));
// Heavy modals — lazy, only mounted on demand
const AlertCenterModal = lazy(() => import('./components/AlertCenterModal').then(m => ({ default: m.AlertCenterModal })));
const ImportModal = lazy(() => import('./components/ImportModal').then(m => ({ default: m.ImportModal })));
const AIAssistantWidget = lazy(() => import('./components/AIAssistantWidget').then(m => ({ default: m.AIAssistantWidget })));
// Already-lazy-loaded heavy page modules for 60%+ smaller initial bundle size & ultra-fast initial load
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
const MessagesPage = lazy(() => import('./pages/MessagesPage').then(m => ({ default: m.MessagesPage })));
const SystemHealthPage = lazy(() => import('./pages/SystemHealthPage').then(m => ({ default: m.SystemHealthPage })));
const CertificateVerificationPage = lazy(() => import('./pages/CertificateVerificationPage').then(m => ({ default: m.CertificateVerificationPage })));
const AIControlCenterPage = lazy(() => import('./pages/AIControlCenterPage').then(m => ({ default: m.AIControlCenterPage })));
const HODCommandCenter = lazy(() => import('./pages/HODCommandCenter').then(m => ({ default: m.HODCommandCenter })));
const FacultyActionCenter = lazy(() => import('./pages/FacultyActionCenter').then(m => ({ default: m.FacultyActionCenter })));
const StudentDataIssuesPage = lazy(() => import('./pages/StudentDataIssuesPage').then(m => ({ default: m.StudentDataIssuesPage })));
const HallOfFameKioskPage = lazy(() => import('./pages/HallOfFameKioskPage').then(m => ({ default: m.HallOfFameKioskPage })));
const AccreditationStudioPage = lazy(() => import('./pages/AccreditationStudioPage').then(m => ({ default: m.AccreditationStudioPage })));
const AccessDeniedPage = lazy(() => import('./pages/AccessDeniedPage').then(m => ({ default: m.AccessDeniedPage })));
const ContestIntegrityMonitor = lazy(() => import('./pages/ContestIntegrityMonitor').then(m => ({ default: m.ContestIntegrityMonitor })));

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
  
  // Initialize Native Android Capacitor Push (if applicable)
  useCapacitorPush();

  const [activeTab, setActiveTab] = useState('landing');
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAlertCenterModal, setShowAlertCenterModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [summaryData, setSummaryData] = useState<any>(() => getCachedSummary());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useGlobalKeyboardShortcuts(
    () => setShowCommandPalette(true),
    () => {
      // Logic to focus primary search
      const searchInputs = document.querySelectorAll('input[type="search"], input[placeholder*="Search"]');
      if (searchInputs.length > 0) {
        (searchInputs[0] as HTMLInputElement).focus();
      } else {
        setShowCommandPalette(true);
      }
    }
  );


  useEffect(() => {
    if (!isAuthenticated) return;
    
    fetchSummary();
    const timer = setTimeout(() => {
      triggerCloudSync();
    }, 4000);

    const handleRefresh = () => fetchSummary();
    window.addEventListener('refresh_dashboard_summary', handleRefresh);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('refresh_dashboard_summary', handleRefresh);
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

  // Initialize Native FCM Push Notifications
  useEffect(() => {
    initPushNotifications();
  }, []);

  // Handle Capacitor Android Hardware Back Button
  useEffect(() => {
    const initBackButton = async () => {
      try {
        await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
          if (isSidebarOpen) {
            setIsSidebarOpen(false);
          } else if (selectedStudent) {
            setSelectedStudent(null);
          } else if (showLoginModal) {
            setShowLoginModal(false);
          } else if (showAlertCenterModal) {
            setShowAlertCenterModal(false);
          } else if (showImportModal) {
            setShowImportModal(false);
          } else if (activeTab !== 'landing' && activeTab !== 'dashboard') {
            setActiveTab(isAuthenticated ? 'dashboard' : 'landing');
          } else if (canGoBack) {
            window.history.back();
          } else {
            CapacitorApp.exitApp();
          }
        });
      } catch (e) {
        // Not running in capacitor, ignore
      }
    };
    initBackButton();
    return () => {
      CapacitorApp.removeAllListeners();
    };
  }, [isSidebarOpen, selectedStudent, showLoginModal, showAlertCenterModal, showImportModal, activeTab, isAuthenticated]);




  const fetchSummary = async () => {
    try {
      const res = await api.get(`/sessions/dashboard-summary?_t=${Date.now()}`);
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

  const TAB_DESCRIPTIONS = useRef<Record<string, string>>({
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
  });

  const handleTabChange = useCallback((tab: string) => {
    const pageDesc = TAB_DESCRIPTIONS.current[tab] || `Visited ${tab.toUpperCase()} page`;
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
  }, [isAuthenticated, user?.role]);

  const handleSelectStudent = useCallback((student: StudentData) => {
    if (!student) return;
    setSelectedStudent(student);
  }, []);

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
  const { registerEscHandler, pushContext, popContext } = useKeyboardContext();

  useEffect(() => {
    let unregister: (() => void) | null = null;
    let contextPushed = false;
    
    if (selectedStudent || showLoginModal || showImportModal || showAlertCenterModal) {
      pushContext('MODAL');
      contextPushed = true;
      unregister = registerEscHandler(() => {
        if (selectedStudent) setSelectedStudent(null);
        if (showLoginModal) setShowLoginModal(false);
        if (showImportModal) setShowImportModal(false);
        if (showAlertCenterModal) setShowAlertCenterModal(false);
      });
    }

    return () => {
      if (unregister) unregister();
      if (contextPushed) popContext('MODAL');
    };
  }, [selectedStudent, showLoginModal, showImportModal, showAlertCenterModal, pushContext, popContext, registerEscHandler]);

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
  const ALL_ACADEMIC_TABS = useMemo(() => ['dashboard','landing','public','profile','students','faculty-action-center','departments','compare','growth','quality','data-issues','weekly-contest','reports','staff-dashboard','student-dashboard','messages'], []);
  
  const ROLE_PERMISSIONS = useMemo<Record<string, string[]>>(() => ({
    // Super admin / admin: full system access
    admin:            ['dashboard','landing','public','profile','students','hod-command-center','faculty-action-center','departments','compare','growth','quality','data-issues','weekly-contest','reports','audit','settings','system-health','ai-control','staff-dashboard','student-dashboard','messages'],
    administrator:    ['dashboard','landing','public','profile','students','hod-command-center','faculty-action-center','departments','compare','growth','quality','data-issues','weekly-contest','reports','audit','settings','system-health','ai-control','staff-dashboard','student-dashboard','messages'],
    super_admin:      ['dashboard','landing','public','profile','students','hod-command-center','faculty-action-center','departments','compare','growth','quality','data-issues','weekly-contest','reports','audit','settings','system-health','ai-control','staff-dashboard','student-dashboard','messages'],
    'super admin':    ['dashboard','landing','public','profile','students','hod-command-center','faculty-action-center','departments','compare','growth','quality','data-issues','weekly-contest','reports','audit','settings','system-health','ai-control','staff-dashboard','student-dashboard','messages'],
    // HOD: command center + all academic tools
    hod:              ['dashboard','landing','public','profile','students','hod-command-center','faculty-action-center','departments','compare','growth','quality','data-issues','weekly-contest','reports'],
    'department hod': ['dashboard','landing','public','profile','students','hod-command-center','faculty-action-center','departments','compare','growth','quality','data-issues','weekly-contest','reports'],
    department_hod:   ['dashboard','landing','public','profile','students','hod-command-center','faculty-action-center','departments','compare','growth','quality','data-issues','weekly-contest','reports'],
    // FACULTY / STAFF MENTOR: full academic & contest tools
    faculty:          ALL_ACADEMIC_TABS,
    'faculty mentor': ALL_ACADEMIC_TABS,
    faculty_mentor:   ALL_ACADEMIC_TABS,
    staff:            ALL_ACADEMIC_TABS,
    'staff mentor':   ALL_ACADEMIC_TABS,
    staff_mentor:     ALL_ACADEMIC_TABS,
    professor:        ALL_ACADEMIC_TABS,
    // Student: minimal access
    student:          ['dashboard','landing','public','profile'],
  }), [ALL_ACADEMIC_TABS]);

  const roleClean = useMemo(() => (user?.role || '').trim().toLowerCase(), [user?.role]);

  const isTabAllowed = useCallback((tab: string): boolean => {
    if (!isAuthenticated) return ['landing', 'public', 'profile'].includes(tab);
    const allowed = ROLE_PERMISSIONS[roleClean] || ALL_ACADEMIC_TABS;
    return allowed.includes(tab);
  }, [isAuthenticated, roleClean, ROLE_PERMISSIONS, ALL_ACADEMIC_TABS]);

  // Legacy compatibility — used by a few other components
  const isTabAuthorized = useCallback((allowedRoles: string[]): boolean => {
    if (!isAuthenticated) return false;
    if (['admin', 'administrator', 'super admin', 'super_admin'].includes(roleClean)) return true;
    return allowedRoles.some(r => r.toLowerCase() === roleClean);
  }, [isAuthenticated, roleClean]);

  const isFacultyRole = useCallback((): boolean => {
    return ['faculty', 'staff', 'professor', 'faculty mentor', 'staff mentor', 'faculty_mentor', 'staff_mentor'].includes(roleClean);
  }, [roleClean]);

  const renderAccessDenied = useCallback((resourceTitle: string) => (
    <Suspense fallback={null}>
      <AccessDeniedPage
        restrictedResource={resourceTitle}
        onGoBack={() => handleTabChange(isFacultyRole() ? 'dashboard' : (isAuthenticated ? 'dashboard' : 'landing'))}
      />
    </Suspense>
  ), [isFacultyRole, isAuthenticated, handleTabChange]);

  // Full-screen login for unauthenticated users
  if (!isAuthenticated) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <LoginPage
          onSuccess={() => {
            // Role-aware redirect after login.
            // IMPORTANT: user state from useAuth() is async — it hasn't updated yet here.
            // Read role directly from localStorage where AuthContext writes it synchronously.
            let localRoleClean = '';
            try {
              const stored = localStorage.getItem('user');
              if (stored) {
                const parsed = JSON.parse(stored);
                localRoleClean = (parsed?.role || '').trim().toLowerCase();
              }
            } catch (_e) {}
            // Fallback to context if localStorage not yet written
            if (!localRoleClean) localRoleClean = (user?.role || '').trim().toLowerCase();

            if (localRoleClean === 'faculty' || localRoleClean === 'staff' || localRoleClean === 'professor') {
              setActiveTab('faculty-action-center');
            } else if (localRoleClean === 'hod') {
              setActiveTab('hod-command-center');
            } else {
              setActiveTab('dashboard');
            }
          }}
        />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-navy-950 text-gray-900 dark:text-gray-100 flex flex-col font-sans transition-colors duration-200">
      
      {/* COMMAND PALETTE */}
      <CommandPalette 
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onNavigate={(tab) => handleTabChange(tab)}
      />

      {/* Top Navbar */}
      <Navbar
        currentSessionStatus={summaryData?.sync?.is_running ? "RUNNING" : (summaryData?.session?.current_session?.status || "UPCOMING")}
        onOpenLogin={() => setShowLoginModal(true)}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      />

      <div className="flex-1 w-full pt-2.5 sm:pt-6 pb-4 sm:pb-6 px-3 sm:px-5 lg:px-7 2xl:px-8 max-w-full mx-auto relative">
        
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

              {activeTab === 'integrity-monitor' && (
                isTabAllowed('integrity-monitor')
                  ? <ContestIntegrityMonitor />
                  : renderAccessDenied('Contest Integrity Monitor')
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

              {activeTab === 'messages' && (
                isTabAllowed('messages')
                  ? <MessagesPage />
                  : renderAccessDenied('Messages')
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
        <Suspense fallback={null}>
          <LoginPage
            onClose={() => setShowLoginModal(false)}
            onSuccess={() => { setShowLoginModal(false); setActiveTab('dashboard'); }}
          />
        </Suspense>
      )}


      {/* Import Modal — only mount when open to avoid bundle weight on initial render */}
      {showImportModal && (
        <Suspense fallback={null}>
          <ImportModal
            isOpen={showImportModal}
            onClose={() => setShowImportModal(false)}
            onSuccess={() => { 
              localStorage.removeItem('nec_leetcode_students_cache');
              fetchSummary(); 
              setActiveTab('students');
              // No reload required, LiveEventRouter handles live cache updates
            }}
          />
        </Suspense>
      )}

      {/* Automated Alert Center Modal — only mount when open */}
      {showAlertCenterModal && (
        <Suspense fallback={null}>
          <AlertCenterModal
            isOpen={showAlertCenterModal}
            onClose={() => setShowAlertCenterModal(false)}
            onNavigate={handleTabChange}
          />
        </Suspense>
      )}

      {/* Floating Global NEC Unified AI Widget */}
      <Suspense fallback={null}>
        <AIAssistantWidget onNavigateTab={handleTabChange} />
      </Suspense>

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
            <Suspense fallback={null}>
              <StudentProfilePage
                student={selectedStudent}
                onBack={() => setSelectedStudent(null)}
              />
            </Suspense>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
