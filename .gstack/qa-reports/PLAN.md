# UX/UX/Tech Rebuild Plan — Notebook LM

**Based on:** `ux-audit.md` (78 findings) + `tech-audit.md` (39 findings).

**Philosophy:** Fix what silently breaks or corrupts user data FIRST. Resurrect the signature citation feature. Then missing actions. Then reliability. Then polish. No new features until the core works.

---

## Wave 1 — Stop the bleeding
*Nothing the user does should silently corrupt or lose data. Nothing shipped should be cosmetic-only.*

| # | Fix | Files | Evidence |
|---|-----|-------|----------|
| 1.1 | **Add `base: './'` to vite config** — production Electron build is a blank screen without this | `apps/desktop/vite.config.ts` | tech 11-A |
| 1.2 | **Fix `complete_ingestion` source_count overwrite** — change absolute `=` to incremental `+= source_count` | `backend/notebooklm_backend/services/notebook_store.py:159` | tech 7-C |
| 1.3 | **Delete notebook → also delete Chroma collection + upload files** | `backend/notebooklm_backend/routes/notebooks.py:36` | tech 7-D |
| 1.4 | **Confirm before destructive actions** — wire a shared `ConfirmDialog` for: delete notebook, delete conversation, (future) delete document. Danger-styled, focus trap, Escape to cancel | `components/ui/ConfirmDialog.tsx` (new), `Sidebar.tsx:261`, `Sidebar.tsx:289` | ux C4, C9 |
| 1.5 | **Kill the stale-index bug in `updateMessageAt`** — give each message a UUID at add-time, look up by ID not by index | `store/app-store.ts:91`, `hooks/useChat.ts:25` | tech 1-A |
| 1.6 | **Fix abort → next send corruption** — on abort, either truncate the partial assistant message with a clear "(stopped)" badge, or remove it from `messages` before next `send()` | `hooks/useChat.ts:20` | ux C8, H11 |
| 1.7 | **Don't fall through to non-streaming fallback on user abort** — check `controller.signal.aborted` first | `hooks/useChat.ts:106` | tech 1-C |
| 1.8 | **Decompose `clearMessages`** — `newChat()` (UI clear + forget conversation) vs `clearMessagesOnly()` (for notebook switch keep conversation intact). Stop torching `activeSources` on every reset | `store/app-store.ts`, `hooks/useConversations.ts:31` | ux H12, H24, H25 |
| 1.9 | **Cancel in-flight stream on notebook switch** — don't let a stream complete into a different notebook's conversation | `store/app-store.ts:86`, `hooks/useChat.ts` | tech 1-B |
| 1.10 | **Fix CommandPalette hooks-after-return violation** — move `useState(selectedIndex)` above the early return | `components/ui/CommandPalette.tsx:52` | ux M22 |
| 1.11 | **Lock down CORS** — drop `allow_origin_regex=".*"`, keep only explicit localhost origins, `allow_credentials=False` | `backend/notebooklm_backend/app.py:86` | tech 13-A |
| 1.12 | **Validate `openExternal` URL scheme** — only `https?://` and `mailto:` | `apps/desktop/electron/main.cjs:165` | tech 13-B |
| 1.13 | **Fix cross-notebook file disclosure in preview** — all path strategies must resolve inside the notebook's scoped uploads directory. Remove strategy 4 (cross-notebook scan) | `backend/notebooklm_backend/routes/documents.py:154` | tech 7-B |

**Deliverable:** No user action silently corrupts state. Production build renders. Notebook/conversation deletes have an off-ramp. Destructive races are gone.

---

## Wave 2 — Citation trust layer
*The product's signature feature — grounded answers with visible citations — is 100% dead. Bring it back.*

