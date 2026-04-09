# Notebook LM — Full Revamp Design Spec

**Date:** 2026-04-08
**Status:** Approved
**Approach:** Full rewrite — Electron + React (fresh) with existing FastAPI backend

## Vision

A privacy-first, offline-only RAG chat application for researchers and students. Users upload documents (PDF, DOCX, TXT, MD, PPTX, PY) and chat with them using local LLMs via Ollama. All data stays on the user's machine.

**Target users:** Researchers and students with large document collections who need to deeply query and understand their materials.

**Design direction:** Modern minimal — clean, spacious, monochrome. Inspired by Linear, Notion, Arc. Maximum focus, zero distraction.

**Differentiator:** Completely local. No cloud, no accounts, no data leaving the machine.

---

## 1. App Architecture & Layout

### Three-Zone Layout

Replaces the current two-panel (sidebar + chat) design:

1. **Left sidebar (220px, fixed)** — Notebook list with document counts, "New Notebook" button, model status indicator at bottom (model name, parameter count, ready/loading/error state).

2. **Center chat (flex, hero zone)** — Header with notebook name + doc/chunk counts + action buttons (Export, toggle Sources). Message list with streaming responses and inline citation chips. Input area with quick-action suggestions.

3. **Right source panel (260px, collapsible)** — Retrieved source chunks with document name, page/section reference, relevance score (percentage), excerpt preview. Click a citation chip in chat to highlight corresponding source. "Add documents" button at bottom.

### Component Architecture

```
src/
├── design-system/          # Tokens, primitives
│   ├── tokens.css          # CSS variables for colors, spacing, typography
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Badge.tsx
│   ├── Modal.tsx
│   └── Tooltip.tsx
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx        # Three-zone container
│   │   ├── Sidebar.tsx         # Notebook list + model status
│   │   └── SourcePanel.tsx     # Collapsible right panel
│   ├── chat/
│   │   ├── ChatView.tsx        # Message list + input
│   │   ├── MessageBubble.tsx   # Single message (user or assistant)
│   │   ├── CitationChip.tsx    # Inline source reference
│   │   ├── StreamingText.tsx   # Token-by-token render
│   │   └── QuickActions.tsx    # Suggestion chips below input
│   ├── documents/
│   │   ├── DocumentList.tsx    # Docs in current notebook
│   │   ├── DocumentCard.tsx    # Single doc with metadata
│   │   ├── DocumentPreview.tsx # PDF/text viewer modal
│   │   └── DropZone.tsx        # Drag-and-drop upload
│   ├── onboarding/
│   │   ├── SetupWizard.tsx     # Multi-step wizard container
│   │   ├── SystemCheck.tsx     # Ollama/RAM/disk detection
│   │   ├── ModelSelector.tsx   # Model picker with recommendations
│   │   └── FirstNotebook.tsx   # Initial notebook creation
│   └── notebooks/
│       ├── NotebookList.tsx    # Sidebar notebook entries
│       └── NotebookCreate.tsx  # New notebook form
├── hooks/
│   ├── useChat.ts          # Chat state, streaming, history
│   ├── useNotebooks.ts     # CRUD notebooks
│   ├── useDocuments.ts     # Upload, list, preview
│   ├── useOllama.ts        # Ollama status, model management
│   └── useSourcePanel.ts   # Citation tracking, panel state
├── api/
│   └── client.ts           # Typed fetch wrapper for backend
├── store/
│   └── app-store.ts        # Zustand store for global state
└── App.tsx                 # ~30 lines: setup check → wizard or AppShell
```

### Design System — CSS Tokens

No external UI library. Hand-built primitives with CSS variables:

