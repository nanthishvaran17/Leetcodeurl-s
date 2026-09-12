import { useState, useEffect, RefObject } from 'react';

interface UseTableKeyboardNavigationProps<T> {
  items: T[];
  onSelectRow?: (item: T) => void;
  tableRef?: RefObject<HTMLElement | null>;
  enabled?: boolean;
}

export function useTableKeyboardNavigation<T>({
  items,
  onSelectRow,
  tableRef,
  enabled = true,
}: UseTableKeyboardNavigationProps<T>) {
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [items]);

  useEffect(() => {
    if (!enabled || items.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      // Do not override if user is typing inside text input
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      // Check if table container or child has focus (or tableRef is active)
      if (tableRef?.current && !tableRef.current.contains(activeEl)) {
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < items.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && selectedIndex < items.length && onSelectRow) {
          e.preventDefault();
          onSelectRow(items[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        setSelectedIndex(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, selectedIndex, onSelectRow, tableRef, enabled]);

  return {
    selectedIndex,
    setSelectedIndex,
  };
}
