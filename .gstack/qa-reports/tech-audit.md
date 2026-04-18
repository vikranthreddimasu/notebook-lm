# Tech Audit — Notebook LM (Offline RAG Desktop App)

**Date:** 2026-04-17
**Method:** Deep code trace across frontend + backend + Electron main

## Severity Summary

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 17 |
| Medium | 13 |
| Low | 8 |

**Top 5 threats to "actually works":**
1. **Finding 11-A** (Vite `base` missing) — packaged production app is a blank screen
2. **Finding 7-C** (`complete_ingestion` clobbers source_count) — wrong document counts after every upload
3. **Finding 9-B** (unbounded embedding batch) — OOM on large document upload, silent backend crash
4. **Finding 7-D** (delete notebook leaks Chroma + files) — storage grows without bound
5. **Finding 5-A** (backend crash leaves UI broken) — any backend crash makes the app unusable with no guidance

---

## 1. State Management

- **1-A High:** `updateMessageAt` uses positional index that can go stale. Mid-stream notebook switch + component unmount leaves `isStreaming: true` permanently. Fix: message UUIDs, not array indices (`app-store.ts:91-97`, `useChat.ts:25-27`)
- **1-B High:** Notebook switch during stream creates ghost conversation under wrong notebook. Frontend optimistic entry vs backend's in-flight conversation desync (`app-store.ts:86`, `useChat.ts:54`)
- **1-C High:** `AbortError` falls through to non-streaming fallback — user clicks stop, gets full reply anyway (`useChat.ts:106-123`)
- **1-D Medium:** `useNotebooks.create` not idempotent on rapid click — two notebooks created in non-deterministic order (`useNotebooks.ts:29-37`)

## 2. API Layer

- **2-A High:** No timeout on any `fetch` (only streaming has AbortSignal). `fetchConfig` can hang indefinitely on cold start if Ollama is slow (`api.ts:53-68`)
- **2-B Medium:** Single-attempt, no retry. Cold-start race with backend causes hard errors (`api.ts:53-68`)
- **2-C Low:** `getApiBase` not thread-safe — multiple IPC round-trips on startup (`api.ts:31-51`)
- **2-D Medium:** `response.json()` cast with no runtime validation — shape drift surfaces as mystery crashes (`api.ts:68`)

## 3. Streaming Chat

- **3-A High:** Mid-stream network break falls through to fallback instead of erroring cleanly (`api.ts:180-192`, `useChat.ts:103-123`)
- **3-B Low:** Duplicate `final_reply` assignment (`backend/services/chat.py:205-206`)
- **3-C Medium:** SSE parser doesn't handle multi-line `data:` — fragile to future events (`api.ts:161-179`)
- **3-D High:** Backend has no per-conversation lock. Rapid-fire sends + concurrent `add_message` → nondeterministic ordering in DB (`backend/routes/chat.py:45-108`)
- **3-E Medium:** `conversation_id` sent only via `meta` event — if meta drops, user's thread splits into two conversations (`useChat.ts:54`, `backend/routes/chat.py:52`)

## 4. Hooks

- **4-A Medium:** `renameConversation` revert reads post-optimistic state, fragile if races (`useConversations.ts:61-79`)
- **4-B Medium:** `loadConversation` sources — last message wins, overwrites in a loop (`useConversations.ts:33-38`)
- **4-C Low:** `useDocuments` fires wasted refresh on notebook-switch null state (`useDocuments.ts:10-24`)
- **4-D Low:** `useNotebooks.refresh` has stable-ish callback deps — minor inefficiency

## 5. Electron Main

- **5-A Critical:** Backend crash after window loaded — no IPC, no retry, no user feedback. UI fails silently on every fetch (`electron/main.cjs:97-103`)
- **5-B Medium:** Port search limited to 8000–8003; if occupied, falls back to `http://127.0.0.1:8000` which may be a foreign process (`electron/main.cjs:29-34`)
- **5-C High:** No CSP on BrowserWindow. XSS via markdown → arbitrary `shell.openExternal` → OS-level escalation path (`electron/main.cjs:127-150`)
- **5-D Low:** `before-quit` handler could loop in edge case if `stopBackend` fails to clear `backendProcess` (`electron/main.cjs:212-218`)

## 6. Backend Startup

- **6-A High:** `_available_ollama_models` is sync `httpx.get` at factory time. Blocks uvicorn startup. Ollama slow → Electron `waitForBackend` 30s timeout (`app.py:27-28`, `model_profiles.py:32-38`)
- **6-B Low:** ChromaDB telemetry — no `Settings(anonymized_telemetry=False)`. Log noise + violates offline promise (`vector_store.py:229`)
- **6-C High:** Three SQLite stores share `metadata.db` but only `ConversationStore` sets `busy_timeout`. Concurrent ingestion + chat can fail with `SQLITE_BUSY` silently

## 7. Backend Routes

