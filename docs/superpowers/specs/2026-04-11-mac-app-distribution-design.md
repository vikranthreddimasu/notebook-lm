# Notebook LM — Mac App Distribution Design Spec

**Date:** 2026-04-11
**Status:** Approved
**Approach:** PyInstaller-frozen backend + electron-builder DMG, distributed via GitHub Releases

---

## Overview

Transform the Electron + FastAPI development setup into a downloadable macOS application that non-technical users can install and run. The Python backend is frozen into a standalone binary via PyInstaller and bundled inside the `.app`. Distribution is via GitHub Releases with auto-update infrastructure wired in from day one.

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Distribution | GitHub Releases (direct download) | Full control, no App Store sandboxing conflicts |
| Backend bundling | PyInstaller (onefile) | Battle-tested, single binary, self-contained |
| Code signing | Skip for now, design for later | Avoids $99/yr Apple Developer cost upfront |
| Auto-updates | electron-updater + GitHub Releases | Table stakes for real apps; manual fallback until signed |
| App name | Notebook LM | — |
| App icon | Placeholder | Replace later with custom icon |
| DMG style | Plain default | — |
| Architecture | Apple Silicon only (arm64) | Keeps build simple and download smaller |

---

## 1. App Bundle Structure

```
Notebook LM.app/
└── Contents/
    ├── Info.plist                    # macOS app metadata
    ├── MacOS/
    │   └── Notebook LM              # Electron main executable
    ├── Resources/
    │   ├── app.asar                  # Electron renderer (React build)
    │   ├── electron/                 # Electron main process files
    │   ├── backend/
    │   │   └── notebooklm-backend   # PyInstaller-frozen backend binary
    │   ├── icon.icns                # Placeholder app icon
    │   └── ...                      # Electron framework resources
    └── Frameworks/
        └── Electron Framework.framework/
```

---

## 2. Build Pipeline

### Build Steps (in order)

1. **Build the React renderer** — `vite build` produces `dist/`
2. **Freeze the Python backend** — PyInstaller compiles `notebooklm_backend` into a single `notebooklm-backend` binary targeting arm64
3. **Package with electron-builder** — Assembles the `.app` bundle with the frozen backend binary included via `extraResources`, then wraps it in a `.dmg`

### npm Scripts

| Script | Action |
|--------|--------|
| `npm run build:backend` | Runs PyInstaller to freeze the backend |
| `npm run build:renderer` | Existing Vite build |
| `npm run package` | Builds renderer + packages Electron app (assumes backend already built) |
| `npm run dist` | Full pipeline: build backend + build renderer + package into DMG |

### electron-builder Configuration

Updated `package.json` build config:
- `appId`: `com.notebooklm.desktop`
- `productName`: `Notebook LM`
- `mac.target`: `dmg` for arm64
- `mac.category`: `public.app-category.productivity`
- `extraResources`: includes the PyInstaller binary from `backend/dist/notebooklm-backend`
- `publish.provider`: `github`
- `publish.owner`: `vikranth1000`
- `publish.repo`: `notebook-lm`
- `dmg`: plain default layout

---

## 3. Backend Freezing

### Launcher Script (`backend/launcher.py`)

PyInstaller entry point that starts uvicorn with the FastAPI app. Accepts an optional `--port` argument (default 8000) so the Electron main process can specify a fallback port.

### PyInstaller Spec (`backend/notebooklm.spec`)

- **Mode:** Onefile — single `notebooklm-backend` binary
- **Target arch:** arm64
- **Hidden imports:** chromadb.api.segment, chromadb.telemetry, sentence_transformers, tokenizers, tiktoken_ext, tiktoken_ext.openai_public, langchain_community, llama_index.core, numpy, scipy, pypdf, docx, pptx, uvicorn.logging, uvicorn.protocols.http
- **Bundled data:** sentence-transformers `all-MiniLM-L6-v2` model (~80MB) — bundled for offline-first promise
- **Excludes:** pytest, pip, setuptools, tkinter
- **Build script:** `scripts/build_backend.sh` — creates venv, installs deps, runs PyInstaller, verifies output

