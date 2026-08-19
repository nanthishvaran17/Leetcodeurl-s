import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'ai' | 'loading';

export interface ToastOptions {
  category?: string;
  title: string;
  description?: string;
  duration?: number; // in ms; default 4500 (0 = infinite / manual close)
  actionLabel?: string;
  onAction?: () => void;
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
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: NotificationType, title: string, description?: string, options?: Omit<ToastOptions, 'title' | 'description'>): string => {
    const now = Date.now();
    const dedupKey = `${type}:${title}:${description || ''}`;
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
      category: options?.category,
      duration: options?.duration !== undefined ? options.duration : type === 'loading' ? 0 : type === 'error' ? 6500 : 4500,
      actionLabel: options?.actionLabel,
      onAction: options?.onAction,
      timestamp,
      createdAt: now,
    };

    setToasts((prev) => {
      const filtered = prev.length >= 4 ? prev.slice(prev.length - 3) : prev;
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

  const notify = {
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
    update: updateToast,
  };

  return (
    <NotificationContext.Provider
      value={{
        toasts,
        notify,
        confirmAction,
        confirmDialogState,
        dismissConfirm,
      }}
    >
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
