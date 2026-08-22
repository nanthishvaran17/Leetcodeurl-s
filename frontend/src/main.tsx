import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import { NotificationCenter } from './components/NotificationCenter'
import './index.css'

import { startSafeHeartbeat } from './services/heartbeat'

// ⚡ Safe Cold-Start Mitigation & Health Heartbeat
startSafeHeartbeat();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <App />
          <NotificationCenter />
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