| # | Fix | Files | Evidence |
|---|-----|-------|----------|
| 2.1 | **Render real citations** — parse assistant output for `[N]` markers, wrap each sentence containing one in a `.cited` span with an amber left-rule, render `[N]` as a `.cite-marker` mono chip. Use ReactMarkdown's `components.{p,li}` or a small remark plugin | `components/chat/MessageBubble.tsx` | ux H14 |
| 2.2 | **Wire citation click → source open** — clicking `[N]` or hovering the sentence scrolls/highlights the matching `.source-card` in the panel, and opens the document preview when clicked. Two-way link, not just chip-to-panel | `MessageBubble.tsx`, `SourcePanel.tsx`, `App.tsx` (preview opener) | ux H17 |
| 2.3 | **Fix the source panel toggle** — `SourcePanel.tsx` must check `sourcePanelOpen` too, not just source count. Persist the toggle per-notebook | `components/layout/SourcePanel.tsx:19`, `store/app-store.ts` | ux C3, M6 |
| 2.4 | **Animate source panel in/out** — don't jerk the chat column 280px. Width + opacity transition, or slide-in overlay on narrow windows | `components/layout/SourcePanel.tsx`, `layout.css` | ux H18 |
| 2.5 | **Empty source panel affordance** — when empty but toggled open, show "Sources will appear here after your first question" in muted serif | `SourcePanel.tsx` | ux H5 |
| 2.6 | **Rewrite `DocumentPreview.css` on the design system** — warm stone palette, tokenized colors, `--radius-modal`, `--font-mono` for page counter, amber highlight using `--color-cite` | `apps/desktop/src/DocumentPreview.css` | ux H21, M21 |
| 2.7 | **Stop the double PDF load on citation click** — reuse the loaded pdf.js instance, search text via the already-rendered pdf object | `DocumentPreview.tsx:48` | tech + ux H19 |
| 2.8 | **Tighten highlight match ratio** — 0.3 is too loose. Use a scoring window + longest-common-subsequence match, cap highlight span to the matched sentence(s) only | `DocumentPreview.tsx:117` | ux H20 |
| 2.9 | **Preview modal keyboard focus + ESC** — programmatically focus the overlay on open, keyboard nav works without a click first, ESC closes | `DocumentPreview.tsx:128` | ux L8 |
| 2.10 | **Replace `📄/📑` emoji toggle with icons** | `DocumentPreview.tsx:166` | ux M20 |
| 2.11 | **Persist sources on historical messages** — `loadConversation` must synthesize `document_name` for persisted sources (same path as `useChat.meta` handler) | `hooks/useConversations.ts:35`, `types.ts:114` | tech 12-A |
| 2.12 | **Set `activeSources` from the latest assistant message with sources, not overwrite-per-message** — or don't restore at all for historical loads (ambiguous context) | `hooks/useConversations.ts:33` | tech 4-B / ux H16 |

**Deliverable:** The amber-left-rule citation pattern from DESIGN.md actually renders. Clicking `[1]` scrolls to the right source card and opens the document at the right place. Preview modal matches the warm-stone palette.

---

## Wave 3 — Missing actions & error visibility
*The product is missing table-stakes affordances. Errors vanish.*

