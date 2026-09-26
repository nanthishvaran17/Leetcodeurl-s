import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import million from 'million/compiler'
import path from 'path'


export default defineConfig({
  plugins: [
    million.vite({ auto: { rsc: true, skip: ['usePortal', 'createPortal', 'GlobalFilter', 'StudentProfilePage', 'StudentEditOverlay', 'StudentAuditModal', 'StatusNotificationModal', 'ConfirmDeleteModal', 'EmailDeliveryTab', 'ChatWindow', 'MessagesPage', 'ConversationList', 'RecipientSelector'] } }),
    react()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, res) => {
            if (['ECONNRESET', 'ECONNABORTED', 'EPIPE'].includes((err as any)?.code)) return;
            if (res && 'writeHead' in res && !res.headersSent) {
              try {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Backend service unavailable or starting up', detail: err.message }));
              } catch {}
            }
          });
        },
      },
      '/ws': {
        target: process.env.VITE_API_URL || 'http://127.0.0.1:8000',
        ws: true,
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            // Silently absorb transient disconnects / socket resets
          });
          proxy.on('proxyReqWs', (proxyReq, _req, socket) => {
            if (proxyReq) {
              proxyReq.on('error', () => {});
            }
            if (socket) {
              socket.on('error', () => {});
            }
          });
        },
      },
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 600,
    modulePreload: {
      polyfill: false,
      resolveDependencies: () => [],
    },
    // Disable sourcemaps in production for smaller output & faster builds
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // ── Vendor splits ──────────────────────────────────────────────────
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-framer';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') || id.includes('node_modules/victory-')) {
            return 'vendor-charts';
          }
          if (id.includes('node_modules/emoji-picker-react')) {
            return 'vendor-emoji-picker';
          }
          if (id.includes('node_modules/firebase/firestore')) {
            return 'vendor-firebase-firestore';
          }
          if (id.includes('node_modules/firebase/')) {
            return 'vendor-firebase';
          }
          if (id.includes('node_modules/axios')) {
            return 'vendor-network';
          }
          if (id.includes('node_modules/@tanstack/react-query')) {
            return 'vendor-query';
          }
          if (id.includes('node_modules/clsx') || id.includes('node_modules/tailwind-merge')) {
            return 'vendor-ui-utils';
          }
          if (id.includes('node_modules/@capacitor')) {
            return 'vendor-capacitor';
          }
          // ── App-level splits ───────────────────────────────────────────────
          // Context providers and shared custom hooks (bundled together to avoid circular chunking)
          if (id.includes('/src/context/') || id.includes('/src/hooks/')) {
            return 'app-state';
          }
          // Shared services, API layer, and stores
          if (id.includes('/src/services/') || id.includes('/src/lib/') || id.includes('/src/stores/')) {
            return 'app-services';
          }
          // Large static roster dataset — isolated so initial bundle doesn't load 1MB JSON
          if (id.includes('/src/data/canonicalRosterData')) {
            return 'canonical-roster-data';
          }
          // Shared static data / templates
          if (id.includes('/src/data/')) {
            return 'app-data';
          }
          // Shared utility functions & types
          if (id.includes('/src/utils/') || id.includes('/src/types/')) {
            return 'app-utils';
          }
        },
      },
    },
    // Use esbuild for ultra-fast and reliable minification
    minify: 'esbuild',
  },
  esbuild: {
    drop: ['debugger'],
    pure: ['console.debug', 'console.log', 'console.warn', 'console.info'],
    legalComments: 'none',
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'framer-motion',
      'lucide-react',
      'axios',
      'clsx',
      'tailwind-merge',
      'recharts',
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'firebase/storage',
      '@tanstack/react-query',
    ],
  },
})
