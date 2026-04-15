# Notebook LM Design System — "Lazy Scholar"

**Date:** 2026-04-15
**Status:** Approved
**Personality:** Scholar aesthetic, lazy user UX
**Approach:** Complete design system overhaul + UX simplification

---

## Vision

A knowledge tool that looks like a quiet library and works like a personal assistant. The user drops a document and starts asking questions. Everything else is automatic. Every surface is calm, every interaction requires minimum effort, every default is the right choice.

**Target user:** A person who doesn't want to configure, organize, or think about the tool. They want answers from their documents with zero friction.

**Design direction:** Geometric humanist typography. Soft pill shapes. Generous type scale. Warm stone palette with sage accent. Airy spacing in content zones, balanced in navigation.

---

## 1. Typography

Font: System font stack with geometric humanist priority.

```css
--font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
--font-mono: 'SF Mono', 'JetBrains Mono', monospace;
```

Plus Jakarta Sans is a free geometric humanist font (Google Fonts). It has warmth, good readability at all sizes, and distinctive character without being loud. Falls back to San Francisco on macOS.

### Type Scale (Generous)

| Token | Size | Use |
|-------|------|-----|
| `--text-xs` | 12px | Labels, metadata, timestamps |
| `--text-sm` | 14px | Secondary text, captions, sidebar items |
| `--text-base` | 16px | Body text, chat messages, input fields |
| `--text-lg` | 18px | Section headings, card titles |
| `--text-xl` | 24px | Page headings |
| `--text-2xl` | 32px | Welcome screen title |

### Weight Scale

| Weight | Use |
|--------|-----|
| 400 | Body text, descriptions |
| 500 | UI labels, metadata, buttons |
| 600 | Headings, emphasis |
| 700 | Welcome title only |

### Letter Spacing

- Headings (xl, 2xl): `-0.02em` (tighter, more authoritative)
- Body (base, lg): `0` (default)
- Labels (xs, uppercase): `0.06em` (wider for readability at small size)

---

## 2. Shape System — Soft Pill

Every interactive element uses full pill radius (`border-radius: 999px`). This makes the entire interface feel friendly and approachable. Large hit targets for lazy users.

| Element | Radius | Padding |
|---------|--------|---------|
| Primary button | 999px | 12px 28px |
| Secondary button | 999px | 10px 22px |
| Small button | 999px | 8px 16px |
| Icon button | 50% (circle) | equal width/height |
| Tags/badges | 999px | 4px 12px |
| Input fields | 999px (single line), 20px (multiline textarea) | 14px 22px |
| Toast notifications | 999px | 12px 24px |
| Notebook items (sidebar) | 999px | 10px 16px |
| Source cards | 14px | 16px |
| Modals/overlays | 20px | 24px |

### Button Sizes

| Size | Height | Font | Weight | Use |
|------|--------|------|--------|-----|
| Large | 44px | 16px | 600 | Primary CTA (Send) |
| Default | 36px | 14px | 500 | Secondary actions |
| Small | 28px | 13px | 500 | Sidebar, tags, chips |

### Button States

```
Default  →  Hover (background shift)  →  Active (scale 0.97)  →  Disabled (opacity 0.35)
```

Primary button: sage background, dark text (`#0c0a09`).
Secondary button: transparent, border `rgba(245,240,234,0.1)`, text `--color-text-secondary`.
Ghost button: no border, text `--color-text-muted`, hover shows background.

---

## 3. Color System (Unchanged from Current)

The Manuscript palette with sage accent is confirmed:

```css
/* Backgrounds */
--color-bg-primary: #0c0a09;
--color-bg-secondary: #161412;
--color-bg-surface: #1c1917;
--color-bg-elevated: #262220;

/* Text */
--color-text-primary: #f5f0ea;
--color-text-secondary: #a8a29e;
--color-text-muted: #57534e;

/* Accent — sage */
--color-accent: #7c9a82;
--color-accent-hover: #6a8a70;
```

---

## 4. Spacing System

### Zone-Specific Density

| Zone | Grid | Rationale |
|------|------|-----------|
| Sidebar | 6px base (balanced) | Must show notebooks + documents without scrolling |
| Chat area | 8px base (airy) | Reading comfort, breathing room for messages |
| Source panel | 8px base (airy) | Glanceable reference, not dense navigation |

