import { useEffect } from 'react';

interface UseFilterKeyboardNavigationProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOption?: () => void;
}

export function useFilterKeyboardNavigation({
  isOpen,
  onClose,
  onSelectOption,
}: UseFilterKeyboardNavigationProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (onSelectOption) {
          onSelectOption();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onSelectOption]);
}