```css
/* Colors */
--color-bg-primary: #09090b;
--color-bg-secondary: #171717;
--color-bg-surface: #1a1a1a;
--color-border: #262626;
--color-text-primary: #fafafa;
--color-text-secondary: #a1a1aa;
--color-text-muted: #525252;
--color-accent: #fafafa;
--color-success: #22c55e;
--color-error: #ef4444;

/* Radius */
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 14px;

/* Spacing (4px base) */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;

/* Typography */
--font-sans: 'Inter', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', monospace;
--text-xs: 11px;
--text-sm: 13px;
--text-base: 14px;
--text-lg: 16px;
```

---

## 2. Onboarding & Setup Wizard

### Flow

```
Launch → System check → Ollama setup → Model selection → First notebook → Main app
```

### Steps

**Step 1: Welcome**
- Minimal centered screen
- "Notebook LM — Your documents, your machine, your privacy."
- Single "Get Started" button
- No account creation, no sign-up

**Step 2: System Check**
- Auto-detect on entry (no user action needed):
  - Ollama installed? (check `ollama --version` or HTTP ping to 127.0.0.1:11434)
  - Available RAM (for model recommendation)
  - Available disk space (for model download)
- Display as checklist with green/yellow/red indicators
- Auto-advance if everything passes

**Step 3: Ollama Setup** (skip if already installed)
- "Notebook LM needs Ollama to run AI locally."
- One-click "Install Ollama" button
  - macOS: Download .dmg from ollama.com, open it, guide user through install
  - Windows: Download installer, run it
  - Linux: Run `curl -fsSL https://ollama.com/install.sh | sh` via child_process
- Progress indicator during download/install
- Verify installation after completion
- Fallback: "Install manually" link to ollama.com with instructions

**Step 4: Model Selection**
- Auto-recommend based on available RAM:
  - <=8GB RAM: `phi3:mini` (2.3GB, fast, decent quality)
  - 8-16GB RAM: `qwen2.5:3b` (2.0GB, good balance)
  - 16GB+ RAM: `mistral` (4.1GB, best quality)
- Show 2-3 options as cards: model name, size, speed rating, quality rating
- "Recommended for your system" badge on auto-selected option
- Download progress bar with speed + ETA
- User can change selection later from settings

**Step 5: First Notebook**
- "Create your first notebook"
- Name input (auto-suggest based on first uploaded file)
- Large drag-and-drop zone: "Drop your documents here"
- Accept: PDF, DOCX, PPTX, TXT, MD, PY
- Show ingestion progress per file
- "Skip" option to create empty notebook

**Step 6: Ready**
- Brief success animation
- Transition directly into main app with notebook open
- If documents were added, show them in sidebar with ready status

### Persistence

Store setup completion flag in SQLite (or a local config file). On subsequent launches, skip wizard entirely and go straight to main app. Provide "Re-run setup" option in settings.

---

## 3. Chat Experience

### Message Rendering

**User messages:** Right-aligned, `--color-bg-secondary` background, rounded corners (12px top, 4px bottom-right, 12px bottom-left).

**Assistant messages:** Left-aligned, no background (transparent), `--color-text-secondary` text. Rendered with react-markdown. Code blocks with syntax highlighting and copy button.

**Inline citations:** Rendered as small clickable chips within assistant text: `[paper_v3.pdf p.12]`. Styled as `--color-bg-secondary` background, `--color-text-muted` text, `--radius-sm` corners. On click: highlight corresponding source in right panel + scroll to it. On hover: show tooltip with excerpt preview.

### Streaming

- Typing indicator with model name: "phi3:mini is thinking..."
- Smooth token-by-token rendering with no layout shift (pre-allocate message container)
- "Stop generating" button appears during streaming
- On stream error: show inline error with "Retry" button, preserve user's message

### Source Panel Interaction

When assistant responds with citations:
1. Source panel auto-populates with retrieved chunks
2. Each source card shows: document name, page/section, relevance percentage, text excerpt
3. Sources ordered by relevance (highest first)
4. Left border color-coded by document (consistent color per doc)
5. Click source card to open full document preview at that location

### Quick Actions

