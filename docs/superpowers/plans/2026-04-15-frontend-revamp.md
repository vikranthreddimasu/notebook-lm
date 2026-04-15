# Frontend Revamp — Core UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the monolithic two-panel UI into a modern three-zone layout (sidebar / chat / source panel) with Zustand state management, notebook switching, rich citation display, drag-and-drop uploads, and a collapsible source panel.

**Architecture:** The 682-line `App.tsx` is decomposed into a component tree: `AppShell` wraps `Sidebar`, `ChatView`, and `SourcePanel`. A Zustand store manages global state (notebooks, messages, documents, sources). Three custom hooks (`useNotebooks`, `useDocuments`, `useChat`) encapsulate domain logic. A CSS custom-property design system provides tokens for colors, spacing, typography, and radius. The existing backend API is reused with one small addition (create-notebook endpoint).

**Tech Stack:** React 19, Zustand, TypeScript, Vite, react-markdown, react-pdf

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `apps/desktop/src/design-system/tokens.css` | CSS custom properties: colors, spacing, typography, radius |
| `apps/desktop/src/store/app-store.ts` | Zustand store: notebooks, messages, documents, sources, UI flags |
| `apps/desktop/src/hooks/useNotebooks.ts` | Load/create/select notebooks via API |
| `apps/desktop/src/hooks/useDocuments.ts` | Upload files, list documents for active notebook |
| `apps/desktop/src/hooks/useChat.ts` | Send messages, handle SSE streaming, manage sources |
| `apps/desktop/src/components/layout/AppShell.tsx` | Three-zone flex container + document preview overlay |
| `apps/desktop/src/components/layout/Sidebar.tsx` | Notebook list, document cards, drop zone, model status |
| `apps/desktop/src/components/layout/SourcePanel.tsx` | Collapsible right panel with retrieved source chunks |
| `apps/desktop/src/components/layout/layout.css` | Styles for AppShell, Sidebar, SourcePanel |
| `apps/desktop/src/components/chat/ChatView.tsx` | Message list + input area + export button |
| `apps/desktop/src/components/chat/MessageBubble.tsx` | Single message with markdown rendering |
| `apps/desktop/src/components/chat/chat.css` | Styles for ChatView, MessageBubble |
| `apps/desktop/src/components/documents/DocumentCard.tsx` | Single document row with type icon, name, chunk count |
| `apps/desktop/src/components/documents/DropZone.tsx` | Drag-and-drop + click-to-upload area |
| `apps/desktop/src/components/documents/documents.css` | Styles for DocumentCard, DropZone |

### Modified Files

| File | Changes |
|------|---------|
| `apps/desktop/src/types.ts` | Add `Notebook` and `SourceChunk` types |
| `apps/desktop/src/api.ts` | Add `listNotebooks()` and `createNotebook()` functions |
| `apps/desktop/src/main.tsx` | Import `tokens.css` |
| `apps/desktop/src/index.css` | Simplify to use token variables, remove redundant rules |
| `apps/desktop/src/App.tsx` | Complete rewrite: bootstrap store, render AppShell or error state |
| `backend/notebooklm_backend/routes/notebooks.py` | Add `POST /api/notebooks/` to create empty notebooks |
| `backend/notebooklm_backend/models/notebook.py` | Add `CreateNotebookRequest` model |

### Removed Files

| File | Reason |
|------|--------|
| `apps/desktop/src/App.css` | Replaced by tokens.css + component CSS files |

---

## Task 1: Install Zustand

**Files:**
- Modify: `apps/desktop/package.json`

- [ ] **Step 1: Install zustand**

Run:
```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm/apps/desktop && npm install zustand
```

Expected: zustand added to `dependencies` in package.json, package-lock.json updated.

- [ ] **Step 2: Verify installation**

Run:
```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm/apps/desktop && node -e "require('zustand'); console.log('OK')"
```

Expected: `OK` printed.

- [ ] **Step 3: Commit**

```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm
git add apps/desktop/package.json apps/desktop/package-lock.json
git commit -m "feat: add zustand for state management"
```

---

## Task 2: Design System Tokens

**Files:**
- Create: `apps/desktop/src/design-system/tokens.css`
- Modify: `apps/desktop/src/main.tsx` (line 3)
- Modify: `apps/desktop/src/index.css` (lines 1-27)

- [ ] **Step 1: Create the tokens file**

```css
/* apps/desktop/src/design-system/tokens.css */

:root {
  /* Colors */
  --color-bg-primary: #09090b;
  --color-bg-secondary: #171717;
  --color-bg-surface: #1a1a1a;
  --color-bg-elevated: #1f1f1f;
  --color-border: #262626;
  --color-border-subtle: rgba(255, 255, 255, 0.08);
  --color-border-hover: rgba(255, 255, 255, 0.15);
  --color-text-primary: #fafafa;
  --color-text-secondary: #a1a1aa;
  --color-text-muted: #525252;
  --color-accent: #6366f1;
  --color-accent-hover: #4f46e5;
  --color-accent-subtle: rgba(99, 102, 241, 0.12);
  --color-success: #22c55e;
  --color-error: #ef4444;
  --color-warning: #fbbf24;

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
  --font-sans: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --text-xs: 11px;
  --text-sm: 13px;
  --text-base: 14px;
  --text-lg: 16px;

  /* Sidebar */
  --sidebar-width: 220px;

  /* Source panel */
  --source-panel-width: 260px;
}

/* Scrollbar */
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
}

*::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

*::-webkit-scrollbar-track {
  background: transparent;
}

*::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
}

*::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.12);
}
```

