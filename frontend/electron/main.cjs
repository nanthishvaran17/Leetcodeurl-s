const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('path');
const url = require('url');

// Register custom scheme privileges before app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

function createWindow() {
  const iconPath = process.platform === 'win32' && require('fs').existsSync(path.join(__dirname, '../public/desktop-icon.ico'))
    ? path.join(__dirname, '../public/desktop-icon.ico')
    : path.join(__dirname, '../public/desktop-icon.png');

  const win = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: "Nandha Intelligence - LeetCode Tracker",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // Allows app:// protocol to communicate with remote backend HTTP APIs seamlessly
    },
    icon: iconPath
  });

  if (app.isPackaged) {
    win.loadURL('app://./index.html');
  } else {
    win.loadURL('http://localhost:5173');
  }
}

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