Below the input, show 2-3 contextual suggestion chips:
- On empty chat: "Summarize all sources", "List key topics", "Compare documents"
- After a response: Generated follow-up questions based on conversation context (via lightweight LLM call)
- Chips are clickable — clicking sends that message

### Chat History

- Conversations persisted per notebook in SQLite
- Sidebar shows recent chats (under the notebook, or as a sub-list)
- User can resume a previous conversation or start a new one
- "New Chat" button in chat header (or `Cmd+N`)

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+N` | New chat |
| `Cmd+K` | Command palette (search notebooks, docs, actions) |
| `Cmd+/` | Toggle source panel |
| `Cmd+Enter` | Send message |
| `Escape` | Close modal / cancel |
| `Cmd+Shift+E` | Export conversation |

---

## 4. Document Management

### Upload

- **Drag-and-drop anywhere** — Drop files onto the app window at any time. Drop onto a notebook in the sidebar to add directly to that notebook. Visual feedback: dashed border highlight + "Drop to add to [notebook name]".
- **File picker fallback** — "Add documents" button opens native file picker. Multi-select supported.
- **Batch upload** — Multiple files or folder drop. Per-file progress with overall status bar. Background processing — user can chat while documents are indexing.
- **Supported formats:** PDF, DOCX, PPTX, TXT, MD, PY

### Document Cards

Each document in the list shows:
- File type icon (PDF red, DOCX blue, TXT gray, etc.)
- Filename (truncated with tooltip for long names)
- Metadata: page/word count, file size
- Ingestion status indicator
- Date added
- Hover actions: remove, re-index, preview

### Document Status States

- **Uploading** — Progress bar with percentage
- **Processing** — Spinner + stage text ("Extracting text...", "Chunking...", "Creating embeddings...")
- **Ready** — Green dot, document is queryable
- **Failed** — Red dot + error message + "Retry" button

### Document Preview

- PDF: react-pdf viewer with zoom (0.5x-3x), pagination, single/all-page toggle
- Text files: rendered in monospace with line numbers
- DOCX: rendered as HTML (best-effort)
- Search within document (`Cmd+F` in preview)
- Highlight chunks that were cited in the current chat conversation
- Side-by-side mode: preview + chat (for reading while asking questions)

---

## 5. Backend Changes

The existing FastAPI backend and RAG pipeline are preserved. Changes are additive:

### New Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/models/available` | GET | List available Ollama models with size/status |
| `/api/models/pull` | POST | Pull a model with SSE progress events |
| `/api/models/status` | GET | Current loaded model + Ollama health |
| `/api/system/info` | GET | RAM, disk space, OS, Ollama version |
| `/api/chats/{notebook_id}` | GET | List chat conversations for a notebook |
| `/api/chats/{notebook_id}` | POST | Create/save a conversation |
| `/api/chats/{notebook_id}/{chat_id}` | GET | Get full conversation history |
| `/api/suggestions` | POST | Generate follow-up questions from context |

### Modified Endpoints

- **`/api/healthz`** — Expand to report Ollama status, loaded model, available models, system RAM/disk
- **`/api/chat/stream`** — Enhance `meta` events to include structured citation data: `{source_path, page_number, relevance_score, excerpt}` per chunk
- **`/api/config`** — Add `setup_complete` flag, onboarding state

### New Storage

- **`conversations` table** (SQLite) — `id`, `notebook_id`, `title`, `created_at`, `updated_at`
- **`messages` table** (SQLite) — `id`, `conversation_id`, `role`, `content`, `citations_json`, `created_at`
- **`app_config` table** (SQLite) — Key-value store for setup state, preferences

### Startup Validation

On boot, the backend checks:
1. Ollama reachability (HTTP ping to 127.0.0.1:11434)
2. At least one model available
3. Embedding model loadable
4. Data directories exist and are writable

Report status via `/api/config` so the frontend can decide: show wizard or main app.

---

## 6. Error Handling

All error states have explicit UI and recovery actions. No silent fallbacks.