### Spacing Scale

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

### Specific Spacing Rules

- Chat messages: `--space-8` (32px) gap between messages
- Chat input area: `--space-6` (24px) padding on sides, `--space-5` (20px) top/bottom
- Sidebar notebook items: `--space-1` (4px) gap between items
- Sidebar sections: `--space-4` (16px) gap between notebook list and document list
- Source cards: `--space-3` (12px) gap between cards

---

## 5. UX Changes — Lazy User Overhaul

### 5.1 Remove: Permanent Drop Zone from Sidebar

**Current:** A `DropZone` component sits permanently in the sidebar.

**New:** Remove it entirely. Instead, implement full-window drag-and-drop:
- User drags a file anywhere over the app window
- A full-screen overlay appears with the text "Drop to add to [notebook name]" (or "Drop to create a new notebook" if no notebook is active)
- The overlay uses `--color-bg-primary` with 0.85 opacity, centered text, dashed border
- File types accepted: PDF, DOCX, PPTX, TXT, MD, PY

**Implementation:**
- Add `onDragOver`, `onDragLeave`, `onDrop` handlers to the `AppShell` component
- Create a `DragOverlay` component that renders when `isDragging` is true
- Remove `DropZone` import and usage from `Sidebar.tsx`
- The `DropZone` component file can be deleted

### 5.2 Simplify: "+ New" Button Behavior

**Current:** Creates an empty notebook via `POST /api/notebooks/`.

**New:** Opens the native file picker. When a file is selected, it uploads and auto-creates a notebook named after the file. No empty notebooks.

**Implementation:**
- In `Sidebar.tsx`, change the `onClick` of `sidebar-new-btn` to trigger a hidden file input
- On file select, call `uploadDocument(file)` which already creates a notebook
- Remove the `create()` call from `useNotebooks`

### 5.3 Simplify: Notebook Metadata Display

**Current:** Shows "3 docs" next to each notebook title.

**New:** Show relative time: "2h ago", "yesterday", "3 days ago". This is what drives re-opening behavior. The `updated_at` field already exists on the `Notebook` type.

**Implementation:**
- Add a `timeAgo(dateString: string): string` utility function
- In `Sidebar.tsx`, replace `{nb.source_count} docs` with `{timeAgo(nb.updated_at)}`

### 5.4 Simplify: Model Status

**Current:** Shows model name "phi3:mini" with a status dot.

**New:** Just the status dot with "Ready" text. No model name. The status is for confidence, not configuration.

**Implementation:**
- In `Sidebar.tsx`, replace `{config.resolved_ollama_model ?? config.ollama_model}` with just `'Ready'` when status is ready, `'Connecting...'` when checking, `'Offline'` when error.

### 5.5 Remove: Export/Hide Sources from Chat Header

**Current:** Two buttons always visible: "Export" and "Hide Sources".

**New:** Replace with a single "..." overflow button that opens a small popover menu with: Export, Toggle Sources, Clear Chat. These are infrequent actions that don't deserve permanent header space.

**Implementation:**
- Create a small `OverflowMenu` component: a pill-shaped "..." button that on click toggles a popover below it. Popover has 3 rows: "Export conversation", "Toggle sources", "Clear chat". Click outside or press Escape closes. Popover uses `--color-bg-elevated` with `--shadow-lg` and `--radius-lg`.
- Replace the two buttons in `ChatView.tsx` with the overflow menu
- The source panel toggle moves from header to overflow menu AND to `Cmd+/` shortcut

### 5.6 Simplify: Chat Input Placeholder

**Current:** "Ask about your documents... (Enter to send, Shift+Enter for new line)"

**New:** "Ask anything..."

### 5.7 Add: Quick Action Chips

**Current:** Empty chat shows a sage "?" circle with "Ask anything about your documents".

**New:** Replace the empty state with 3-4 clickable quick action chips. These are the primary CTA for lazy users. One click starts a conversation.

When no messages exist (empty chat with active notebook):
- "Summarize this document"
- "What are the key takeaways?"
- "Explain this simply"
- "Create a study guide"

