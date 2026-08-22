import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import { NotificationCenter } from './components/NotificationCenter'
import './index.css'

// ⚡ Immediate Proactive Background Warmup for Render Cloud Server
try {
  const isLocal = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const backendBase = isLocal 
    ? 'http://127.0.0.1:8000/api'
    : (import.meta.env.VITE_API_URL || 'https://leetcodeurl-s-1.onrender.com/api');
  const cleanUrl = backendBase.replace(/\/+$/, '');
  const healthUrl = cleanUrl.endsWith('/api') ? `${cleanUrl}/health` : `${cleanUrl}/api/health`;

  // Non-blocking pre-warm fetch
  fetch(healthUrl, { method: 'GET', keepalive: true }).catch(() => null);

  // Keep-alive ping every 3.5 minutes while tab is active to eliminate Render idle cold-starts
  if (typeof window !== 'undefined') {
    setInterval(() => {
      fetch(healthUrl, { method: 'GET', keepalive: true }).catch(() => null);
    }, 210000);
  }
} catch (_warmupErr) {
  // Silent fail
}

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
