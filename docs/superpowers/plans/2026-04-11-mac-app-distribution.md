# Mac App Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package Notebook LM as a downloadable macOS `.app` with the Python backend frozen into a standalone binary, distributed via GitHub Releases with auto-update support.

**Architecture:** PyInstaller freezes the FastAPI backend (including sentence-transformers model) into a single arm64 binary. electron-builder packages the Electron app + frozen backend into a `.dmg`. Auto-updates check GitHub Releases on launch, with a manual "Download from GitHub" fallback until code signing is added.

**Tech Stack:** PyInstaller, electron-builder, electron-updater, GitHub Actions (macos-14 runner)

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `backend/launcher.py` | PyInstaller entry point — starts uvicorn with create_app() |
| `backend/notebooklm.spec` | PyInstaller spec — hidden imports, bundled model, excludes |
| `scripts/build_backend.sh` | Shell script to freeze backend via PyInstaller |
| `apps/desktop/electron/updater.cjs` | Auto-update check, notification, download/redirect |
| `apps/desktop/electron/menu.cjs` | macOS application menu bar |
| `.github/workflows/release.yml` | GitHub Actions release workflow for tagged versions |

### Modified Files

| File | Changes |
|------|---------|
| `backend/pyproject.toml` | Add `pyinstaller` to dev dependencies |
| `apps/desktop/package.json` | electron-builder config, electron-updater dep, new scripts |
| `apps/desktop/electron/main.cjs` | Production backend spawning, health check, port fallback, graceful shutdown, menu/updater integration |
| `apps/desktop/electron/preload.cjs` | Expose `backendUrl` IPC channel |
| `apps/desktop/src/api.ts` | Dynamic backend URL from IPC bridge |

---

## Task 1: Backend Launcher Script

**Files:**
- Create: `backend/launcher.py`

- [ ] **Step 1: Create the launcher script**

```python
# backend/launcher.py
"""PyInstaller entry point for the Notebook LM backend.

Starts uvicorn with the FastAPI app. Accepts an optional --port argument.
"""
import sys
import uvicorn

from notebooklm_backend.app import create_app


def main() -> None:
    port = 8000
    for i, arg in enumerate(sys.argv[1:], 1):
        if arg == "--port" and i < len(sys.argv) - 1:
            port = int(sys.argv[i + 1])
            break

    app = create_app()
    uvicorn.run(app, host="127.0.0.1", port=port)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify it runs**

Run:
```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm/backend
uv run python launcher.py --port 8001 &
sleep 3
curl http://127.0.0.1:8001/api/healthz
kill %1
```

Expected: `{"status":"ok","detail":"..."}` response from the health endpoint.

- [ ] **Step 3: Commit**

```bash
git add backend/launcher.py
git commit -m "feat: add PyInstaller launcher entry point for backend"
```

---

## Task 2: Add PyInstaller to Backend Dev Dependencies

**Files:**
- Modify: `backend/pyproject.toml` (lines 37-41, the `[project.optional-dependencies] dev` section)

- [ ] **Step 1: Add pyinstaller to dev dependencies**

In `backend/pyproject.toml`, add `"pyinstaller>=6.0,<7.0"` to the `dev` optional dependencies list:

```toml
[project.optional-dependencies]
dev = [
  "ruff>=0.9.1,<0.10",
  "pytest>=8.3,<9.0",
  "pytest-asyncio>=0.24,<0.25",
  "pyinstaller>=6.0,<7.0",
]
```

- [ ] **Step 2: Install and verify**

Run:
```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm/backend
uv pip install -e ".[dev]"
uv run pyinstaller --version
```

Expected: PyInstaller version 6.x printed.

- [ ] **Step 3: Commit**

```bash
git add backend/pyproject.toml backend/uv.lock
git commit -m "feat: add pyinstaller to backend dev dependencies"
```

---

## Task 3: PyInstaller Spec File

**Files:**
- Create: `backend/notebooklm.spec`

- [ ] **Step 1: Create the spec file**

```python
# backend/notebooklm.spec
# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for the Notebook LM backend.