| # | Fix | Files | Evidence |
|---|-----|-------|----------|
| 3.1 | **Rename notebook** — backend `PATCH /notebooks/{id}`, frontend `renameNotebook()` API + context-menu action with inline edit (same pattern as conversation rename) | `backend/routes/notebooks.py`, `notebook_store.py`, `apps/desktop/src/api.ts`, `Sidebar.tsx` | ux C5 |
| 3.2 | **Delete document** — backend `DELETE /documents/{id}?notebook_id=...`, frontend action on document row (hover overflow menu, like conversations). Confirmation dialog reused from Wave 1 | `backend/routes/documents.py`, `api.ts`, `DocumentCard.tsx` | ux C6 |
| 3.3 | **Duplicate upload detection** — backend returns a clear "already indexed" signal (or upsert), frontend shows a "File already added" toast | `backend/routes/documents.py`, `ingestion.py`, `api.ts`, `AppShell.tsx:136` | ux C7 |
| 3.4 | **Real upload progress** — add an `uploadState: Record<filename, {status, progress, error}>` to the store, pipe `XMLHttpRequest.upload.progress` or fetch + duplex streams, show inline progress bars in the sidebar during indexing | `store/app-store.ts`, `api.ts`, `components/documents/*` | ux H8, H23 |
| 3.5 | **Create empty notebook** — split "+ New notebook" from "Upload document". Empty notebooks are legal; upload happens after | `Sidebar.tsx:78`, `useNotebooks.ts` | ux H7 |
| 3.6 | **Wire wizard model selection to backend** — either (a) persist the chosen model and send on every chat request so backend honors it, or (b) cut step 2 entirely and let backend auto-resolve silently. Not the current half-state | `components/ui/SetupWizard.tsx:229`, `backend/routes/chat.py`, `backend/config.py` | ux C1 |
| 3.7 | **Persistent error log** — add a notification center (bell icon in sidebar footer) with last N errors. Toast auto-dismiss still exists but errors also log here with timestamp + action (retry, copy, dismiss) | `components/ui/NotificationCenter.tsx` (new), `components/ui/Toast.tsx`, `store/app-store.ts` | ux H22, L12 |
| 3.8 | **User-friendly error messages** — central error-translator: `Request failed with status 422` → "That file type isn't supported", `ERR_CONNECTION_REFUSED` → "Backend isn't running" | `apps/desktop/src/api.ts`, or `utils/errorMessages.ts` (new) | ux M28 |
| 3.9 | **Zotero button in sidebar** — not just hidden in command palette. Stamp it as an import source near the upload button with its own discoverable affordance | `components/layout/Sidebar.tsx` | ux discoverability |
| 3.10 | **Conversation load should look like a load, not a stream** — bulk `setMessages(ChatMessage[])` store action, single render, skeleton during fetch | `store/app-store.ts`, `hooks/useConversations.ts:33` | ux H15, tech 14-B |
| 3.11 | **Keep current context on load failure** — only clear messages AFTER the fetch resolves with data | `hooks/useConversations.ts:31` | ux C10 |
| 3.12 | **Ollama health in ConnectionBanner** — banner monitors both backend and Ollama. If Ollama is down, show "AI model offline — start Ollama" with one-click "Copy command" | `components/ui/ConnectionBanner.tsx` | ux M27 |
| 3.13 | **Initial ConnectionBanner check** — run `check()` on mount, not just on interval tick | `ConnectionBanner.tsx:13` | ux L3 |

**Deliverable:** Users can rename, delete, see upload progress, and understand what goes wrong. Errors don't disappear in 4 seconds.

---

## Wave 4 — Reliability
*The backend and streaming path have structural weaknesses that cause silent failure, OOM, or UI lockups.*