### Size Estimates

| Component | Estimated Size |
|-----------|---------------|
| Python runtime + stdlib | ~30MB |
| sentence-transformers + model | ~100MB |
| ChromaDB + deps | ~40MB |
| numpy/scipy | ~50MB |
| LangChain + LlamaIndex | ~30MB |
| PyPDF, python-docx, python-pptx | ~10MB |
| uvicorn + FastAPI | ~5MB |
| **Backend binary total** | **~265MB** |
| Electron app (renderer + framework) | **~180MB** |
| **DMG total (compressed)** | **~250-350MB** |

---

## 4. Electron Main Process Changes

### Backend Spawning (production)

In production, the main process resolves the backend binary via `process.resourcesPath`:

```
Development:  uv run uvicorn notebooklm_backend.app:create_app --factory ...
Production:   {resourcesPath}/backend/notebooklm-backend [--port NNNN]
```

### Health Check

After spawning, poll `http://127.0.0.1:{port}/health` every 500ms, up to 30 seconds. Signal the renderer via `app:backendReady` IPC when healthy.

### Port Conflict Handling

If port 8000 is in use, try 8001, 8002, 8003 (up to 3 fallbacks). Check port availability *before* spawning the backend. Pass the chosen port as `--port` argument to the binary. Renderer gets the URL via `app:backendUrl` IPC.

### Graceful Shutdown

On `window-all-closed` or `app.quit()`:
1. Send `SIGTERM` to backend process
2. Wait up to 5 seconds for clean exit
3. `SIGKILL` if still running

Ensures ChromaDB and SQLite flush writes cleanly.

### IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `app:ping` | renderer→main | Keep (existing) |
| `dialog:choosePath` | renderer→main | Keep (existing) |
| `app:openExternal` | renderer→main | Keep (existing) |
| `app:backendUrl` | renderer→main | **New** — get backend URL (accounts for port fallback) |
| `app:backendReady` | main→renderer | **New** — signal backend health check passed |

### macOS Behavior

- App stays in dock when all windows closed (existing)
- Re-creates window on `activate` (existing)
- Native title bar

---

## 5. Auto-Updates

### Architecture

Uses `electron-updater` with GitHub Releases as the update server.

### Flow

1. On app launch (after backend ready), check GitHub Releases for newer version
2. If found, show non-intrusive notification bar: "Notebook LM v0.2.0 is available. [Update Now] [Later]"
3. User clicks "Update Now" → download in background → prompt to restart
4. On restart, new version replaces old

### Before Code Signing (current phase)

electron-updater requires signed builds for in-place macOS updates. Until signing is added:
- Auto-update check still runs on launch
- Shows: "Notebook LM v0.2.0 is available. [Download from GitHub]"
- Opens the release page in browser via `shell.openExternal`
- Full auto-update activates once signing keys are added (no code changes needed)

### Configuration

- `autoUpdater.autoDownload = false` (always ask user first)
- `autoUpdater.autoInstallOnAppQuit = true`
- Check frequency: once on launch only

### Application Menu

Standard macOS menu bar:
- **Notebook LM** → About Notebook LM, Check for Updates..., Quit
- **Edit** → Undo, Redo, Cut, Copy, Paste, Select All
- **Window** → Minimize, Close

---

## 6. Data Directory & First Launch

### Data Directory

All user data in `~/NotebookLM/` (unchanged, lives outside app bundle):

```
~/NotebookLM/
├── data/uploads/{notebook_id}/
├── indexes/
├── cache/
├── models/
├── metadata.db
└── config.json
```

Persists across updates and uninstalls. Backend creates directories on first startup.

### First Launch Flow

```
Double-click DMG → Drag to Applications → Launch
    ↓
Electron starts → Spawns backend binary → Polls /health
    ↓
Backend ready → Renderer loads → Checks /api/config for setup_complete
    ↓
setup_complete = false → Setup Wizard (per revamp design spec)
    ↓
Wizard completes → Main app
```

