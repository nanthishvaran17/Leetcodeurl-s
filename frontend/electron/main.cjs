const { app, BrowserWindow, protocol, net, screen } = require('electron');
const path = require('path');
const url = require('url');

// Single Instance Lock: Prevent multiple instances of the app from running simultaneously
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// Register custom scheme privileges before app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

let mainWindow = null;

function createWindow() {
  const iconPath = process.platform === 'win32' && require('fs').existsSync(path.join(__dirname, '../public/desktop-icon.ico'))
    ? path.join(__dirname, '../public/desktop-icon.ico')
    : path.join(__dirname, '../public/desktop-icon.png');

  // Intelligent display scaling adaptation
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  // Adapt to staff screen resolutions (e.g. 1366x768 laptop vs 1080p desktop)
  const isSmallScreen = screenWidth <= 1440 || screenHeight <= 800;
  const targetWidth = isSmallScreen ? screenWidth : Math.min(1500, Math.floor(screenWidth * 0.92));
  const targetHeight = isSmallScreen ? screenHeight : Math.min(950, Math.floor(screenHeight * 0.90));

  mainWindow = new BrowserWindow({
    width: targetWidth,
    height: targetHeight,
    minWidth: 850,
    minHeight: 560,
    title: "Nandha Intelligence - LeetCode Tracker",
    backgroundColor: '#030712', // Seamless dark slate startup, avoids white screen flash
    show: false, // Don't show until DOM is ready to avoid visual glitch
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allows app:// protocol to communicate with remote backend HTTP APIs seamlessly
      zoomFactor: 1.0,
      spellcheck: false
    },
    icon: iconPath
  });

  // Smooth appearance when ready
  mainWindow.once('ready-to-show', () => {
    if (isSmallScreen) {
      mainWindow.maximize();
    }
    mainWindow.show();
  });

  // Enable native desktop zoom shortcuts (Ctrl + Plus, Ctrl + Minus, Ctrl + 0) & Reload (F5, Ctrl+R)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Zoom in: Ctrl + Equal or Ctrl + Plus
    if (input.control && (input.key === '=' || input.key === '+')) {
      const currentZoom = mainWindow.webContents.getZoomFactor();
      if (currentZoom < 1.5) mainWindow.webContents.setZoomFactor(currentZoom + 0.1);
      event.preventDefault();
    }
    // Zoom out: Ctrl + Minus
    if (input.control && (input.key === '-' || input.key === '_')) {
      const currentZoom = mainWindow.webContents.getZoomFactor();
      if (currentZoom > 0.7) mainWindow.webContents.setZoomFactor(currentZoom - 0.1);
      event.preventDefault();
    }
    // Reset Zoom: Ctrl + 0
    if (input.control && input.key === '0') {
      mainWindow.webContents.setZoomFactor(1.0);
      event.preventDefault();
    }
    // Reload: F5 or Ctrl+R
    if (input.key === 'F5' || (input.control && (input.key === 'r' || input.key === 'R'))) {
      mainWindow.webContents.reload();
      event.preventDefault();
    }
    // Toggle Fullscreen: F11
    if (input.key === 'F11') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    }
  });

  // Handle load failure gracefully (e.g. offline/network failure)
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`[Electron] Page failed to load: ${errorCode} - ${errorDescription}`);
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Nandha Intelligence - Offline</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background: #030712;
            color: #f8fafc;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            text-align: center;
          }
          .card {
            background: #0f172a;
            border: 1px solid #1e293b;
            padding: 2.5rem;
            border-radius: 1rem;
            max-width: 460px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
          }
          h2 { margin-top: 0; color: #38bdf8; font-size: 1.5rem; font-weight: 700; }
          p { color: #94a3b8; font-size: 0.95rem; line-height: 1.6; }
          button {
            margin-top: 1.5rem;
            background: #2563eb;
            color: white;
            border: none;
            padding: 0.75rem 1.75rem;
            font-size: 0.95rem;
            font-weight: 600;
            border-radius: 0.5rem;
            cursor: pointer;
            transition: background 0.2s;
          }
          button:hover { background: #1d4ed8; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Nandha Intelligence</h2>
          <p>Unable to connect to the server. Please verify your internet connection and click retry.</p>
          <button onclick="window.location.href='app://./index.html'">Retry Connection</button>
        </div>
      </body>
      </html>
    `)}`);
  });

  if (app.isPackaged) {
    mainWindow.loadURL('app://./index.html');
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  // Protocol handler for loading packaged Vite dist files with SPA fallback and absolute asset support
  protocol.handle('app', (request) => {
    const parsed = new URL(request.url);
    let pathname = decodeURIComponent(parsed.pathname);

    // If root or empty, serve index.html
    if (!pathname || pathname === '/' || pathname === '/index.html') {
      pathname = 'index.html';
    }

    // Strip leading slashes
    pathname = pathname.replace(/^\/+/, '');

    const cleanPath = pathname.split('?')[0].split('#')[0];
    const resolvedPath = path.join(__dirname, '../dist', cleanPath);

    if (require('fs').existsSync(resolvedPath) && !require('fs').statSync(resolvedPath).isDirectory()) {
      return net.fetch(url.pathToFileURL(resolvedPath).toString());
    }

    // Fallback to index.html for SPA client-side routes
    const fallbackPath = path.join(__dirname, '../dist/index.html');
    return net.fetch(url.pathToFileURL(fallbackPath).toString());
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