- [ ] **Step 2: Import tokens in main.tsx**

In `apps/desktop/src/main.tsx`, add the tokens import before `index.css`:

Replace line 3:
```typescript
import './index.css'
```

With:
```typescript
import './design-system/tokens.css'
import './index.css'
```

- [ ] **Step 3: Update index.css to use tokens**

Replace the full contents of `apps/desktop/src/index.css` with:

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  font-family: var(--font-sans);
  font-size: var(--text-base);
  line-height: 1.5;
  color: var(--color-text-primary);
  background-color: var(--color-bg-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

a {
  color: inherit;
}
```

- [ ] **Step 4: Verify tokens load**

Run:
```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm/apps/desktop && npm run build:renderer
```

Expected: Build succeeds with no errors. (Dev server check deferred to final integration.)

- [ ] **Step 5: Commit**

```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm
git add apps/desktop/src/design-system/tokens.css apps/desktop/src/main.tsx apps/desktop/src/index.css
git commit -m "feat: add design system tokens and update base styles"
```

---

## Task 3: Extend TypeScript Types

**Files:**
- Modify: `apps/desktop/src/types.ts` (add after line 75)

- [ ] **Step 1: Add Notebook and SourceChunk types**

Append to the end of `apps/desktop/src/types.ts`:

```typescript

export interface Notebook {
  notebook_id: string;
  title: string;
  description?: string;
  source_count: number;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

export interface SourceChunk {
  source_path: string;
  preview: string;
  distance?: number | null;
  document_name: string;
  relevance_score?: number;
}

export interface CreateNotebookRequest {
  title?: string;
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm
git add apps/desktop/src/types.ts
git commit -m "feat: add Notebook and SourceChunk types"
```

---

## Task 4: Backend — Create Notebook Endpoint

**Files:**
- Modify: `backend/notebooklm_backend/models/notebook.py` (add after line 24)
- Modify: `backend/notebooklm_backend/routes/notebooks.py` (add new endpoint)

- [ ] **Step 1: Add request model**

In `backend/notebooklm_backend/models/notebook.py`, add after the `NotebookIngestionRequest` class (after line 24):

```python

class CreateNotebookRequest(BaseModel):
    title: str = "New Notebook"
```

- [ ] **Step 2: Add POST endpoint to notebooks router**

Replace the full contents of `backend/notebooklm_backend/routes/notebooks.py` with:

```python
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Request

from ..models.notebook import CreateNotebookRequest, IngestionJobStatus, NotebookMetadata
from ..services.notebook_store import NotebookStore

router = APIRouter(prefix="/notebooks", tags=["notebooks"])


@router.get("/", response_model=list[NotebookMetadata])
async def list_notebooks(request: Request) -> list[NotebookMetadata]:
    store: NotebookStore = request.app.state.notebook_store
    return store.list_notebooks()


@router.post("/", response_model=NotebookMetadata)
async def create_notebook(request: Request, body: CreateNotebookRequest) -> NotebookMetadata:
    store: NotebookStore = request.app.state.notebook_store
    notebook_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc)
    notebook = NotebookMetadata(
        notebook_id=notebook_id,
        title=body.title,
        source_count=0,
        chunk_count=0,
        created_at=now,
        updated_at=now,
    )
    return store.upsert_notebook(notebook)


@router.get("/jobs", response_model=list[IngestionJobStatus])
async def list_jobs(request: Request) -> list[IngestionJobStatus]:
    store: NotebookStore = request.app.state.notebook_store
    return store.list_jobs()
```

- [ ] **Step 3: Run backend tests**

Run:
```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm/backend && uv run pytest tests/ -q
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm
git add backend/notebooklm_backend/models/notebook.py backend/notebooklm_backend/routes/notebooks.py
git commit -m "feat: add POST /api/notebooks/ endpoint to create empty notebooks"
```

---

## Task 5: API Client — Add Notebook Functions

**Files:**
- Modify: `apps/desktop/src/api.ts` (add after line 106, the `listDocuments` function)

- [ ] **Step 1: Add listNotebooks and createNotebook**

In `apps/desktop/src/api.ts`, add the import `Notebook` and `CreateNotebookRequest` to the type import block (line 1). Replace:

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
```

With:

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
  Notebook,
} from './types';
```

Then add these two functions after the `listDocuments` function (after line 106):

```typescript

export function listNotebooks(): Promise<Notebook[]> {
  return request<Notebook[]>('/notebooks/');
}

export function createNotebook(title?: string): Promise<Notebook> {
  return request<Notebook>('/notebooks/', {
    method: 'POST',
    body: JSON.stringify({ title: title ?? 'New Notebook' }),
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm/apps/desktop && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm
git add apps/desktop/src/api.ts
git commit -m "feat: add listNotebooks and createNotebook API functions"
```

---

## Task 6: Zustand Store

**Files:**
- Create: `apps/desktop/src/store/app-store.ts`

- [ ] **Step 1: Create the store**

```typescript
// apps/desktop/src/store/app-store.ts
import { create } from 'zustand';
import type { BackendConfig, ChatMessage, DocumentInfo, Notebook, SourceChunk } from '../types';

interface AppState {
  // Connection
  status: 'checking' | 'ready' | 'error';
  config: BackendConfig | null;

  // Notebooks
  notebooks: Notebook[];
  activeNotebookId: string | null;

  // Chat
  messages: ChatMessage[];
  isStreaming: boolean;

  // Documents
  documents: DocumentInfo[];

  // Sources & UI
  sourcePanelOpen: boolean;
  activeSources: SourceChunk[];
  previewDocument: DocumentInfo | null;

  // Actions — connection
  setStatus: (status: AppState['status']) => void;
  setConfig: (config: BackendConfig) => void;

  // Actions — notebooks
  setNotebooks: (notebooks: Notebook[]) => void;
  setActiveNotebookId: (id: string | null) => void;

  // Actions — chat
  addMessage: (msg: ChatMessage) => void;
  updateMessageAt: (index: number, content: string) => void;
  clearMessages: () => void;
  setIsStreaming: (val: boolean) => void;

  // Actions — documents
  setDocuments: (docs: DocumentInfo[]) => void;

  // Actions — sources & UI
  setActiveSources: (sources: SourceChunk[]) => void;
  toggleSourcePanel: () => void;
  setPreviewDocument: (doc: DocumentInfo | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  status: 'checking',
  config: null,
  notebooks: [],
  activeNotebookId: null,
  messages: [],
  isStreaming: false,
  documents: [],
  sourcePanelOpen: true,
  activeSources: [],
  previewDocument: null,

  // Connection
  setStatus: (status) => set({ status }),
  setConfig: (config) => set({ config }),

  // Notebooks — switching clears chat and documents
  setNotebooks: (notebooks) => set({ notebooks }),
  setActiveNotebookId: (id) =>
    set({ activeNotebookId: id, messages: [], activeSources: [], documents: [] }),

  // Chat
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  updateMessageAt: (index, content) =>
    set((state) => {
      const messages = [...state.messages];
      if (messages[index]) {
        messages[index] = { ...messages[index], content };
      }
      return { messages };
    }),
  clearMessages: () => set({ messages: [], activeSources: [] }),
  setIsStreaming: (val) => set({ isStreaming: val }),

  // Documents
  setDocuments: (docs) => set({ documents: docs }),

  // Sources & UI
  setActiveSources: (sources) => set({ activeSources: sources }),
  toggleSourcePanel: () => set((state) => ({ sourcePanelOpen: !state.sourcePanelOpen })),
  setPreviewDocument: (doc) => set({ previewDocument: doc }),
}));
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm/apps/desktop && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm
git add apps/desktop/src/store/app-store.ts
git commit -m "feat: add Zustand app store for global state management"
```

---

## Task 7: useNotebooks Hook

**Files:**
- Create: `apps/desktop/src/hooks/useNotebooks.ts`

- [ ] **Step 1: Create the hook**

```typescript
// apps/desktop/src/hooks/useNotebooks.ts
import { useCallback, useEffect } from 'react';
import { useAppStore } from '../store/app-store';
import { listNotebooks, createNotebook } from '../api';

export function useNotebooks() {
  const notebooks = useAppStore((s) => s.notebooks);
  const activeNotebookId = useAppStore((s) => s.activeNotebookId);
  const setNotebooks = useAppStore((s) => s.setNotebooks);
  const setActiveNotebookId = useAppStore((s) => s.setActiveNotebookId);

  const refresh = useCallback(async () => {
    try {
      const result = await listNotebooks();
      setNotebooks(result);
    } catch (err) {
      console.error('Failed to load notebooks', err);
    }
  }, [setNotebooks]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (title?: string) => {
      const notebook = await createNotebook(title);
      await refresh();
      setActiveNotebookId(notebook.notebook_id);
      return notebook;
    },
    [refresh, setActiveNotebookId],
  );

  const select = useCallback(
    (id: string | null) => {
      setActiveNotebookId(id);
    },
    [setActiveNotebookId],
  );

  return { notebooks, activeNotebookId, refresh, create, select };
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm
git add apps/desktop/src/hooks/useNotebooks.ts
git commit -m "feat: add useNotebooks hook for notebook management"
```

---

## Task 8: useDocuments Hook

**Files:**
- Create: `apps/desktop/src/hooks/useDocuments.ts`

- [ ] **Step 1: Create the hook**

```typescript
// apps/desktop/src/hooks/useDocuments.ts
import { useCallback, useEffect } from 'react';
import { useAppStore } from '../store/app-store';
import { listDocuments, uploadDocument } from '../api';

export function useDocuments() {
  const activeNotebookId = useAppStore((s) => s.activeNotebookId);
  const documents = useAppStore((s) => s.documents);
  const setDocuments = useAppStore((s) => s.setDocuments);

  const refresh = useCallback(async () => {
    if (!activeNotebookId) {
      setDocuments([]);
      return;
    }
    try {
      const result = await listDocuments(activeNotebookId);
      setDocuments(result.documents);
    } catch (err) {
      console.error('Failed to load documents', err);
    }
  }, [activeNotebookId, setDocuments]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const upload = useCallback(
    async (file: File) => {
      const notebookId = useAppStore.getState().activeNotebookId;
      const result = await uploadDocument(file, notebookId || undefined);
      // If no notebook was active, adopt the one the backend created
      if (!notebookId) {
        useAppStore.getState().setActiveNotebookId(result.notebook_id);
      }
      await refresh();
      return result;
    },
    [refresh],
  );

  return { documents, refresh, upload };
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm
git add apps/desktop/src/hooks/useDocuments.ts
git commit -m "feat: add useDocuments hook for document upload and listing"
```

---

## Task 9: useChat Hook

**Files:**
- Create: `apps/desktop/src/hooks/useChat.ts`

- [ ] **Step 1: Create the hook**

```typescript
// apps/desktop/src/hooks/useChat.ts
import { useCallback, useRef } from 'react';
import { useAppStore } from '../store/app-store';
import { streamChatMessage, sendChatMessage } from '../api';
import type { ChatStreamEvent, SourceChunk } from '../types';

export function useChat() {
  const messages = useAppStore((s) => s.messages);
  const isStreaming = useAppStore((s) => s.isStreaming);
  const activeNotebookId = useAppStore((s) => s.activeNotebookId);

  const assistantIndexRef = useRef<number | null>(null);
  const bufferRef = useRef('');

  const send = useCallback(
    async (prompt: string) => {
      if (!prompt.trim() || useAppStore.getState().isStreaming) return;

      const store = useAppStore.getState();
      const history = store.messages.map((m) => ({ role: m.role, content: m.content }));

      store.addMessage({ role: 'user', content: prompt });

      // Add empty assistant message, record its index
      const afterUser = useAppStore.getState().messages;
      const assistantIndex = afterUser.length;
      store.addMessage({ role: 'assistant', content: '' });
      assistantIndexRef.current = assistantIndex;
      bufferRef.current = '';

      store.setIsStreaming(true);
      store.setActiveSources([]);

      const body = {
        prompt,
        history,
        notebook_id: store.activeNotebookId,
      };

      const handleEvent = (event: ChatStreamEvent) => {
        const s = useAppStore.getState();
        switch (event.type) {
          case 'meta': {
            const sources: SourceChunk[] = (event.sources ?? []).map((src) => ({
              ...src,
              document_name: src.source_path.split(/[/\\]/).pop() ?? src.source_path,
              relevance_score:
                src.distance != null ? Math.round((1 - src.distance) * 100) : undefined,
            }));
            s.setActiveSources(sources);
            break;
          }
          case 'token':
            bufferRef.current += event.delta;
            if (assistantIndexRef.current !== null) {
              s.updateMessageAt(assistantIndexRef.current, bufferRef.current);
            }
            break;
          case 'done':
            if (assistantIndexRef.current !== null) {
              s.updateMessageAt(assistantIndexRef.current, event.reply);
            }
            s.setIsStreaming(false);
            assistantIndexRef.current = null;
            break;
          case 'error':
            if (assistantIndexRef.current !== null) {
              s.updateMessageAt(assistantIndexRef.current, `Error: ${event.message}`);
            }
            s.setIsStreaming(false);
            assistantIndexRef.current = null;
            break;
        }
      };

      try {
        await streamChatMessage(body, handleEvent);
      } catch {
        // Fallback to non-streaming
        try {
          const response = await sendChatMessage(body);
          if (assistantIndexRef.current !== null) {
            useAppStore.getState().updateMessageAt(assistantIndexRef.current, response.reply);
          }
        } catch (fallbackErr) {
          if (assistantIndexRef.current !== null) {
            const msg =
              fallbackErr instanceof Error ? fallbackErr.message : 'Failed to get response';
            useAppStore.getState().updateMessageAt(assistantIndexRef.current, `Error: ${msg}`);
          }
        } finally {
          useAppStore.getState().setIsStreaming(false);
          assistantIndexRef.current = null;
        }
      }
    },
    [],
  );

  const clearChat = useCallback(() => {
    useAppStore.getState().clearMessages();
  }, []);

  return { messages, isStreaming, send, clearChat };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm/apps/desktop && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm
git add apps/desktop/src/hooks/useChat.ts
git commit -m "feat: add useChat hook with SSE streaming and fallback"
```

---

## Task 10: MessageBubble Component

**Files:**
- Create: `apps/desktop/src/components/chat/MessageBubble.tsx`
- Create: `apps/desktop/src/components/chat/chat.css`

- [ ] **Step 1: Create chat.css**

```css
/* apps/desktop/src/components/chat/chat.css */

/* ---- ChatView ---- */

.chat-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--color-bg-primary);
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--color-border-subtle);
  flex-shrink: 0;
}

.chat-header h2 {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text-primary);
}

.chat-header-actions {
  display: flex;
  gap: var(--space-2);
}

.chat-header-btn {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  padding: var(--space-1) var(--space-3);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.chat-header-btn:hover {
  border-color: var(--color-border-hover);
  color: var(--color-text-primary);
}

.chat-header-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.chat-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  text-align: center;
  gap: var(--space-2);
}

.chat-empty-hint {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.chat-input-area {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--color-border-subtle);
  flex-shrink: 0;
}

.chat-input-area textarea {
  flex: 1;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-base);
  resize: none;
  outline: none;
  transition: border-color 0.15s;
}

.chat-input-area textarea::placeholder {
  color: var(--color-text-muted);
}

.chat-input-area textarea:focus {
  border-color: var(--color-accent);
}

.chat-send-btn {
  padding: var(--space-3) var(--space-5);
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-accent);
  color: white;
  font-weight: 500;
  font-size: var(--text-base);
  cursor: pointer;
  align-self: flex-end;
  transition: background 0.15s;
}

.chat-send-btn:hover:not(:disabled) {
  background: var(--color-accent-hover);
}

.chat-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ---- MessageBubble ---- */

.message-bubble {
  max-width: 80%;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.message-bubble-user {
  align-self: flex-end;
}

.message-bubble-assistant {
  align-self: flex-start;
}

.message-bubble-user .message-body {
  background: var(--color-accent-subtle);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 12px 12px 4px 12px;
  padding: var(--space-3) var(--space-4);
  color: var(--color-text-primary);
  line-height: 1.65;
}

.message-bubble-assistant .message-body {
  background: transparent;
  color: var(--color-text-secondary);
  padding: var(--space-1) 0;
  line-height: 1.7;
}

.message-body.markdown > *:first-child {
  margin-top: 0;
}

.message-body.markdown > *:last-child {
  margin-bottom: 0;
}

.message-body.markdown p {
  margin: 0 0 0.75rem;
  line-height: 1.7;
}

.message-body.markdown p:last-child {
  margin-bottom: 0;
}

.message-body.markdown ul,
.message-body.markdown ol {
  margin: 0 0 0.75rem;
  padding-left: 1.5rem;
}

.message-body.markdown li {
  margin-bottom: 0.35rem;
}

.message-body.markdown code {
  background: rgba(0, 0, 0, 0.3);
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 0.85em;
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-subtle);
}

.message-body.markdown pre {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  padding: var(--space-3);
  overflow-x: auto;
  margin: 0 0 0.75rem;
}

.message-body.markdown pre code {
  background: none;
  border: none;
  padding: 0;
}

.message-body.markdown h1,
.message-body.markdown h2,
.message-body.markdown h3 {
  margin: 1rem 0 0.5rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.thinking-indicator {
  display: inline-flex;
  padding: var(--space-2) var(--space-4);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
}

.thinking-text {
  font-size: var(--text-xs);
  letter-spacing: 0.3em;
  text-transform: uppercase;
  font-weight: 600;
  background: linear-gradient(120deg, #4f5ccb 10%, #cfd6ff 50%, #4f5ccb 90%);
  background-size: 220% 100%;
  color: transparent;
  -webkit-background-clip: text;
  background-clip: text;
  animation: shimmer 1.4s ease-in-out infinite;
}

@keyframes shimmer {
  0% { background-position: 220% 0; opacity: 0.35; }
  50% { background-position: 110% 0; opacity: 1; }
  100% { background-position: -20% 0; opacity: 0.35; }
}
```

- [ ] **Step 2: Create MessageBubble component**

```tsx
// apps/desktop/src/components/chat/MessageBubble.tsx
import ReactMarkdown from 'react-markdown';
import type { ChatMessage } from '../../types';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`message-bubble ${isUser ? 'message-bubble-user' : 'message-bubble-assistant'}`}>
      {message.content ? (
        <ReactMarkdown className="message-body markdown">{message.content}</ReactMarkdown>
      ) : (
        <div className="thinking-indicator">
          <span className="thinking-text">thinking&hellip;</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm
git add apps/desktop/src/components/chat/chat.css apps/desktop/src/components/chat/MessageBubble.tsx
git commit -m "feat: add MessageBubble component and chat styles"
```

---

## Task 11: ChatView Component

**Files:**
- Create: `apps/desktop/src/components/chat/ChatView.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/desktop/src/components/chat/ChatView.tsx
import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/app-store';
import { useChat } from '../../hooks/useChat';
import { exportConversation } from '../../api';
import { MessageBubble } from './MessageBubble';
import './chat.css';

export function ChatView() {
  const { messages, isStreaming, send } = useChat();
  const config = useAppStore((s) => s.config);
  const activeNotebookId = useAppStore((s) => s.activeNotebookId);
  const sourcePanelOpen = useAppStore((s) => s.sourcePanelOpen);
  const toggleSourcePanel = useAppStore((s) => s.toggleSourcePanel);
  const status = useAppStore((s) => s.status);

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isStreaming && status === 'ready') {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isStreaming, status]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    send(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExport = async () => {
    try {
      await exportConversation('Notebook LM Conversation', messages);
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  return (
    <div className="chat-view">
      <div className="chat-header">
        <h2>{activeNotebookId ? 'Chat' : 'Notebook LM'}</h2>
        <div className="chat-header-actions">
          <button
            type="button"
            className="chat-header-btn"
            onClick={handleExport}
            disabled={messages.length === 0}
          >
            Export
          </button>
          <button type="button" className="chat-header-btn" onClick={toggleSourcePanel}>
            {sourcePanelOpen ? 'Hide Sources' : 'Show Sources'}
          </button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>Start a conversation with your documents</p>
            {config && (
              <p className="chat-empty-hint">
                Using {config.resolved_ollama_model ?? config.ollama_model} via{' '}
                {config.llm_provider}
              </p>
            )}
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your documents... (Enter to send, Shift+Enter for new line)"
          rows={3}
          disabled={isStreaming || status !== 'ready'}
        />
        <button
          type="button"
          className="chat-send-btn"
          onClick={handleSend}
          disabled={!input.trim() || isStreaming || status !== 'ready'}
        >
          {isStreaming ? 'Thinking...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm
git add apps/desktop/src/components/chat/ChatView.tsx
git commit -m "feat: add ChatView component with streaming and export"
```

---

## Task 12: DocumentCard and DropZone Components

**Files:**
- Create: `apps/desktop/src/components/documents/DocumentCard.tsx`
- Create: `apps/desktop/src/components/documents/DropZone.tsx`
- Create: `apps/desktop/src/components/documents/documents.css`

- [ ] **Step 1: Create documents.css**

```css
/* apps/desktop/src/components/documents/documents.css */

/* ---- DocumentCard ---- */

.document-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.12s;
}

.document-card:hover {
  background: rgba(255, 255, 255, 0.05);
}

.document-card-icon {
  font-size: var(--text-xs);
  font-weight: 700;
  font-family: var(--font-mono);
  min-width: 32px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
}

.document-card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.document-card-name {
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.document-card-meta {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

/* ---- DropZone ---- */

.drop-zone {
  margin-top: var(--space-2);
  padding: var(--space-4);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.drop-zone:hover {
  border-color: var(--color-border-hover);
  background: rgba(255, 255, 255, 0.02);
}

.drop-zone-active {
  border-color: var(--color-accent);
  background: var(--color-accent-subtle);
  color: var(--color-text-primary);
}

.drop-zone-uploading {
  opacity: 0.6;
  pointer-events: none;
}
```

- [ ] **Step 2: Create DocumentCard**

```tsx
// apps/desktop/src/components/documents/DocumentCard.tsx
import type { DocumentInfo } from '../../types';
import './documents.css';

const TYPE_COLORS: Record<string, string> = {
  pdf: '#ef4444',
  docx: '#3b82f6',
  txt: '#6b7280',
  md: '#8b5cf6',
  pptx: '#f97316',
  py: '#22c55e',
};

interface DocumentCardProps {
  document: DocumentInfo;
  onClick?: () => void;
}

export function DocumentCard({ document, onClick }: DocumentCardProps) {
  const ext = document.filename.split('.').pop()?.toLowerCase() ?? '';
  const color = TYPE_COLORS[ext] ?? '#6b7280';

  return (
    <div className="document-card" onClick={onClick} role="button" tabIndex={0}>
      <div className="document-card-icon" style={{ color }}>
        {ext.toUpperCase()}
      </div>
      <div className="document-card-info">
        <span className="document-card-name" title={document.filename}>
          {document.filename}
        </span>
        <span className="document-card-meta">{document.chunk_count} chunks</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create DropZone**

```tsx
// apps/desktop/src/components/documents/DropZone.tsx
import { useRef, useState } from 'react';
import './documents.css';

interface DropZoneProps {
  onDrop: (files: FileList) => void;
  isUploading: boolean;
}

export function DropZone({ onDrop, isUploading }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      onDrop(e.dataTransfer.files);
    }
  };

  const handleClick = () => fileInputRef.current?.click();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onDrop(e.target.files);
      e.target.value = '';
    }
  };

  const className = [
    'drop-zone',
    isDragging && 'drop-zone-active',
    isUploading && 'drop-zone-uploading',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.pptx,.txt,.md,.py"
        multiple
        onChange={handleChange}
        style={{ display: 'none' }}
      />
      {isUploading ? 'Processing...' : 'Drop files here or click to upload'}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm
git add apps/desktop/src/components/documents/
git commit -m "feat: add DocumentCard and DropZone components"
```

---

## Task 13: SourcePanel Component

**Files:**
- Create: `apps/desktop/src/components/layout/SourcePanel.tsx`
- Create: `apps/desktop/src/components/layout/layout.css`

- [ ] **Step 1: Create layout.css**

```css
/* apps/desktop/src/components/layout/layout.css */

/* ---- AppShell ---- */

.app-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* ---- Sidebar ---- */

.sidebar {
  width: var(--sidebar-width);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border-subtle);
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-4) var(--space-3);
  flex-shrink: 0;
}

.sidebar-header h2 {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.sidebar-new-btn {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  padding: var(--space-1) var(--space-2);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.sidebar-new-btn:hover {
  border-color: var(--color-border-hover);
  color: var(--color-text-primary);
}

.sidebar-notebooks {
  flex: 1;
  overflow-y: auto;
  padding: 0 var(--space-2);
}

.sidebar-notebook {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  cursor: pointer;
  text-align: left;
  transition: background 0.12s, color 0.12s;
}

.sidebar-notebook:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text-primary);
}

.sidebar-notebook.active {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-text-primary);
}

.sidebar-notebook-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-notebook-count {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin-left: var(--space-2);
  flex-shrink: 0;
}

.sidebar-empty {
  padding: var(--space-4);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  text-align: center;
  line-height: 1.5;
}

.sidebar-section-title {
  padding: var(--space-3) var(--space-4) var(--space-1);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex-shrink: 0;
}

.sidebar-documents {
  padding: 0 var(--space-2);
  overflow-y: auto;
  max-height: 200px;
}

.sidebar-footer {
  margin-top: auto;
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-border-subtle);
  flex-shrink: 0;
}

.sidebar-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.sidebar-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-muted);
  flex-shrink: 0;
}

.sidebar-status.ready .sidebar-status-dot {
  background: var(--color-success);
}

.sidebar-status.error .sidebar-status-dot {
  background: var(--color-error);
}

.sidebar-status.checking .sidebar-status-dot {
  background: var(--color-warning);
}

/* ---- SourcePanel ---- */

.source-panel {
  width: var(--source-panel-width);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-secondary);
  border-left: 1px solid var(--color-border-subtle);
  overflow: hidden;
}

.source-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-border-subtle);
  flex-shrink: 0;
}

.source-panel-header h3 {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.source-panel-close {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: var(--text-lg);
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.source-panel-close:hover {
  color: var(--color-text-primary);
}

.source-panel-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.source-panel-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  line-height: 1.5;
}

.source-card {
  padding: var(--space-3);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--color-accent);
  background: var(--color-bg-surface);
}

.source-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}

.source-card-name {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-card-relevance {
  font-size: var(--text-xs);
  color: var(--color-success);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  margin-left: var(--space-2);
}

.source-card-preview {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ---- Loading / Error states ---- */

.app-loading,
.app-error {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  font-size: var(--text-lg);
}

.app-error {
  color: var(--color-error);
}
```

- [ ] **Step 2: Create SourcePanel**

```tsx
// apps/desktop/src/components/layout/SourcePanel.tsx
import { useAppStore } from '../../store/app-store';
import './layout.css';

export function SourcePanel() {
  const sourcePanelOpen = useAppStore((s) => s.sourcePanelOpen);
  const activeSources = useAppStore((s) => s.activeSources);
  const toggleSourcePanel = useAppStore((s) => s.toggleSourcePanel);

  if (!sourcePanelOpen) return null;

  return (
    <aside className="source-panel">
      <div className="source-panel-header">
        <h3>Sources</h3>
        <button type="button" className="source-panel-close" onClick={toggleSourcePanel}>
          &times;
        </button>
      </div>

      {activeSources.length === 0 ? (
        <div className="source-panel-empty">
          <p>Sources from your documents will appear here when you ask questions.</p>
        </div>
      ) : (
        <div className="source-panel-list">
          {activeSources.map((source, i) => (
            <div key={`${source.source_path}-${i}`} className="source-card">
              <div className="source-card-header">
                <span className="source-card-name">{source.document_name}</span>
                {source.relevance_score != null && (
                  <span className="source-card-relevance">{source.relevance_score}%</span>
                )}
              </div>
              <p className="source-card-preview">{source.preview}</p>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm
git add apps/desktop/src/components/layout/layout.css apps/desktop/src/components/layout/SourcePanel.tsx
git commit -m "feat: add SourcePanel component and layout styles"
```

---

## Task 14: Sidebar Component

**Files:**
- Create: `apps/desktop/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/desktop/src/components/layout/Sidebar.tsx
import { useState } from 'react';
import { useAppStore } from '../../store/app-store';
import { useNotebooks } from '../../hooks/useNotebooks';
import { useDocuments } from '../../hooks/useDocuments';
import { DocumentCard } from '../documents/DocumentCard';
import { DropZone } from '../documents/DropZone';
import './layout.css';

export function Sidebar() {
  const { notebooks, activeNotebookId, create, select, refresh: refreshNotebooks } = useNotebooks();
  const { documents, upload } = useDocuments();
  const config = useAppStore((s) => s.config);
  const status = useAppStore((s) => s.status);
  const setPreviewDocument = useAppStore((s) => s.setPreviewDocument);

  const [isUploading, setIsUploading] = useState(false);

  const handleDrop = async (files: FileList) => {
    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        await upload(file);
      }
      await refreshNotebooks();
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Notebooks</h2>
        <button type="button" className="sidebar-new-btn" onClick={() => create()}>
          + New
        </button>
      </div>

      <div className="sidebar-notebooks">
        {notebooks.map((nb) => (
          <button
            key={nb.notebook_id}
            type="button"
            className={`sidebar-notebook ${nb.notebook_id === activeNotebookId ? 'active' : ''}`}
            onClick={() => select(nb.notebook_id)}
          >
            <span className="sidebar-notebook-title">{nb.title}</span>
            <span className="sidebar-notebook-count">{nb.source_count} docs</span>
          </button>
        ))}
        {notebooks.length === 0 && (
          <p className="sidebar-empty">Upload a document to create your first notebook.</p>
        )}
      </div>

      {activeNotebookId && documents.length > 0 && (
        <>
          <div className="sidebar-section-title">Documents ({documents.length})</div>
          <div className="sidebar-documents">
            {documents.map((doc, i) => (
              <DocumentCard
                key={i}
                document={doc}
                onClick={() => setPreviewDocument(doc)}
              />
            ))}
          </div>
        </>
      )}

      <DropZone onDrop={handleDrop} isUploading={isUploading} />

      <div className="sidebar-footer">
        <div className={`sidebar-status ${status}`}>
          <span className="sidebar-status-dot" />
          <span>
            {config
              ? (config.resolved_ollama_model ?? config.ollama_model)
              : 'Connecting...'}
          </span>
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm
git add apps/desktop/src/components/layout/Sidebar.tsx
git commit -m "feat: add Sidebar component with notebook list and document management"
```

---

## Task 15: AppShell Component

**Files:**
- Create: `apps/desktop/src/components/layout/AppShell.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/desktop/src/components/layout/AppShell.tsx
import { useAppStore } from '../../store/app-store';
import { Sidebar } from './Sidebar';
import { SourcePanel } from './SourcePanel';
import { ChatView } from '../chat/ChatView';
import { getDocumentPreviewUrl } from '../../api';
import DocumentPreview from '../../DocumentPreview';
import './layout.css';

export function AppShell() {
  const previewDocument = useAppStore((s) => s.previewDocument);
  const setPreviewDocument = useAppStore((s) => s.setPreviewDocument);
  const activeNotebookId = useAppStore((s) => s.activeNotebookId);

  return (
    <>
      <div className="app-shell">
        <Sidebar />
        <ChatView />
        <SourcePanel />
      </div>

      {previewDocument && activeNotebookId && (
        <DocumentPreview
          isOpen={true}
          onClose={() => setPreviewDocument(null)}
          documentUrl={getDocumentPreviewUrl(activeNotebookId, previewDocument.source_path)}
          filename={previewDocument.filename}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm
git add apps/desktop/src/components/layout/AppShell.tsx
git commit -m "feat: add AppShell three-zone layout component"
```

---

## Task 16: Rewrite App.tsx and Clean Up

**Files:**
- Modify: `apps/desktop/src/App.tsx` (complete rewrite)
- Delete: `apps/desktop/src/App.css`

- [ ] **Step 1: Rewrite App.tsx**

Replace the entire contents of `apps/desktop/src/App.tsx` with:

```tsx
// apps/desktop/src/App.tsx
import { useEffect } from 'react';
import { useAppStore } from './store/app-store';
import { fetchConfig } from './api';
import { AppShell } from './components/layout/AppShell';

function App() {
  const status = useAppStore((s) => s.status);
  const setStatus = useAppStore((s) => s.setStatus);
  const setConfig = useAppStore((s) => s.setConfig);

  useEffect(() => {
    async function bootstrap() {
      try {
        if (window.notebookBridge) {
          await window.notebookBridge.ping();
        }
        const config = await fetchConfig();
        setConfig(config);
        setStatus('ready');
      } catch (err) {
        console.error('Bootstrap failed:', err);
        setStatus('error');
      }
    }
    bootstrap();
  }, [setStatus, setConfig]);

  if (status === 'checking') {
    return <div className="app-loading">Connecting to backend...</div>;
  }

  if (status === 'error') {
    return (
      <div className="app-error">
        Failed to connect to backend. Make sure it is running on http://127.0.0.1:8000
      </div>
    );
  }

  return <AppShell />;
}

export default App;
```

- [ ] **Step 2: Delete App.css**

Run:
```bash
rm /Users/vikranthreddimasu/Desktop/notebook-lm/apps/desktop/src/App.css
```

- [ ] **Step 3: Verify the build compiles**

Run:
```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm/apps/desktop && npx tsc --noEmit
```

Expected: No errors. (The old `App.css` import is gone because the entire `App.tsx` was replaced.)

- [ ] **Step 4: Start the dev server and verify visually**

Run:
```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm && chmod +x scripts/dev.sh && NOTEBOOKLM_LLM_PROVIDER=ollama NOTEBOOKLM_OLLAMA_MODEL=auto ./scripts/dev.sh
```

Verify:
1. Electron window opens with the three-zone layout
2. Left sidebar shows "Notebooks" header with "+ New" button
3. Model status appears at the bottom of the sidebar
4. Center chat area shows "Start a conversation with your documents"
5. Right source panel shows "Sources from your documents will appear here..."
6. Uploading a document via the drop zone works — document appears in sidebar
7. Chat messages render with markdown
8. Source panel populates after a chat response
9. "Hide Sources" / "Show Sources" toggle works
10. Export button downloads conversation markdown

- [ ] **Step 5: Commit**

```bash
cd /Users/vikranthreddimasu/Desktop/notebook-lm
git add apps/desktop/src/App.tsx
git rm apps/desktop/src/App.css
git add -A apps/desktop/src/
git commit -m "feat: rewrite App.tsx with three-zone layout, Zustand store, and component architecture

Replaces the monolithic 682-line App.tsx with a decomposed component tree:
- AppShell: three-zone flex container (sidebar / chat / source panel)
- Sidebar: notebook list, document cards, drag-and-drop upload, model status
- ChatView: message list with streaming, markdown rendering, export
- SourcePanel: collapsible panel showing retrieved source chunks
- Zustand store for global state management
- Custom hooks: useNotebooks, useDocuments, useChat
- CSS custom property design system with tokens"
```

---

## Out of Scope (follow-up plan)

These features from the design spec are intentionally deferred to a separate plan:

- **Setup wizard** — onboarding flow with Ollama auto-detection, model installation, first notebook
- **Backend: model management endpoints** — `/api/models/available`, `/api/models/pull`, `/api/models/status`
- **Backend: system info** — `/api/system/info` (RAM, disk, OS)
- **Chat history persistence** — `conversations` and `messages` SQLite tables + CRUD endpoints
- **Follow-up suggestions** — `/api/suggestions` endpoint + QuickActions component
- **Command palette** — `Cmd+K` overlay with search
- **Keyboard shortcuts** — `Cmd+N`, `Cmd+/`, `Cmd+Shift+E` etc.
- **Agent workspace** — preserved in backend, UI deferred
- **Speech STT/TTS** — preserved in backend, UI deferred
