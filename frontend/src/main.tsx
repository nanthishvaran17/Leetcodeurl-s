import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { ErrorBoundary } from './ErrorBoundary'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import { NotificationCenter } from './components/NotificationCenter'
import { GlobalDataProvider } from './context/GlobalDataContext'
import { FilterProvider } from './context/FilterContext'
import { GlobalNotificationProvider } from './context/GlobalNotificationContext'
import { GlobalWebSocketProvider } from './context/GlobalWebSocketProvider'
import { KeyboardShortcutsProvider } from './context/KeyboardContext'
import { DepartmentProvider } from './contexts/DepartmentContext'
import './index.css'

import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from './lib/react-query'

import { startSafeHeartbeat } from './services/heartbeat'

// Safe Cold-Start Mitigation & Health Heartbeat
// Deferred: run after first render to avoid competing with FCP/LCP resources
if (typeof window !== 'undefined') {
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => startSafeHeartbeat(), { timeout: 3000 });
  } else {
    setTimeout(startSafeHeartbeat, 600);
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <GlobalWebSocketProvider>
            <DepartmentProvider>
              <GlobalDataProvider>
                <FilterProvider>
                  <NotificationProvider>
                    <GlobalNotificationProvider>
                      <KeyboardShortcutsProvider>
                        <ErrorBoundary>
                          <App />
                          <NotificationCenter />
                        </ErrorBoundary>
                      </KeyboardShortcutsProvider>
                    </GlobalNotificationProvider>
                  </NotificationProvider>
                </FilterProvider>
              </GlobalDataProvider>
            </DepartmentProvider>
          </GlobalWebSocketProvider>
        </AuthProvider>
      </ThemeProvider>
      {import.meta.env.DEV && (
        <ReactQueryDevtools initialIsOpen={false} position="bottom" />
      )}
    </QueryClientProvider>
  </React.StrictMode>,
)
