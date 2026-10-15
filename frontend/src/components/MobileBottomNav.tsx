import React from 'react';

interface MobileBottomNavProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  onOpenShareCard?: () => void;
  onOpenAiWidget?: () => void;
  isAuthenticated?: boolean;
  userRole?: string;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = () => {
  return null;
};
