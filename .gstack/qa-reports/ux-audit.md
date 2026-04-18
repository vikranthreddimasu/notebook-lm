# UX Audit — Notebook LM Desktop

**Date:** 2026-04-17
**Method:** Full code trace of every user-facing flow
**Verdict:** UI tokens are coherent. UX has systemic problems: destructive actions with no confirmation, the signature citation feature is 100% dead, a source-panel toggle that silently does nothing, dead components, and a first-run wizard whose model selection is never read.

---

## Severity Summary

| Severity | Count |
|----------|-------|
| Critical | 10 |
| High | 25 |
| Medium | 30 |
| Low | 13 |

**Top 5 critical issues:**
- C3: Source panel toggle (`Cmd+/`) does nothing — `SourcePanel.tsx:19` ignores `sourcePanelOpen`
- C4 + C9: Notebook and conversation delete fire without confirmation
- C5: No rename notebook anywhere (no UI, no API)
- C6: No way to delete individual documents
- C8: Aborting mid-stream leaves partial message in history, corrupts next send
- H14: Citation amber left-rule pattern is dead CSS — `MessageBubble.tsx` uses plain ReactMarkdown with no renderer

## Flow 1: First-Run / Setup
- C1: Model selection step stores `localStorage['notebook-lm-selected-model']` at `SetupWizard.tsx:229` — never read anywhere
- C2: Wizard progress not durable; mid-flow close + Ollama-ready re-open silently marks complete, skipping upload step
- H1: Dropzone only processes `e.dataTransfer.files[0]`; others silently dropped
- H2: Upload failure leaves wizard stuck with toast that vanishes in 4s
- H3: Auto-advance at 800ms with no countdown
- M4: `.wizard-card` has no background/border/radius (`setup-wizard.css:12`)
- L1: Primary button color `#fff` vs rest-of-app `#0c0a09`
- L2: Step dots invisible in idle (color-border over bg-primary)

## Flow 2: App Shell
- C3: `toggleSourcePanel` store action works but panel ignores `sourcePanelOpen` — only hides when `activeSources.length === 0`
- H4: Sidebar 240px + source 280px are fixed; on 13" screens chat gets ~760px
- H5: Source panel is invisible before first message — no affordance
- M5: Zotero dialog has no Escape handler
- L3: `ConnectionBanner` setInterval with no initial check — 30s delay on bad state

## Flow 3: Notebooks
- C4: Right-click → Delete notebook fires immediately, no dialog, no undo
- C5: Context menu has only Delete — no rename action exists in UI or API
- H6: Notebook switch shows "Conversation saved" toast incorrectly (save happened during stream, not on switch)
- H7: "+ New" button forces immediate upload — no create-empty-notebook path
- M7: Notebook switch silently wipes messages/sources/conversation
- M9: `.context-menu` uses `--radius-card` (14px) — should be `--radius-modal` (20px)

## Flow 4: Documents
- C6: No delete document action exists anywhere (no UI, no API)
- C7: No duplicate upload guard — same file uploads silently
- H8: Upload toast vanishes at 4s; large PDFs take 30–60s to index (phantom progress)
- H9: Multi-file sequential upload — failed file's name not reported
- H10: DragOverlay accepts any file type, no accept filter
- M10: `DropZone.tsx` is dead code — imported nowhere
- M11: `DocumentCard.tsx:4–11` uses Tailwind hex (`#ef4444`, `#3b82f6`) not tokens
- L5: Document list truncated at 220px — no "Show all"

## Flow 5: Chat
- C8: `useChat.ts:20` includes partial aborted message in next send's history → backend sees corrupted exchange
- H14 (shared): **Citation pattern is dead** — ReactMarkdown in `MessageBubble.tsx:25` has no custom renderer; `.cited` / `.cite-marker` styles never activate in any response
- H11: Aborted messages look identical to complete messages
- H12: Retry wipes source panel via `clearMessages` → `setActiveSources([])`
- H13: `pendingSuggest` auto-fills textarea post-wizard with no explanation
- M12: Follow-up chips render after error messages
- M13: Auto-scroll fires on every token; users scrolling up are snapped back down
- M14: User bubble border-radius `18px 18px 4px 18px` hardcoded not tokenized

## Flow 6: Conversations
- C9: Conversation delete fires without confirm; `...` button is opacity-0-until-hover so cursor is already positioned on it
- C10: `loadConversation` clears current messages **before** the load succeeds — network error wipes current context
- H15: Historical conversation loads message-by-message in a loop, indistinguishable from streaming
- H16: Sources overwritten to last message only (`useConversations.ts:33–38`)
- M15: Escape during rename leaves `renameValue` dirty — next rename pre-fills with abandoned text
- M16: "Show all" expands within fixed 200px scroll container (misleading)
- L7: No absolute timestamp on hover — `timeAgo()` only

## Flow 7: Source Panel / Citations
- H14 (repeat): Citation treatment dead
- H17: No visual link between a message and its sources — no superscript, no hover highlight, no grouping
- H18: Source panel appearing/disappearing causes 280px layout jump, no transition
- M17: `relevanceColor()` uses hardcoded hex (`SourcePanel.tsx:4–8`)
- M18: `relevance_score` not range-validated — if backend returns 0–1 float, bars are invisible

