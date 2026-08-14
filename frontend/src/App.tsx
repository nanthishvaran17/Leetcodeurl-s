import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { DepartmentDashboard } from './pages/DepartmentDashboard';
import { StudentMasterPage } from './pages/StudentMasterPage';
import { StudentProfilePage } from './pages/StudentProfilePage';
import { ComparePage } from './pages/ComparePage';
import { DataQualityPage } from './pages/DataQualityPage';
import { ReportsPage } from './pages/ReportsPage';
import { PublicLeaderboardPage } from './pages/PublicLeaderboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { WeeklyContestPage } from './pages/WeeklyContestPage';
import { StudentDashboardView } from './pages/StudentDashboardView';
import { StaffDashboardView } from './pages/StaffDashboardView';
import { GrowthIntelligencePage } from './pages/GrowthIntelligencePage';
import { SystemHealthPage } from './pages/SystemHealthPage';
import { ImportModal } from './components/ImportModal';
import { AccessRestrictedView } from './components/AccessRestrictedView';
import { AIAssistantWidget } from './components/AIAssistantWidget';
import { StudentData } from './components/LeaderboardTable';
import api from './services/api';

import { useAuth } from './context/AuthContext';

export const App: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('landing');
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [summaryData, setSummaryData] = useState<any>(null);

  useEffect(() => {
    fetchSummary();
    triggerCloudSync();
  }, []);


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
      setSummaryData(res.data);
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

  const handleTabChange = (tab: string) => {
    if (!isAuthenticated && tab !== 'landing' && tab !== 'public') {
      setShowLoginModal(true);
      return;
    }
    setActiveTab(tab);
  };

  const handleSelectStudent = (student: StudentData) => {
    setSelectedStudent(student);
    handleTabChange('profile');
  };

  // Determine main dashboard component based on role
  const renderDashboardComponent = () => {
    if (user?.role === 'student') {
      return <StudentDashboardView />;
    }
    if (user?.role === 'staff') {
      return <StaffDashboardView />;
    }
    return (
      <DashboardPage
        onSelectStudent={handleSelectStudent}
        onOpenImport={() => setShowImportModal(true)}
        onNavigateTab={(tab) => handleTabChange(tab)}
      />
    );
  };

  const isTabAuthorized = (allowedRoles: string[]) => {
    if (!isAuthenticated) return false;
    const roleClean = (user?.role || '').trim().toLowerCase();
    if (roleClean === 'admin' || roleClean === 'super admin' || roleClean === 'super_admin') return true;
    return allowedRoles.some(r => r.toLowerCase() === roleClean);
  };

  const renderAccessRestricted = (resourceTitle: string) => (
    <AccessRestrictedView
      resourceName={resourceTitle}
      onGoBack={() => handleTabChange('dashboard')}
      onOpenLogin={() => setShowLoginModal(true)}
    />
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-navy-950 text-gray-900 dark:text-gray-100 flex flex-col font-sans transition-colors duration-200">
      
      {/* Top Navbar */}
      <Navbar
        currentSessionStatus={summaryData?.current_session?.status || "UPCOMING"}
        onOpenLogin={() => setShowLoginModal(true)}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
      />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex gap-6">
        
        {/* Left Sidebar (Only visible for authenticated users when not on landing page) */}
        {isAuthenticated && activeTab !== 'landing' && (
          <Sidebar activeTab={activeTab} setActiveTab={handleTabChange} />
        )}

        {/* Main Content View Container */}
        <main key={activeTab} className="flex-1 w-full overflow-hidden animate-fadeIn">

          
          {activeTab === 'landing' && (
            <LandingPage
              summaryData={summaryData}
              onViewDashboard={() => handleTabChange('dashboard')}
              onOpenLogin={() => setShowLoginModal(true)}
              onSelectStudent={handleSelectStudent}
            />
          )}

          {activeTab === 'dashboard' && renderDashboardComponent()}

          {activeTab === 'growth' && <GrowthIntelligencePage />}

          {activeTab === 'student-dashboard' && <StudentDashboardView />}

          {activeTab === 'staff-dashboard' && <StaffDashboardView />}

          {activeTab === 'departments' && (
            isTabAuthorized(['admin', 'super admin', 'hod', 'faculty', 'staff', 'professor'])
              ? <DepartmentDashboard onSelectStudent={handleSelectStudent} />
              : renderAccessRestricted('Department Analytics')
          )}

          {activeTab === 'weekly-contest' && (
            isTabAuthorized(['admin', 'super admin', 'hod', 'faculty', 'staff', 'professor'])
              ? <WeeklyContestPage />
              : renderAccessRestricted('Weekly Contest Tracker')
          )}

          {activeTab === 'students' && (
            isTabAuthorized(['admin', 'super admin', 'hod', 'faculty', 'staff', 'professor'])
              ? <StudentMasterPage onSelectStudent={handleSelectStudent} onOpenImport={() => setShowImportModal(true)} />
              : renderAccessRestricted('Student Leaderboard')
          )}

          {activeTab === 'profile' && selectedStudent && (
            <StudentProfilePage
              student={selectedStudent}
              onBack={() => setActiveTab('dashboard')}
            />
          )}

          {activeTab === 'compare' && (
            isTabAuthorized(['admin', 'super admin', 'hod', 'faculty', 'staff', 'professor'])
              ? <ComparePage />
              : renderAccessRestricted('Student Comparison')
          )}

          {activeTab === 'quality' && (
            isTabAuthorized(['admin', 'super admin', 'hod', 'faculty', 'staff', 'professor'])
              ? <DataQualityPage />
              : renderAccessRestricted('Data Quality Board')
          )}

          {activeTab === 'system-health' && (
            isTabAuthorized(['admin', 'super admin'])
              ? <SystemHealthPage onNavigateTab={setActiveTab} />
              : renderAccessRestricted('System Operations')
          )}

          {activeTab === 'reports' && (
            isTabAuthorized(['admin', 'super admin', 'hod', 'faculty', 'staff', 'professor'])
              ? <ReportsPage />
              : renderAccessRestricted('Reports & Exports')
          )}

          {activeTab === 'public' && (
            <PublicLeaderboardPage />
          )}

          {activeTab === 'settings' && (
            isTabAuthorized(['admin', 'super admin'])
              ? <SettingsPage />
              : renderAccessRestricted('Admin Settings')
          )}

          {activeTab === 'audit' && (
            isTabAuthorized(['admin', 'super admin'])
              ? <AuditLogPage />
              : renderAccessRestricted('Audit Logs')
          )}

        </main>

      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowLoginModal(false);
            }
          }}
        >
          <div className="w-full max-w-md my-auto">
            <LoginPage
              onClose={() => setShowLoginModal(false)}
              onSuccess={() => { setShowLoginModal(false); setActiveTab('dashboard'); }}
            />
          </div>
        </div>
      )}


      {/* Import Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => { fetchSummary(); setActiveTab('students'); }}
      />

      {/* Floating Institutional AI Assistant */}
      <AIAssistantWidget />

    </div>
  );
};