When messages exist (after a response), show 2 follow-up chips below the last message:
- "Tell me more"
- "Simplify this"

Clicking a chip sends it as a message immediately.

**Implementation:**
- Create `QuickChips` component: accepts an array of `{label: string}`, renders as a horizontal flex row of pill buttons
- In `ChatView.tsx`, render `QuickChips` in the empty state area and after the last assistant message
- On click, call `send(chip.label)`

### 5.8 Simplify: Source Panel Auto-Collapse

**Current:** Source panel is always 280px, shows "Sources will appear here" when empty.

**New:** Source panel is hidden when `activeSources` is empty. It auto-expands (slides in) when a chat response includes source citations. Auto-collapse when the user starts a new chat.

**Implementation:**
- In `SourcePanel.tsx`, the component already returns `null` when `sourcePanelOpen` is false
- Change the store: `sourcePanelOpen` should be derived from `activeSources.length > 0` rather than a manual toggle
- Add a CSS transition on the source panel width for smooth expand/collapse
- Keep the `Cmd+/` shortcut as a manual override

### 5.9 Remove: Relevance Percentages

**Current:** Source cards show a relevance bar with "73%".

**New:** Remove the percentage and the bar entirely. Sources are already sorted by relevance. Position in the list IS the ranking. Simpler surface, zero cognitive load.

**Implementation:**
- In `SourcePanel.tsx`, remove the relevance bar JSX
- Remove `.source-card-relevance-*` CSS rules
- The source card now shows: document name + preview text. That's it.

### 5.10 Simplify: Welcome Screen Copy

**Current:** "Notebook LM" title, "Your documents, your machine, your privacy." subtitle.

**New:**
- Title: "Notebook LM"
- Subtitle: "Drop a document. Ask anything."
- Remove the permanent DropZone widget from welcome screen, use the same full-window drag overlay
- Add a "Browse files" pill button as fallback for users who don't drag-and-drop

### 5.11 Add: Full-Window Drag Overlay

A new component that renders when files are dragged over any part of the app window.

```
+--------------------------------------------------+
|                                                  |
|                                                  |
|        ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐          |
|        │                             │          |
|        │   Drop to add to            │          |
|        │   "Research Papers"         │          |
|        │                             │          |
|        └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘          |
|                                                  |
|                                                  |
+--------------------------------------------------+
```

Centered dashed border zone with notebook name. Background is `--color-bg-primary` at 0.9 opacity with backdrop blur. The overlay covers the entire window including sidebar and source panel.

---

## 6. Component Summary

### Changed Components

| Component | What Changes |
|-----------|-------------|
| `tokens.css` | Font family, type scale, button radius, spacing adjustments |
| `Sidebar.tsx` | Remove DropZone, change "+ New" to file picker, show timeAgo, simplify model status, pill-shaped notebook items |
| `ChatView.tsx` | Replace header buttons with overflow menu, simplify placeholder, add quick chips, remove empty state icon |
| `SourcePanel.tsx` | Remove relevance bars, auto-collapse behavior |
| `AppShell.tsx` | Add full-window drag overlay, remove welcome DropZone |

### New Components

| Component | Purpose |
|-----------|---------|
| `DragOverlay.tsx` | Full-window file drop overlay |
| `QuickChips.tsx` | Clickable suggestion chips |
| `OverflowMenu.tsx` | "..." popover for infrequent actions |

### Deleted Components

| Component | Reason |
|-----------|--------|
| `DropZone.tsx` | Replaced by full-window drag overlay |

### New Utilities

| Utility | Purpose |
|---------|---------|
| `timeAgo.ts` | Formats `updated_at` timestamps as "2h ago", "yesterday", etc. |

---

## 7. Scope Boundaries

### In scope (this spec)
- Complete design token overhaul (font, type scale, shapes, spacing)
- All 11 UX changes listed in Section 5
- New components: DragOverlay, QuickChips, OverflowMenu
- Remove DropZone component
- CSS updates across all component stylesheets

### Out of scope
- Setup wizard (separate spec)
- Chat history persistence (separate spec)
- Command palette (separate spec)
- Backend changes (no new endpoints needed for these changes)
- Theming / light mode