### Gatekeeper Warning (until signed)

GitHub Release page includes instructions:

> **First launch on macOS:**
> 1. Right-click (or Control-click) the app
> 2. Select "Open"
> 3. Click "Open" in the dialog
>
> You only need to do this once.

### Uninstall

1. Drag `Notebook LM.app` to Trash
2. Optionally delete `~/NotebookLM/` to remove all data

No system-level files, launch agents, or kernel extensions.

---

## 7. GitHub Actions Release Workflow

### Workflow (`.github/workflows/release.yml`)

**Trigger:** Push tag matching `v*` (e.g., `v0.1.0`)

**Runner:** `macos-14` (Apple Silicon, arm64 native)

**Steps:**
1. Checkout code
2. Set up Python 3.12 + `uv`
3. Set up Node 20
4. Install backend deps: `uv pip install -e ".[dev]"`
5. Run backend tests: `pytest -q`
6. Freeze backend: `pyinstaller backend/notebooklm.spec --clean --noconfirm`
7. Install frontend deps: `cd apps/desktop && npm ci`
8. Package app: `npm run package` (produces DMG + update artifacts)
9. Create GitHub Release with tag name
10. Upload artifacts: `.dmg`, `.zip`, `latest-mac.yml`

### Release Process

```
1. Bump version in apps/desktop/package.json
2. Commit: "Release v0.2.0"
3. Tag: git tag v0.2.0
4. Push: git push origin main --tags
    ↓
5. GitHub Actions builds on macOS arm64
6. Produces DMG + update artifacts
7. Creates GitHub Release with attached files
    ↓
8. Users see auto-update notification
9. "Download from GitHub" (until signing added)
```

### Versioning

Semantic versioning. `apps/desktop/package.json` version is the single source of truth. DMG filename: `Notebook LM-{version}-arm64.dmg`.

---

## 8. File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `backend/launcher.py` | PyInstaller entry point, starts uvicorn with FastAPI app |
| `backend/notebooklm.spec` | PyInstaller spec with hidden imports, bundled model, excludes |
| `scripts/build_backend.sh` | Shell script to freeze backend via PyInstaller |
| `.github/workflows/release.yml` | GitHub Actions workflow for tagged releases |
| `apps/desktop/electron/updater.cjs` | Auto-update logic (check, notify, download/redirect) |
| `apps/desktop/electron/menu.cjs` | macOS application menu |

### Modified Files

| File | Changes |
|------|---------|
| `apps/desktop/package.json` | Build config (appId, productName, mac target, extraResources, publish), add electron-updater dep, add build:backend and dist scripts |
| `apps/desktop/electron/main.cjs` | Production backend path resolution, health check polling, port fallback, graceful shutdown, new IPC channels, import menu and updater |
| `apps/desktop/electron/preload.cjs` | Expose backendUrl and backendReady IPC channels |
| `apps/desktop/src/api.ts` | Dynamic backend URL from IPC instead of hardcoded localhost:8000 |
| `backend/pyproject.toml` | Add pyinstaller to dev dependencies |

### Unchanged

- All backend source code (`notebooklm_backend/`)
- All React frontend source (`apps/desktop/src/` except `api.ts`)
- Existing CI workflow (`.github/workflows/ci.yml`)
- Docs, samples, existing scripts

---

## 9. Scope Boundaries

### In scope

- PyInstaller backend freezing with bundled embedding model
- electron-builder DMG packaging for arm64
- Electron main process: production backend spawning, health check, port fallback, graceful shutdown
- Auto-update infrastructure (manual fallback until signed)
- macOS application menu
- GitHub Actions release workflow
- Dynamic backend URL in renderer

### Out of scope

- Apple code signing and notarization (designed for, not implemented)
- Intel (x86_64) support
- Windows/Linux builds
- Mac App Store submission
- Custom DMG background or app icon design
- Changes to the FastAPI backend logic
- Changes to the React frontend UI (except api.ts backend URL)
- Homebrew cask distribution