## Flow 8: Document Preview
- H19: Click-to-preview triggers a second full PDF load to search highlight text — synchronous for-loop over all pages
- H20: Highlight match ratio 0.3 = 30% word overlap → false positives across paragraphs
- H21: **Entire `DocumentPreview.css` off the design system** — cold neutrals (`#1f1f1f`, `#e5e5e5`) not warm stone tokens
- M19: iframe `onLoad` unreliable for non-PDF → "Loading..." never clears
- M20: `📄`/`📑` emoji in toggle button — inconsistent OS rendering
- M21: `border-radius: 12px` — should be `--radius-modal` (20px)
- L8: Keyboard nav requires manual focus — overlay `tabIndex={-1}` never programmatically focused

## Flow 9: Command Palette
- M22: **Rules of Hooks violation** — `useState(selectedIndex)` at line 114 is below early-return at line 52. Works today; StrictMode or React compiler will break it
- M23: "Toggle source panel" action — broken (C3)
- M24: `matchScore` treats query as single string — `"note sum"` returns zero results
- L9: No shortcut hints in palette items
- L10: Selected and hovered look identical

## Flow 10: Keyboard Shortcuts
- M25: `?` blocked when input focused — chat textarea almost always holds focus → `?` is essentially unreachable
- M26: Only 6 shortcuts. No notebook switching, upload, Zotero, preview, conversation nav
- L11: `Cmd+N` collides with macOS "New Window" convention

## Flow 11: Toasts / Error Feedback
- H22: 4s auto-dismiss + no persistence = no way to retrieve missed errors
- H23: Upload "Processing..." toast phantom (gone in 4s while indexing takes 45s)
- M27: `ConnectionBanner` doesn't monitor Ollama — if Ollama crashes mid-session, banner stays green, chat fails silently
- M28: Raw backend error strings surface to users ("Request failed with status 422")
- L12: Error toasts use `role="status"` instead of `role="alert"` — not announced immediately by screen readers

## Flow 12: Overflow Menu
- H24: "Clear chat" wipes messages + `activeConversationId` but leaves conversation in sidebar → orphan/ghost conversation
- H25: BibTeX export disabled after any context reset — even with historical messages that have sources
- M29: "Toggle sources" in menu (C3 broken)
- M30: `...` always-visible on chat header but opacity-0-until-hover on conversation rows — inconsistent

---

## Cross-Cutting

### Missing States
- Critical: `app-error` screen shows raw URL to end users, no retry button
- No empty state for source panel with zero-result queries
- No loading state for conversation history (reads as live generation)
- Chat empty state doesn't prompt to add docs when notebook is empty
- No visual distinction between truncated and complete messages

### Accessibility
- H: `DocumentCard`, `SourcePanel` have `role="button"` but no `onKeyDown`
- H: Conversation `...` button has no `aria-label`
- M: `CommandPalette` has no `role="dialog"`, no `aria-label`, no focus trap
- M: `DocumentPreview` overlay `tabIndex={-1}` never receives programmatic focus
- L: Reduced-motion rule sets animation-duration to 0.01ms — causes flicker, should be `animation: none !important`

### Onboarding / Discoverability
- H: No guidance post-wizard on citations, source panel, keyboard shortcuts
- H: Zotero import buried behind command palette search only
- M: Cross-notebook mode only appears with 2+ notebooks
- M: `?` shortcut hint exists on welcome but blocked by textarea focus in-app

### Data Integrity
- Critical: `setActiveNotebookId` clears `activeConversationId` — any null-reassignment orphans active convo
- H: Aborted stream leaves partial message; included in next send's history
- H: `clearMessages()` is called for 4 different intents (new chat, clear chat, switch, load) with identical side effects

### Error Recovery
- H: Backend down mid-stream: fallback → also fails → error in message bubble; `ConnectionBanner` up to 30s late
- H: Ollama crash mid-session: no banner, raw error in bubble
- M: Document preview fetch failure has `catch {}` — totally silent (`AppShell.tsx:221–226`)

### Token Violations
- H: `DocumentPreview.css` entirely off-system
- M: `DocumentCard.tsx` Tailwind hex
- M: `SourcePanel.tsx` hardcoded colors
- M: `setup-wizard.css` primary button color inconsistent
- M: `DocumentPreview.css` border-radius 12px (should be 20px)
- L: Font-weight axis: Bunny Fonts URL loads only 400/500/600/700 but CSS uses 450/550

---

## Essential Fix Targets

- `components/layout/SourcePanel.tsx` — C3 (respect `sourcePanelOpen`)
- `components/layout/Sidebar.tsx` — C4, C5, C9 (confirm, rename, confirm)
- `components/chat/MessageBubble.tsx` — H14 (custom ReactMarkdown renderer for citations)
- `hooks/useChat.ts` — C8, H11
- `DocumentPreview.css` — H21 (full rewrite using tokens)
- `DocumentPreview.tsx` — H19, L8, M20, M21
- `components/ui/SetupWizard.tsx` — C1, C2, M4
- `components/documents/DocumentCard.tsx` — C6, M11
- `components/ui/CommandPalette.tsx` — M22 (hooks ordering)
- `hooks/useConversations.ts` — C10, H15, H16
- `store/app-store.ts` — source panel toggle semantics, clearMessages decomposition
- `components/ui/ConnectionBanner.tsx` — M27, L3
- `design-system/tokens.css` — reduced-motion fix
- `index.html` — Bunny Fonts URL update
