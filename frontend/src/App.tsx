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
import { ImportModal } from './components/ImportModal';
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
        <main className="flex-1 w-full overflow-hidden">
          
          {activeTab === 'landing' && (
            <LandingPage
              summaryData={summaryData}
              onViewDashboard={() => handleTabChange('dashboard')}
              onOpenLogin={() => setShowLoginModal(true)}
              onSelectStudent={handleSelectStudent}
            />
          )}

          {activeTab === 'dashboard' && renderDashboardComponent()}

          {activeTab === 'student-dashboard' && <StudentDashboardView />}

          {activeTab === 'staff-dashboard' && <StaffDashboardView />}

          {activeTab === 'departments' && (
            <DepartmentDashboard onSelectStudent={handleSelectStudent} />
          )}

          {activeTab === 'weekly-contest' && (
            <WeeklyContestPage />
          )}

          {activeTab === 'students' && (
            <StudentMasterPage
              onSelectStudent={handleSelectStudent}
              onOpenImport={() => setShowImportModal(true)}
            />
          )}

          {activeTab === 'profile' && selectedStudent && (
            <StudentProfilePage
              student={selectedStudent}
              onBack={() => setActiveTab('dashboard')}
            />
          )}

          {activeTab === 'leaderboard' && (
            <StudentMasterPage
              onSelectStudent={handleSelectStudent}
              onOpenImport={() => setShowImportModal(true)}
            />
          )}

          {activeTab === 'compare' && (
            <ComparePage />
          )}

          {activeTab === 'quality' && (
            <DataQualityPage />
          )}

          {activeTab === 'reports' && (
            <ReportsPage />
          )}

          {activeTab === 'public' && (
            <PublicLeaderboardPage />
          )}

          {activeTab === 'settings' && (
            <SettingsPage />
          )}

          {activeTab === 'audit' && (
            <AuditLogPage />
          )}

        </main>

      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md">
            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              ✕
            </button>
            <LoginPage onSuccess={() => { setShowLoginModal(false); setActiveTab('dashboard'); }} />
          </div>
        </div>
      )}

      {/* Import Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => { fetchSummary(); setActiveTab('students'); }}
      />

    </div>
  );
};