| # | Fix | Files | Evidence |
|---|-----|-------|----------|
| 4.1 | **Backend crash recovery** — Electron detects unexpected backend exit, sends IPC to renderer, attempts restart, renderer shows "Backend restarting…" banner with retry countdown | `apps/desktop/electron/main.cjs:97`, new IPC channel, `App.tsx` / `ConnectionBanner.tsx` | tech 5-A |
| 4.2 | **API timeouts on every call** — accept `AbortSignal` in `request()`, default 30s for lookups, 300s for uploads, 5s for healthz | `apps/desktop/src/api.ts:53` | tech 2-A |
| 4.3 | **Exponential backoff for 503 / ECONNREFUSED** — 3 attempts, 500ms / 1s / 2s, only for idempotent GETs | `apps/desktop/src/api.ts:53` | tech 2-B |
| 4.4 | **SQLite WAL mode** — `PRAGMA journal_mode = WAL` in all three stores; `busy_timeout` in NotebookStore and MetricsStore | `backend/services/conversation_store.py`, `notebook_store.py`, `metrics_store.py` | tech 6-C, 8-B |
| 4.5 | **Embedding batch cap** — batch size 64, iterate chunks | `backend/services/vector_store.py:40` | tech 9-B |
| 4.6 | **Embeddings in threadpool** — wrap `model.encode()` via `run_in_executor` | `backend/services/embeddings.py:31` | tech 9-A |
| 4.7 | **LlamaCpp generate in threadpool** — same treatment | `backend/services/llm.py:123` | tech 10-B |
| 4.8 | **Ollama streaming timeout** — `httpx.Timeout(connect=5, read=300, write=10, pool=5)` | `backend/services/llm.py:65` | tech 10-A |
| 4.9 | **Upload size limit + stream-to-disk** — 100MB cap (configurable), chunked writes, not `await file.read()` | `backend/routes/documents.py:17` | tech 7-A |
| 4.10 | **Upsert, not add, for chunks** — lets re-uploads succeed cleanly | `backend/services/vector_store.py:40` | tech 9-C |
| 4.11 | **OCR guard for scanned PDFs** — reject with clear error if extracted text < min threshold | `backend/services/document_loader.py:80` | tech 9-D |
| 4.12 | **Disable Chroma telemetry** — `Settings(anonymized_telemetry=False)`. Aligns with offline-first | `backend/services/vector_store.py:229` | tech 6-B |
| 4.13 | **Per-conversation stream lock** — asyncio lock keyed by conversation_id to prevent concurrent writers | `backend/routes/chat.py:45` | tech 3-D |
| 4.14 | **`conversation_id` also in `done` event** — frontend uses `done` as authoritative if present | `backend/routes/chat.py`, `useChat.ts:54` | tech 3-E |
| 4.15 | **Fix `list_documents` O(n)** — query from summaries collection, not all chunks | `backend/routes/documents.py:123` | tech 14-A |
| 4.16 | **Defer document summary LLM to background** — don't block upload on summary generation | `backend/services/ingestion.py:50` | tech 10-D |
| 4.17 | **Separate context window from max output tokens** — `llm_context_window` (4096+) vs `llm_max_output_tokens` (512) in config | `backend/config.py:28` | tech 10-E |
| 4.18 | **Resolve Ollama model lazily, not at factory time** — use FastAPI `lifespan` or resolve on first chat | `backend/app.py:27` | tech 6-A |

**Deliverable:** Backend crashes self-heal. Large PDFs don't OOM. Event loop doesn't freeze mid-stream. Uploads don't hang forever.

---

## Wave 5 — Polish
*Once the product works, make it actually feel like DESIGN.md says it should.*

