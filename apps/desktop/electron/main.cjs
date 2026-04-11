// apps/desktop/electron/main.cjs
const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { buildMenu } = require('./menu.cjs');
const { initUpdater, checkForUpdates } = require('./updater.cjs');

const isDev = process.env.NODE_ENV === 'development';
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

let backendProcess = null;
let backendPort = 8000;
let backendUrl = 'http://127.0.0.1:8000';

// --- Port availability check ---

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function findFreePort(startPort) {
  for (let port = startPort; port < startPort + 4; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port found in range ${startPort}-${startPort + 3}`);
}

// --- Health check polling ---

function waitForBackend(port, timeoutMs = 30000) {
  const url = `http://127.0.0.1:${port}/api/healthz`;
  const interval = 500;
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    function poll() {
      if (Date.now() > deadline) {
        reject(new Error(`Backend did not become healthy within ${timeoutMs}ms`));
        return;
      }
      fetch(url)
        .then((res) => {
          if (res.ok) resolve();
          else setTimeout(poll, interval);
        })
        .catch(() => setTimeout(poll, interval));
    }
    poll();
  });
}

// --- Backend lifecycle ---

function getBackendBinaryPath() {
  return path.join(process.resourcesPath, 'backend', 'notebooklm-backend');
}

async function startBackend() {
  if (backendProcess) return;

  backendPort = await findFreePort(8000);
  backendUrl = `http://127.0.0.1:${backendPort}`;

  if (isDev) {
    // In dev, use uv to run from source
    const python = process.env.NOTEBOOKLM_PYTHON || 'uv';
    const useUv = python === 'uv';
    const cwd = path.join(__dirname, '..', '..', '..', 'backend');

    if (useUv) {
      backendProcess = spawn('uv', [
        'run', 'uvicorn', 'notebooklm_backend.app:create_app',
        '--factory', '--host', '127.0.0.1', '--port', String(backendPort),
      ], { cwd, stdio: 'inherit' });
    } else {
      backendProcess = spawn(python, [
        '-m', 'uvicorn', 'notebooklm_backend.app:create_app',
        '--factory', '--host', '127.0.0.1', '--port', String(backendPort),
      ], { cwd, stdio: 'inherit' });
    }
  } else {
    // In production, spawn the frozen binary
    const binaryPath = getBackendBinaryPath();
    backendProcess = spawn(binaryPath, ['--port', String(backendPort)], {
      stdio: 'inherit',
    });
  }

  backendProcess.on('exit', (code) => {
    console.log(`[backend] exited with code ${code}`);
    backendProcess = null;
  });

  await waitForBackend(backendPort);
  console.log(`[backend] healthy on port ${backendPort}`);
}

function stopBackend() {
  if (!backendProcess) return Promise.resolve();

  return new Promise((resolve) => {
    const pid = backendProcess.pid;
    const killTimer = setTimeout(() => {
      try { process.kill(pid, 'SIGKILL'); } catch (_) {}
      resolve();
    }, 5000);

    backendProcess.once('exit', () => {
      clearTimeout(killTimer);
      resolve();
    });

    try { backendProcess.kill('SIGTERM'); } catch (_) {}
  });
}

// --- Window ---

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  return mainWindow;
}

// --- IPC handlers ---

ipcMain.handle('app:ping', async () => 'offline-notebooklm-ready');

ipcMain.handle('dialog:choosePath', async (_, options = {}) => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'openFile'],
    ...options,
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('app:openExternal', async (_, url) => {
  if (!url) return false;
  await shell.openExternal(url);
  return true;
});

ipcMain.handle('app:backendUrl', () => backendUrl);

// --- App lifecycle ---

app.whenReady().then(async () => {
  const menu = buildMenu(checkForUpdates);
  Menu.setApplicationMenu(menu);

  try {
    await startBackend();
  } catch (err) {
    console.error('[backend] Failed to start:', err.message);
  }

  const mainWindow = createMainWindow();

  // Send backend-ready signal once window is loaded
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.send('app:backendReady', backendUrl);
  });

  // Init auto-updater (no-op in dev)
  initUpdater(mainWindow);

  // Check for updates after a short delay to not block startup
  setTimeout(() => checkForUpdates(), 5000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  await stopBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async (e) => {
  if (backendProcess) {
    e.preventDefault();
    await stopBackend();
    app.quit();
  }
});
