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

  const distIndexPath = path.join(__dirname, '../dist/index.html');

  if (app.isPackaged) {
    if (require('fs').existsSync(distIndexPath)) {
      win.loadFile(distIndexPath);
    } else {
      win.loadURL('app://./index.html');
    }
  } else {
    win.loadURL('http://localhost:5173');
  }
}

app.whenReady().then(() => {
  // Protocol handler for loading packaged Vite dist files with SPA fallback
  protocol.handle('app', (request) => {
    let filePath = request.url.replace(/^app:\/\/(\.\/)?/, '');
    if (!filePath || filePath === '/' || filePath.startsWith('?')) {
      filePath = 'index.html';
    }
    const cleanPath = filePath.split('?')[0].split('#')[0];
    const targetFile = path.extname(cleanPath) ? cleanPath : 'index.html';
    const resolvedPath = path.join(__dirname, '../dist', targetFile);

    return net.fetch(url.pathToFileURL(resolvedPath).toString());
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