| Scenario | Current Behavior | New Behavior |
|----------|-----------------|--------------|
| Ollama down mid-chat | Backend returns error, shown briefly | Inline error in chat: "Lost connection to Ollama" + "Retry" button. Message preserved. |
| Model not loaded | Silent failure or generic error | Auto-pull if missing, show progress. Inform user: "Loading model, this may take a moment..." |
| Large file upload | No feedback | Progress bar per file, warn if >50MB, graceful timeout handling |
| RAG finds no results | Falls back to un-grounded chat silently | Explicit message: "I couldn't find relevant information in your documents. Try rephrasing or adding more sources." No silent fallback. |
| Empty notebook chat | Works but no context | Guide state: "Add your first document to start chatting" with prominent drop zone |
| Ingestion failure | Status shown but no action | Red status with error details + "Retry" button + "Remove" option |
| Disk space low | Not checked | Warning banner when <1GB remaining. Block model downloads if insufficient. |

---

## 7. State Management

**Zustand** for lightweight global state (no Redux overhead):

```typescript
interface AppState {
  // Setup
  setupComplete: boolean;
  ollamaStatus: 'checking' | 'ready' | 'missing' | 'error';
  currentModel: ModelInfo | null;

  // Notebooks
  notebooks: Notebook[];
  activeNotebookId: string | null;

  // Chat
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  isStreaming: boolean;

  // Documents
  documents: Document[];
  uploadQueue: UploadJob[];

  // UI
  sourcePanelOpen: boolean;
  activeSources: SourceChunk[];
  commandPaletteOpen: boolean;
}
```

### Data Flow

1. App launches → check `/api/config` for `setup_complete`
2. If false → render `SetupWizard`
3. If true → render `AppShell`, load notebooks from `/api/notebooks/`
4. User selects notebook → load documents + conversations
5. User sends message → `useChat` hook calls `/api/chat/stream`, parses SSE events
6. On `meta` event → populate source panel with citation data
7. On `token` events → append to streaming message
8. On `done` event → finalize message, generate follow-up suggestions

---

## 8. Electron Main Process

### Responsibilities

- **Ollama lifecycle:** Detect installation, check if running, optionally start/stop the Ollama process
- **Backend lifecycle:** Spawn uvicorn process on app start, kill on app quit
- **Model management:** Proxy model pull requests with progress reporting
- **File system access:** Native file picker dialogs, drag-and-drop path resolution
- **System info:** RAM, disk, OS detection via Node.js `os` module
- **Window management:** Single window, remember size/position, native title bar (macOS) or frameless with custom controls (Windows/Linux)

### IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `system:info` | main→renderer | RAM, disk, OS info |
| `ollama:status` | main→renderer | Installation/running status |
| `ollama:install` | renderer→main | Trigger Ollama installation |
| `model:pull` | renderer→main | Start model download |
| `model:progress` | main→renderer | Download progress events |
| `dialog:open-files` | renderer→main | Native file picker |
| `app:ready` | main→renderer | Backend is up and healthy |

---

## 9. Scope Boundaries

### In scope (this spec)

- Full frontend rewrite with design system
- Setup wizard with Ollama auto-detection and model installation
- Three-zone layout (sidebar / chat / sources)
- Rich citation experience with source panel
- Chat history persistence
- Document management with drag-drop and status tracking
- Keyboard shortcuts and command palette
- Backend additions (model management, chat persistence, suggestions)
- Error handling with recovery actions

### Out of scope

- Cloud LLM support (Claude, GPT, etc.)
- User accounts or authentication
- Multi-user / collaboration features
- Mobile app
- Auto-updates for the Electron app
- Plugin system
- Custom embedding models (keep all-MiniLM-L6-v2)
- Changes to the core RAG pipeline logic (two-stage retrieval, chunking strategy)
- Speech-to-text / text-to-speech (keep as optional, no changes)
- Agent planning feature (keep as-is, no changes)
