import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';


export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'ai' | 'loading';

export interface ToastOptions {
  category?: string;
  title: string;
  description?: string;
  duration?: number; // in ms; default 4500 (0 = infinite / manual close)
  actionLabel?: string;
  onAction?: () => void;
  onClose?: () => void;
}

export interface ToastNotification extends ToastOptions {
  id: string;
  type: NotificationType;
  timestamp: string;
  createdAt: number;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  category?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

interface NotificationContextType {
  toasts: ToastNotification[];
  notify: {
    success: (title: string, description?: string, options?: Omit<ToastOptions, 'title' | 'description'>) => string;
    error: (title: string, description?: string, options?: Omit<ToastOptions, 'title' | 'description'>) => string;
    warning: (title: string, description?: string, options?: Omit<ToastOptions, 'title' | 'description'>) => string;
    info: (title: string, description?: string, options?: Omit<ToastOptions, 'title' | 'description'>) => string;
    ai: (title: string, description?: string, options?: Omit<ToastOptions, 'title' | 'description'>) => string;
    loading: (title: string, description?: string, options?: Omit<ToastOptions, 'title' | 'description'>) => string;
    dismiss: (id: string) => void;
    dismissCategory: (category: string) => void;
    update: (id: string, options: Partial<ToastOptions> & { type?: NotificationType }) => void;
  };
  confirmAction: (options: ConfirmOptions) => Promise<boolean>;
  confirmDialogState: {
    isOpen: boolean;
    options: ConfirmOptions | null;
    resolve: ((value: boolean) => void) | null;
  };
  dismissConfirm: (result: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const DEDUPLICATION_WINDOW_MS = 1500;

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const recentToastsRef = useRef<Map<string, number>>(new Map());

  // Confirm dialog state
  const [confirmDialogState, setConfirmDialogState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions | null;
    resolve: ((value: boolean) => void) | null;
  }>({
    isOpen: false,
    options: null,
    resolve: null,
  });

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => {
      const target = prev.find((t) => t.id === id);
      if (target?.onClose) {
        try {
          target.onClose();
        } catch (err) {
          console.error('[NotificationContext] Toast onClose callback error:', err);
        }
      }
      return prev.filter((t) => t.id !== id);
    });
  }, []);

  const dismissCategory = useCallback((category: string) => {
    if (!category) return;
    setToasts((prev) => {
      prev.forEach((t) => {
        if (t.category === category && t.onClose) {
          try {
            t.onClose();
          } catch (err) {
            console.error('[NotificationContext] Category toast onClose error:', err);
          }
        }
      });
      return prev.filter((t) => t.category !== category);
    });
  }, []);

  const addToast = useCallback((type: NotificationType, title: string, description?: string, options?: Omit<ToastOptions, 'title' | 'description'>): string => {
    const now = Date.now();
    const category = options?.category;
    const dedupKey = `${type}:${category || ''}:${title}:${description || ''}`;
    const lastTime = recentToastsRef.current.get(dedupKey);

    if (lastTime && now - lastTime < DEDUPLICATION_WINDOW_MS) {
      return '';
    }
    recentToastsRef.current.set(dedupKey, now);

    if (recentToastsRef.current.size > 50) {
      for (const [key, time] of recentToastsRef.current.entries()) {
        if (now - time > 5000) recentToastsRef.current.delete(key);
      }
    }

    const id = `nec-toast-${now}-${Math.random().toString(36).substr(2, 6)}`;
    const timestamp = 'Just now';

    const newToast: ToastNotification = {
      id,
      type,
      title,
      description,
      category,
      duration: options?.duration !== undefined ? options.duration : type === 'loading' ? 0 : type === 'error' ? 5000 : 4500,
      actionLabel: options?.actionLabel,
      onAction: options?.onAction,
      onClose: options?.onClose,
      timestamp,
      createdAt: now,
    };

    setToasts((prev) => {
      // If category is specified (e.g. REPORTS), replace existing toast with same category to prevent duplicates
      const base = category ? prev.filter((t) => t.category !== category) : prev;
      const filtered = base.length >= 4 ? base.slice(base.length - 3) : base;
      return [...filtered, newToast];
    });

    return id;
  }, []);

  const updateToast = useCallback((id: string, options: Partial<ToastOptions> & { type?: NotificationType }) => {
    setToasts((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          ...options,
          type: options.type || t.type,
          duration: options.duration !== undefined ? options.duration : 4000,
        };
      })
    );
  }, []);

  const confirmAction = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmDialogState({
        isOpen: true,
        options,
        resolve,
      });
    });
  }, []);

  const dismissConfirm = useCallback((result: boolean) => {
    setConfirmDialogState((prev) => {
      if (prev.resolve) {
        prev.resolve(result);
      }
      return {
        isOpen: false,
        options: null,
        resolve: null,
      };
    });
  }, []);

  // Safeguard fallback for window.alert
  useEffect(() => {
    const originalAlert = window.alert;

    window.alert = (message?: any) => {
      const msgStr = typeof message === 'string' ? message : JSON.stringify(message || '');
      addToast('info', 'Institutional Notice', msgStr, { category: 'SYSTEM NOTICE' });
    };

    return () => {
      window.alert = originalAlert;
    };
  }, [addToast]);

  const notify = useMemo(() => ({
    success: (title: string, description?: string, options?: Omit<ToastOptions, 'title' | 'description'>) =>
      addToast('success', title, description, options),
    error: (title: string, description?: string, options?: Omit<ToastOptions, 'title' | 'description'>) =>
      addToast('error', title, description, options),
    warning: (title: string, description?: string, options?: Omit<ToastOptions, 'title' | 'description'>) =>
      addToast('warning', title, description, options),
    info: (title: string, description?: string, options?: Omit<ToastOptions, 'title' | 'description'>) =>
      addToast('info', title, description, options),
    ai: (title: string, description?: string, options?: Omit<ToastOptions, 'title' | 'description'>) =>
      addToast('ai', title, description, { category: 'NEC UNIFIED AI', ...options }),
    loading: (title: string, description?: string, options?: Omit<ToastOptions, 'title' | 'description'>) =>
      addToast('loading', title, description, options),
    dismiss: dismissToast,
    dismissCategory: dismissCategory,
    update: updateToast,
  }), [addToast, dismissToast, dismissCategory, updateToast]);

  const ctxValue = useMemo(() => ({
    toasts,
    notify,
    confirmAction,
    confirmDialogState,
    dismissConfirm,
  }), [toasts, notify, confirmAction, confirmDialogState, dismissConfirm]);

  return (
    <NotificationContext.Provider value={ctxValue}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
