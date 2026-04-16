# Changelog

All notable changes to Notebook LM will be documented in this file.

## [0.1.1.0] - 2026-04-15

### Added
- Command palette (Cmd+K) for searching notebooks, documents, and actions. Arrow keys + Enter for keyboard navigation.
- Keyboard shortcuts help overlay (press ? to see all shortcuts).
- Welcome screen now shows file format hints, "100% offline" badge, Cmd+K tip, and Ollama connection status.

### Changed
- Keyboard shortcuts moved from ChatView to a global handler in AppShell. New shortcuts: Cmd+K (palette), ? (help).
- Toasts now dismiss on click and cap at 3 visible at once.
- Notebook colors use the Lazy Scholar palette (warm muted tones) instead of the previous rainbow.

## [0.1.0.0] - 2026-04-15

### Added
- Chat conversations now persist across sessions. Switch notebooks, restart the app, your conversations are still there.
- Source relevance bars show how confident each retrieved source is (sage green = high, amber = medium, gray = low).
- Setup wizard guides first-time users through Ollama installation, model selection, and first document upload.
- After the wizard uploads your first document, the chat auto-suggests "Summarize this document" so you see the product working immediately.
- Conversation sidebar shows recent chats per notebook with rename and delete via hover menu.
- "Conversation saved" toast confirms your work is safe when switching notebooks.

### Fixed
- SQLite foreign keys now actually work (PRAGMA foreign_keys was disabled by default, making ON DELETE CASCADE dead code).
- Database operations now properly rollback on failure instead of committing partial writes.
- Source relevance scores use correct L2 distance normalization instead of a formula that went negative for distances > 1.