| # | Fix | Files | Evidence |
|---|-----|-------|----------|
| 5.1 | **Pane resize** — drag handles between sidebar/chat and chat/source panel, persisted to localStorage | `components/layout/AppShell.tsx`, `layout.css` | ux H4 |
| 5.2 | **Reduced-motion: stop, don't flicker** — `animation: none !important` for the 3 keyframe animations (shimmer, skeleton pulse, fadeIn) instead of 0.01ms duration | `design-system/tokens.css:198` | ux L reduced-motion |
| 5.3 | **Kill hardcoded colors in `DocumentCard`** — swap `#ef4444`/`#3b82f6` for token-based file-type pills using a single neutral mono chip with file extension | `components/documents/DocumentCard.tsx:4` | ux M11 |
| 5.4 | **Tokenize `SourcePanel` relevance colors** — `--color-accent` (high), `--color-cite` (mid), `--color-text-muted` (low) | `SourcePanel.tsx:4` | ux M17 |
| 5.5 | **Clamp `relevance_score` to 0–100** — defensive, or fix backend to always return 0–100 | `SourcePanel.tsx:49`, `types.ts:26`, backend | ux M18 |
| 5.6 | **Wizard card elevation** — add `background: var(--color-bg-surface)`, `border`, `border-radius: var(--radius-modal)`, `box-shadow: var(--shadow-lg)` | `components/ui/setup-wizard.css:12` | ux M4 |
| 5.7 | **Wizard primary button color parity** — `color: #0c0a09` like the rest of the app | `setup-wizard.css:244` | ux L1 |
| 5.8 | **Wizard step dot visibility** — use `--color-border-hover` for inactive so they're actually visible | `setup-wizard.css:31` | ux L2 |
| 5.9 | **Context menu radius → modal** — `var(--radius-modal)` on `.context-menu` container | `layout.css:684` | ux M9 |
| 5.10 | **Chat empty state checks doc count** — "Add a document to get started" if notebook is empty, "What would you like to know?" otherwise | `components/chat/ChatView.tsx`, `hooks/useDocuments.ts` | ux (chat empty state) |
| 5.11 | **BibTeX export not destroyed by context resets** — enable whenever the visible conversation has messages with sources, not only `activeSources.length > 0` | `ChatView.tsx:118`, `OverflowMenu` logic | ux H25 |
| 5.12 | **Show document-count hint on welcome + sidebar sections** — helps user notice when notebook is empty | `Sidebar.tsx`, `layout.css` | ux discoverability |
| 5.13 | **Auto-scroll pause when user scrolls up** — use `isScrolledUp` to gate `scrollIntoView` during streaming | `ChatView.tsx:48` | ux M13 |
| 5.14 | **Accessibility polish** — keyboard handlers on `DocumentCard` / `SourcePanel` role=button, `aria-label` on `...` menus, `role="dialog"` + focus trap on CommandPalette and wizard | throughout | ux a11y |
| 5.15 | **Font-weight axis on Bunny Fonts URL** — switch to `plus-jakarta-sans:ital,wght@0,400..700` to support 450/550 weights already in CSS | `apps/desktop/index.html` | ux L font |
| 5.16 | **Multi-word fuzzy search in Command Palette** — split query on whitespace, score each token separately, combine | `components/ui/CommandPalette.tsx:13` | ux M24 |
| 5.17 | **Keyboard shortcut hints in palette items** — inline `⌘N`, `⌘K`, etc. | `CommandPalette.tsx` | ux L9 |
| 5.18 | **Add `?` shortcut global override** — don't block when chat textarea has focus, or re-map to `⌘/` | `AppShell.tsx:40` | ux M25 |
| 5.19 | **Remove `DropZone.tsx`** — dead code | delete file | ux M10 |
| 5.20 | **Remove duplicate `final_reply` assignment** | `backend/services/chat.py:205` | tech 3-B |

**Deliverable:** App matches DESIGN.md. No hardcoded colors. A11y passes a basic audit. The loose ends are tied off.

---

## Estimates

| Wave | Scope | Rough work | Files touched |
|------|-------|-----------|---------------|
| 1 | Data integrity + broken basics | 1-2 PRs, ~300 lines | ~12 files |
| 2 | Citation layer | 1 PR, ~400 lines (citation renderer is meaty) | ~6 files |
| 3 | Missing actions + errors | 2 PRs, ~500 lines | ~15 files |
| 4 | Reliability / backend | 2 PRs, ~400 lines | ~14 files |
| 5 | Polish | 1-2 PRs, ~250 lines | ~20 files |

Total: ~6–8 PRs, ~1850 lines. Each wave is a green CI before starting the next.

---

## Proposed sequence

1. Present this plan to the user, get direction on scope and priority (can drop/swap any wave item)
2. Run a short `/plan-eng-review` on the plan once it's locked (skip if user wants to go fast)
3. Execute Wave 1 end-to-end → PR → merge on green CI
4. Wave 2 → PR → merge
5. Wave 3 → 2 PRs
6. Wave 4 → 2 PRs
7. Wave 5 → 1-2 PRs

Each PR: single wave or natural sub-wave boundary. CI green before merge. I never commit without explicit go.

---

## Explicit non-goals of this rebuild

- No new user-facing features outside what the audits surfaced
- No swap to a different framework / no rewrite of routing
- No refactor of the Zustand store architecture (fix bugs, don't reshape)
- No backend ORM migration (stay on raw sqlite3 + chroma)
- No redesign of the visual language (DESIGN.md is already approved and implemented in tokens)
- Test suite: I'll add targeted tests to Wave 1 + 4 critical paths (abort flow, stream cancel, ingestion error paths), but not a full coverage push
