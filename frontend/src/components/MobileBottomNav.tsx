import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  LayoutDashboard, 
  Trophy, 
  GraduationCap, 
  UserCheck, 
  Users,
  UserCircle, 
  FileSpreadsheet 
} from 'lucide-react';
import { prefetchRoute } from '../utils/pagePrefetch';
import { triggerHaptic } from '../utils/haptics';

interface MobileBottomNavProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  onOpenShareCard?: () => void;
  onOpenAiWidget?: () => void;
  isAuthenticated?: boolean;
  userRole?: string;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab = 'dashboard',
  setActiveTab,
  isAuthenticated = true,
  userRole = ''
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [forceHidden, setForceHidden] = useState(false);
  const lastScrollY = useRef(0);
  const scrollIdleTimer = useRef<NodeJS.Timeout | null>(null);

  // 1. Auto-hide on mobile software keyboard open using visualViewport
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkViewport = () => {
      if (window.visualViewport) {
        const heightDiff = window.innerHeight - window.visualViewport.height;
        setIsKeyboardOpen(heightDiff > 140);
      }
    };

    window.visualViewport?.addEventListener('resize', checkViewport);
    window.visualViewport?.addEventListener('scroll', checkViewport);

    const onFocusIn = (e: FocusEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') {
        // Double check after keyboard transition
        setTimeout(() => {
          if (window.visualViewport) {
            const heightDiff = window.innerHeight - window.visualViewport.height;
            if (heightDiff > 140) setIsKeyboardOpen(true);
          } else {
            setIsKeyboardOpen(true);
          }
        }, 300);
      }
    };

    const onFocusOut = () => {
      setTimeout(() => {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          setIsKeyboardOpen(false);
        }
      }, 200);
    };

    window.addEventListener('focusin', onFocusIn);
    window.addEventListener('focusout', onFocusOut);

    return () => {
      window.visualViewport?.removeEventListener('resize', checkViewport);
      window.visualViewport?.removeEventListener('scroll', checkViewport);
      window.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  // 2. Custom event listeners to allow overlays / modals / bulk actions to hide bottom nav
  useEffect(() => {
    const handleHide = () => setForceHidden(true);
    const handleShow = () => setForceHidden(false);

    window.addEventListener('hide_mobile_bottom_nav', handleHide);
    window.addEventListener('show_mobile_bottom_nav', handleShow);

    return () => {
      window.removeEventListener('hide_mobile_bottom_nav', handleHide);
      window.removeEventListener('show_mobile_bottom_nav', handleShow);
    };
  }, []);

  // 3. Hide on fast scroll down, restore on scroll up, idle, or bottom of page
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const windowHeight = window.innerHeight;
          const docHeight = document.documentElement.scrollHeight;
          const isNearBottom = currentScrollY + windowHeight >= docHeight - 70;
          const isNearTop = currentScrollY <= 80;

          if (isNearTop || isNearBottom) {
            setIsVisible(true);
          } else if (currentScrollY > lastScrollY.current + 25 && currentScrollY > 150) {
            setIsVisible(false); // Scrolling down
          } else if (currentScrollY < lastScrollY.current - 10) {
            setIsVisible(true); // Scrolling up
          }
          lastScrollY.current = currentScrollY;
          ticking = false;

          // Always restore visibility when scrolling pauses for 1.2s so user is never stranded
          if (scrollIdleTimer.current) clearTimeout(scrollIdleTimer.current);
          scrollIdleTimer.current = setTimeout(() => {
            setIsVisible(true);
          }, 1200);
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollIdleTimer.current) clearTimeout(scrollIdleTimer.current);
    };
  }, []);

  // Role-aware middle tab
  const role = (userRole || '').trim().toLowerCase();
  const isPlacement = ['placement coordinator', 'placement_coordinator', 'placement officer', 'placement_officer'].includes(role);
  const isHODorAdmin = isPlacement || ['hod', 'principal', 'director', 'admin', 'administrator', 'super admin', 'super_admin'].includes(role);
  const isFaculty = ['faculty', 'staff', 'professor', 'faculty mentor', 'staff mentor', 'faculty_mentor', 'staff_mentor'].includes(role);

  // Mentees cohort for Placement Coordinator, Prestige Graduation Cap for HOD, Faculty Badge for Faculty, Users Roster for Students
  const middleTab = isPlacement
    ? { id: 'staff-dashboard', label: 'Mentees', icon: Users }
    : isHODorAdmin
    ? { id: 'hod-command-center', label: 'HOD Hub', icon: GraduationCap }
    : isFaculty
    ? { id: 'faculty-action-center', label: 'Faculty', icon: UserCheck }
    : { id: 'students', label: 'Roster', icon: Users };

  const tabs = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'weekly-contest', label: 'Contest', icon: Trophy },
    middleTab,
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
    { id: 'account-settings', label: 'Profile', icon: UserCircle }
  ];

  const handleTabClick = (tabId: string) => {
    triggerHaptic('selection');
    if (setActiveTab) {
      setActiveTab(tabId);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  const shouldShow = isVisible && !isKeyboardOpen && !forceHidden;

  return (
    <nav
      aria-label="Mobile Bottom Island Navigation"
      className={`md:hidden fixed bottom-[max(1rem,env(safe-area-inset-bottom,1rem))] inset-x-3.5 z-40 max-w-[390px] mx-auto transition-all duration-300 transform ${
        shouldShow ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'
      }`}
    >
      <div className="relative h-[62px] rounded-full bg-white/95 dark:bg-[#070A14]/95 backdrop-blur-2xl border border-slate-200/90 dark:border-white/[0.12] shadow-[0_12px_36px_rgba(0,0,0,0.18)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.15)] px-2 py-1 flex items-center justify-around ring-1 ring-black/5 dark:ring-white/10">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = 
            activeTab === tab.id ||
            (tab.id === 'dashboard' && (activeTab === 'landing' || activeTab === '')) ||
            (tab.id === 'students' && (activeTab === 'roster' || activeTab === 'leaderboard' || activeTab === 'public')) ||
            (tab.id === 'account-settings' && (activeTab === 'account' || activeTab === 'profile-settings')) ||
            (tab.id === 'hod-command-center' && (activeTab === 'hod' || activeTab === 'command-center')) ||
            (tab.id === 'faculty-action-center' && activeTab === 'faculty') ||
            (tab.id === 'reports' && (activeTab === 'reports' || activeTab === 'export'));

          return (
            <button
              key={tab.id}
              type="button"
              onMouseEnter={() => prefetchRoute(tab.id)}
              onTouchStart={() => prefetchRoute(tab.id)}
              onClick={() => handleTabClick(tab.id)}
              className={`relative flex flex-col items-center justify-center flex-1 h-full py-1 px-1 rounded-full transition-all duration-200 active:scale-90 active-spring select-none cursor-pointer touch-manipulation ${
                isActive 
                  ? 'text-brand-600 dark:text-brand-400 font-black' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <div
                className={`relative px-2.5 py-1 rounded-full transition-all duration-200 flex items-center justify-center ${
                  isActive
                    ? 'bg-brand-500/15 dark:bg-brand-400/20 text-brand-600 dark:text-brand-300 scale-105'
                    : 'bg-transparent'
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? 'stroke-[2.4px] scale-105' : 'stroke-[1.8px]'
                  }`}
                />

                {/* Subtle active glowing bottom dot */}
                {isActive && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-1 rounded-full bg-brand-500 dark:bg-brand-400 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                )}
              </div>

              <span
                className={`text-[9.5px] font-extrabold tracking-tight mt-0.5 leading-none transition-all ${
                  isActive
                    ? 'scale-105 text-brand-700 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