- **7-A High:** `documents/upload` reads entire file into memory — no size limit. 2GB PDF OOMs backend (`routes/documents.py:17-104`)
- **7-B High:** Document preview has path traversal mitigation only in strategy 2. Strategies 1/3/4 match by filename → **cross-notebook file disclosure** (`routes/documents.py:154-235`)
- **7-C High:** `complete_ingestion` **overwrites** `source_count` with per-job count. Notebook with 5 docs + 6th upload → count becomes 1 (`notebook_store.py:159-197`)
- **7-D High:** `DELETE /notebooks/{id}` removes SQLite row but leaves ChromaDB collection + upload files on disk. Storage leak (`routes/notebooks.py:36-44`)
- **7-E Low:** `DELETE /conversations/{id}` TOCTOU — returns "deleted" even if no-op
- **7-F Medium:** `speak` endpoint accepts `dict[str, str]` — no Pydantic validation, no max-length → easy DoS (`routes/speech.py:36-50`)
- **7-G Medium:** Zotero import runs sync in one request handler. Large libraries time out with partial state (`routes/zotero.py:82-185`)

## 8. Conversation Store

- **8-A Medium:** `auto_title_if_needed` does get + update in two transactions → race window (`conversation_store.py:204-214`)
- **8-B Medium:** No WAL mode. Every write blocks all reads. During stream completion, sidebar refresh stalls (`conversation_store.py:44`, `notebook_store.py:25`)

## 9. Vector Store / Embeddings

- **9-A High:** `model.encode()` is sync CPU-bound but called from async context → blocks event loop for hundreds of ms (`embeddings.py:31-35`)
- **9-B High:** `add_chunks` embeds ALL chunks in one batch. 500-page PDF → 1000 texts to model at once → GB allocation → OOM (`vector_store.py:26-49`)
- **9-C Medium:** `collection.add()` not `.upsert()` — re-uploads fail with `DuplicateIDError` + partial state (`vector_store.py:40-48`)
- **9-D Medium:** No OCR fallback for scanned PDFs. User uploads scanned PDF, gets "success" + 0 chunks, then "no documents found" on every query (`document_loader.py:80-98`)
- **9-E Low:** `query_document_summaries` silently returns `[]` on any error — masks storage corruption (`vector_store.py:174-184`)

## 10. LLM Providers

- **10-A High:** Ollama streaming client uses `timeout=None` — unbounded. Hung stream holds connection forever (`llm.py:65`)
- **10-B High:** `LlamaCppBackend.generate/stream_generate` declared async but call sync blocking `llama.create_completion()` → entire event loop freezes during inference (`llm.py:123-136`)
- **10-C Medium:** `LlamaIndexRAGService.prepare_prompt()` always delegates to `_fallback_rag` → 433 lines of code that don't actually run in the streaming path (`rag_llamaindex.py:27-35`)
- **10-D Medium:** Document summary generated synchronously during ingestion → 10-doc Zotero import = 10 serial LLM calls tacked onto upload latency (`ingestion.py:50-57`)
- **10-E Medium:** `llm_context_window` and `llm_max_tokens` both set to 2048. Long prompts silently truncated with no warning (`config.py:28-29`)

## 11. Build / Config

- **11-A Medium (really Critical for packaged app):** `vite.config.ts` has no `base: './'`. Packaged Electron renderer loads from `file://` with absolute `/assets/...` paths → blank white screen
- **11-B Medium:** electron-builder mac arm64 only. No x64, no win, no linux
- **11-D High:** No CSP meta tag in `index.html`

## 12. Type Safety

- **12-A Medium:** `PersistedMessage.sources` type claims `SourceChunk[]` but backend sends raw `list[dict]`. Messages loaded from history → `document_name` undefined → source panel blank names on reloaded conversations (`types.ts:114-121`, `routes/conversations.py:29-33`)
- **12-B Low:** `meta.sources` type says `StreamSource[]` but backend can send `null` — guard `?? []` is fragile to refactor (`types.ts:29-38`)

## 13. Security

- **13-A High:** `allow_origin_regex = ".*"` + `allow_credentials = True` = localhost CSRF. Any malicious web page can exfiltrate notebooks/messages/files (`app.py:86`)
- **13-B High:** `shell.openExternal(url)` no scheme validation. Renderer XSS → `file:///etc/passwd` or `javascript:...` (`electron/main.cjs:165-169`)
- **13-C Medium:** `FileResponse` with `application/octet-stream` no `Content-Disposition: attachment` → webview may render inline (`routes/documents.py:227-232`)

## 14. Performance

- **14-A High:** `list_documents` does `collection.get()` with no limit → fetches all chunks to build file list. O(n) on collection size (`routes/documents.py:123`)
- **14-B Medium:** `loadConversation` calls `addMessage` in a loop → N Zustand re-renders (`useConversations.ts:33-39`)
- **14-C Medium:** `rag_llamaindex` scans all metadata per query before vector search — adds 100-500ms per query on large notebooks (`rag_llamaindex.py:161`)

---

## Cross-Cutting

### Missing Observability
- No structured logs, no correlation IDs
- No metrics exposed outside the `chat_metrics` table
- No crash reporting (Sentry/Bugsnag)
- Backend startup errors not surfaced to UI
- Backend exit logs only — no `app.setAboutPanelOptions` crash info

### Zero Test Coverage
- All frontend state, hooks, api
- Streaming endpoint
- SSE parser
- Documents ingest + preview
- Vector store add/query
- Electron lifecycle

### Migration / Upgrade Risk
- No migration runner for SQLite schema
- No ChromaDB index version stamp
- No check that stored embeddings match current embedding model — silent wrong-space queries

### Dead Code
- `rag_llamaindex.py` `prepare_prompt` only delegates
- `chat.py:205-206` duplicate assignment
- `HashEmbeddingBackend` shipped in production builds
- `DummyBackend` is fallback for unknown providers (should raise)