Build with:  pyinstaller notebooklm.spec --clean --noconfirm
Output:      dist/notebooklm-backend  (single binary, arm64)
"""
import os
import sys
from pathlib import Path

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

# Collect data files for packages that bundle non-Python assets
sentence_transformers_datas = collect_data_files("sentence_transformers")
tokenizers_datas = collect_data_files("tokenizers")
chromadb_datas = collect_data_files("chromadb")
pydantic_datas = collect_data_files("pydantic")

# Collect all submodules for packages with dynamic imports
hidden_imports = (
    collect_submodules("chromadb")
    + collect_submodules("sentence_transformers")
    + collect_submodules("tokenizers")
    + collect_submodules("uvicorn")
    + collect_submodules("langchain_text_splitters")
    + collect_submodules("llama_index.core")
    + collect_submodules("llama_index.vector_stores.chroma")
    + collect_submodules("llama_index.llms.ollama")
    + [
        "tiktoken_ext",
        "tiktoken_ext.openai_public",
        "numpy",
        "scipy",
        "pypdf",
        "docx",
        "pptx",
        "httpx",
        "orjson",
        "psutil",
        "multipart",
        "starlette.middleware.cors",
    ]
)

# Bundled embedding model path — download before building if not cached
# sentence-transformers will have it in its cache; PyInstaller collects it via data_files

a = Analysis(
    ["launcher.py"],
    pathex=["."],
    binaries=[],
    datas=(
        sentence_transformers_datas
        + tokenizers_datas
        + chromadb_datas
        + pydantic_datas
        + [("notebooklm_backend", "notebooklm_backend")]
    ),
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "pytest",
        "pip",
        "setuptools",
        "tkinter",
        "_tkinter",
        "unittest",
        "distutils",
    ],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="notebooklm-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    target_arch="arm64",
)
```

- [ ] **Step 2: Commit**

```bash
git add backend/notebooklm.spec
git commit -m "feat: add PyInstaller spec for backend freezing"
```

---

## Task 4: Backend Build Script

**Files:**
- Create: `scripts/build_backend.sh`

- [ ] **Step 1: Create the build script**

```bash
#!/usr/bin/env bash
# scripts/build_backend.sh
# Freeze the Notebook LM backend into a standalone binary using PyInstaller.
#
# Usage: ./scripts/build_backend.sh
# Output: backend/dist/notebooklm-backend

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "==> Installing backend dependencies..."
cd "$BACKEND_DIR"
uv venv --quiet 2>/dev/null || true
uv pip install -e ".[dev]" --quiet

echo "==> Pre-downloading embedding model (all-MiniLM-L6-v2)..."
uv run python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

echo "==> Freezing backend with PyInstaller..."
uv run pyinstaller notebooklm.spec --clean --noconfirm

BINARY="$BACKEND_DIR/dist/notebooklm-backend"
if [ ! -f "$BINARY" ]; then
    echo "ERROR: Build failed — $BINARY not found"
    exit 1
fi

echo "==> Verifying binary..."
"$BINARY" --port 18999 &
BACKEND_PID=$!
sleep 5

HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18999/api/healthz || echo "000")
kill "$BACKEND_PID" 2>/dev/null || true
wait "$BACKEND_PID" 2>/dev/null || true

if [ "$HEALTH" = "200" ]; then
    echo "==> Build successful: $BINARY"
    ls -lh "$BINARY"
else
    echo "ERROR: Binary health check failed (HTTP $HEALTH)"
    exit 1
fi
```

- [ ] **Step 2: Make it executable**

Run:
```bash
chmod +x /Users/vikranthreddimasu/Desktop/notebook-lm/scripts/build_backend.sh
```

- [ ] **Step 3: Commit**

```bash
git add scripts/build_backend.sh
git commit -m "feat: add backend build script for PyInstaller freezing"
```

---

## Task 5: electron-builder Configuration & New Dependencies

**Files:**
- Modify: `apps/desktop/package.json`

- [ ] **Step 1: Add electron-updater dependency**

Run:
```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm/apps/desktop
npm install electron-updater@^6.3.0
```

- [ ] **Step 2: Update package.json scripts and build config**

Replace the entire `scripts` and `build` sections in `apps/desktop/package.json`:

The `scripts` section (lines 7-15) should become:

```json
  "scripts": {
    "dev": "concurrently -k \"npm:dev:renderer\" \"npm:dev:electron\"",
    "dev:renderer": "vite",
    "dev:electron": "wait-on tcp:5173 && cross-env NODE_ENV=development electron ./electron/main.cjs",
    "build": "npm run build:renderer",
    "build:renderer": "tsc -b && vite build",
    "build:backend": "bash ../../scripts/build_backend.sh",
    "package": "npm run build:renderer && cross-env NODE_ENV=production electron-builder --mac --arm64",
    "dist": "npm run build:backend && npm run package",
    "lint": "eslint .",
    "preview": "vite preview"
  },
```

The `build` section (lines 43-52) should become:

```json
  "build": {
    "appId": "com.notebooklm.desktop",
    "productName": "Notebook LM",
    "files": [
      "dist",
      "electron"
    ],
    "directories": {
      "buildResources": "resources"
    },
    "extraResources": [
      {
        "from": "../../backend/dist/notebooklm-backend",
        "to": "backend/notebooklm-backend"
      }
    ],
    "mac": {
      "category": "public.app-category.productivity",
      "target": [
        {
          "target": "dmg",
          "arch": ["arm64"]
        },
        {
          "target": "zip",
          "arch": ["arm64"]
        }
      ]
    },
    "dmg": {
      "title": "Notebook LM"
    },
    "publish": {
      "provider": "github",
      "owner": "vikranth1000",
      "repo": "notebook-lm"
    }
  }
```

- [ ] **Step 3: Verify the config parses**

Run:
```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm/apps/desktop
npx electron-builder --help
```

Expected: Help output prints without JSON parse errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm
git add apps/desktop/package.json apps/desktop/package-lock.json
git commit -m "feat: configure electron-builder for macOS DMG distribution"
```

---

## Task 6: macOS Application Menu

**Files:**
- Create: `apps/desktop/electron/menu.cjs`

- [ ] **Step 1: Create the menu module**

```javascript
// apps/desktop/electron/menu.cjs
const { app, Menu, shell } = require('electron');

function buildMenu(checkForUpdates) {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              {
                label: 'Check for Updates...',
                click: checkForUpdates,
              },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

module.exports = { buildMenu };
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/electron/menu.cjs
git commit -m "feat: add macOS application menu with Check for Updates"
```

---

## Task 7: Auto-Update Module

**Files:**
- Create: `apps/desktop/electron/updater.cjs`

- [ ] **Step 1: Create the updater module**

```javascript
// apps/desktop/electron/updater.cjs
const { dialog, shell } = require('electron');

let autoUpdater = null;

// electron-updater is only available in packaged builds.
// In dev, we skip auto-update entirely.
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch (_) {
  // Not available in dev — that's fine.
}

function initUpdater(mainWindow) {
  if (!autoUpdater) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `Notebook LM v${info.version} is available.`,
        detail: 'Would you like to download it now?',
        buttons: ['Download from GitHub', 'Later'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          const url = `https://github.com/vikranth1000/notebook-lm/releases/tag/v${info.version}`;
          shell.openExternal(url);
        }
      });
  });

  autoUpdater.on('error', (err) => {
    // Silently ignore update errors — not critical
    console.error('[updater] Error checking for updates:', err.message);
  });
}

function checkForUpdates() {
  if (!autoUpdater) {
    shell.openExternal('https://github.com/vikranth1000/notebook-lm/releases');
    return;
  }
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('[updater] Check failed:', err.message);
    // Fallback: open releases page
    shell.openExternal('https://github.com/vikranth1000/notebook-lm/releases');
  });
}

module.exports = { initUpdater, checkForUpdates };
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/electron/updater.cjs
git commit -m "feat: add auto-update module with GitHub Releases fallback"
```

---

## Task 8: Rewrite Electron Main Process

**Files:**
- Modify: `apps/desktop/electron/main.cjs` (full rewrite of lines 1-103)

- [ ] **Step 1: Rewrite main.cjs**

Replace the entire contents of `apps/desktop/electron/main.cjs` with:

```javascript
// apps/desktop/electron/main.cjs
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
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
  const { Menu } = require('electron');
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
```

- [ ] **Step 2: Verify dev mode still works**

Run:
```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm/apps/desktop
npm run dev
```

Expected: Electron window opens, backend starts on port 8000 (or next free port), app loads normally.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/electron/main.cjs
git commit -m "feat: rewrite main process with production backend spawning, health check, and port fallback"
```

---

## Task 9: Update Preload Script

**Files:**
- Modify: `apps/desktop/electron/preload.cjs` (lines 1-8)

- [ ] **Step 1: Add backendUrl and onBackendReady to the bridge**

Replace the entire contents of `apps/desktop/electron/preload.cjs` with:

```javascript
// apps/desktop/electron/preload.cjs
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('notebookBridge', {
  ping: () => ipcRenderer.invoke('app:ping'),
  choosePath: (options) => ipcRenderer.invoke('dialog:choosePath', options),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  backendUrl: () => ipcRenderer.invoke('app:backendUrl'),
  onBackendReady: (callback) => {
    ipcRenderer.on('app:backendReady', (_, url) => callback(url));
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/electron/preload.cjs
git commit -m "feat: expose backendUrl and onBackendReady in preload bridge"
```

---

## Task 10: Dynamic Backend URL in API Client

**Files:**
- Modify: `apps/desktop/src/api.ts` (line 13, the `API_BASE_URL` constant)

- [ ] **Step 1: Replace hardcoded URL with dynamic resolution**

Replace lines 1-13 of `apps/desktop/src/api.ts` (the imports and `API_BASE_URL` constant) with:

```typescript
import type {
  BackendConfig,
  ChatRequest,
  ChatResponse,
  IngestionResponse,
  DocumentsListResponse,
  ChatStreamEvent,
  MetricsSummary,
  AgentPlanResponse,
  ChatMessage,
} from './types';

const DEFAULT_API_BASE = 'http://127.0.0.1:8000/api';

let resolvedApiBase: string | null = null;

async function getApiBase(): Promise<string> {
  if (resolvedApiBase) return resolvedApiBase;

  // In Electron, get the backend URL from the main process
  if (window.notebookBridge?.backendUrl) {
    try {
      const url = await window.notebookBridge.backendUrl();
      if (url) {
        resolvedApiBase = `${url}/api`;
        return resolvedApiBase;
      }
    } catch (_) {
      // Fall through to default
    }
  }

  // Fallback: env var or default
  resolvedApiBase = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE;
  return resolvedApiBase;
}
```

Then replace the `request` function (lines 15-30) with:

```typescript
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const apiBase = await getApiBase();
  const response = await fetch(`${apiBase}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}
```

Then update `uploadDocument` (the fetch call at line 54) — replace:

```typescript
  const response = await fetch(`${API_BASE_URL}/documents/ingest`, {
```

with:

```typescript
  const apiBase = await getApiBase();
  const response = await fetch(`${apiBase}/documents/ingest`, {
```

Then update `streamChatMessage` (the fetch call at line 83) — replace:

```typescript
  const response = await fetch(`${API_BASE_URL}/chat/stream`, {
```

with:

```typescript
  const apiBase = await getApiBase();
  const response = await fetch(`${apiBase}/chat/stream`, {
```

Then update `getDocumentPreviewUrl` — this function is synchronous and returns a string, so it needs a different approach. Replace the function (lines 71-77) with:

```typescript
export async function getDocumentPreviewUrl(notebookId: string, sourcePath: string): Promise<string> {
  const apiBase = await getApiBase();
  const params = new URLSearchParams({
    notebook_id: notebookId,
    source_path: sourcePath,
  });
  return `${apiBase}/documents/preview?${params.toString()}`;
}
```

Then update `exportConversation` (the fetch call at line 134) — replace:

```typescript
  const response = await fetch(`${API_BASE_URL}/export/conversation`, {
```

with:

```typescript
  const apiBase = await getApiBase();
  const response = await fetch(`${apiBase}/export/conversation`, {
```

Then update `downloadNotebookSummaries` (the fetch call at line 156) — replace:

```typescript
  const response = await fetch(`${API_BASE_URL}/export/notebook/${encodeURIComponent(notebookId)}`);
```

with:

```typescript
  const apiBase = await getApiBase();
  const response = await fetch(`${apiBase}/export/notebook/${encodeURIComponent(notebookId)}`);
```

Then update `transcribeAudio` (the fetch call at line 174) — replace:

```typescript
  const response = await fetch(`${API_BASE_URL}/speech/transcribe`, {
```

with:

```typescript
  const apiBase = await getApiBase();
  const response = await fetch(`${apiBase}/speech/transcribe`, {
```

Then update `speakText` (the fetch call at line 186) — replace:

```typescript
  const response = await fetch(`${API_BASE_URL}/speech/speak`, {
```

with:

```typescript
  const apiBase = await getApiBase();
  const response = await fetch(`${apiBase}/speech/speak`, {
```

- [ ] **Step 2: Add type declaration for the bridge**

Check if there's already a type declaration for `window.notebookBridge`. If not, add to the top of `apps/desktop/src/api.ts` (after the type imports):

```typescript
declare global {
  interface Window {
    notebookBridge?: {
      ping: () => Promise<string>;
      choosePath: (options?: Record<string, unknown>) => Promise<string | null>;
      openExternal: (url: string) => Promise<boolean>;
      backendUrl: () => Promise<string>;
      onBackendReady: (callback: (url: string) => void) => void;
    };
  }
}
```

- [ ] **Step 3: Verify the app still works in dev**

Run:
```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm/apps/desktop
npm run dev
```

Expected: App loads, chat works, documents can be uploaded — all using the dynamically resolved backend URL.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/api.ts
git commit -m "feat: resolve backend URL dynamically from Electron IPC bridge"
```

---

## Task 11: GitHub Actions Release Workflow

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create the release workflow**

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - "v*"

permissions:
  contents: write

jobs:
  build-mac:
    runs-on: macos-14  # Apple Silicon runner
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install uv
        run: pipx install uv

      - name: Install backend dependencies
        working-directory: backend
        run: |
          uv venv
          uv pip install -e ".[dev]"

      - name: Run backend tests
        working-directory: backend
        env:
          PYTHONPATH: .
        run: uv run pytest -q

      - name: Pre-download embedding model
        working-directory: backend
        run: uv run python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

      - name: Freeze backend with PyInstaller
        working-directory: backend
        run: uv run pyinstaller notebooklm.spec --clean --noconfirm

      - name: Verify backend binary exists
        run: ls -lh backend/dist/notebooklm-backend

      - name: Install desktop dependencies
        working-directory: apps/desktop
        run: npm ci

      - name: Build renderer
        working-directory: apps/desktop
        run: npm run build:renderer

      - name: Package Electron app
        working-directory: apps/desktop
        env:
          NODE_ENV: production
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: npx electron-builder --mac --arm64 --publish always

      - name: List output artifacts
        working-directory: apps/desktop
        run: ls -lh dist/
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "feat: add GitHub Actions release workflow for macOS arm64 DMG"
```

---

## Task 12: Test the Full Build Locally

This task verifies the entire pipeline works end-to-end on your machine before relying on CI.

- [ ] **Step 1: Build the backend binary**

Run:
```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm
./scripts/build_backend.sh
```

Expected: Script completes with "Build successful", binary at `backend/dist/notebooklm-backend`.

- [ ] **Step 2: Package the Electron app**

Run:
```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm/apps/desktop
npm run package
```

Expected: `.dmg` file produced in `apps/desktop/dist/` (e.g., `Notebook LM-0.1.0-arm64.dmg`).

- [ ] **Step 3: Test the packaged app**

1. Open the DMG
2. Drag `Notebook LM.app` to a temporary location (e.g., Desktop)
3. Right-click → Open (to bypass Gatekeeper)
4. Verify: backend starts, app loads, chat works

- [ ] **Step 4: Clean up build artifacts**

Run:
```bash
rm -rf /Users/vikranthreddimasu/Desktop/notebook-lm/backend/dist
rm -rf /Users/vikranthreddimasu/Desktop/notebook-lm/backend/build
rm -rf /Users/vikranthreddimasu/Desktop/notebook-lm/apps/desktop/dist/*.dmg
rm -rf /Users/vikranthreddimasu/Desktop/notebook-lm/apps/desktop/dist/*.zip
rm -rf /Users/vikranthreddimasu/Desktop/notebook-lm/apps/desktop/dist/mac-arm64
```

- [ ] **Step 5: Add build artifacts to .gitignore**

Add these lines to the root `.gitignore`:

```
# PyInstaller
backend/dist/
backend/build/

# electron-builder output
apps/desktop/dist/*.dmg
apps/desktop/dist/*.zip
apps/desktop/dist/*.blockmap
apps/desktop/dist/*.yml
apps/desktop/dist/mac-arm64/
```

- [ ] **Step 6: Commit**

```bash
git add .gitignore
git commit -m "chore: add build artifacts to .gitignore"
```
